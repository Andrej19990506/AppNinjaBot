import socketio
import engineio
import logging
import socket
from socketio import ASGIApp

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Получаем имя хоста и IP для диагностики
hostname = socket.gethostname()
try:
    ip_address = socket.gethostbyname(hostname)
except:
    ip_address = "unknown"

logger.info(f"📡 Хост: {hostname}, IP: {ip_address}")

# Конфигурация CORS и параметры сервера
ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost',
    'http://localhost:80'
]

# Создаем экземпляр Engine.IO сервера
eio = engineio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=ALLOWED_ORIGINS,
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1e8,
    allow_upgrades=True,
    upgrade_timeout=10000,
    cookie=None,
    always_connect=True,
    transports=['polling', 'websocket']
)

# Создаем экземпляр Socket.IO сервера
sio = socketio.AsyncServer(
    async_mode='asgi',
    engineio_server=eio,
    cors_allowed_origins=ALLOWED_ORIGINS,
    ping_timeout=180,
    ping_interval=60,
    max_http_buffer_size=1e8,
    allow_upgrades=True,
    upgrade_timeout=10000,
    cookie=None,
    always_connect=True,
    logger=True,
    engineio_logger=True
)

# Создаем ASGI приложение
app = ASGIApp(sio)

# Регистрируем отладочный обработчик для всех событий
@sio.on('*')
async def catch_all(event, sid, *args):
    logger.debug(f"🎯 Получено событие: {event}")
    logger.debug(f"🔑 SID: {sid}")
    logger.debug(f"📦 Данные: {args}")
    logger.debug("=" * 80)

# Логируем параметры инициализации
logger.info("✅ Socket.IO сервер инициализирован c параметрами:")
logger.info(f"🔒 CORS allowed origins: {ALLOWED_ORIGINS}")
logger.info(f"⏱️ Ping timeout: 180s, interval: 60s")
logger.info(f"🔄 Async mode: asgi")

# Проверяем все зарегистрированные обработчики
handlers = {ns: [event for event in sio.handlers[ns].keys() if not event.startswith('_')] 
           for ns in sio.handlers.keys()}
logger.info("=" * 80)
logger.info("📋 Зарегистрированные обработчики по namespace:")
for ns, events in handlers.items():
    logger.info(f"🔹 Namespace {ns}: {events}")
logger.info("=" * 80)

# Экспортируем приложение для uvicorn
__all__ = ['app', 'sio']

class DebugNamespace(socketio.AsyncNamespace):
    def trigger_event(self, event, *args):
        logger.debug(f"🎯 Триггер события {event} с аргументами: {args}")
        return super().trigger_event(event, *args) 