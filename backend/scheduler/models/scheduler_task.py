import json
import logging
from datetime import datetime, timezone
import os
from sqlalchemy import create_engine, Column, String, DateTime, JSON, select, delete, update
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.dialects.postgresql import JSONB # Используем JSONB для PostgreSQL
from sqlalchemy.exc import SQLAlchemyError
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# --- Параметры подключения к PostgreSQL (берем из окружения) ---
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'postgres') # Убедись, что это имя сервиса БД
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'appninjabot')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')
DATABASE_URL = f"postgresql+psycopg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
# -----------------------------------------------------------------

# Настройка SQLAlchemy
engine = create_engine(DATABASE_URL, echo=False) # echo=True для отладки SQL запросов
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SchedulerTaskDB(Base):
    """Модель SQLAlchemy для таблицы scheduler_tasks"""
    __tablename__ = 'scheduler_tasks'

    task_id = Column(String, primary_key=True, index=True)
    chat_id = Column(String, nullable=True, index=True)
    task_type = Column(String, nullable=False, index=True)
    # Используем DateTime(timezone=True) для хранения времени с таймзоной
    next_run_time = Column(DateTime(timezone=True), nullable=False, index=True)
    # Используем JSONB для эффективности в PostgreSQL
    data = Column(JSONB, nullable=True)
    # Время создания с таймзоной и значением по умолчанию на стороне БД
    created_at = Column(DateTime(timezone=True), nullable=False, server_default='now()')

    def to_dict(self):
        """Конвертирует объект SQLAlchemy в словарь"""
        return {
            "task_id": self.task_id,
            "chat_id": self.chat_id,
            "task_type": self.task_type,
            "next_run_time": self.next_run_time.isoformat() if self.next_run_time else None,
            "data": self.data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

def create_table_if_not_exists():
    """Создает таблицу задач, если она еще не существует"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info(f"Таблица {SchedulerTaskDB.__tablename__} проверена/создана в PostgreSQL.")
    except SQLAlchemyError as e:
        logger.error(f"Ошибка при создании таблицы {SchedulerTaskDB.__tablename__}: {e}")
        raise # Перебрасываем ошибку дальше, чтобы приложение не запустилось некорректно

@contextmanager
def get_db_session():
    """Контекстный менеджер для получения сессии SQLAlchemy"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except SQLAlchemyError as e:
        logger.error(f"Ошибка базы данных во время сессии: {e}")
        session.rollback()
        raise
    except Exception as e:
         logger.error(f"Непредвиденная ошибка во время сессии: {e}")
         session.rollback()
         raise
    finally:
        session.close()

# --- Переписываем методы для работы с SQLAlchemy ---

@staticmethod
def save_task(task_data):
    """
    Сохраняет или обновляет задачу в базе данных PostgreSQL.
    task_data должен быть словарем с полями:
    task_id, chat_id, task_type, next_run_time (datetime), data (dict)
    """
    with get_db_session() as session:
        try:
            task_id = task_data['task_id']
            existing_task = session.get(SchedulerTaskDB, task_id)

            # Убедимся, что next_run_time имеет таймзону UTC
            next_run_time_aware = task_data['next_run_time']
            if next_run_time_aware.tzinfo is None:
                 # Если нет таймзоны, предполагаем UTC (или таймзону по умолчанию?)
                 # Лучше, чтобы TaskManager передавал уже aware datetime
                 logger.warning(f"next_run_time для {task_id} не имеет таймзоны, предполагаем UTC.")
                 next_run_time_aware = next_run_time_aware.replace(tzinfo=timezone.utc)
            else:
                 # Конвертируем в UTC для единообразия хранения
                 next_run_time_aware = next_run_time_aware.astimezone(timezone.utc)


            if existing_task:
                # Обновляем существующую задачу
                existing_task.chat_id = task_data.get('chat_id')
                existing_task.task_type = task_data['task_type']
                existing_task.next_run_time = next_run_time_aware
                existing_task.data = task_data.get('data', {})
                logger.debug(f"Обновлена задача с ID {task_id} в PostgreSQL")
                session.add(existing_task) # Добавляем для обновления
            else:
                # Создаем новую задачу
                new_task = SchedulerTaskDB(
                    task_id=task_id,
                    chat_id=task_data.get('chat_id'),
                    task_type=task_data['task_type'],
                    next_run_time=next_run_time_aware,
                    data=task_data.get('data', {})
                    # created_at установится автоматически базой данных
                )
                logger.debug(f"Добавлена новая задача с ID {task_id} в PostgreSQL")
                session.add(new_task)

            session.flush() # Применяем изменения в рамках сессии
            return True # Возвращаем успех
        except KeyError as e:
            logger.error(f"Ошибка сохранения задачи: отсутствует обязательное поле {e} в task_data")
            return False
        except SQLAlchemyError as e:
            logger.error(f"Ошибка SQLAlchemy при сохранении задачи {task_data.get('task_id', 'N/A')}: {e}")
            return False # Возвращаем неудачу

@staticmethod
def get_all_active_tasks():
    """Получает все активные задачи из PostgreSQL"""
    with get_db_session() as session:
        try:
            now_aware = datetime.now(timezone.utc)
            stmt = select(SchedulerTaskDB).where(SchedulerTaskDB.next_run_time >= now_aware)
            results = session.execute(stmt).scalars().all()
            # Конвертируем в словари для совместимости (или TaskManager должен работать с объектами?)
            return [task.to_dict() for task in results]
        except SQLAlchemyError as e:
            logger.error(f"Ошибка SQLAlchemy при получении активных задач: {e}")
            return [] # Возвращаем пустой список при ошибке

@staticmethod
def delete_task(task_id):
    """Удаляет задачу из PostgreSQL по ID"""
    with get_db_session() as session:
        try:
            stmt = delete(SchedulerTaskDB).where(SchedulerTaskDB.task_id == task_id)
            result = session.execute(stmt)
            deleted = result.rowcount > 0
            if deleted:
                logger.debug(f"Удалена задача с ID {task_id} из PostgreSQL")
            return deleted
        except SQLAlchemyError as e:
            logger.error(f"Ошибка SQLAlchemy при удалении задачи {task_id}: {e}")
            return False # Возвращаем неудачу


# Добавляем возможность вызывать методы напрямую через класс (хотя лучше через TaskManager)
SchedulerTaskDB.save = save_task
SchedulerTaskDB.get_all_active = get_all_active_tasks
SchedulerTaskDB.delete = delete_task

# Создаем таблицу при импорте модуля (можно перенести в запуск приложения)
# create_table_if_not_exists() # <-- Пока закомментируем, вызовем из task_manager или app


# --- УДАЛЯЕМ СТАРЫЙ КОД ДЛЯ SQLITE ---
# class SchedulerTask:
# ... (весь старый класс) ...

# DB_PATH = os.getenv('SCHEDULER_DB_PATH', 'scheduler_tasks.db')
# ... (старые методы create_table, save, get_all_active, delete для SQLite) ... 