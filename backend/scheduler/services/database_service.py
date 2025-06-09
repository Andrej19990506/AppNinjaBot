import os
import logging
import json
import uuid
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timezone
import traceback
import asyncpg

logger = logging.getLogger(__name__)

# Функция-помощник для преобразования asyncpg.Record в dict
def _record_to_dict(record: asyncpg.Record) -> Optional[Dict]:
    return dict(record) if record else None

# --- Функция-помощник для сериализации данных с UUID и datetime --- 
def _prepare_data_for_json(data: Any) -> Any:
    """
    Рекурсивно преобразует UUID и datetime в строки в данных 
    перед JSON-сериализацией.
    """
    if isinstance(data, dict):
        sanitized_data = {}
        for key, value in data.items():
            sanitized_data[key] = _prepare_data_for_json(value) # Рекурсивный вызов
        return sanitized_data
    elif isinstance(data, list):
        return [_prepare_data_for_json(item) for item in data] # Рекурсивный вызов для списков
    elif isinstance(data, uuid.UUID):
        return str(data)
    elif isinstance(data, datetime):
        if data.tzinfo is None or data.tzinfo.utcoffset(data) is None:
             return data.isoformat()
        else:
            return data.astimezone(timezone.utc).isoformat()
    else:
        return data

class DatabaseService:
    """Сервис для работы с базой данных PostgreSQL для шедулера, использующий asyncpg"""
    
    def __init__(self, pool: asyncpg.Pool):
        """Инициализация сервиса с пулом соединений asyncpg"""
        self.pool = pool
        logger.info(f"✅ DatabaseService шедулера инициализирован с пулом соединений asyncpg")

    async def close_connection(self):
        """Закрывает пул соединений с базой данных"""
        logger.info("DatabaseService: закрытие пула соединений не требуется (управляется в lifespan)")
        return True

    async def check_tables_exist(self) -> bool:
        """Проверяет существование необходимых таблиц"""
        try:
            async with self.pool.acquire() as conn:
                # Проверка наличия таблицы scheduler_tasks
                exists = await conn.fetchval(
                    """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'scheduler_tasks'
                    );
                    """
                )
                
                if exists:
                    logger.info("✅ Таблица scheduler_tasks существует в PostgreSQL.")
                else:
                    logger.warning("⚠️ Таблица scheduler_tasks отсутствует в PostgreSQL! "
                                  "Убедитесь, что миграции Alembic были применены.")
                
                return exists
        except Exception as e:
            logger.error(f"❌ Ошибка при проверке таблиц: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def save_task(self, task_data: Dict[str, Any]) -> bool:
        """Сохраняет или обновляет задачу в базе данных PostgreSQL"""
        try:
            task_id = task_data['task_id']
            chat_id = task_data.get('chat_id')
            task_type = task_data['task_type']
            
            # Преобразуем next_run_time в timestamp с timezone
            next_run_time = task_data['next_run_time']
            if next_run_time.tzinfo is None:
                logger.warning(f"next_run_time для {task_id} не имеет таймзоны, предполагаем UTC.")
                next_run_time = next_run_time.replace(tzinfo=timezone.utc)
            else:
                next_run_time = next_run_time.astimezone(timezone.utc)
            
            # Данные задачи (словарь)
            data = task_data.get('data', {})
            # Подготовка данных перед сериализацией
            data_to_save = _prepare_data_for_json(data)
            data_json = json.dumps(data_to_save)
            
            async with self.pool.acquire() as conn:
                async with conn.transaction():
                    # Проверка существования задачи
                    exists = await conn.fetchval(
                        task_id
                    )
                    
                    if exists:
                        # Обновляем существующую задачу
                        await conn.execute(
                            task_id, chat_id, task_type, next_run_time, data_json
                        )
                        logger.debug(f"Обновлена задача с ID {task_id} в PostgreSQL")
                    else:
                        # Создаем новую задачу - УБИРАЕМ status
                        await conn.execute(
                            task_id, chat_id, task_type, next_run_time, data_json
                        )
                        logger.debug(f"Добавлена новая задача с ID {task_id} в PostgreSQL (без status)")
                    
                    return True
        except KeyError as e:
            logger.error(f"Ошибка сохранения задачи: отсутствует обязательное поле {e} в task_data")
            return False
        except Exception as e:
            # Добавим лог конкретной ошибки JSON
            if isinstance(e, TypeError) and "is not JSON serializable" in str(e):
                 logger.error(f"Ошибка JSON сериализации при сохранении задачи {task_data.get('task_id', 'N/A')}: {e}")
            else:
                 logger.error(f"Ошибка при сохранении задачи {task_data.get('task_id', 'N/A')}: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def get_all_active_tasks(self) -> List[Dict[str, Any]]:
        """Получает все активные задачи из PostgreSQL"""
        try:
            async with self.pool.acquire() as conn:
                now_aware = datetime.now(timezone.utc)
                
                # Получаем задачи с next_run_time >= текущего времени
                records = await conn.fetch(
                    """
                    SELECT task_id, chat_id, task_type, next_run_time, data, 
                           created_at, updated_at
                    FROM scheduler_tasks
                    WHERE next_run_time >= $1
                    """,
                    now_aware
                )
                
                tasks = []
                for record in records:
                    task = _record_to_dict(record)
                    # Преобразуем строку JSON обратно в словарь
                    if task.get('data'):
                        try:
                            # Убедимся, что data это строка перед json.loads
                            if isinstance(task['data'], str):
                                task['data'] = json.loads(task['data'])
                            # Если это уже dict (например, если asyncpg сам распарсил JSONB), оставляем как есть
                            elif not isinstance(task['data'], dict):
                                logger.warning(f"Неожиданный тип данных для 'data' в задаче {task.get('task_id')}: {type(task['data'])}")
                                task['data'] = {} # Заменяем на пустой dict
                        except json.JSONDecodeError:
                            logger.error(f"Ошибка декодирования JSON для 'data' в задаче {task.get('task_id')}")
                            task['data'] = {}
                    else:
                        task['data'] = {}
                        
                    # Приводим datetime к строке ISO формата
                    if task.get('next_run_time'):
                        # Убедимся, что это datetime объект перед вызовом isoformat
                        if isinstance(task['next_run_time'], datetime):
                            task['next_run_time'] = task['next_run_time'].isoformat()
                        else:
                            logger.warning(f"Неожиданный тип данных для 'next_run_time' в задаче {task.get('task_id')}: {type(task['next_run_time'])}")
                            # Пытаемся преобразовать в строку или оставляем как есть/None
                            task['next_run_time'] = str(task['next_run_time']) if task.get('next_run_time') else None
                            
                    if task.get('created_at') and isinstance(task['created_at'], datetime):
                        task['created_at'] = task['created_at'].isoformat()
                    if task.get('updated_at') and isinstance(task['updated_at'], datetime):
                        task['updated_at'] = task['updated_at'].isoformat()
                        
                    tasks.append(task)
                
                logger.debug(f"Получено {len(tasks)} активных задач из PostgreSQL")
                return tasks
        except Exception as e:
            logger.error(f"Ошибка при получении активных задач: {str(e)}")
            logger.error(traceback.format_exc())
            return []

    async def get_overdue_task_ids(self) -> List[str]:
        """Получает список ID просроченных задач из PostgreSQL."""
        overdue_task_ids = []
        try:
            async with self.pool.acquire() as conn:
                now_aware = datetime.now(timezone.utc)
                
                # Ищем задачи с next_run_time < текущего времени
                records = await conn.fetch(
                    """
                    SELECT task_id 
                    FROM scheduler_tasks
                    WHERE next_run_time < $1
                    """,
                    now_aware
                )
                
                overdue_task_ids = [record['task_id'] for record in records]
                logger.debug(f"Найдено {len(overdue_task_ids)} просроченных задач для удаления.")
                
        except Exception as e:
            logger.error(f"Ошибка при поиске просроченных задач: {str(e)}")
            logger.error(traceback.format_exc())
            # Возвращаем пустой список в случае ошибки, чтобы не удалить случайно что-то не то
            return [] 
            
        return overdue_task_ids

    async def delete_task(self, task_id: str) -> bool:
        """Удаляет задачу из PostgreSQL по ID"""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute("DELETE FROM scheduler_tasks WHERE task_id = $1", task_id)
                # Проверяем, была ли удалена строка
                deleted_count_str = result.split()[1] 
                if deleted_count_str == '0':
                    # Более точный лог
                    logger.warning(f"Задача {task_id} не найдена для удаления в БД (DELETE вернул 0).") 
                    return False
                
                logger.debug(f"Удалена задача с ID {task_id} из PostgreSQL")
                return True
        except Exception as e:
            logger.error(f"Ошибка при удалении задачи {task_id}: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def notify_websocket(self, channel: str, payload: Dict[str, Any]) -> bool:
        """Отправляет NOTIFY в указанный канал PostgreSQL для WebSocket сервиса"""

    async def notify_channel(self, channel: str, payload: Dict[str, Any]) -> bool:
        """Отправляет NOTIFY в указанный канал PostgreSQL.

        Args:
            channel: Имя канала PostgreSQL.
            payload: Словарь с данными для отправки (будет преобразован в JSON).

        Returns:
            True, если NOTIFY выполнен успешно, иначе False.
        """
        # Проверяем, что имя канала валидно (простая проверка)
        if not channel or not channel.isidentifier():
            logger.error(f"❌ Недопустимое имя канала для NOTIFY: '{channel}'")
            return False
            
        payload_json = "{}"
        try:
            # Преобразуем payload в JSON строку
            payload_json = json.dumps(payload).replace('\u0000', '') # Убираем нулевые байты

            # Проверка длины payload
            if len(payload_json.encode('utf-8')) >= 7999:
                logger.warning(f"Payload для NOTIFY канала '{channel}' слишком большой ({len(payload_json.encode('utf-8'))} байт), может быть обрезан PostgreSQL.")

            async with self.pool.acquire() as conn:
                escaped_payload = payload_json.replace("'", "''")
                # Формируем SQL запрос, вставляя payload как строковый литерал
                sql_query = f"NOTIFY \"{channel}\", '{escaped_payload}'"
                # Выполняем запрос без параметров
                await conn.execute(sql_query)
                # -------------------------------------------------------------------- #
                logger.info(f"✅ NOTIFY отправлен в канал '{channel}' с payload: {payload_json[:200]}{'...' if len(payload_json) > 200 else ''}")
                return True
        except json.JSONDecodeError as json_err:
            logger.error(f"❌ Ошибка кодирования payload в JSON для NOTIFY канала '{channel}': {json_err}")
            return False
        except asyncpg.PostgresError as pg_err:
            logger.error(f"❌ Ошибка PostgreSQL при отправке NOTIFY в канал '{channel}': {pg_err}")
            return False
        except Exception as e:
            logger.error(f"❌ Неизвестная ошибка при отправке NOTIFY в канал '{channel}': {e}")
            logger.error(traceback.format_exc())
            return False

    async def get_task_by_id(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Получает данные задачи по ее ID из таблицы scheduler_tasks."""
        if not self.pool:
            logger.error("Пул соединений не инициализирован.")
            return None
        conn = None
        try:
            async with self.pool.acquire() as conn:
                query = "SELECT * FROM scheduler_tasks WHERE task_id = $1"
                row = await conn.fetchrow(query, task_id)
                if row:
                    logger.info(f"Задача {task_id} найдена в БД.")
                    # Преобразуем запись в словарь
                    task_data = dict(row)
                    # Преобразуем JSONB 'data' обратно в dict, если не None
                    if task_data.get('data') and isinstance(task_data['data'], str):
                        try:
                            task_data['data'] = json.loads(task_data['data'])
                        except json.JSONDecodeError:
                            logger.error(f"Ошибка декодирования JSON для data задачи {task_id}")
                            task_data['data'] = {} # Возвращаем пустой dict
                    elif task_data.get('data') is None:
                         task_data['data'] = {} # Если data была NULL
                    return task_data
                else:
                    logger.warning(f"Задача {task_id} не найдена в БД.")
                    return None
        except asyncpg.PostgresError as db_err:
            logger.error(f"Ошибка БД при получении задачи {task_id}: {db_err}")
            return None
        except Exception as e:
            logger.error(f"Неожиданная ошибка при получении задачи {task_id}: {e}", exc_info=True)
            return None
        finally:
            # Соединение возвращается в пул автоматически через async with
            pass 

    async def update_task_next_run_time(self, task_id: str, next_run_time: datetime) -> bool:
        """Обновляет только next_run_time для существующей задачи в БД."""
        if not self.pool:
            logger.error("Пул соединений не инициализирован для update_task_next_run_time.")
            return False
        
        if not next_run_time:
            logger.warning(f"Попытка обновить next_run_time на None для задачи {task_id}. Пропуск.")
            return False # Не обновляем на None
            
        # Убедимся, что время aware и в UTC
        if next_run_time.tzinfo is None or next_run_time.tzinfo.utcoffset(next_run_time) is None:
            logger.warning(f"next_run_time для обновления задачи {task_id} не имеет таймзоны, предполагаем UTC.")
            next_run_time_utc = next_run_time.replace(tzinfo=timezone.utc)
        else:
            next_run_time_utc = next_run_time.astimezone(timezone.utc)

        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(
                    """
                    UPDATE scheduler_tasks 
                    SET next_run_time = $2, updated_at = CURRENT_TIMESTAMP 
                    WHERE task_id = $1
                    """,
                    task_id, next_run_time_utc
                )
                # Проверяем, была ли обновлена строка
                updated_count_str = result.split()[1] 
                if updated_count_str == '0':
                    logger.warning(f"Задача {task_id} не найдена для обновления next_run_time (UPDATE вернул 0).")
                    return False
                else:
                    logger.info(f"Успешно обновлен next_run_time для задачи {task_id} на {next_run_time_utc}")
                    return True
        except asyncpg.PostgresError as db_err:
            logger.error(f"Ошибка БД при обновлении next_run_time для задачи {task_id}: {db_err}")
            return False
        except Exception as e:
            logger.error(f"Неожиданная ошибка при обновлении next_run_time для задачи {task_id}: {e}", exc_info=True)
            return False

    async def notify_channel(self, channel: str, payload: Dict[str, Any]) -> bool:
        return False 
