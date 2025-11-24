import os
from pathlib import Path
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Базовые пути
APP_DIR = Path('/app')
DATA_DIR = APP_DIR / 'data'

# Настройки сервера
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', 8001))

# Настройки PostgreSQL
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'postgres')
POSTGRES_PORT = int(os.getenv('POSTGRES_PORT', 5432))
POSTGRES_DB = os.getenv('POSTGRES_DB', 'appninjabot')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')

# URL для подключения к PostgreSQL
DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# Настройки CORS
# В dev режиме разрешаем все origins для React Native приложений
ENVIRONMENT = os.getenv('ENVIRONMENT', 'production')
if ENVIRONMENT == 'development':
    # В dev режиме разрешаем все origins (включая React Native без Origin заголовка)
    CORS_ALLOWED_ORIGINS = "*"  # Разрешаем все origins
else:
    # В production разрешаем конкретные origins для веб-приложений
    # React Native приложения не отправляют Origin заголовок, поэтому добавляем None для их поддержки
    CORS_ALLOWED_ORIGINS = [
        "http://192.168.0.115:3000",
        "http://localhost:3000",
        "http://localhost",
        "https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net",
        None  # Разрешаем запросы без Origin заголовка (для React Native приложений)
    ]

# Настройки WebSocket
WEBSOCKET_PING_INTERVAL = 25
WEBSOCKET_PING_TIMEOUT = 60
WEBSOCKET_MAX_BUFFER_SIZE = 1e8

# Настройки метрик
METRICS_PORT = int(os.getenv('METRICS_PORT', 9090))
