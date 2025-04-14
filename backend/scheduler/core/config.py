import os
from pydantic_settings import BaseSettings
from pathlib import Path
from dotenv import load_dotenv
from pydantic import Field, PostgresDsn, validator, AnyUrl
from typing import Optional, Any, Dict, List

# Ищем .env файл в текущей директории scheduler/ или выше
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

class SchedulerSettings(BaseSettings):
    # --- Настройки базы данных ---
    POSTGRES_HOST: str = Field(..., validation_alias='POSTGRES_HOST')
    POSTGRES_PORT: int = Field(5432, validation_alias='POSTGRES_PORT')
    POSTGRES_DB: str = Field(..., validation_alias='POSTGRES_DB')
    POSTGRES_USER: str = Field(..., validation_alias='POSTGRES_USER')
    POSTGRES_PASSWORD: str = Field(..., validation_alias='POSTGRES_PASSWORD')

    # Собираем URL для psycopg (для NOTIFY) и APScheduler
    # APScheduler тоже может использовать этот URL
    DATABASE_URL: Optional[str] = None

    # --- URL других сервисов ---
    API_URL: AnyUrl = Field(..., validation_alias='API_URL')
    BOT_URL: str = os.getenv("BOT_URL", "http://bot:8000")

    # --- Настройки планировщика ---
    TIMEZONE: str = Field("Europe/Moscow", validation_alias='TIMEZONE')

    # Настройки API Телеграм Бота (куда отправлять уведомления)
    BOT_API_URL: AnyUrl = Field(..., validation_alias='BOT_API_URL')

    # Настройки проверки доступности
    HEALTHCHECK_API_URL: AnyUrl = Field(..., validation_alias='HEALTHCHECK_API_URL')
    HEALTHCHECK_BOT_URL: AnyUrl = Field(..., validation_alias='HEALTHCHECK_BOT_URL')
    HEALTHCHECK_INTERVAL_SECONDS: int = Field(default=60, env='HEALTHCHECK_INTERVAL_SECONDS')
    
    # Настройки вебсокета (если нужно)
    WEBSOCKET_URL: str = Field(default='ws://websocket:8002/ws', env='WEBSOCKET_URL')
    WEBSOCKET_CHANNEL: str = Field(default='websocket_channel', env='WEBSOCKET_CHANNEL')

    # --- Настройки логирования ---
    LOG_LEVEL: str = Field("INFO", validation_alias='LOG_LEVEL')

    @validator("DATABASE_URL", pre=True, always=True)
    def assemble_db_connection(cls, v: Optional[str], values: Dict[str, Any]) -> str:
        if isinstance(v, str):
            return v
        dsn = PostgresDsn.build(
            scheme="postgresql+psycopg",
            username=values.get("POSTGRES_USER"),
            password=values.get("POSTGRES_PASSWORD"),
            host=values.get("POSTGRES_HOST"),
            port=values.get("POSTGRES_PORT"),
            path=f"/{values.get('POSTGRES_DB') or ''}",
        )
        return str(dsn)

    @validator("API_URL", "BOT_API_URL", "HEALTHCHECK_API_URL", "HEALTHCHECK_BOT_URL", pre=True)
    def url_to_string(cls, v: Any) -> str:
        if isinstance(v, AnyUrl):
            return str(v)
        return v

    class Config:
        case_sensitive = True
        # Можно указать .env файл явно, если он всегда лежит в папке scheduler
        # env_file = ".env"
        # env_file_encoding = 'utf-8'
        env_file = ('.env.prod', '.env.dev', '.env') 
        env_file_encoding = 'utf-8'
        extra = 'ignore' # Игнорировать лишние переменные в env

# Создаем экземпляр настроек для импорта в других модулях scheduler
scheduler_settings = SchedulerSettings()

# Логгирование для проверки загруженных настроек (опционально)
# import logging
# logger = logging.getLogger(__name__)
# logger.info(f"Загружены настройки планировщика: {scheduler_settings.model_dump()}")

# --- Опционально: Конфигурация логирования на основе настроек --- #
# import logging.config
# logging_config = {
#     'version': 1,
#     'disable_existing_loggers': False,
#     'formatters': {
#         'standard': {
#             'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
#         },
#     },
#     'handlers': {
#         'console': {
#             'level': scheduler_settings.LOG_LEVEL,
#             'formatter': 'standard',
#             'class': 'logging.StreamHandler',
#         },
#     },
#     'loggers': {
#         '': { # root logger
#             'handlers': ['console'],
#             'level': scheduler_settings.LOG_LEVEL,
#             'propagate': True
#         },
#         # Можно добавить конфигурации для конкретных логгеров
#         'apscheduler': {
#             'handlers': ['console'],
#             'level': 'WARNING', # Уменьшить шум от APScheduler
#             'propagate': False
#         },
#     }
# }
# logging.config.dictConfig(logging_config)