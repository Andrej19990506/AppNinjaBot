import asyncio
import json
import logging
from src.socket_instance import sio
from src.database import (
    init_db,
    get_active_users_in_room,
    add_user_to_room,
    remove_user_from_room,
    subscribe_to_events
)
from datetime import datetime
from src.metrics import connected_clients, messages_sent
import functools

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("🚀 Инициализация websocket_handler.py")

# Глобальный обработчик ошибок Socket.IO
@sio.on("*")
async def catch_all(event, sid, *args, **kwargs):
    """Глобальный обработчик для всех событий"""
    logger.info(f"🎯 Получено событие: {event} от {sid}")
    logger.info(f"📦 Аргументы: {args}")
    logger.info(f"🔧 Параметры: {kwargs}")

@sio.on("error")
async def error_handler(sid, data):
    """Глобальный обработчик ошибок"""
    logger.error(f"🚫 Socket.IO ошибка для {sid}: {data}")
    logger.error("Полный стек ошибки:", exc_info=True)

@sio.event
async def connect_error(sid, data):
    """Обработчик ошибок подключения"""
    logger.error(f"🚫 Ошибка подключения для {sid}: {data}")
    logger.error("Полный стек ошибки:", exc_info=True)

# Словарь для хранения комнат пользователей
# Примечание: основная логика комнат теперь перенесена в server.py
# Этот словарь остается только для обратной совместимости
user_rooms = {}

# Список подключенных пользователей
active_users = set()

# Словарь информации о пользователях
user_info = {}

# Префикс для комнат курьеров
COURIER_ROOM_PREFIX = 'courier_room_'

# Константы для комнат
GLOBAL_ROOM = 'global'

# Добавляем константы для пинг-понга
PING_INTERVAL = 25  # интервал отправки пинга в секундах
PING_TIMEOUT = 10   # время ожидания понга в секундах

# Словарь для хранения таймеров пинг-понга
ping_timers = {}
pong_waiting = {}

def debug_handler(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        logger.info(f"🎯 Вызов функции {func.__name__}")
        logger.info(f"📦 Аргументы: {args}")
        logger.info(f"🔧 Параметры: {kwargs}")
        try:
            result = await func(*args, **kwargs)
            logger.info(f"✅ Функция {func.__name__} завершилась успешно")
            return result
        except Exception as e:
            logger.error(f"❌ Ошибка в функции {func.__name__}: {e}")
            logger.exception("Полный стек ошибки:")
            raise
    return wrapper

@sio.event
async def connect(sid, environ):
    """Обработчик подключения клиента"""
    try:
        logger.info("=" * 80)
        logger.info(f"🔌 Новое подключение: {sid}")
        logger.info(f"🌍 Окружение: {environ}")
        logger.info(f"🔒 Headers: {environ.get('headers', {})}")
        logger.info(f"🌐 Query String: {environ.get('QUERY_STRING', '')}")
        
        if connected_clients:
            connected_clients.inc()
            logger.info(f"📊 Увеличен счетчик подключенных клиентов")
        
        # Добавляем пользователя в список активных
        active_users.add(sid)
        logger.info(f"👥 Добавлен в список активных пользователей: {sid}")
        
        # Сохраняем базовую информацию о пользователе
        user_info[sid] = {
            "sid": sid,
            "connection_time": str(asyncio.get_event_loop().time()),
            "rooms": ['global'],
            "transport": environ.get('wsgi.url_scheme', 'unknown'),
            "user_info": {
                "displayName": f"User_{sid[:6]}"
            },
            "last_activity": asyncio.get_event_loop().time(),
            "connection_state": "active"
        }
        logger.info(f"📝 Сохранена информация о пользователе: {user_info[sid]}")
        
        # Запускаем пинг для нового пользователя
        asyncio.create_task(start_ping(sid))
        
        # Автоматически присоединяем пользователя к глобальной комнате
        await sio.enter_room(sid, 'global')
        if sid not in user_rooms:
            user_rooms[sid] = set()
        user_rooms[sid].add('global')
        logger.info(f"🚪 Пользователь {sid} автоматически добавлен в комнату global")
        
        # Отправляем приветствие новому клиенту
        await sio.emit('message', {'data': 'Connected successfully', 'isSystem': True}, room=sid)
        logger.info(f"📨 Отправлено приветственное сообщение: {sid}")
        
        # Уведомляем всех в комнате о новом пользователе
        await sio.emit('user_joined', {
            'status': 'success',
            'room': 'global',
            'user_info': user_info[sid].get('user_info'),
            'timestamp': user_info[sid]['connection_time']
        }, room='global', skip_sid=sid)
        
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при подключении: {e}")
        logger.exception("Полный стек ошибки:")
        return False

@sio.event
async def disconnect(sid):
    """Обработчик отключения клиента"""
    try:
        logger.info(f"Client disconnected: {sid}")
        
        # Проверяем причину отключения
        disconnect_reason = "manual"
        if sid in pong_waiting and pong_waiting[sid]:
            disconnect_reason = "timeout"
        
        # Очищаем таймеры
        if sid in ping_timers:
            ping_timers[sid].cancel()
            del ping_timers[sid]
        if sid in pong_waiting:
            del pong_waiting[sid]
        
        # Отправляем уведомление о причине отключения
        if sid in user_rooms:
            for room in user_rooms[sid].copy():
                await sio.emit('user_disconnected', {
                    'sid': sid,
                    'reason': disconnect_reason,
                    'user_info': user_info.get(sid, {}).get('user_info', {}),
                    'timestamp': str(asyncio.get_event_loop().time())
                }, room=room)
        
        # Удаляем пользователя из всех комнат
        if sid in user_rooms:
            rooms_to_leave = user_rooms[sid].copy()
            for room in rooms_to_leave:
                await leave_room(sid, room)
            del user_rooms[sid]
        
        # Удаляем пользователя из списка активных
        if sid in active_users:
            active_users.remove(sid)
        
        # Удаляем информацию о пользователе
        if sid in user_info:
            del user_info[sid]
        
        if connected_clients:
            connected_clients.dec()
            logger.info(f"📊 Уменьшен счетчик подключенных клиентов")
            
    except Exception as e:
        logger.error(f"Error in disconnect handler: {e}")
        logger.exception("Full error stack:")

async def start_ping(sid):
    """Запускает периодическую отправку пингов клиенту"""
    try:
        while sid in active_users:
            await asyncio.sleep(PING_INTERVAL)
            if sid not in active_users:
                break
                
            logger.debug(f"📤 Отправка пинга клиенту {sid}")
            pong_waiting[sid] = True
            
            try:
                await sio.emit('ping', {'timestamp': str(asyncio.get_event_loop().time())}, room=sid)
                
                # Ждем PING_TIMEOUT секунд ответа
                await asyncio.sleep(PING_TIMEOUT)
                
                # Если по-прежнему ждем понг, значит таймаут
                if sid in pong_waiting and pong_waiting[sid]:
                    logger.warning(f"⚠️ Таймаут пинга для клиента {sid}")
                    # Отмечаем состояние как "away"
                    if sid in user_info:
                        user_info[sid]['connection_state'] = 'away'
                        # Уведомляем всех в комнатах пользователя
                        for room in user_rooms.get(sid, set()):
                            await sio.emit('user_away', {
                                'sid': sid,
                                'user_info': user_info[sid].get('user_info', {}),
                                'timestamp': str(asyncio.get_event_loop().time())
                            }, room=room)
                    
            except Exception as e:
                logger.error(f"Error sending ping to {sid}: {e}")
                
    except Exception as e:
        logger.error(f"Error in ping loop for {sid}: {e}")
    finally:
        if sid in ping_timers:
            del ping_timers[sid]

@sio.event
async def pong(sid, data):
    """Обработчик получения понга от клиента"""
    try:
        if sid in pong_waiting:
            pong_waiting[sid] = False
            
        if sid in user_info:
            user_info[sid]['last_activity'] = asyncio.get_event_loop().time()
            
            # Если пользователь был away и вернулся
            if user_info[sid].get('connection_state') == 'away':
                user_info[sid]['connection_state'] = 'active'
                # Уведомляем всех в комнатах пользователя
                for room in user_rooms.get(sid, set()):
                    await sio.emit('user_back', {
                        'sid': sid,
                        'user_info': user_info[sid].get('user_info', {}),
                        'timestamp': str(asyncio.get_event_loop().time())
                    }, room=room)
                    
        logger.debug(f"📥 Получен понг от клиента {sid}")
        
    except Exception as e:
        logger.error(f"Error handling pong from {sid}: {e}")

@sio.event
async def join_room(sid, data):
    """Обработчик присоединения к комнате"""
    try:
        logger.info("=" * 80)
        logger.info(f"🎯 НАЧАЛО ОБРАБОТКИ JOIN_ROOM")
        logger.info(f"🔍 SID: {sid}")
        logger.info(f"📦 Данные: {data}")
        
        # Поддержка как объекта с room, так и просто строки
        if isinstance(data, dict):
            room = data.get('room')
            user_info_data = data.get('user_info', {})
        else:
            room = data
            user_info_data = {}

        logger.info(f"🚪 Попытка присоединения к комнате {room}")
        
        if not room:
            error_msg = {'error': 'Room not specified'}
            logger.error(f"❌ {error_msg}")
            return error_msg

        # Проверяем, не находится ли пользователь уже в комнате
        if sid in user_rooms and room in user_rooms[sid]:
            logger.info(f"ℹ️ Пользователь {sid} уже находится в комнате {room}")
            return {
                'status': 'success',
                'room': room,
                'user_info': user_info_data,
                'timestamp': str(asyncio.get_event_loop().time()),
                'already_joined': True
            }

        # Добавляем пользователя в комнату
        try:
            await sio.enter_room(sid, room)
            logger.info(f"✅ Пользователь {sid} добавлен в комнату {room}")
            
            # Сохраняем информацию о комнате пользователя
            if sid not in user_rooms:
                user_rooms[sid] = set()
            user_rooms[sid].add(room)
            
            # Обновляем информацию о пользователе
            if sid in user_info:
                user_info[sid].update({
                    'last_room': room,
                    'user_info': user_info_data
                })
            
            # Формируем ответ
            response = {
                'status': 'success',
                'room': room,
                'user_info': user_info_data,
                'timestamp': str(asyncio.get_event_loop().time())
            }
            
            # Отправляем уведомление всем в комнате
            await sio.emit('user_joined', response, room=room, skip_sid=sid)
            logger.info(f"📢 Отправлено уведомление о присоединении пользователя {sid} к комнате {room}")
            
            return response
            
        except Exception as e:
            error_msg = f"Error joining room: {str(e)}"
            logger.error(f"❌ Ошибка при входе в комнату: {e}")
            return {'error': error_msg}
            
    except Exception as e:
        error_msg = f"Error in join_room: {str(e)}"
        logger.error(f"❌ Общая ошибка в join_room: {e}")
        logger.exception("Полный стек ошибки:")
        return {'error': error_msg}
    finally:
        logger.info("=" * 80)

@sio.event
async def leave_room(sid, room):
    """Обработчик выхода из комнаты"""
    try:
        logger.info(f"🚪 Попытка выхода из комнаты {room} пользователем {sid}")
        
        # Удаляем пользователя из комнаты
        await sio.leave_room(sid, room)
        logger.info(f"✅ Пользователь {sid} удален из комнаты {room}")
        
        # Удаляем комнату из списка комнат пользователя
        if sid in user_rooms and room in user_rooms[sid]:
            user_rooms[sid].remove(room)
            logger.info(f"📝 Обновлен список комнат пользователя {sid}: {user_rooms[sid]}")
        
        # Удаляем пользователя из базы данных
        await remove_user_from_room(sid, room)
        
        # Формируем ответ
        response = {
            'status': 'success',
            'room': room,
            'timestamp': datetime.now().isoformat()
        }
        
        # Отправляем событие room_left всем в комнате
        await sio.emit('room_left', response, room=room, skip_sid=sid)
        logger.info(f"📢 Отправлено уведомление всем в комнате {room} о выходе {sid}")
        
        return response
        
    except Exception as e:
        error_msg = f"Error leaving room: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return {'error': error_msg}

@sio.event
async def message(sid, data):
    """Обработчик получения сообщения"""
    try:
        logger.info(f"Received message from {sid}: {data}")
        # Отправляем сообщение обратно клиенту
        await sio.emit('message', f"Server received: {data}", room=sid)
    except Exception as e:
        logger.error(f"Error handling message: {e}")

@sio.on('echo')
async def handle_echo(sid, data):
    """Эхо-обработчик для тестирования соединения"""
    logger.info(f"📢 Эхо-запрос от {sid}: {data}")
    await sio.emit('echo_response', {
        'status': 'success',
        'data': data,
        'server_time': datetime.now().isoformat(),
        'sid': sid
    }, room=sid)

async def notification_handler(payload):
    """Обработчик уведомлений от PostgreSQL"""
    try:
        data = json.loads(payload)
        event_type = data.get('type')
        
        if event_type == 'user_join':
            room = data.get('room')
            user_id = data.get('user_id')
            
            # Проверяем, является ли комната комнатой курьеров
            is_courier_room = room and room.startswith(COURIER_ROOM_PREFIX)
            
            await sio.emit('user_joined', {
                'room': room,
                'user_id': user_id,
                'is_courier': is_courier_room
            }, room=room)
            
        elif event_type == 'user_leave':
            room = data.get('room')
            user_id = data.get('user_id')
            await sio.emit('user_left', {
                'room': room,
                'user_id': user_id
            }, room=room)
            
        elif event_type == 'shift_update':
            # Отправляем уведомление о изменении смены всем курьерам
            chat_id = data.get('chat_id')
            courier_room = f"{COURIER_ROOM_PREFIX}{chat_id}"
            
            await sio.emit('shift_update', data, room=courier_room)
            
            # Также отправляем всем пользователям в глобальной комнате
            await sio.emit('shift_update', data, room='global')
            
        elif event_type == 'reserve_update':
            # Отправляем уведомление о изменении резерва всем курьерам
            chat_id = data.get('chat_id')
            courier_room = f"{COURIER_ROOM_PREFIX}{chat_id}"
            
            await sio.emit('reserve_update', data, room=courier_room)
            
            # Также отправляем всем пользователям в глобальной комнате
            await sio.emit('reserve_update', data, room='global')
            
    except Exception as e:
        logger.error(f"Error handling notification: {e}")

async def start_notification_listener():
    """Запуск слушателя уведомлений"""
    try:
        logger.info("Starting notification listener")
        await subscribe_to_events(notification_handler)
    except Exception as e:
        logger.error(f"Error starting notification listener: {e}")

# Вспомогательные функции для работы с комнатами курьеров

def get_courier_room_name(chat_id):
    """Получить имя комнаты для курьеров в конкретном чате"""
    return f"{COURIER_ROOM_PREFIX}{chat_id}"

async def send_message_to_courier_room(chat_id, event_name, data):
    """Отправить сообщение всем пользователям в комнате курьеров"""
    room = get_courier_room_name(chat_id)
    logger.info(f"Sending {event_name} to courier room {room}")
    await sio.emit(event_name, data, room=room)

@sio.event
async def get_room_users(sid, data):
    """Обработчик запроса списка пользователей в комнате"""
    try:
        if not isinstance(data, dict) or 'room' not in data:
            logger.error(f"❌ Неверный формат запроса: {data}")
            return {'error': 'Invalid request format'}

        room = data['room']
        logger.info(f"🎯 Получено событие: get_room_users от {sid}")
        logger.info(f"📦 Запрошена комната: {room}")

        # Получаем список пользователей в комнате
        room_users = []
        
        # Получаем все сиды в комнате напрямую из словаря комнат сервера
        server_rooms = sio.manager.rooms.get('/', {})
        room_sids = server_rooms.get(room, set())
        logger.info(f"📊 Найдены SID в комнате {room}: {room_sids}")

        for user_sid in room_sids:
            if user_sid in user_info and user_info[user_sid].get('user_info'):
                user_data = {
                    'sid': user_sid,
                    **user_info[user_sid].get('user_info', {}),
                    'connection_time': user_info[user_sid].get('connection_time')
                }
                room_users.append(user_data)
                logger.info(f"✅ Добавлен пользователь: {user_data}")

        response = {
            'status': 'success',
            'room': room,
            'users': room_users,
            'timestamp': str(asyncio.get_event_loop().time())
        }

        logger.info(f"📤 Подготовлен ответ: {response}")

        # Отправляем ответ только запросившему клиенту
        await sio.emit('users_list', response, room=sid)
        logger.info(f"📨 Отправлен список пользователей для комнаты {room}")
        
        return response

    except Exception as e:
        error_msg = f"Error getting room users: {str(e)}"
        logger.error(f"❌ {error_msg}")
        logger.exception("Полный стек ошибки:")
        return {'error': error_msg}

# Регистрируем обработчики явно
logger.info("🔄 Начинаем регистрацию обработчиков Socket.IO")

# Проверяем регистрацию обработчиков
handlers = [handler for handler in sio.handlers['/'].keys() if not handler.startswith('_')]
logger.info("=" * 80)
logger.info("🔍 Проверка регистрации обработчиков:")
logger.info(f"📋 Зарегистрированные обработчики: {handlers}")
logger.info(f"🎯 join_room обработчик: {'join_room' in handlers}")
logger.info("=" * 80)

logger.info("✅ Все обработчики событий успешно зарегистрированы") 