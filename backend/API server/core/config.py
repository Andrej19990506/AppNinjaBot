import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional

# Определяем путь к корневой директории проекта (где может лежать .env)
# Исходя из структуры, API server/ находится внутри backend/
# Значит, корень проекта на два уровня выше
# Либо можно ожидать .env файл прямо в API server/
# Пока оставим простой вариант - ищем .env в текущей и родительских директориях
env_path = Path('.') / '.env' 
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    # --- Настройки базы данных ---
    # Берем те же переменные окружения, что использовались в старом коде
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", 5432))
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "appninjabot")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")

    # Собираем URL для асинхронного драйвера asyncpg
    DATABASE_URL: str = (
        f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@"
        f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )

    # --- Настройки FastAPI (если нужны) ---
    API_V1_STR: str = "/api/v1" # Пример префикса для версионирования API
    PROJECT_NAME: str = "AppNinjaBot API"
    PROJECT_VERSION: str = "0.1.0"

    # --- Настройки RetailiQA API ---
    RETAILIQA_API_BASE_URL: str = os.getenv("RETAILIQA_API_BASE_URL", "https://api.retailiqa.ru/api/v2") # Пример URL, замените если нужно
    RETAILIQA_TOKEN: Optional[str] = os.getenv("RETAILIQA_TOKEN", "7e20cab58a5d4b06b6a55424f0127731") # Ваш токен
    RETAILIQA_API_TIMEOUT: int = int(os.getenv("RETAILIQA_API_TIMEOUT", 15)) # Таймаут в секундах

    # --- Настройки JWT (позже) ---
    # JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "default_secret")
    # JWT_ALGORITHM: str = "HS256"
    # JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 неделя

    class Config:
        case_sensitive = True
        # Если .env файл лежит не рядом с config.py, можно указать путь:
        # env_file = ".env"
        # env_file_encoding = 'utf-8'

# Создаем экземпляр настроек для импорта в других модулях
settings = Settings() 