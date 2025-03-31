import os
import logging
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from prometheus_client import make_asgi_app
from prometheus_client import Counter, Gauge, REGISTRY
import socketio
from src.socket_instance import sio
from src.websocket_handler import start_notification_listener
from src.database import init_db

from src.config.settings import CORS_ALLOWED_ORIGINS, PORT, METRICS_PORT

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Метрики
connected_clients = None
messages_sent = None

def init_metrics():
    """Инициализация метрик Prometheus"""
    global connected_clients, messages_sent
    
    # Проверяем, не существуют ли уже метрики
    if 'websocket_connected_clients' not in REGISTRY._collector_to_names:
        connected_clients = Gauge('websocket_connected_clients', 'Number of connected clients')
    if 'websocket_messages_sent' not in REGISTRY._collector_to_names:
        messages_sent = Counter('websocket_messages_sent', 'Number of messages sent')

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    try:
        # Инициализируем метрики
        init_metrics()
        
        # Инициализируем базу данных
        await init_db()
        
        # Запускаем слушатель уведомлений в фоновом режиме
        asyncio.create_task(start_notification_listener())
        
        logger.info("Starting WebSocket server on port 8001")
        yield
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down WebSocket server")

# Создаем FastAPI приложение с lifespan
app = FastAPI(title="WebSocket Service", lifespan=lifespan)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Подключаем метрики Prometheus
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/health")
async def health_check():
    """Эндпоинт для проверки здоровья сервиса"""
    return {"status": "ok"}

# Обработчики Socket.IO событий
@sio.event
async def connect(sid, environ):
    """Обработчик подключения клиента"""
    logger.info(f"Client connected: {sid}")
    if connected_clients:
        connected_clients.inc()
    await sio.emit('message', {'data': 'Connected successfully'}, room=sid)

@sio.event
async def disconnect(sid):
    """Обработчик отключения клиента"""
    logger.info(f"Client disconnected: {sid}")
    if connected_clients:
        connected_clients.dec()

@sio.event
async def message(sid, data):
    """Обработчик получения сообщения"""
    logger.info(f"Message from {sid}: {data}")
    if messages_sent:
        messages_sent.inc()
    await sio.emit('message', {'data': f'Server received: {data}'}, room=sid)

@sio.event
async def join_room(sid, data):
    """Обработчик присоединения к комнате"""
    room = data.get('room')
    if room:
        sio.enter_room(sid, room)
        await sio.emit('room_joined', {'room': room}, room=sid)

@sio.event
async def leave_room(sid, room):
    """Обработчик выхода из комнаты"""
    sio.leave_room(sid, room)
    await sio.emit('room_left', {'room': room}, room=sid)

# Создаем ASGI приложение с Socket.IO
socket_app = socketio.ASGIApp(
    sio,
    app,
    socketio_path='socket.io',
    static_files={
        '/': './static/index.html'
    }
)

if __name__ == "__main__":
    uvicorn.run(
        "asgi:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    ) 