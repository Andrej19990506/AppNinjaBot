"""
Пакет для работы с WebSocket-соединениями
"""
from .rooms import (
    active_users, get_room_name, join_user_to_room, 
    update_user_in_room, remove_user_from_room,
    get_active_users_in_room, cleanup_inactive_users,
    GLOBAL_ROOM, CHAT_ROOM_PREFIX
)

# Убираем импорт events, который вызывает проблему с null-байтами
# from . import events

__all__ = [
    'active_users',
    'get_room_name',
    'join_user_to_room',
    'update_user_in_room',
    'remove_user_from_room',
    'get_active_users_in_room',
    'cleanup_inactive_users',
    'GLOBAL_ROOM',
    'CHAT_ROOM_PREFIX',
    'broadcast_notification',
    'broadcast_inventory_update',
    'broadcast_admin_update',
    'broadcast_write_off_update',
    'broadcast_shift_update',
    'broadcast_reserve_update',
] 