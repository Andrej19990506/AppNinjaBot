import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

logger = logging.getLogger(__name__)

def init_db():
    """
    Проверяет подключение к базе данных.
    Создание таблиц осуществляется через Alembic миграции в API сервере.
    """
    # Получаем параметры подключения из переменных окружения
    db_host = os.getenv('POSTGRES_HOST', 'postgres')
    db_port = os.getenv('POSTGRES_PORT', '5432')
    db_name = os.getenv('POSTGRES_DB', 'appninjabot')
    db_user = os.getenv('POSTGRES_USER', 'postgres')
    db_password = os.getenv('POSTGRES_PASSWORD', 'postgres')
    
    try:
        # Устанавливаем соединение с базой данных
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=db_user,
            password=db_password
        )
        
        logger.info(f"✅ Подключение к базе данных успешно проверено: {db_host}:{db_port}/{db_name}")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при подключении к базе данных: {e}")
        return False
    finally:
        if 'conn' in locals() and conn is not None:
            conn.close()

@contextmanager
def db_connection():
    """
    Контекстный менеджер для работы с соединением базы данных.
    Автоматически закрывает соединение после использования.
    
    Пример использования:
    ```
    with db_connection() as conn:
        # работа с соединением
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT * FROM scheduler_tasks")
            results = cursor.fetchall()
    ```
    """
    # Получаем параметры подключения из переменных окружения
    db_host = os.getenv('POSTGRES_HOST', 'postgres')
    db_port = os.getenv('POSTGRES_PORT', '5432')
    db_name = os.getenv('POSTGRES_DB', 'appninjabot')
    db_user = os.getenv('POSTGRES_USER', 'postgres')
    db_password = os.getenv('POSTGRES_PASSWORD', 'postgres')
    
    conn = None
    try:
        # Устанавливаем соединение с базой данных
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=db_user,
            password=db_password
        )
        yield conn
    except Exception as e:
        logger.error(f"❌ Ошибка при работе с базой данных: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close() 