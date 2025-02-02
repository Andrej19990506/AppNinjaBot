from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import json
from datetime import datetime
import os
from pathlib import Path
import logging
import traceback
import asyncio
from telegram import Bot
from telegramNinjaBot.config.config import Config
import requests
from io import BytesIO
from asgiref.sync import async_to_sync

# Настраиваем логирование
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Настройки CORS
cors = CORS(
    app,
    origins=["*"],  # Разрешаем все домены для тестирования
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=True,
    intercept_exceptions=False
)

# Инициализируем бота
config = Config()
bot = Bot(token=config.TOKEN)

@app.before_request
def log_request_info():
    logger.debug('Headers: %s', dict(request.headers))
    logger.debug('Body: %s', request.get_data())

@app.after_request
def log_response_info(response):
    logger.debug('Response Headers: %s', dict(response.headers))
    return response

# Абсолютные пути к директориям
BASE_DIR = Path('/app')
DATA_DIR = BASE_DIR / 'data'  # будет /app/data
TEMPLATES_DIR = DATA_DIR / 'templates'  # будет /app/data/templates
INVENTORY_DIR = DATA_DIR / 'inventory'  # будет /app/data/inventory

# Создаем директории при запуске
for directory in [DATA_DIR, TEMPLATES_DIR, INVENTORY_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Используем существующий шаблон
TEMPLATE_PATH = TEMPLATES_DIR / 'inventory_template.json'
if not TEMPLATE_PATH.exists():
    # Копируем шаблон из исходного файла
    SOURCE_TEMPLATE = BASE_DIR / 'data' / 'templates' / 'inventory_template.json'
    if SOURCE_TEMPLATE.exists():
        import shutil
        shutil.copy(SOURCE_TEMPLATE, TEMPLATE_PATH)
        logger.info(f"Template copied from {SOURCE_TEMPLATE}")
    else:
        logger.error(f"Template file not found at {SOURCE_TEMPLATE}")
        raise FileNotFoundError(f"Template file not found at {SOURCE_TEMPLATE}")

logger.info(f"Data directories created: {DATA_DIR}")
logger.info(f"Template exists: {TEMPLATE_PATH.exists()}")

# Пути к файлам
BOT_DATA_DIR = '/app/telegramNinjaBot/data'  # Абсолютный путь к данным бота
os.makedirs(BOT_DATA_DIR, exist_ok=True)  # Создаем директорию для данных бота

def get_inventory_path(chat_id):
    return os.path.join(INVENTORY_DIR, f'inventory_{chat_id}.json')

def load_bot_data(filename):
    try:
        file_path = os.path.join(BOT_DATA_DIR, filename)
        logger.debug(f"Trying to load file: {file_path}")
        logger.debug(f"Current working directory: {os.getcwd()}")
        logger.debug(f"Directory contents: {os.listdir(BOT_DATA_DIR)}")
        logger.debug(f"File exists: {os.path.exists(file_path)}")
        
        if os.path.exists(file_path):
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

async def get_file_url(file_id):
    try:
        file = await bot.get_file(file_id)
        # Получаем полный URL файла
        return file.file_path
    except Exception as e:
        logger.error(f"Error getting file URL: {str(e)}")
        return None

def get_bot_token():
    return config.TOKEN

@app.route('/api/photo/<path:photo_id>')
def get_photo(photo_id):
    try:
        # Проверяем, является ли это локальной фотографией
        if photo_id.startswith('local:'):
            user_id = photo_id.split(':')[1]
            photo_path = os.path.join(BOT_DATA_DIR, 'photos', f'user_{user_id}.jpg')
            if os.path.exists(photo_path):
                return send_file(photo_path, mimetype='image/jpeg')
            else:
                logger.error(f"Локальная фотография не найдена: {photo_path}")
                return jsonify({'error': 'Photo not found'}), 404
        
        # Если это не локальная фотография, получаем через Telegram API
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        file_url = loop.run_until_complete(get_file_url(photo_id))
        loop.close()

        if not file_url:
            return jsonify({'error': 'Could not get photo URL'}), 404
            
        response = requests.get(file_url)
        
        if response.status_code == 200:
            return send_file(
                BytesIO(response.content),
                mimetype='image/jpeg'
            )
        logger.error(f"Failed to download photo. Status code: {response.status_code}")
        return jsonify({'error': 'Could not download photo'}), 404
    except Exception as e:
        logger.error(f"Error serving photo: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chats', methods=['GET'])
def get_chats():
    try:
        logger.info("Getting chats...")
        members_data = load_bot_data('members.json')
        admins_data = load_bot_data('admins.json')
        
        chats = []
        for chat_id, chat_data in members_data.items():
            chat_admins = admins_data.get(str(chat_id), {}).get('admins', [])
            
            # Обрабатываем фотографии участников
            members = chat_data.get('members', [])
            for member in members:
                if member.get('photo_url'):
                    file_id = member['photo_url']
                    member['photo_url'] = f"/api/photo/{file_id}"
            
            chat_info = {
                'id': str(chat_id),
                'name': chat_data['chat_title'],
                'members_count': chat_data.get('total_count', 0),
                'members': members,
                'admins': chat_admins,
                'last_inventory': None
            }
            
            inventory_path = get_inventory_path(chat_id)
            if os.path.exists(inventory_path):
                with open(inventory_path, 'r', encoding='utf-8') as f:
                    inventory_data = json.load(f)
                    chat_info['last_inventory'] = inventory_data.get('lastUpdated')
            
            chats.append(chat_info)
        
        return jsonify(chats)
    except Exception as e:
        logger.error(f"Error in get_chats: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/template', methods=['GET'])
def get_inventory_template():
    try:
        template_path = os.path.join(TEMPLATES_DIR, 'inventory_template.json')
        if not os.path.exists(template_path):
            # Если файла нет - создаем базовый шаблон
            default_template = {
                "Соусы": {},
                "Специи и приправы": {},
                "Овощи и зелень": {},
                "Мясо и рыба": {},
                "Молочные продукты": {},
                "Заготовки": {},
                "Десерты": {},
                "Масла и заправки": {}
            }
            with open(template_path, 'w', encoding='utf-8') as f:
                json.dump(default_template, f, ensure_ascii=False, indent=2)
            
        with open(template_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/inventory/<chat_id>', methods=['GET'])
def get_chat_inventory(chat_id):
    try:
        inventory_path = os.path.join(INVENTORY_DIR, f'{chat_id}.json')
        
        if not os.path.exists(inventory_path):
            # Читаем шаблон из data/templates
            template_path = os.path.join(TEMPLATES_DIR, 'inventory_template.json')
            logger.info(f"Loading template from {template_path}")
            
            try:
                with open(template_path, 'r', encoding='utf-8') as f:
                    template = json.load(f)
                    # Сразу сохраняем шаблон как инвентарь для этого чата
                    with open(inventory_path, 'w', encoding='utf-8') as inv_file:
                        json.dump(template, inv_file, ensure_ascii=False, indent=2)
                    logger.info(f"Created new inventory from template for chat {chat_id}")
                    return jsonify(template)
            except Exception as e:
                logger.error(f"Error loading template: {str(e)}")
                raise
                
        # Если инвентарь существует - возвращаем его
        with open(inventory_path, 'r', encoding='utf-8') as f:
            inventory = json.load(f)
            logger.info(f"Loaded existing inventory for chat {chat_id}")
            return jsonify(inventory)
            
    except Exception as e:
        logger.error(f"Error in get_chat_inventory: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/inventory/<chat_id>', methods=['POST'])
def save_inventory(chat_id):
    try:
        data = request.get_json()
        inventory = data.get('inventory')
        
        if not inventory:
            return jsonify({'error': 'No inventory data provided'}), 400
            
        # Сохраняем инвентарь
        inventory_path = os.path.join(INVENTORY_DIR, f'{chat_id}.json')
        
        # Добавляем метаданные если их нет
        if isinstance(inventory, dict) and not inventory.get('lastUpdated'):
            inventory['lastUpdated'] = datetime.now().isoformat()
            
        with open(inventory_path, 'w', encoding='utf-8') as file:
            json.dump(inventory, file, ensure_ascii=False, indent=2)
            logger.info(f"Saved inventory for chat {chat_id}")
            
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error saving inventory: {str(e)}")
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
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        count = data.get('count', 100)
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
            
        love_messages = [
            "Анастасия, ты моё солнышко ❤️",
            "Настенька, ты моя радость ❤️",
            "Настя, ты самая прекрасная ❤️",
            "Анастасия, ты украла моё сердце ❤️",
            "Настенька, ты моя мечта ❤️",
            "Анастасия, ты моё вдохновение ❤️",
            "Настя, ты моя любовь ❤️",
            "Анастасия, ты моя жизнь ❤️",
            "Настенька, ты моё счастье ❤️",
            "Анастасия, ты моя вселенная ❤️"
        ]
        
        # Создаем и запускаем асинхронную задачу
        async def send_messages():
            for i in range(count):
                message = f"{i+1}. {love_messages[i % len(love_messages)]}"
                await bot.send_message(chat_id=user_id, text=message)
                logger.info(f"Отправлено сообщение {i+1} пользователю {user_id}: {message}")
        
        # Запускаем асинхронную задачу
        asyncio.run(send_messages())
        return jsonify({'status': 'success', 'message': f'Отправлено {count} сообщений'})
            
    except Exception as e:
        logger.error(f"Error sending love messages: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
