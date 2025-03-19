import json
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import traceback

logger = logging.getLogger(__name__)

class CourierGroupService:
    def __init__(self, data_dir: str):
        """Инициализация сервиса для работы с группами курьеров"""
        self.data_dir = data_dir
        self.courier_groups_dir = os.path.join(data_dir, 'courier_groups')
        
        # Создаем директорию для групп курьеров
        os.makedirs(self.courier_groups_dir, exist_ok=True)
        
        # Создаем индексный файл для быстрого поиска групп
        self.index_file = os.path.join(self.courier_groups_dir, 'groups_index.json')
        self._ensure_index_file()
        
        logger.info(f"✅ CourierGroupService инициализирован. Директория: {self.courier_groups_dir}")

    def _ensure_index_file(self) -> None:
        """Создает индексный файл, если он не существует"""
        if not os.path.exists(self.index_file):
            self._save_index({})
            logger.info("Создан индексный файл для групп курьеров")

    def _save_index(self, index_data: Dict[str, Any]) -> None:
        """Сохраняет индексный файл"""
        try:
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Ошибка при сохранении индекса: {e}")

    def _load_index(self) -> Dict[str, Any]:
        """Загружает индексный файл"""
        try:
            if os.path.exists(self.index_file):
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.error(f"Ошибка при загрузке индекса: {e}")
            return {}

    def is_courier_group(self, chat_title: str) -> bool:
        """Проверяет, является ли группа группой курьеров"""
        chat_title_lower = chat_title.lower()
        is_courier = "курьер" in chat_title_lower or "курьеры" in chat_title_lower
        logger.info(f"Проверка группы '{chat_title}' на принадлежность к курьерам: {is_courier}")
        return is_courier

    def get_group_file_path(self, chat_id: str) -> str:
        """Получает путь к файлу данных группы"""
        return os.path.join(self.courier_groups_dir, f"group_{chat_id}.json")

    async def save_group_data(self, chat_id: str, chat_title: str, members: list, admins: list) -> None:
        """Сохраняет данные группы курьеров"""
        try:
            logger.info(f"=== Начало сохранения данных группы курьеров ===")
            logger.info(f"ID чата: {chat_id}")
            logger.info(f"Название чата: {chat_title}")
            logger.info(f"Количество участников: {len(members)}")
            logger.info(f"Количество администраторов: {len(admins)}")

            if not self.is_courier_group(chat_title):
                logger.info(f"Группа {chat_title} не является группой курьеров")
                return

            # Создаем структуру данных группы
            group_data = {
                "chat_id": chat_id,
                "chat_title": chat_title,
                "members": members,
                "admins": admins,
                "last_updated": datetime.now().isoformat(),
                "group_type": "courier",
                "metadata": {
                    "total_members": len(members),
                    "total_admins": len(admins),
                    "created_at": datetime.now().isoformat()
                }
            }

            # Сохраняем данные группы
            file_path = self.get_group_file_path(chat_id)
            logger.info(f"Путь к файлу данных: {file_path}")
            
            # Создаем директорию, если она не существует
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(group_data, f, ensure_ascii=False, indent=2)
            logger.info(f"✅ Данные группы сохранены в файл {file_path}")

            # Обновляем индекс
            index_data = self._load_index()
            index_data[chat_id] = {
                "chat_title": chat_title,
                "file_path": file_path,
                "last_updated": datetime.now().isoformat()
            }
            self._save_index(index_data)
            logger.info(f"✅ Индекс обновлен для группы {chat_title}")

            logger.info(f"✅ Данные группы курьеров {chat_title} успешно сохранены")

        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении данных группы: {e}")
            logger.error(traceback.format_exc())
            raise

    async def update_group_data(self, chat_id: str, update_data: Dict[str, Any]) -> None:
        """Обновляет данные группы курьеров"""
        try:
            file_path = self.get_group_file_path(chat_id)
            if not os.path.exists(file_path):
                logger.warning(f"Файл группы {chat_id} не найден")
                return

            # Загружаем текущие данные
            with open(file_path, 'r', encoding='utf-8') as f:
                current_data = json.load(f)

            # Обновляем данные
            current_data.update(update_data)
            current_data["last_updated"] = datetime.now().isoformat()

            # Сохраняем обновленные данные
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(current_data, f, ensure_ascii=False, indent=2)

            # Обновляем индекс
            index_data = self._load_index()
            if chat_id in index_data:
                index_data[chat_id]["last_updated"] = datetime.now().isoformat()
                self._save_index(index_data)

            logger.info(f"✅ Данные группы {chat_id} успешно обновлены")

        except Exception as e:
            logger.error(f"❌ Ошибка при обновлении данных группы: {e}")
            raise

    def get_group_data(self, chat_id: str) -> Optional[Dict[str, Any]]:
        """Получает данные группы курьеров"""
        try:
            file_path = self.get_group_file_path(chat_id)
            if not os.path.exists(file_path):
                return None

            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)

        except Exception as e:
            logger.error(f"❌ Ошибка при получении данных группы: {e}")
            return None

    def get_all_courier_groups(self) -> Dict[str, Any]:
        """Получает список всех групп курьеров"""
        try:
            index_data = self._load_index()
            groups_data = {}

            for chat_id, index_info in index_data.items():
                file_path = index_info["file_path"]
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8') as f:
                        groups_data[chat_id] = json.load(f)

            return groups_data

        except Exception as e:
            logger.error(f"❌ Ошибка при получении списка групп: {e}")
            return {}

    def delete_group_data(self, chat_id: str) -> bool:
        """Удаляет данные группы курьеров"""
        try:
            file_path = self.get_group_file_path(chat_id)
            if os.path.exists(file_path):
                os.remove(file_path)

            # Обновляем индекс
            index_data = self._load_index()
            if chat_id in index_data:
                del index_data[chat_id]
                self._save_index(index_data)

            logger.info(f"✅ Данные группы {chat_id} успешно удалены")
            return True

        except Exception as e:
            logger.error(f"❌ Ошибка при удалении данных группы: {e}")
            return False 