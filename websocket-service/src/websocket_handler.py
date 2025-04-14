import asyncio
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timedelta
import functools # Переносим functools выше для порядка
from typing import Dict, Set, Any

import aiohttp
# import socketio # <-- Убираем импорт socketio
from dotenv import load_dotenv
# Убираем импорт Gauge и REGISTRY отсюда
# from prometheus_client import Gauge, REGISTRY 

# Импортируем sio из socket_instance
from .socket_instance import sio # <-- ИМПОРТИРУЕМ ПРАВИЛЬНЫЙ SIO

# --- Возвращаем импорт метрик из metrics.py ---
from .metrics import connected_clients, events_received 
# ---------------------------------------------

# Загрузка переменных окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Настройки Socket.IO # <-- Убираем создание sio и app
# sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins=os.getenv('CORS_ALLOWED_ORIGINS', '*'))
# app = aiohttp.web.Application()
# sio.attach(app)

# Время жизни неактивных пользователей (в секундах)
USER_INACTIVITY_TIMEOUT = int(os.getenv('USER_INACTIVITY_TIMEOUT', 1800)) # 30 минут

# Глобальные хранилища
user_info = defaultdict(lambda: {'last_activity': datetime.utcnow(), 'rooms': set(), 'is_away': False})
user_rooms = defaultdict(set) # sid -> {room1, room2}
room_users = defaultdict(set) # room -> {sid1, sid2}

# Префиксы для комнат
COURIER_ROOM_PREFIX = 'couriers_'
RESERVE_ROOM_PREFIX = 'reserves_'
ADMIN_ROOM_PREFIX = 'admins_'

# Глобальный обработчик ошибок Socket.IO
# @sio.on("*") # <-- Комментируем декоратор
# async def catch_all(event, sid, *args, **kwargs): # <-- Комментируем функцию
#     \"\"\"Глобальный обработчик для всех событий\"\"\"
#     logger.info(f\" CATCH_ALL received event: '{event}' from SID: {sid}\")\n#     logger.info(f\"🎯 Получено событие: {event} от {sid}\")\n#     logger.info(f\"📦 Аргументы: {args}\")\n#     logger.info(f\"🔧 Параметры: {kwargs}\")\n

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

# Список подключенных пользователей - Убираем, т.к. не используем?
# active_users = set()

# Добавляем константы для пинг-понга
PING_INTERVAL = 25  # интервал отправки пинга в секундах
PING_TIMEOUT = 10   # время ожидания понга в секундах

# Словарь для хранения таймеров пинг-понга
ping_timers = {}
pong_waiting = {}

# Словарь для хранения информации о пользователях {sid: user_data}
user_info: Dict[str, Dict[str, Any]] = {}
# Словарь для отслеживания комнат каждого пользователя {sid: set(rooms)}
user_rooms: Dict[str, Set[str]] = {}
# Словарь для отслеживания пользователей в каждой комнате {room: set(sids)}
room_users: Dict[str, Set[str]] = defaultdict(set)
# --- Новый словарь для связи userId -> sid --- 
user_id_to_sid: Dict[str, str] = {}
# -------------------------------------------

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
async def connect(sid, environ, auth):
    """Обработчик подключения клиента"""
    user_id = None # Инициализируем userId
    try:
        # --- Извлекаем userId из auth аргумента --- 
        if auth and isinstance(auth, dict):
            user_id = auth.get('userId')
            logger.info(f"👤 Попытка подключения от User ID: {user_id} (SID: {sid})")
        else:
            logger.warning(f"⚠️ Не удалось извлечь userId из auth данных для SID: {sid}. Auth: {auth}")
        # --------------------------------------

        logger.info("=" * 80)
        logger.info(f"🔌 Новое подключение: {sid}")
        logger.info(f"🌍 Окружение (частично): { {k: v for k, v in environ.items() if k.startswith('HTTP') or k in ['PATH_INFO', 'QUERY_STRING']} }") # Логируем только часть environ

        # --- Логика восстановления/обновления сессии --- 
        previous_sid = None
        if user_id:
            previous_sid = user_id_to_sid.get(user_id)
            if previous_sid and previous_sid != sid:
                logger.info(f"🔄 Обнаружено переподключение для User ID: {user_id}. Старый SID: {previous_sid}, Новый SID: {sid}")
                # Удаляем старую информацию (или переносим комнаты?)
                if previous_sid in user_info:
                    logger.info(f"🧹 Удаление старой информации для SID: {previous_sid}")
                    # Можно перенести комнаты:
                    # existing_rooms = user_info[previous_sid].get('rooms', set())
                    del user_info[previous_sid]
                if previous_sid in user_rooms:
                    del user_rooms[previous_sid]
                # Обновляем карту user_id -> sid
                user_id_to_sid[user_id] = sid
            elif not previous_sid:
                # Новый пользователь с user_id
                user_id_to_sid[user_id] = sid
                logger.info(f"맵핑 New mapping: User ID {user_id} -> SID {sid}")
        # -------------------------------------------------- 

        # Инкрементируем счетчик ТОЛЬКО если это действительно новое подключение (нет ошибки)
        if connected_clients is not None:
            connected_clients.inc()
            logger.info(f"📊 Увеличен счетчик подключенных клиентов")
        
        # Сохраняем базовую информацию о пользователе
        user_info[sid] = { # Используем новый sid как ключ
            "sid": sid,
            "user_id": user_id, # Сохраняем user_id
            "connection_time": str(asyncio.get_event_loop().time()),
            "rooms": set(), # Начинаем с пустого набора комнат (или переносим из старого sid?)
            "transport": environ.get('wsgi.url_scheme', 'unknown'),
            "user_info": {}, # Данные профиля добавятся при join_room
            "last_activity": asyncio.get_event_loop().time(),
            "connection_state": "active"
        }
        logger.info(f"📝 Сохранена/обновлена информация о пользователе: {user_info[sid]}")
        
        # Автоматически присоединяем пользователя к глобальной комнате
        await sio.enter_room(sid, 'global')
        if sid not in user_rooms:
            user_rooms[sid] = set()
        user_rooms[sid].add('global')
        logger.info(f"🚪 Пользователь {sid} (User ID: {user_id}) автоматически добавлен в комнату global")
        
        # Отправляем приветствие новому клиенту
        await sio.emit('message', {'data': 'Connected successfully', 'isSystem': True}, room=sid)
        logger.info(f"📨 Отправлено приветственное сообщение: {sid}")
        
        # Уведомляем всех в комнате о новом пользователе (можно добавить user_id)
        await sio.emit('user_joined', {
            'status': 'success',
            'room': 'global',
            'user_info': user_info[sid].get('user_info', {}), # Пока пустое
            'sid': sid,
            'user_id': user_id,
            'timestamp': user_info[sid]['connection_time']
        }, room='global', skip_sid=sid)
        
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при подключении (User ID: {user_id}, SID: {sid}): {e}")
        logger.exception("Полный стек ошибки:")
        # Если была ошибка, откатываем инкремент счетчика, если он был
        if connected_clients is not None:
            # Проверить, успели ли мы сделать inc() до ошибки
            # Проще пока не декрементировать, чтобы не усложнять
            pass
        # Удаляем информацию, если она успела создаться
        if sid in user_info:
            del user_info[sid]
        if user_id and user_id_to_sid.get(user_id) == sid:
            del user_id_to_sid[user_id]
            
        return False # Явно возвращаем False при ошибке

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
                await leave_room(sid, room) # leave_room теперь не трогает БД
            del user_rooms[sid]
        
        # Удаляем пользователя из списка активных
        # if sid in active_users: # Убираем
        #     active_users.remove(sid)
        
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
    # !!!!! ДОБАВЛЯЕМ ЛОГИ ПРЯМО В НАЧАЛЕ !!!!!
    logger.info(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    logger.info(f"!!!! JOIN_ROOM RECEIVED !!!! sid={sid}, data={data}")
    logger.info(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")

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
            return {'error': error_msg['error']}

        # Проверяем, не находится ли пользователь уже в комнате
        if sid in user_rooms and room in user_rooms[sid]:
            logger.info(f"ℹ️ Пользователь {sid} уже находится в комнате {room}")
            # Возможно, стоит вернуть текущее состояние или просто success
            return {'status': 'already_joined', 'room': room}

        # Добавляем пользователя в комнату
        try:
            await sio.enter_room(sid, room)
            logger.info(f"✅ Пользователь {sid} добавлен в комнату {room}")
            
            # Обновляем информацию о пользователе и комнатах
            if sid not in user_rooms:
                user_rooms[sid] = set()
            user_rooms[sid].add(room)
            
            # Добавляем sid пользователя в множество пользователей комнаты
            if room not in room_users: # Добавляем инициализацию, если комнаты еще нет
                room_users[room] = set()
            room_users[room].add(sid) # Добавляем пользователя в комнату

            if sid in user_info:
                user_info[sid]['rooms'] = user_rooms[sid] # Обновляем комнаты в user_info
                user_info[sid]['last_activity'] = asyncio.get_event_loop().time() # Обновляем активность
                if user_info_data: # Если передали доп. инфу
                    user_info[sid]['user_info'].update(user_info_data) # Обновляем инфу
            else: # Если пользователя нет в user_info (маловероятно, но на всякий случай)
                logger.warning(f"⚠️ Пользователя {sid} нет в user_info при входе в комнату {room}")
            
            # Формируем ответ
            response = {
                'status': 'success',
                'room': room,
                'user_info': user_info.get(sid, {}).get('user_info', {}), # Берем обновленную user_info
                'sid': sid,
                'timestamp': str(asyncio.get_event_loop().time())
            }
            
            # Отправляем уведомление всем в комнате (кроме самого пользователя)
            await sio.emit('user_joined', response, room=room, skip_sid=sid) 
            logger.info(f"📢 Отправлено уведомление о присоединении пользователя {sid} к комнате {room}")
            
            # Формируем список пользователей для отправки присоединившемуся
            current_room_sids = room_users.get(room, set()) # Получаем SIDы из room_users
            current_room_users_details = []
            for user_sid in current_room_sids:
                user_details = user_info.get(user_sid, {}).get('user_info', {})
                current_room_users_details.append({ # Собираем детали пользователей
                    'sid': user_sid,
                    'user_info': user_details
                })

            # Отправляем клиенту список пользователей в комнате
            await sio.emit('room_users', {'room': room, 'users': current_room_users_details}, room=sid) # Используем собранный список
            logger.info(f"📨 Отправлен список пользователей комнаты {room} клиенту {sid}")

            return response
            
        except Exception as e:
            error_msg = f"Error joining room: {str(e)}"
            logger.error(f"❌ Ошибка при входе в комнату: {e}")
            # Попробуем откатить изменения, если вход не удался
            if sid in user_rooms and room in user_rooms[sid]:
                user_rooms[sid].remove(room)
            if room in room_users and sid in room_users[room]:
                room_users[room].remove(sid)
            try: # Отдельный try для leave_room, чтобы не маскировать исходную ошибку
                await sio.leave_room(sid, room)
            except Exception as leave_err:
                logger.error(f"Error leaving room after failed join for {sid} in {room}: {leave_err}")
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
        logger.info(f"✅ Пользователь {sid} удален из комнаты {room} (Socket.IO)")
        
        # Удаляем комнату из списка комнат пользователя
        if sid in user_rooms and room in user_rooms[sid]:
            user_rooms[sid].remove(room)
            logger.info(f"📝 Обновлен список комнат пользователя {sid}: {user_rooms[sid]}")
        
        # Уведомляем остальных в комнате
        response = {
            'status': 'success',
            'room': room,
            'timestamp': datetime.now().isoformat()
        }
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
    """Обработчик уведомлений от PostgreSQL (канал websocket_channel)"""
    try:
        data = json.loads(payload)
        event_type = data.get('type')
        logger.info(f"🔔 Получено уведомление PostgreSQL: type='{event_type}', data: {data}")

        # Извлекаем chat_id заранее, если он есть
        chat_id = data.get('chat_id')
        courier_room = f"{COURIER_ROOM_PREFIX}{chat_id}" if chat_id else None

        # Обрабатываем ТОЛЬКО наши кастомные типы
        if event_type == 'shifts_updated': # <<< Слушаем именно этот тип
            if courier_room:
                # Извлекаем полные данные смены ИЗ УВЕДОМЛЕНИЯ
                shift_data = data.get('shift_data')
                source = data.get('source', 'unknown')

                if not shift_data:
                    logger.error(f"❌ Не найдены данные смены ('shift_data') в уведомлении shifts_updated: {data}")
                    return # Не можем продолжить без данных
                
                # Убедимся, что shift_data - это словарь (хотя после json.loads должен быть)
                if not isinstance(shift_data, dict):
                    logger.error(f"❌ Данные смены ('shift_data') в уведомлении не являются словарем: {type(shift_data)}")
                    return

                logger.info(f"✅ Получены полные данные смены ID: {shift_data.get('id')} из уведомления PostgreSQL.")

                # Готовим payload для WebSocket. Фронтенд ожидает объект ApiShift.
                # Мы предполагаем, что shift_data УЖЕ содержит все нужные поля (включая member).
                ws_payload = {
                    **shift_data, # Разворачиваем все данные смены
                    'source': source # Добавляем источник, если нужно
                    # type можно не добавлять, т.к. фронт его получит из имени события
                }

                # Отправляем событие 'shifts_updated' с полными данными
                await sio.emit('shifts_updated', ws_payload, room=courier_room)
                logger.info(f"📢 Отправлено событие shifts_updated с полными данными (ID: {shift_data.get('id')}) в комнату {courier_room}")

            else:
                 logger.warning(f"⚠️ Не найден chat_id в уведомлении shifts_updated: {data}")

        elif event_type == 'shift_cancelled':
            if courier_room:
                payload_to_send = {
                    'shift_id': data.get('shift_id') or data.get('id'),
                    'chat_id': chat_id
                }
                if payload_to_send['shift_id']:
                    await sio.emit('shift_cancelled', payload_to_send, room=courier_room)
                    logger.info(f"📢 Отправлено shift_cancelled (id: {payload_to_send['shift_id']}) в комнату {courier_room}...")
                else:
                    logger.error(f"❌ Не найден ID смены ('shift_id' или 'id') в уведомлении shift_cancelled: {data}")
            else:
                 logger.warning(f"⚠️ Не найден chat_id в уведомлении shift_cancelled: {data}")
        
        elif event_type == 'reserve_update': # Или reserve_added / reserve_deleted
             if courier_room:
                 # TODO: Проверить, что API шлет правильные типы уведомлений для резервов
                 # и фронтенд их обрабатывает
                 await sio.emit('reserve_update', data, room=courier_room) 
                 logger.info(f"📢 Отправлено reserve_update в комнату {courier_room}...")
             else:
                  logger.warning(f"⚠️ Не найден chat_id в уведомлении reserve_update: {data}")
        
        # --- ДОБАВЛЯЕМ ОБРАБОТКУ ОТКРЫТИЯ РЕГИСТРАЦИИ --- 
        elif event_type == 'registration_opened':
            if courier_room:
                # Отправляем событие REGISTRATION_OPENED
                await sio.emit('REGISTRATION_OPENED', data, room=courier_room)
                logger.info(f"🔑 Отправлено REGISTRATION_OPENED в комнату {courier_room}...")
            else:
                logger.warning(f"⚠️ Не найден chat_id в уведомлении registration_opened: {data}")
        # --- КОНЕЦ ДОБАВЛЕНИЯ --- 
            
        # Добавить обработку других нужных типов (reserve_added, reserve_deleted)
        # elif event_type == 'reserve_added': ...
        # elif event_type == 'reserve_deleted': ...
        else:
            logger.warning(f"⚠️ Неизвестный или ненужный тип уведомления: {event_type}")

    except json.JSONDecodeError as json_error:
        logger.error(f"❌ Ошибка декодирования JSON в уведомлении PostgreSQL: {json_error}")
        logger.error(f"Оригинальный payload: {payload}")
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке уведомления PostgreSQL: {e}")
        logger.exception("Полный стек ошибки:")

async def start_notification_listener():
    """Запуск слушателя уведомлений"""
    try:
        logger.info("Starting notification listener task (websocket_channel only)...")
        await subscribe_to_events(notification_handler)
        logger.info("Notification listener finished (should not happen normally)")
    except Exception as e:
        logger.error(f"Error starting notification listener: {e}")
        logger.exception("Notification listener startup error stack:")

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

@sio.event
async def book_shift(sid, data):
    """Обработчик бронирования смены"""
    try:
        logger.info(f"📝 Получено бронирование смены от {sid}: {data}")
        
        # Отправляем HTTP запрос к API
        async with aiohttp.ClientSession() as session:
            # TODO: Убедиться, что URL правильный (/api/v1/shifts)
            api_url = os.getenv('API_SERVICE_URL', 'http://server:8000') + '/api/v1/shifts' 
            async with session.post(api_url, json=data) as response:
                if response.status == 201:
                    result = await response.json()
                    logger.info(f"✅ Смена успешно забронирована API: {result}")
                    
                    # Отправляем уведомление в комнату чата
                    chat_id = data.get('chat_id') # Предполагаем, что chat_id есть в data
                    if chat_id:
                        # Используем обновленный префикс
                        courier_room = f"{COURIER_ROOM_PREFIX}{chat_id}"
                        # Отправляем событие shift_booked
                        await sio.emit('shift_booked', result, room=courier_room)
                        logger.info(f"📢 Отправлено shift_booked в комнату {courier_room}")
                    
                    return result
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Ошибка при бронировании смены: {error_text}")
                    await sio.emit('error', {
                        'message': f"Failed to book shift: {error_text}",
                        'status': response.status
                    }, room=sid)
                    return None
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке бронирования смены: {e}")
        logger.exception("Полный стек ошибки:")
        await sio.emit('error', {
            'message': f"Error processing shift booking: {str(e)}"
        }, room=sid)
        return None

@sio.event
async def shift_update(sid, data):
    """Обработчик обновления смены (переименовать бы в update_shift)"""
    try:
        logger.info(f"📝 Получено обновление смены от {sid}: {data}")
        
        # Отправляем HTTP запрос к API
        async with aiohttp.ClientSession() as session:
            # TODO: Убедиться, что URL и метод правильные (PUT /api/v1/shifts/{id} ?)
            api_url = os.getenv('API_SERVICE_URL', 'http://server:8000') + '/api/v1/shifts' # Placeholder URL
            # Метод, вероятно, должен быть PUT или PATCH, и нужен ID смены
            shift_id = data.get('id') 
            api_url_update = f"{os.getenv('API_SERVICE_URL', 'http://server:8000')}/api/v1/shifts/{shift_id}" if shift_id else None
            if not api_url_update:
                 logger.error(f"❌ Не найден ID смены для обновления в данных: {data}")
                 return None # Или отправить ошибку
                 
            async with session.put(api_url_update, json=data) as response: # Используем PUT
                if response.status == 200: # Ожидаем 200 OK для обновления
                    result = await response.json()
                    logger.info(f"✅ Смена успешно обновлена API: {result}")
                    
                    # Отправляем уведомление в комнату чата
                    chat_id = data.get('chat_id') # Предполагаем, что chat_id есть в data
                    if chat_id:
                        # Используем обновленный префикс
                        courier_room = f"{COURIER_ROOM_PREFIX}{chat_id}"
                        # Меняем имя события на shift_updated
                        await sio.emit('shift_updated', result, room=courier_room) 
                        logger.info(f"📢 Отправлено shift_updated в комнату {courier_room}")
                    
                    return result
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Ошибка при обновлении смены: {error_text}")
                    await sio.emit('error', {
                        'message': f"Failed to update shift: {error_text}",
                        'status': response.status
                    }, room=sid)
                    return None
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке обновления смены: {e}")
        logger.exception("Полный стек ошибки:")
        await sio.emit('error', {
            'message': f"Error processing shift update: {str(e)}"
        }, room=sid)
        return None

# Запускаем фоновую задачу прослушивания уведомлений при старте
@sio.event
async def startup():
    logger.info("🚀 WebSocket Server Startup Event")
    # Убираем init_db
    asyncio.create_task(start_notification_listener())
    logger.info("✅ Notification listener task created")

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

# Точка входа
if __name__ == '__main__':
    # ... (запуск asyncio loop и aiohttp app) ...
    pass 