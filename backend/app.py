from flask import Flask, request, jsonify, send_file, Response, send_from_directory, redirect, url_for
import json
from datetime import datetime
import os
from pathlib import Path
import logging
import traceback
import requests
from io import BytesIO
import uuid
import pandas as pd
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import sys
import pytz
from functools import wraps
from data.write_offs import get_chat_write_offs, add_write_off, update_write_off, delete_write_off
import time
import random
import string
import mimetypes
import subprocess
from decimal import Decimal
from typing import Dict, List, Optional, Union, Any
import urllib.parse
from api.couriers import couriers_bp
from services import CourierService
from telegramNinjaBot.bot import bot_application
from api import api_bp
from config.settings import (
    HOST, PORT,
    APP_DIR, DATA_DIR, TEMPLATES_DIR, INVENTORY_DIR, BOT_DATA_DIR,
    API_BASE_URL, BOT_URL, MAX_CONTENT_LENGTH, IS_PRODUCTION
)

# Настраиваем логирование
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Инициализируем Flask
app = Flask(__name__)

# Устанавливаем максимальный размер запроса
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Маршрут для проверки, где запрос обрабатывается
@app.route('/api/debug', methods=['GET'])
def debug_route():
    logger.info("Debug route accessed")
    return jsonify({
        "status": "ok",
        "message": "API server is running",
        "registered_blueprints": [str(blueprint) for blueprint in app.blueprints]
    })

# Ручное перенаправление для /api/couriers/shifts
@app.route('/api/couriers/shifts', methods=['GET', 'POST'])
def shifts_proxy():
    """Перенаправление для /api/couriers/shifts без CORS декораторов"""
    try:
        logger.info(f"Обработка запроса на /api/couriers/shifts без CORS декораторов")
        
        if request.method == 'GET':
            # Получаем chat_id из параметров запроса
            chat_id = request.args.get('chat_id')
            
            # Импортируем нужные функции для получения данных
            from data.shifts import get_all_shifts, get_shifts_by_chat
            
            # Получаем смены в зависимости от наличия chat_id
            if chat_id:
                shifts = get_shifts_by_chat(chat_id)
            else:
                shifts = get_all_shifts()
                
            return jsonify(shifts)
        else:
            # Для POST запроса
            from data.shifts import book_shift
            from data.reserves import delete_user_reserve
            from services.access_settings_service import AccessSettingsService
            from data.users import get_user_data
            
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
        logger.error(f"Ошибка при обработке запроса к /api/couriers/shifts: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Ручное перенаправление для /api/reserves
@app.route('/api/reserves', methods=['GET', 'POST'])
def reserves_proxy():
    """Перенаправление для /api/reserves без CORS декораторов"""
    try:
        logger.info(f"Обработка запроса на /api/reserves без CORS декораторов")
        
        # Импортируем функции для работы с резервами
        from data.reserves import (get_all_reserves, get_reserves_by_chat, get_reserves_by_date, 
                                add_reserve, update_reserve, delete_reserve)
        from data.users import get_user_data
        
        if request.method == 'GET':
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
        else:
            # Для POST запроса
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
        logger.error(f"Ошибка при обработке запроса к /api/reserves: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Перехватываем все запросы для логирования и отладки
@app.before_request
def log_request_info():
    logger.info(f"Получен запрос: {request.method} {request.path}")
    logger.info(f"Заголовки: {dict(request.headers)}")
    return None

# Добавляем маршрут для отправки сообщений
@app.route('/send_message', methods=['POST'])
def send_message_proxy():
    """Маршрут для отправки сообщений через бота"""
    try:
        logger.info(f"Получен запрос на отправку сообщения")
        data = request.json
        
        logger.info(f"Данные запроса: {data}")
        
        # Проверяем обязательные поля
        if not data.get('chat_id') or not data.get('text'):
            logger.error("Не указан chat_id или текст сообщения")
            return jsonify({"error": "Не указан chat_id или текст сообщения"}), 400
        
        # Отправляем запрос в бот
        response = requests.post(
            f"{BOT_URL}/api/send_message",
            json=data,
            timeout=10
        )
        
        logger.info(f"Ответ от бота: {response.status_code}, {response.text}")
        
        # Возвращаем ответ от бота
        return Response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get('Content-Type', 'application/json')
        )
        
    except Exception as e:
        logger.error(f"Ошибка при отправке сообщения: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Регистрируем маршруты
app.register_blueprint(api_bp)

if __name__ == '__main__':
    try:
        print(f"\n🚀 Starting server on {HOST}:{PORT}...")
        # Выводим все зарегистрированные маршруты для отладки
        print("\n📋 Registered routes:")
        for rule in app.url_map.iter_rules():
            print(f"  {rule.endpoint}: {rule.rule}")
        app.run(host=HOST, port=PORT)
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        print(f"❌ Error starting server: {str(e)}")
        sys.exit(1)
