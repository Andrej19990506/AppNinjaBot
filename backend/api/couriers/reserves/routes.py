from flask import request, jsonify
from datetime import datetime
import logging
from flask_cors import cross_origin
from data.reserves import (get_all_reserves, get_reserves_by_chat, get_reserves_by_date, 
                         add_reserve, update_reserve, delete_reserve, delete_user_reserve)
from data.users import get_user_data
from . import reserves_bp

# Настраиваем логирование
logger = logging.getLogger(__name__)

CORS_ORIGINS = [
    "https://reform-hand-simple-invisible.trycloudflare.com",
    "https://pearl-roy-hugo-equity.trycloudflare.com",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:5000"
]

@reserves_bp.route('', methods=['GET'])
@cross_origin(origins=CORS_ORIGINS)
def get_reserves():
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

@reserves_bp.route('', methods=['POST'])
@cross_origin(origins=CORS_ORIGINS)
def add_to_reserve():
    """Добавление в резерв"""
    try:
        data = request.json
        
        # Проверяем обязательные поля
        required_fields = ['user_id', 'date', 'chat_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Добавляем информацию о пользователе
        user_data = {
            'photo_url': data.get('photo_url'),
            'first_name': data.get('first_name', ''),
            'last_name': data.get('last_name', '')
        }
        
        # Если данные пользователя не предоставлены, получаем их из базы данных
        if not all([user_data['photo_url'], user_data['first_name'], user_data['last_name']]):
            user_info = get_user_data(data['user_id'])
            if user_info:
                for key in ['photo_url', 'first_name', 'last_name']:
                    if not user_data[key] and user_info.get(key):
                        user_data[key] = user_info[key]
        
        # Добавляем в резерв
        new_reserve = add_reserve({**data, **user_data})
        
        return jsonify(new_reserve), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error adding to reserve: {str(e)}")
        return jsonify({'error': str(e)}), 500

@reserves_bp.route('/<int:reserve_id>', methods=['PUT'])
@cross_origin(origins=CORS_ORIGINS)
def update_reserve_route(reserve_id):
    """Обновление резерва"""
    try:
        data = request.json
        updated_reserve = update_reserve(reserve_id, data)
        if not updated_reserve:
            return jsonify({'error': 'Reserve not found'}), 404
        return jsonify(updated_reserve)
    except Exception as e:
        logger.error(f"Error updating reserve: {str(e)}")
        return jsonify({'error': str(e)}), 500

@reserves_bp.route('/<int:reserve_id>', methods=['DELETE'])
@cross_origin(origins=CORS_ORIGINS)
def delete_reserve_route(reserve_id):
    """Удаление из резерва"""
    try:
        deleted_reserve = delete_reserve(reserve_id)
        if not deleted_reserve:
            return jsonify({'error': 'Reserve not found'}), 404
        return jsonify({'message': 'Reserve deleted successfully', 'reserve': deleted_reserve})
    except Exception as e:
        logger.error(f"Error deleting reserve: {str(e)}")
        return jsonify({'error': str(e)}), 500 