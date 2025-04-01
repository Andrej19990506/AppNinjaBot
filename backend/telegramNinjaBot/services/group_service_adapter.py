import os
import logging
import traceback
from typing import Dict, List, Any, Optional, Union

logger = logging.getLogger(__name__)

class GroupServiceAdapter:
    """Адаптер для совместимости старого и нового способа работы с данными групп"""
    
    def __init__(self, courier_service, db_service):
        """
        Инициализирует адаптер
        
        Args:
            courier_service: Старый сервис для работы с JSON-файлами
            db_service: Новый сервис для работы с базой данных
        """
        self.courier_service = courier_service
        self.db_service = db_service
        
        # Определяем, используется ли база данных
        self.use_database = os.getenv('USE_DATABASE', 'false').lower() == 'true'
        
        logger.info(f"✅ GroupServiceAdapter инициализирован (use_database={self.use_database})")
    
    def is_courier_group(self, chat_title: str) -> bool:
        """Проверяет, является ли группа курьерской"""
        return self.courier_service.is_courier_group(chat_title)
    
    def is_chef_group(self, chat_title: str) -> bool:
        """Проверяет, является ли группа поварской"""
        if self.use_database:
            return self.db_service.is_group_of_type(chat_title, "chef")
        else:
            # Логика определения поварской группы без базы данных
            chat_title_lower = chat_title.lower()
            return any(word in chat_title_lower for word in ["повар", "повара", "поваров", "поварской", "поварская", "поварские", "повор", "повора"])
    
    def determine_group_type(self, chat_title: str) -> str:
        """Определяет тип группы на основе её названия"""
        logger.info(f"Определение типа группы: '{chat_title}'")
        
        if self.use_database:
            logger.info("Используется база данных для определения типа группы")
            group_type = self.db_service.determine_group_type(chat_title)
            logger.info(f"Определенный тип группы через DB: {group_type}")
            return group_type
        else:
            logger.info("Используется локальная логика для определения типа группы")
            chat_title_lower = chat_title.lower()
            if "курьер" in chat_title_lower or "курьеры" in chat_title_lower:
                logger.info("Определен тип: курьерская группа")
                return "courier"
            elif any(word in chat_title_lower for word in ["повар", "повара", "поваров", "поварской", "поварская", "поварские", "повор", "повора"]):
                logger.info("Определен тип: поварская группа")
                return "chef"
            else:
                logger.info("Определен тип: общая группа")
                return "general"
    
    async def save_group_data(self, chat_id: str, chat_title: str, members: list, admins: list) -> None:
        """Сохраняет данные группы"""
        try:
            # Определяем тип группы
            group_type = self.determine_group_type(chat_title)
            logger.info(f"=== GroupServiceAdapter.save_group_data начало выполнения ===")
            logger.info(f"Chat ID: {chat_id}, Chat Title: {chat_title}")
            logger.info(f"Определенный тип группы: {group_type}")
            logger.info(f"Использование базы данных: {self.use_database}")
            
            # Сначала сохраняем в старом формате для обратной совместимости
            if group_type == "courier":
                logger.info(f"Сохранение данных курьерской группы в JSON")
                await self.courier_service.save_group_data(chat_id, chat_title, members, admins)
                logger.info(f"✅ Данные курьерской группы {chat_title} сохранены в JSON")
            
            # Если используется база данных, сохраняем и в ней
            if self.use_database:
                try:
                    logger.info(f"Попытка сохранения в базу данных группы {chat_title} (тип: {group_type})")
                    result = self.db_service.save_group(chat_id, chat_title, members, admins)
                    logger.info(f"✅ Данные группы {chat_title} (тип: {group_type}) сохранены в БД с ID: {result}")
                except Exception as e:
                    logger.error(f"❌ Ошибка при сохранении в БД группы {chat_title}: {e}")
                    logger.error(traceback.format_exc())
            else:
                logger.info(f"Сохранение в базу данных пропущено, так как use_database = False")
            
            logger.info(f"=== GroupServiceAdapter.save_group_data завершено ===")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении данных группы: {e}")
            logger.error(traceback.format_exc())
            raise
    
    async def update_group_data(self, chat_id: str, update_data: Dict[str, Any]) -> None:
        """Обновляет данные группы"""
        try:
            # Обновляем в старом формате
            await self.courier_service.update_group_data(chat_id, update_data)
            
            # Если используется база данных, нужно получить полные данные и обновить
            if self.use_database:
                # Получаем текущие данные группы
                group_data = self.courier_service.get_group_data(chat_id)
                if group_data:
                    # Обновляем только если группа существует
                    self.db_service.save_group(
                        chat_id=chat_id,
                        chat_title=group_data.get('chat_title', 'Неизвестная группа'),
                        members=group_data.get('members', []),
                        admins=group_data.get('admins', [])
                    )
                    logger.info(f"✅ Данные группы {chat_id} обновлены в БД")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обновлении данных группы: {e}")
            logger.error(traceback.format_exc())
            raise
    
    def get_group_data(self, chat_id: str) -> Optional[Dict[str, Any]]:
        """Получает данные группы"""
        try:
            # Если используется база данных, пробуем сначала оттуда
            if self.use_database:
                db_data = self.db_service.get_group_data(chat_id)
                if db_data:
                    return db_data
            
            # Если нет данных в БД или не используется БД, берем из JSON
            return self.courier_service.get_group_data(chat_id)
            
        except Exception as e:
            logger.error(f"❌ Ошибка при получении данных группы: {e}")
            logger.error(traceback.format_exc())
            return None
    
    def get_groups_by_type(self, group_type: str) -> List[Dict]:
        """Получает список групп определенного типа"""
        try:
            if self.use_database:
                return self.db_service.get_groups_by_type(group_type)
            else:
                # Для обратной совместимости, если тип "courier", используем старый метод
                if group_type == "courier":
                    return list(self.courier_service.get_all_courier_groups().values())
                else:
                    # Для других типов нет прямого метода в старом сервисе
                    return []
                    
        except Exception as e:
            logger.error(f"❌ Ошибка при получении списка групп типа {group_type}: {e}")
            logger.error(traceback.format_exc())
            return []
    
    def delete_group_data(self, chat_id: str) -> bool:
        """Удаляет данные группы"""
        try:
            # Удаляем из JSON в любом случае
            json_deleted = self.courier_service.delete_group_data(chat_id)
            
            # Если используется база данных, удаляем и оттуда
            db_deleted = False
            if self.use_database:
                db_deleted = self.db_service.delete_group(chat_id)
                
            return json_deleted or db_deleted
            
        except Exception as e:
            logger.error(f"❌ Ошибка при удалении данных группы: {e}")
            logger.error(traceback.format_exc())
            return False
    
    def get_groups_by_user_id(self, user_id: int) -> Dict:
        """Получает группы, в которых состоит пользователь"""
        try:
            logger.info(f"🔍 Получение групп пользователя {user_id}")
            
            # Если используется база данных, пробуем сначала оттуда
            if self.use_database:
                logger.info("Поиск групп пользователя в базе данных")
                db_result = self.db_service.get_groups_by_user_id(user_id)
                
                # Если в базе найдены группы, возвращаем их
                if db_result.get('success') and db_result.get('groups'):
                    logger.info(f"✅ Найдено {len(db_result['groups'])} групп в базе данных")
                    return db_result
                else:
                    logger.info("Группы в базе данных не найдены, проверяем JSON-файлы")
            
            # Если база данных не используется или в ней нет данных,
            # используем старый метод чтения из JSON-файлов
            from data.users import get_user_groups
            json_result = get_user_groups(user_id)
            logger.info(f"✅ Найдено {len(json_result.get('groups', []))} групп в JSON-файлах")
            return json_result
            
        except Exception as e:
            logger.error(f"❌ Ошибка при получении групп пользователя {user_id}: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e),
                'groups': [],
                'user_data': None
            }
    
    async def migrate_all_data(self) -> Dict:
        """Мигрирует все данные из JSON в базу данных"""
        if not self.use_database:
            logger.warning("❌ Миграция невозможна: использование базы данных отключено")
            return {"status": "error", "message": "Использование базы данных отключено"}
        
        try:
            # Запускаем миграцию
            stats = self.db_service.migrate_from_json(self.courier_service, None)
            
            return {
                "status": "success",
                "groups_migrated": stats["groups"],
                "members_migrated": stats["members"],
                "errors": stats["errors"]
            }
            
        except Exception as e:
            logger.error(f"❌ Ошибка при миграции данных: {e}")
            logger.error(traceback.format_exc())
            return {"status": "error", "message": str(e)}
    
    async def update_all_groups_structure(self) -> int:
        """
        Обновляет структуру файлов всех групп.
        Проксирует вызов к courier_service для обратной совместимости.
        
        Returns:
            int: Количество обновленных групп
        """
        logger.info("GroupServiceAdapter: Проксируем вызов update_all_groups_structure к courier_service")
        
        try:
            result = await self.courier_service.update_all_groups_structure()
            logger.info(f"✅ Структура файлов групп успешно обновлена, всего групп: {result}")
            return result
        except Exception as e:
            logger.error(f"❌ Ошибка при обновлении структуры файлов групп: {e}")
            logger.error(traceback.format_exc())
            return 0 