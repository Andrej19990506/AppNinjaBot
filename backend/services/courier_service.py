import os
import json
from pathlib import Path
import logging
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class CourierService:
    def __init__(self):
        self.data_dir = Path('/app/data/courier_groups')
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.data_dir / 'index.json'
        self._ensure_index_file()

    def _ensure_index_file(self):
        """Создает индексный файл, если он не существует"""
        if not self.index_file.exists():
            self._save_index({})

    def _save_index(self, index_data):
        """Сохраняет индексный файл"""
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)

    def _load_index(self):
        """Загружает индексный файл"""
        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def is_courier_group(self, chat_id):
        """Проверяет, является ли группа курьерской"""
        index = self._load_index()
        return str(chat_id) in index

    def get_group_file_path(self, chat_id):
        """Возвращает путь к файлу данных группы"""
        return self.data_dir / f'group_{chat_id}.json'

    def save_group_data(self, chat_id, data):
        """Сохраняет данные курьерской группы"""
        try:
            # Загружаем существующие данные
            existing_data = self.get_courier_group(chat_id) or {}
            
            # Объединяем новые данные с существующими
            merged_data = {**existing_data, **data}
            
            # Сохраняем обновленные данные
            file_path = self.get_group_file_path(chat_id)
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(merged_data, f, ensure_ascii=False, indent=2)
            
            # Обновляем индекс
            index = self._load_index()
            index[str(chat_id)] = {
                'chat_title': merged_data.get('chat_title', ''),
                'last_updated': merged_data.get('last_updated', '')
            }
            self._save_index(index)
            
            return merged_data
        except Exception as e:
            logger.error(f"Error saving courier group data: {str(e)}")
            return None

    def get_courier_group(self, chat_id):
        """Получает данные курьерской группы"""
        try:
            file_path = self.get_group_file_path(chat_id)
            if not file_path.exists():
                return None
                
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading courier group data: {str(e)}")
            return None

    def get_all_courier_groups(self):
        """Получает список всех курьерских групп"""
        try:
            index = self._load_index()
            groups = []
            for chat_id in index:
                group_data = self.get_courier_group(chat_id)
                if group_data:
                    groups.append(group_data)
            return groups
        except Exception as e:
            logger.error(f"Error getting all courier groups: {str(e)}")
            return []

    def update_group_data(self, chat_id, updates):
        """Обновляет данные существующей группы"""
        try:
            current_data = self.get_courier_group(chat_id)
            if not current_data:
                return None
                
            # Обновляем только предоставленные поля
            updated_data = {**current_data, **updates}
            return self.save_group_data(chat_id, updated_data)
        except Exception as e:
            logger.error(f"Error updating courier group data: {str(e)}")
            return None

    def delete_courier_group(self, chat_id: str) -> bool:
        """Удаляет курьерскую группу"""
        try:
            group_file = self.get_group_file_path(chat_id)
            if group_file.exists():
                group_file.unlink()
                
                # Обновляем индекс
                index = self._load_index()
                if chat_id in index:
                    del index[chat_id]
                    self._save_index(index)
                
                logger.info(f"Deleted courier group {chat_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting courier group {chat_id}: {str(e)}")
            return False 