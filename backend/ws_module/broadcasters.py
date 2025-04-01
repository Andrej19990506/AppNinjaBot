"""
Функции для рассылки сообщений в комнаты Socket.IO
"""
from flask import request
from flask_socketio import emit
import json

from config import logger
from .rooms import (
    join_user_to_room, update_user_in_room, remove_user_from_room,
    get_room_name, active_users, GLOBAL_ROOM, CHAT_ROOM_PREFIX, 
    get_courier_room_name, get_active_users_in_room
)

def broadcast_notification(chat_id, notification):
    """
    Отправляет уведомление всем пользователям в комнате
    
    Args:
        chat_id (str): ID чата
        notification (dict): Данные уведомления
    """
    room = get_room_name(chat_id)
    
    # Отправляем уведомление в комнату
    emit('notification', {
        'chat_id': chat_id,
        'notification': notification
    }, room=room)
    
    logger.info(f'Уведомление отправлено в комнату {room}')

def broadcast_inventory_update(chat_id, inventory_data, skip_sid=None):
    """
    Отправляет обновление инвентаря всем пользователям в комнате, кроме отправителя
    
    Args:
        chat_id (str): ID чата
        inventory_data (dict): Данные инвентаря
        skip_sid (str): ID сокета, который нужно пропустить (обычно отправитель)
    """
    room = get_room_name(chat_id)
    
    # Опционально пропускаем отправителя
    skip = skip_sid or request.sid
    
    data = {
        'type': 'inventory_update',
        'chat_id': chat_id,
        'data': inventory_data
    }
    
    # Отправляем обновление инвентаря в комнату
    emit('inventory_update', data, room=room, skip_sid=skip)
    
    # Отправляем в глобальную комнату, если есть данные
    if inventory_data:
        data['data'] = {
            'chat_id': chat_id,
            'inventory': inventory_data
        }
        emit('global_inventory_update', data, room=get_room_name('global'), skip_sid=skip)
    
    logger.info(f'Обновление инвентаря отправлено в комнату {room}')

def broadcast_admin_update(chat_id, admin_data):
    """
    Отправляет данные админа всем пользователям в комнате
    
    Args:
        chat_id (str): ID чата
        admin_data (dict): Данные админа
    """
    room = get_room_name(chat_id)
    
    # Отправляем данные админа в комнату
    emit('admin_update', {
        'chat_id': chat_id,
        'data': admin_data
    }, room=room)
    
    logger.info(f'Обновление админа отправлено в комнату {room}')

def broadcast_write_off_update(chat_id, write_off_data, action, skip_sid=None):
    """
    Отправляет обновление списаний всем пользователям в комнате, кроме отправителя
    
    Args:
        chat_id (str): ID чата
        write_off_data (dict): Данные списания
        action (str): Тип действия (create, update, delete)
        skip_sid (str): ID сокета, который нужно пропустить (обычно отправитель)
    """
    room = get_room_name(chat_id)
    
    # Опционально пропускаем отправителя
    skip = skip_sid or request.sid
    
    # Формируем данные для отправки
    data = {
        'type': 'writeoff_update',
        'action': action,
        'chat_id': chat_id,
        'data': write_off_data
    }
    
    # Отправляем обновление списаний в комнату
    emit('writeoff_update', data, room=room, skip_sid=skip)
    
    # Логируем действие
    action_text = {
        'create': 'создано',
        'update': 'обновлено',
        'delete': 'удалено'
    }.get(action, action)
    
    logger.info(f'Списание {action_text} в комнате {room}')

def broadcast_shift_update(chat_id: str, shift_data: dict, action: str = 'update'):
    """
    Рассылает обновление смены всем пользователям в комнате курьеров
    """
    try:
        logger.info('=== 📢 Начало рассылки обновления смены ===')
        logger.info(f'🏠 Чат: {chat_id}')
        logger.info(f'🔄 Действие: {action}')
        logger.info(f'📊 Данные смены: {json.dumps(shift_data, ensure_ascii=False)}')

        # Получаем все комнаты для чата
        room = get_room_name(chat_id)
        room_shifts = get_room_name(f'shifts_{chat_id}')
        room_courier = get_courier_room_name(chat_id)
        
        logger.info(f'🏠 Комнаты для рассылки:')
        logger.info(f'📝 Основная комната: {room}')
        logger.info(f'📝 Комната смен: {room_shifts}')
        logger.info(f'📝 Комната курьеров: {room_courier}')

        # Собираем информацию о пользователе из всех комнат чата
        user_id = shift_data.get('user_id') or shift_data.get('userId')
        user_info = None
        
        if user_id:
            # Ищем пользователя во всех комнатах чата
            for room_name, users in active_users.items():
                if chat_id in room_name and user_id in users:
                    user_info = users[user_id]
                    logger.info(f'👤 Найден пользователь в комнате {room_name}: {user_info}')
                    break

        # Нормализуем данные для отправки
        normalized_data = {
            'id': shift_data.get('id'),
            'date': shift_data.get('date'),
            'shift_type': shift_data.get('shift_type'),
            'slot_index': shift_data.get('slot_index'),
            'user_id': shift_data.get('user_id'),
            'chat_id': shift_data.get('chat_id'),
            'created_at': shift_data.get('created_at'),
            'updated_at': shift_data.get('updated_at'),
            'firstName': shift_data.get('firstName'),
            'lastName': shift_data.get('lastName'),
            'photo_url': shift_data.get('photo_url'),
            'isSeniorCourier': shift_data.get('isSeniorCourier'),
            'last_modified_by': shift_data.get('last_modified_by'),
            'modified_by_senior': shift_data.get('modified_by_senior')
        }
        logger.info(f'📊 Нормализованные данные: {json.dumps(normalized_data, ensure_ascii=False)}')

        # Отправляем обновление во все комнаты
        logger.info(f'🔄 Отправка события shift_update во все комнаты')
        
        try:
            emit('shift_update', normalized_data, room=room)
            logger.info(f'✅ Отправлено в основную комнату {room}')
        except Exception as e:
            logger.error(f'❌ Ошибка отправки в комнату {room}: {str(e)}')
        
        try:
            emit('shift_update', normalized_data, room=room_shifts)
            logger.info(f'✅ Отправлено в комнату смен {room_shifts}')
        except Exception as e:
            logger.error(f'❌ Ошибка отправки в комнату {room_shifts}: {str(e)}')
        
        try:
            emit('shift_update', normalized_data, room=room_courier)
            logger.info(f'✅ Отправлено в комнату курьеров {room_courier}')
        except Exception as e:
            logger.error(f'❌ Ошибка отправки в комнату {room_courier}: {str(e)}')
        
        # Отправляем в глобальную комнату для всех клиентов
        try:
            emit('shift_update', normalized_data, room=GLOBAL_ROOM)
            logger.info(f'✅ Отправлено в глобальную комнату {GLOBAL_ROOM}')
        except Exception as e:
            logger.error(f'❌ Ошибка отправки в глобальную комнату: {str(e)}')

        logger.info('=== ✅ Рассылка обновления смены завершена ===')
        logger.info('✅ Обновление успешно разослано')

    except Exception as e:
        logger.error('❌ Ошибка при рассылке обновления смены')
        logger.error(f'Описание: {str(e)}')
        import traceback
        logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')

def broadcast_reserve_update(chat_id, reserve_data, action, skip_sid=None):
    """
    Отправляет обновление резервов всем пользователям в комнате, кроме отправителя
    
    Args:
        chat_id (str): ID чата
        reserve_data (dict): Данные резерва
        action (str): Тип действия (add, remove)
        skip_sid (str): ID сокета, который нужно пропустить (обычно отправитель)
    """
    room = get_room_name(chat_id)
    room_shifts = get_room_name(f'shifts_{chat_id}')
    room_reserves = get_room_name(f'reserves_{chat_id}')
    
    # Опционально пропускаем отправителя
    skip = skip_sid or request.sid
    
    # Логируем активных пользователей
    logger.info(f'🧾 Активные пользователи в комнатах:')
    
    # Собираем информацию о пользователе из всех комнат чата
    user_id = reserve_data.get('user_id') or reserve_data.get('userId')
    user_info = None
    
    if user_id:
        # Ищем пользователя во всех комнатах чата
        for room_name, users in active_users.items():
            if chat_id in room_name and user_id in users:
                user_info = users[user_id]
                logger.info(f'👤 Найден пользователь в комнате {room_name}: {user_info}')
                break
    
    # Нормализуем данные резерва
    if reserve_data and user_info:
        # Обновляем данные резерва информацией о пользователе, сохраняя оба формата
        reserve_data.update({
            # camelCase формат
            'photo_url': user_info.get('photo_url') or reserve_data.get('photo_url'),
            'firstName': user_info.get('first_name') or reserve_data.get('firstName') or reserve_data.get('first_name'),
            'lastName': user_info.get('last_name') or reserve_data.get('lastName') or reserve_data.get('last_name'),
            'isSeniorCourier': user_info.get('is_senior_courier') or reserve_data.get('isSeniorCourier') or reserve_data.get('is_senior_courier', False),
            # snake_case формат для совместимости
            'first_name': user_info.get('first_name') or reserve_data.get('first_name') or reserve_data.get('firstName'),
            'last_name': user_info.get('last_name') or reserve_data.get('last_name') or reserve_data.get('lastName'),
            'is_senior_courier': user_info.get('is_senior_courier') or reserve_data.get('is_senior_courier') or reserve_data.get('isSeniorCourier', False)
        })
        logger.info(f'📝 Обновленные данные резерва: {json.dumps(reserve_data, ensure_ascii=False)}')
    
    # Формируем данные для отправки
    data = {
        'type': 'reserve_update',
        'action': action,
        'chat_id': chat_id,
        'data': reserve_data
    }
    
    # Отправляем обновление резервов в соответствующие комнаты через общее событие reserve_update
    logger.info(f'🔄 Отправка события reserve_update в комнаты {room}, {room_shifts} и {room_reserves}')
    
    try:
        emit('reserve_update', data, room=room_shifts, skip_sid=skip)
        logger.info(f'✅ Отправлено в комнату смен {room_shifts}')
    except Exception as e:
        logger.error(f'❌ Ошибка отправки в комнату {room_shifts}: {str(e)}')
    
    try:
        emit('reserve_update', data, room=room, skip_sid=skip)
        logger.info(f'✅ Отправлено в основную комнату {room}')
    except Exception as e:
        logger.error(f'❌ Ошибка отправки в комнату {room}: {str(e)}')
    
    try:
        emit('reserve_update', data, room=room_reserves, skip_sid=skip)
        logger.info(f'✅ Отправлено в комнату резервов {room_reserves}')
    except Exception as e:
        logger.error(f'❌ Ошибка отправки в комнату {room_reserves}: {str(e)}')
    
    # Дополнительно отправляем в глобальную комнату для всех клиентов
    try:
        emit('reserve_update', data, room=GLOBAL_ROOM, skip_sid=skip)
        logger.info(f'✅ Отправлено в глобальную комнату {GLOBAL_ROOM}')
    except Exception as e:
        logger.error(f'❌ Ошибка отправки в глобальную комнату: {str(e)}')
    
    # Дополнительно отправляем специфические события для совместимости с frontend
    if action == 'add':
        logger.info(f'🔄 Отправка события reserve_added в комнаты {room}, {room_shifts} и {room_reserves}')
        emit('reserve_added', reserve_data, room=room_shifts, skip_sid=skip)
        emit('reserve_added', reserve_data, room=room, skip_sid=skip)
        emit('reserve_added', reserve_data, room=room_reserves, skip_sid=skip)
        # Отправляем в глобальную комнату
        emit('reserve_added', reserve_data, room=GLOBAL_ROOM, skip_sid=skip)
    elif action == 'remove':
        logger.info(f'🔄 Отправка события reserve_deleted в комнаты {room}, {room_shifts} и {room_reserves}')
        emit('reserve_deleted', reserve_data, room=room_shifts, skip_sid=skip)
        emit('reserve_deleted', reserve_data, room=room, skip_sid=skip)
        emit('reserve_deleted', reserve_data, room=room_reserves, skip_sid=skip)
        # Отправляем в глобальную комнату
        emit('reserve_deleted', reserve_data, room=GLOBAL_ROOM, skip_sid=skip)
    
    # Отправляем сообщение всем клиентам (broadcast)
    logger.info(f'🔄 Отправка broadcast-события reserve_update_all всем клиентам')
    try:
        emit('reserve_update_all', data, broadcast=True, skip_sid=skip)
        logger.info(f'✅ Отправлено всем клиентам через broadcast')
    except Exception as e:
        logger.error(f'❌ Ошибка broadcast-отправки: {str(e)}')
    
    # Логируем действие
    action_text = {
        'add': 'добавлен',
        'remove': 'удален'
    }.get(action, action)
    
    logger.info(f'Резерв {action_text} в комнатах {room}, {room_shifts} и {room_reserves}')

def broadcast_history_update(chat_id, history_data, skip_sid=None):
    """
    Отправляет обновление истории всем пользователям в комнате, кроме отправителя
    
    Args:
        chat_id (str): ID чата
        history_data (dict): Данные истории
        skip_sid (str): ID сокета, который нужно пропустить (обычно отправитель)
    """
    room = get_room_name(chat_id)
    
    # Опционально пропускаем отправителя
    skip = skip_sid or request.sid
    
    # Отправляем обновление истории в комнату
    emit('history_update', history_data, room=room, skip_sid=skip)
    
    logger.info(f'Обновление истории отправлено в комнату {room}')

def broadcast_notification_updated(notification_data, skip_sid=None):
    """
    Отправляет информацию об обновлении уведомления всем пользователям
    
    Args:
        notification_data (dict): Данные уведомления
        skip_sid (str): ID сокета, который нужно пропустить (обычно отправитель)
    """
    # Опционально пропускаем отправителя
    skip = skip_sid or request.sid
    
    # Отправляем обновление всем
    emit('notification_updated', notification_data, broadcast=True, skip_sid=skip)
    
    logger.info(f'Информация об обновлении уведомления отправлена всем пользователям')

def broadcast_debt_payment(chat_id, payment_data, skip_sid=None):
    """
    Отправляет информацию о платеже по долгу всем пользователям в комнате
    
    Args:
        chat_id (str): ID чата
        payment_data (dict): Данные о платеже
        skip_sid (str): ID сокета, который нужно пропустить (обычно отправитель)
    """
    room = get_room_name(chat_id)
    
    # Опционально пропускаем отправителя
    skip = skip_sid or request.sid
    
    # Отправляем информацию о платеже в комнату
    emit('debt_payment', {
        'chat_id': chat_id,
        'payment': payment_data
    }, room=room, skip_sid=skip)
    
    logger.info(f'Информация о платеже отправлена в комнату {room}')

def broadcast_debt_reminder(chat_id, reminder_data, skip_sid=None):
    """
    Отправляет напоминание о долге всем пользователям в комнате
    
    Args:
        chat_id (str): ID чата
        reminder_data (dict): Данные напоминания
        skip_sid (str): ID сокета, который нужно пропустить (обычно отправитель)
    """
    room = get_room_name(chat_id)
    
    # Опционально пропускаем отправителя
    skip = skip_sid or request.sid
    
    # Отправляем напоминание о долге в комнату
    emit('debt_reminder', {
        'chat_id': chat_id,
        'reminder': reminder_data
    }, room=room, skip_sid=skip)
    
    logger.info(f'Напоминание о долге отправлено в комнату {room}') 