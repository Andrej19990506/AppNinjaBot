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

from src.socket_instance import sio
import src.websocket_handler
from src.database import listen_for_notifications
from src.metrics import init_metrics

logger.info("🔄 Инициализация server.py (режим FastAPI/Uvicorn)")
logger.info("✅ Socket.IO и обработчики импортированы")

listener_task = None
listener_stop_event = None

@asynccontextmanager # <-- Возвращаем lifespan
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    global listener_task, listener_stop_event # Используем глобальные переменные
    try:
        logger.info("🚀 Запуск приложения")
        
       
        
        # --- Запускаем слушателя PostgreSQL --- 
        logger.info("🎧 Запуск PostgreSQL LISTEN/NOTIFY listener...")
        # Передаем экземпляр sio в слушателя
        listener_task, listener_stop_event = await listen_for_notifications(sio)
        logger.info("✅ PostgreSQL listener запущен в фоновом режиме.")
        
        yield
        
    except Exception as e:
        logger.error(f"❌ Ошибка при запуске: {e}")
        logger.exception("Полный стек ошибки:")
        raise
    finally:
        logger.info("👋 Завершение работы приложения")
        # --- Останавливаем слушателя PostgreSQL --- 
        if listener_task and listener_stop_event:
            logger.info("🛑 Остановка PostgreSQL LISTEN/NOTIFY listener...")
            listener_stop_event.set() # Подаем сигнал на остановку
            try:
                await asyncio.wait_for(listener_task, timeout=10.0) # Ждем завершения задачи
                logger.info("✅ PostgreSQL listener успешно остановлен.")
            except asyncio.TimeoutError:
                logger.warning("⚠️ PostgreSQL listener не остановился за 10 секунд, отменяем задачу...")
                listener_task.cancel()
            except Exception as stop_err:
                logger.error(f"❌ Ошибка при остановке PostgreSQL listener: {stop_err}")


# Создаем FastAPI приложение 
app = FastAPI(lifespan=lifespan)

# Подключаем метрики Prometheus 
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/health") 
async def health_check():
    """Эндпоинт для проверки здоровья сервиса"""
    return {"status": "ok"}


logger.info("📡 Создание Socket.IO ASGI приложения")
socket_app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=app, # Монтируем FastAPI приложение
    socketio_path='socket.io' # Указываем путь
)
logger.info("✅ Socket.IO ASGI приложение создано")



if __name__ == "__main__":
    logger.info(f"🌐 Запуск сервера на порту 8001") # <-- Возвращаем запуск Uvicorn

    uvicorn.run(
       
        "src.server:socket_app", 
        host="0.0.0.0",
        port=8001,
        reload=False,  # Отключаем автоперезагрузку
        log_level="info",
        workers=1
    )
