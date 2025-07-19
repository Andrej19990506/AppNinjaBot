from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from core.config import settings


async_engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False, # Поставим False по умолчанию
)

# Также создаем синхронный движок для синхронных операций
sync_database_url = settings.DATABASE_URL.replace("asyncpg", "psycopg2")
sync_engine = create_engine(
    sync_database_url,
    pool_pre_ping=True,
    echo=False,
)

# Создаем фабрику асинхронных сессий
AsyncSessionFactory = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False, # Важно для асинхронных сессий
    autocommit=False,
    autoflush=False,
)

# Создаем фабрику синхронных сессий
SyncSessionFactory = sessionmaker(
    bind=sync_engine,
    class_=Session,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db_session() -> AsyncSession:
    """
    Функция-зависимость FastAPI для получения асинхронной сессии БД.
    Гарантирует закрытие сессии после использования.
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit() # Коммитим изменения, если все прошло успешно
        except Exception:
            await session.rollback() # Откатываем в случае ошибки
            raise
        finally:
            await session.close() # Закрываем сессию

def get_db() -> Session:
    """
    Функция-зависимость FastAPI для получения синхронной сессии БД.
    Гарантирует закрытие сессии после использования.
    """
    with SyncSessionFactory() as session:
        try:
            yield session
            session.commit() # Коммитим изменения, если все прошло успешно
        except Exception:
            session.rollback() # Откатываем в случае ошибки
            raise
        finally:
            session.close() # Закрываем сессию 