import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncEngine

from alembic import context

# Добавляем путь к нашему проекту, чтобы импортировать модели
# Путь относительно директории alembic/ 
PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, PROJECT_DIR)

# Импортируем Base из наших моделей и все модели, чтобы Alembic их увидел
from models.base import Base
import models # Импортируем весь модуль models, чтобы все модели подтянулись

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

# Получаем DATABASE_URL из переменной окружения
# (Убедись, что она правильно формируется в твоем коде, например, в core/config.py)
def get_url():
    # Попробуем собрать URL из отдельных переменных, если DATABASE_URL нет
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "postgres") # Используем имя сервиса
    port = os.getenv("POSTGRES_PORT", 5432)
    db = os.getenv("POSTGRES_DB", "appninjabot")
    # Используем asyncpg драйвер
    default_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"
    return os.getenv("DATABASE_URL", default_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = AsyncEngine(engine_from_config(
        {
            "sqlalchemy.url": get_url(),
            "sqlalchemy.poolclass": pool.NullPool
        },
        prefix="sqlalchemy.",
        future=True
    ))

    async def run_async_migrations():
        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)
        await connectable.dispose()

    import asyncio
    asyncio.run(run_async_migrations())

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
