from dataclasses import dataclass
import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

# Определяем окружение
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
print(f"Текущее окружение: {ENVIRONMENT}")

# Ищем и загружаем .env файл
env_files = {
    'development': '.env.dev',
    'production': '.env.prod',
    'default': '.env'
}

env_file = env_files.get(ENVIRONMENT, '.env')
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), env_file)

if os.path.exists(env_path):
    print(f"Используемый .env файл: {env_path}")
    load_dotenv(env_path)
else:
    # Пробуем найти любой доступный .env файл
    env_path = find_dotenv()
    print(f"Найденный .env файл: {env_path}")
    load_dotenv(env_path)

# Конфигурация бота
BOT_TOKEN = os.getenv('BOT_TOKEN')
print(f"Загруженный токен: {BOT_TOKEN}")

if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN не найден в .env файле")

DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
API_URL = os.getenv('API_URL', 'http://server:8000')

# Пути к файлам данных
DATA_DIR = 'telegramNinjaBot/data'  # Используем путь относительно корня приложения
ADMINS_FILE = os.path.join(DATA_DIR, 'admins.json')
MEMBERS_FILE = os.path.join(DATA_DIR, 'members.json')

@dataclass
class Config:
    TOKEN: str = BOT_TOKEN
    DATA_DIR: str = DATA_DIR
    ADMINS_FILE: str = ADMINS_FILE
    MEMBERS_FILE: str = MEMBERS_FILE
    DEBUG: bool = DEBUG
    ENVIRONMENT: str = ENVIRONMENT
    API_URL: str = API_URL 