import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional, List

# --- Загружаем переменные окружения ---
env_path = Path('.') / '.env' 
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    # --- Настройки базы данных ---
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

    # --- Настройки FastAPI ---
    API_V1_STR: str = "/api/v1" 
    PROJECT_NAME: str = "AppNinjaBot API"
    PROJECT_VERSION: str = "0.1.0"

    # --- Настройки RetailiQA API ---
    RETAILIQA_API_BASE_URL: str = os.getenv("RETAILIQA_API_BASE_URL", "https://api.retailiqa.ru/api/v2") # Пример URL, замените если нужно
    RETAILIQA_TOKEN: Optional[str] = os.getenv("RETAILIQA_TOKEN", "7e20cab58a5d4b06b6a55424f0127731") # Ваш токен
    RETAILIQA_API_TIMEOUT: int = int(os.getenv("RETAILIQA_API_TIMEOUT", 15)) # Таймаут в секундах

    # --- Настройки Telegram Bot Service ---
    # Для ботов компаний используем bot-companies, для основного бота - bot-main
    BOT_SERVICE_URL: str = os.getenv("BOT_SERVICE_URL", "http://bot-companies:8003") # URL сервиса бота

    # --- Настройки авторизации через Telegram ---
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_ADDITIONAL_BOT_TOKENS: str = os.getenv("TELEGRAM_ADDITIONAL_BOT_TOKENS", "")
    TELEGRAM_ALLOWED_BOTS: str = os.getenv("TELEGRAM_ALLOWED_BOTS", "")
    TELEGRAM_INITDATA_MAX_AGE: int = int(os.getenv("TELEGRAM_INITDATA_MAX_AGE", 600))

    # --- Настройки JWT ---
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change_me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 900))  # 15 минут
    JWT_REFRESH_TOKEN_EXPIRES: int = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", 60 * 60 * 24 * 7))  # 7 дней
    
    # --- Настройки окружения ---
    ENV: str = os.getenv("ENV", "production")  # development или production

    @property
    def telegram_bot_tokens(self) -> List[str]:
        tokens: List[str] = []
        if self.TELEGRAM_BOT_TOKEN:
            tokens.append(self.TELEGRAM_BOT_TOKEN.strip())
        if self.TELEGRAM_ADDITIONAL_BOT_TOKENS:
            tokens.extend(
                [
                    token.strip()
                    for token in self.TELEGRAM_ADDITIONAL_BOT_TOKENS.split(",")
                    if token.strip()
                ]
            )
        return tokens

    @property
    def telegram_allowed_bots(self) -> List[str]:
        if not self.TELEGRAM_ALLOWED_BOTS:
            return []
        return [
            bot.strip().lower()
            for bot in self.TELEGRAM_ALLOWED_BOTS.split(",")
            if bot.strip()
        ]

    class Config:
        case_sensitive = True


# Создаем экземпляр настроек для импорта в других модулях
settings = Settings() 