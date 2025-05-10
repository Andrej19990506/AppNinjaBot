"""
Модуль для работы с WebSocket и комнатами
"""
# Экспортируем общие объекты и функции
from .rooms import (
    active_users, GLOBAL_ROOM, CHAT_ROOM_PREFIX, 
    SHIFTS_ROOM_PREFIX, RESERVES_ROOM_PREFIX, COURIER_ROOM_PREFIX,
    get_room_name, get_courier_room_name, 
    join_user_to_room, update_user_in_room, remove_user_from_room, 
    get_active_users_in_room, get_user_rooms
)
from .events import register_handlers, check_handlers, test_socketio_handler

# Устанавливаем переменные, которые будут доступны при импорте модуля
__all__ = [
    'register_handlers',
    'check_handlers',
    'test_socketio_handler',
    'active_users',
    'GLOBAL_ROOM',
    'CHAT_ROOM_PREFIX',
    'SHIFTS_ROOM_PREFIX', 
    'RESERVES_ROOM_PREFIX',
    'COURIER_ROOM_PREFIX',
    'get_room_name',
    'get_courier_room_name',
    'join_user_to_room',
    'update_user_in_room',
    'remove_user_from_room',
    'get_active_users_in_room',
    'get_user_rooms'
] 