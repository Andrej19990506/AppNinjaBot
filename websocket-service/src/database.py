import os
import json
import logging
import asyncio
import select
from sqlalchemy import create_engine, Column, String, DateTime, Integer, JSON, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from dotenv import load_dotenv
import psycopg2

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Загрузка переменных окружения
load_dotenv()

# Получаем параметры подключения из переменных окружения
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'appninjabot')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')

# URL для подключения к базе данных
DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# Создаем движок SQLAlchemy
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ActiveUser(Base):
    __tablename__ = "active_users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String, index=True)
    room = Column(String, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    user_metadata = Column(JSONB, nullable=True)

async def init_db():
    """Инициализация базы данных"""
    try:
        # Проверяем существование таблиц
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        if "active_users" not in existing_tables:
            # Создаем таблицы только если их нет
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables created successfully")
        else:
            logger.info("Database tables already exist")
        
        # Создаем или обновляем триггер для уведомлений
        with engine.connect() as conn:
            # Создаем функцию notify_user_events (она будет заменена если существует)
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION notify_user_events()
                RETURNS trigger AS $$
                BEGIN
                    PERFORM pg_notify('user_events', row_to_json(NEW)::text);
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            """))
            
            # Проверяем существование триггера
            trigger_exists = conn.execute(text("""
                SELECT 1 FROM pg_trigger WHERE tgname = 'user_events_trigger';
            """)).scalar() is not None
            
            if not trigger_exists:
                conn.execute(text("""
                    CREATE TRIGGER user_events_trigger
                    AFTER INSERT OR UPDATE OR DELETE ON active_users
                    FOR EACH ROW EXECUTE FUNCTION notify_user_events();
                """))
                logger.info("Database trigger created successfully")
            else:
                logger.info("Database trigger already exists")
            
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

async def get_active_users_in_room(room: str):
    """Получение списка активных пользователей в комнате"""
    try:
        db = SessionLocal()
        users = db.query(ActiveUser).filter(ActiveUser.room == room).all()
        return [{"user_id": user.user_id, "metadata": user.user_metadata} for user in users]
    except Exception as e:
        logger.error(f"Error getting active users: {e}")
        return []
    finally:
        db.close()

async def add_user_to_room(user_id: str, room: str, metadata: dict = None):
    """Добавление пользователя в комнату"""
    try:
        db = SessionLocal()
        user = ActiveUser(user_id=user_id, room=room, user_metadata=metadata)
        db.merge(user)
        db.commit()
        
        # Отправляем уведомление через psycopg2
        conn = psycopg2.connect(DATABASE_URL)
        conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        notify_payload = json.dumps({
            "type": "user_join",
            "user_id": user_id,
            "room": room
        })
        cur.execute(f"NOTIFY user_events, %s", (notify_payload,))
        cur.close()
        conn.close()
        
        return True
    except Exception as e:
        logger.error(f"Error adding user to room: {e}")
        db.rollback()
        return False
    finally:
        db.close()

async def remove_user_from_room(user_id: str, room: str):
    """Удаление пользователя из комнаты"""
    try:
        db = SessionLocal()
        user = db.query(ActiveUser).filter(
            ActiveUser.user_id == user_id,
            ActiveUser.room == room
        ).first()
        
        if user:
            db.delete(user)
            db.commit()
            
            # Отправляем уведомление через psycopg2
            conn = psycopg2.connect(DATABASE_URL)
            conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
            cur = conn.cursor()
            notify_payload = json.dumps({
                "type": "user_leave",
                "user_id": user_id,
                "room": room
            })
            cur.execute(f"NOTIFY user_events, %s", (notify_payload,))
            cur.close()
            conn.close()
            
        return True
    except Exception as e:
        logger.error(f"Error removing user from room: {e}")
        db.rollback()
        return False
    finally:
        db.close()

async def subscribe_to_events(callback):
    """Подписка на события из PostgreSQL"""
    while True:
        try:
            # Создаем отдельное подключение для прослушивания уведомлений
            conn = psycopg2.connect(DATABASE_URL)
            conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
            cur = conn.cursor()
            cur.execute("LISTEN user_events;")
            
            logger.info("Started listening for PostgreSQL notifications")
            
            while True:
                if select.select([conn], [], [], 5) == ([], [], []):
                    continue
                
                conn.poll()
                while conn.notifies:
                    notify = conn.notifies.pop()
                    await callback(notify.payload)
                    
        except Exception as e:
            logger.error(f"Error in notification listener: {e}")
            await asyncio.sleep(5)  # Ждем перед повторным подключением
            
        finally:
            try:
                cur.close()
                conn.close()
            except:
                pass 