import os
from pathlib import Path

# Базовые пути
APP_DIR = Path('/app')  # Корневая директория приложения
DATA_DIR = APP_DIR / 'data'  # /app/data
TEMPLATES_DIR = DATA_DIR / 'templates'  # /app/data/templates
INVENTORY_DIR = DATA_DIR / 'inventory'  # /app/data/inventory
BOT_DATA_DIR = APP_DIR / 'telegramNinjaBot' / 'data'  # Путь к данным бота

# Настройки API
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')
BOT_URL = os.getenv('BOT_URL', 'http://bot:8001')
SCHEDULER_URL = os.getenv('SCHEDULER_URL', 'http://scheduler:8002')

# Настройки CORS
CORS_ALLOWED_ORIGINS = [
    "https://reform-hand-simple-invisible.trycloudflare.com",
    "https://pearl-roy-hugo-equity.trycloudflare.com",
    "http://localhost:3000"
]

# Настройки сервера
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', 8000))

# Настройки WebSocket
WEBSOCKET_PING_INTERVAL = 25
WEBSOCKET_PING_TIMEOUT = 60
WEBSOCKET_MAX_BUFFER_SIZE = 1e8 