from dataclasses import dataclass
import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

# Ищем и загружаем .env файл
env_path = find_dotenv()
print(f"Найденный .env файл: {env_path}")

if not env_path:
    raise ValueError(".env файл не найден")

# Загружаем переменные окружения
load_dotenv(env_path)

# Конфигурация бота
BOT_TOKEN = os.getenv('BOT_TOKEN')
print(f"Загруженный токен: {BOT_TOKEN}")

if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN не найден в .env файле")

DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

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