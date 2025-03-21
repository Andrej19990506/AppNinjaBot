from flask import Blueprint, request, jsonify
from datetime import datetime
from data.shifts import (get_all_shifts, get_shifts_by_chat, get_shift, 
                         book_shift, update_shift, cancel_shift, cancel_user_shift)
from data.reserves import (get_all_reserves, get_reserves_by_chat, get_reserves_by_date, 
                          add_reserve, update_reserve, delete_reserve, delete_user_reserve)
import logging

# Настраиваем логирование
logger = logging.getLogger(__name__)

# Меняем имя Blueprint на 'shifts_api' вместо 'shifts'
router = Blueprint('shifts_api', __name__)

# Маршруты для смен курьеров
@router.route('/api/shifts', methods=['GET'])
def get_all_shifts_route():
    """Получение всех смен с фильтрацией по chat_id"""
    try:
        chat_id = request.args.get('chat_id')
        if chat_id:
            shifts = get_shifts_by_chat(chat_id)
        else:
            shifts = get_all_shifts()
        return jsonify(shifts)
    except Exception as e:
        logger.error(f"Error getting shifts: {str(e)}")
        return jsonify({'error': str(e)}), 500

@router.route('/api/shifts/book', methods=['POST'])
def book_new_shift():
    """Запись на смену"""
    try:
        data = request.get_json()
        
        # Получаем данные из запроса
        user_id = data['user_id']
        date = data['date']
        shift_type = data['shift_type']
        slot_index = data['slot_index']
        chat_id = data['chat_id']
        
        # Добавляем информацию о пользователе
        user_data = {
            'photo_url': data.get('photo_url'),
            'first_name': data.get('first_name'),
            'last_name': data.get('last_name')
        }
        
        # Если данные пользователя не предоставлены, получаем их из базы данных
        if not all([user_data['photo_url'], user_data['first_name'], user_data['last_name']]):
            from app import get_user_data
            user_info = get_user_data(user_id)
            if user_info:
                # Обновляем только отсутствующие поля
                for key in ['photo_url', 'first_name', 'last_name']:
                    if not user_data[key] and user_info.get(key):
                        user_data[key] = user_info[key]
            logger.info(f"Дополнены данные пользователя: {user_data}")
        
        # Бронируем смену
        new_shift = book_shift(user_id, date, shift_type, slot_index, chat_id, user_data)
        
        # Если пользователь был в резерве на эту дату, удаляем его из резерва
        try:
            deleted_reserve = delete_user_reserve(user_id, date, chat_id)
            if deleted_reserve:
                logger.info(f"User {user_id} removed from reserve for date {date} in chat {chat_id}")
        except Exception as reserve_e:
            logger.error(f"Error removing user from reserve: {str(reserve_e)}")
        
        return jsonify(new_shift)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error booking shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

@router.route('/api/shifts/<int:shift_id>', methods=['PUT'])
def update_existing_shift(shift_id):
    """Обновление смены"""
    try:
        data = request.get_json()
        chat_id = request.args.get('chat_id')
        
        # Дополнительная проверка для безопасности
        shift = get_shift(shift_id)
        if not shift:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Проверяем, что смена принадлежит указанному чату
        if chat_id and shift.get('chat_id') != chat_id:
            return jsonify({'error': 'Shift does not belong to this chat'}), 403
        
        # Обновляем смену
        updated_shift = update_shift(shift_id, data)
        if not updated_shift:
            return jsonify({'error': 'Failed to update shift'}), 500
        
        return jsonify(updated_shift)
    except Exception as e:
        logger.error(f"Error updating shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

@router.route('/api/shifts/<int:shift_id>', methods=['DELETE'])
def cancel_existing_shift(shift_id):
    """Отмена смены"""
    try:
        chat_id = request.args.get('chat_id')
        
        # Дополнительная проверка для безопасности
        shift = get_shift(shift_id)
        if not shift:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Проверяем, что смена принадлежит указанному чату
        if chat_id and shift.get('chat_id') != chat_id:
            return jsonify({'error': 'Shift does not belong to this chat'}), 403
        
        # Отменяем смену
        deleted_shift = cancel_shift(shift_id)
        if not deleted_shift:
            return jsonify({'error': 'Failed to cancel shift'}), 500
        
        return jsonify({'message': 'Shift cancelled successfully', 'shift': deleted_shift})
    except Exception as e:
        logger.error(f"Error cancelling shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

@router.route('/api/shifts/user', methods=['DELETE'])
def cancel_user_shift_by_date():
    """Отмена смены пользователя на конкретную дату"""
    try:
        user_id = request.args.get('user_id')
        date = request.args.get('date')
        chat_id = request.args.get('chat_id')
        
        if not user_id or not date or not chat_id:
            return jsonify({'error': 'Missing required parameters: user_id, date, chat_id'}), 400
        
        deleted_shift = cancel_user_shift(user_id, date, chat_id)
        if not deleted_shift:
            return jsonify({'error': 'Shift not found'}), 404
        
        return jsonify({'message': 'Shift cancelled successfully', 'shift': deleted_shift})
    except Exception as e:
        logger.error(f"Error cancelling user shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршруты для резервов курьеров
@router.route('/api/reserves', methods=['GET'])
def get_reserves_route():
    """Получение резервов с фильтрацией по chat_id и date"""
    try:
        chat_id = request.args.get('chat_id')
        date = request.args.get('date')
        
        if chat_id and date:
            reserves = get_reserves_by_date(date, chat_id)
        elif chat_id:
            reserves = get_reserves_by_chat(chat_id)
        elif date:
            reserves = get_reserves_by_date(date)
        else:
            reserves = get_all_reserves()
        
        return jsonify(reserves)
    except Exception as e:
        logger.error(f"Error getting reserves: {str(e)}")
        return jsonify({'error': str(e)}), 500

@router.route('/api/reserves/add', methods=['POST'])
def add_to_reserve():
    """Добавление в резерв"""
    try:
        data = request.get_json()
        
        # Проверяем обязательные поля
        required_fields = ['user_id', 'date', 'chat_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Добавляем в резерв
        new_reserve = add_reserve(data)
        
        return jsonify(new_reserve), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error adding to reserve: {str(e)}")
        return jsonify({'error': str(e)}), 500

@router.route('/api/reserves/<int:reserve_id>', methods=['PUT'])
def update_reserve_route(reserve_id):
    """Обновление резерва"""
    try:
        data = request.get_json()
        
        # Обновляем резерв
        updated_reserve = update_reserve(reserve_id, data)
        if not updated_reserve:
            return jsonify({'error': 'Reserve not found'}), 404
        
        return jsonify(updated_reserve)
    except Exception as e:
        logger.error(f"Error updating reserve: {str(e)}")
        return jsonify({'error': str(e)}), 500

@router.route('/api/reserves/<int:reserve_id>', methods=['DELETE'])
def delete_reserve_route(reserve_id):
    """Удаление из резерва по ID"""
    try:
        success = delete_reserve(reserve_id)
        if not success:
            return jsonify({'error': 'Reserve not found'}), 404
        
        return jsonify({'message': 'Successfully removed from reserve'})
    except Exception as e:
        logger.error(f"Error deleting reserve: {str(e)}")
        return jsonify({'error': str(e)}), 500

@router.route('/api/reserves/user', methods=['DELETE'])
def delete_user_reserve_route():
    """Удаление пользователя из резерва на конкретную дату"""
    try:
        user_id = request.args.get('user_id')
        date = request.args.get('date')
        chat_id = request.args.get('chat_id')
        
        if not user_id or not date or not chat_id:
            return jsonify({'error': 'Missing required parameters: user_id, date, chat_id'}), 400
        
        deleted_reserve = delete_user_reserve(user_id, date, chat_id)
        if not deleted_reserve:
            return jsonify({'error': 'Reserve not found'}), 404
        
        return jsonify({'message': 'Successfully removed from reserve', 'reserve': deleted_reserve})
    except Exception as e:
        logger.error(f"Error deleting user reserve: {str(e)}")
        return jsonify({'error': str(e)}), 500 