"""
Обслуживание комнат и активных пользователей в Socket.IO
"""
from datetime import datetime, timedelta
from flask import request
from flask_socketio import emit, join_room, leave_room
import json
import traceback

from config import logger

# Константы для комнат
GLOBAL_ROOM = 'inventory_global'  # Общая комната для всех чатов
CHAT_ROOM_PREFIX = 'inventory_'   # Префикс для комнат конкретных чатов
SHIFTS_ROOM_PREFIX = 'shifts_'    # Префикс для комнат смен конкретных чатов
RESERVES_ROOM_PREFIX = 'reserves_'  # Префикс для комнат резервов конкретных чатов
COURIER_ROOM_PREFIX = 'courier_'  # Префикс для общих комнат курьеров конкретного чата

# Словарь для хранения активных пользователей по комнатам
active_users = {}

def get_room_name(chat_id):
    """
    Возвращает имя комнаты для указанного chat_id
    
    Args:
        chat_id (str): ID чата или 'global' для глобальной комнаты
        
    Returns:
        str: Имя комнаты
    """
    if chat_id == 'global':
        return GLOBAL_ROOM
    elif chat_id.startswith('shifts_'):
        return f'{SHIFTS_ROOM_PREFIX}{chat_id[7:]}'
    elif chat_id.startswith('reserves_'):
        return f'{RESERVES_ROOM_PREFIX}{chat_id[9:]}'
    elif chat_id.startswith('courier_'):
        return f'{COURIER_ROOM_PREFIX}{chat_id[8:]}'
    else:
        return f'{CHAT_ROOM_PREFIX}{chat_id}'

def get_courier_room_name(chat_id):
    """
    Возвращает имя общей комнаты курьеров для указанного chat_id
    
    Args:
        chat_id (str): ID чата
        
    Returns:
        str: Имя комнаты курьеров
    """
    # Убираем префикс courier_ если он есть
    if chat_id.startswith('courier_'):
        chat_id = chat_id[8:]
    return f'{COURIER_ROOM_PREFIX}{chat_id}'

def get_user_rooms(user_id):
    """
    Возвращает список комнат, в которых находится пользователь
    
    Args:
        user_id (str): ID пользователя
        
    Returns:
        list: Список комнат, в которых находится пользователь
    """
    user_rooms = []
    for room_name, users in active_users.items():
        if user_id in users:
            user_rooms.append(room_name)
    
    logger.info(f'🔍 Комнаты пользователя {user_id}: {user_rooms}')
    return user_rooms

def join_user_to_room(chat_id: str, user_id: str = None, user_info: dict = None, force_rejoin: bool = False) -> dict:
    """
    Добавляет пользователя в комнату
    """
    logger.info("===== НАЧАЛО join_user_to_room =====")
    logger.info("Входные параметры:")
    logger.info(f"chat_id: {chat_id}")
    logger.info(f"user_id: {user_id}")
    logger.info(f"user_info: {json.dumps(user_info, ensure_ascii=False)}")
    logger.info(f"force_rejoin: {force_rejoin}")

    # Определяем тип комнаты
    room_type = "courier" if chat_id.startswith("courier_") else "inventory"
    logger.info(f"Определен тип комнаты: {room_type} (без префикса)")

    # Получаем имя комнаты
    room = get_room_name(chat_id)
    logger.info(f"Имя комнаты: {room}")

    # Если user_id не передан, но есть в user_info
    if not user_id and user_info and user_info.get('id'):
        user_id = str(user_info['id'])
        logger.info(f"Использован user_id из user_info: {user_id}")

    # Проверяем существование комнаты
    if room not in active_users:
        active_users[room] = {}
        logger.info(f"Создана новая комната: {room}")

    # Проверяем наличие пользователя
    existing_user = None
    if user_id:
        existing_user = active_users[room].get(user_id)
    else:
        # Ищем по socket_id если нет user_id
        for user in active_users[room].values():
            if user.get('socket_id') == user_info.get('socket_id'):
                existing_user = user
                user_id = user.get('id')
                break

    if existing_user:
        logger.info(f"Пользователь {user_id} уже существует в комнате {room}")
        
        if force_rejoin:
            logger.info("force_rejoin=True, удаляем старую запись пользователя")
            if user_id:
                del active_users[room][user_id]
        else:
            logger.info("force_rejoin=False, обновляем информацию о пользователе")
            # Обновляем только timestamp и socket_id
            existing_user.update({
                'socket_id': user_info.get('socket_id'),
                'last_activity': datetime.now().isoformat()
            })
            logger.info(f"Обновленная информация о пользователе: {json.dumps(existing_user, ensure_ascii=False)}")
            return {
                'status': 'success',
                'active_users': list(active_users[room].values())
            }

    # Добавляем пользователя
    if user_id:
        logger.info(f"Добавляем пользователя {user_id} в комнату {room}")
        user_data = {
            'id': user_id,
            'socket_id': user_info.get('socket_id'),
            'last_activity': datetime.now().isoformat()
        }
        # Добавляем дополнительную информацию
        user_data.update({k: v for k, v in user_info.items() if k not in ['id', 'socket_id']})
        active_users[room][user_id] = user_data
        logger.info(f"Информация о пользователе после добавления: {json.dumps(user_data, ensure_ascii=False)}")

    # Удаляем дубликаты по socket_id
    socket_ids = set()
    users_to_remove = []
    for uid, user in active_users[room].items():
        if user['socket_id'] in socket_ids:
            users_to_remove.append(uid)
        else:
            socket_ids.add(user['socket_id'])
    
    for uid in users_to_remove:
        del active_users[room][uid]
        logger.info(f"Удален дубликат пользователя с ID {uid}")

    # Очищаем неактивные подключения
    current_time = datetime.now()
    timeout = timedelta(minutes=5)
    inactive_users = []
    
    for uid, user in list(active_users[room].items()):
        try:
            last_activity = datetime.fromisoformat(user['last_activity'])
            if current_time - last_activity > timeout:
                inactive_users.append(uid)
        except (ValueError, KeyError):
            inactive_users.append(uid)
    
    for uid in inactive_users:
        del active_users[room][uid]
        logger.info(f"Удален неактивный пользователь с ID {uid}")

    logger.info(f"Количество активных пользователей в комнате: {len(active_users[room])}")
    logger.info(f"Список активных пользователей: {json.dumps(list(active_users[room].values()), ensure_ascii=False)}")
    logger.info("===== КОНЕЦ join_user_to_room =====")

    return {
        'status': 'success',
        'active_users': list(active_users[room].values())
    }

def update_user_in_room(chat_id, user_id, user_info):
    """
    Обновляет информацию о пользователе в комнате без переподключения
    
    Args:
        chat_id (str): ID чата или 'global' для глобальной комнаты
        user_id (int): ID пользователя
        user_info (dict): Новая информация о пользователе
    
    Returns:
        dict: Информация о комнате и пользователях
    """
    room = get_room_name(chat_id)
    
    logger.info(f'🔄 Обновление данных о комнате {room} без переподключения')
    if room in active_users and user_id in active_users[room]:
        # Обновляем информацию о пользователе
        active_users[room][user_id].update(user_info)
        active_users[room][user_id]['last_activity'] = datetime.now().isoformat()
    
    # Отправляем подтверждение обновления
    emit('room_updated', {
        'status': 'ok',
        'chat_id': chat_id,
        'room': room,
        'active_users': list(active_users[room].values()) if room in active_users else [],
        'user_id': user_id
    })
    
    # Проверяем, если пользователь уже был в комнате с другим socket_id
    if room in active_users and user_id in active_users[room]:
        existing_socket_id = active_users[room][user_id].get('socket_id')
        if existing_socket_id and existing_socket_id != request.sid:
            # Обновляем socket_id
            logger.info(f'🔄 Обновление socket_id для пользователя {user_id} в комнате {room}')
            join_room(room)
    
    # Отправляем всем в комнате информацию об обновлении
    emit('room_info', {
        'chat_id': chat_id,
        'room': room,
        'active_users': list(active_users[room].values()) if room in active_users else []
    }, room=room)
    
    # Обновляем socket_id пользователя
    if room in active_users and user_id in active_users[room]:
        active_users[room][user_id]['socket_id'] = request.sid
    
    return {
        'room': room,
        'active_users': list(active_users[room].values()) if room in active_users else []
    }

def remove_user_from_room(chat_id, user_id):
    """
    Удаляет пользователя из комнаты
    
    Args:
        chat_id (str): ID чата или 'global' для глобальной комнаты
        user_id (int): ID пользователя
    """
    room = get_room_name(chat_id)
    
    if room in active_users and user_id in active_users[room]:
        user_info = active_users[room][user_id]
        # Удаляем пользователя из комнаты
        leave_room(room)
        del active_users[room][user_id]
        
        logger.info(f'👋 Пользователь {user_info.get("first_name")} покинул комнату {room}')
        
        # Отправляем уведомление всем в комнате
        emit('user_left', {
            'user_id': user_id,
            'active_users': list(active_users[room].values())
        }, room=room)
        
        # Если комната пуста, удаляем ее
        if not active_users[room]:
            del active_users[room]
            logger.info(f'🗑️ Комната {room} удалена')

def get_active_users_in_room(chat_id):
    """
    Возвращает список активных пользователей в комнате
    
    Args:
        chat_id (str): ID чата или 'global' для глобальной комнаты
        
    Returns:
        list: Список активных пользователей
    """
    room = get_room_name(chat_id)
    
    if room in active_users:
        return list(active_users[room].values())
    return []

def cleanup_inactive_users():
    """
    Очищает неактивных пользователей из всех комнат
    """
    # Получаем текущее время
    now = datetime.now()
    
    for room in list(active_users.keys()):  # Создаем копию ключей словаря
        for user_id, user_info in list(active_users[room].items()):
            # Проверяем время последней активности
            last_activity = datetime.fromisoformat(user_info['last_activity'])
            # Если прошло больше 30 минут, удаляем пользователя
            if (now - last_activity).total_seconds() > 1800:  # 30 минут
                del active_users[room][user_id]
                logger.info(f'⏰ Пользователь {user_info.get("first_name")} удален из комнаты {room} по таймауту')
                
                # Если комната пуста, удаляем ее
                if not active_users[room]:
                    del active_users[room]
                    logger.info(f'🗑️ Комната {room} удалена по таймауту') 