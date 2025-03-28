from flask import Blueprint, jsonify
import json
from pathlib import Path
import logging

logger = logging.getLogger('TelegramRoutes')

telegram_bp = Blueprint('telegram', __name__)

@telegram_bp.route('/api/telegram/courier-chats', methods=['GET'])
def get_courier_chats():
    """Получение списка только курьерских чатов"""
    try:
        # Путь к файлу с данными о чатах
        data_dir = Path(__file__).parent.parent / 'data'
        members_file = data_dir / 'members.json'
        
        if not members_file.exists():
            logger.warning("Файл с данными о чатах не найден")
            return jsonify([])
            
        with open(members_file, 'r', encoding='utf-8') as f:
            members_data = json.load(f)
            
        # Фильтруем только курьерские чаты
        courier_chats = [
            {
                'chat_id': chat_id,
                'chat_title': chat_data.get('chat_title', f'Чат {chat_id}')
            }
            for chat_id, chat_data in members_data.items()
            if chat_data.get('is_courier_chat', False)  # Проверяем, что это курьерский чат
        ]
        
        logger.info(f"Найдено {len(courier_chats)} курьерских чатов")
        return jsonify(courier_chats)
        
    except Exception as e:
        logger.error(f"Ошибка при получении списка курьерских чатов: {str(e)}")
        return jsonify({'error': str(e)}), 500 