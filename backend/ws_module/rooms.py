"""
Обслуживание комнат и активных пользователей в Socket.IO
"""
from datetime import datetime
from flask import request
from flask_socketio import emit, join_room, leave_room

from config import logger

# Константы для комнат
GLOBAL_ROOM = 'inventory_global'  # Общая комната для всех чатов
CHAT_ROOM_PREFIX = 'inventory_'   # Префикс для комнат конкретных чатов

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
    return GLOBAL_ROOM if chat_id == 'global' else f'{CHAT_ROOM_PREFIX}{chat_id}'

def join_user_to_room(chat_id, user_id, user_info, force_rejoin=False):
    """
    Добавляет пользователя в комнату и обновляет список активных пользователей
    
    Args:
        chat_id (str): ID чата или 'global' для глобальной комнаты
        user_id (int): ID пользователя
        user_info (dict): Информация о пользователе
        force_rejoin (bool): Принудительное переподключение
        
    Returns:
        dict: Информация о комнате и пользователях
    """
    room = get_room_name(chat_id)
    
    if force_rejoin:
        logger.info(f'🔄 Принудительное переподключение пользователя к комнате {room}')
    
    # Обновляем информацию о пользователе, если он уже в комнате
    if room in active_users and user_id in active_users[room]:
        # Обновляем socket_id и last_activity
        active_users[room][user_id]['socket_id'] = request.sid
        active_users[room][user_id]['last_activity'] = datetime.now().isoformat()
    else:
        # Добавляем пользователя в комнату
        if room not in active_users:
            active_users[room] = {}
        
        # Сохраняем информацию о пользователе
        active_users[room][user_id] = {
            **user_info,
            'id': user_id,
            'socket_id': request.sid,
            'last_activity': datetime.now().isoformat()
        }
        
        # Присоединяем к комнате Socket.IO
        join_room(room)
        
        # Отправляем уведомление всем в комнате
        emit('user_joined', {
            'user': active_users[room][user_id],
            'active_users': list(active_users[room].values())
        }, room=room)
    
    # Отправляем подтверждение присоединения
    emit('joined', {
        'status': 'ok',
        'chat_id': chat_id,
        'room': room,
        'active_users': list(active_users[room].values()),
        'user_id': user_id
    })
    
    logger.info(f'👋 Пользователь {user_info.get("first_name")} присоединился к комнате {room}')
    
    return {
        'room': room,
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