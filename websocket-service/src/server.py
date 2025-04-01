import os
import logging
import asyncio
from fastapi import FastAPI
from contextlib import asynccontextmanager
import uvicorn
from prometheus_client import make_asgi_app
import socketio

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Импортируем socket_instance и websocket_handler ПЕРЕД созданием приложения
from src.socket_instance import sio
# Важно: импортируем websocket_handler целиком для регистрации всех обработчиков
import src.websocket_handler
from src.database import init_db
from src.metrics import init_metrics

logger.info("🔄 Инициализация server.py")
logger.info("✅ Socket.IO и обработчики импортированы")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    try:
        logger.info("🚀 Запуск приложения")
        
        # Инициализируем метрики
        logger.info("📊 Инициализация метрик")
        init_metrics()
        
        # Инициализируем базу данных
        logger.info("💾 Инициализация базы данных")
        await init_db()
        
        # Проверяем регистрацию обработчиков
        handlers = [handler for handler in sio.handlers['/'].keys() if not handler.startswith('_')]
        logger.info("=" * 80)
        logger.info("🔍 Проверка регистрации обработчиков в server.py:")
        logger.info(f"📋 Зарегистрированные обработчики: {handlers}")
        logger.info(f"🎯 join_room обработчик: {'join_room' in handlers}")
        logger.info("=" * 80)
        
        yield
        
    except Exception as e:
        logger.error(f"❌ Ошибка при запуске: {e}")
        logger.exception("Полный стек ошибки:")
        raise
    finally:
        logger.info("👋 Завершение работы приложения")

# Создаем FastAPI приложение
app = FastAPI(lifespan=lifespan)

# Подключаем метрики Prometheus
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/health")
async def health_check():
    """Эндпоинт для проверки здоровья сервиса"""
    return {"status": "ok"}

# Создаем Socket.IO приложение ПОСЛЕ регистрации всех обработчиков
logger.info("📡 Создание Socket.IO ASGI приложения")
socket_app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=app,
    socketio_path='socket.io'
)
logger.info("✅ Socket.IO ASGI приложение создано")

if __name__ == "__main__":
    logger.info(f"🌐 Запуск сервера на порту 8001")
    uvicorn.run(
        "src.asgi:app",
        host="0.0.0.0",
        port=8001,
        reload=False,  # Отключаем автоперезагрузку
        log_level="info",
        workers=1
    ) 