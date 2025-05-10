import json
from pathlib import Path
import os
from typing import Dict, Any, List, Union
import logging
from datetime import datetime
import traceback

logger = logging.getLogger(__name__)

class JsonService:
    def __init__(self, data_dir: str):
        """Инициализация сервиса для работы с JSON файлами"""
        self.data_dir = data_dir
        self.inventory_dir = os.path.join(data_dir, 'inventory')
        
        # Создаем необходимые директории
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.inventory_dir, exist_ok=True)
        
        # Проверяем и создаем основные файлы
        self._ensure_file_exists('members.json', {})
        self._ensure_file_exists('admins.json', {})
        self._ensure_file_exists('photo_cache.json', {})
        
        logger.info(f"✅ JsonService инициализирован. Директория данных: {self.data_dir}")
    
    def _ensure_file_exists(self, filename: str, default_content: dict) -> None:
        """Проверяет существование файла и создает его с дефолтным содержимым если нужно"""
        file_path = os.path.join(self.data_dir, filename)
        if not os.path.exists(file_path):
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(default_content, f, ensure_ascii=False, indent=2)
            logger.info(f"Создан файл {filename} с дефолтным содержимым")
    
    def file_exists(self, filename: str) -> bool:
        """Проверяет существование файла"""
        return os.path.exists(os.path.join(self.data_dir, filename))
    
    async def save_members(self, chat_id: Union[int, str], chat_title: str, members: List[dict]) -> None:
        """Сохранение списка участников в JSON файл"""
        try:
            logger.info(f"Сохранение {len(members)} участников для чата {chat_title}")
            
            # Загружаем текущие данные
            members_data = self.load_from_json('members.json')
            
            # Обновляем данные для чата
            members_data[str(chat_id)] = {
                'chat_title': chat_title,
                'members': members,
                'last_updated': datetime.now().isoformat()
            }
            
            # Сохраняем данные во временный файл
            temp_file = os.path.join(self.data_dir, 'members_temp.json')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(members_data, f, ensure_ascii=False, indent=2)
            
            # Перемещаем временный файл
            target_file = os.path.join(self.data_dir, 'members.json')
            os.replace(temp_file, target_file)
            
            logger.info(f"✅ Сохранено {len(members)} участников для чата {chat_title}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении участников: {str(e)}")
            raise
    
    async def save_admins(self, chat_id: Union[int, str], chat_title: str, admins: List[dict]) -> None:
        """Сохранение списка администраторов в JSON файл"""
        try:
            logger.info(f"Сохранение {len(admins)} администраторов для чата {chat_title}")
            
            # Загружаем текущие данные
            admins_data = self.load_from_json('admins.json')
            
            # Обновляем данные для чата
            admins_data[str(chat_id)] = {
                'chat_title': chat_title,
                'admins': admins,
                'last_updated': datetime.now().isoformat()
            }
            
            # Сохраняем данные во временный файл
            temp_file = os.path.join(self.data_dir, 'admins_temp.json')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(admins_data, f, ensure_ascii=False, indent=2)
            
            # Перемещаем временный файл
            target_file = os.path.join(self.data_dir, 'admins.json')
            os.replace(temp_file, target_file)
            
            logger.info(f"✅ Сохранено {len(admins)} администраторов для чата {chat_title}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении администраторов: {str(e)}")
            raise
    
    def load_from_json(self, filename: str) -> dict:
        """Загрузка данных из JSON файла"""
        try:
            file_path = os.path.join(self.data_dir, filename)
            if not os.path.exists(file_path):
                logger.warning(f"Файл {filename} не существует, возвращаем пустой словарь")
                return {}
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Ошибка декодирования JSON в файле {filename}: {str(e)}")
            return {}
        except Exception as e:
            logger.error(f"❌ Ошибка при загрузке файла {filename}: {str(e)}")
            return {}
    
    async def save_to_json(self, filename: str, data: dict) -> None:
        """Сохранение данных в JSON файл"""
        try:
            # Сохраняем во временный файл
            temp_file = os.path.join(self.data_dir, f'{filename}.temp')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            # Перемещаем временный файл
            target_file = os.path.join(self.data_dir, filename)
            os.replace(temp_file, target_file)
            
            logger.info(f"✅ Данные успешно сохранены в {filename}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении в {filename}: {str(e)}")
            raise

    def load_members(self) -> list:
        """Загружает список участников из файла"""
        try:
            data = self.load_from_json('members.json')
            # Собираем всех участников из всех чатов
            all_members = []
            for chat_data in data.values():
                if isinstance(chat_data, dict) and 'members' in chat_data:
                    all_members.extend(chat_data['members'])
            return all_members
        except Exception as e:
            logger.error(f"Ошибка при загрузке участников: {e}", exc_info=True)
            return []

    def _standardize_chat_id(self, chat_id: int | str) -> str:
        """Преобразует ID чата в стандартный формат"""
        str_id = str(chat_id)
        if str_id.startswith('-100'):
            return str_id[4:]
        elif str_id.startswith('-'):
            return str_id[1:]
        return str_id

    def load_admins(self) -> list:
        """Загружает список администраторов из файла"""
        try:
            data = self.load_from_json('admins.json')
            # Собираем всех администраторов из всех чатов
            all_admins = []
            for chat_data in data.values():
                if isinstance(chat_data, dict) and 'admins' in chat_data:
                    all_admins.extend(chat_data['admins'])
            return all_admins
        except Exception as e:
            logger.error(f"Ошибка при загрузке администраторов: {e}", exc_info=True)
            return []

    def save_admin_activity(self, activity_data: dict) -> None:
        """Сохраняет данные об активности администраторов"""
        try:
            current_data = self.load_from_json('admin_activity.json')
            
            # Обновляем данные активности
            for chat_id, chat_data in activity_data.items():
                if chat_id not in current_data:
                    current_data[chat_id] = {}
                current_data[chat_id].update(chat_data)
            
            self.save_to_json('admin_activity.json', current_data)
            logger.info("Данные об активности администраторов успешно обновлены")
        except Exception as e:
            logger.error(f"Ошибка при сохранении активности администраторов: {e}", exc_info=True)