import json
from pathlib import Path
import os
from typing import Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class JsonService:
    def __init__(self, data_dir: str = None):
        """Инициализация сервиса"""
        if data_dir is None:
            # Используем абсолютный путь к директории data
            self.data_dir = '/app/telegramNinjaBot/data'
            logger.info(f"Используем путь к данным: {self.data_dir}")
        else:
            self.data_dir = data_dir
            
        # Создаем директорию, если она не существует
        os.makedirs(self.data_dir, exist_ok=True)
        logger.info(f"Директория {self.data_dir} создана или уже существует")
            
        # Создаем абсолютные пути к файлам
        self.members_file = os.path.join(self.data_dir, 'members.json')
        self.admins_file = os.path.join(self.data_dir, 'admins.json')
        self.activity_file = os.path.join(self.data_dir, 'admin_activity.json')
        self._ensure_files_exist()
    
    def _ensure_files_exist(self):
        """Создает директорию и файлы если они не существуют"""
        try:
            # Список файлов для проверки
            files_to_check = {
                'members.json': {},
                'admins.json': {},
                'admin_activity.json': {}
            }
            
            # Проверяем и создаем каждый файл
            for filename, default_data in files_to_check.items():
                file_path = os.path.join(self.data_dir, filename)
                if not os.path.exists(file_path):
                    logger.info(f"Создаем файл {filename}")
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(default_data, f, ensure_ascii=False, indent=4)
                    logger.info(f"✅ Файл {filename} успешно создан")
                else:
                    logger.info(f"Файл {filename} уже существует")
                    
                # Проверяем права на запись
                if not os.access(file_path, os.W_OK):
                    logger.warning(f"⚠️ Нет прав на запись в файл {filename}")
                    # Пытаемся установить права на запись
                    try:
                        os.chmod(file_path, 0o666)
                        logger.info(f"✅ Права на запись для {filename} установлены")
                    except Exception as e:
                        logger.error(f"❌ Не удалось установить права на запись для {filename}: {e}")
                        
        except Exception as e:
            logger.error(f"❌ Ошибка при создании файлов: {e}", exc_info=True)
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

    def save_members(self, members: list) -> None:
        """Сохраняет список участников в файл"""
        try:
            data = self.load_from_json('members.json')
            
            # Группируем участников по чатам
            members_by_chat = {}
            for member in members:
                chat_id = str(member.get('chat_id', 'unknown'))
                if chat_id not in members_by_chat:
                    members_by_chat[chat_id] = {
                        'chat_title': member.get('chat_title', 'Unknown Chat'),
                        'members': []
                    }
                members_by_chat[chat_id]['members'].append(member)
            
            # Обновляем данные для каждого чата
            for chat_id, chat_data in members_by_chat.items():
                if chat_id in data:
                    data[chat_id]['members'] = chat_data['members']
                    data[chat_id]['total_count'] = len(chat_data['members'])
                    data[chat_id]['last_update'] = datetime.now().isoformat()
                else:
                    data[chat_id] = {
                        'chat_title': chat_data['chat_title'],
                        'members': chat_data['members'],
                        'total_count': len(chat_data['members']),
                        'last_update': datetime.now().isoformat()
                    }
            
            self.save_to_json(data, 'members.json')
            logger.info(f"Сохранено {len(members)} участников")
        except Exception as e:
            logger.error(f"Ошибка при сохранении участников: {e}", exc_info=True)

    def _standardize_chat_id(self, chat_id: int | str) -> str:
        """Преобразует ID чата в стандартный формат"""
        str_id = str(chat_id)
        if str_id.startswith('-100'):
            return str_id[4:]
        elif str_id.startswith('-'):
            return str_id[1:]
        return str_id

    async def save_admins(self, chat_id: int, chat_title: str, admins: list) -> None:
        """Сохраняет список администраторов чата"""
        try:
            standardized_chat_id = self._standardize_chat_id(chat_id)
            logger.info(f"Сохранение администраторов для чата {chat_title} (ID: {standardized_chat_id})")
            
            current_data = self.load_from_json('admins.json')
            
            # Обновляем данные для чата, используя стандартизированный ID
            current_data[standardized_chat_id] = {
                'chat_title': chat_title,
                'admins': admins,
                'last_update': datetime.now().isoformat()
            }
            
            # Сохраняем обновленные данные
            self.save_to_json(current_data, 'admins.json')
            logger.info(f"✅ Успешно сохранены администраторы для чата {chat_title}")
            logger.info(f"Сохраненные администраторы: {[admin.get('username', 'Unknown') for admin in admins]}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении администраторов: {str(e)}", exc_info=True)
            raise

    def load_admins(self) -> list:
        """Загружает список администраторов из файла"""
        try:
            with open(self.admins_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Ошибка при загрузке администраторов: {e}", exc_info=True)
            return []

    def load_from_json(self, filename: str) -> dict:
        """Загрузка данных из JSON файла"""
        try:
            file_path = Path(self.data_dir) / filename
            if file_path.exists():
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Убедимся, что возвращаем словарь
                    if isinstance(data, list):
                        return {}
                    return data
        except Exception as e:
            logger.error(f"Ошибка при загрузке JSON файла {filename}: {e}")
        return {}

    def save_to_json(self, data: dict, filename: str) -> None:
        """Сохранение данных в JSON файл"""
        try:
            if not isinstance(filename, str):
                raise TypeError(f"filename должен быть строкой, получено: {type(filename)}")
            
            if not isinstance(data, dict):
                raise TypeError(f"data должен быть словарем, получено: {type(data)}")
                
            file_path = os.path.join(self.data_dir, filename)
            logger.info(f"Сохранение данных в файл {file_path}")
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            
            logger.info(f"✅ Данные успешно сохранены в {file_path}")
            
        except TypeError as e:
            logger.error(f"❌ Ошибка типа данных при сохранении {filename}: {e}", exc_info=True)
            raise
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении JSON файла {filename}: {e}", exc_info=True)
            raise

    async def save_members(self, chat_id: int, chat_title: str, members: list) -> None:
        """Сохраняет список участников чата"""
        try:
            standardized_chat_id = self._standardize_chat_id(chat_id)
            current_data = self.load_from_json('members.json')
            
            # Удаляем старые записи с нестандартизированным ID
            original_chat_id = str(chat_id)
            if original_chat_id in current_data:
                del current_data[original_chat_id]
            
            # Обновляем данные для чата, используя только стандартизированный ID
            current_data[standardized_chat_id] = {
                'chat_title': chat_title,
                'members': members,
                'last_update': datetime.now().isoformat()
            }
            
            # Сохраняем обновленные данные
            self.save_to_json(current_data, 'members.json')
            logger.info(f"Сохранены участники для чата {chat_title} (ID: {standardized_chat_id})")
            
        except Exception as e:
            logger.error(f"Ошибка при сохранении участников: {e}", exc_info=True)

    def save_admin_activity(self, activity_data: dict) -> None:
        """Сохраняет данные об активности администраторов"""
        try:
            current_data = self.load_from_json('admin_activity.json')
            
            # Обновляем данные активности
            for chat_id, chat_data in activity_data.items():
                if chat_id not in current_data:
                    current_data[chat_id] = {}
                current_data[chat_id].update(chat_data)
            
            self.save_to_json(current_data, 'admin_activity.json')
            logger.info("Данные об активности администраторов успешно обновлены")
        except Exception as e:
            logger.error(f"Ошибка при сохранении активности администраторов: {e}", exc_info=True)

    def file_exists(self, filename: str) -> bool:
        """Проверяет существование файла в директории данных"""
        file_path = os.path.join(self.data_dir, filename)
        exists = os.path.exists(file_path)
        logger.debug(f"Проверка существования файла {filename}: {exists}")
        return exists