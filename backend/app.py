from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import json
from datetime import datetime
import os
from pathlib import Path
import logging
import traceback
import requests
from io import BytesIO

# Настраиваем логирование
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Настройки CORS и базовый URL
cors = CORS(
    app,
    origins=["*"],  # Разрешаем все домены для тестирования
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=True,
    intercept_exceptions=False
)

# Базовый URL для API
BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')
BOT_URL = os.getenv('BOT_URL', 'http://bot:8001')

# Абсолютные пути к директориям
APP_DIR = Path('/app')  # Корневая директория приложения
DATA_DIR = APP_DIR / 'data'  # /app/data
TEMPLATES_DIR = DATA_DIR / 'templates'  # /app/data/templates
INVENTORY_DIR = DATA_DIR / 'inventory'  # /app/data/inventory
BOT_DATA_DIR = APP_DIR / 'telegramNinjaBot' / 'data'  # Путь к данным бота

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
    return str(INVENTORY_DIR / f'inventory_{chat_id}.json')

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
        response = requests.get(f"{BOT_URL}/api/photo/{photo_id}")
        if response.status_code == 200:
            return send_file(
                BytesIO(response.content),
                mimetype='image/jpeg'
            )
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
                    photo_url = member.get('photo_url')
                    # Проверяем наличие локальной фотографии
                    if user_id not in existing_photos and photo_url and photo_url.startswith('local:'):
                        # Если фотографии нет, но указана как локальная, сбрасываем photo_url
                        logger.warning(f"Отсутствует локальная фотография для пользователя {user_id}, сбрасываем photo_url")
                        member['photo_url'] = None
                    
                    # Формируем URL для фотографии (используем относительный путь)
                    if photo_url:
                        member['photo_url'] = f"/api/photo/{photo_url}"
                        logger.info(f"Сформирован URL фотографии: {member['photo_url']}")
            
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
        for chat_id, chat_data in members_data.items():
            members = chat_data.get('members', [])
            chat_data['members'] = members
        
        with open(os.path.join(BOT_DATA_DIR, 'members.json'), 'w', encoding='utf-8') as f:
            json.dump(members_data, f, ensure_ascii=False, indent=2)
        
        return jsonify(chats)
    except Exception as e:
        logger.error(f"Ошибка в функции get_chats: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/templates/inventory_template', methods=['GET', 'POST', 'PATCH'])
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

@app.route('/api/inventory/<chat_id>', methods=['GET'])
def get_chat_inventory(chat_id):
    try:
        logger.info(f"Получение инвентаря для чата {chat_id}")
        inventory_path = get_inventory_path(chat_id)
        
        if os.path.exists(inventory_path):
            with open(inventory_path, 'r', encoding='utf-8') as f:
                inventory_data = json.load(f)
                logger.info(f"Загружен инвентарь для чата {chat_id}")
                
                # Проверяем структуру данных
                if isinstance(inventory_data, dict):
                    # Если есть вложенный inventory
                    if 'inventory' in inventory_data:
                        inventory_content = inventory_data['inventory']
                        metadata = inventory_data.get('metadata', {
                            'lastUpdated': datetime.now().isoformat(),
                            'progress': 0
                        })
                    else:
                        # Если нет вложенного inventory, считаем что это сам инвентарь
                        inventory_content = inventory_data
                        metadata = {
                            'lastUpdated': datetime.now().isoformat(),
                            'progress': 0
                        }
                    
                    # Проверяем метаданные
                    if not metadata.get('lastUpdated'):
                        metadata['lastUpdated'] = datetime.now().isoformat()
                    if not isinstance(metadata.get('progress'), (int, float)):
                        metadata['progress'] = 0
                    
                    return jsonify({
                        'inventory': inventory_content,
                        'metadata': metadata
                    })
        
        # Если инвентарь не найден, возвращаем шаблон
        if os.path.exists(TEMPLATE_PATH):
            with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                template = json.load(f)
                logger.info(f"Возвращаем шаблон инвентаря для чата {chat_id}")
                
                # Создаем копию шаблона, сохраняя структуру
                new_inventory = {}
                for category, items in template.items():
                    new_inventory[category] = {}
                    for item_name, item_data in items.items():
                        new_inventory[category][item_name] = {}
                        
                        # Копируем raw тип
                        if 'raw' in item_data:
                            new_inventory[category][item_name]['raw'] = {
                                'quantity': 0,
                                'filled': False
                            }
                        
                        # Копируем semifinished тип, если он есть в шаблоне
                        if 'semifinished' in item_data:
                            new_inventory[category][item_name]['semifinished'] = {
                                'quantity': 0,
                                'filled': False
                            }
                
                return jsonify({
                    'inventory': new_inventory,
                    'metadata': {
                        'lastUpdated': datetime.now().isoformat(),
                        'progress': 0
                    }
                })
        
        return jsonify({'error': 'Inventory template not found'}), 404
        
    except Exception as e:
        logger.error(f"Ошибка при получении инвентаря для чата {chat_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/<chat_id>', methods=['POST'])
def save_chat_inventory(chat_id):
    try:
        logger.info(f"Сохранение инвентаря для чата {chat_id}")
        data = request.get_json()
        
        if not data or not isinstance(data.get('inventory'), dict):
            return jsonify({'error': 'Invalid inventory data'}), 400
            
        inventory_path = get_inventory_path(chat_id)
        
        # Загружаем старый инвентарь для сравнения
        old_inventory = {}
        if os.path.exists(inventory_path):
            with open(inventory_path, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
                old_inventory = old_data.get('inventory', {})
        
        # Находим удаленные товары
        new_inventory = data.get('inventory', {})
        deleted_items = []
        
        for category in old_inventory:
            if category in new_inventory:
                # Проверяем удаленные товары в существующих категориях
                for item in old_inventory[category]:
                    if item not in new_inventory[category]:
                        # Проверяем, нет ли уже активного запроса на удаление этого товара
                        has_active_request = False
                        for deletion_id, request_data in deletion_requests.items():
                            item_data = request_data.get('data', {})
                            if (item_data.get('category') == category and 
                                item_data.get('item') == item):
                                has_active_request = True
                                break
                        
                        if has_active_request:
                            # Если есть активный запрос, отменяем удаление и возвращаем ошибку
                            return jsonify({
                                'error': 'deletion_in_progress',
                                'message': f'Товар "{item}" уже находится в процессе удаления',
                                'item': item,
                                'category': category
                            }), 409
                        
                        deleted_items.append({
                            'category': category,
                            'item': item
                        })
            else:
                # Если категория удалена, проверяем все её товары
                for item in old_inventory[category]:
                    # Проверяем, нет ли уже активного запроса на удаление
                    has_active_request = False
                    for deletion_id, request_data in deletion_requests.items():
                        item_data = request_data.get('data', {})
                        if (item_data.get('category') == category and 
                            item_data.get('item') == item):
                            has_active_request = True
                            break
                    
                    if has_active_request:
                        # Если есть активный запрос, отменяем удаление и возвращаем ошибку
                        return jsonify({
                            'error': 'deletion_in_progress',
                            'message': f'Товар "{item}" уже находится в процессе удаления',
                            'item': item,
                            'category': category
                        }), 409
                    
                    deleted_items.append({
                        'category': category,
                        'item': item
                    })
        
        # Проверяем и очищаем данные перед сохранением
        cleaned_inventory = {}
        for category, items in new_inventory.items():
            cleaned_inventory[category] = {}
            for item_name, item_data in items.items():
                cleaned_inventory[category][item_name] = {
                    'raw': {
                        'quantity': item_data.get('raw', {}).get('quantity', 0),
                        'filled': bool(item_data.get('raw', {}).get('quantity', 0) > 0)
                    }
                }
                # Добавляем semifinished только если он уже существует и имеет quantity
                if 'semifinished' in item_data and item_data['semifinished'].get('quantity', 0) > 0:
                    cleaned_inventory[category][item_name]['semifinished'] = {
                        'quantity': item_data['semifinished']['quantity'],
                        'filled': True
                    }
        
        # Сохраняем очищенные данные
        cleaned_data = {
            'inventory': cleaned_inventory,
            'metadata': data.get('metadata', {
                'lastUpdated': datetime.now().isoformat(),
                'progress': 0
            })
        }
        
        with open(inventory_path, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Инвентарь для чата {chat_id} успешно сохранен")
        
        # Создаем запросы на удаление для каждого товара
        if deleted_items:
            try:
                # Получаем название филиала
                members_data = load_bot_data('members.json')
                branch_name = members_data.get(chat_id, {}).get('chat_title', 'Неизвестный филиал')
                
                # Создаем запросы на удаление для каждого товара
                for deleted_item in deleted_items:
                    # Создаем короткий уникальный ID для запроса на удаление
                    timestamp = datetime.now().strftime('%H%M%S')
                    deletion_id = f"{chat_id[-4:]}_{timestamp}"
                    
                    # Формируем данные запроса
                    deletion_data = {
                        'deletion_id': deletion_id,
                        'branch_name': branch_name,
                        'chat_id': chat_id,
                        'category': deleted_item['category'],
                        'item': deleted_item['item'],
                        'timestamp': datetime.now().isoformat(),
                        'status': 'pending'
                    }
                    
                    # Отправляем запрос боту через HTTP
                    response = requests.post(f"{BOT_URL}/api/notify_deletion", json=deletion_data)
                    
                    if response.status_code == 200:
                        # Получаем ID сообщения инициатора из ответа
                        result = response.json()
                        deletion_requests[deletion_id] = {
                            'confirmations': {
                                chat_id: True  # Автоматически подтверждаем от инициатора
                            },
                            'data': deletion_data,
                            'initiator_message_id': result.get('initiator_message_id')
                        }
                        logger.info(f"Запрос на удаление успешно отправлен боту")
                    else:
                        logger.error(f"Ошибка при отправке запроса боту: {response.status_code}")
                        logger.error(f"Ответ сервера: {response.text}")
                    
            except Exception as e:
                logger.error(f"Ошибка при отправке запроса на подтверждение удаления: {str(e)}")
                logger.error(traceback.format_exc())
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        logger.error(f"Ошибка при сохранении инвентаря для чата {chat_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/<chat_id>/status', methods=['GET'])
def get_inventory_status(chat_id):
    try:
        inventory_path = get_inventory_path(chat_id)
        
        if not os.path.exists(inventory_path):
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
        
        for category in inventory.values():
            for item in category.values():
                for type_data in item.values():
                    total_items += 1
                    if type_data.get('filled', False):
                        filled_items += 1
                        
        progress = round((filled_items / total_items * 100) if total_items > 0 else 0)
        
        return jsonify({
            'exists': True,
            'progress': progress,
            'lastUpdated': data.get('lastUpdated')
        })
    except Exception as e:
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

@app.route('/api/notify/item_deleted', methods=['POST'])
def notify_item_deleted():
    """Обработка запроса уведомления об удалении к боту"""
    try:
        # Просто возвращаем успешный статус, так как уведомление 
        # уже было отправлено при сохранении инвентаря
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"Ошибка при обработке уведомления: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Глобальные переменные
deletion_requests = {}

@app.route('/api/confirm_deletion', methods=['POST'])
def confirm_deletion():
    """Обработка подтверждения удаления товара"""
    try:
        data = request.get_json()
        logger.info(f"=== Получено подтверждение удаления ===")
        logger.info(f"Данные запроса: {data}")
        
        deletion_id = data.get('deletion_id')
        chat_id = data.get('chat_id')
        confirmed = data.get('confirmed', False)
        
        if not deletion_id or not chat_id:
            logger.error("Отсутствуют обязательные поля")
            return jsonify({'error': 'Missing required fields'}), 400
            
        logger.info(f"Текущие запросы на удаление: {deletion_requests}")
        
        # Получаем существующий запрос или создаем новый
        deletion_request = deletion_requests.get(deletion_id)
        if not deletion_request:
            logger.info(f"Создаем новый запрос на удаление {deletion_id}")
            deletion_request = {
                'confirmations': {},
                'data': data,
                'initiator_message_id': None
            }
            deletion_requests[deletion_id] = deletion_request
            
        # Сохраняем подтверждение
        deletion_request['confirmations'][chat_id] = confirmed
        logger.info(f"Сохранено подтверждение от чата {chat_id}: {confirmed}")
        logger.info(f"Текущие подтверждения: {deletion_request['confirmations']}")

        # Если филиал подтвердил удаление, удаляем товар из его текущей инвентаризации
        if confirmed:
            try:
                item_data = deletion_request['data']
                category = item_data['category']
                item = item_data['item']
                
                # Путь к файлу инвентаризации филиала
                inventory_path = get_inventory_path(chat_id)
                logger.info(f"Путь к файлу инвентаризации: {inventory_path}")
                
                if os.path.exists(inventory_path):
                    with open(inventory_path, 'r', encoding='utf-8') as f:
                        inventory_data = json.load(f)
                        logger.info(f"Загружены данные инвентаризации: {inventory_data}")
                    
                    # Удаляем товар из инвентаризации филиала
                    if 'inventory' in inventory_data:
                        inventory = inventory_data['inventory']
                        if category in inventory and item in inventory[category]:
                            del inventory[category][item]
                            logger.info(f"Товар {item} удален из категории {category}")
                            # Если категория пуста, удаляем её
                            if not inventory[category]:
                                del inventory[category]
                                logger.info(f"Категория {category} удалена, так как стала пустой")
                            
                            # Сохраняем обновленную инвентаризацию
                            with open(inventory_path, 'w', encoding='utf-8') as f:
                                json.dump(inventory_data, f, ensure_ascii=False, indent=2)
                            
                            logger.info(f"Товар {item} успешно удален из инвентаризации филиала {chat_id}")
                        else:
                            logger.warning(f"Товар {item} не найден в категории {category} инвентаризации филиала {chat_id}")
                    else:
                        logger.warning(f"Структура inventory не найдена в данных филиала {chat_id}")
                else:
                    logger.warning(f"Файл инвентаризации не найден: {inventory_path}")
                    # Загружаем шаблон
                    with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                        template = json.load(f)
                        logger.info(f"Загружен шаблон инвентаря")
                    
                    # Создаем новый файл инвентаризации на основе шаблона
                    inventory_data = {
                        'inventory': template,
                        'metadata': {
                            'lastUpdated': datetime.now().isoformat(),
                            'progress': 0
                        }
                    }
                    # Создаем директорию, если её нет
                    os.makedirs(os.path.dirname(inventory_path), exist_ok=True)
                    with open(inventory_path, 'w', encoding='utf-8') as f:
                        json.dump(inventory_data, f, ensure_ascii=False, indent=2)
                    logger.info(f"Создан новый файл инвентаризации для филиала {chat_id} на основе шаблона")
                    
                    # Удаляем товар из нового инвентаря
                    if category in template and item in template[category]:
                        del inventory_data['inventory'][category][item]
                        logger.info(f"Товар {item} удален из нового инвентаря")
                        
                        # Если категория пуста, удаляем её
                        if not inventory_data['inventory'][category]:
                            del inventory_data['inventory'][category]
                            logger.info(f"Категория {category} удалена, так как стала пустой")
                        
                        # Сохраняем обновленный инвентарь
                        with open(inventory_path, 'w', encoding='utf-8') as f:
                            json.dump(inventory_data, f, ensure_ascii=False, indent=2)
                        logger.info(f"Обновленный инвентарь сохранен")
            except Exception as e:
                logger.error(f"Ошибка при удалении товара из инвентаря филиала {chat_id}: {str(e)}")
                logger.error(traceback.format_exc())
        
        # Проверяем, все ли чаты подтвердили удаление
        members_data = load_bot_data('members.json')
        all_chats = set(members_data.keys())
        responded_chats = set(deletion_request['confirmations'].keys())
        
        logger.info(f"Все чаты: {all_chats}")
        logger.info(f"Ответившие чаты: {responded_chats}")
        
        if all_chats == responded_chats:
            # Все чаты ответили, проверяем результат
            all_confirmed = all(deletion_request['confirmations'].values())
            logger.info(f"Все чаты ответили, результат: {'подтверждено' if all_confirmed else 'отклонено'}")
            
            if all_confirmed:
                # Удаляем товар из шаблона
                item_data = deletion_request['data']
                category = item_data['category']
                item = item_data['item']
                
                logger.info(f"Удаляем товар {item} из категории {category}")
                
                with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                    template = json.load(f)
                
                if category in template and item in template[category]:
                    del template[category][item]
                    
                    # Если категория пуста, удаляем её
                    if not template[category]:
                        del template[category]
                    
                    with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
                        json.dump(template, f, ensure_ascii=False, indent=2)
                    
                    logger.info(f"Товар {item} успешно удален из шаблона")
                
                return jsonify({
                    'status': 'success',
                    'message': 'Item deleted from template',
                    'all_confirmed': True
                })
            else:
                return jsonify({
                    'status': 'cancelled',
                    'message': 'Deletion cancelled - not all branches confirmed',
                    'all_confirmed': False
                })
        
        # Еще не все ответили
        logger.info("Ожидаем ответа от остальных чатов")
        return jsonify({
            'status': 'pending',
            'message': 'Confirmation recorded'
        })
        
    except Exception as e:
        logger.error(f"Ошибка при обработке подтверждения удаления: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/deletion_request/<deletion_id>', methods=['GET'])
async def get_deletion_request(deletion_id):
    """Получение данных о запросе на удаление"""
    try:
        if deletion_id not in deletion_requests:
            # Если запрос не найден, возвращаем последние данные
            return jsonify({
                'status': 'completed',
                'message': 'Request completed and removed'
            }), 200
            
        deletion_request = deletion_requests[deletion_id]
        logger.info(f"Возвращаем данные запроса: {deletion_request}")
        
        # Формируем ответ с сохранением initiator_message_id
        response_data = {
            'data': deletion_request['data'],
            'confirmations': deletion_request['confirmations'],
            'initiator_message_id': deletion_request.get('initiator_message_id')
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Ошибка при получении данных о запросе на удаление: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/check_item_deletion_status', methods=['POST'])
def check_item_deletion_status():
    """Проверка статуса товара на наличие активных запросов на удаление"""
    try:
        data = request.get_json()
        if not all(key in data for key in ['category', 'item']):
            return jsonify({'error': 'Missing required fields'}), 400
            
        category = data['category']
        item = data['item']
        
        # Проверяем все активные запросы на удаление
        for deletion_id, request_data in deletion_requests.items():
            request_info = request_data.get('data', {})
            if (request_info.get('category') == category and 
                request_info.get('item') == item):
                # Нашли активный запрос на удаление этого товара
                return jsonify({
                    'has_active_request': True,
                    'request_info': {
                        'branch_name': request_info.get('branch_name'),
                        'chat_id': request_info.get('chat_id'),
                        'timestamp': request_info.get('timestamp')
                    }
                })
        
        # Активных запросов не найдено
        return jsonify({
            'has_active_request': False
        })
        
    except Exception as e:
        logger.error(f"Ошибка при проверке статуса товара: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
