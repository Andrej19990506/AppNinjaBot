import os
import logging
import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import traceback
import asyncpg

logger = logging.getLogger(__name__)

# Функция-помощник для преобразования asyncpg.Record в dict
# asyncpg возвращает объекты Record, а не dict по умолчанию
def _record_to_dict(record: asyncpg.Record) -> Optional[Dict]:
    return dict(record) if record else None

class DatabaseService:
    """Сервис для работы с базой данных PostgreSQL с использованием asyncpg"""
    
    # Конструктор теперь принимает пул соединений asyncpg
    def __init__(self, pool: asyncpg.Pool):
        """Инициализация сервиса с пулом соединений asyncpg"""
        self.pool = pool
        # Убираем инициализацию соединения psycopg2
        # self.db_host = os.getenv('POSTGRES_HOST', 'postgres')
        # ... (остальные переменные окружения для psycopg2)
        # self.conn = None
        # self.initialize_connection()
        
        # Создание таблиц/индексов должно управляться Alembic или другими инструментами миграции
        # self.create_tables() 
        
        logger.info(f"✅ DatabaseService инициализирован с пулом соединений asyncpg")
    
    # Убираем синхронные методы инициализации и создания таблиц
    # def initialize_connection(self): ...
    # def create_tables(self): ...

    # === Вспомогательные методы (остаются синхронными, т.к. не работают с БД) ===
    
    def determine_group_type(self, chat_title: str) -> str:
        """Определяет тип группы на основе её названия"""
        chat_title_lower = chat_title.lower()
        
        if "курьер" in chat_title_lower or "курьеры" in chat_title_lower:
            return "courier"
        elif any(word in chat_title_lower for word in ["повар", "повара", "поваров", "поварской", "поварская", "поварские", "повор", "повора"]):
            return "chef"
        elif "инвентаризация" in chat_title_lower:
            return "inventory"
        else:
            return "general"
    
    def is_group_of_type(self, chat_title: str, group_type: str) -> bool:
        """Проверяет, относится ли группа к определенному типу"""
        determined_type = self.determine_group_type(chat_title)
        return determined_type == group_type

    # === Асинхронные методы для работы с БД ===

    async def save_group(self, chat_id: str, chat_title: str, members: List[Dict], admins: List[Dict] = None) -> Optional[int]:
        """Асинхронно сохраняет группу и её участников в базу данных"""
        group_type = self.determine_group_type(chat_title)
        logger.info(f"=== [async] Начинаю сохранение группы {chat_title} (ID: {chat_id}) в базу данных ===")
        logger.info(f"Тип группы: {group_type}")
        logger.info(f"Количество участников: {len(members)}")
        logger.info(f"Количество администраторов: {len(admins) if admins else 0}")

        try:
            group_chat_id_int = int(chat_id) # Преобразуем chat_id в int
        except (ValueError, TypeError):
             logger.error(f"[async] Некорректный chat_id '{chat_id}' для сохранения группы {chat_title}")
             return None

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                try:
                    logger.info(f"[async] Выполняю запрос на сохранение/обновление группы")
                    group_db_id: Optional[int] = await conn.fetchval(
                        """
                        INSERT INTO groups (group_id, title, group_type, metadata)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (group_id) DO UPDATE SET
                            title = EXCLUDED.title,
                            group_type = EXCLUDED.group_type,
                            metadata = EXCLUDED.metadata
                        RETURNING id
                        """,
                        group_chat_id_int, # Передаем int
                        chat_title,
                        group_type,
                        json.dumps({ # Преобразуем dict в JSON строку
                            "total_members": len(members),
                            "total_admins": len(admins) if admins else 0,
                            "created_at": datetime.now().isoformat()
                        })
                    )
                    
                    if group_db_id is None:
                         logger.error(f"[async] Не удалось получить ID группы после INSERT/UPDATE для {chat_title}")
                         # Возможно, стоит возбудить исключение или вернуть None/False
                         return None 
                         
                    logger.info(f"[async] Группа сохранена с внутренним ID: {group_db_id}")
                    
                    # Сохраняем участников и связи с группой
                    for i, member in enumerate(members):
                        logger.info(f"[async] Обрабатываю участника {i+1}/{len(members)}: {member.get('username', member.get('user_id', 'Неизвестный'))}")
                        
                        # Преобразуем дату, если она есть
                        joined_at = None
                        if joined_date_str := member.get('joined_date'):
                            try:
                                joined_at = datetime.fromisoformat(joined_date_str)
                            except ValueError:
                                logger.warning(f"[async] Неверный формат даты '{joined_date_str}' для участника {member.get('user_id')}. Использую текущее время.")
                                joined_at = datetime.now()
                        else:
                            joined_at = datetime.now()

                        # --- ШАГ 1: Сохраняем/обновляем участника в 'members' и получаем member_db_id --- 
                        member_db_id: Optional[int] = await conn.fetchval(
                            """
                            INSERT INTO members (user_id, username, first_name, last_name, is_bot, photo_url, joined_at)
                            VALUES ($1, $2, '', '', $3, $4, $5) -- Имя и фамилия всегда пустые при INSERT
                            ON CONFLICT (user_id) DO UPDATE SET
                                username = EXCLUDED.username,
                                -- НЕ обновляем first_name и last_name при конфликте
                                is_bot = EXCLUDED.is_bot,
                                photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url), 
                                joined_at = EXCLUDED.joined_at 
                            RETURNING id
                            """,
                            int(member['user_id']),      # $1: user_id
                            member.get('username'),    # $2: username
                            # Пустые first_name/last_name идут напрямую в VALUES
                            member.get('is_bot', False), # $3: is_bot
                            member.get('photo_url'),   # $4: photo_url
                            joined_at                  # $5: joined_at
                        )
                        
                        if member_db_id is None:
                             logger.error(f"[async] Не удалось получить ID участника после INSERT/UPDATE для user_id: {member.get('user_id')}")
                             continue # Пропускаем этого участника

                        logger.info(f"[async] Участник сохранен/обновлен в members с ID: {member_db_id}")

                        # --- ШАГ 2: Определяем роль участника --- 
                        role = 'member' 
                        member_status = member.get('status') 
                        if member_status == 'administrator':
                            role = 'administrator'
                        elif member_status == 'creator':
                            role = 'creator'
                        
                        logger.info(f"[async] Определенная роль для {member.get('user_id')}: {role}")
                        
                        # --- ШАГ 3: Сохраняем/обновляем связь в 'group_members', используя member_db_id --- 
                        await conn.execute(
                            """
                            INSERT INTO group_members (group_id, member_id, role) 
                            VALUES ($1, $2, $3)
                            ON CONFLICT (group_id, member_id) DO UPDATE SET 
                                role = EXCLUDED.role 
                            """,
                            group_db_id,
                            member_db_id, # Используем полученный ID
                            role 
                        )
                        logger.info(f"[async] Связь group_members сохранена/обновлена с ролью: {role}")

                    # Удаляем устаревшие связи group_members (если нужно)
                    # ... (можно добавить логику удаления, если участника больше нет в members) ...
                    
                    # Транзакция завершится успешно здесь (автоматический commit)
                    logger.info(f"✅ [async] Группа {chat_title} (тип: {group_type}) успешно сохранена в базе данных")
                    return group_db_id
                    
                except asyncpg.PostgresError as e: # Ловим ошибки asyncpg
                    logger.error(f"❌ [async] Ошибка PostgreSQL при сохранении группы {chat_title}: {e}")
                    logger.error(traceback.format_exc())
                    return None 
                except Exception as e:
                    logger.error(f"❌ [async] Неожиданная ошибка при сохранении группы {chat_title}: {e}")
                    logger.error(traceback.format_exc())
                    return None 
    
    async def get_group_data(self, chat_id: str) -> Optional[Dict]:
        """Асинхронно получает данные группы и её участников из базы данных"""
        try:
            group_chat_id_int = int(chat_id) # Преобразуем chat_id в int
        except (ValueError, TypeError):
             logger.error(f"[async] Некорректный chat_id '{chat_id}' для получения данных группы")
             return None

        try:
            async with self.pool.acquire() as conn:
                # Используем conn.fetchrow для получения одной строки
                # Запрос остается почти таким же, но используем $1
                # json_agg вместо array_agg для удобства работы с JSON
                record = await conn.fetchrow(
                    """
                    SELECT 
                        g.id as group_internal_id, 
                        g.group_id, 
                        g.title, 
                        g.group_type, 
                        g.metadata, 
                        COALESCE(json_agg(
                            json_build_object(
                                'id', m.id,
                                'user_id', m.user_id,
                                'username', m.username,
                                'first_name', m.first_name,
                                'last_name', m.last_name,
                                'status', m.status,
                                'is_bot', m.is_bot,
                                'photo_url', m.photo_url,
                                'joined_at', m.joined_at,
                                'is_senior_courier', m.is_senior_courier
                            ) ORDER BY m.first_name -- Опционально: сортируем участников
                        ) FILTER (WHERE m.id IS NOT NULL), '[]'::json) as members
                    FROM groups g
                    LEFT JOIN group_members gm ON g.id = gm.group_id
                    LEFT JOIN members m ON gm.member_id = m.id
                    WHERE g.group_id = $1 -- Ищем по внешнему group_id (chat_id)
                    GROUP BY g.id 
                    """,
                    group_chat_id_int # Передаем int
                )
                # Преобразуем asyncpg.Record в словарь
                group_data = _record_to_dict(record)
                # Преобразуем JSON строку metadata обратно в dict
                if group_data and isinstance(group_data.get('metadata'), str):
                     try:
                         group_data['metadata'] = json.loads(group_data['metadata'])
                     except json.JSONDecodeError:
                         logger.warning(f"Не удалось декодировать metadata JSON для группы {chat_id}")
                         group_data['metadata'] = {} # или оставить как есть

                return group_data

        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при получении данных группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return None
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при получении данных группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return None

    async def get_groups_by_type(self, group_type: str) -> List[Dict]:
        """Асинхронно получает список групп определенного типа"""
        try:
            async with self.pool.acquire() as conn:
                # Используем conn.fetch для получения всех строк
                records = await conn.fetch(
                    """
                    SELECT id as group_internal_id, group_id, title, group_type, metadata 
                    FROM groups 
                    WHERE group_type = $1
                    """,
                    group_type
                )
                # Преобразуем список Record в список dict
                groups = [_record_to_dict(r) for r in records]
                
                # Преобразуем JSON строку metadata обратно в dict для каждого элемента
                for group in groups:
                     if group and isinstance(group.get('metadata'), str):
                         try:
                              group['metadata'] = json.loads(group['metadata'])
                         except json.JSONDecodeError:
                              logger.warning(f"Не удалось декодировать metadata JSON для группы {group.get('group_id')}")
                              group['metadata'] = {}

                return groups
        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при получении списка групп типа {group_type}: {e}")
            logger.error(traceback.format_exc())
            return []
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при получении списка групп типа {group_type}: {e}")
            logger.error(traceback.format_exc())
            return []

    async def update_group_metadata(self, chat_id: str, metadata_updates: Dict) -> bool:
        """Асинхронно обновляет метаданные группы"""
        try:
            group_chat_id_int = int(chat_id)
        except (ValueError, TypeError):
            logger.error(f"[async] Некорректный chat_id '{chat_id}' для обновления метаданных группы")
            return False

        try:
            async with self.pool.acquire() as conn:
                async with conn.transaction():
                    # Сначала получаем текущие метаданные
                    current_metadata_json = await conn.fetchval(
                        "SELECT metadata FROM groups WHERE group_id = $1",
                        group_chat_id_int
                    )
                    
                    # Парсим существующие метаданные
                    current_metadata = {}
                    if current_metadata_json:
                        try:
                            current_metadata = json.loads(current_metadata_json)
                        except json.JSONDecodeError:
                            logger.warning(f"Не удалось декодировать существующие метаданные для группы {chat_id}")
                            current_metadata = {}
                    
                    # Обновляем метаданные
                    current_metadata.update(metadata_updates)
                    
                    # Сохраняем обновленные метаданные
                    status = await conn.execute(
                        "UPDATE groups SET metadata = $1 WHERE group_id = $2",
                        json.dumps(current_metadata),
                        group_chat_id_int
                    )
                    
                    updated = 'UPDATE 1' in status
                    if updated:
                        logger.info(f"✅ [async] Метаданные группы {chat_id} успешно обновлены")
                    else:
                        logger.warning(f"[async] Не удалось обновить метаданные для группы {chat_id}")
                    
                    return updated
                    
        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при обновлении метаданных группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при обновлении метаданных группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False

    async def delete_group(self, chat_id: str) -> bool:
        """Асинхронно удаляет группу и её связи из базы данных"""
        try:
            group_chat_id_int = int(chat_id) # Преобразуем chat_id в int
        except (ValueError, TypeError):
             logger.error(f"[async] Некорректный chat_id '{chat_id}' для удаления группы")
             return False

        try:
            async with self.pool.acquire() as conn:
                async with conn.transaction(): # Используем транзакцию для атомарности
                    # Сначала получаем внутренний ID группы
                    group_db_id: Optional[int] = await conn.fetchval("SELECT id FROM groups WHERE group_id = $1", group_chat_id_int)

                    if not group_db_id:
                        logger.warning(f"[async] Группа {chat_id} не найдена для удаления.")
                        return False

                    # Удаляем связи из group_members (каскадное удаление может быть настроено в БД)
                    # Если каскадного удаления нет, раскомментируйте:
                    # deleted_links = await conn.execute("DELETE FROM group_members WHERE group_id = $1", group_db_id)
                    # logger.info(f"[async] Удалено связей для группы {chat_id}: {deleted_links}")

                    # Удаляем саму группу
                    # execute возвращает строку статуса, например "DELETE 1"
                    status = await conn.execute("DELETE FROM groups WHERE id = $1", group_db_id)
                    deleted = 'DELETE 1' in status # Проверяем, что одна строка удалена
                
                if deleted:
                    logger.info(f"✅ [async] Группа {chat_id} (внутренний ID: {group_db_id}) успешно удалена из базы данных")
                else:
                    # Эта ветка не должна сработать, если group_db_id был найден, но на всякий случай
                    logger.warning(f"[async] Не удалось удалить группу {chat_id}, хотя она была найдена.")
                return deleted
        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при удалении группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при удалении группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False

    async def remove_member_from_group(self, chat_id: str, user_id: Union[int, str]) -> bool:
        """Асинхронно удаляет участника из конкретной группы (удаляет связь)"""
        try:
             member_user_id = int(user_id)
             group_chat_id_int = int(chat_id) # Преобразуем chat_id в int
        except (ValueError, TypeError):
             logger.error(f"Некорректный user_id '{user_id}' или chat_id '{chat_id}' для удаления участника из группы")
             return False

        try:
            async with self.pool.acquire() as conn:
                 group_db_id: Optional[int] = await conn.fetchval("SELECT id FROM groups WHERE group_id = $1", group_chat_id_int) # Передаем int
                 member_db_id: Optional[int] = await conn.fetchval("SELECT id FROM members WHERE user_id = $1", member_user_id)

                 if not group_db_id:
                     logger.warning(f"[async] Группа {chat_id} не найдена для удаления участника {member_user_id}.")
                     return False
                 if not member_db_id:
                      logger.warning(f"[async] Участник {member_user_id} не найден для удаления из группы {chat_id}.")
                      # Возможно, его и так нет в группе, считаем это успехом? Зависит от логики.
                      # Пока вернем False, т.к. не нашли кого удалять.
                      return False 

                 # Удаляем связь
                 status = await conn.execute(
                      "DELETE FROM group_members WHERE group_id = $1 AND member_id = $2",
                      group_db_id, member_db_id
                 )
                 deleted = 'DELETE 1' in status
                 if deleted:
                      logger.info(f"✅ [async] Участник {member_user_id} удален из группы {chat_id}")
                      
                      # Проверяем, остался ли участник в других группах
                      remaining_groups = await conn.fetchrow(
                           "SELECT 1 FROM group_members WHERE member_id = $1 LIMIT 1", 
                           member_db_id
                      )
                      
                      if not remaining_groups:
                           # Если больше нигде не состоит, удаляем из таблицы members
                           member_delete_status = await conn.execute("DELETE FROM members WHERE id = $1", member_db_id)
                           if 'DELETE 1' in member_delete_status:
                                logger.info(f"✅ [async] Участник {member_user_id} (ID: {member_db_id}) полностью удален из таблицы members (не состоит больше ни в одной группе)")
                           else:
                                logger.warning(f"[async] Не удалось полностью удалить участника {member_user_id} (ID: {member_db_id}) из таблицы members")
                      else:
                           logger.info(f"[async] Участник {member_user_id} (ID: {member_db_id}) остается в таблице members (состоит в других группах)")
                           
                 else:
                      logger.warning(f"[async] Не удалось удалить участника {member_user_id} из группы {chat_id} (возможно, его там и не было).")
                 # Возвращаем True, если удалось удалить ИЗ ЭТОЙ ГРУППЫ
                 return deleted

        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при удалении участника {member_user_id} из группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при удалении участника {member_user_id} из группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False

    async def get_all_groups(self) -> List[Dict]:
        """Асинхронно получает список всех групп"""
        try:
            async with self.pool.acquire() as conn:
                records = await conn.fetch(
                     """
                     SELECT g.id as group_internal_id, g.group_id, g.title, g.group_type, g.metadata,
                            COALESCE(json_agg(
                                json_build_object(
                                    'id', m.id, 'user_id', m.user_id, 'username', m.username, 
                                    'first_name', m.first_name, 'last_name', m.last_name, 
                                    'status', m.status, 'is_bot', m.is_bot, 'photo_url', m.photo_url, 
                                    'joined_at', m.joined_at, 'is_senior_courier', m.is_senior_courier
                                ) ORDER BY m.first_name
                            ) FILTER (WHERE m.id IS NOT NULL), '[]'::json) as members
                     FROM groups g
                     LEFT JOIN group_members gm ON g.id = gm.group_id
                     LEFT JOIN members m ON gm.member_id = m.id
                     GROUP BY g.id
                     ORDER BY g.title -- Опционально сортируем группы по названию
                     """
                )
                groups = [_record_to_dict(r) for r in records]
                # Декодируем metadata
                for group in groups:
                     if group and isinstance(group.get('metadata'), str):
                         try:
                              group['metadata'] = json.loads(group['metadata'])
                         except json.JSONDecodeError:
                              group['metadata'] = {}

                return groups

        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при получении всех групп: {e}")
            logger.error(traceback.format_exc())
            return []
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при получении всех групп: {e}")
            logger.error(traceback.format_exc())
            return []
            
    # Методы для работы с senior курьерами/поварами (пример)
    async def set_senior_status(self, user_id: int, group_type: str, is_senior: bool) -> bool:
        """Устанавливает статус старшего для пользователя"""
        field_to_update = None
        if group_type == 'courier':
            field_to_update = 'is_senior_courier'
        # elif group_type == 'chef':
        #     field_to_update = 'is_senior_chef' # Если есть такое поле
        else:
             logger.warning(f"Неподдерживаемый тип группы '{group_type}' для установки статуса старшего.")
             return False

        if not field_to_update:
             return False # На всякий случай

        try:
             async with self.pool.acquire() as conn:
                  status = await conn.execute(
                       f""" 
                       UPDATE members SET {field_to_update} = $1 WHERE user_id = $2
                       """, # Используем f-string осторожно, т.к. имя поля проверено
                       is_senior, user_id
                  )
                  updated = 'UPDATE 1' in status
                  if updated:
                      logger.info(f"Статус {field_to_update} = {is_senior} установлен для user_id {user_id}")
                  else:
                      logger.warning(f"Не удалось обновить статус {field_to_update} для user_id {user_id} (возможно, пользователя нет)")
                  return updated
        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при установке статуса старшего для user_id {user_id}: {e}")
            return False
        except Exception as e:
             logger.error(f"❌ [async] Неожиданная ошибка при установке статуса старшего для user_id {user_id}: {e}")
             return False

    # Добавьте другие методы, если они есть, переделав их на asyncpg...
    # Например, get_member_data, update_member_photo и т.д.

    async def close_connection(self):
        """Закрывает пул соединений asyncpg."""
        # Этот метод больше не нужен здесь, закрытие пула будет в lifespan
        # if self.pool:
        #     await self.pool.close()
        #     logger.info("✅ [async] Пул соединений asyncpg закрыт")
        pass # Оставляем пустым или удаляем

    # --- НОВЫЙ МЕТОД --- 
    async def is_user_in_group(self, user_id: int, chat_id: str) -> bool:
        """
        Асинхронно проверяет, зарегистрирован ли пользователь (существует ли связь)
        в указанной группе.

        Args:
            user_id: ID пользователя Telegram.
            chat_id: Оригинальный ID чата Telegram (строка, например '-100...' или '-...').

        Returns:
            True, если пользователь найден в группе (связь существует), False в противном случае.
        """
        logger.info(f"🔍 [is_user_in_group] Проверка наличия пользователя {user_id} в группе {chat_id}")
        
        try:
            # Преобразуем chat_id в int для поиска в таблице groups
            group_chat_id_int = int(chat_id) 
            logger.info(f"🔍 [is_user_in_group] chat_id преобразован в int: {group_chat_id_int}")
        except (ValueError, TypeError):
             logger.warning(f"❌ [is_user_in_group] Некорректный chat_id '{chat_id}' для проверки is_user_in_group (user: {user_id})")
             return False # Некорректный ID группы - считаем, что не зарегистрирован
             
        # Преобразуем user_id в int (на всякий случай, если придет строка)
        try:
            user_id_int = int(user_id)
            logger.info(f"🔍 [is_user_in_group] user_id преобразован в int: {user_id_int}")
        except (ValueError, TypeError):
             logger.warning(f"❌ [is_user_in_group] Некорректный user_id '{user_id}' для проверки is_user_in_group (group: {chat_id})")
             return False

        async with self.pool.acquire() as conn:
            try:
                # Сначала проверим, есть ли пользователь в таблице members
                member_exists = await conn.fetchval(
                    "SELECT EXISTS (SELECT 1 FROM members WHERE user_id = $1)",
                    user_id_int
                )
                logger.info(f"🔍 [is_user_in_group] Пользователь {user_id_int} есть в таблице members: {member_exists}")
                
                # Проверим, есть ли группа в таблице groups
                group_exists = await conn.fetchval(
                    "SELECT EXISTS (SELECT 1 FROM groups WHERE group_id = $1)",
                    group_chat_id_int
                )
                logger.info(f"🔍 [is_user_in_group] Группа {group_chat_id_int} есть в таблице groups: {group_exists}")
                
                # Запрос для проверки существования связи в group_members
                # через внешние ID пользователя и группы
                query = """
                    SELECT EXISTS (
                        SELECT 1
                        FROM group_members gm
                        JOIN members m ON gm.member_id = m.id
                        JOIN groups g ON gm.group_id = g.id
                        WHERE m.user_id = $1 AND g.group_id = $2
                    );
                """
                exists = await conn.fetchval(query, user_id_int, group_chat_id_int)
                logger.info(f"🔍 [is_user_in_group] Результат проверки связи в group_members: {exists}")
                
                # Дополнительная отладка - получим ID записей
                member_id = await conn.fetchval(
                    "SELECT id FROM members WHERE user_id = $1",
                    user_id_int
                )
                logger.info(f"🔍 [is_user_in_group] ID записи пользователя в members: {member_id}")
                
                group_id = await conn.fetchval(
                    "SELECT id FROM groups WHERE group_id = $1",
                    group_chat_id_int
                )
                logger.info(f"🔍 [is_user_in_group] ID записи группы в groups: {group_id}")
                
                # Проверим связь по внутренним ID
                if member_id and group_id:
                    link_exists = await conn.fetchval(
                        "SELECT EXISTS (SELECT 1 FROM group_members WHERE member_id = $1 AND group_id = $2)",
                        member_id, group_id
                    )
                    logger.info(f"🔍 [is_user_in_group] Связь по внутренним ID ({member_id}, {group_id}): {link_exists}")
                
                logger.info(f"🔍 [is_user_in_group] ИТОГОВЫЙ РЕЗУЛЬТАТ: {exists}")
                return bool(exists)
            
            except asyncpg.PostgresError as e:
                logger.error(f"❌ [is_user_in_group] Ошибка PostgreSQL при проверке is_user_in_group ({user_id} в {chat_id}): {e}")
                logger.error(traceback.format_exc())
                return False # В случае ошибки БД считаем, что не зарегистрирован
            except Exception as e:
                logger.error(f"❌ [is_user_in_group] Неожиданная ошибка при проверке is_user_in_group ({user_id} в {chat_id}): {e}")
                logger.error(traceback.format_exc())
                return False # В случае другой ошибки тоже считаем, что не зарегистрирован
    # --- КОНЕЦ НОВОГО МЕТОДА ---
    
    async def group_exists(self, chat_id: str) -> bool:
        """
        Проверяет существует ли группа в БД.
        
        Args:
            chat_id: ID чата Telegram (строка)
            
        Returns:
            True если группа существует, False если нет
        """
        logger.info(f"🔍 [group_exists] Проверка существования группы {chat_id}")
        
        try:
            group_chat_id_int = int(chat_id)
            logger.info(f"🔍 [group_exists] chat_id преобразован в int: {group_chat_id_int}")
        except (ValueError, TypeError):
            logger.warning(f"❌ [group_exists] Некорректный chat_id '{chat_id}'")
            return False
            
        async with self.pool.acquire() as conn:
            try:
                exists = await conn.fetchval(
                    "SELECT EXISTS (SELECT 1 FROM groups WHERE group_id = $1)",
                    group_chat_id_int
                )
                logger.info(f"🔍 [group_exists] Результат проверки группы {chat_id}: {exists}")
                return bool(exists)
                
            except asyncpg.PostgresError as e:
                logger.error(f"❌ [group_exists] Ошибка PostgreSQL при проверке существования группы {chat_id}: {e}")
                return False
            except Exception as e:
                logger.error(f"❌ [group_exists] Неожиданная ошибка при проверке существования группы {chat_id}: {e}")
                return False

    async def add_user_to_group(self, user_info: dict, group_id: str) -> bool:
        """
        Добавляет пользователя в группу вручную.
        
        Args:
            user_info: Информация о пользователе (dict с полями user_id, username, etc.)
            group_id: ID группы (строка)
            
        Returns:
            True если пользователь успешно добавлен, False если произошла ошибка
        """
        logger.info(f"🔄 [add_user_to_group] Добавление пользователя {user_info.get('user_id')} в группу {group_id}")
        
        try:
            group_chat_id_int = int(group_id)
            user_id_int = int(user_info['user_id'])
            logger.info(f"🔄 [add_user_to_group] Преобразованы ID: группа={group_chat_id_int}, пользователь={user_id_int}")
        except (ValueError, TypeError) as e:
            logger.error(f"❌ [add_user_to_group] Некорректные ID: group_id='{group_id}', user_id='{user_info.get('user_id')}': {e}")
            return False
            
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                try:
                    # Шаг 1: Получаем ID группы из БД
                    group_db_id = await conn.fetchval(
                        "SELECT id FROM groups WHERE group_id = $1",
                        group_chat_id_int
                    )
                    
                    if not group_db_id:
                        logger.error(f"❌ [add_user_to_group] Группа {group_id} не найдена в БД")
                        return False
                    
                    logger.info(f"🔍 [add_user_to_group] ID группы в БД: {group_db_id}")
                    
                    # Шаг 2: Проверяем есть ли пользователь в таблице members
                    member_db_id = await conn.fetchval(
                        "SELECT id FROM members WHERE user_id = $1",
                        user_id_int
                    )
                    
                    if member_db_id:
                        logger.info(f"✅ [add_user_to_group] Пользователь {user_id_int} уже есть в таблице members с ID: {member_db_id}")
                        
                        # Обновляем только основные поля (username может измениться)
                        await conn.execute(
                            """
                            UPDATE members 
                            SET username = $2, 
                                first_name = $3, 
                                last_name = $4,
                                photo_url = COALESCE($5, photo_url)
                            WHERE user_id = $1
                            """,
                            user_id_int,
                            user_info.get('username'),
                            user_info.get('first_name', ''),
                            user_info.get('last_name', ''),
                            user_info.get('photo_url')
                        )
                        logger.info(f"✅ [add_user_to_group] Данные пользователя {user_id_int} обновлены")
                        
                    else:
                        # Пользователя нет в members - добавляем его
                        logger.info(f"🆕 [add_user_to_group] Пользователь {user_id_int} не найден в members, добавляем...")
                        
                        joined_at = datetime.now()
                        if joined_date_str := user_info.get('joined_date'):
                            try:
                                joined_at = datetime.fromisoformat(joined_date_str)
                            except ValueError:
                                logger.warning(f"[add_user_to_group] Неверный формат даты '{joined_date_str}', использую текущее время")
                                joined_at = datetime.now()
                        
                        member_db_id = await conn.fetchval(
                            """
                            INSERT INTO members (user_id, username, first_name, last_name, is_bot, photo_url, joined_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING id
                            """,
                            user_id_int,
                            user_info.get('username'),
                            user_info.get('first_name', ''),
                            user_info.get('last_name', ''),
                            user_info.get('is_bot', False),
                            user_info.get('photo_url'),
                            joined_at
                        )
                        
                        if not member_db_id:
                            logger.error(f"❌ [add_user_to_group] Не удалось добавить пользователя {user_id_int} в таблицу members")
                            return False
                        
                        logger.info(f"✅ [add_user_to_group] Пользователь {user_id_int} добавлен в members с ID: {member_db_id}")
                    
                    # Шаг 3: Определяем роль пользователя
                    user_status = user_info.get('status', 'member')
                    role = 'member'
                    if user_status == 'administrator':
                        role = 'administrator'
                    elif user_status == 'creator':
                        role = 'creator'
                    
                    logger.info(f"🔍 [add_user_to_group] Определенная роль: {role}")
                    
                    # Шаг 4: Добавляем/обновляем связь в group_members
                    await conn.execute(
                        """
                        INSERT INTO group_members (group_id, member_id, role)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (group_id, member_id) DO UPDATE SET
                            role = EXCLUDED.role
                        """,
                        group_db_id,
                        member_db_id,
                        role
                    )
                    
                    logger.info(f"✅ [add_user_to_group] Связь group_members создана/обновлена с ролью: {role}")
                    
                    # Все операции успешны
                    logger.info(f"✅ [add_user_to_group] Пользователь {user_id_int} успешно добавлен в группу {group_id}")
                    return True
                    
                except asyncpg.PostgresError as e:
                    logger.error(f"❌ [add_user_to_group] Ошибка PostgreSQL при добавлении пользователя {user_info.get('user_id')} в группу {group_id}: {e}")
                    return False
                except Exception as e:
                    logger.error(f"❌ [add_user_to_group] Неожиданная ошибка при добавлении пользователя {user_info.get('user_id')} в группу {group_id}: {e}")
                    return False