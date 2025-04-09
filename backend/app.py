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
from backend.telegramNinjaBot.main import bot_application
from api import api_bp
from config.settings import (
    HOST, PORT,
    APP_DIR, DATA_DIR, TEMPLATES_DIR, INVENTORY_DIR, BOT_DATA_DIR,
    API_BASE_URL, BOT_URL, MAX_CONTENT_LENGTH, IS_PRODUCTION,
    CORS_ALLOWED_ORIGINS, TRUST_PROXY
)
from flask_cors import CORS

# Настраиваем логирование
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Инициализируем Flask
app = Flask(__name__)

# Настраиваем CORS
CORS(app, resources={
    r"/api/*": {
        "origins": CORS_ALLOWED_ORIGINS,
        "supports_credentials": True
    }
})

# Устанавливаем максимальный размер запроса
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Middleware для обработки Cloudflare заголовков
@app.before_request
def before_request():
    if TRUST_PROXY:
        # Получаем реальный протокол из заголовков Cloudflare
        cf_visitor = request.headers.get('CF-Visitor')
        if cf_visitor:
            try:
                cf_visitor_json = json.loads(cf_visitor)
                scheme = cf_visitor_json.get('scheme', 'http')
                request.environ['wsgi.url_scheme'] = scheme
            except:
                pass

# Маршрут для проверки, где запрос обрабатывается
@app.route('/api/debug', methods=['GET'])
def debug_info():
    """Отладочная информация о приложении"""
    return jsonify({
        'version': __version__,
        'environment': app.config['ENV'],
        'debug': app.debug,
        'testing': app.testing,
        'database_url': app.config['DATABASE_URL'],
        'api_url': app.config['API_URL'],
        'bot_url': app.config['BOT_URL']
    })

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
    """Логирование информации о запросе"""
    logger.info('Получен запрос: %s %s', request.method, request.path)
    logger.info('Заголовки: %s', request.headers)

# Добавляем маршрут для отправки сообщений
@app.route('/api/send_message', methods=['POST'])
def send_message():
    """Отправка сообщения через бота"""
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

# Регистрируем основной Blueprint для API
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
