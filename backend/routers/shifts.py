from flask import Blueprint, request, jsonify
from datetime import datetime
from data.shifts import get_shifts, book_shift, cancel_shift

router = Blueprint('shifts', __name__)

@router.route('/api/shifts', methods=['GET'])
def get_all_shifts():
    """Получение всех смен"""
    try:
        shifts = get_shifts()
        return jsonify(shifts)
    except Exception as e:
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
        
        # Добавляем информацию о пользователе
        user_data = {
            'photo_url': data.get('avatar_url'),
            'first_name': data.get('first_name'),
            'last_name': data.get('last_name')
        }
        
        # Бронируем смену
        new_shift = book_shift(user_id, date, shift_type, slot_index, user_data)
        
        return jsonify(new_shift)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@router.route('/api/shifts/<int:shift_id>', methods=['DELETE'])
def cancel_existing_shift(shift_id):
    """Отмена смены"""
    try:
        deleted_shift = cancel_shift(shift_id)
        return jsonify({'message': 'Shift cancelled successfully', 'shift': deleted_shift})
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500 