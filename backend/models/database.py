import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

class DatabaseService:
    """Сервис для работы с базой данных PostgreSQL"""
    
    def __init__(self):
        """Инициализация сервиса для работы с базой данных"""
        self.db_host = os.getenv('POSTGRES_HOST', 'postgres')
        self.db_port = os.getenv('POSTGRES_PORT', '5432')
        self.db_name = os.getenv('POSTGRES_DB', 'appninjabot')
        self.db_user = os.getenv('POSTGRES_USER', 'postgres')
        self.db_password = os.getenv('POSTGRES_PASSWORD', 'postgres')
        
        self.connection_string = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
        self.conn = None
        self.initialize_connection()
        
        # Создаем необходимые таблицы при инициализации
        self.create_tables()
        
        logger.info(f"✅ DatabaseService инициализирован. Подключение к базе: {self.db_host}:{self.db_port}/{self.db_name}")
    
    def initialize_connection(self):
        """Инициализирует соединение с базой данных"""
        try:
            self.conn = psycopg2.connect(
                host=self.db_host,
                port=self.db_port,
                dbname=self.db_name,
                user=self.db_user,
                password=self.db_password
            )
            logger.info("✅ Соединение с базой данных установлено")
        except Exception as e:
            logger.error(f"❌ Ошибка подключения к базе данных: {e}")
            raise

    def create_shifts_table(self):
        """Создает таблицу shifts для хранения данных о сменах"""
        try:
            with self.conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS shifts (
                        id VARCHAR(50) PRIMARY KEY,
                        user_id VARCHAR(50) NOT NULL,
                        date VARCHAR(50) NOT NULL,
                        shift_type VARCHAR(20) NOT NULL,
                        slot_index INTEGER NOT NULL,
                        chat_id VARCHAR(50) NOT NULL,
                        photo_url TEXT,
                        first_name TEXT,
                        last_name TEXT,
                        is_senior_courier BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        metadata JSONB DEFAULT '{}'::jsonb
                    );
                    
                    -- Индексы для быстрого поиска
                    CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
                    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
                    CREATE INDEX IF NOT EXISTS idx_shifts_chat_id ON shifts(chat_id);
                """)
                self.conn.commit()
                logger.info("✅ Таблица shifts успешно создана или уже существует")
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при создании таблицы shifts: {e}")
            self.conn.rollback()
            return False

    def create_tables(self):
        """Создает необходимые таблицы в базе данных"""
        try:
            with self.conn.cursor() as cursor:
                # Создаем таблицу access_settings если она не существует
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS access_settings (
                        id SERIAL PRIMARY KEY,
                        chat_id VARCHAR(255) UNIQUE NOT NULL,
                        allow_multiple_shifts BOOLEAN DEFAULT FALSE,
                        auto_approve BOOLEAN DEFAULT FALSE,
                        allow_same_day BOOLEAN DEFAULT FALSE,
                        registration_start_day INTEGER DEFAULT 1,
                        registration_start_hour INTEGER DEFAULT 0,
                        registration_start_minute INTEGER DEFAULT 0,
                        offset_type VARCHAR(50) DEFAULT 'days',
                        offset_amount INTEGER DEFAULT 7,
                        period_length INTEGER DEFAULT 7,
                        is_always_active BOOLEAN DEFAULT TRUE,
                        active_start_date VARCHAR(255),
                        active_end_date VARCHAR(255),
                        days_ahead INTEGER DEFAULT 14,
                        enabled_dates JSONB DEFAULT '[]'::jsonb,
                        restricted_users JSONB DEFAULT '[]'::jsonb,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                self.conn.commit()
                logger.info("✅ Таблица access_settings успешно создана или уже существует")
                
                # Создаем таблицу shifts
                self.create_shifts_table()
                
                logger.info("✅ Все необходимые таблицы успешно созданы или уже существуют")
        except Exception as e:
            logger.error(f"❌ Ошибка при создании таблиц: {e}")
            self.conn.rollback()
            raise

    def get_db(self):
        """Возвращает соединение с базой данных"""
        if self.conn is None or self.conn.closed:
            self.initialize_connection()
        return self.conn

# Создаем глобальный экземпляр сервиса базы данных
db = DatabaseService() 