from dataclasses import dataclass
import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv
from typing import Union

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

# Тип бота: 'main' - основной бот приложения, 'company' - один бот компании, 'companies' - все боты компаний
BOT_TYPE = os.getenv('BOT_TYPE', 'main').lower()  # main, company или companies

# Конфигурация бота
# Для основного бота - токен из env, для ботов компаний - будет загружен из БД
BOT_TOKEN = os.getenv('BOT_TOKEN')  # Основной токен приложения (только для BOT_TYPE=main)

# Для ботов компаний: ID бота в таблице company_bots (опционально, можно искать по токену)
COMPANY_BOT_ID = os.getenv('COMPANY_BOT_ID', None)  # ID бота компании в БД

if BOT_TYPE == 'main':
    # Основной бот - токен обязателен
    if not BOT_TOKEN:
        raise ValueError("BOT_TOKEN не найден в .env файле для основного бота")
    print(f"Загруженный токен основного бота: {BOT_TOKEN[:20]}...")
elif BOT_TYPE == 'company':
    # Один бот компании - токен будет загружен из БД при старте
    print(f"Бот компании. Токен будет загружен из БД (ID: {COMPANY_BOT_ID or 'поиск по токену'})")
    # Если токен указан в env - используем его для поиска в БД
    if BOT_TOKEN:
        print(f"Токен из env будет использован для поиска в БД: {BOT_TOKEN[:20]}...")
elif BOT_TYPE == 'companies':
    # Все боты компаний - токены будут загружены из БД при старте
    print(f"Режим всех ботов компаний. Все активные боты будут загружены из БД автоматически")
else:
    raise ValueError(f"Неизвестный BOT_TYPE: {BOT_TYPE}. Должно быть 'main', 'company' или 'companies'")

DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
API_URL = os.getenv('API_URL', 'http://server:8000')  # Внутренний URL для запросов между сервисами
# Публичный URL для кнопок в Telegram (если не задан, используем API_URL, но для продакшена должен быть задан явно)
PUBLIC_API_URL = os.getenv('PUBLIC_API_URL') or os.getenv('API_URL', 'http://server:8000')
USE_DATABASE = os.getenv('USE_DATABASE', 'false').lower() == 'true'
SCHEDULER_API_URL = os.getenv('SCHEDULER_API_URL') # URL для API шедулера
print(f"Использование базы данных: {USE_DATABASE}")
print(f"API URL (внутренний): {API_URL}")
print(f"API URL (публичный): {PUBLIC_API_URL}")

# Пути к файлам данных
DATA_DIR = 'telegramNinjaBot/data'  # Используем путь относительно корня приложения
ADMINS_FILE = os.path.join(DATA_DIR, 'admins.json')
MEMBERS_FILE = os.path.join(DATA_DIR, 'members.json')

# Настройки вебхука
WEBHOOK_URL = os.getenv('WEBHOOK_URL') # Например, https://your.domain.com
WEBHOOK_PATH = os.getenv('WEBHOOK_PATH') # Например, /telegram/webhook или /telegram/<secret_token>
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET') # Опциональный секретный токен
WEB_APP_URL = os.getenv('WEB_APP_URL') # Загружаем URL веб-приложения
AUTH_BOT_USERNAME = os.getenv('AUTH_BOT_USERNAME', 'Flouix_bot') # Username основного бота для авторизации

if not WEBHOOK_URL:
    print("ПРЕДУПРЕЖДЕНИЕ: WEBHOOK_URL не задан в .env! Вебхуки не будут работать.")
    # Можно сделать raise ValueError, если вебхуки - единственный режим работы
    # raise ValueError("WEBHOOK_URL не найден в .env файле")

if not WEBHOOK_PATH:
    print("ПРЕДУПРЕЖДЕНИЕ: WEBHOOK_PATH не задан в .env! Вебхуки не будут работать.")
    # raise ValueError("WEBHOOK_PATH не найден в .env файле")

if not WEB_APP_URL:
    print("ПРЕДУПРЕЖДЕНИЕ: WEB_APP_URL не задан в .env! Кнопка веб-приложения может не работать.")

print(f"Webhook URL: {WEBHOOK_URL}")
print(f"Webhook Path: {WEBHOOK_PATH}")
print(f"Webhook Secret: {'Задан' if WEBHOOK_SECRET else 'Не задан'}")

# Настройки пула соединений БД (для asyncpg)
DB_POOL_MIN_SIZE = int(os.getenv('DB_POOL_MIN_SIZE', '1')) # Минимум 1 соединение
DB_POOL_MAX_SIZE = int(os.getenv('DB_POOL_MAX_SIZE', '10')) # Максимум 10 соединений

@dataclass
class Config:
    TOKEN: str = BOT_TOKEN  # Может быть None для ботов компаний, будет загружен из БД
    BOT_TYPE: str = BOT_TYPE  # 'main' или 'company'
    COMPANY_BOT_ID: Union[int, None] = int(COMPANY_BOT_ID) if COMPANY_BOT_ID else None
    DATA_DIR: str = DATA_DIR
    ADMINS_FILE: str = ADMINS_FILE
    MEMBERS_FILE: str = MEMBERS_FILE
    DEBUG: bool = DEBUG
    ENVIRONMENT: str = ENVIRONMENT
    API_URL: str = API_URL  # Внутренний URL для запросов между сервисами
    PUBLIC_API_URL: str = PUBLIC_API_URL  # Публичный URL для кнопок в Telegram
    USE_DATABASE: bool = USE_DATABASE
    # Добавляем настройки вебхука в dataclass
    WEBHOOK_URL: Union[str, None] = WEBHOOK_URL
    WEBHOOK_PATH: Union[str, None] = WEBHOOK_PATH
    WEBHOOK_SECRET: Union[str, None] = WEBHOOK_SECRET
    WEB_APP_URL: Union[str, None] = WEB_APP_URL # Добавляем URL веб-приложения в dataclass
    AUTH_BOT_USERNAME: str = AUTH_BOT_USERNAME # Username основного бота для авторизации
    # Добавляем настройки пула БД
    DB_POOL_MIN_SIZE: int = DB_POOL_MIN_SIZE
    DB_POOL_MAX_SIZE: int = DB_POOL_MAX_SIZE
    # <<< НОВОЕ ПОЛЕ >>>
    SCHEDULER_API_URL: Union[str, None] = SCHEDULER_API_URL

# Создаем экземпляр конфига для использования в других модулях
# (если импорт Config как класса неудобен)
# config_instance = Config() 