from flask import Blueprint, request, jsonify
from datetime import datetime
import uuid
import json
import os
from flask_cors import cross_origin
from services.access_settings_service import AccessSettingsService
import logging
from data.shifts import (get_all_shifts, get_shifts_by_chat, get_shift, 
                        book_shift, update_shift, cancel_shift, cancel_user_shift)
from data.reserves import (get_all_reserves, get_reserves_by_chat, get_reserves_by_date, 
                         add_reserve, update_reserve, delete_reserve, delete_user_reserve)
from data.users import get_user_data

# Настраиваем логирование
logger = logging.getLogger(__name__)

shifts_bp = Blueprint('shifts', __name__)



# Маршрут для получения списка смен
@shifts_bp.route('', methods=['GET'])

def get_shifts():
    """Получение списка всех смен или смен для конкретного чата"""
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

# Маршрут для бронирования смены
@shifts_bp.route('', methods=['POST'])

def book_new_shift():
    """Бронирование новой смены"""
    try:
        data = request.json
        
        # Проверяем обязательные поля
        required_fields = ['user_id', 'date', 'shift_type', 'slot_index', 'chat_id']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({'error': f"Missing required fields: {', '.join(missing_fields)}"}), 400
        
        # Получаем настройки доступа
        settings = AccessSettingsService.load_settings()
        
        # ID пользователя может быть строкой или числом
        user_id = str(data['user_id'])
        
        # Проверяем, если пользователь в списке ограниченных
        if 'restrictedUsers' in settings and user_id in [str(uid) for uid in settings.get('restrictedUsers', [])]:
            return jsonify({'error': 'User is restricted from booking shifts'}), 403
        
        # Проверяем доступность даты
        if not AccessSettingsService.is_date_available(data['date'], user_id):
            return jsonify({'error': 'This date is not available for booking'}), 400
            
        # Добавляем информацию о пользователе
        user_data = {
            'photo_url': data.get('photo_url'),
            'first_name': data.get('first_name', ''),
            'last_name': data.get('last_name', ''),
            'is_senior_courier': data.get('is_senior_courier', False)
        }
        
        # Если данные пользователя не предоставлены, получаем их из базы данных
        if not all([user_data['photo_url'], user_data['first_name'], user_data['last_name']]):
            user_info = get_user_data(user_id)
            if user_info:
                for key in ['photo_url', 'first_name', 'last_name']:
                    if not user_data[key] and user_info.get(key):
                        user_data[key] = user_info[key]
        
        # Бронируем смену
        new_shift = book_shift(user_id, data['date'], data['shift_type'], 
                             data['slot_index'], data['chat_id'], user_data)
        
        # Если пользователь был в резерве на эту дату, удаляем его из резерва
        try:
            deleted_reserve = delete_user_reserve(user_id, data['date'], data['chat_id'])
            if deleted_reserve:
                logger.info(f"User {user_id} removed from reserve for date {data['date']} in chat {data['chat_id']}")
        except Exception as reserve_e:
            logger.error(f"Error removing user from reserve: {str(reserve_e)}")
        
        return jsonify(new_shift), 201
    except Exception as e:
        logger.error(f"Error booking shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршрут для обновления смены
@shifts_bp.route('/<shift_id>', methods=['PUT'])
def update_shift(shift_id):
    """Обновление существующей смены"""
    try:
        data = request.json
        updated_shift = update_shift(shift_id, data)
        if not updated_shift:
            return jsonify({'error': 'Shift not found'}), 404
        return jsonify(updated_shift)
    except Exception as e:
        logger.error(f"Error updating shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршрут для отмены смены
@shifts_bp.route('/<shift_id>', methods=['DELETE'])
def cancel_shift_route(shift_id):
    """Отмена (удаление) смены"""
    try:
        deleted_shift = cancel_shift(shift_id)
        if not deleted_shift:
            return jsonify({'error': 'Shift not found'}), 404
        return jsonify({'success': True, 'deleted_shift': deleted_shift})
    except Exception as e:
        logger.error(f"Error canceling shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршрут для подтверждения смены
@shifts_bp.route('/<shift_id>/confirm', methods=['POST'])
def confirm_shift(shift_id):
    """Подтверждение смены"""
    try:
        data = request.json or {}
        confirmed_by = data.get('confirmed_by')
        
        # Обновляем смену с подтверждением
        updated_shift = update_shift(shift_id, {
            'confirmed': True,
            'confirmed_at': datetime.now().isoformat(),
            'confirmed_by': confirmed_by
        })
        
        if not updated_shift:
            return jsonify({'error': 'Shift not found'}), 404
            
        return jsonify(updated_shift)
    except Exception as e:
        logger.error(f"Error confirming shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Новый маршрут для получения доступных для записи дат
@shifts_bp.route('/available-dates', methods=['GET'])
def get_available_dates():
    """Получение списка доступных для записи дат"""
    try:
        # Получаем ID пользователя из запроса, если есть
        user_id = request.args.get('user_id')
        
        # Получаем список доступных дат
        available_dates = AccessSettingsService.calculate_available_dates(user_id)
        
        return jsonify({
            'dates': available_dates,
            'count': len(available_dates)
        })
    
    except Exception as e:
        logger.error(f"Error getting available dates: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Маршрут для проверки доступности конкретной даты
@shifts_bp.route('/available-dates/<date_str>', methods=['GET'])
def check_date_availability(date_str):
    """Проверка доступности конкретной даты для записи"""
    try:
        # Получаем ID пользователя из запроса, если есть
        user_id = request.args.get('user_id')
        
        # Проверяем доступность даты
        is_available = AccessSettingsService.is_date_available(date_str, user_id)
        
        return jsonify({
            'date': date_str,
            'is_available': is_available
        })
    
    except Exception as e:
        logger.error(f"Error checking date availability: {str(e)}")
        return jsonify({"error": str(e)}), 500 