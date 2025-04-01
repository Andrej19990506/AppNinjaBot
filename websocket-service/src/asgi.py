import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("🚀 Инициализация asgi.py")

# Сначала импортируем websocket_handler для регистрации обработчиков
import src.websocket_handler
logger.info("✅ Обработчики WebSocket импортированы")

# Затем импортируем ASGI приложение
from src.server import socket_app as app
logger.info("✅ ASGI приложение импортировано")

# Проверяем регистрацию обработчиков
handlers = [handler for handler in src.websocket_handler.sio.handlers['/'].keys() if not handler.startswith('_')]
logger.info("=" * 80)
logger.info("🔍 Проверка регистрации обработчиков в asgi.py:")
logger.info(f"📋 Зарегистрированные обработчики: {handlers}")
logger.info(f"🎯 join_room обработчик: {'join_room' in handlers}")
logger.info("=" * 80) 