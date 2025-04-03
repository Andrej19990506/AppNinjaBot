import psycopg2
from datetime import datetime
import json
import logging
from config.settings import DATABASE_URL
import pytz

logger = logging.getLogger(__name__)

class SchedulerTask:
    def __init__(self, task_id=None, chat_id=None, task_type=None, next_run_time=None, data=None):
        self.task_id = task_id
        self.chat_id = chat_id
        self.task_type = task_type  # 'reset', 'availability'
        self.next_run_time = next_run_time
        self.data = data or {}

    @staticmethod
    def create_table():
        """Создает таблицу scheduler_tasks если она не существует"""
        query = """
        CREATE TABLE IF NOT EXISTS scheduler_tasks (
            task_id VARCHAR(255) PRIMARY KEY,
            chat_id VARCHAR(255),
            task_type VARCHAR(50) NOT NULL,
            next_run_time TIMESTAMP WITH TIME ZONE,
            data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(query)
                conn.commit()
                logger.info("✅ Таблица scheduler_tasks успешно создана или уже существует")
        except Exception as e:
            logger.error(f"❌ Ошибка при создании таблицы scheduler_tasks: {str(e)}")
            raise

    @staticmethod
    def save(task):
        """Сохраняет или обновляет задачу в базе данных"""
        query = """
        INSERT INTO scheduler_tasks (task_id, chat_id, task_type, next_run_time, data, updated_at)
        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (task_id)
        DO UPDATE SET
            chat_id = EXCLUDED.chat_id,
            task_type = EXCLUDED.task_type,
            next_run_time = EXCLUDED.next_run_time,
            data = EXCLUDED.data,
            updated_at = CURRENT_TIMESTAMP;
        """
        try:
            # Убеждаемся, что у времени есть информация о часовом поясе
            if task.next_run_time and not task.next_run_time.tzinfo:
                timezone = pytz.timezone('Asia/Krasnoyarsk')
                next_run_time = timezone.localize(task.next_run_time)
            else:
                next_run_time = task.next_run_time

            # Больше не конвертируем в UTC, сохраняем в локальном часовом поясе
            # Убрано: next_run_time = next_run_time.astimezone(pytz.UTC)

            with psycopg2.connect(DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (
                        task.task_id,
                        task.chat_id,
                        task.task_type,
                        next_run_time,
                        json.dumps(task.data)
                    ))
                conn.commit()
                logger.info(f"✅ Задача {task.task_id} успешно сохранена")
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении задачи {task.task_id}: {str(e)}")
            return False

    @staticmethod
    def delete(task_id):
        """Удаляет задачу из базы данных"""
        query = "DELETE FROM scheduler_tasks WHERE task_id = %s;"
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (task_id,))
                conn.commit()
                logger.info(f"✅ Задача {task_id} успешно удалена")
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при удалении задачи {task_id}: {str(e)}")
            return False

    @staticmethod
    def get_by_id(task_id):
        """Получает задачу по ID"""
        query = "SELECT task_id, chat_id, task_type, next_run_time, data FROM scheduler_tasks WHERE task_id = %s;"
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (task_id,))
                    result = cur.fetchone()
                    if result:
                        return SchedulerTask(
                            task_id=result[0],
                            chat_id=result[1],
                            task_type=result[2],
                            next_run_time=result[3],
                            data=result[4]
                        )
                    return None
        except Exception as e:
            logger.error(f"❌ Ошибка при получении задачи {task_id}: {str(e)}")
            return None

    @staticmethod
    def get_all_active():
        """Получает все активные задачи (с next_run_time в будущем)"""
        query = """
        SELECT task_id, chat_id, task_type, next_run_time, data
        FROM scheduler_tasks
        WHERE next_run_time > CURRENT_TIMESTAMP
        ORDER BY next_run_time;
        """
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(query)
                    results = cur.fetchall()
                    tasks = []
                    for row in results:
                        tasks.append(SchedulerTask(
                            task_id=row[0],
                            chat_id=row[1],
                            task_type=row[2],
                            next_run_time=row[3],
                            data=row[4]
                        ))
                    return tasks
        except Exception as e:
            logger.error(f"❌ Ошибка при получении активных задач: {str(e)}")
            return []

    @staticmethod
    def get_by_chat_id(chat_id):
        """Получает все задачи для конкретного чата"""
        query = """
        SELECT task_id, chat_id, task_type, next_run_time, data
        FROM scheduler_tasks
        WHERE chat_id = %s AND next_run_time > CURRENT_TIMESTAMP
        ORDER BY next_run_time;
        """
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (chat_id,))
                    results = cur.fetchall()
                    tasks = []
                    for row in results:
                        tasks.append(SchedulerTask(
                            task_id=row[0],
                            chat_id=row[1],
                            task_type=row[2],
                            next_run_time=row[3],
                            data=row[4]
                        ))
                    return tasks
        except Exception as e:
            logger.error(f"❌ Ошибка при получении задач для чата {chat_id}: {str(e)}")
            return []

    @staticmethod
    def cleanup_expired():
        """Удаляет все просроченные задачи"""
        query = "DELETE FROM scheduler_tasks WHERE next_run_time < CURRENT_TIMESTAMP;"
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(query)
                conn.commit()
                logger.info("✅ Просроченные задачи успешно удалены")
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при удалении просроченных задач: {str(e)}")
            return False 