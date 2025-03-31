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

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Словарь для хранения комнат пользователей
user_rooms = {}

@sio.event
async def connect(sid, environ):
    """Обработчик подключения клиента"""
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    """Обработчик отключения клиента"""
    logger.info(f"Client disconnected: {sid}")
    # Удаляем пользователя из всех комнат при отключении
    if sid in user_rooms:
        for room in user_rooms[sid]:
            await leave_room(sid, room)
        del user_rooms[sid]

@sio.event
async def join_room(sid, data):
    """Обработчик присоединения к комнате"""
    try:
        room = data.get('room')
        if not room:
            return {'error': 'Room not specified'}

        # Добавляем пользователя в комнату
        await sio.enter_room(sid, room)
        
        # Сохраняем информацию о комнате пользователя
        if sid not in user_rooms:
            user_rooms[sid] = set()
        user_rooms[sid].add(room)
        
        # Добавляем пользователя в базу данных
        await add_user_to_room(sid, room)
        
        # Получаем список активных пользователей в комнате
        active_users = await get_active_users_in_room(room)
        
        # Отправляем подтверждение клиенту
        await sio.emit('room_joined', {
            'room': room,
            'active_users': active_users
        }, room=sid)
        
        return {
            'status': 'success',
            'room': room,
            'active_users': active_users
        }
    except Exception as e:
        logger.error(f"Error joining room: {e}")
        return {'error': str(e)}

@sio.event
async def leave_room(sid, room):
    """Обработчик выхода из комнаты"""
    try:
        # Удаляем пользователя из комнаты
        await sio.leave_room(sid, room)
        
        # Удаляем комнату из списка комнат пользователя
        if sid in user_rooms and room in user_rooms[sid]:
            user_rooms[sid].remove(room)
        
        # Удаляем пользователя из базы данных
        await remove_user_from_room(sid, room)
        
        # Отправляем подтверждение клиенту
        await sio.emit('room_left', {
            'room': room
        }, room=sid)
        
        return {'status': 'success'}
    except Exception as e:
        logger.error(f"Error leaving room: {e}")
        return {'error': str(e)}

@sio.event
async def message(sid, data):
    """Обработчик получения сообщения"""
    try:
        logger.info(f"Received message from {sid}: {data}")
        # Отправляем сообщение обратно клиенту
        await sio.emit('message', f"Server received: {data}", room=sid)
    except Exception as e:
        logger.error(f"Error handling message: {e}")

async def notification_handler(payload):
    """Обработчик уведомлений от PostgreSQL"""
    try:
        data = json.loads(payload)
        event_type = data.get('type')
        
        if event_type == 'user_join':
            room = data.get('room')
            user_id = data.get('user_id')
            await sio.emit('user_joined', {
                'room': room,
                'user_id': user_id
            }, room=room)
            
        elif event_type == 'user_leave':
            room = data.get('room')
            user_id = data.get('user_id')
            await sio.emit('user_left', {
                'room': room,
                'user_id': user_id
            }, room=room)
            
    except Exception as e:
        logger.error(f"Error handling notification: {e}")

async def start_notification_listener():
    """Запуск слушателя уведомлений"""
    try:
        await subscribe_to_events(notification_handler)
    except Exception as e:
        logger.error(f"Error starting notification listener: {e}") 