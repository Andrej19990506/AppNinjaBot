from flask import Flask, request, jsonify, send_file, Response
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

# Настраиваем логирование
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Класс для работы с историей
class ItemHistory:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.history_dir = data_dir / 'history'
        self.history_dir.mkdir(parents=True, exist_ok=True)

    def _get_history_file(self, chat_id: str) -> Path:
        return self.history_dir / f'history_{chat_id}.json'

    def _load_history(self, chat_id: str) -> list:
        history_file = self._get_history_file(chat_id)
        if history_file.exists():
            with open(history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []

    def _save_history(self, chat_id: str, history: list):
        history_file = self._get_history_file(chat_id)
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

    def add_record(self, chat_id: str, record: dict) -> dict:
        """Добавляет новую запись в историю."""
        try:
            logger.info('=== 📝 Добавление записи в историю ===')
            logger.info(f'🏠 Чат: {chat_id}')
            logger.info(f'📦 Данные записи: {json.dumps(record, ensure_ascii=False)}')
            
            # Загружаем текущую историю
            current_history = self._load_history(chat_id)
            
            # Проверяем наличие обязательных полей
            required_fields = ['action', 'type', 'category', 'itemName']
            missing_fields = [field for field in required_fields if field not in record]
            if missing_fields:
                raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
            
            # Генерируем уникальный ID и добавляем метку времени
            record['id'] = str(uuid.uuid4())
            if 'timestamp' not in record:
                record['timestamp'] = datetime.now(pytz.UTC).isoformat()
            
            # Добавляем дополнительные поля если их нет
            if 'quantity' not in record and 'oldQuantity' in record and 'newQuantity' in record:
                record['quantity'] = record['newQuantity'] - record['oldQuantity']
            
            # Добавляем информацию об авторе если её нет
            if 'author' not in record:
                # Пытаемся получить информацию о пользователе из метаданных
                metadata = record.get('metadata', {})
                current_user = metadata.get('currentUser', {})
                
                if current_user and current_user.get('id'):
                    record['author'] = {
                        'id': current_user.get('id'),
                        'first_name': current_user.get('first_name'),
                        'photo_url': current_user.get('photo_url')
                    }
                    logger.info(f'👤 Использую данные пользователя из метаданных: {json.dumps(record["author"], ensure_ascii=False)}')
                else:
                    record['author'] = {
                        'id': None,
                        'first_name': 'Система',
                        'photo_url': None
                    }
                    logger.info('👤 Использую данные системного пользователя')
            
            # Добавляем описание изменения
            if 'description' not in record:
                quantity_diff = record.get('quantity', record.get('newQuantity', 0) - record.get('oldQuantity', 0))
                type_name = 'сырья' if record['type'] == 'raw' else 'полуфабрикатов'
                
                if record['action'] == 'add':
                    record['description'] = f"Добавлено {quantity_diff} {type_name}"
                elif record['action'] == 'remove':
                    record['description'] = f"Удалено {abs(quantity_diff)} {type_name}"
                else:
                    record['description'] = f"Изменено количество {type_name} с {record.get('oldQuantity', 0)} на {record.get('newQuantity', 0)}"
            
            # Добавляем дополнительные метаданные
            record.update({
                'chat_id': chat_id,
                'status': 'completed',
                'item_display_name': record.get('itemName'),
                'category_display_name': record.get('category'),
                'change_type': 'quantity_update',
                'change_details': {
                    'field': 'quantity',
                    'old_value': record.get('oldQuantity'),
                    'new_value': record.get('newQuantity'),
                    'difference': record.get('quantity', record.get('newQuantity', 0) - record.get('oldQuantity', 0))
                }
            })
            
            # Переименовываем поле itemName в item для совместимости
            if 'itemName' in record:
                record['item'] = record['itemName']
            
            # Добавляем запись в начало списка и ограничиваем историю
            current_history.insert(0, record)
            current_history = current_history[:1000]  # Ограничиваем историю
            
            # Сохраняем обновленную историю
            history_file = self._get_history_file(chat_id)
            os.makedirs(os.path.dirname(history_file), exist_ok=True)
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(current_history, f, ensure_ascii=False, indent=2)
                
            logger.info('✅ Запись успешно сохранена')
            logger.info(f'📊 Всего записей: {len(current_history)}')
            return {"status": "success", "record": record}
            
        except Exception as e:
            logger.error('❌ Ошибка добавления записи')
            logger.error(f'Описание: {str(e)}')
            logger.error(traceback.format_exc())
            raise

    def get_item_history(self, chat_id: str, category: str, item: str) -> list:
        """Получает историю изменений конкретного товара"""
        try:
            logger.info('📋 Получение истории товара')
            logger.info(f'🏠 Чат: {chat_id}')
            logger.info(f'📦 Категория: {category}')
            logger.info(f'📝 Товар: {item}')
            
            history = self._load_history(chat_id)
            
            # Фильтруем записи, учитывая оба возможных имени поля
            filtered_history = [
                record for record in history
                if (record.get('category') == category and 
                    (record.get('item') == item or record.get('itemName') == item))
            ]
            
            # Сортируем по времени (новые записи сверху)
            filtered_history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            logger.info(f'📊 Найдено записей: {len(filtered_history)}')
            return filtered_history
            
        except Exception as e:
            logger.error('❌ Ошибка получения истории')
            logger.error(f'Описание: {str(e)}')
            logger.error(traceback.format_exc())
            return []

    def get_chat_history(self, chat_id: str, limit: int = 100) -> list:
        """Получает последние записи истории для чата"""
        history = self._load_history(chat_id)
        return history[:limit]

    def clear_history(self, chat_id: str):
        """Очищает историю чата"""
        self._save_history(chat_id, [])

# Конфигурация приложения
config = {
    'API_BASE_URL': os.getenv('API_BASE_URL', 'http://localhost:8000'),
    'BOT_URL': os.getenv('BOT_URL', 'http://bot:8001'),
    'SCHEDULER_URL': os.getenv('SCHEDULER_URL', 'http://scheduler:8002')
}

app = Flask(__name__)

# Настройки CORS
cors = CORS(
    app,
    origins=[
        "https://conference-henderson-falls-investigation.trycloudflare.com",
        "https://drum-converter-telephony-fireplace.trycloudflare.com",
        "https://workplace-cultures-guidelines-wins.trycloudflare.com",
        "http://localhost:3000"  # Для локальной разработки
    ],
    allow_headers=["Content-Type", "Authorization", "Origin", "Accept", "X-Requested-With"],
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    supports_credentials=True,
    intercept_exceptions=True,
    max_age=3600,
    vary_header=True
)

# Инициализация Socket.IO с правильными настройками
socketio = SocketIO(
    app,
    cors_allowed_origins=[
        "https://conference-henderson-falls-investigation.trycloudflare.com",
        "https://drum-converter-telephony-fireplace.trycloudflare.com",
        "https://workplace-cultures-guidelines-wins.trycloudflare.com",
        "http://localhost:3000"  # Для локальной разработки
    ],
    async_mode='gevent',
    path='/ws/socket.io',
    ping_timeout=20,
    ping_interval=10000,
    logger=True,
    engineio_logger=True,
    max_http_buffer_size=1e8,
    async_handlers=True,
    transports=['websocket', 'polling'],
    always_connect=True,
    manage_session=True,
    upgrade_timeout=10000,
    allow_upgrades=True,
    cookie=None,
    cors_credentials=True
)

# Словарь для хранения активных пользователей по комнатам
active_users = {}

# Добавляем константы для имен комнат в начале файла после импортов
GLOBAL_ROOM = 'inventory_global'  # Общая комната для всех чатов
CHAT_ROOM_PREFIX = 'inventory_'   # Префикс для комнат конкретных чатов

# Добавляем обработчик OPTIONS запросов
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        # Получаем origin из заголовков запроса
        origin = request.headers.get('Origin', '')
        # Проверяем, что origin в списке разрешенных
        allowed_origins = [
            "https://conference-henderson-falls-investigation.trycloudflare.com",
            "https://drum-converter-telephony-fireplace.trycloudflare.com",
            "https://workplace-cultures-guidelines-wins.trycloudflare.com",
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

def update_template_after_approval(category: str, item: str) -> bool:
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
                        socketio.emit('history_update', {
                            'chatId': chat_id,
                            'itemId': history_record.get('itemName'),
                            'category': history_record.get('category'),
                            'record': result['record']
                        }, room=room)
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

@app.route('/api/send_love', methods=['POST'])
def send_love():
    """Проксирование запроса отправки сообщений к боту"""
    try:
        data = request.get_json()
        response = requests.post(f"{BOT_URL}/api/send_love", json=data)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        logger.error(f"Error sending love messages: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

def broadcast_notification(chat_id, notification):
    """Отправляет уведомление через WebSocket"""
    try:
        room = f'inventory_{chat_id}'
        socketio.emit('notification', {
            'type': 'notification',
            'chat_id': chat_id,
            'notification': notification
        }, room=room)
        logger.info(f'Уведомление отправлено в комнату {room}')
    except Exception as e:
        logger.error(f'Ошибка при отправке уведомления: {str(e)}')
        logger.error(traceback.format_exc())

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

@app.route('/api/notifications/<notification_id>/read', methods=['POST'])
def mark_notification_as_read(notification_id):
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
            socketio.emit('notification_updated', {
                'id': notification_id,
                'chat_id': chat_id,
                'action': 'deleted'
            }, room=f'inventory_{chat_id}')
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
        response.headers["Expires"] = "0"
        
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

@app.route('/scheduler/<path:path>', methods=['GET', 'POST', 'OPTIONS'])
def scheduler_proxy(path):
    """Прокси для запросов к планировщику"""
    try:
        if request.method == 'OPTIONS':
            response = app.make_default_options_response()
            origin = request.headers.get('Origin', '')
            allowed_origins = [
                "https://conference-henderson-falls-investigation.trycloudflare.com",
                "https://drum-converter-telephony-fireplace.trycloudflare.com",
                "https://workplace-cultures-guidelines-wins.trycloudflare.com",
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
                    socketio.emit('history_update', {
                        'chat_id': chat_id,
                        'category': record['category'],
                        'item': record['item'],
                        'history': current_history
                    }, room=room)
                    
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
        socketio.emit('history_update', {
            'chat_id': chat_id,
            'category': record['category'],
            'item': record['item'],
            'history': current_history
        }, room=room)
        
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

# WebSocket events
@socketio.on('connect')
def handle_connect():
    """Обработчик подключения клиента"""
    logger.info('🔌 WebSocket подключение установлено')
    logger.info(f'👤 Сессия: {request.sid}')
    emit('connected', {'status': 'success'})

@socketio.on('disconnect')
def handle_disconnect():
    """Обработчик отключения клиента"""
    logger.info('🔌 WebSocket отключение')
    logger.info(f'👤 Сессия: {request.sid}')
    
    # Удаляем пользователя из всех комнат
    for room in active_users:
        for user_id, user_info in list(active_users[room].items()):
            if request.sid == user_info.get('socket_id'):
                del active_users[room][user_id]
                logger.info(f'👋 Пользователь {user_info.get("first_name")} покинул комнату {room}')
                
                # Оповещаем остальных
                emit('user_left', {
                    'user': user_info,
                    'active_users': list(active_users[room].values())
                }, room=room)
                
                # Удаляем пустую комнату
                if not active_users[room]:
                    del active_users[room]
                    logger.info(f'🗑️ Комната {room} удалена')
                break

@socketio.on('error')
def handle_error(error):
    """Обработчик ошибок WebSocket"""
    logger.error('❌ Ошибка WebSocket')
    logger.error(f'👤 Сессия: {request.sid}')
    logger.error(f'Описание: {error}')

@socketio.on('join')
def handle_join(data):
    """Обработчик присоединения к комнате"""
    try:
        chat_id = data.get('chat_id')
        user_info = data.get('user_info')
        force = data.get('force', False)  # Параметр для принудительного переподключения
        refresh = data.get('refresh', False)  # Параметр для обновления данных о подключении
        
        if not chat_id or not user_info:
            logger.error('❌ Ошибка присоединения к комнате')
            logger.error('Отсутствуют обязательные данные')
            return
        
        # Логируем дополнительные параметры    
        logger.info(f'🔧 Параметры подключения: force={force}, refresh={refresh}')
            
        # Определяем комнату
        room = GLOBAL_ROOM if chat_id == 'global' else f'{CHAT_ROOM_PREFIX}{chat_id}'
        
        # Проверяем, не находится ли пользователь уже в комнате
        user_id = user_info.get('id')
        
        # Если force=True, то всегда переподключаем пользователя
        if force:
            logger.info(f'🔄 Принудительное переподключение пользователя к комнате {room}')
            # Если пользователь уже был в комнате, обновляем его данные
            if room in active_users and user_id in active_users[room]:
                logger.info(f'ℹ️ Пользователь уже был в комнате, обновляем данные')
                active_users[room][user_id]['socket_id'] = request.sid
                active_users[room][user_id]['last_activity'] = datetime.now().isoformat()
            else:
                # Иначе добавляем нового пользователя
                logger.info(f'👤 Добавление нового пользователя в комнату')
                if room not in active_users:
                    active_users[room] = {}
                
                active_users[room][user_id] = {
                    **user_info,
                    'last_activity': datetime.now().isoformat()
                }
            
            # Присоединяем к комнате
            join_room(room)
            
            # Отправляем обновление всем в комнате
            socketio.emit('user_joined', {
                'user': active_users[room][user_id],
                'active_users': list(active_users[room].values())
            }, room=room)
            
            # Отправляем подтверждение
            emit('joined', {
                'status': 'success',
                'room': room,
                'active_users': list(active_users[room].values()),
                'forced': True
            })
            return
        
        # Если refresh=True, просто отправляем актуальные данные без переподключения
        if refresh:
            logger.info(f'🔄 Обновление данных о комнате {room} без переподключения')
            if room in active_users and user_id in active_users[room]:
                # Обновляем время последней активности
                active_users[room][user_id]['last_activity'] = datetime.now().isoformat()
                
                # Отправляем подтверждение с актуальными данными
                emit('joined', {
                    'status': 'success',
                    'room': room,
                    'active_users': list(active_users[room].values()),
                    'refreshed': True
                })
                return
        
        # Обычная логика подключения (если не force и не refresh)
        if room in active_users and user_id in active_users[room]:
            existing_socket_id = active_users[room][user_id].get('socket_id')
            if existing_socket_id == request.sid:
                logger.info('ℹ️ Пользователь уже подключен к комнате')
                # Отправляем текущий список пользователей
                emit('joined', {
                    'status': 'success',
                    'room': room,
                    'active_users': list(active_users[room].values())
                })
                return
            else:
                # Если пользователь подключен с другого сокета, обновляем socket_id
                logger.info(f'🔄 Обновление socket_id пользователя (старый: {existing_socket_id}, новый: {request.sid})')
                active_users[room][user_id]['socket_id'] = request.sid
                active_users[room][user_id]['last_activity'] = datetime.now().isoformat()
                
                # Отправляем обновление всем в комнате
                emit('user_joined', {
                    'user': active_users[room][user_id],
                    'active_users': list(active_users[room].values())
                }, room=room)
                
                # Отправляем подтверждение новому подключению
                emit('joined', {
                    'status': 'success',
                    'room': room,
                    'active_users': list(active_users[room].values())
                })
                return
        
        # Присоединяем к комнате
        join_room(room)
        logger.info('👋 Пользователь присоединяется к комнате')
        logger.info(f'👤 Сессия: {request.sid}')
        logger.info(f'🏠 Комната: {room}')
        
        # Инициализируем комнату если её нет
        if room not in active_users:
            active_users[room] = {}
            logger.info('🏠 Создана новая комната')
            
        # Добавляем пользователя
        if user_id:
            active_users[room][user_id] = {
                **user_info,
                'socket_id': request.sid,
                'last_activity': datetime.now().isoformat()
            }
            logger.info(f'✅ Добавлен пользователь {user_info.get("first_name")}')
            logger.info(f'👥 Всего пользователей: {len(active_users[room])}')
            
            # Оповещаем всех
            emit('user_joined', {
                'user': active_users[room][user_id],
                'active_users': list(active_users[room].values())
            }, room=room)
            
            # Отправляем подтверждение
            emit('joined', {
                'status': 'success',
                'room': room,
                'active_users': list(active_users[room].values())
            })
            
            # Проверяем наличие сохраненных уведомлений для пользователя
            try:
                # Путь к файлу уведомлений
                chat_data_dir = DATA_DIR / 'chats' / chat_id
                notifications_path = chat_data_dir / 'notifications.json'
                
                if notifications_path.exists():
                    with open(notifications_path, 'r', encoding='utf-8') as f:
                        try:
                            notifications = json.load(f)
                            if notifications:
                                logger.info(f'📩 Найдено {len(notifications)} сохраненных уведомлений для пользователя')
                                # Отправляем каждое уведомление пользователю
                                for notification in notifications:
                                    emit('inventory_notification', notification)
                                logger.info('✅ Сохраненные уведомления отправлены пользователю')
                                
                                # Очищаем файл уведомлений после успешной отправки
                                with open(notifications_path, 'w', encoding='utf-8') as f:
                                    json.dump([], f)
                                logger.info('🗑️ Файл уведомлений очищен')
                        except json.JSONDecodeError:
                            logger.error(f'❌ Ошибка чтения файла уведомлений: {notifications_path}')
            except Exception as e:
                logger.error(f'❌ Ошибка загрузки сохраненных уведомлений: {str(e)}')
                logger.error(traceback.format_exc())
            
    except Exception as e:
        logger.error('❌ Ошибка присоединения к комнате')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())

@socketio.on('leave')
def handle_leave(data):
    """Обработчик выхода из комнаты"""
    try:
        chat_id = data.get('chat_id')
        user_info = data.get('user_info')
        
        if not chat_id or not user_info:
            logger.error('❌ Ошибка выхода из комнаты')
            logger.error('Отсутствуют обязательные данные')
            return
            
        room = f'inventory_{chat_id}'
        user_id = user_info.get('id')
        
        # Проверяем, есть ли пользователь в комнате
        if room not in active_users or user_id not in active_users[room]:
            logger.info('ℹ️ Пользователь не найден в комнате')
            return
            
        # Проверяем, совпадает ли socket_id
        if active_users[room][user_id].get('socket_id') != request.sid:
            logger.info('ℹ️ Запрос на выход с неактивного socket_id')
            return
        
        # Удаляем пользователя из комнаты
        leave_room(room)
        logger.info('👋 Пользователь покидает комнату')
        logger.info(f'👤 Сессия: {request.sid}')
        logger.info(f'🏠 Комната: {room}')
        
        # Удаляем информацию о пользователе
        del active_users[room][user_id]
        logger.info(f'✅ Удален пользователь {user_info.get("first_name")}')
        logger.info(f'👥 Осталось пользователей: {len(active_users[room])}')
        
        # Удаляем пустую комнату
        if not active_users[room]:
            del active_users[room]
            logger.info('🗑️ Комната удалена')
        
        # Оповещаем остальных
        emit('user_left', {
            'user': user_info,
            'active_users': list(active_users.get(room, {}).values())
        }, room=room)
        
        # Отправляем подтверждение
        emit('left', {
            'status': 'success',
            'room': room
        })
            
    except Exception as e:
        logger.error('❌ Ошибка выхода из комнаты')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())

@socketio.on('ping')
def handle_ping(data):
    try:
        logger.info(f'📡 Ping от {request.sid}')
        
        # Получаем комнаты пользователя
        user_rooms = rooms(request.sid)
        chat_rooms = [room for room in user_rooms if room != request.sid]
        
        # Обновляем активность
        for room in chat_rooms:
            if room in active_users:
                room_users = active_users[room]
                for user_id, user_info in room_users.items():
                    if user_info.get('socket_id') == request.sid:
                        user_info['last_activity'] = data.get('last_activity', datetime.now().isoformat())
                        logger.info(f'⏰ Обновлена активность в комнате {room}')
        
        emit('pong')
        
    except Exception as e:
        logger.error('❌ Ошибка обработки ping')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())

@app.route('/api/inventory/<chat_id>/active_users', methods=['GET'])
def get_active_users(chat_id):
    """Получение списка активных пользователей в инвентаре"""
    try:
        room = f'inventory_{chat_id}'
        users = list(active_users.get(room, {}).values())
        return jsonify(users)
    except Exception as e:
        logger.error(f'Error getting active users: {str(e)}')
        return jsonify({'error': str(e)}), 500

def broadcast_inventory_update(chat_id, inventory_data, skip_sid=None):
    """Отправляет обновление инвентаря всем клиентам в комнате"""
    try:
        room = f'inventory_{chat_id}'
        logger.info('=== 📢 Рассылка обновления инвентаря ===')
        logger.info(f'🏠 Комната: {room}')
        logger.info(f'🔄 Пропускаем отправителя: {skip_sid}')
        
        # Проверяем структуру данных инвентаря
        if inventory_data:
            if isinstance(inventory_data, dict):
                # Если это частичное обновление (item_update)
                if 'data' in inventory_data and inventory_data['data'].get('type') == 'item_update':
                    update_data = {
                        'source': inventory_data.get('source', 'server'),
                        'data': inventory_data['data']
                    }
                    logger.info('✏️ Отправка частичного обновления')
                    logger.info(f'📑 Товар: {update_data["data"].get("itemId")}')
                    logger.info(f'📑 Категория: {update_data["data"].get("category")}')
                    logger.info(f'📑 Тип обновления: {update_data["data"].get("notification", {}).get("type", "обновление")}')
                else:
                    # Если это полное обновление
                    logger.info('📦 Отправка полного обновления')
                    update_data = {
                        'source': inventory_data.get('source', 'server'),
                        'data': {
                            'inventory': inventory_data.get('inventory', {}),
                            'metadata': inventory_data.get('metadata', {}),
                            'notification': inventory_data.get('notification')
                        }
                    }
            else:
                logger.warning('⚠️ Неверный тип данных')
                return
        else:
            logger.info('ℹ️ Данные отсутствуют')
            return

        # Получаем список активных клиентов в комнате
        room_clients = active_users.get(room, {})
        logger.info(f'👥 Всего активных пользователей в комнате: {len(room_clients)}')
        
        # Логируем информацию о каждом пользователе
        for user_id, user_info in room_clients.items():
            logger.info(f'👤 Пользователь: {user_info.get("first_name")} (ID: {user_id})')
            logger.info(f'   Socket ID: {user_info.get("socket_id")}')
            logger.info(f'   Будет пропущен: {user_info.get("socket_id") == skip_sid}')

        if room_clients:
            # Отправляем обновление всем клиентам в комнате
            emit_kwargs = {'room': room}
            if skip_sid:
                emit_kwargs['skip_sid'] = skip_sid
                logger.info(f'⏭️ Пропускаем отправителя: {skip_sid}')

            socketio.emit('inventory_update', update_data, **emit_kwargs)
            logger.info('📨 Обновление отправлено в комнату')
            
            # Отправляем подтверждения
            sent_count = 0
            skipped_count = 0
            for user_id, user_info in room_clients.items():
                if not skip_sid or user_info.get('socket_id') != skip_sid:
                    try:
                        socketio.emit('inventory_update_sent', {
                            'status': 'success',
                            'timestamp': datetime.now().isoformat(),
                            'recipient': {
                                'id': user_id,
                                'name': user_info.get('first_name')
                            }
                        }, room=user_info.get('socket_id'))
                        sent_count += 1
                        logger.info(f'✅ Подтверждение отправлено: {user_info.get("first_name")} (Socket ID: {user_info.get("socket_id")})')
                    except Exception as e:
                        logger.error(f'❌ Ошибка отправки подтверждения для {user_info.get("first_name")}: {str(e)}')
                else:
                    skipped_count += 1
                    logger.info(f'⏭️ Пропущен пользователь: {user_info.get("first_name")} (Socket ID: {user_info.get("socket_id")})')
            
            logger.info(f'📊 Итого: отправлено {sent_count}, пропущено {skipped_count}')
        else:
            logger.info('ℹ️ Нет активных клиентов')
            
        logger.info('=== Рассылка завершена ===')
    except Exception as e:
        logger.error('❌ Ошибка рассылки обновления')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())

def broadcast_admin_update(chat_id, admin_data):
    """Отправляет обновление прав администратора всем клиентам в комнатах"""
    try:
        logger.info('=== 👑 Рассылка обновления прав администратора ===')
        logger.info(f'🏠 Чат: {admin_data.get("chat_title")}')
        logger.info(f'📝 ID чата: {chat_id}')
        logger.info(f'👥 Администраторов: {len(admin_data.get("admins", []))}')
        
        # Отправляем в общую комнату
        global_clients = active_users.get(GLOBAL_ROOM, {})
        logger.info(f'=== Отправка в общую комнату ===')
        logger.info(f'🌐 Комната: {GLOBAL_ROOM}')
        logger.info(f'👥 Активных пользователей: {len(global_clients)}')
        
        if global_clients:
            # Логируем информацию о каждом пользователе в комнате
            for user_id, user_info in global_clients.items():
                logger.info(f'👤 Пользователь в global: {user_info.get("first_name")} (ID: {user_id})')
                logger.info(f'   Socket ID: {user_info.get("socket_id")}')
            
            # Отправляем сообщение
            socketio.emit('admin_rights_update', {
                'chat_id': chat_id,
                'admins': admin_data['admins']
            }, room=GLOBAL_ROOM)
            logger.info('✅ Обновление отправлено в общую комнату')
        else:
            logger.warning('⚠️ Нет активных пользователей в общей комнате')
        
        # Отправляем в комнату чата
        chat_room = f'{CHAT_ROOM_PREFIX}{chat_id}'
        chat_clients = active_users.get(chat_room, {})
        logger.info(f'=== Отправка в комнату чата ===')
        logger.info(f'🏠 Комната: {chat_room}')
        logger.info(f'👥 Активных пользователей: {len(chat_clients)}')
        
        if chat_clients:
            # Логируем информацию о каждом пользователе в комнате чата
            for user_id, user_info in chat_clients.items():
                logger.info(f'👤 Пользователь в чате: {user_info.get("first_name")} (ID: {user_id})')
                logger.info(f'   Socket ID: {user_info.get("socket_id")}')
            
            # Отправляем сообщение
            socketio.emit('admin_rights_update', {
                'chat_id': chat_id,
                'admins': admin_data['admins']
            }, room=chat_room)
            logger.info('✅ Обновление отправлено в комнату чата')
        else:
            logger.warning('⚠️ Нет активных пользователей в комнате чата')
            
        logger.info('=== Рассылка завершена ===')
            
    except Exception as e:
        logger.error('❌ Ошибка рассылки обновления прав')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())

@app.route('/api/admin_update/<chat_id>', methods=['POST'])
def handle_admin_update(chat_id):
    """Обработка обновления прав администратора от бота"""
    try:
        logger.info('👑 Получено обновление прав администратора')
        logger.info(f'🏠 Чат: {chat_id}')
        
        data = request.get_json()
        logger.info(f'📝 Название чата: {data.get("chat_title")}')
        logger.info(f'👥 Администраторов: {len(data.get("admins", []))}')
        
        # Отправляем обновление через WebSocket
        logger.info('📨 Отправка обновления клиентам...')
        broadcast_admin_update(chat_id, data)
        
        logger.info('✅ Обновление обработано')
        return jsonify({'status': 'success'})
        
    except Exception as e:
        logger.error('❌ Ошибка обработки обновления прав')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@socketio.on('inventory_update')
def handle_inventory_update(data):
    """Обработчик WebSocket события обновления инвентаря"""
    try:
        logger.info('=== 📦 Получено обновление инвентаря ===')
        logger.info(f'👤 Отправитель (Socket ID): {request.sid}')

        if not data or not isinstance(data, dict):
            logger.error('❌ Некорректный формат данных')
            return

        update_data = data.get('data', {})
        chat_id = update_data.get('metadata', {}).get('chat_id')
        if not chat_id:
            logger.error('❌ Отсутствует ID чата')
            return

        # Загружаем текущий инвентарь
        inventory_path = get_inventory_path(chat_id)
        current_inventory = {}
        if os.path.exists(inventory_path):
            with open(inventory_path, 'r', encoding='utf-8') as f:
                current_inventory = json.load(f)
                logger.info('📂 Загружен текущий инвентарь')

        # Обработка обновления отдельного товара
        if update_data.get('type') == 'item_update':
            category = update_data.get('category')
            item_id = update_data.get('itemId')
            item = update_data.get('item')
            metadata = update_data.get('metadata')
            
            # Определяем тип изменения
            old_item = current_inventory.get('inventory', {}).get(category, {}).get(item_id, {})
            notification = {
                'type': 'update',
                'changes': []
            }
            
            # Проверяем изменения в сырье
            if old_item.get('raw', {}).get('quantity', 0) != item.get('raw', {}).get('quantity', 0):
                notification['changes'].append('raw_quantity')
            if old_item.get('raw', {}).get('filled') != item.get('raw', {}).get('filled'):
                notification['changes'].append('raw_filled')
                
            # Проверяем изменения в полуфабрикатах
            old_semifinished = old_item.get('semifinished')
            new_semifinished = item.get('semifinished')
            
            if old_semifinished is None and new_semifinished is not None:
                notification['type'] = 'add_semifinished'
            elif old_semifinished is not None and new_semifinished is None:
                notification['type'] = 'remove_semifinished'
            elif old_semifinished and new_semifinished:
                if old_semifinished.get('quantity', 0) != new_semifinished.get('quantity', 0):
                    notification['changes'].append('semifinished_quantity')
                if old_semifinished.get('filled') != new_semifinished.get('filled'):
                    notification['changes'].append('semifinished_filled')

            if category and item_id and item:
                logger.info('=== ✏️ Частичное обновление товара ===')
                logger.info(f'🏠 Чат: {chat_id}')
                logger.info(f'📑 Категория: {category}')
                logger.info(f'📦 Товар: {item_id}')
                logger.info(f'🔄 Тип изменения: {notification["type"]}')
                logger.info(f'📝 Изменения: {", ".join(notification["changes"])}')
                
                # Обновляем конкретный товар в инвентаре
                if 'inventory' not in current_inventory:
                    current_inventory['inventory'] = {}
                if category not in current_inventory['inventory']:
                    current_inventory['inventory'][category] = {}
                
                current_inventory['inventory'][category][item_id] = item
                current_inventory['metadata'] = metadata

                # Сохраняем обновленный инвентарь
                os.makedirs(os.path.dirname(inventory_path), exist_ok=True)
                with open(inventory_path, 'w', encoding='utf-8') as f:
                    json.dump(current_inventory, f, ensure_ascii=False, indent=2)
                logger.info('💾 Данные сохранены')

                # Обрабатываем запись истории если она есть
                if 'history' in data:
                    history_record = data['history']
                    logger.info('=== 📝 Обработка записи истории ===')
                    logger.info(f'🏠 Чат: {chat_id}')
                    logger.info(f'📦 Товар: {history_record.get("itemName")}')
                    logger.info(f'📊 Изменение: {history_record.get("oldQuantity")} -> {history_record.get("newQuantity")}')
                    
                    # Получаем данные о пользователе из активных пользователей
                    room = f'inventory_{chat_id}'
                    user_info = None
                    for user_id, info in active_users.get(room, {}).items():
                        if info.get('socket_id') == request.sid:
                            user_info = info
                            break
                    
                    # Добавляем информацию об авторе
                    if user_info:
                        history_record['author'] = {
                            'id': user_info.get('id'),
                            'first_name': user_info.get('first_name'),
                            'photo_url': user_info.get('photo_url')
                        }
                        logger.info(f'👤 Автор: {user_info.get("first_name")}')
                    
                    # Добавляем запись в историю
                    try:
                        item_history.add_record(chat_id, history_record)
                        logger.info('✅ Запись истории сохранена')
                        
                        # Отправляем обновление истории клиентам
                        socketio.emit('history_update', {
                            'chatId': chat_id,
                            'itemId': item_id,
                            'category': category,
                            'action': history_record.get('action'),
                            'type': history_record.get('type'),
                            'oldQuantity': history_record.get('oldQuantity'),
                            'newQuantity': history_record.get('newQuantity'),
                            'timestamp': datetime.now(pytz.UTC).isoformat()
                        }, room=f'inventory_{chat_id}')
                        logger.info('📢 Обновление истории разослано')
                    except Exception as e:
                        logger.error(f'❌ Ошибка сохранения истории: {str(e)}')
                        logger.error(traceback.format_exc())

                # Отправляем только обновление товара всем клиентам в комнате, кроме отправителя
                broadcast_data = {
                    'source': data.get('source', 'server'),
                    'data': {
                        'type': 'item_update',
                        'category': category,
                        'itemId': item_id,
                        'item': item,
                        'metadata': metadata,
                        'notification': notification
                    }
                }

                # Получаем список активных клиентов в комнате
                room = f'inventory_{chat_id}'
                room_clients = active_users.get(room, {})
                logger.info(f'👥 Активных пользователей в комнате: {len(room_clients)}')
                
                # Отправляем обновление всем клиентам в комнате, кроме отправителя
                socketio.emit('inventory_update', broadcast_data, room=room, skip_sid=request.sid)
                logger.info('📢 Частичное обновление разослано')

                # Отправляем подтверждения каждому клиенту
                for user_id, user_info in room_clients.items():
                    if user_info.get('socket_id') != request.sid:
                        try:
                            socketio.emit('inventory_update_sent', {
                                'status': 'success',
                                'timestamp': datetime.now().isoformat(),
                                'recipient': {
                                    'id': user_id,
                                    'name': user_info.get('first_name')
                                }
                            }, room=user_info.get('socket_id'))
                            logger.info(f'✅ Подтверждение отправлено: {user_info.get("first_name")} (Socket ID: {user_info.get("socket_id")})')
                        except Exception as e:
                            logger.error(f'❌ Ошибка отправки подтверждения: {str(e)}')
            else:
                logger.error('❌ Отсутствуют необходимые данные товара')
        else:
            # Полное обновление инвентаря
            if 'inventory' in update_data:
                logger.info('=== 📦 Полное обновление инвентаря ===')
                logger.info(f'🏠 Чат: {chat_id}')
                logger.info(f'📊 Категорий: {len(update_data["inventory"])}')
                
                current_inventory['inventory'] = update_data['inventory']
                current_inventory['metadata'] = update_data.get('metadata', {})
                
                # Сохраняем обновленный инвентарь
                os.makedirs(os.path.dirname(inventory_path), exist_ok=True)
                with open(inventory_path, 'w', encoding='utf-8') as f:
                    json.dump(current_inventory, f, ensure_ascii=False, indent=2)
                logger.info('💾 Данные сохранены')

                # Отправляем полное обновление всем клиентам
                broadcast_data = {
                    'source': data.get('source', 'server'),
                    'data': current_inventory
                }
                socketio.emit('inventory_update', broadcast_data, room=f'inventory_{chat_id}', skip_sid=request.sid)
                logger.info('📢 Полное обновление разослано')

    except Exception as e:
        logger.error('❌ Ошибка обработки обновления')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())

@socketio.on('inventory_notification')
def handle_inventory_notification(data):
    """Обработчик уведомлений инвентаря, например, предложений о добавлении товара"""
    try:
        logger.info('=== 📢 Получено уведомление инвентаря ===')
        logger.info(f'👤 Отправитель (Socket ID): {request.sid}')
        logger.info(f'📊 Данные: {json.dumps(data, ensure_ascii=False)}')
        
        if not data or not isinstance(data, dict):
            logger.error('❌ Некорректный формат данных уведомления')
            return
        
        target_chat_id = data.get('targetChatId')
        notification_data = data.get('data')
        
        if not target_chat_id or not notification_data:
            logger.error('❌ Отсутствуют необходимые данные уведомления')
            logger.error(f'target_chat_id: {target_chat_id}')
            logger.error(f'notification_data: {notification_data}')
            return
        
        # Комната для целевого чата
        room = f'inventory_{target_chat_id}'
        logger.info(f'🏠 Целевая комната: {room}')
        
        # Получаем сведения об отправителе
        sender_socket_id = request.sid
        sender_user_id = None
        if notification_data.get('source') and notification_data['source'].get('userId'):
            sender_user_id = notification_data['source']['userId']
            logger.info(f'👤 Отправитель (ID): {sender_user_id}')
        
        # Проверяем, что комната существует и в ней есть пользователи
        room_clients = active_users.get(room, {})
        logger.info(f'👥 Активных пользователей в целевой комнате: {len(room_clients)}')
        logger.info(f'👥 Все комнаты: {list(active_users.keys())}')
        logger.info(f'👥 Всего комнат: {len(active_users)}')
        
        # Проверяем, есть ли в комнате активные пользователи, кроме отправителя
        other_users_active = False
        if room_clients:
            # Фильтруем список пользователей, исключая отправителя
            active_recipients = [uid for uid, user in room_clients.items() 
                                if (sender_user_id is None or str(user.get('id')) != str(sender_user_id))]
            other_users_active = len(active_recipients) > 0
            logger.info(f'👥 Активных получателей (исключая отправителя): {len(active_recipients)}')
        
        # Сохраняем уведомление в базе данных независимо от наличия активных пользователей
        try:
            # Путь к файлу уведомлений
            chat_data_dir = DATA_DIR / 'chats' / target_chat_id
            chat_data_dir.mkdir(parents=True, exist_ok=True)
            notifications_path = chat_data_dir / 'notifications.json'
            
            logger.info(f'📁 Путь к директории уведомлений: {chat_data_dir}')
            logger.info(f'📁 Директория существует: {chat_data_dir.exists()}')
            logger.info(f'📄 Путь к файлу уведомлений: {notifications_path}')
            logger.info(f'📄 Файл уведомлений существует: {notifications_path.exists()}')
            
            # Загружаем существующие уведомления или создаем новый список
            notifications = []
            if notifications_path.exists():
                with open(notifications_path, 'r', encoding='utf-8') as f:
                    try:
                        notifications = json.load(f)
                        logger.info(f'📩 Загружено существующих уведомлений: {len(notifications)}')
                    except json.JSONDecodeError:
                        logger.error(f'❌ Ошибка чтения файла уведомлений: {notifications_path}')
                        notifications = []
            
            # Создаем ID уведомления если его нет
            if 'id' not in notification_data:
                notification_data['id'] = str(uuid.uuid4())
            
            # Добавляем уведомление в список
            notifications.append(notification_data)
            
            # Сохраняем обновленный список уведомлений
            with open(notifications_path, 'w', encoding='utf-8') as f:
                json.dump(notifications, f, ensure_ascii=False, indent=2)
                
            logger.info(f'💾 Уведомление сохранено для чата {target_chat_id}')
            logger.info(f'📩 Всего уведомлений после добавления: {len(notifications)}')
            
        except Exception as e:
            logger.error(f'❌ Ошибка сохранения уведомления: {str(e)}')
            logger.error(traceback.format_exc())
        
        # Пытаемся отправить уведомление онлайн-пользователям, если они есть
        if room_clients:
            # Отправляем уведомление всем пользователям в комнате
            socketio.emit('inventory_notification', notification_data, room=room)
            logger.info(f'📢 Уведомление отправлено в комнату {room}')
            
            # Отправляем подтверждение отправителю только если есть другие активные пользователи
            if other_users_active:
                socketio.emit('notification_sent', {
                    'status': 'success',
                    'type': notification_data.get('type'),
                    'targetChatId': target_chat_id,
                    'timestamp': datetime.now().isoformat(),
                    'recipients': len(active_recipients)
                }, room=sender_socket_id)
                
                # Логируем детали уведомления
                if notification_data.get('type') == 'item_suggestion':
                    logger.info(f'📦 Предложение товара: {notification_data.get("item", {}).get("itemId")}')
                    logger.info(f'📑 Категория: {notification_data.get("item", {}).get("category")}')
                    logger.info(f'👤 От пользователя: {notification_data.get("source", {}).get("userName")}')
            else:
                # Сообщаем отправителю, что нет других активных пользователей, только если отправитель не является 
                # пользователем этого чата (например, при кросс-чатовых уведомлениях)
                logger.warning(f'⚠️ В комнате {room} нет других активных пользователей, кроме отправителя')
                socketio.emit('notification_sent', {
                    'status': 'info',
                    'message': 'Уведомление сохранено, но в целевом чате сейчас нет других активных пользователей',
                    'targetChatId': target_chat_id,
                    'timestamp': datetime.now().isoformat(),
                    'recipients': 0
                }, room=sender_socket_id)
        else:
            # Если вообще нет активных пользователей, отправляем соответствующее уведомление
            logger.warning(f'⚠️ В комнате {room} нет активных пользователей')
            socketio.emit('notification_sent', {
                'status': 'info',
                'message': 'Уведомление сохранено, но в целевом чате нет активных пользователей',
                'targetChatId': target_chat_id,
                'timestamp': datetime.now().isoformat(),
                'recipients': 0
            }, room=sender_socket_id)
            
    except Exception as e:
        logger.error('❌ Ошибка обработки уведомления')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())
        
        # Отправляем ошибку отправителю
        socketio.emit('notification_sent', {
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }, room=request.sid)

@socketio.on('get_item_history')
def handle_get_item_history(data):
    """Обработчик WebSocket запроса на получение истории товара"""
    try:
        chat_id = data.get('chatId')
        category = data.get('category')
        item_name = data.get('itemName')
        
        if not all([chat_id, category, item_name]):
            logger.error('❌ Отсутствуют обязательные параметры для получения истории')
            return
        
        logger.info('=== 📋 Запрос истории товара ===')
        logger.info(f'🏠 Чат: {chat_id}')
        logger.info(f'📑 Категория: {category}')
        logger.info(f'📦 Товар: {item_name}')
        
        # Получаем историю
        history = item_history.get_item_history(chat_id, category, item_name)
        logger.info(f'📊 Найдено записей: {len(history)}')
        
        # Отправляем историю запросившему клиенту
        emit('item_history', {
            'chatId': chat_id,
            'category': category,
            'itemName': item_name,
            'history': history
        })
        logger.info('✅ История отправлена клиенту')
        
    except Exception as e:
        logger.error('❌ Ошибка получения истории')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())
        emit('error', {'message': str(e)})

# Эндпоинты для списаний
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
        "https://conference-henderson-falls-investigation.trycloudflare.com",
        "https://drum-converter-telephony-fireplace.trycloudflare.com",
        "https://workplace-cultures-guidelines-wins.trycloudflare.com",
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

def broadcast_write_off_update(chat_id, write_off_data, action, skip_sid=None):
    """Отправка уведомлений о изменениях списаний через WebSocket"""
    try:
        # Определяем тип события в зависимости от действия
        event_type = {
            'create': 'writeoff_created',
            'update': 'writeoff_updated',
            'delete': 'writeoff_deleted'
        }.get(action, 'writeoff_updated')
        
        room = f'inventory_{chat_id}'
        logger.info('=== 📢 Рассылка обновления списания ===')
        logger.info(f'🏠 Комната: {room}')
        logger.info(f'🔄 Действие: {action}')
        logger.info(f'🔄 Тип события: {event_type}')
        logger.info(f'🔄 Пропускаем отправителя: {skip_sid}')
        
        # Подготавливаем данные для отправки в зависимости от действия
        if action == 'create' or action == 'update':
            update_data = {
                'chatId': chat_id,
                'writeOffId': write_off_data.get('id'),
                'writeOffItem': write_off_data
            }
            logger.info(f'📝 ID списания: {write_off_data.get("id")}')
            logger.info(f'📝 Название: {write_off_data.get("name")}')
        elif action == 'delete':
            update_data = {
                'chatId': chat_id,
                'writeOffId': write_off_data.get('id')
            }
            logger.info(f'📝 ID удаляемого списания: {write_off_data.get("id")}')
        else:
            logger.warning(f'⚠️ Неизвестное действие: {action}')
            return

        # Получаем список активных клиентов в комнате
        room_clients = active_users.get(room, {})
        logger.info(f'👥 Всего активных пользователей в комнате: {len(room_clients)}')
        
        if room_clients:
            # Отправляем обновление всем клиентам в комнате
            emit_kwargs = {'room': room}
            if skip_sid:
                emit_kwargs['skip_sid'] = skip_sid
                logger.info(f'⏭️ Пропускаем отправителя: {skip_sid}')

            # Отправляем событие соответствующего типа
            socketio.emit(event_type, update_data, **emit_kwargs)
            logger.info(f'📨 Обновление списания ({action}) отправлено в комнату')
            
            # Отправляем подтверждения
            sent_count = 0
            skipped_count = 0
            for user_id, user_info in room_clients.items():
                if not skip_sid or user_info.get('socket_id') != skip_sid:
                    try:
                        socketio.emit('writeoff_update_sent', {
                            'status': 'success',
                            'action': action,
                            'timestamp': datetime.now().isoformat(),
                            'recipient': {
                                'id': user_id,
                                'name': user_info.get('first_name')
                            }
                        }, room=user_info.get('socket_id'))
                        sent_count += 1
                        logger.info(f'✅ Подтверждение отправлено: {user_info.get("first_name")} (Socket ID: {user_info.get("socket_id")})')
                    except Exception as e:
                        logger.error(f'❌ Ошибка отправки подтверждения для {user_info.get("first_name")}: {str(e)}')
                else:
                    skipped_count += 1
                    logger.info(f'⏭️ Пропущен пользователь: {user_info.get("first_name")} (Socket ID: {user_info.get("socket_id")})')
            
            logger.info(f'📊 Итого: отправлено {sent_count}, пропущено {skipped_count}')
        else:
            logger.info('ℹ️ Нет активных клиентов')
            
        logger.info('=== Рассылка завершена ===')
    except Exception as e:
        logger.error('❌ Ошибка рассылки обновления списания')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())

@socketio.on('writeoff_update')
def handle_writeoff_update(data):
    """Обработчик WebSocket события обновления списания"""
    try:
        logger.info('=== 📦 Получено обновление списания через WebSocket ===')
        logger.info(f'👤 Отправитель (Socket ID): {request.sid}')

        if not data or not isinstance(data, dict):
            logger.error('❌ Некорректный формат данных')
            return

        # Получаем основные данные
        action = data.get('action')  # create, update, delete
        chat_id = data.get('chatId')
        write_off_id = data.get('writeOffId')
        write_off_data = data.get('writeOffItem', {})

        if not chat_id:
            logger.error('❌ Отсутствует ID чата')
            return

        if not action:
            logger.error('❌ Отсутствует действие')
            return

        # Валидация данных в зависимости от действия
        if action == 'create':
            required_fields = ['name', 'reason', 'quantity']
            # Проверяем обязательные поля для создания
            if not all(field in write_off_data for field in required_fields):
                logger.error('❌ Не все обязательные поля заполнены')
                socketio.emit('writeoff_update_error', {
                    'status': 'error',
                    'message': 'Не все обязательные поля заполнены',
                    'action': action
                }, room=request.sid)
                return

            # Создаем новое списание
            try:
                new_write_off = add_write_off(chat_id, write_off_data)
                
                # Отправляем обновление всем клиентам в комнате
                broadcast_write_off_update(chat_id, new_write_off, 'create', request.sid)
                
                # Отправляем подтверждение отправителю
                socketio.emit('writeoff_update_sent', {
                    'status': 'success',
                    'action': 'create',
                    'chatId': chat_id,
                    'writeOffId': new_write_off.get('id'),
                    'writeOffItem': new_write_off
                }, room=request.sid)
                
                logger.info(f'✅ Списание успешно создано и отправлено')
            except Exception as e:
                logger.error(f'❌ Ошибка при создании списания: {str(e)}')
                socketio.emit('writeoff_update_error', {
                    'status': 'error',
                    'message': f'Ошибка при создании списания: {str(e)}',
                    'action': action
                }, room=request.sid)
                
        elif action == 'update':
            if not write_off_id:
                logger.error('❌ Отсутствует ID списания для обновления')
                socketio.emit('writeoff_update_error', {
                    'status': 'error',
                    'message': 'Отсутствует ID списания',
                    'action': action
                }, room=request.sid)
                return

            # Обновляем существующее списание
            try:
                updated_write_off = update_write_off(chat_id, write_off_id, write_off_data)
                
                if updated_write_off is None:
                    logger.error(f'❌ Списание {write_off_id} не найдено')
                    socketio.emit('writeoff_update_error', {
                        'status': 'error',
                        'message': 'Списание не найдено',
                        'action': action
                    }, room=request.sid)
                    return
                
                # Отправляем обновление всем клиентам в комнате
                broadcast_write_off_update(chat_id, updated_write_off, 'update', request.sid)
                
                # Отправляем подтверждение отправителю
                socketio.emit('writeoff_update_sent', {
                    'status': 'success',
                    'action': 'update',
                    'chatId': chat_id,
                    'writeOffId': write_off_id,
                    'writeOffItem': updated_write_off
                }, room=request.sid)
                
                logger.info(f'✅ Списание успешно обновлено и отправлено')
            except Exception as e:
                logger.error(f'❌ Ошибка при обновлении списания: {str(e)}')
                socketio.emit('writeoff_update_error', {
                    'status': 'error',
                    'message': f'Ошибка при обновлении списания: {str(e)}',
                    'action': action
                }, room=request.sid)
                
        elif action == 'delete':
            if not write_off_id:
                logger.error('❌ Отсутствует ID списания для удаления')
                socketio.emit('writeoff_update_error', {
                    'status': 'error',
                    'message': 'Отсутствует ID списания',
                    'action': action
                }, room=request.sid)
                return

            # Удаляем списание
            try:
                result = delete_write_off(chat_id, write_off_id)
                
                if not result:
                    logger.error(f'❌ Ошибка при удалении списания {write_off_id}')
                    socketio.emit('writeoff_update_error', {
                        'status': 'error',
                        'message': 'Ошибка при удалении списания',
                        'action': action
                    }, room=request.sid)
                    return
                
                # Отправляем обновление всем клиентам в комнате
                broadcast_write_off_update(chat_id, {'id': write_off_id}, 'delete', request.sid)
                
                # Отправляем подтверждение отправителю
                socketio.emit('writeoff_update_sent', {
                    'status': 'success',
                    'action': 'delete',
                    'chatId': chat_id,
                    'writeOffId': write_off_id
                }, room=request.sid)
                
                logger.info(f'✅ Списание успешно удалено и обновление отправлено')
            except Exception as e:
                logger.error(f'❌ Ошибка при удалении списания: {str(e)}')
                socketio.emit('writeoff_update_error', {
                    'status': 'error',
                    'message': f'Ошибка при удалении списания: {str(e)}',
                    'action': action
                }, room=request.sid)
        else:
            logger.error(f'❌ Неизвестное действие: {action}')
            socketio.emit('writeoff_update_error', {
                'status': 'error',
                'message': f'Неизвестное действие: {action}',
                'action': action
            }, room=request.sid)
            
    except Exception as e:
        logger.error('❌ Ошибка обработки обновления списания')
        logger.error(f'Описание: {str(e)}')
        logger.error(traceback.format_exc())
        
        # Отправляем сообщение об ошибке отправителю
        try:
            socketio.emit('writeoff_update_error', {
                'status': 'error',
                'message': f'Внутренняя ошибка сервера: {str(e)}'
            }, room=request.sid)
        except:
            pass

@app.route('/api/write-offs/generate-document', methods=['GET', 'POST'])
def generate_write_off_document():
    """Генерация DOCX файла акта списания"""
    return _generate_write_off_document_internal()

@app.route('/api/writeoffs/generate-document', methods=['GET', 'POST'])
def generate_write_off_document_compat():
    """Совместимый эндпоинт для генерации DOCX файла акта списания (без дефиса)"""
    logger.info("Вызов совместимого эндпоинта /api/writeoffs/generate-document")
    return _generate_write_off_document_internal()

if __name__ == '__main__':
    try:
        HOST = os.getenv('HOST', '0.0.0.0')
        PORT = int(os.getenv('PORT', 8000))
        
        # Запуск приложения через socketio для поддержки WebSocket
        print(f"\n🚀 Starting server on {HOST}:{PORT}...")
        socketio.run(app, host=HOST, port=PORT, debug=True, use_reloader=True, log_output=True)
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        print(f"❌ Error starting server: {str(e)}")
        sys.exit(1)
