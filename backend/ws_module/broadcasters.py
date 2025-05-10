"""
Функции для рассылки сообщений в комнаты Socket.IO
"""
from flask import request
from flask_socketio import emit

from config import logger
from .rooms import get_room_name

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

def broadcast_shift_update(chat_id, shift_data, action, skip_sid=None):
    """
    Отправляет обновление смен всем пользователям в комнате, кроме отправителя
    
    Args:
        chat_id (str): ID чата
        shift_data (dict): Данные смены
        action (str): Тип действия (create, update, delete, book, cancel)
        skip_sid (str): ID сокета, который нужно пропустить (обычно отправитель)
    """
    room = get_room_name(chat_id)
    room_shifts = get_room_name(f'shifts_{chat_id}')
    room_reserves = get_room_name(f'reserves_{chat_id}')
    
    # Опционально пропускаем отправителя
    skip = skip_sid or request.sid
    
    # Убеждаемся что у данных смены есть необходимые поля для фронтенда
    if shift_data and not shift_data.get('userId') and shift_data.get('user_id'):
        shift_data['userId'] = shift_data['user_id']
    if shift_data and not shift_data.get('firstName') and shift_data.get('first_name'):
        shift_data['firstName'] = shift_data['first_name']
    if shift_data and not shift_data.get('lastName') and shift_data.get('last_name'):
        shift_data['lastName'] = shift_data['last_name']
    if shift_data and not shift_data.get('isSeniorCourier') and shift_data.get('is_senior_courier') is not None:
        shift_data['isSeniorCourier'] = shift_data['is_senior_courier']
    
    # Формируем данные для отправки
    data = {
        'type': 'shift_update',
        'action': action,
        'chat_id': chat_id,
        'data': shift_data
    }
    
    logger.info(f'🧾 Активные пользователи в комнатах:')
    from .rooms import active_users
    for room_name, users in active_users.items():
        if chat_id in room_name:
            logger.info(f'🏠 Комната {room_name}: {len(users)} пользователей')
            for user_id, user_info in users.items():
                logger.info(f'  👤 ID: {user_id}, SID: {user_info.get("socket_id")}, Имя: {user_info.get("first_name")}')
    
    # Отправляем обновление смен в комнату смен
    logger.info(f'🔄 Отправка события shift_update в комнаты {room}, {room_shifts} и {room_reserves}')
    
    try:
        emit('shift_update', data, room=room_shifts, skip_sid=skip)
        logger.info(f'✅ Отправлено в комнату смен {room_shifts}')
    except Exception as e:
        logger.error(f'❌ Ошибка отправки в комнату смен {room_shifts}: {str(e)}')
    
    # Отправляем обновление в обычную комнату чата
    try:
        emit('shift_update', data, room=room, skip_sid=skip)
        logger.info(f'✅ Отправлено в основную комнату {room}')
    except Exception as e:
        logger.error(f'❌ Ошибка отправки в основную комнату {room}: {str(e)}')
    
    # Отправляем обновление в комнату резервов
    try:
        emit('shift_update', data, room=room_reserves, skip_sid=skip)
        logger.info(f'✅ Отправлено в комнату резервов {room_reserves}')
    except Exception as e:
        logger.error(f'❌ Ошибка отправки в комнату резервов {room_reserves}: {str(e)}')
    
    # Дополнительно отправляем в глобальную комнату для всех клиентов
    try:
        from .rooms import GLOBAL_ROOM
        emit('shift_update', data, room=GLOBAL_ROOM, skip_sid=skip)
        logger.info(f'✅ Отправлено в глобальную комнату {GLOBAL_ROOM}')
    except Exception as e:
        logger.error(f'❌ Ошибка отправки в глобальную комнату: {str(e)}')
    
    # Отправляем специфические события в зависимости от действия
    if action == 'book' or action == 'create' or action == 'update':
        logger.info(f'🔄 Отправка события shift_booked всем клиентам')
        try:
            emit('shift_booked', shift_data, broadcast=True)
            logger.info(f'✅ Событие shift_booked отправлено всем')
        except Exception as e:
            logger.error(f'❌ Ошибка broadcast-отправки shift_booked: {str(e)}')
    elif action == 'cancel' or action == 'delete':
        logger.info(f'🔄 Отправка события shift_cancelled всем клиентам')
        try:
            emit('shift_cancelled', shift_data, broadcast=True)
            logger.info(f'✅ Событие shift_cancelled отправлено всем')
        except Exception as e:
            logger.error(f'❌ Ошибка broadcast-отправки shift_cancelled: {str(e)}')
    
    # Отправляем broadcast-событие shift_update_all для всех клиентов независимо от комнат
    logger.info(f'🔄 Отправка broadcast-события shift_update_all всем клиентам')
    try:
        emit('shift_update_all', data, broadcast=True, skip_sid=skip)
        logger.info(f'✅ Отправлено всем клиентам через broadcast')
    except Exception as e:
        logger.error(f'❌ Ошибка broadcast-отправки: {str(e)}')
    
    # Логируем действие
    action_text = {
        'create': 'создана',
        'update': 'обновлена',
        'delete': 'удалена',
        'book': 'забронирована',
        'cancel': 'отменена'
    }.get(action, action)
    
    logger.info(f'Смена {action_text} в комнатах {room}, {room_shifts} и {room_reserves}')

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
    from .rooms import active_users
    logger.info(f'🧾 Активные пользователи в комнатах:')
    
    for room_name, users in active_users.items():
        if chat_id in room_name:
            logger.info(f'🏠 Комната {room_name}: {len(users)} пользователей')
            for user_id, user_info in users.items():
                logger.info(f'  👤 ID: {user_id}, SID: {user_info.get("socket_id")}, Имя: {user_info.get("first_name")}')
    
    # Формируем данные для отправки
    data = {
        'type': 'reserve_update',
        'action': action,
        'chat_id': chat_id,
        'data': reserve_data
    }
    
    # Убеждаемся что у данных резерва есть необходимые поля для фронтенда
    if reserve_data and not reserve_data.get('userId') and reserve_data.get('user_id'):
        reserve_data['userId'] = reserve_data['user_id']
    if reserve_data and not reserve_data.get('firstName') and reserve_data.get('first_name'):
        reserve_data['firstName'] = reserve_data['first_name']
    if reserve_data and not reserve_data.get('lastName') and reserve_data.get('last_name'):
        reserve_data['lastName'] = reserve_data['last_name']
    
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
        from .rooms import GLOBAL_ROOM
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