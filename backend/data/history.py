"""
Модуль для работы с историей изменений товаров
"""
import os
import json
import uuid
import logging
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

import pytz

# Используем логгер из config, если доступен, иначе создаем локальный
try:
    from config import logger
except ImportError:
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)

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