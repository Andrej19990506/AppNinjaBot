import os
from pathlib import Path

# Определение окружения
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
IS_PRODUCTION = ENVIRONMENT == 'production'

# Настройки базы данных
DB_HOST = os.getenv('DB_HOST', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'appninjabot')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Базовые пути
APP_DIR = Path('/app')  # Корневая директория приложения
DATA_DIR = APP_DIR / 'data'  # /app/data
TEMPLATES_DIR = DATA_DIR / 'templates'  # /app/data/templates
INVENTORY_DIR = DATA_DIR / 'inventory'  # /app/data/inventory
BOT_DATA_DIR = APP_DIR / 'telegramNinjaBot' / 'data'  # Путь к данным бота

# Настройки API
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000' if not IS_PRODUCTION else None)
BOT_URL = os.getenv('BOT_URL', 'http://bot:8001' if not IS_PRODUCTION else None)
SCHEDULER_URL = os.getenv('SCHEDULER_URL', 'http://scheduler:8002' if not IS_PRODUCTION else None)
WEBSOCKET_SERVER_URL = os.getenv('WEBSOCKET_SERVER_URL', 'http://websocket:8003' if not IS_PRODUCTION else None)

if IS_PRODUCTION and (not API_BASE_URL or not BOT_URL or not SCHEDULER_URL or not WEBSOCKET_SERVER_URL):
    raise ValueError("In production, API_BASE_URL, BOT_URL, SCHEDULER_URL and WEBSOCKET_SERVER_URL must be set via environment variables")

# Настройки сервера
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', 8000))

# Настройки WebSocket
WEBSOCKET_PING_INTERVAL = int(os.getenv('WEBSOCKET_PING_INTERVAL', 25))
WEBSOCKET_PING_TIMEOUT = int(os.getenv('WEBSOCKET_PING_TIMEOUT', 60))
WEBSOCKET_MAX_BUFFER_SIZE = int(os.getenv('WEBSOCKET_MAX_BUFFER_SIZE', 1e8))

# Настройки безопасности
TELEGRAM_API_ALLOWED_HOSTS = ['api.telegram.org']
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB по умолчанию

# Настройки CORS и безопасности
TRUST_PROXY = os.getenv('TRUST_PROXY', 'true').lower() == 'true'
CORS_ALLOWED_ORIGINS = ['*'] if IS_PRODUCTION else [
    'http://localhost:3000',
    'http://localhost',
    'http://localhost:80'
]

# Настройки для rate limiting
RATE_LIMIT_DEFAULT = "100 per minute"
RATE_LIMIT_STRICT = "30 per minute"

# Настройки для JWT
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))  # 1 час

if IS_PRODUCTION and not JWT_SECRET_KEY:
    raise ValueError("In production, JWT_SECRET_KEY must be set via environment variable")

# Проверка и создание необходимых директорий
REQUIRED_DIRS = [DATA_DIR, TEMPLATES_DIR, INVENTORY_DIR, BOT_DATA_DIR]
for dir_path in REQUIRED_DIRS:
    dir_path.mkdir(parents=True, exist_ok=True) 