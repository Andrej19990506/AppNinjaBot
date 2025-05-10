from flask import Blueprint, request, jsonify
from datetime import datetime
import logging
from services import CourierService
import requests
import json
from pathlib import Path
import traceback
import socketio

# Импортируем socketio object из app
try:
    from app import socketio_instance
except ImportError:
    # Если не можем импортировать напрямую, будем использовать глобальный объект позже
    socketio_instance = None

# Импортируем функции комнат для WebSocket
try:
    from ws_module.rooms import get_courier_room_name
except ImportError:
    # Если не удалось импортировать, создаем функцию заглушку
    def get_courier_room_name(chat_id):
        return f"courier_room_{chat_id}"

logger = logging.getLogger(__name__)
notifications_bp = Blueprint('notifications', __name__)
courier_service = CourierService()

# URL бота
BOT_URL = "http://bot:8001"

@notifications_bp.route('/api/telegram/courier-chats', methods=['GET'])
def get_courier_chats():
    """Получение списка курьерских чатов"""
    try:
        # Путь к директории с курьерскими группами в Docker контейнере
        courier_groups_dir = Path('/app/telegramNinjaBot/data/courier_groups')
        groups_index_file = courier_groups_dir / 'groups_index.json'
        
        logger.info(f"Ищем файл индекса курьерских групп по пути: {groups_index_file}")
        
        if not groups_index_file.exists():
            logger.error(f"Файл индекса курьерских групп не найден по пути: {groups_index_file}")
            return jsonify({"error": "Файл индекса курьерских групп не найден"}), 404
            
        with open(groups_index_file, 'r', encoding='utf-8') as f:
            groups_index = json.load(f)
            
        chats = []
        for chat_id, group_info in groups_index.items():
            group_file_path = courier_groups_dir / f"group_{chat_id}.json"
            logger.info(f"Проверяем файл группы: {group_file_path}")
            
            if group_file_path.exists():
                with open(group_file_path, 'r', encoding='utf-8') as f:
                    group_data = json.load(f)
                    if group_data.get('chat_id'):
                        chats.append({
                            'chat_id': group_data['chat_id'],
                            'title': group_data.get('chat_title', ''),
                            'type': group_data.get('type', ''),
                            'last_updated': group_info.get('last_updated', '')
                        })
        
        logger.info(f"Найдено {len(chats)} курьерских чатов")
        return jsonify({"chats": chats})
        
    except Exception as e:
        logger.error(f"Ошибка при получении списка курьерских чатов: {str(e)}")
        return jsonify({"error": f"Ошибка при получении списка курьерских чатов: {str(e)}"}), 500

def send_websocket_notification(chat_id, event_type, data):
    """Отправляет уведомление через WebSocket в указанную комнату"""
    try:
        if socketio_instance is None:
            # Если не удалось импортировать socketio_instance, пытаемся получить его из глобальной области
            from flask import current_app
            if hasattr(current_app, 'socketio'):
                sio = current_app.socketio
            else:
                logger.error("❌ socketio не найден в current_app")
                return False
        else:
            sio = socketio_instance

        # Получаем имя комнаты для указанного chat_id
        room_name = get_courier_room_name(chat_id)
        
        # Формируем данные события
        event_data = {
            'type': event_type,
            'timestamp': datetime.now().isoformat(),
            'chat_id': chat_id,
            'data': data
        }
        
        logger.info(f"📡 Отправка WebSocket события {event_type} в комнату {room_name}")
        
        # Отправляем событие в комнату
        sio.emit(event_type, event_data, room=room_name)
        
        # Также отправляем событие в глобальную комнату для общего обновления
        sio.emit(f'global_{event_type}', event_data, room='inventory_global')
        
        logger.info(f"✅ WebSocket событие {event_type} успешно отправлено")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке WebSocket события: {str(e)}")
        logger.error(traceback.format_exc())
        return False

@notifications_bp.route('/api/telegram/send_message', methods=['POST'])
def send_message():
    """Отправка сообщения в чаты через Telegram бота"""
    try:
        logger.info("=== Получен запрос на отправку сообщения ===")
        data = request.get_json()
        logger.info(f"Полученные данные: {data}")
        
        message = data.get('message')
        chat_ids = data.get('chat_ids')
        chat_id = data.get('chat_id')
        event_type = data.get('event_type', 'notification')  # Тип события для WebSocket
        
        if not message:
            logger.error("Не указан текст сообщения")
            return jsonify({"error": "Не указан текст сообщения"}), 400
            
        # Если передан chat_id, но нет chat_ids, используем chat_id
        if not chat_ids and chat_id:
            logger.info(f"Использую chat_id: {chat_id} вместо chat_ids")
            chat_ids = [chat_id]
            
        if not chat_ids:
            logger.info("chat_ids и chat_id не указаны, получаем все курьерские чаты")
            # Если chat_ids не указаны, получаем все курьерские чаты
            response = get_courier_chats()
            
            # Проверяем, что response - это кортеж из ответа и кода состояния
            if isinstance(response, tuple) and len(response) == 2:
                # Это случай, когда функция возвращает (jsonify(...), status_code)
                response_data, status_code = response
                if status_code != 200:
                    logger.error(f"Ошибка при получении списка чатов: {response_data.json}")
                    return response
                chats_data = response_data.json
            else:
                # Это случай, когда функция возвращает только jsonify(...)
                chats_data = response.json
                
            chat_ids = [str(chat['chat_id']) for chat in chats_data.get('chats', [])]
            
        if not chat_ids:
            logger.error("Нет доступных чатов для отправки")
            return jsonify({"error": "Нет доступных чатов для отправки"}), 404
            
        logger.info(f"Отправка сообщения в {len(chat_ids)} чатов")
            
        # Отправляем сообщение в каждый чат через API бота
        results = []
        for chat_id in chat_ids:
            try:
                logger.info(f"Отправка сообщения в чат {chat_id}")
                # Отправляем запрос к API бота
                response = requests.post(
                    f"{BOT_URL}/api/send_message",
                    json={
                        "chat_id": chat_id,
                        "text": message,
                        "parse_mode": data.get('parse_mode', 'HTML')
                    }
                )
                response.raise_for_status()
                logger.info(f"Сообщение успешно отправлено в чат {chat_id}")
                results.append({"chat_id": chat_id, "status": "success"})
                
                # Отправляем WebSocket уведомление
                notification_data = {
                    'message': message,
                    'parse_mode': data.get('parse_mode', 'HTML'),
                    'sent_at': datetime.now().isoformat(),
                    'source': data.get('source', 'api'),
                    'status': 'success'
                }
                
                # Если это уведомление об изменении доступности дат, добавляем флаг
                if 'availability' in event_type.lower() or 'schedule' in event_type.lower() or 'date' in event_type.lower():
                    notification_data['refresh_calendar'] = True
                    notification_data['refresh_settings'] = True
                    event_type = 'availability_update'  # Используем стандартное имя события
                
                # Отправляем WebSocket событие
                websocket_sent = send_websocket_notification(
                    chat_id, 
                    event_type, 
                    notification_data
                )
                
                if websocket_sent:
                    logger.info(f"✅ WebSocket уведомление отправлено для чата {chat_id}")
                else:
                    logger.warning(f"⚠️ WebSocket уведомление не было отправлено для чата {chat_id}")
                
            except Exception as e:
                logger.error(f"Ошибка при отправке сообщения в чат {chat_id}: {str(e)}")
                results.append({"chat_id": chat_id, "status": "error", "error": str(e)})
                
        logger.info(f"=== Результаты отправки: {results} ===")
        return jsonify({
            "success": True,
            "results": results
        })
        
    except Exception as e:
        logger.error(f"Ошибка при отправке сообщений: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Ошибка при отправке сообщений: {str(e)}"}), 500

# Дополнительный метод для прямой отправки WebSocket-уведомлений без использования Telegram-бота
@notifications_bp.route('/api/websocket/notify', methods=['POST'])
def send_websocket_notification_api():
    """API для отправки только WebSocket уведомлений"""
    try:
        data = request.get_json()
        logger.info(f"Получен запрос на отправку WebSocket уведомления: {data}")
        
        chat_id = data.get('chat_id')
        event_type = data.get('event_type', 'notification')
        notification_data = data.get('data', {})
        
        if not chat_id:
            logger.error("Не указан chat_id")
            return jsonify({"error": "Не указан chat_id"}), 400
        
        if not event_type:
            logger.error("Не указан event_type")
            return jsonify({"error": "Не указан event_type"}), 400
            
        # Добавляем метку времени, если она не указана
        if 'timestamp' not in notification_data:
            notification_data['timestamp'] = datetime.now().isoformat()
            
        # Отправляем уведомление
        websocket_sent = send_websocket_notification(chat_id, event_type, notification_data)
        
        if websocket_sent:
            logger.info(f"✅ WebSocket уведомление успешно отправлено: {event_type} для чата {chat_id}")
            return jsonify({
                "success": True,
                "message": f"WebSocket уведомление успешно отправлено",
                "event_type": event_type,
                "chat_id": chat_id
            })
        else:
            logger.error(f"❌ Не удалось отправить WebSocket уведомление")
            return jsonify({
                "success": False,
                "error": "Не удалось отправить WebSocket уведомление"
            }), 500
            
    except Exception as e:
        logger.error(f"Ошибка при отправке WebSocket уведомления: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Ошибка при отправке WebSocket уведомления: {str(e)}"}), 500

# Другие роуты и функции могут быть добавлены здесь 