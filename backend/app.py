from flask import Flask, request, jsonify, send_file, Response, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
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
from routers.notifications import notifications_bp
from routers.shifts import router as shifts_router
from services import CourierService
from telegramNinjaBot.bot import bot_application
# Импортируем маршруты для настроек доступа к сменам
from api.shifts.routes import shifts_bp as shifts_access_bp

# Импортируем функции WebSocket из модуля
from ws_module.broadcasters import (
    broadcast_notification, broadcast_inventory_update,
    broadcast_admin_update, broadcast_write_off_update,
    broadcast_shift_update, broadcast_reserve_update,
    broadcast_history_update, broadcast_notification_updated,
    broadcast_debt_payment,
    broadcast_debt_reminder
)

# Импортируем модуль обработчиков событий WebSocket и константы из rooms.py
# import ws_module.events
# Прямой импорт функции регистрации обработчиков событий вебсокета
from ws_module.events import register_handlers
from ws_module.rooms import active_users, GLOBAL_ROOM, CHAT_ROOM_PREFIX, join_user_to_room, update_user_in_room, remove_user_from_room, get_active_users_in_room, cleanup_inactive_users, get_courier_room_name

# Импортируем ItemHistory из нового модуля data.history
from data.history import ItemHistory

# Импортируем API Blueprint 
from api import api_bp

# Настраиваем логирование
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Конфигурация приложения
config = {
    'API_BASE_URL': os.getenv('API_BASE_URL', 'http://localhost:8000'),
    'BOT_URL': os.getenv('BOT_URL', 'http://bot:8001'),
    'SCHEDULER_URL': os.getenv('SCHEDULER_URL', 'http://scheduler:8002')
}

# Инициализируем Flask перед socketio
app = Flask(__name__)

# Настраиваем CORS для всех маршрутов
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "https://reform-hand-simple-invisible.trycloudflare.com",
            "https://pearl-roy-hugo-equity.trycloudflare.com"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Регистрируем маршруты для смен
app.register_blueprint(shifts_router, name='shifts_initial')

# Регистрируем маршруты для уведомлений
app.register_blueprint(notifications_bp)

# Регистрируем API маршруты
app.register_blueprint(api_bp)

# Регистрируем маршруты для настроек доступа к сменам
app.register_blueprint(shifts_access_bp, url_prefix='/api/shifts')

# Регистрируем маршруты для курьеров - больше не нужно, т.к. курьеры зарегистрированы внутри api_bp
# app.register_blueprint(couriers_bp, url_prefix='/api')

# Исходное объявление socketio
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent', logger=True)
socketio_instance = socketio  # Экспортируем для других модулей

# Также делаем доступным через app
app.socketio = socketio
logger.info(f"🌐 SocketIO instance initialized with id {id(socketio)}")

# Регистрируем все обработчики событий WebSocket
register_handlers(socketio)

# Словарь для хранения активных пользователей по комнатам
active_users = {}

# Добавляем константы для имен комнат в начале файла после импортов
GLOBAL_ROOM = 'inventory_global'  # Общая комната для всех чатов
CHAT_ROOM_PREFIX = 'inventory_'   # Префикс для комнат конкретных чатов

# Инициализация сервисов
courier_service = CourierService()

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        # Получаем origin из заголовков запроса
        origin = request.headers.get('Origin', '')
        # Проверяем, что origin в списке разрешенных
        allowed_origins = [
            "https://reform-hand-simple-invisible.trycloudflare.com",
            "https://pearl-roy-hugo-equity.trycloudflare.com",
            "https://constitute-handling-texas-interference.trycloudflare.com",
            "https://quiet-non-consistent-emissions.trycloudflare.com",
            "http://localhost:3000"
        ]
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
        else:
            # Устанавливаем localhost для тестирования
            response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Origin, Accept, X-Requested-With"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "3600"
        return response

# Базовый URL для API
BASE_URL = config['API_BASE_URL']
BOT_URL = config['BOT_URL']

# Абсолютные пути к директориям
APP_DIR = Path('/app')  # Корневая директория приложения
DATA_DIR = APP_DIR / 'data'  # /app/data
TEMPLATES_DIR = DATA_DIR / 'templates'  # /app/data/templates
INVENTORY_DIR = DATA_DIR / 'inventory'  # /app/data/inventory
BOT_DATA_DIR = APP_DIR / 'telegramNinjaBot' / 'data'  # Путь к данным бота

# Инициализируем историю после определения путей
item_history = ItemHistory(DATA_DIR)

logger.info("=== Checking paths ===")
logger.info(f"APP_DIR exists: {APP_DIR.exists()}")
logger.info(f"APP_DIR contents: {list(APP_DIR.iterdir()) if APP_DIR.exists() else 'not found'}")
logger.info(f"DATA_DIR exists: {DATA_DIR.exists()}")
logger.info(f"DATA_DIR contents: {list(DATA_DIR.iterdir()) if DATA_DIR.exists() else 'not found'}")
logger.info(f"TEMPLATES_DIR exists: {TEMPLATES_DIR.exists()}")
logger.info(f"INVENTORY_DIR exists: {INVENTORY_DIR.exists()}")
logger.info(f"BOT_DATA_DIR exists: {BOT_DATA_DIR.exists()}")

# Проверяем существование необходимых директорий
if not TEMPLATES_DIR.exists():
    logger.error(f"Templates directory not found at {TEMPLATES_DIR}")
    raise FileNotFoundError(f"Templates directory not found at {TEMPLATES_DIR}")

if not INVENTORY_DIR.exists():
    logger.info(f"Creating inventory directory at {INVENTORY_DIR}")
    INVENTORY_DIR.mkdir(exist_ok=True)

# Используем существующий шаблон
TEMPLATE_PATH = TEMPLATES_DIR / 'inventory_template.json'
logger.info(f"Looking for template at: {TEMPLATE_PATH}")

if not TEMPLATE_PATH.exists():
    logger.error(f"Template file not found at {TEMPLATE_PATH}")
    raise FileNotFoundError(f"Template file not found at {TEMPLATE_PATH}")

logger.info(f"Template exists: {TEMPLATE_PATH.exists()}")

def get_inventory_path(chat_id):
    return INVENTORY_DIR / f'inventory_{chat_id}.json'

def load_bot_data(filename):
    try:
        file_path = BOT_DATA_DIR / filename
        logger.debug(f"Trying to load file: {file_path}")
        logger.debug(f"Current working directory: {os.getcwd()}")
        logger.debug(f"Directory contents: {list(BOT_DATA_DIR.iterdir())}")
        logger.debug(f"File exists: {file_path.exists()}")
        
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                logger.debug(f"Successfully loaded data from {file_path}")
                logger.debug(f"Data: {json.dumps(data, indent=2)}")
                return data
        else:
            logger.warning(f"File not found: {file_path}")
            return {}
    except Exception as e:
        logger.error(f"Error loading file {filename}: {str(e)}")
        logger.error(traceback.format_exc())
        return {}

@app.route('/api')
def api_root():
    """Корневой маршрут API"""
    return jsonify({
        'status': 'ok',
        'endpoints': [
            '/api/chats',
            '/api/inventory/<chat_id>',
            '/api/photo/<photo_id>'
        ]
    })

@app.route('/api/photo/<path:photo_id>')
def get_photo(photo_id):
    """Проксирование запроса фотографии к боту"""
    try:
        # Если это прямая ссылка на Telegram API
        if 'api.telegram.org' in photo_id:
            # Убираем дублирование базового URL, если оно есть
            if photo_id.count('api.telegram.org') > 1:
                # Оставляем только последнюю часть URL
                parts = photo_id.split('api.telegram.org')
                photo_id = f"https://api.telegram.org{parts[-1]}"
            
            # Проксируем запрос к Telegram API
            response = requests.get(photo_id, stream=True)
            if response.status_code == 200:
                return send_file(
                    BytesIO(response.content),
                    mimetype=response.headers.get('content-type', 'image/jpeg')
                )
            logger.error(f"Failed to fetch photo from Telegram API: {response.status_code}")
            return jsonify({'error': 'Photo not found'}), response.status_code
        else:
            # Добавляем префикс local: если его нет
            if not photo_id.startswith('local:'):
                photo_id = f'local:{photo_id}'
            response = requests.get(f"{BOT_URL}/api/photo/{photo_id}")
            
            if response.status_code == 200:
                return send_file(
                    BytesIO(response.content),
                    mimetype='image/jpeg'
                )
            logger.error(f"Failed to fetch photo from bot: {response.status_code}")
            return jsonify({'error': 'Photo not found'}), response.status_code
    except Exception as e:
        logger.error(f"Error serving photo: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chats', methods=['GET'])
def get_chats():
    try:
        logger.info("Получаем список чатов...")
        members_data = load_bot_data('members.json')
        admins_data = load_bot_data('admins.json')
        
        chats = []
        
        # Получаем список всех файлов инвентаря
        inventory_files = [f for f in os.listdir(os.path.join(os.getcwd(), 'data/inventory')) if f.startswith('inventory_') and f.endswith('.json')]
        logger.info(f"Найдены файлы инвентаря: {inventory_files}")
        
        # Создаем множество ID чатов из members.json
        valid_chat_ids = set(members_data.keys())
        logger.info(f"Действительные ID чатов из members.json: {valid_chat_ids}")
        
        # Удаляем файлы инвентаря для несуществующих чатов
        for inventory_file in inventory_files:
            chat_id = inventory_file.replace('inventory_', '').replace('.json', '')
            if chat_id not in valid_chat_ids:
                logger.warning(f"Найден файл инвентаря для несуществующего чата {chat_id}, удаляем...")
                try:
                    os.remove(os.path.join(os.getcwd(), 'data/inventory', inventory_file))
                    logger.info(f"Удален файл инвентаря для несуществующего чата {chat_id}")
                except Exception as e:
                    logger.error(f"Ошибка при удалении файла инвентаря: {str(e)}")
        
        # Проверяем и синхронизируем фотографии
        photos_dir = os.path.join(BOT_DATA_DIR, 'photos')
        os.makedirs(photos_dir, exist_ok=True)
        existing_photos = {f.replace('user_', '').replace('.jpg', '') for f in os.listdir(photos_dir) if f.startswith('user_') and f.endswith('.jpg')}
        logger.info(f"Существующие фотографии: {existing_photos}")
        
        # Обрабатываем только чаты из members.json
        for chat_id, chat_data in members_data.items():
            chat_admins = admins_data.get(str(chat_id), {}).get('admins', [])
            
            # Обрабатываем фотографии участников
            members = chat_data.get('members', [])
            for member in members:
                user_id = member.get('user_id')
                if user_id:
                    # Обрабатываем photo_url
                    photo_url = member.get('photo_url')
                    
                    if photo_url:
                        # Удаляем повторяющиеся /api/photo/
                        while '/api/photo//api/photo/' in photo_url:
                            photo_url = photo_url.replace('/api/photo//api/photo/', '/api/photo/')
                        
                        # Проверяем, является ли URL прямой ссылкой на Telegram API
                        if 'api.telegram.org' in photo_url:
                            # Оставляем URL как есть
                            member['photo_url'] = photo_url
                        else:
                            # Для других URL добавляем /api/photo/ только если его еще нет
                            if not photo_url.startswith('/api/photo/'):
                                member['photo_url'] = f"/api/photo/{photo_url}"
                            else:
                                member['photo_url'] = photo_url
                        
                        logger.info(f"Обработан URL фотографии: {member['photo_url']}")
            
            # Загружаем данные инвентаризации
            inventory_path = Path(get_inventory_path(chat_id))
            inventory_data = None
            inventory_content = {}
            metadata = {
                'lastUpdated': datetime.now().isoformat(),
                'progress': 0
            }
            
            if inventory_path.exists():
                try:
                    with open(inventory_path, 'r', encoding='utf-8') as f:
                        inventory_data = json.load(f)
                        logger.info(f"Загружен существующий инвентарь для чата {chat_id}")
                        
                        # Проверяем структуру данных
                        if isinstance(inventory_data, dict):
                            # Если есть вложенный inventory
                            if 'inventory' in inventory_data:
                                inventory_content = inventory_data['inventory']
                                metadata = inventory_data.get('metadata', metadata)
                            else:
                                # Если нет вложенного inventory, считаем что это сам инвентарь
                                inventory_content = inventory_data
                            
                            # Проверяем метаданные
                            if not metadata.get('lastUpdated'):
                                metadata['lastUpdated'] = datetime.now().isoformat()
                            if not isinstance(metadata.get('progress'), (int, float)):
                                metadata['progress'] = 0
                except Exception as e:
                    logger.error(f"Ошибка при загрузке инвентаря для чата {chat_id}: {str(e)}")
            
            chat_info = {
                'chat_id': str(chat_id),
                'chat_title': chat_data['chat_title'],
                'members_count': chat_data.get('total_count', 0),
                'members': members,
                'admins': chat_admins,
                'inventory': inventory_content,
                'metadata': metadata
            }
            
            chats.append(chat_info)
            logger.info(f"Добавлен чат {chat_id} в список")
        
        # Сохраняем обновленные данные members.json
        with open(os.path.join(BOT_DATA_DIR, 'members.json'), 'w', encoding='utf-8') as f:
            json.dump(members_data, f, ensure_ascii=False, indent=2)
        
        return jsonify(chats)
    except Exception as e:
        logger.error(f"Ошибка в функции get_chats: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/templates/inventory_template', methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
def inventory_template():
    try:
        if request.method == 'GET':
            logger.info('Запрос шаблона инвентаря')
            
            if not TEMPLATE_PATH.exists():
                logger.error(f"Шаблон не найден по пути {TEMPLATE_PATH}")
                return jsonify({'error': 'Template not found'}), 404
                
            with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                template = json.load(f)
                logger.info('Шаблон успешно загружен')
                return jsonify(template)
                
        elif request.method == 'DELETE':
            logger.info('=== Удаление товара из шаблона ===')
            data = request.get_json()
            logger.info(f'Полученные данные: {data}')
            
            # Проверяем наличие всех необходимых полей
            required_fields = ['category', 'item']
            if not all(field in data for field in required_fields):
                missing_fields = [field for field in required_fields if field not in data]
                logger.error(f'Отсутствуют обязательные поля: {missing_fields}')
                return jsonify({
                    'error': 'Missing required fields',
                    'missing_fields': missing_fields
                }), 400
            
            category = data['category']
            item = data['item']
            
            # Загружаем текущий шаблон
            logger.info(f'Загружаем шаблон из {TEMPLATE_PATH}')
            try:
                with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                    template = json.load(f)
                logger.info(f'Текущий шаблон: {template}')
            except Exception as e:
                logger.error(f'Ошибка при загрузке шаблона: {str(e)}')
                return jsonify({'error': 'Failed to load template'}), 500
            
            # Проверяем существование категории и товара
            if category not in template:
                logger.error(f'Категория "{category}" не найдена в шаблоне')
                return jsonify({'error': 'Category not found'}), 404
            
            if item not in template[category]:
                logger.error(f'Товар "{item}" не найден в категории "{category}"')
                return jsonify({'error': 'Item not found'}), 404
            
            # Удаляем товар
            del template[category][item]
            
            # Если категория пуста, удаляем её
            if not template[category]:
                del template[category]
            
            try:
                # Сохраняем обновленный шаблон
                logger.info('Сохраняем обновленный шаблон')
                with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(template, f, ensure_ascii=False, indent=2)
                
                logger.info(f'Товар "{item}" успешно удален из категории "{category}"')
                return jsonify({'status': 'success'})
            except Exception as e:
                logger.error(f'Ошибка при сохранении шаблона: {str(e)}')
                return jsonify({'error': 'Failed to save template'}), 500

        elif request.method == 'POST':
            logger.info('Обновление шаблона инвентаря')
            data = request.get_json()
            
            if not data or not isinstance(data, dict):
                return jsonify({'error': 'Invalid template data'}), 400
                
            # Проверяем, есть ли активные запросы на удаление
            if deletion_requests:
                logger.warning('Попытка обновить шаблон при наличии активных запросов на удаление')
                return jsonify({
                    'error': 'Cannot update template while deletion requests are pending'
                }), 400
                
            # Сохраняем новый шаблон
            with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            logger.info('Шаблон инвентаря успешно обновлен')
            return jsonify({'status': 'success'})

        elif request.method == 'PUT':
            logger.info('=== Добавление нового товара в шаблон ===')
            data = request.get_json()
            logger.info(f'Полученные данные: {data}')
            
            # Проверяем наличие всех необходимых полей
            required_fields = ['category', 'item', 'has_semifinished']
            if not all(field in data for field in required_fields):
                missing_fields = [field for field in required_fields if field not in data]
                logger.error(f'Отсутствуют обязательные поля: {missing_fields}')
                return jsonify({
                    'error': 'Missing required fields',
                    'missing_fields': missing_fields
                }), 400
            
            category = data['category']
            item = data['item']
            has_semifinished = data['has_semifinished']
            
            # Загружаем текущий шаблон
            logger.info(f'Загружаем шаблон из {TEMPLATE_PATH}')
            try:
                with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                    template = json.load(f)
                logger.info(f'Текущий шаблон: {template}')
            except Exception as e:
                logger.error(f'Ошибка при загрузке шаблона: {str(e)}')
                return jsonify({'error': 'Failed to load template'}), 500
            
            # Создаем категорию, если её нет
            if category not in template:
                template[category] = {}
            
            # Проверяем, не существует ли уже такой товар
            if item in template[category]:
                logger.error(f'Товар "{item}" уже существует в категории "{category}"')
                return jsonify({'error': 'Item already exists'}), 400
            
            # Добавляем новый товар
            template[category][item] = {
                'raw': {
                    'quantity': 0,
                    'filled': False
                }
            }
            
            # Добавляем поле semifinished, если требуется
            if has_semifinished:
                template[category][item]['semifinished'] = {
                    'quantity': 0,
                    'filled': False
                }
            
            try:
                # Сохраняем обновленный шаблон
                logger.info('Сохраняем обновленный шаблон')
                with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(template, f, ensure_ascii=False, indent=2)
                
                logger.info(f'Товар "{item}" успешно добавлен в категорию "{category}"')
                return jsonify({'status': 'success'})
            except Exception as e:
                logger.error(f'Ошибка при сохранении шаблона: {str(e)}')
                return jsonify({'error': 'Failed to save template'}), 500

        elif request.method == 'PATCH':
            logger.info('=== Обновление шаблона ===')
            data = request.get_json()
            logger.info(f'Полученные данные: {data}')
            
            # Проверяем наличие всех необходимых полей
            required_fields = ['category', 'item', 'action']
            if not all(field in data for field in required_fields):
                missing_fields = [field for field in required_fields if field not in data]
                logger.error(f'Отсутствуют обязательные поля: {missing_fields}')
                return jsonify({
                    'error': 'Missing required fields',
                    'missing_fields': missing_fields
                }), 400
            
            if data['action'] not in ['add_semifinished', 'remove_semifinished']:
                logger.error(f'Неверное действие: {data["action"]}')
                return jsonify({'error': 'Invalid action'}), 400
            
            # Загружаем текущий шаблон
            logger.info(f'Загружаем шаблон из {TEMPLATE_PATH}')
            try:
                with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                    template = json.load(f)
                logger.info(f'Текущий шаблон: {template}')
            except Exception as e:
                logger.error(f'Ошибка при загрузке шаблона: {str(e)}')
                return jsonify({'error': 'Failed to load template'}), 500
            
            category = data['category']
            item = data['item']
            
            # Проверяем существование категории и товара
            if category not in template:
                logger.error(f'Категория "{category}" не найдена в шаблоне')
                return jsonify({'error': 'Category not found'}), 404
            
            if item not in template[category]:
                logger.error(f'Товар "{item}" не найден в категории "{category}"')
                return jsonify({'error': 'Item not found'}), 404
            
            if data['action'] == 'add_semifinished':
                # Добавляем поле semifinished, если его еще нет
                if 'semifinished' not in template[category][item]:
                    logger.info('Добавляем поле semifinished в шаблон')
                    template[category][item]['semifinished'] = {
                        'quantity': 0,
                        'filled': False
                    }
                    
                    try:
                        # Сохраняем обновленный шаблон
                        logger.info('Сохраняем обновленный шаблон')
                        with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
                            json.dump(template, f, ensure_ascii=False, indent=2)
                        
                        logger.info(f'Полуфабрикат успешно добавлен для товара "{item}" в категории "{category}"')
                        return jsonify({'status': 'success'})
                    except Exception as e:
                        logger.error(f'Ошибка при сохранении шаблона: {str(e)}')
                        return jsonify({'error': 'Failed to save template'}), 500
                
                logger.info(f'Полуфабрикат уже существует для товара "{item}" в категории "{category}"')
                return jsonify({'status': 'already_exists'})
            
            elif data['action'] == 'remove_semifinished':
                # Удаляем поле semifinished, если оно есть
                if 'semifinished' in template[category][item]:
                    logger.info('Удаляем поле semifinished из шаблона')
                    del template[category][item]['semifinished']
                    
                    try:
                        # Сохраняем обновленный шаблон
                        logger.info('Сохраняем обновленный шаблон')
                        with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
                            json.dump(template, f, ensure_ascii=False, indent=2)
                        
                        logger.info(f'Полуфабрикат успешно удален для товара "{item}" в категории "{category}"')
                        return jsonify({'status': 'success'})
                    except Exception as e:
                        logger.error(f'Ошибка при сохранении шаблона: {str(e)}')
                        return jsonify({'error': 'Failed to save template'}), 500
                
                logger.info(f'Полуфабрикат не существует для товара "{item}" в категории "{category}"')
                return jsonify({'status': 'not_exists'})
            
    except Exception as e:
        logger.error(f"Ошибка при работе с шаблоном: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


    """Обновляет шаблон после подтверждения удаления всеми филиалами"""
    try:
        logger.info(f'Обновление шаблона после подтверждения удаления {item} из категории {category}')
        
        # Загружаем текущий шаблон
        with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
            template = json.load(f)
        
        # Проверяем наличие категории и товара
        if category in template and item in template[category]:
            # Удаляем товар
            del template[category][item]
            
            # Если категория пуста, удаляем её
            if not template[category]:
                del template[category]
            
            # Сохраняем обновленный шаблон
            with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
                json.dump(template, f, ensure_ascii=False, indent=2)
                
            logger.info('Шаблон успешно обновлен')
            return True
        else:
            logger.warning(f'Товар {item} не найден в категории {category} шаблона')
            return False
            
    except Exception as e:
        logger.error(f"Ошибка при обновлении шаблона: {str(e)}")
        logger.error(traceback.format_exc())
        return False

@app.route('/api/inventory/<chat_id>', methods=['GET', 'POST', 'DELETE'])
def handle_chat_inventory(chat_id):
    """Обработка инвентаризации для конкретного чата"""
    try:
        # Получаем путь к файлу инвентаризации
        inventory_path = get_inventory_path(chat_id)
        
        # Проверяем существование файла и создаем его из шаблона, если его нет
        if not os.path.exists(inventory_path):
            with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                template = json.load(f)
                
            # Создаем начальный инвентарь из шаблона
            initial_inventory = {
                'inventory': template,
                'metadata': {
                    'lastUpdated': datetime.now().isoformat(),
                    'progress': 0,
                    'chat_id': chat_id
                }
            }
            
            # Создаем директорию если её нет
            os.makedirs(os.path.dirname(inventory_path), exist_ok=True)
            
            # Сохраняем начальный инвентарь
            with open(inventory_path, 'w', encoding='utf-8') as f:
                json.dump(initial_inventory, f, ensure_ascii=False, indent=2)
        
        if request.method == 'DELETE':
            data = request.get_json()
            if data and 'category' in data and 'item' in data:
                # Удаляем конкретный товар из инвентаря
                with open(inventory_path, 'r', encoding='utf-8') as f:
                    inventory_data = json.load(f)
                
                category = data['category']
                item = data['item']
                
                if 'inventory' in inventory_data and category in inventory_data['inventory']:
                    if item in inventory_data['inventory'][category]:
                        del inventory_data['inventory'][category][item]
                        if not inventory_data['inventory'][category]:
                            del inventory_data['inventory'][category]
                        
                        with open(inventory_path, 'w', encoding='utf-8') as f:
                            json.dump(inventory_data, f, ensure_ascii=False, indent=2)
                        
                        # Отправляем уведомление через WebSocket
                        broadcast_inventory_update(chat_id, inventory_data)
                        
                        return jsonify({'status': 'success'})
                return jsonify({'status': 'not_found'}), 404
            else:
                # Если нет данных о товаре, удаляем весь инвентарь
                logger.info(f'🗑️ Удаление инвентаря для чата {chat_id}')
                if os.path.exists(inventory_path):
                    os.remove(inventory_path)
                    logger.info('✅ Инвентарь удален')
                    broadcast_inventory_update(chat_id, None)
                return jsonify({'status': 'success', 'message': 'Inventory deleted'})
            
        elif request.method == 'POST':
            # Получаем данные инвентаря
            inventory_data = request.get_json()
            
            logger.info('📝 Сохранение инвентаря')
            logger.info(f'🏠 Чат: {chat_id}')
            
            # Проверяем наличие необходимых данных
            if not inventory_data:
                logger.error('❌ Отсутствуют данные инвентаря')
                return jsonify({'error': 'No data provided'}), 400
            
            # Загружаем текущий инвентарь
            with open(inventory_path, 'r', encoding='utf-8') as f:
                current_inventory = json.load(f)
            
            # Проверяем и корректируем структуру данных если необходимо
            if isinstance(inventory_data, dict):
                # Получаем источник обновления
                source = inventory_data.get('source', 'client')
                
                # Обновляем инвентарь
                if 'inventory' in inventory_data:
                    if isinstance(inventory_data['inventory'], dict):
                        for category, items in inventory_data['inventory'].items():
                            if category not in current_inventory['inventory']:
                                current_inventory['inventory'][category] = {}
                            current_inventory['inventory'][category].update(items)
                
                # Обновляем метаданные
                current_inventory['metadata'].update({
                    'lastUpdated': datetime.now().isoformat(),
                    'chat_id': chat_id
                })
                
                # Проверяем наличие данных истории
                if 'history' in inventory_data:
                    history_record = inventory_data.pop('history')
                    logger.info('=== 📝 Обработка записи истории ===')
                    logger.info(f'🏠 Чат: {chat_id}')
                    logger.info(f'📦 Данные истории: {json.dumps(history_record, ensure_ascii=False)}')
                    
                    try:
                        # Добавляем метаданные в запись истории
                        if 'metadata' in inventory_data:
                            history_record['metadata'] = inventory_data['metadata']
                            logger.info(f'📝 Добавлены метаданные в запись истории: {json.dumps(inventory_data["metadata"], ensure_ascii=False)}')
                        
                        # Добавляем запись в историю
                        result = item_history.add_record(chat_id, history_record)
                        logger.info('✅ Запись истории сохранена')
                        
                        # Отправляем обновление истории через WebSocket
                        room = f'inventory_{chat_id}'
                        broadcast_history_update(
                            chat_id,
                            {
                                'chat_id': chat_id,
                                'category': history_record.get('category'),
                                'item': history_record.get('item'),
                                'history': current_history
                            }
                        )
                        logger.info('📢 Обновление истории отправлено')
                    except Exception as e:
                        logger.error(f'❌ Ошибка сохранения истории: {str(e)}')
                        logger.error(traceback.format_exc())
                
                # Удаляем source из данных перед сохранением
                if 'source' in inventory_data:
                    del inventory_data['source']
                
                logger.info('📊 Структура данных:')
                logger.info(f'- Категорий: {len(inventory_data.get("inventory", {}))}')
                logger.info(f'- Источник: {source}')
            else:
                logger.error('❌ Неверный формат данных')
                return jsonify({'error': 'Invalid data format'}), 400
                
            # Сохраняем данные в файл
            try:
                os.makedirs(os.path.dirname(inventory_path), exist_ok=True)
                with open(inventory_path, 'w', encoding='utf-8') as f:
                    json.dump(inventory_data, f, ensure_ascii=False, indent=2)
                logger.info('💾 Данные сохранены')
            except Exception as e:
                logger.error('❌ Ошибка при сохранении')
                logger.error(f'Описание: {str(e)}')
                return jsonify({'error': 'Failed to save inventory data'}), 500
            
            # Отправляем уведомление об обновлении только если источник - клиент
            if source == 'client':
                try:
                    # Добавляем источник обратно для broadcast
                    inventory_data['source'] = source
                    broadcast_inventory_update(chat_id, inventory_data)
                    logger.info('📢 Уведомление отправлено')
                except Exception as e:
                    logger.error('❌ Ошибка отправки уведомления')
                    logger.error(f'Описание: {str(e)}')
            
            # Проверяем прогресс инвентаризации
            progress = inventory_data.get('metadata', {}).get('progress', 0)
            logger.info(f'📊 Прогресс: {progress}%')
            
            # Если инвентаризация завершена (прогресс 100%), планируем сброс
            if progress == 100:
                logger.info('🔄 Планирование сброса инвентаризации')
                scheduler_url = config['SCHEDULER_URL']
                
                try:
                    # Проверяем статус планировщика
                    scheduler_status = requests.get(f"{scheduler_url}/scheduler/status")
                    if not scheduler_status.ok:
                        logger.error('❌ Планировщик недоступен')
                        return jsonify({'error': 'Scheduler service is not available'}), 503
                    
                    # Проверяем, не запланирован ли уже сброс
                    job_status = requests.get(f"{scheduler_url}/scheduler/job_status/{chat_id}")
                    job_data = job_status.json()
                    
                    if not job_data.get('scheduled', False):
                        # Планируем сброс инвентаризации
                        schedule_response = requests.post(
                            f"{scheduler_url}/scheduler/schedule_reset",
                            json={'chat_id': chat_id}
                        )
                        
                        if schedule_response.ok:
                            logger.info('✅ Сброс запланирован на 7:00')
                        else:
                            logger.error('❌ Ошибка планирования сброса')
                            return jsonify({'error': 'Failed to schedule inventory reset'}), 500
                except Exception as e:
                    logger.error('❌ Ошибка работы с планировщиком')
                    logger.error(f'Описание: {str(e)}')
                    return jsonify({'error': 'Scheduler error'}), 500
            
            return jsonify({'status': 'success'})
            
        elif request.method == 'GET':
            logger.info(f'📋 Получение инвентаря для чата {chat_id}')
            
            # Проверяем существование файла
            if not os.path.exists(inventory_path):
                # Если файла нет, возвращаем шаблон
                with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                    template = json.load(f)
                    logger.info('📄 Возвращаем шаблон')
                    return jsonify({
                        'inventory': template,
                        'metadata': {
                            'lastUpdated': datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                            'progress': 0,
                            'chat_id': chat_id
                        }
                    })
            
            # Если файл существует, читаем его
            with open(inventory_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Проверяем и обновляем формат даты если нужно
                if isinstance(data, dict) and 'metadata' in data:
                    if 'lastUpdated' in data['metadata']:
                        try:
                            # Пробуем распарсить существующую дату
                            datetime.fromisoformat(data['metadata']['lastUpdated'].replace('Z', '+00:00'))
                        except ValueError:
                            # Если формат неверный, обновляем на текущую дату
                            data['metadata']['lastUpdated'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                logger.info('✅ Инвентарь загружен')
                return jsonify(data)
        
    except Exception as e:
        logger.error('❌ Ошибка обработки инвентаря')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/<chat_id>/status', methods=['GET'])
def get_inventory_status(chat_id):
    try:
        logger.info('=== 📊 Получение статуса инвентаря ===')
        logger.info(f'🏠 Чат: {chat_id}')
        
        inventory_path = get_inventory_path(chat_id)
        
        if not os.path.exists(inventory_path):
            logger.info('❌ Файл инвентаря не найден')
            return jsonify({
                'exists': False,
                'progress': 0,
                'lastUpdated': None
            })
            
        with open(inventory_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            
        # Вычисляем прогресс
        inventory = data.get('inventory', {})
        total_items = 0
        filled_items = 0
        
        logger.info('=== Подсчет прогресса ===')
        for category, items in inventory.items():
            logger.info(f'📑 Категория: {category}')
            for item_name, item in items.items():
                logger.info(f'📦 Товар: {item_name}')
                
                # Проверяем сырье
                if 'raw' in item:
                    total_items += 1
                    raw_filled = item['raw'].get('filled', False)
                    raw_quantity = item['raw'].get('quantity', 0)
                    is_raw_filled = raw_filled or raw_quantity > 0
                    
                    logger.info(f'🥩 Сырье:')
                    logger.info(f'   - Количество: {raw_quantity}')
                    logger.info(f'   - Флаг filled: {raw_filled}')
                    logger.info(f'   - Итоговый статус: {"заполнено" if is_raw_filled else "не заполнено"}')
                    
                    if is_raw_filled:
                        filled_items += 1
                
                # Проверяем полуфабрикат
                if 'semifinished' in item:
                    total_items += 1
                    semifin_filled = item['semifinished'].get('filled', False)
                    semifin_quantity = item['semifinished'].get('quantity', 0)
                    is_semifin_filled = semifin_filled or semifin_quantity > 0
                    
                    logger.info(f'🥪 Полуфабрикат:')
                    logger.info(f'   - Количество: {semifin_quantity}')
                    logger.info(f'   - Флаг filled: {semifin_filled}')
                    logger.info(f'   - Итоговый статус: {"заполнено" if is_semifin_filled else "не заполнено"}')
                    
                    if is_semifin_filled:
                        filled_items += 1
                        
        progress = round((filled_items / total_items * 100) if total_items > 0 else 0)
        
        logger.info('=== Итоги подсчета ===')
        logger.info(f'📊 Всего позиций: {total_items}')
        logger.info(f'✅ Заполнено: {filled_items}')
        logger.info(f'📈 Прогресс: {progress}%')
        
        return jsonify({
            'exists': True,
            'progress': progress,
            'lastUpdated': data.get('metadata', {}).get('lastUpdated')
        })
    except Exception as e:
        logger.error('❌ Ошибка при получении статуса инвентаря')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/<chat_id>/history', methods=['GET'])
def get_inventory_history(chat_id):
    try:
        history_path = os.path.join(INVENTORY_DIR, f'history_{chat_id}.json')
        
        if not os.path.exists(history_path):
            return jsonify([])
            
        with open(history_path, 'r', encoding='utf-8') as file:
            history = json.load(file)
            return jsonify(history)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def save_to_history(chat_id, inventory_data):
    try:
        history_path = os.path.join(INVENTORY_DIR, f'history_{chat_id}.json')
        history = []
        
        if os.path.exists(history_path):
            with open(history_path, 'r', encoding='utf-8') as file:
                history = json.load(file)
                
        # Добавляем новую запись
        history_entry = {
            'timestamp': datetime.now().isoformat(),
            'inventory': inventory_data
        }
        
        history.append(history_entry)
        
        # Сохраняем только последние 10 записей
        history = history[-10:]
        
        with open(history_path, 'w', encoding='utf-8') as file:
            json.dump(history, file, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving history: {e}")

@app.route('/api/notifications/create', methods=['POST', 'OPTIONS'])
def create_notification():
    """Создание нового уведомления"""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        logger.info(f"=== Создание уведомления ===")
        logger.info(f"Данные: {data}")
        
        # Проверяем обязательные поля
        required_fields = ['type', 'category', 'item', 'chat_id', 'branch_name']
        if not all(field in data for field in required_fields):
            missing_fields = [field for field in required_fields if field not in data]
            logger.error(f"Отсутствуют обязательные поля: {missing_fields}")
            return jsonify({'error': f'Missing required fields: {missing_fields}'}), 400
        
        # Загружаем существующие уведомления
        notifications_path = DATA_DIR / 'notifications.json'
        if notifications_path.exists():
            with open(notifications_path, 'r', encoding='utf-8') as f:
                notifications = json.load(f)
                logger.info(f"Загружено {len(notifications)} существующих уведомлений")
        else:
            notifications = []
            logger.info("Файл уведомлений не существует, создаем новый список")
        
        # Получаем данные о чатах для рассылки уведомлений
        members_data = load_bot_data('members.json')
        logger.info(f"Загружены данные о чатах: {list(members_data.keys())}")
        
        # Создаем уникальный ID для группы уведомлений
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        base_id = f"{data['chat_id']}_{data['category']}_{data['item']}_{timestamp}"
        logger.info(f"Создан base_id: {base_id}")
        
        # Проверяем, нет ли уже уведомлений с таким base_id
        if any(n['id'].startswith(base_id) for n in notifications):
            logger.warning(f"Duplicate notification attempt for {base_id}")
            return jsonify({'status': 'skipped', 'reason': 'duplicate'}), 200
        
        # Создаем уведомления для каждого чата
        new_notifications = []
        for target_chat_id in members_data.keys():
            notification = {
                'id': f"{base_id}_{target_chat_id}",
                'type': data['type'],
                'category': data['category'],
                'item': data['item'],
                'branch_name': data['branch_name'],
                'initiator_chat_id': data['chat_id'],
                'target_chat_id': target_chat_id,
                'created_at': datetime.now().isoformat(),
                'read_by': [],
                'author': data.get('author', {})
            }
            new_notifications.append(notification)
            
            # Отправляем уведомление через WebSocket
            broadcast_notification(target_chat_id, notification)
            
            logger.info(f"Создано и отправлено уведомление для чата {target_chat_id}")
        
        # Добавляем новые уведомления в начало списка
        notifications = new_notifications + notifications
        
        # Сохраняем обновленный список уведомлений
        with open(notifications_path, 'w', encoding='utf-8') as f:
            json.dump(notifications, f, ensure_ascii=False, indent=2)
            
        return jsonify({'status': 'success', 'count': len(new_notifications)}), 201
        
    except Exception as e:
        logger.error(f"Error creating notification: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/photos/fetch')
def fetch_photo():
    """Загрузка фотографии по URL"""
    try:
        url = request.args.get('url')
        if not url:
            return jsonify({'error': 'URL parameter is required'}), 400

        logger.info(f"Fetching photo from URL: {url}")
        
        # Загружаем фото
        response = requests.get(url, stream=True)
        if response.status_code != 200:
            logger.error(f"Failed to fetch photo from URL: {response.status_code}")
            return jsonify({'error': 'Failed to fetch photo from URL'}), response.status_code

        # Отправляем фото клиенту
        return send_file(
            BytesIO(response.content),
            mimetype=response.headers.get('content-type', 'image/jpeg')
        )
    except Exception as e:
        logger.error(f"Error fetching photo: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete_item', methods=['POST'])
def delete_item():
    """Удаление товара из инвентаря"""
    try:
        data = request.get_json()
        logger.info('=== Запрос на удаление товара ===')
        logger.info(f'Данные запроса: {data}')

        if not data or not isinstance(data, dict):
            return jsonify({'error': 'Invalid request data'}), 400

        # Проверяем наличие необходимых полей
        required_fields = ['category', 'item', 'chat_id']
        if not all(field in data for field in required_fields):
            missing_fields = [field for field in required_fields if field not in data]
            return jsonify({
                'error': 'Missing required fields',
                'missing_fields': missing_fields
            }), 400

        category = data['category']
        item = data['item']
        chat_id = str(data['chat_id'])
        # Определяем, нужно ли обновлять все инвентари и шаблон
        # По умолчанию - нет, только текущий инвентарь
        update_all_inventories = data.get('updateAllInventories', False)
        
        logger.info(f'Режим удаления: {"Глобальное (шаблон + все инвентари)" if update_all_inventories else "Локальное (только текущий инвентарь)"}')

        # Загружаем шаблон для проверки существования товара
        with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
            template = json.load(f)

        if category not in template or item not in template[category]:
            return jsonify({'error': 'Item not found in template'}), 404

        # Получаем данные о чате-инициаторе
        members_data = load_bot_data('members.json')
        initiator_chat_data = members_data.get(str(chat_id), {})
        branch_name = initiator_chat_data.get('chat_title', 'Неизвестный филиал')
        
        # Получаем администратора (создателя) чата-инициатора
        chat_members = initiator_chat_data.get('members', [])
        creator = next((member for member in chat_members if member.get('status') == 'creator'), None)

        # Создаем уведомление через новый универсальный эндпоинт
        notification_data = {
            'type': 'item_deleted',
            'category': category,
            'item': item,
            'chat_id': chat_id,
            'branch_name': branch_name,
            'author': {
                'user_id': creator.get('user_id') if creator else None,
                'first_name': creator.get('first_name') if creator else None,
                'last_name': creator.get('last_name') if creator else None,
                'photo_url': creator.get('photo_url') if creator else None
            }
        }
        
        # Создаем новый запрос с нашими данными
        with app.test_request_context('/api/notifications/create', 
                                    method='POST',
                                    json=notification_data) as ctx:
            # Вызываем функцию create_notification
            notify_response = create_notification()
            
            if not isinstance(notify_response, tuple):
                status_code = 200
            else:
                notify_response, status_code = notify_response
                
            if status_code not in [200, 201]:
                logger.error(f"Failed to create notifications: {notify_response}")
                return jsonify({'error': 'Failed to create notifications'}), 500

        updated_chats = []
        
        # Если требуется глобальное обновление, удаляем товар из шаблона и всех инвентарей
        if update_all_inventories:
            logger.info("Выполняется глобальное удаление товара")
            
            # Удаляем товар из шаблона
            del template[category][item]
            if not template[category]:  # Если категория пуста, удаляем её
                del template[category]

            # Сохраняем обновленный шаблон
            with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
                json.dump(template, f, ensure_ascii=False, indent=2)
                
            logger.info("Товар удален из шаблона")

            # Удаляем товар из всех инвентарей
            inventory_files = INVENTORY_DIR.glob('inventory_*.json')
            
            for inv_file in inventory_files:
                try:
                    file_chat_id = inv_file.stem.replace('inventory_', '')
                    with open(inv_file, 'r', encoding='utf-8') as f:
                        inventory_data = json.load(f)

                    # Проверяем структуру данных
                    if isinstance(inventory_data, dict):
                        inventory_content = inventory_data.get('inventory', inventory_data)
                        if category in inventory_content and item in inventory_content[category]:
                            del inventory_content[category][item]
                            if not inventory_content[category]:
                                del inventory_content[category]

                            # Если это вложенная структура, обновляем её
                            if 'inventory' in inventory_data:
                                inventory_data['inventory'] = inventory_content
                            else:
                                inventory_data = inventory_content

                            # Обновляем метаданные
                            if 'metadata' in inventory_data:
                                inventory_data['metadata']['lastUpdated'] = datetime.now().isoformat()

                            with open(inv_file, 'w', encoding='utf-8') as f:
                                json.dump(inventory_data, f, ensure_ascii=False, indent=2)

                            # Добавляем чат в список для обновления
                            updated_chats.append((file_chat_id, inventory_data))
                            logger.info(f'Товар удален из инвентаря чата {file_chat_id}')

                except Exception as e:
                    logger.error(f'Ошибка при обновлении инвентаря {inv_file}: {str(e)}')
                    continue
        else:
            # Удаляем товар только из инвентаря указанного чата
            logger.info(f"Выполняется локальное удаление товара только для чата {chat_id}")
            
            inventory_path = get_inventory_path(chat_id)
            if not inventory_path.exists():
                return jsonify({'error': f'Inventory not found for chat {chat_id}'}), 404
                
            try:
                with open(inventory_path, 'r', encoding='utf-8') as f:
                    inventory_data = json.load(f)
                    
                # Проверяем структуру данных
                if isinstance(inventory_data, dict):
                    inventory_content = inventory_data.get('inventory', inventory_data)
                    if category in inventory_content and item in inventory_content[category]:
                        del inventory_content[category][item]
                        if not inventory_content[category]:
                            del inventory_content[category]

                        # Если это вложенная структура, обновляем её
                        if 'inventory' in inventory_data:
                            inventory_data['inventory'] = inventory_content
                        else:
                            inventory_data = inventory_content

                        # Обновляем метаданные
                        if 'metadata' in inventory_data:
                            inventory_data['metadata']['lastUpdated'] = datetime.now().isoformat()

                        with open(inventory_path, 'w', encoding='utf-8') as f:
                            json.dump(inventory_data, f, ensure_ascii=False, indent=2)

                        # Добавляем чат в список для обновления
                        updated_chats.append((chat_id, inventory_data))
                        logger.info(f'Товар удален из инвентаря чата {chat_id}')
                    else:
                        logger.warning(f'Товар {item} в категории {category} не найден в инвентаре чата {chat_id}')
            except Exception as e:
                logger.error(f'Ошибка при обновлении инвентаря чата {chat_id}: {str(e)}')
                return jsonify({'error': f'Failed to update inventory for chat {chat_id}: {str(e)}'}), 500

        # Отправляем WebSocket уведомления всем обновленным чатам
        for updated_chat_id, inventory_data in updated_chats:
            try:
                broadcast_inventory_update(updated_chat_id, inventory_data)
                logger.info(f'Отправлено уведомление об обновлении инвентаря для чата {updated_chat_id}')
            except Exception as e:
                logger.error(f'Ошибка отправки уведомления для чата {updated_chat_id}: {str(e)}')

        return jsonify({'status': 'success', 'updated_chats': len(updated_chats), 'mode': 'global' if update_all_inventories else 'local'})

    except Exception as e:
        logger.error(f'Ошибка при удалении товара: {str(e)}')
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    """Получение списка уведомлений"""
    try:
        chat_id = request.args.get('chat_id')
        if not chat_id:
            return jsonify({'error': 'chat_id parameter is required'}), 400
            
        logger.info(f"=== Получение уведомлений для чата {chat_id} ===")
        
        notifications = []
        seen_ids = set()  # Для отслеживания уникальных ID уведомлений
        
        # Загружаем глобальные уведомления
        global_notifications_path = DATA_DIR / 'notifications.json'
        if global_notifications_path.exists():
            with open(global_notifications_path, 'r', encoding='utf-8') as f:
                global_notifications = json.load(f)
                # Фильтруем уведомления для данного чата
                for n in global_notifications:
                    if str(n.get('target_chat_id')) == str(chat_id) and n['id'] not in seen_ids:
                        notifications.append(n)
                        seen_ids.add(n['id'])
                
        # Загружаем уведомления чата
        chat_notifications_path = DATA_DIR / 'chats' / str(chat_id) / 'notifications.json'
        if chat_notifications_path.exists():
            with open(chat_notifications_path, 'r', encoding='utf-8') as f:
                chat_notifications = json.load(f)
                # Добавляем уведомления чата, избегая дубликатов
                for n in chat_notifications:
                    if n['id'] not in seen_ids:
                        notifications.append(n)
                        seen_ids.add(n['id'])
        
        logger.info(f"Найдено {len(notifications)} уведомлений для чата {chat_id}")
        return jsonify(notifications)
        
    except Exception as e:
        logger.error(f"Error getting notifications: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


    """Отметка уведомления как прочитанного и его удаление"""
    try:
        data = request.get_json()
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return jsonify({'error': 'chat_id is required'}), 400
            
        logger.info(f"=== Удаление уведомления ===")
        logger.info(f"ID уведомления: {notification_id}")
        logger.info(f"ID чата: {chat_id}")
        
        # Загружаем глобальные уведомления
        notifications_path = DATA_DIR / 'notifications.json'
        chat_notifications_path = DATA_DIR / 'chats' / str(chat_id) / 'notifications.json'
        
        updated = False
        
        # Обновляем глобальные уведомления
        if notifications_path.exists():
            try:
                with open(notifications_path, 'r', encoding='utf-8') as f:
                    notifications = json.load(f)
                    
                # Фильтруем уведомления, удаляя прочитанное
                original_length = len(notifications)
                filtered_notifications = [n for n in notifications if n.get('id') != notification_id]
                if len(filtered_notifications) != original_length:
                    updated = True
                    logger.info(f"Удалено уведомление из глобального файла")
                    # Сохраняем обновленные глобальные уведомления
                    with open(notifications_path, 'w', encoding='utf-8') as f:
                        json.dump(filtered_notifications, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.error(f"Ошибка при обработке глобальных уведомлений: {str(e)}")
                    
        # Обновляем уведомления чата
        if chat_notifications_path.exists():
            try:
                with open(chat_notifications_path, 'r', encoding='utf-8') as f:
                    chat_notifications = json.load(f)
                    
                # Фильтруем уведомления чата, удаляя прочитанное
                original_length = len(chat_notifications)
                filtered_chat_notifications = [n for n in chat_notifications if n.get('id') != notification_id]
                if len(filtered_chat_notifications) != original_length:
                    updated = True
                    logger.info(f"Удалено уведомление из файла чата")
                    # Сохраняем обновленные уведомления чата
                    with open(chat_notifications_path, 'w', encoding='utf-8') as f:
                        json.dump(filtered_chat_notifications, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.error(f"Ошибка при обработке уведомлений чата: {str(e)}")
                    
        if not updated:
            logger.warning(f"Уведомление с ID {notification_id} не найдено")
            return jsonify({'error': 'Notification not found'}), 404
            
        # Отправляем WebSocket уведомление об обновлении
        try:
            broadcast_notification_updated({
                'id': notification_id,
                'chat_id': chat_id,
                'action': 'deleted'
            })
            logger.info(f"Отправлено WebSocket уведомление об удалении")
        except Exception as e:
            logger.error(f"Ошибка отправки WebSocket уведомления: {str(e)}")
            
        return jsonify({'status': 'success'})
        
    except Exception as e:
        logger.error(f"Error marking notification as read: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/<chat_id>/excel', methods=['GET', 'POST'])
def generate_excel(chat_id):
    try:
        logger.info(f'=== Генерация Excel файла для чата {chat_id} ===')
        
        # Получаем данные инвентаря
        inventory_path = get_inventory_path(chat_id)
        logger.info(f'Путь к файлу инвентаря: {inventory_path}')
        
        if not os.path.exists(inventory_path):
            logger.error(f'Файл инвентаря не найден: {inventory_path}')
            return jsonify({'error': 'Inventory not found'}), 404
            
        with open(inventory_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            logger.info('Данные инвентаря успешно загружены')
            logger.debug(f'Структура данных: {json.dumps(data, indent=2, ensure_ascii=False)}')

        # Проверяем структуру данных
        inventory_data = data.get('inventory', data)  # Если нет вложенного inventory, используем сами данные
        metadata = data.get('metadata', {})
        
        logger.info(f'Категорий в инвентаре: {len(inventory_data)}')
        logger.info(f'Метаданные: {json.dumps(metadata, indent=2, ensure_ascii=False)}')

        # Создаем Excel файл
        output = BytesIO()
        logger.info('Создаем Excel файл...')

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            try:
                # Создаем DataFrame для метаданных
                metadata_df = pd.DataFrame({
                    'Поле': ['Дата:', 'Филиал:'],
                    'Значение': [
                        datetime.now().strftime('%d.%m.%Y %H:%M'),
                        metadata.get('branch_name', '') or data.get('chat_title', '')
                    ]
                })
                metadata_df.to_excel(writer, sheet_name='Инвентаризация', index=False, header=False, startrow=0)
                logger.info('Метаданные записаны')

                # Создаем DataFrame для данных инвентаря
                excel_data = []
                current_category = None
                total_items = 0

                for category, items in inventory_data.items():
                    logger.info(f'Обработка категории: {category} ({len(items)} товаров)')
                    for item_name, item_data in items.items():
                        if current_category != category:
                            current_category = category
                            # Добавляем пустую строку между категориями
                            if excel_data:
                                excel_data.append({
                                    'Категория': '',
                                    'Товар': '',
                                    'Статус': '',
                                    'Сырье': '',
                                    'Полуфабрикаты': ''
                                })
                        
                        # Определяем статус товара
                        status = 'Нет в наличии' if item_data.get('raw', {}).get('isOutOfStock', False) else ''
                        
                        excel_data.append({
                            'Категория': category,
                            'Товар': item_name,
                            'Статус': status,
                            'Сырье': item_data.get('raw', {}).get('quantity', 0),
                            'Полуфабрикаты': item_data.get('semifinished', {}).get('quantity', 0) if item_data and item_data.get('semifinished') is not None else 0
                        })
                        total_items += 1

                logger.info(f'Всего обработано товаров: {total_items}')
                df = pd.DataFrame(excel_data)
                
                # Записываем данные инвентаря после метаданных
                df.to_excel(writer, sheet_name='Инвентаризация', index=False, startrow=5)
                logger.info('Данные инвентаря записаны')
                
                worksheet = writer.sheets['Инвентаризация']
                logger.info('Применяем форматирование...')

                # Форматирование метаданных
                metadata_font = Font(bold=True)
                metadata_fill = PatternFill(start_color='F2F2F2', end_color='F2F2F2', fill_type='solid')
                
                for row in range(1, 4):
                    for col in range(1, 3):
                        cell = worksheet.cell(row=row, column=col)
                        cell.font = metadata_font
                        cell.fill = metadata_fill
                        cell.alignment = Alignment(horizontal='left', vertical='center')

                # Форматирование заголовков таблицы
                header_font = Font(bold=True, color='FFFFFF')
                header_fill = PatternFill(start_color='FF5F1F', end_color='FF5F1F', fill_type='solid')
                
                for cell in worksheet[6]:  # Заголовки таблицы теперь в 6-й строке
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = Alignment(horizontal='center', vertical='center')

                # Форматирование данных и чередование цветов категорий
                current_category = None
                current_color = False  # False - белый, True - серый
                row_num = 7  # Начинаем с 7-й строки (после заголовков)

                while worksheet.cell(row=row_num, column=1).value is not None:
                    category = worksheet.cell(row=row_num, column=1).value
                    status = worksheet.cell(row=row_num, column=3).value
                    
                    # Если категория изменилась, меняем цвет
                    if category and category != current_category and category != 'Категория':
                        current_category = category
                        current_color = not current_color

                    # Применяем форматирование к строке
                    if status == 'Нет в наличии':
                        fill = PatternFill(start_color='FFE6E6', end_color='FFE6E6', fill_type='solid')
                        font = Font(color='FF0000')  # Красный цвет для статуса
                    elif current_color:
                        fill = PatternFill(start_color='F8F9FA', end_color='F8F9FA', fill_type='solid')
                        font = Font()
                    else:
                        fill = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')
                        font = Font()

                    for col in range(1, 6):  # Теперь у нас 5 колонок
                        cell = worksheet.cell(row=row_num, column=col)
                        cell.fill = fill
                        # Применяем красный цвет только к статусу
                        if col == 3 and status == 'Нет в наличии':
                            cell.font = font
                        else:
                            cell.font = Font()
                        cell.alignment = Alignment(horizontal='left' if col <= 3 else 'center', vertical='center')
                        cell.border = Border(
                            left=Side(style='thin'),
                            right=Side(style='thin'),
                            top=Side(style='thin'),
                            bottom=Side(style='thin')
                        )

                    row_num += 1

                # Автоподбор ширины столбцов
                for column in worksheet.columns:
                    max_length = 0
                    column = [cell for cell in column]
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = (max_length + 2)
                    worksheet.column_dimensions[get_column_letter(column[0].column)].width = adjusted_width

                # Замораживаем верхнюю строку
                worksheet.freeze_panes = 'A7'
                logger.info('Форматирование завершено')

            except Exception as excel_error:
                logger.error('Ошибка при создании Excel файла:')
                logger.error(str(excel_error))
                logger.error(traceback.format_exc())
                raise

        # Сохраняем файл
        output.seek(0)
        filename = request.args.get('filename', f'inventory_{chat_id}_{datetime.now().strftime("%Y%m%d")}.xlsx')
        logger.info(f'Отправка файла: {filename}')
        
        response = send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
        # Добавляем заголовки для принудительного скачивания
        response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        response.headers["Content-Type"] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Download-Options"] = "noopen"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers.set('Expires', '0')
        
        logger.info('=== Excel файл успешно сгенерирован ===')
        return response
            
    except Exception as e:
        logger.error('❌ Ошибка при генерации Excel файла:')
        logger.error(str(e))
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/<chat_id>/excel-preview', methods=['GET'])
def preview_excel(chat_id):
    try:
        # Загружаем данные инвентаря
        inventory_path = get_inventory_path(chat_id)
        if not os.path.exists(inventory_path):
            return jsonify({'error': 'Inventory not found'}), 404

        with open(inventory_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Создаем HTML таблицу для предпросмотра
        inventory_data = data.get('inventory', {})
        html_content = ['<table style="width:100%; border-collapse: collapse;">']
        
        # Заголовки
        html_content.append('<tr style="background-color: #FF5F1F; color: white;">')
        headers = ['Категория', 'Товар', 'Статус', 'Сырье (шт.)', 'Полуфабрикаты (шт.)']
        for header in headers:
            html_content.append(f'<th style="padding: 12px; border: 1px solid #ddd;">{header}</th>')
        html_content.append('</tr>')

        # Данные
        for category, items in inventory_data.items():
            for item_name, item_data in items.items():
                raw_qty = item_data.get('raw', {}).get('quantity', 0)
                semifin_qty = item_data.get('semifinished', {}).get('quantity', 0)
                status = 'Нет в наличии' if item_data['raw'].get('isOutOfStock', False) else ''
                
                row_style = 'background-color: #FFE6E6;' if status == 'Нет в наличии' else 'background-color: white;'
                html_content.append(f'<tr style="{row_style}">')
                html_content.append(f'<td style="padding: 8px; border: 1px solid #ddd;">{category}</td>')
                html_content.append(f'<td style="padding: 8px; border: 1px solid #ddd;">{item_name}</td>')
                html_content.append(f'<td style="padding: 8px; border: 1px solid #ddd;">{status}</td>')
                html_content.append(f'<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">{raw_qty}</td>')
                html_content.append(f'<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">{semifin_qty}</td>')
                html_content.append('</tr>')

        html_content.append('</table>')

        # Добавляем стили и метаинформацию
        full_html = f'''
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; padding: 20px; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th {{ background-color: #FF5F1F; color: white; }}
                tr:nth-child(even) {{ background-color: #f9f9f9; }}
                tr:hover {{ background-color: #f5f5f5; }}
                td, th {{ padding: 12px; border: 1px solid #ddd; text-align: left; }}
            </style>
        </head>
        <body>
            <h2>Предпросмотр инвентаризации</h2>
            {''.join(html_content)}
        </body>
        </html>
        '''

        # Возвращаем HTML в формате JSON
        return jsonify({'html': full_html})

    except Exception as e:
        logger.error(f"Error generating Excel preview: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


    """Прокси для запросов к планировщику"""
    try:
        if request.method == 'OPTIONS':
            response = app.make_default_options_response()
            origin = request.headers.get('Origin', '')
            allowed_origins = [
                "https://nowhere-permissions-finder-conscious.trycloudflare.com ",
                "https://consequently-iowa-brought-slide.trycloudflare.com",
                "https://constitute-handling-texas-interference.trycloudflare.com",
                "http://localhost:3000"
            ]
            if origin in allowed_origins:
                response.headers["Access-Control-Allow-Origin"] = origin
            else:
                response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
                
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept, X-Requested-With')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response

        scheduler_url = f'http://scheduler:8002/scheduler/{path}'
        logger.info(f'Proxying request to scheduler: {scheduler_url}')
        
        # Пересылаем запрос планировщику
        scheduler_response = requests.request(
            method=request.method,
            url=scheduler_url,
            headers={key: value for (key, value) in request.headers if key != 'Host'},
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False
        )

        # Возвращаем ответ клиенту
        response = Response(
            scheduler_response.content,
            scheduler_response.status_code,
            [('Content-Type', scheduler_response.headers['Content-Type'])]
        )
        return response

    except Exception as e:
        logger.error(f"Error proxying request to scheduler: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршруты для истории товаров
@app.route('/api/item_history/<chat_id>', methods=['POST'])
def add_history_record(chat_id):
    """Добавляет новую запись в историю"""
    try:
        logger.info('📝 Добавление записи в историю')
        logger.info(f'🏠 Чат: {chat_id}')
        
        record = request.get_json()
        
        # Проверяем обязательные поля
        required_fields = ['category', 'item', 'type', 'oldQuantity', 'newQuantity', 'action']
        missing_fields = [field for field in required_fields if field not in record]
        if missing_fields:
            logger.error('❌ Отсутствуют обязательные поля')
            logger.error(f'Поля: {", ".join(missing_fields)}')
            return jsonify({"error": f"Missing required fields: {missing_fields}"}), 400

        # Загружаем историю
        history_file = DATA_DIR / 'history' / f'history_{chat_id}.json'
        current_history = []
        if history_file.exists():
            with open(history_file, 'r', encoding='utf-8') as f:
                current_history = json.load(f)

        # Обрабатываем временную метку
        try:
            timestamp = record['timestamp']
            if timestamp.endswith('Z'):
                timestamp = timestamp[:-1] + '+00:00'
            current_time = datetime.fromisoformat(timestamp)
        except (ValueError, KeyError):
            current_time = datetime.now()
            record['timestamp'] = current_time.isoformat()

        # Проверяем дубликаты
        recent_records = [
            h for h in current_history
            if abs((datetime.fromisoformat(h['timestamp'].replace('Z', '+00:00')) - current_time).total_seconds()) < 300
        ]
        logger.info(f'📊 Недавних записей: {len(recent_records)}')

        # Проверяем каждую недавнюю запись
        for existing_record in recent_records:
            if (existing_record.get('category') == record.get('category') and
                existing_record.get('item') == record.get('item') and
                existing_record.get('type') == record.get('type')):
                
                # Проверяем совпадение
                matches = {
                    'количество_старое': existing_record.get('oldQuantity') == record.get('oldQuantity'),
                    'количество_новое': existing_record.get('newQuantity') == record.get('newQuantity'),
                    'действие': existing_record.get('action') == record.get('action'),
                    'автор': existing_record.get('author', {}).get('id') == record.get('author', {}).get('id')
                }
                
                # Если полное совпадение - это дубликат
                if all(matches.values()):
                    logger.info('ℹ️ Найден дубликат записи')
                    return jsonify({"status": "skipped", "record": existing_record})
                
                # Если последовательное изменение
                if (matches['действие'] and matches['автор'] and
                    existing_record.get('newQuantity') == record.get('oldQuantity')):
                    
                    logger.info('📝 Объединение последовательных изменений')
                    
                    # Объединяем записи
                    merged_record = dict(record)
                    merged_record['oldQuantity'] = existing_record['oldQuantity']
                    merged_record['quantity'] = record['newQuantity'] - existing_record['oldQuantity']
                    merged_record['changeDetails'] = {
                        'was': existing_record['oldQuantity'],
                        'became': record['newQuantity'],
                        'difference': f"+{merged_record['quantity']}" if merged_record['quantity'] > 0 else f"{merged_record['quantity']}"
                    }
                    
                    # Обновляем историю
                    current_history.remove(existing_record)
                    current_history.insert(0, merged_record)
                    
                    # Сохраняем и отправляем
                    os.makedirs(os.path.dirname(history_file), exist_ok=True)
                    with open(history_file, 'w', encoding='utf-8') as f:
                        json.dump(current_history, f, ensure_ascii=False, indent=2)
                    
                    # Отправляем через WebSocket
                    room = f'inventory_{chat_id}'
                    broadcast_history_update(
                        chat_id,
                        {
                            'chat_id': chat_id,
                            'category': record['category'],
                            'item': record['item'],
                            'history': current_history
                        }
                    )
                    
                    logger.info('✅ Записи объединены и отправлены')
                    return jsonify({"status": "merged", "record": merged_record})

        # Добавляем новую запись
        current_history.insert(0, record)
        current_history = current_history[:1000]
        
        # Сохраняем и отправляем
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(current_history, f, ensure_ascii=False, indent=2)
        
        room = f'inventory_{chat_id}'
        broadcast_history_update(
            chat_id,
            {
                'chat_id': chat_id,
                'category': record['category'],
                'item': record['item'],
                'history': current_history
            }
        )
        
        logger.info('✅ Новая запись добавлена')
        return jsonify({"status": "success", "record": record})

    except Exception as e:
        logger.error('❌ Ошибка добавления записи')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/api/item_history/<chat_id>/<category>/<path:item>', methods=['GET'])
def get_item_history_endpoint(chat_id, category, item):
    """Получение истории изменений конкретного товара"""
    try:
        logger.info('📋 Получение истории товара')
        logger.info(f'🏠 Чат: {chat_id}')
        logger.info(f'📦 Категория: {category}')
        logger.info(f'📝 Товар: {item}')
        
        history = item_history.get_item_history(chat_id, category, item)
        logger.info(f'📊 Найдено записей: {len(history)}')
        
        return jsonify(history)
    except Exception as e:
        logger.error('❌ Ошибка получения истории')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/api/write-offs/<chat_id>', methods=['GET'])
def get_write_offs(chat_id):
    """Получение списаний для чата"""
    try:
        write_offs = get_chat_write_offs(chat_id)
        return jsonify(write_offs)
    except Exception as e:
        logger.error(f"Error getting write-offs: {str(e)}")
        return jsonify({'error': 'Ошибка при получении списаний'}), 500

@app.route('/api/write-offs/<chat_id>', methods=['POST'])
def create_write_off(chat_id):
    """Создание нового списания"""
    try:
        data = request.get_json()
        required_fields = ['name', 'reason', 'quantity']
        
        # Проверяем обязательные поля
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Не все обязательные поля заполнены'}), 400
        
        # Добавляем списание
        write_off = add_write_off(chat_id, data)
        
        # Отправляем уведомление через WebSocket
        broadcast_write_off_update(chat_id, write_off, 'create', None)
        
        return jsonify(write_off), 201
    except Exception as e:
        logger.error(f"Error creating write-off: {str(e)}")
        return jsonify({'error': 'Ошибка при создании списания'}), 500

@app.route('/api/write-offs/<chat_id>/<write_off_id>', methods=['PUT'])
def update_write_off_endpoint(chat_id, write_off_id):
    """Обновление списания"""
    try:
        data = request.get_json()
        updated_write_off = update_write_off(chat_id, write_off_id, data)
        
        if updated_write_off is None:
            return jsonify({'error': 'Списание не найдено'}), 404
        
        # Отправляем уведомление через WebSocket
        broadcast_write_off_update(chat_id, updated_write_off, 'update', None)
        
        return jsonify(updated_write_off)
    except Exception as e:
        logger.error(f"Error updating write-off: {str(e)}")
        return jsonify({'error': 'Ошибка при обновлении списания'}), 500

@app.route('/api/write-offs/<chat_id>/<write_off_id>', methods=['DELETE'])
def delete_write_off_endpoint(chat_id, write_off_id):
    """Удаление списания"""
    try:
        success = delete_write_off(chat_id, write_off_id)
        
        if not success:
            return jsonify({'error': 'Списание не найдено'}), 404
        
        # Отправляем уведомление через WebSocket
        broadcast_write_off_update(chat_id, {'id': write_off_id}, 'delete', None)
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting write-off: {str(e)}")
        return jsonify({'error': 'Ошибка при удалении списания'}), 500

def set_cors_headers(response):
    """Установка правильных CORS заголовков для ответа"""
    origin = request.headers.get('Origin', '')
    allowed_origins = [
        "https://nowhere-permissions-finder-conscious.trycloudflare.com",
        "https://consequently-iowa-brought-slide.trycloudflare.com",
        "https://reform-hand-simple-invisible.trycloudflare.com",
        "https://pearl-roy-hugo-equity.trycloudflare.com",
        "https://constitute-handling-texas-interference.trycloudflare.com",
        "https://quiet-non-consistent-emissions.trycloudflare.com",
        "http://localhost:3000"
    ]
    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Origin, Accept, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Max-Age"] = "3600"
    return response

def _generate_write_off_document_internal():
    """Внутренняя функция для генерации документа акта списания"""
    try:
        # Импортируем функцию генерации документа
        from utils.document_generator import create_write_off_document
        
        # Логируем информацию о запросе
        logger.info(f"=== 🔄 Запрос на генерацию документа ===")
        logger.info(f"📋 Метод: {request.method}")
        logger.info(f"📋 Content-Type: {request.content_type}")
        logger.info(f"📋 Origin: {request.headers.get('Origin', 'не указан')}")
        logger.info(f"📋 URL: {request.url}")
        logger.info(f"📋 Args: {request.args}")
        logger.info(f"📋 Form data: {list(request.form.keys()) if request.form else 'нет'}")
        
        # Проверяем наличие параметра download
        download_param = request.args.get('download', 'false')
        if request.form and 'download' in request.form:
            download_param = request.form['download']
        
        # Проверяем наличие дополнительного параметра force_download
        force_download_param = request.args.get('force_download', 'false')
        if request.form and 'force_download' in request.form:
            force_download_param = request.form['force_download']
        
        # Проверяем значение параметров download и force_download
        is_download = download_param.lower() in ('true', 't', 'yes', 'y', '1')
        is_force_download = force_download_param.lower() in ('true', 't', 'yes', 'y', '1')
        
        # Логируем информацию о режиме скачивания
        logger.info(f"📋 Download mode: {is_download}")
        logger.info(f"📋 Force Download mode: {is_force_download}")
        
        # Получаем данные из запроса (поддерживаем form-data, POST JSON, и GET JSON)
        data = None
        
        # 1. Приоритет - данные формы
        if request.form and 'data' in request.form:
            try:
                data = json.loads(request.form['data'])
                logger.info(f"📦 Получены данные из form-data")
            except Exception as e:
                logger.error(f"❌ Ошибка при парсинге данных из формы: {str(e)}")
        
        # 2. Если нет данных в форме, проверяем JSON в теле запроса
        if data is None and request.content_type and ('application/json' in request.content_type):
            try:
                data = request.get_json(silent=True)
                if data:
                    logger.info(f"📦 Получены JSON данные из тела запроса: {len(str(data))} байт")
                else:
                    logger.warning(f"⚠️ JSON данные в теле запроса пусты или некорректны")
            except Exception as e:
                logger.error(f"❌ Ошибка при парсинге JSON данных: {str(e)}")
        
        # 3. Если нет данных в JSON, проверяем GET-параметры
        if data is None and request.args and 'data' in request.args:
            try:
                data_param = request.args.get('data', '{}')
                logger.info(f"📦 Попытка парсинга данных из GET-параметров, длина: {len(data_param)} байт")
                logger.info(f"📦 Первые 200 символов данных: {data_param[:200]}...")
                data = json.loads(data_param)
                logger.info(f"📦 Успешно распарсены данные из GET-параметров")
            except Exception as e:
                logger.error(f"❌ Ошибка при парсинге данных из GET-параметров: {str(e)}")
                logger.error(traceback.format_exc())
        
        # Проверяем наличие необходимых данных
        if not data:
            logger.error(f"❌ Данные не получены: GET={request.args}, POST={request.form}")
            error_response = jsonify({'error': 'Не предоставлены данные для формирования документа'})
            return set_cors_headers(error_response), 400
        
        # Проверяем наличие элементов списания
        if 'items' not in data or not data['items']:
            logger.error(f"❌ Отсутствуют элементы для списания: {data}")
            error_response = jsonify({'error': 'Не предоставлены элементы для формирования документа'})
            return set_cors_headers(error_response), 400
        
        chat_title = data.get('chatTitle', 'Неизвестный филиал')
        logger.info(f"📝 Название филиала: {chat_title}")
        logger.info(f"📝 Количество элементов для списания: {len(data['items'])}")
        
        # Генерируем документ
        document_stream = create_write_off_document(data)
        
        # Формируем имя файла
        current_date = datetime.now().strftime("%d-%m-%Y")
        original_filename = request.args.get('filename', f"Акт_списания_{chat_title.replace(' ', '_')}_{current_date}.docx")
        
        # Создаем ASCII-совместимое имя файла для HTTP заголовков
        # Используем RFC 5987 кодирование для non-ASCII символов
        ascii_filename = f"write_off_act_{current_date}.docx"  # Простое ASCII-имя по умолчанию
        encoded_filename = urllib.parse.quote(original_filename)  # URL-кодирование для non-ASCII символов
        
        logger.info(f'📝 Оригинальное имя файла: {original_filename}')
        logger.info(f'📝 ASCII имя файла: {ascii_filename}')
        logger.info(f'📝 Кодированное имя файла: {encoded_filename}')
        
        # Создаем response с документом
        response = send_file(
            document_stream,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            as_attachment=True,
            download_name=ascii_filename  # Используем ASCII-имя для совместимости
        )
        
        # Добавляем заголовки для принудительного скачивания
        # Используем rfc5987 формат для non-ASCII символов в имени файла
        logger.info(f"📝 Установка заголовков для принудительного скачивания (всегда attachment)")
        # Force-download заголовки - ВСЕГДА используем attachment
        response.headers.set('Content-Disposition', 
                          f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}')
        
        response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        response.headers.set('Content-Transfer-Encoding', 'binary')
        response.headers.set('X-Content-Type-Options', 'nosniff')
        response.headers.set('X-Download-Options', 'noopen')
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        
        # Добавляем CORS заголовки
        response = set_cors_headers(response)
        
        # Логируем заголовки ответа для диагностики
        logger.info(f"📝 Заголовки ответа:")
        for header, value in response.headers:
            logger.info(f"📝 {header}: {value}")
        
        # Дополнительное логирование для проверки фактического Content-Disposition
        logger.info(f"✅ Content-Disposition итоговый: {response.headers.get('Content-Disposition', 'не установлен')}")
        logger.info(f"✅ Content-Type итоговый: {response.headers.get('Content-Type', 'не установлен')}")
        
        logger.info(f"✅ Документ успешно сгенерирован: {original_filename} (кодировано как {ascii_filename})")
        return response
    except ImportError as e:
        logger.error(f"❌ Python-docx library is not installed: {str(e)}")
        error_response = jsonify({'error': 'Отсутствует необходимая библиотека для генерации документа'})
        return set_cors_headers(error_response), 500
    except Exception as e:
        logger.error(f"❌ Error generating write-off document: {str(e)}")
        logger.error(traceback.format_exc())
        error_response = jsonify({'error': 'Ошибка при формировании документа'})
        return set_cors_headers(error_response), 500

@app.route('/api/write-offs/generate-document', methods=['GET', 'POST'])
def generate_write_off_document():
    """Генерация DOCX файла акта списания"""
    return _generate_write_off_document_internal()

@app.route('/api/writeoffs/generate-document', methods=['GET', 'POST'])
def generate_write_off_document_compat():
    """Совместимый эндпоинт для генерации DOCX файла акта списания (без дефиса)"""
    logger.info("Вызов совместимого эндпоинта /api/writeoffs/generate-document")
    return _generate_write_off_document_internal()

# Импортируем get_user_data из модуля data.users
from data.users import get_user_data, get_courier_status_in_chat

# Для регистрации маршрутов смен и резервов
from routers.shifts import router as shifts_router

# Регистрируем blueprint для смен и резервов
app.register_blueprint(shifts_router, name='shifts_api')

# Маршрут /api/user/<int:user_id>/groups перенесен в api/couriers/routes.py
# и доступен по адресу /api/couriers/<int:user_id>/groups
# Импорт и регистрация couriers_bp происходят через api_bp

# Регистрируем обработчики WebSocket-событий
from ws_module import register_handlers, check_handlers
register_handlers(socketio)

# Выполняем проверку зарегистрированных обработчиков после их регистрации
logger.info("========== ПРОВЕРКА ЗАРЕГИСТРИРОВАННЫХ ОБРАБОТЧИКОВ WEBSOCKET ==========")
check_handlers(socketio)

# Явно регистрируем обработчик для комнаты курьеров
@socketio.on('join_courier_room')
def direct_join_courier_room(data):
    logger.info(f"========== ПРЯМОЙ ВЫЗОВ ОБРАБОТЧИКА join_courier_room ==========")
    logger.info(f"Входящие данные: {data}")
    try:
        # Прямой импорт всего модуля events и вызов функции
        import ws_module.events as events
        # Проверяем наличие функции
        if hasattr(events, 'handle_join_courier_room'):
            logger.info("Функция handle_join_courier_room найдена в модуле events")
            return events.handle_join_courier_room(data)
        else:
            # Выводим список доступных функций в модуле
            module_functions = [name for name in dir(events) if callable(getattr(events, name)) and name.startswith('handle_')]
            logger.error(f"Функция handle_join_courier_room НЕ найдена в модуле events. Доступные функции: {module_functions}")
            return {"status": "error", "message": "Обработчик join_courier_room не найден в системе"}
    except Exception as e:
        logger.error(f"Ошибка при вызове handle_join_courier_room: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {"status": "error", "message": str(e)}

# Логирование всех входящих событий Socket.IO
@socketio.on('*')
def handle_all_events(event, data):
    logger.info(f"⭐ ПОЛУЧЕНО SOCKET.IO СОБЫТИЕ: {event}")
    logger.info(f"⭐ ДАННЫЕ: {data}")
    logger.info(f"⭐ КЛИЕНТ: {request.sid}")
    
    # Всегда логируем входящее событие, даже если обработчик не найден
    if event == 'connect' or event == 'disconnect':
        return  # Не логируем стандартные события connect/disconnect, так как они часто встречаются
        
    try:
        import json
        logger.info(f"⭐ ДАННЫЕ JSON: {json.dumps(data, ensure_ascii=False)}")
    except:
        logger.info(f"⭐ ДАННЫЕ НЕ МОГУТ БЫТЬ ПРЕОБРАЗОВАНЫ В JSON")
    
    try:
        # Проверяем, есть ли обработчик для данного события
        handlers = socketio.handlers.get('/', {})
        event_handler_exists = event in handlers
        logger.info(f"⭐ ОБРАБОТЧИК ДЛЯ СОБЫТИЯ {event} {'СУЩЕСТВУЕТ' if event_handler_exists else 'НЕ СУЩЕСТВУЕТ'}")
        
        # Логируем все зарегистрированные обработчики
        logger.info(f"⭐ ЗАРЕГИСТРИРОВАННЫЕ ОБРАБОТЧИКИ: {list(handlers.keys())}")
    except Exception as e:
        logger.error(f"⭐ ОШИБКА ПРИ ПРОВЕРКЕ ОБРАБОТЧИКОВ: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

# Прямая регистрация обработчика для join_courier_room для отладки
@socketio.on('join_courier_room')
def debug_join_courier_room(data):
    logger.info(f"🔔 ПРЯМОЙ ВЫЗОВ debug_join_courier_room В APP.PY")
    logger.info(f"🔍 ВХОДНЫЕ ДАННЫЕ: {json.dumps(data, ensure_ascii=False)}")
    logger.info(f"🔑 SOCKET ID: {request.sid}")
    
    # Явно проверяем наличие chat_id в любом формате
    chat_id = None
    if isinstance(data, dict):
        for key in ['chatId', 'chat_id', 'roomId', 'room_id', 'id']:
            if key in data and data[key]:
                chat_id = data[key]
                logger.info(f"🔑 НАЙДЕН ИДЕНТИФИКАТОР КОМНАТЫ: {chat_id} (ключ: {key})")
                break
    
    if chat_id is None and isinstance(data.get('test'), bool) and data.get('test') == True:
        chat_id = "-1004721237800"  # Тестовый ID чата для debug
        logger.info(f"🔧 ИСПОЛЬЗУЕМ ТЕСТОВЫЙ CHAT_ID: {chat_id}")
    
    # Вызываем обработчик с необходимым параметром
    try:
        from ws_module.events import handle_join_courier_room
        if chat_id:
            # Добавляем chat_id если его нет
            if isinstance(data, dict) and not (data.get('chatId') or data.get('chat_id')):
                data['chat_id'] = chat_id
                data['chatId'] = chat_id
                logger.info(f"🔧 ДОБАВЛЕН CHAT_ID В ДАННЫЕ: {chat_id}")
        
        logger.info(f"🔄 ВЫЗОВ ОБРАБОТЧИКА handle_join_courier_room С ДАННЫМИ: {json.dumps(data, ensure_ascii=False)}")
        result = handle_join_courier_room(data)
        logger.info(f"✅ РЕЗУЛЬТАТ: {json.dumps(result, ensure_ascii=False)}")
        return result
    except Exception as e:
        logger.error(f"❌ ОШИБКА: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {"status": "error", "message": str(e)}

# Перехватчик для всех остальных сообщений Socket.IO, которые не имеют своего обработчика
@socketio.on_error_default
def default_error_handler(e):
    logger.error(f"❌ ОШИБКА В ОБРАБОТЧИКЕ SOCKETIO: {str(e)}")
    import traceback
    logger.error(traceback.format_exc())

# Универсальный перехватчик любых событий, не обрабатываемых явно
def handle_any_event(event_name, *args, **kwargs):
    logger.info(f"❓ ПОЛУЧЕНО НЕИЗВЕСТНОЕ СОБЫТИЕ: {event_name}")
    logger.info(f"❓ АРГУМЕНТЫ: {args}")
    logger.info(f"❓ KEYWORD ARGS: {kwargs}")
    logger.info(f"❓ SOCKET ID: {request.sid if hasattr(request, 'sid') else 'N/A'}")
    return {"status": "received", "message": f"Event {event_name} received but no handler found"}

# Регистрируем обработчик для отлова всех событий после других регистраций
def register_catch_all_handlers():
    logger.info("🔍 РЕГИСТРАЦИЯ ПЕРЕХВАТЧИКА ВСЕХ СОБЫТИЙ")
    # Получаем все зарегистрированные события
    registered_events = []
    
    # Безопасно проверяем тип handlers и логируем его
    if hasattr(socketio, 'handlers'):
        logger.info(f"🔧 Тип объекта socketio.handlers: {type(socketio.handlers)}")
        
        # Разные способы получения данных в зависимости от типа
        if isinstance(socketio.handlers, dict):
            for namespace, handlers in socketio.handlers.items():
                registered_events.extend(list(handlers.keys()))
        elif isinstance(socketio.handlers, list):
            registered_events = [f"event-{i}" for i in range(len(socketio.handlers))]
            logger.info(f"🔧 socketio.handlers это список длиной {len(socketio.handlers)}")
        else:
            logger.warning(f"🔧 Неожиданный тип socketio.handlers: {type(socketio.handlers)}")
            logger.warning(f"🔧 Директории объекта: {dir(socketio.handlers)}")
    else:
        logger.warning("🔧 socketio не имеет атрибута handlers")
        logger.warning(f"🔧 Директории объекта socketio: {dir(socketio)}")
    
    # Логируем все найденные обработчики
    handlers = {}
    for rule in app.url_map.iter_rules():
        handlers[rule.endpoint] = rule.rule
    logger.info(f"🔍 Flask URL обработчики: {handlers}")
    
    # Добавляем обработчик всех событий напрямую через декоратор
    try:
        @socketio.on('*')
        def catch_all(event, *args, **kwargs):
            logger.info(f"⭐ ПОЛУЧЕНО СОБЫТИЕ '*': {event}")
            logger.info(f"⭐ АРГУМЕНТЫ: {args}")
            logger.info(f"⭐ KEYWORDS: {kwargs}")
            return {"status": "received"}
        
        logger.info("✅ Добавлен обработчик 'catch_all'")
    except Exception as e:
        logger.error(f"❌ Ошибка при добавлении обработчика 'catch_all': {str(e)}")
    
    logger.info(f"🔍 ЗАРЕГИСТРИРОВАННЫЕ СОБЫТИЯ: {registered_events}")
    
    # Пытаемся добавить универсальный обработчик другим способом
    try:
        socketio.on('*')(handle_any_event)
        logger.info("✅ ОБРАБОТЧИК '*' УСПЕШНО ЗАРЕГИСТРИРОВАН")
    except Exception as e:
        logger.error(f"❌ ОШИБКА ПРИ РЕГИСТРАЦИИ ОБРАБОТЧИКА '*': {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

# Вызываем функцию напрямую
register_catch_all_handlers()

# Добавляем прямые обработчики для диагностики
@socketio.on('join_courier_room')
def handle_join_courier_room_app(data):
    logger.info(f"📩 [APP.PY] ПОЛУЧЕНО СОБЫТИЕ join_courier_room: {data}")
    
    # Извлекаем chat_id из различных возможных полей
    chat_id = None
    if isinstance(data, dict):
        chat_id = data.get('chat_id') or data.get('chatId')
        logger.info(f"🔍 chat_id из data: {chat_id}")
        
        if not chat_id and 'data' in data and isinstance(data['data'], dict):
            chat_id = data['data'].get('chat_id') or data['data'].get('chatId')
            logger.info(f"🔍 chat_id из data.data: {chat_id}")
    
    logger.info(f"📋 Итоговый chat_id: {chat_id}")
    
    # Проверяем наличие chat_id
    if not chat_id:
        logger.error("❌ Не указан идентификатор чата (chat_id)")
        emit('error', {'status': 'error', 'message': 'Не указан идентификатор чата (chat_id)'})
        return
        
    # Извлекаем информацию о пользователе
    user_info = data.get('user_info', {})
    logger.info(f"👤 Информация о пользователе: {user_info}")
    
    # Формируем имя комнаты
    room_name = get_courier_room_name(chat_id)
    
    logger.info(f"🏠 Пользователь присоединяется к комнате: {room_name}")
    
    # Присоединяем пользователя к комнате
    try:
        join_room(room_name)
        logger.info(f"✅ Пользователь успешно присоединился к комнате {room_name}")
        
        # Добавляем пользователя в список активных пользователей комнаты
        user_id = user_info.get('id')
        if not user_id:
            import uuid
            user_id = str(uuid.uuid4())
            user_info['id'] = user_id
        
        join_result = join_user_to_room(chat_id, user_id, user_info)
        
        # Получаем список активных пользователей комнаты
        active_users = get_active_users_in_room(chat_id)
        
        # Отправляем подтверждение подключения
        emit('joined', {
            'status': 'success',
            'message': f'Вы присоединились к комнате {room_name}',
            'room': room_name,
            'chat_id': chat_id,
            'active_users': active_users
        })
        
        # Уведомляем всех в комнате о новом пользователе
        emit('user_joined', {
            'user': user_info,
            'room': room_name,
            'active_users': active_users,
            'timestamp': datetime.now().isoformat()
        }, room=room_name)
        
    except Exception as e:
        logger.error(f"❌ Ошибка при присоединении к комнате: {str(e)}")
        logger.exception("Трассировка ошибки:")
        emit('error', {'status': 'error', 'message': f'Ошибка при присоединении к комнате: {str(e)}'})

@socketio.on('echo')
def handle_echo(data):
    logger.info(f"📢 [APP.PY] ПОЛУЧЕНО ЭХО-СОБЫТИЕ: {data}")
    emit('echo_response', {
        'status': 'success',
        'received': data,
        'timestamp': datetime.now().isoformat(),
        'server_id': id(socketio)
    })

if __name__ == '__main__':
    try:
        host = os.environ.get('HOST', '0.0.0.0')
        port = int(os.environ.get('PORT', 8000))
        
        # Запуск приложения через socketio для поддержки WebSocket
        print(f"\n🚀 Starting server on {host}:{port}...")
        socketio.run(app, host=host, port=port, debug=True, use_reloader=True, log_output=True)
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        print(f"❌ Error starting server: {str(e)}")
        sys.exit(1)

    # Добавляем проверку и логи:
    if __name__ == '__main__':
        try:
            logger.info(f"✅ Проверка инициализации SocketIO: {id(socketio_instance)}")
            logger.info(f"✅ socketio доступен через app: {hasattr(app, 'socketio')}")
            logger.info(f"✅ app.socketio id: {id(app.socketio) if hasattr(app, 'socketio') else 'недоступно'}")
            # ... existing code ...
        except Exception as e:
            logger.error(f"Error checking SocketIO: {str(e)}")
            print(f"❌ Error checking SocketIO: {str(e)}")
            sys.exit(1)
