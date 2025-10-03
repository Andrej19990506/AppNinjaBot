import asyncio
import json
import logging
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta
import functools 
from typing import Dict, Set, Any

import aiohttp
from dotenv import load_dotenv

from .socket_instance import sio
from .redis_client import redis_manager

# --- Возвращаем импорт метрик из metrics.py ---
from .metrics import connected_clients, events_received, messages_sent, connection_errors, redis_operations, message_processing_time, active_rooms 
# ---------------------------------------------

# Загрузка переменных окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Время жизни неактивных пользователей (в секундах)
USER_INACTIVITY_TIMEOUT = int(os.getenv('USER_INACTIVITY_TIMEOUT', 1800)) # 30 минут

# Глобальные хранилища (теперь используются только для локального кэша)
# Основное состояние хранится в Redis
user_info = defaultdict(lambda: {'last_activity': datetime.utcnow(), 'rooms': set(), 'is_away': False})
user_rooms = defaultdict(set) 
room_users = defaultdict(set)

# Словарь для отслеживания времени последних событий активности (для предотвращения гонки условий)
last_activity_events = {} 

# Префиксы для комнат
COURIER_ROOM_PREFIX = 'couriers_'
RESERVE_ROOM_PREFIX = 'reserves_'
ADMIN_ROOM_PREFIX = 'admins_'



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



# Добавляем константы для пинг-понга
PING_INTERVAL = 25  # интервал отправки пинга в секундах
PING_TIMEOUT = 10   # время ожидания понга в секундах
CONNECTION_TIMEOUT = 60  # время после которого считаем соединение потерянным

# Словарь для хранения таймеров пинг-понга
ping_timers = {}
pong_waiting = {}
connection_states = {}  # Новый словарь для отслеживания состояния подключения

# Словарь для хранения информации о пользователях {sid: user_data}
user_info: Dict[str, Dict[str, Any]] = {}
# Словарь для отслеживания комнат каждого пользователя {sid: set(rooms)}
user_rooms: Dict[str, Set[str]] = {}
# Словарь для отслеживания пользователей в каждой комнате {room: set(sids)}
room_users: Dict[str, Set[str]] = defaultdict(set)
# --- Новый словарь для связи userId -> sid --- 
user_id_to_sid: Dict[str, str] = {}

# Новые константы для отслеживания состояния
CONNECTION_STATES = {
    'ACTIVE': 'active',      # Пользователь активен и отвечает на пинги
    'AWAY': 'away',          # Пользователь не отвечает на пинги, но соединение может восстановиться
    'DISCONNECTED': 'disconnected',  # Пользователь явно отключился
    'TIMEOUT': 'timeout'     # Соединение потеряно по таймауту
}

# Константы для отслеживания активности пользователя
USER_ACTIVITY_STATES = {
    'ACTIVE': 'active',      # Пользователь активно использует приложение
    'INACTIVE': 'inactive'   # Пользователь неактивен (не использует приложение)
}

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
                if previous_sid in user_info:
                    logger.info(f"🧹 Удаление старой информации для SID: {previous_sid}")
                    del user_info[previous_sid]
                if previous_sid in user_rooms:
                    del user_rooms[previous_sid]
                user_id_to_sid[user_id] = sid
            elif not previous_sid:
                user_id_to_sid[user_id] = sid
                logger.info(f"맵핑 New mapping: User ID {user_id} -> SID {sid}")
        # -------------------------------------------------- 

        if connected_clients is not None:
            connected_clients.inc()
            logger.info(f"📊 Увеличен счетчик подключенных клиентов")
        
        # Сохраняем базовую информацию о пользователе
        connection_data = { # Используем новый sid как ключ
            "sid": sid,
            "user_id": user_id, # Сохраняем user_id
            "connection_time": str(time.time()),  # Используем реальный Unix timestamp
            "rooms": list(),  # Список комнат (для JSON сериализации)
            "transport": environ.get('wsgi.url_scheme', 'unknown'),
            "user_info": {}, # Данные профиля добавятся при join_room
            "last_activity": asyncio.get_event_loop().time(),
            "connection_state": CONNECTION_STATES['ACTIVE'],
            "user_activity_state": USER_ACTIVITY_STATES['ACTIVE'],
            "last_user_activity": time.time(),
            "last_ping_time": None,
            "last_pong_time": None,
            "ping_count": 0,
            "missed_pongs": 0
        }
        
        # Сохраняем в локальный кэш
        user_info[sid] = connection_data.copy()
        user_info[sid]['rooms'] = set()  # Для локального использования
        
        # Сохраняем в Redis
        await redis_manager.set_connection_info(sid, connection_data)
        
        # Увеличиваем счетчик Redis операций
        if redis_operations:
            redis_operations.labels(operation="set_connection_info", status="success").inc()
        
        # Инициализируем состояние подключения
        connection_states[sid] = {
            'state': CONNECTION_STATES['ACTIVE'],
            'connected_at': time.time(),
            'last_activity': time.time(),
            'ping_history': [],
            'connection_quality': 'good'
        }
        logger.info(f"📝 Сохранена/обновлена информация о пользователе: {connection_data}")
        
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
            'user_info': user_info[sid].get('user_info', {}),
            'sid': sid,
            'user_id': user_id,
            'timestamp': user_info[sid]['connection_time']
        }, room='global', skip_sid=sid)
        
        # Запускаем пинг-понг для нового клиента
        ping_timers[sid] = asyncio.create_task(start_ping(sid))
        logger.info(f"🔄 [PING] Запущен пинг-понг для клиента {sid}")
        
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при подключении (User ID: {user_id}, SID: {sid}): {e}")
        logger.exception("Полный стек ошибки:")
    
        if connected_clients is not None:
            pass
       
        if sid in user_info:
            del user_info[sid]
        if user_id and user_id_to_sid.get(user_id) == sid:
            del user_id_to_sid[user_id]
            
        return False # Явно возвращаем False при ошибке

@sio.event
async def disconnect(sid):
    """Обработчик отключения клиента"""
    try:
        logger.info(f"🔌 [CONNECTION] Клиент отключился: {sid}")
        
        # Получаем информацию о пользователе перед удалением
        user_data = user_info.get(sid, {}).get('user_info', {})
        user_id = user_info.get(sid, {}).get('user_id')
        
        # Удаляем из Redis
        await redis_manager.remove_connection_info(sid)
        
        # Удаляем пользователя из всех комнат в Redis
        if sid in user_info:
            rooms = user_info[sid].get('rooms', set())
            for room in rooms:
                await redis_manager.remove_user_from_room(sid, room)
        
        # Определяем причину отключения
        disconnect_reason = "manual"
        connection_quality = "unknown"
        
        if sid in connection_states:
            conn_state = connection_states[sid]
            if conn_state['state'] == CONNECTION_STATES['TIMEOUT']:
                disconnect_reason = "timeout"
            elif conn_state['state'] == CONNECTION_STATES['AWAY']:
                disconnect_reason = "away"
            connection_quality = conn_state.get('connection_quality', 'unknown')
        
        # Проверяем историю пингов для определения качества соединения
        if sid in user_info:
            missed_pongs = user_info[sid].get('missed_pongs', 0)
            ping_count = user_info[sid].get('ping_count', 0)
            
            if ping_count > 0:
                success_rate = ((ping_count - missed_pongs) / ping_count) * 100
                logger.info(f"📊 [CONNECTION] Статистика соединения для {sid}: успешность пингов {success_rate:.1f}%")
        
        # Очищаем таймеры
        if sid in ping_timers:
            ping_timers[sid].cancel()
            del ping_timers[sid]
        if sid in pong_waiting:
            del pong_waiting[sid]
        
        # Отправляем детальное уведомление о причине отключения
        if sid in user_rooms:
            for room in user_rooms[sid].copy():
                disconnect_event = {
                    'sid': sid,
                    'user_id': user_id,
                    'reason': disconnect_reason,
                    'connection_quality': connection_quality,
                    'user_info': user_data,
                    'timestamp': str(time.time()),
                    'connection_duration': time.time() - connection_states.get(sid, {}).get('connected_at', time.time()),
                    'room': room  # Добавляем информацию о комнате
                }
                await sio.emit('user_disconnected', disconnect_event, room=room)
                logger.info(f"📢 [CONNECTION] Отправлено уведомление об отключении в комнату {room}: {disconnect_reason}")
        
        # Удаляем пользователя из всех комнат
        if sid in user_rooms:
            rooms_to_leave = user_rooms[sid].copy()
            for room in rooms_to_leave:
                await leave_room(sid, room)
            del user_rooms[sid]
        
        # Удаляем информацию о пользователе
        if sid in user_info:
            # 🔧 НОВОЕ: Очищаем информацию о текущей категории пользователя
            if 'current_category' in user_info[sid]:
                logger.info(f"📂 [CATEGORY] Очищаем текущую категорию для отключившегося пользователя {sid}")
            del user_info[sid]
        
        # Удаляем состояние подключения
        if sid in connection_states:
            del connection_states[sid]
        
        # Удаляем маппинг userId -> sid
        if user_id and user_id_to_sid.get(user_id) == sid:
            del user_id_to_sid[user_id]
        
        # Очищаем данные о событиях активности
        if sid in last_activity_events:
            del last_activity_events[sid]
        
        if connected_clients:
            connected_clients.dec()
            logger.info(f"📊 Уменьшен счетчик подключенных клиентов")
        
        # Увеличиваем счетчик отключений
        if connection_errors:
            connection_errors.labels(error_type="disconnect").inc()
            logger.info(f"📊 Увеличен счетчик отключений")
            
        logger.info(f"✅ [CONNECTION] Полная очистка данных для отключенного клиента {sid}")
            
    except Exception as e:
        logger.error(f"❌ [CONNECTION] Ошибка в обработчике отключения для {sid}: {e}")
        logger.exception("Полный стек ошибки:")

async def start_ping(sid):
    """Запускает периодическую отправку пингов клиенту с улучшенным отслеживанием состояния"""
    try:
        consecutive_timeouts = 0
        max_consecutive_timeouts = 3  # Максимальное количество последовательных таймаутов
        
        while sid in user_info and user_info[sid].get('connection_state') != CONNECTION_STATES['DISCONNECTED']:
            await asyncio.sleep(PING_INTERVAL)
            
            # Проверяем, что пользователь все еще подключен
            if sid not in user_info:
                logger.info(f"🔍 [PING] Пользователь {sid} больше не в user_info, прекращаем пинг")
                break
                
            # Проверяем состояние подключения
            if user_info[sid].get('connection_state') == CONNECTION_STATES['DISCONNECTED']:
                logger.info(f"🔍 [PING] Пользователь {sid} отключен, прекращаем пинг")
                break
                
            logger.debug(f"📤 [PING] Отправка пинга клиенту {sid}")
            
            # Обновляем статистику пингов
            if sid in user_info:
                user_info[sid]['ping_count'] += 1
                user_info[sid]['last_ping_time'] = time.time()
            
            pong_waiting[sid] = True
            
            try:
                ping_data = {
                    'timestamp': str(time.time()),
                    'ping_id': user_info[sid].get('ping_count', 0)
                }
                await sio.emit('ping', ping_data, room=sid)
                
                # Ждем PING_TIMEOUT секунд ответа
                await asyncio.sleep(PING_TIMEOUT)
                
                # Проверяем, получили ли мы понг
                if sid in pong_waiting and pong_waiting[sid]:
                    consecutive_timeouts += 1
                    logger.warning(f"⚠️ [PING] Таймаут пинга для клиента {sid} (попытка {consecutive_timeouts}/{max_consecutive_timeouts})")
                    
                    # Обновляем статистику пропущенных понгов
                    if sid in user_info:
                        user_info[sid]['missed_pongs'] += 1
                    
                    # Обновляем состояние подключения
                    if sid in connection_states:
                        connection_states[sid]['state'] = CONNECTION_STATES['AWAY']
                        connection_states[sid]['last_activity'] = time.time()
                    
                    if sid in user_info:
                        user_info[sid]['connection_state'] = CONNECTION_STATES['AWAY']
                        
                        # Уведомляем всех в комнатах пользователя о том, что он "away"
                        for room in user_rooms.get(sid, set()):
                            away_event = {
                                'sid': sid,
                                'user_id': user_info[sid].get('user_id'),
                                'user_info': user_info[sid].get('user_info', {}),
                                'timestamp': str(time.time()),
                                'consecutive_timeouts': consecutive_timeouts,
                                'room': room  # Добавляем информацию о комнате
                            }
                            await sio.emit('user_away', away_event, room=room)
                            logger.info(f"📢 [PING] Отправлено уведомление user_away в комнату {room}")
                    
                    # Если слишком много последовательных таймаутов, считаем соединение потерянным
                    if consecutive_timeouts >= max_consecutive_timeouts:
                        logger.error(f"🚨 [PING] Слишком много таймаутов для клиента {sid}, считаем соединение потерянным")
                        
                        if sid in connection_states:
                            connection_states[sid]['state'] = CONNECTION_STATES['TIMEOUT']
                        
                        if sid in user_info:
                            user_info[sid]['connection_state'] = CONNECTION_STATES['TIMEOUT']
                        
                        # Принудительно отключаем клиента
                        await sio.disconnect(sid)
                        break
                else:
                    # Понг получен, сбрасываем счетчик таймаутов
                    consecutive_timeouts = 0
                    
                    # Обновляем состояние подключения
                    if sid in connection_states:
                        connection_states[sid]['state'] = CONNECTION_STATES['ACTIVE']
                        connection_states[sid]['last_activity'] = time.time()
                    
                    if sid in user_info:
                        user_info[sid]['connection_state'] = CONNECTION_STATES['ACTIVE']
                    
                    logger.debug(f"✅ [PING] Понг получен от клиента {sid}")
                    
            except Exception as e:
                logger.error(f"❌ [PING] Ошибка отправки пинга клиенту {sid}: {e}")
                consecutive_timeouts += 1
                
    except Exception as e:
        logger.error(f"❌ [PING] Ошибка в цикле пинга для {sid}: {e}")
        logger.exception("Полный стек ошибки:")
    finally:
        if sid in ping_timers:
            del ping_timers[sid]
        logger.info(f"🏁 [PING] Завершен цикл пинга для клиента {sid}")

@sio.event
async def pong(sid, data):
    """Обработчик получения понга от клиента с улучшенным отслеживанием состояния"""
    try:
        logger.debug(f"📥 [PONG] Получен понг от клиента {sid}")
        
        # Сбрасываем ожидание понга
        if sid in pong_waiting:
            pong_waiting[sid] = False
            
        # Обновляем информацию о пользователе
        if sid in user_info:
            current_time = time.time()
            user_info[sid]['last_activity'] = current_time
            user_info[sid]['last_pong_time'] = current_time
            
            # Вычисляем время отклика (если есть данные о пинге)
            if data and isinstance(data, dict) and 'ping_timestamp' in data:
                ping_time = float(data['ping_timestamp'])
                response_time = current_time - ping_time
                logger.debug(f"⏱️ [PONG] Время отклика для {sid}: {response_time:.3f}с")
                
                # Обновляем качество соединения
                if sid in connection_states:
                    if response_time < 0.1:
                        connection_states[sid]['connection_quality'] = 'excellent'
                    elif response_time < 0.5:
                        connection_states[sid]['connection_quality'] = 'good'
                    elif response_time < 1.0:
                        connection_states[sid]['connection_quality'] = 'fair'
                    else:
                        connection_states[sid]['connection_quality'] = 'poor'
            
            # Проверяем, был ли пользователь в состоянии "away" и вернулся
            previous_state = user_info[sid].get('connection_state')
            if previous_state == CONNECTION_STATES['AWAY']:
                logger.info(f"🔄 [PONG] Пользователь {sid} вернулся из состояния 'away'")
                
                # Обновляем состояние подключения
                user_info[sid]['connection_state'] = CONNECTION_STATES['ACTIVE']
                
                if sid in connection_states:
                    connection_states[sid]['state'] = CONNECTION_STATES['ACTIVE']
                    connection_states[sid]['last_activity'] = current_time
                
                # Уведомляем всех в комнатах пользователя о возвращении
                for room in user_rooms.get(sid, set()):
                    back_event = {
                        'sid': sid,
                        'user_id': user_info[sid].get('user_id'),
                        'user_info': user_info[sid].get('user_info', {}),
                        'timestamp': str(current_time),
                        'previous_state': previous_state,
                        'connection_quality': connection_states.get(sid, {}).get('connection_quality', 'unknown'),
                        'room': room  # Добавляем информацию о комнате
                    }
                    await sio.emit('user_back', back_event, room=room)
                    logger.info(f"📢 [PONG] Отправлено уведомление user_back в комнату {room}")
            
            # Логируем статистику соединения
            ping_count = user_info[sid].get('ping_count', 0)
            missed_pongs = user_info[sid].get('missed_pongs', 0)
            if ping_count > 0:
                success_rate = ((ping_count - missed_pongs) / ping_count) * 100
                logger.debug(f"📊 [PONG] Статистика соединения для {sid}: {success_rate:.1f}% успешных пингов")
        
    except Exception as e:
        logger.error(f"❌ [PONG] Ошибка обработки понга от {sid}: {e}")
        logger.exception("Полный стек ошибки:")

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
            return {'error': error_msg['error']}

        # Проверяем, не находится ли пользователь уже в комнате
        if sid in user_rooms and room in user_rooms[sid]:
            logger.info(f"ℹ️ Пользователь {sid} уже находится в комнате {room}")
            return {'status': 'already_joined', 'room': room}

        # Добавляем пользователя в комнату
        try:
            await sio.enter_room(sid, room)
            logger.info(f"✅ Пользователь {sid} добавлен в комнату {room}")
            
            # Обновляем информацию о пользователе и комнатах
            if sid not in user_rooms:
                user_rooms[sid] = set()
            user_rooms[sid].add(room)
            
            # Обновляем метрику активных комнат
            if active_rooms:
                active_rooms.set(len(room_users))
            
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
                'timestamp': str(time.time())  # Используем реальный Unix timestamp
            }
            
            # 🚨 НОВЫЕ СОБЫТИЯ ДЛЯ АКТИВНЫХ ПОЛЬЗОВАТЕЛЕЙ:
            
            # Отправляем старое событие (сохраняем совместимость)
            await sio.emit('user_joined', response, room=room, skip_sid=sid) 
            logger.info(f"📢 Отправлено уведомление о присоединении пользователя {sid} к комнате {room}")
            
            # НОВОЕ: Отправляем событие user_joined_room для компонента ActiveUsersPanel
            user_joined_event = {
                'room': room,
                'userId': user_info_data.get('userId') or user_info_data.get('user_id') or sid,
                'first_name': user_info_data.get('first_name', 'Пользователь'),
                'last_name': user_info_data.get('last_name'),
                'photo_url': user_info_data.get('photo_url'),
                'joinedAt': response['timestamp']
            }
            await sio.emit('user_joined_room', user_joined_event, room=room)
            logger.info(f"👤 [ACTIVE USERS] Отправлено событие user_joined_room: {user_joined_event}")
            
            # Формируем список пользователей для отправки присоединившемуся
            current_room_sids = room_users.get(room, set()) # Получаем SIDы из room_users
            current_room_users_details = []
            for user_sid in current_room_sids:
                user_details = user_info.get(user_sid, {}).get('user_info', {})
                current_room_users_details.append({ # Собираем детали пользователей
                    'sid': user_sid,
                    'user_info': user_details
                })

            # Отправляем старое событие (сохраняем совместимость)
            await sio.emit('room_users', {'room': room, 'users': current_room_users_details}, room=sid) # Используем собранный список
            logger.info(f"📨 Отправлен список пользователей комнаты {room} клиенту {sid}")
            
            # НОВОЕ: Формируем детальный список для ActiveUsersPanel
            room_users_for_panel = []
            for user_sid in current_room_sids:
                user_data = user_info.get(user_sid, {}).get('user_info', {})
                # 🔧 НОВОЕ: Добавляем информацию о текущей категории пользователя
                current_category = user_info.get(user_sid, {}).get('current_category')
                
                room_users_for_panel.append({
                    'userId': user_data.get('userId') or user_data.get('user_id') or user_sid,
                    'first_name': user_data.get('first_name', 'Пользователь'),
                    'last_name': user_data.get('last_name'),
                    'photo_url': user_data.get('photo_url'),
                    'joinedAt': user_info.get(user_sid, {}).get('connection_time', response['timestamp']),
                    'current_category': current_category  # 🔧 НОВОЕ: Текущая категория пользователя
                })
            
            # Отправляем список всем в комнате (включая нового пользователя)
            room_users_event = {
                'room': room,
                'users': room_users_for_panel
            }
            await sio.emit('room_users_list', room_users_event, room=room)
            logger.info(f"👥 [ACTIVE USERS] Отправлен список пользователей комнаты {room}: {len(room_users_for_panel)} пользователей")

            # Автоматически подключаем к персональной комнате для уведомлений о правах
            user_id = user_info_data.get('user_id') or user_info_data.get('userId')  # Поддерживаем оба формата
            if user_id and '_' in room:  # Если это комната группы (содержит _)
                try:
                    # Извлекаем group_id из названия комнаты
                    group_id = room.split('_')[-1]  # Берем последнюю часть после _
                    personal_room = f"user_{user_id}_group_{group_id}"
                    
                    logger.info(f"🔄 Попытка подключения к персональной комнате {personal_room} для пользователя {sid}")
                    
                    # Подключаем к персональной комнате
                    await sio.enter_room(sid, personal_room)
                    logger.info(f"✅ Пользователь {sid} автоматически подключен к персональной комнате {personal_room}")
                    
                    # Добавляем в user_rooms
                    if personal_room not in user_rooms[sid]:
                        user_rooms[sid].add(personal_room)
                        
                    # Добавляем в room_users
                    if personal_room not in room_users:
                        room_users[personal_room] = set()
                    room_users[personal_room].add(sid)
                    
                    logger.info(f"📝 Пользователь {sid} теперь в комнатах: {user_rooms[sid]}")
                    
                except Exception as personal_room_err:
                    logger.error(f"❌ Ошибка при подключении к персональной комнате: {personal_room_err}")
            else:
                logger.info(f"🔍 Автоматическое подключение к персональной комнате пропущено: user_id={user_id}, room={room}")

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
        
        # Уведомляем остальных в комнате (старое событие для совместимости)
        response = {
            'status': 'success',
            'room': room,
            'timestamp': datetime.now().isoformat()
        }
        await sio.emit('room_left', response, room=room, skip_sid=sid)
        logger.info(f"📢 Отправлено уведомление всем в комнате {room} о выходе {sid}")
        
        # 🚨 НОВОЕ: Отправляем событие user_left_room для компонента ActiveUsersPanel
        user_data = user_info.get(sid, {}).get('user_info', {})
        user_left_event = {
            'room': room,
            'userId': user_data.get('userId') or user_data.get('user_id') or sid,
            'first_name': user_data.get('first_name', 'Пользователь'),
            'last_name': user_data.get('last_name'),
            'leftAt': datetime.now().isoformat()
        }
        await sio.emit('user_left_room', user_left_event, room=room)
        logger.info(f"👤 [ACTIVE USERS] Отправлено событие user_left_room: {user_left_event}")
        
        # Также отправляем обновленный список пользователей в комнате
        server_rooms = sio.manager.rooms.get('/', {})
        room_sids = server_rooms.get(room, set())
        room_users_for_panel = []
        
        for user_sid in room_sids:
            if user_sid in user_info and user_info[user_sid].get('user_info'):
                user_data_item = user_info[user_sid].get('user_info', {})
                # 🔧 НОВОЕ: Добавляем информацию о текущей категории пользователя
                current_category = user_info.get(user_sid, {}).get('current_category')
                
                room_users_for_panel.append({
                    'userId': user_data_item.get('userId') or user_data_item.get('user_id') or user_sid,
                    'first_name': user_data_item.get('first_name', 'Пользователь'),
                    'last_name': user_data_item.get('last_name'),
                    'joinedAt': user_info[user_sid].get('connection_time', datetime.now().isoformat()),
                    'current_category': current_category  # 🔧 НОВОЕ: Текущая категория пользователя
                })
        
        room_users_event = {
            'room': room,
            'users': room_users_for_panel
        }
        await sio.emit('room_users_list', room_users_event, room=room)
        logger.info(f"👥 [ACTIVE USERS] Отправлен обновленный список пользователей комнаты {room}: {len(room_users_for_panel)} пользователей")
        
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

async def redis_message_handler(message):
    """Обработчик сообщений из Redis для broadcasting между воркерами"""
    start_time = time.time()
    try:
        logger.info(f"🔄 Получено Redis сообщение для broadcasting: {message}")
        
        # Определяем тип сообщения
        message_type = message.get('type')
        target_room = message.get('room')
        target_user = message.get('user_id')
        
        if message_type == 'broadcast_to_room' and target_room:
            # Отправляем всем пользователям в комнате на этом воркере
            await sio.emit('notification', message.get('data', {}), room=target_room)
            logger.info(f"📡 Отправлено уведомление в комнату {target_room}")
            
            # Увеличиваем счетчик отправленных сообщений
            if messages_sent:
                messages_sent.labels(room=target_room).inc()
            
        elif message_type == 'broadcast_to_user' and target_user:
            # Находим SID пользователя на этом воркере
            user_sid = None
            for sid, info in user_info.items():
                if info.get('user_id') == target_user:
                    user_sid = sid
                    break
            
            if user_sid:
                await sio.emit('notification', message.get('data', {}), room=user_sid)
                logger.info(f"📡 Отправлено уведомление пользователю {target_user}")
            else:
                logger.info(f"👤 Пользователь {target_user} не найден на этом воркере")
                
        elif message_type == 'broadcast_all':
            # Отправляем всем подключенным клиентам на этом воркере
            await sio.emit('notification', message.get('data', {}))
            logger.info(f"📡 Отправлено глобальное уведомление")
            
        # Записываем время обработки сообщения
        processing_time = time.time() - start_time
        if message_processing_time:
            message_processing_time.labels(message_type=message_type or "unknown").observe(processing_time)
            
    except Exception as e:
        logger.error(f"❌ Ошибка обработки Redis сообщения: {e}", exc_info=True)
        
        # Записываем время обработки даже при ошибке
        processing_time = time.time() - start_time
        if message_processing_time:
            message_processing_time.labels(message_type="error").observe(processing_time)

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
                    return 
                
                
                if not isinstance(shift_data, dict):
                    logger.error(f"❌ Данные смены ('shift_data') в уведомлении не являются словарем: {type(shift_data)}")
                    return

                logger.info(f"✅ Получены полные данные смены ID: {shift_data.get('id')} из уведомления PostgreSQL.")

                
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
        
        elif event_type == 'reserve_update': 
             if courier_room:
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

        # --- ДОБАВЛЯЕМ ОБРАБОТКУ ИЗМЕНЕНИЯ ПРАВ ПОЛЬЗОВАТЕЛЯ ---
        elif event_type == 'user_permissions_changed':
            user_id = data.get('user_id')
            group_id = data.get('group_id')
            notification_type = data.get('notification_type')
            
            if user_id and group_id:
                # Отправляем уведомление конкретному пользователю в конкретной группе
                user_room = f"user_{user_id}_group_{group_id}"
                await sio.emit('permissions_changed', data, room=user_room)
                logger.info(f"📝 Отправлено уведомление об изменении прав пользователю {user_id} в группе {group_id}: {notification_type}")
            else:
                logger.warning(f"⚠️ Не найдены user_id или group_id в уведомлении user_permissions_changed: {data}")

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
        # Подключаемся к Redis
        await redis_manager.connect()
        
        # Запускаем слушатель PostgreSQL уведомлений
        logger.info("Starting PostgreSQL notification listener task (websocket_channel only)...")
        await subscribe_to_events(notification_handler)
        
        # Запускаем слушатель Redis broadcasting
        logger.info("Starting Redis broadcasting listener...")
        await redis_manager.subscribe_to_channel('websocket_broadcast', redis_message_handler)
        
        logger.info("Notification listeners finished (should not happen normally)")
    except Exception as e:
        logger.error(f"Error starting notification listeners: {e}")
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
                    'connection_time': user_info[user_sid].get('connection_time'),
                    'current_category': user_info[user_sid].get('current_category')  # 🔧 НОВОЕ: Текущая категория пользователя
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
            api_url = os.getenv('API_SERVICE_URL', 'http://server:8000') + '/api/v1/shifts' # Placeholder URL
            shift_id = data.get('id') 
            api_url_update = f"{os.getenv('API_SERVICE_URL', 'http://server:8000')}/api/v1/shifts/{shift_id}" if shift_id else None
            if not api_url_update:
                 logger.error(f"❌ Не найден ID смены для обновления в данных: {data}")
                 return None
                 
            async with session.put(api_url_update, json=data) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"✅ Смена успешно обновлена API: {result}")
                    
                    chat_id = data.get('chat_id')
                    if chat_id:
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

async def check_connection_health():
    """Периодическая проверка состояния всех подключений"""
    try:
        while True:
            await asyncio.sleep(60)  # Проверяем каждую минуту
            
            current_time = time.time()
            active_connections = 0
            away_connections = 0
            timeout_connections = 0
            
            for sid, user_data in user_info.items():
                connection_state = user_data.get('connection_state', 'unknown')
                last_activity = user_data.get('last_activity', 0)
                
                if connection_state == CONNECTION_STATES['ACTIVE']:
                    active_connections += 1
                elif connection_state == CONNECTION_STATES['AWAY']:
                    away_connections += 1
                elif connection_state == CONNECTION_STATES['TIMEOUT']:
                    timeout_connections += 1
                
                # Проверяем, не нужно ли обновить состояние
                if connection_state == CONNECTION_STATES['AWAY']:
                    time_since_activity = current_time - last_activity
                    if time_since_activity > CONNECTION_TIMEOUT:
                        logger.warning(f"⚠️ [HEALTH] Пользователь {sid} переведен в состояние timeout (неактивен {time_since_activity:.1f}с)")
                        user_data['connection_state'] = CONNECTION_STATES['TIMEOUT']
                        if sid in connection_states:
                            connection_states[sid]['state'] = CONNECTION_STATES['TIMEOUT']
            
            logger.info(f"📊 [HEALTH] Статистика подключений: активных={active_connections}, away={away_connections}, timeout={timeout_connections}")
            
    except Exception as e:
        logger.error(f"❌ [HEALTH] Ошибка в проверке состояния подключений: {e}")
        logger.exception("Полный стек ошибки:")

# Запускаем фоновую задачу прослушивания уведомлений при старте
@sio.event
async def startup():
    logger.info("🚀 WebSocket Server Startup Event")
    # Запускаем слушатель уведомлений
    asyncio.create_task(start_notification_listener())
    logger.info("✅ Notification listener task created")
    
    # Запускаем проверку состояния подключений
    asyncio.create_task(check_connection_health())
    logger.info("✅ Connection health check task created")

# Регистрируем обработчики явно
logger.info("🔄 Начинаем регистрацию обработчиков Socket.IO")

# Проверяем регистрацию обработчиков
handlers = [handler for handler in sio.handlers['/'].keys() if not handler.startswith('_')]
logger.info("=" * 80)
logger.info("🔍 Проверка регистрации обработчиков:")
logger.info(f"📋 Зарегистрированные обработчики: {handlers}")
logger.info(f"🎯 join_room обработчик: {'join_room' in handlers}")
logger.info("=" * 80)

@sio.event
async def get_room_users(sid, data):
    """Обработчик получения списка пользователей комнаты для ActiveUsersPanel"""
    try:
        if not isinstance(data, dict) or 'room' not in data:
            logger.error(f"❌ [ACTIVE USERS] Неверный формат запроса: {data}")
            return {'error': 'Invalid request format'}

        room = data['room']
        logger.info(f"🎯 [ACTIVE USERS] Получено событие: get_room_users от {sid}")
        logger.info(f"📦 [ACTIVE USERS] Запрошена комната: {room}")

        # Получаем все сиды в комнате напрямую из словаря комнат сервера
        server_rooms = sio.manager.rooms.get('/', {})
        room_sids = server_rooms.get(room, set())
        logger.info(f"📊 [ACTIVE USERS] Найдены SID в комнате {room}: {room_sids}")

        # Формируем список пользователей для ActiveUsersPanel с информацией о состоянии подключения
        room_users_for_panel = []
        for user_sid in room_sids:
            if user_sid in user_info and user_info[user_sid].get('user_info'):
                user_data = user_info[user_sid].get('user_info', {})
                
                # Получаем информацию о состоянии подключения
                connection_state = user_info[user_sid].get('connection_state', 'unknown')
                connection_quality = connection_states.get(user_sid, {}).get('connection_quality', 'unknown')
                last_activity = user_info[user_sid].get('last_activity', 0)
                
                # Получаем информацию об активности пользователя
                user_activity_state = user_info[user_sid].get('user_activity_state', USER_ACTIVITY_STATES['ACTIVE'])
                last_user_activity = user_info[user_sid].get('last_user_activity', 0)
                
                # 🔧 НОВОЕ: Добавляем информацию о текущей категории пользователя
                current_category = user_info[user_sid].get('current_category')
                
                room_users_for_panel.append({
                    'userId': user_data.get('userId') or user_data.get('user_id') or user_sid,
                    'first_name': user_data.get('first_name', 'Пользователь'),
                    'last_name': user_data.get('last_name'),
                    'photo_url': user_data.get('photo_url'),
                    'joinedAt': user_info[user_sid].get('connection_time', str(time.time())),
                    'connection_state': connection_state,
                    'connection_quality': connection_quality,
                    'last_activity': last_activity,
                    'user_activity_state': user_activity_state,
                    'last_user_activity': last_user_activity,
                    'is_active': connection_state == CONNECTION_STATES['ACTIVE'] and user_activity_state == USER_ACTIVITY_STATES['ACTIVE'],
                    'current_category': current_category  # 🔧 НОВОЕ: Текущая категория пользователя
                })
                logger.info(f"✅ [ACTIVE USERS] Добавлен пользователь: {user_data.get('first_name', 'Пользователь')} (состояние: {connection_state}, категория: {current_category})")

        response = {
            'room': room,
            'users': room_users_for_panel
        }

        logger.info(f"📤 [ACTIVE USERS] Подготовлен ответ: {len(room_users_for_panel)} пользователей в комнате {room}")

        # Отправляем ответ только запросившему клиенту
        await sio.emit('room_users_list', response, room=sid)
        logger.info(f"📨 [ACTIVE USERS] Отправлен список пользователей для комнаты {room}")
        
        return response

    except Exception as e:
        error_msg = f"Error getting room users: {str(e)}"
        logger.error(f"❌ [ACTIVE USERS] {error_msg}")
        logger.exception("Полный стек ошибки:")
        return {'error': error_msg}

@sio.event
async def get_connection_status(sid, data):
    """Обработчик запроса информации о состоянии подключения"""
    try:
        logger.info(f"🔍 [CONNECTION] Запрос состояния подключения от {sid}")
        
        if sid not in user_info:
            return {'error': 'User not found'}
        
        user_data = user_info[sid]
        conn_state = connection_states.get(sid, {})
        
        # Вычисляем время подключения
        connected_at = conn_state.get('connected_at', 0)
        connection_duration = time.time() - connected_at if connected_at > 0 else 0
        
        # Вычисляем статистику пингов
        ping_count = user_data.get('ping_count', 0)
        missed_pongs = user_data.get('missed_pongs', 0)
        success_rate = ((ping_count - missed_pongs) / ping_count * 100) if ping_count > 0 else 100
        
        status_info = {
            'sid': sid,
            'user_id': user_data.get('user_id'),
            'connection_state': user_data.get('connection_state', 'unknown'),
            'connection_quality': conn_state.get('connection_quality', 'unknown'),
            'connection_duration': connection_duration,
            'last_activity': user_data.get('last_activity', 0),
            'last_ping_time': user_data.get('last_ping_time'),
            'last_pong_time': user_data.get('last_pong_time'),
            'user_activity_state': user_data.get('user_activity_state', USER_ACTIVITY_STATES['ACTIVE']),
            'last_user_activity': user_data.get('last_user_activity', 0),
            'ping_statistics': {
                'total_pings': ping_count,
                'missed_pongs': missed_pongs,
                'success_rate': success_rate
            },
            'rooms': list(user_rooms.get(sid, set())),
            'timestamp': str(time.time())
        }
        
        logger.info(f"📊 [CONNECTION] Отправлена информация о состоянии подключения для {sid}: {status_info['connection_state']}")
        await sio.emit('connection_status', status_info, room=sid)
        
        return status_info
        
    except Exception as e:
        logger.error(f"❌ [CONNECTION] Ошибка получения состояния подключения для {sid}: {e}")
        logger.exception("Полный стек ошибки:")
        return {'error': str(e)}

@sio.event
async def user_activity(sid, data):
    """Обработчик события активности пользователя"""
    try:
        logger.info(f"👤 [ACTIVITY] Пользователь {sid} активен: {data}")
        
        if sid in user_info:
            current_time = time.time()
            previous_state = user_info[sid].get('user_activity_state', USER_ACTIVITY_STATES['INACTIVE'])
            
            # Проверяем минимальный интервал между событиями (1 секунда)
            last_event_time = last_activity_events.get(sid, 0)
            if current_time - last_event_time < 1.0:
                logger.debug(f"👤 [ACTIVITY] Слишком частое событие активности для {sid}, пропускаем")
                return
            
            # Проверяем, изменилось ли состояние
            if previous_state != USER_ACTIVITY_STATES['ACTIVE']:
                user_info[sid]['user_activity_state'] = USER_ACTIVITY_STATES['ACTIVE']
                user_info[sid]['last_user_activity'] = current_time
                
                # Обновляем время последнего события
                last_activity_events[sid] = current_time
                
                # Уведомляем всех в комнатах пользователя о том, что он активен
                for room in user_rooms.get(sid, set()):
                    activity_event = {
                        'sid': sid,
                        'user_id': user_info[sid].get('user_id'),
                        'user_info': user_info[sid].get('user_info', {}),
                        'timestamp': str(current_time),
                        'activity_state': USER_ACTIVITY_STATES['ACTIVE'],
                        'room': room  # Добавляем информацию о комнате
                    }
                    await sio.emit('user_activity_update', activity_event, room=room)
                    logger.info(f"📢 [ACTIVITY] Отправлено уведомление user_activity_update в комнату {room}")
            else:
                # Просто обновляем время последней активности без отправки события
                user_info[sid]['last_user_activity'] = current_time
                logger.debug(f"👤 [ACTIVITY] Пользователь {sid} уже активен, обновляем только время активности")
        
    except Exception as e:
        logger.error(f"❌ [ACTIVITY] Ошибка обработки события активности для {sid}: {e}")
        logger.exception("Полный стек ошибки:")

@sio.event
async def user_inactive(sid, data):
    """Обработчик события неактивности пользователя"""
    try:
        logger.info(f"😴 [ACTIVITY] Пользователь {sid} неактивен: {data}")
        
        if sid in user_info:
            current_time = time.time()
            previous_state = user_info[sid].get('user_activity_state', USER_ACTIVITY_STATES['ACTIVE'])
            
            # Проверяем минимальный интервал между событиями (1 секунда)
            last_event_time = last_activity_events.get(sid, 0)
            if current_time - last_event_time < 1.0:
                logger.debug(f"😴 [ACTIVITY] Слишком частое событие неактивности для {sid}, пропускаем")
                return
            
            # Проверяем, изменилось ли состояние
            if previous_state != USER_ACTIVITY_STATES['INACTIVE']:
                user_info[sid]['user_activity_state'] = USER_ACTIVITY_STATES['INACTIVE']
                user_info[sid]['last_user_activity'] = current_time
                
                # Обновляем время последнего события
                last_activity_events[sid] = current_time
                
                # Уведомляем всех в комнатах пользователя о том, что он неактивен
                for room in user_rooms.get(sid, set()):
                    inactive_event = {
                        'sid': sid,
                        'user_id': user_info[sid].get('user_id'),
                        'user_info': user_info[sid].get('user_info', {}),
                        'timestamp': str(current_time),
                        'activity_state': USER_ACTIVITY_STATES['INACTIVE'],
                        'room': room  # Добавляем информацию о комнате
                    }
                    await sio.emit('user_activity_update', inactive_event, room=room)
                    logger.info(f"📢 [ACTIVITY] Отправлено уведомление user_activity_update в комнату {room}")
            else:
                # Просто обновляем время последней активности без отправки события
                user_info[sid]['last_user_activity'] = current_time
                logger.debug(f"😴 [ACTIVITY] Пользователь {sid} уже неактивен, обновляем только время активности")
        
    except Exception as e:
        logger.error(f"❌ [ACTIVITY] Ошибка обработки события неактивности для {sid}: {e}")
        logger.exception("Полный стек ошибки:")

@sio.on('item_editing')
async def handle_item_editing(sid, data):
    """Броадкаст статуса редактирования товара внутри комнат инвентаря.
    data: { chat_id: str, category: str, item_id: str, editing: bool, user_info?: any }
    """
    try:
        chat_id = str(data.get('chat_id'))
        category = data.get('category')
        item_id = data.get('item_id')
        is_editing = bool(data.get('editing'))
        room = f"inventory_{chat_id}"
        event = {
            'chat_id': chat_id,
            'category': category,
            'item_id': item_id,
            'editing': is_editing,
            'sid': sid,
            'user_info': user_info.get(sid, {}).get('user_info', {}),
            'timestamp': str(time.time())
        }
        await sio.emit('item_editing_update', event, room=room, skip_sid=None)
        logger.info(f"✏️ [EDIT] item_editing_update -> {room} {category}/{item_id} editing={is_editing}")
    except Exception as e:
        logger.error(f"❌ [EDIT] Ошибка обработки item_editing: {e}")

# --- Category focus indicator ---
@sio.on('category_focus')
async def handle_category_focus(sid, data):
    """Броадкаст статуса работы в категории.
    data: { chat_id: str, category: str, focusing: bool, user_info?: any }
    """
    try:
        chat_id = str(data.get('chat_id'))
        category = data.get('category')
        focusing = bool(data.get('focusing'))
        room = f"inventory_{chat_id}"
        
        # 🔧 НОВОЕ: Сохраняем информацию о текущей категории пользователя
        if sid in user_info:
            if focusing:
                # Пользователь вошел в категорию
                user_info[sid]['current_category'] = category
                logger.info(f"📂 [CATEGORY] Пользователь {sid} вошел в категорию: {category}")
            else:
                # Пользователь вышел из категории
                if 'current_category' in user_info[sid]:
                    previous_category = user_info[sid]['current_category']
                    del user_info[sid]['current_category']
                    logger.info(f"📂 [CATEGORY] Пользователь {sid} вышел из категории: {previous_category}")
                    
                    # 🔍 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Проверяем, сколько пользователей осталось в этой категории
                    users_in_category = 0
                    for user_sid, user_data in user_info.items():
                        if user_data.get('current_category') == previous_category:
                            users_in_category += 1
                    
                    logger.info(f"📂 [CATEGORY] В категории {previous_category} осталось пользователей: {users_in_category}")
                else:
                    logger.info(f"📂 [CATEGORY] Пользователь {sid} вышел из категории: {category} (не было сохранено)")
        
        event = {
            'chat_id': chat_id,
            'category': category,
            'focusing': focusing,
            'sid': sid,
            'user_info': user_info.get(sid, {}).get('user_info', {}),
            'timestamp': str(time.time())
        }
        await sio.emit('category_focus_update', event, room=room, skip_sid=None)
        logger.info(f"📂 [CATEGORY] category_focus_update -> {room} {category} focusing={focusing}")
    except Exception as e:
        logger.error(f"❌ [CATEGORY] Ошибка обработки category_focus: {e}")

logger.info("✅ Все обработчики событий успешно зарегистрированы")


if __name__ == '__main__':
    pass 