"""
Маршруты для работы с курьерами
"""
import json
import logging
import traceback
import os
import datetime
from flask import request, jsonify, current_app
from typing import Dict, Any, Optional

from . import couriers_bp
from data.users import get_user_data, get_courier_status_in_chat, get_user_groups

# Логгер
logger = logging.getLogger(__name__)

# def get_user_data(user_id: int) -> Dict[str, Any]:
#     """Получение данных пользователя из файлов members"""
#     try:
#         # Загружаем данные из members.json
#         members_data = current_app.load_bot_data('members.json')
#         
#         # Ищем пользователя во всех группах
#         for chat_id, chat_data in members_data.items():
#             members = chat_data.get('members', [])
#             
#             for member in members:
#                 if member.get('user_id') == user_id:
#                     # Нашли пользователя
#                     return {
#                         'user_id': user_id,
#                         'first_name': member.get('first_name', ''),
#                         'last_name': member.get('last_name', ''),
#                         'username': member.get('username', ''),
#                         'photo_url': member.get('photo_url', ''),
#                         'chat_id': chat_id,
#                         'member_data': member
#                     }
#         
#         # Пользователь не найден
#         return None
#     except Exception as e:
#         logger.error(f"Error getting user data for user {user_id}: {str(e)}")
#         return None

@couriers_bp.route('/<int:user_id>/groups', methods=['GET'])
def get_user_groups_route(user_id):
    """Получение списка групп, в которых состоит пользователь"""
    try:
        logger.info(f'Получение групп пользователя {user_id}')
        result = get_user_groups(user_id)
        
        # Устанавливаем CORS-заголовки
        response = jsonify(result)
        return set_cors_headers(response)
    except Exception as e:
        logger.error(f'Ошибка при получении групп пользователя: {str(e)}')
        logger.error(traceback.format_exc())
        response = jsonify({
            'success': False,
            'error': str(e)
        }), 500
        return set_cors_headers(response[0]), response[1]

def set_cors_headers(response):
    """Установка CORS-заголовков для ответа"""
    origin = request.headers.get('Origin', '')
    allowed_origins = [
        "https://nowhere-permissions-finder-conscious.trycloudflare.com",
        "https://consequently-iowa-brought-slide.trycloudflare.com",
        "https://constitute-handling-texas-interference.trycloudflare.com",
        "https://quiet-non-consistent-emissions.trycloudflare.com",
        "https://reform-hand-simple-invisible.trycloudflare.com",
        "https://pearl-roy-hugo-equity.trycloudflare.com",
        "http://localhost:3000"
    ]
    
    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "3600"
    return response

@couriers_bp.route('/<int:courier_id>/status', methods=['GET'])
def get_courier_status(courier_id):
    """Получение статуса курьера"""
    try:
        # Получаем chat_id из параметров запроса
        request_chat_id = request.args.get('chat_id')
        logger.info(f"=== Получение статуса курьера {courier_id} ===")
        logger.info(f"Chat ID из запроса: {request_chat_id}")
        
        # Загружаем данные об админах
        admins_data = current_app.load_bot_data('admins.json')
        logger.info(f"Данные об админах: {admins_data}")
        
        # Загружаем данные о пользователе
        user_data = get_user_data(courier_id)
        logger.info(f"Данные пользователя: {user_data}")
        
        if not user_data:
            logger.error(f"Пользователь {courier_id} не найден")
            return jsonify({
                'error': 'User not found',
                'status': 'not_found'
            }), 404
        
        # Используем chat_id из запроса, если он передан, иначе из данных пользователя
        chat_id = request_chat_id or user_data.get('chat_id')
        logger.info(f"Используемый chat_id: {chat_id}")
        
        if not chat_id:
            logger.error(f"Не удалось определить chat_id для пользователя {courier_id}")
            return jsonify({
                'error': 'Chat ID not found',
                'status': 'not_found'
            }), 404
            
        # Получаем статус курьера в чате
        if request_chat_id:
            courier_status = get_courier_status_in_chat(courier_id, request_chat_id)
            logger.info(f"Статус курьера в чате: {courier_status}")
            is_senior_courier = courier_status.get('is_senior_courier', False)
        else:
            is_senior_courier = user_data.get('is_senior_courier', False)
        
        # Проверяем, является ли пользователь админом
        is_admin = False
        chat_admins = admins_data.get(str(chat_id), {}).get('admins', [])
        logger.info(f"Админы чата: {chat_admins}")
        
        if courier_id in chat_admins:
            is_admin = True
        
        # Проверяем, есть ли у пользователя сессия
        sessions_data = current_app.load_bot_data('sessions.json')
        user_sessions = sessions_data.get(str(courier_id), [])
        active_session = None
        
        # Если есть активные сессии, берем последнюю
        if user_sessions:
            latest_session = user_sessions[-1]
            if latest_session.get('status') == 'active':
                active_session = latest_session
        
        # Загружаем данные о кошельке
        wallet_data = current_app.load_bot_data('wallets.json')
        user_wallet = wallet_data.get(str(courier_id), {'balance': 0, 'transactions': []})
        
        # Формируем ответ
        response = {
            'user_id': courier_id,
            'first_name': user_data.get('first_name', ''),
            'last_name': user_data.get('last_name', ''),
            'username': user_data.get('username', ''),
            'photo_url': user_data.get('photo_url', ''),
            'chat_id': chat_id,
            'is_admin': is_admin,
            'is_senior_courier': is_senior_courier,
            'active_session': active_session,
            'wallet': {
                'balance': user_wallet.get('balance', 0),
                'transactions_count': len(user_wallet.get('transactions', []))
            },
            'status': 'active'
        }
        
        logger.info(f"Возвращаем статус курьера: {response}")
        return set_cors_headers(jsonify(response))
    except Exception as e:
        logger.error(f"Error getting courier status for courier {courier_id}: {str(e)}")
        logger.error(traceback.format_exc())
        response = jsonify({'error': str(e)}), 500
        return set_cors_headers(response[0]), response[1]

@couriers_bp.route('/<int:courier_id>/promote', methods=['POST'])
def promote_courier(courier_id):
    """Повышение курьера до администратора"""
    try:
        # Проверяем аутентификацию
        auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not auth_token:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Загружаем данные о пользователе
        user_data = get_user_data(courier_id)
        
        if not user_data:
            return jsonify({'error': 'User not found'}), 404
        
        chat_id = user_data['chat_id']
        
        # Загружаем данные об админах
        admins_data = current_app.load_bot_data('admins.json')
        
        # Проверяем, существует ли запись для чата
        if str(chat_id) not in admins_data:
            admins_data[str(chat_id)] = {
                'chat_id': chat_id,
                'chat_title': user_data.get('chat_title', f'Chat {chat_id}'),
                'admins': []
            }
        
        # Проверяем, является ли пользователь уже админом
        chat_admins = admins_data[str(chat_id)].get('admins', [])
        
        if courier_id in chat_admins:
            return jsonify({
                'status': 'already_admin',
                'message': 'User is already an admin'
            })
        
        # Добавляем пользователя в список админов
        chat_admins.append(courier_id)
        admins_data[str(chat_id)]['admins'] = chat_admins
        
        # Сохраняем обновленные данные
        current_app.save_bot_data('admins.json', admins_data)
        
        # Отправляем уведомление в бот
        try:
            admin_user = get_user_data(int(auth_token))
            admin_name = admin_user.get('first_name', 'Admin') if admin_user else 'Admin'
            
            message = f"🌟 {user_data.get('first_name', 'Courier')} был(а) повышен(а) до администратора пользователем {admin_name}"
            current_app.send_telegram_message(chat_id, message)
        except Exception as e:
            logger.error(f"Error sending notification to Telegram: {str(e)}")
        
        return jsonify({
            'status': 'success',
            'message': 'User promoted to admin successfully'
        })
    except Exception as e:
        logger.error(f"Error promoting courier {courier_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/<int:courier_id>/demote', methods=['POST'])
def demote_courier(courier_id):
    """Понижение курьера из администраторов"""
    try:
        # Проверяем аутентификацию
        auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not auth_token:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Загружаем данные о пользователе
        user_data = get_user_data(courier_id)
        
        if not user_data:
            return jsonify({'error': 'User not found'}), 404
        
        chat_id = user_data['chat_id']
        
        # Загружаем данные об админах
        admins_data = current_app.load_bot_data('admins.json')
        
        # Проверяем, существует ли запись для чата
        if str(chat_id) not in admins_data:
            return jsonify({
                'status': 'not_admin',
                'message': 'User is not an admin'
            })
        
        # Проверяем, является ли пользователь админом
        chat_admins = admins_data[str(chat_id)].get('admins', [])
        
        if courier_id not in chat_admins:
            return jsonify({
                'status': 'not_admin',
                'message': 'User is not an admin'
            })
        
        # Удаляем пользователя из списка админов
        chat_admins.remove(courier_id)
        admins_data[str(chat_id)]['admins'] = chat_admins
        
        # Сохраняем обновленные данные
        current_app.save_bot_data('admins.json', admins_data)
        
        # Отправляем уведомление в бот
        try:
            admin_user = get_user_data(int(auth_token))
            admin_name = admin_user.get('first_name', 'Admin') if admin_user else 'Admin'
            
            message = f"⬇️ {user_data.get('first_name', 'Courier')} был(а) лишен(а) прав администратора пользователем {admin_name}"
            current_app.send_telegram_message(chat_id, message)
        except Exception as e:
            logger.error(f"Error sending notification to Telegram: {str(e)}")
        
        return jsonify({
            'status': 'success',
            'message': 'User demoted from admin successfully'
        })
    except Exception as e:
        logger.error(f"Error demoting courier {courier_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/profile/<int:user_id>', methods=['PUT', 'OPTIONS'])
def update_courier_profile(user_id):
    """Обновление профиля курьера"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'PUT')
        return response

    try:
        data = request.get_json()
        first_name = data.get('firstName')
        last_name = data.get('lastName')
        is_senior_courier = data.get('isSeniorCourier', False)

        if not first_name or not last_name:
            return jsonify({'error': 'Необходимо указать имя и фамилию'}), 400

        # Путь к файлу с данными курьеров
        courier_data_path = os.path.join(current_app.config.get('APP_DIR', ''), 'telegramNinjaBot', 'data', 'courier_groups')
        
        # Загружаем данные пользователя
        user_data = get_user_data(user_id)
        
        if not user_data:
            return jsonify({'error': 'Пользователь не найден'}), 404
            
        chat_id = user_data.get('chat_id')
        
        # Загружаем данные из members.json
        members_data = current_app.load_bot_data('members.json')
        
        # Обновляем данные пользователя
        if str(chat_id) in members_data:
            for member in members_data[str(chat_id)].get('members', []):
                if member.get('user_id') == user_id:
                    member['first_name'] = first_name
                    member['last_name'] = last_name
                    member['is_senior_courier'] = is_senior_courier
                    break
            
            # Сохраняем обновленные данные
            current_app.save_bot_data('members.json', members_data)
            
            return jsonify({
                'status': 'success',
                'message': 'Профиль успешно обновлен',
                'user': {
                    'user_id': user_id,
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_senior_courier': is_senior_courier
                }
            })
        else:
            return jsonify({'error': 'Чат не найден'}), 404
    except Exception as e:
        logger.error(f"Error updating courier profile for user {user_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/password/change-request/<int:user_id>', methods=['POST'])
def courier_password_change_request(user_id):
    """Запрос на смену пароля курьера"""
    try:
        data = request.get_json()
        
        # Генерируем код подтверждения
        import random
        confirmation_code = str(random.randint(100000, 999999))
        
        # Загружаем данные пользователя
        user_data = get_user_data(user_id)
        
        if not user_data:
            return jsonify({'error': 'Пользователь не найден'}), 404
            
        chat_id = user_data.get('chat_id')
        
        # Загружаем/создаем данные кодов подтверждения
        from pathlib import Path
        data_dir = Path(current_app.config.get('APP_DIR', '')) / 'telegramNinjaBot' / 'data'
        codes_file = data_dir / 'confirmation_codes.json'
        
        codes_data = {}
        if codes_file.exists():
            with open(codes_file, 'r', encoding='utf-8') as f:
                try:
                    codes_data = json.load(f)
                except json.JSONDecodeError:
                    codes_data = {}
        
        # Сохраняем код для пользователя
        codes_data[str(user_id)] = {
            'code': confirmation_code,
            'timestamp': int(datetime.datetime.now().timestamp()),
            'type': 'password_change'
        }
        
        with open(codes_file, 'w', encoding='utf-8') as f:
            json.dump(codes_data, f, ensure_ascii=False, indent=2)
        
        # Отправляем код пользователю через бот
        try:
            message = f"🔐 Код подтверждения для смены пароля: {confirmation_code}\n\nЕсли вы не запрашивали смену пароля, проигнорируйте это сообщение."
            current_app.send_telegram_message(user_id, message, is_user_id=True)
            
            return jsonify({
                'status': 'success',
                'message': 'Код подтверждения отправлен'
            })
        except Exception as e:
            logger.error(f"Error sending confirmation code to user {user_id}: {str(e)}")
            return jsonify({'error': 'Не удалось отправить код подтверждения'}), 500
    except Exception as e:
        logger.error(f"Error processing password change request for user {user_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/password/verify', methods=['POST'])
def verify_courier_password():
    """Проверка кода подтверждения для смены пароля"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        confirmation_code = data.get('code')
        new_password = data.get('new_password')
        
        if not user_id or not confirmation_code or not new_password:
            return jsonify({'error': 'Не указаны обязательные параметры'}), 400
        
        # Загружаем данные кодов подтверждения
        from pathlib import Path
        import datetime
        
        data_dir = Path(current_app.config.get('APP_DIR', '')) / 'telegramNinjaBot' / 'data'
        codes_file = data_dir / 'confirmation_codes.json'
        
        if not codes_file.exists():
            return jsonify({'error': 'Код подтверждения не найден'}), 404
        
        with open(codes_file, 'r', encoding='utf-8') as f:
            try:
                codes_data = json.load(f)
            except json.JSONDecodeError:
                return jsonify({'error': 'Код подтверждения не найден'}), 404
        
        # Проверяем код пользователя
        user_code_data = codes_data.get(str(user_id))
        
        if not user_code_data:
            return jsonify({'error': 'Код подтверждения не найден'}), 404
        
        if user_code_data.get('type') != 'password_change':
            return jsonify({'error': 'Неверный тип кода подтверждения'}), 400
        
        # Проверяем время действия кода (30 минут)
        timestamp = user_code_data.get('timestamp', 0)
        now = int(datetime.datetime.now().timestamp())
        
        if now - timestamp > 30 * 60:
            return jsonify({'error': 'Код подтверждения истек'}), 400
        
        # Проверяем сам код
        if user_code_data.get('code') != confirmation_code:
            return jsonify({'error': 'Неверный код подтверждения'}), 400
        
        # Обновляем пароль пользователя
        passwords_file = data_dir / 'passwords.json'
        
        passwords_data = {}
        if passwords_file.exists():
            with open(passwords_file, 'r', encoding='utf-8') as f:
                try:
                    passwords_data = json.load(f)
                except json.JSONDecodeError:
                    passwords_data = {}
        
        # Хешируем пароль
        import hashlib
        password_hash = hashlib.sha256(new_password.encode()).hexdigest()
        
        # Сохраняем новый пароль
        passwords_data[str(user_id)] = {
            'hash': password_hash,
            'updated_at': now
        }
        
        with open(passwords_file, 'w', encoding='utf-8') as f:
            json.dump(passwords_data, f, ensure_ascii=False, indent=2)
        
        # Удаляем использованный код
        del codes_data[str(user_id)]
        
        with open(codes_file, 'w', encoding='utf-8') as f:
            json.dump(codes_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'status': 'success',
            'message': 'Пароль успешно изменен'
        })
    except Exception as e:
        logger.error(f"Error verifying password change: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500 