from telegram.ext import Application, MessageHandler, filters, ChatMemberHandler, CommandHandler, CallbackQueryHandler
import asyncio
import logging
from telegramNinjaBot.config.config import Config
from telegramNinjaBot.services.database_service import DatabaseService
from telegramNinjaBot.handlers.group_handlers import GroupHandler
from telegramNinjaBot.handlers.message_handlers import MessageHandler as BotMessageHandler
from telegram.constants import ChatMemberStatus
from telegram import Update, Bot, MenuButton, MenuButtonWebApp, WebAppInfo
from telegram.ext import ContextTypes
import json
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import traceback
import os
import pickle
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException
from contextlib import asynccontextmanager
import uvicorn
from pydantic import BaseModel
import httpx # <-- Добавляем импорт
from telegramNinjaBot.handlers.common_handlers import handle_start, handle_webapp_data # handle_all_callbacks пока не используем
from telegramNinjaBot.core.logging_config import setup_logging
from telegramNinjaBot.core.lifespan import lifespan

# Импортируем и применяем конфигурацию логирования
setup_logging() # Вызываем настройку логирования ЗДЕСЬ, в самом начале

# Определяем текущее окружение
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

# Настраиваем базовое логирование на уровне ERROR для всех окружений
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Отключаем все лишние логи
logging.getLogger('httpx').setLevel(logging.ERROR)
logging.getLogger('telegram.ext.Application').setLevel(logging.ERROR)
logging.getLogger('apscheduler').setLevel(logging.ERROR)
logging.getLogger('asyncio').setLevel(logging.ERROR)
logging.getLogger('telegram').setLevel(logging.ERROR)

# Инициализируем логгер для этого модуля ПОСЛЕ настройки
logger = logging.getLogger(__name__)
# logger.setLevel(logging.INFO) # Уровень уже установлен в basicConfig
logger.info(f"Запуск main.py...") # Сообщение о запуске модуля

# Глобальные переменные для хранения экземпляров
bot_application = None # Пока оставим, может использоваться в broadcast_item_deletion
group_handler = None # Больше не нужен глобально? Инициализируется в lifespan
db_service = None   # Оставим глобально?
# group_service = None  # Адаптер больше не нужен


# +++ Создаем FastAPI приложение +++
app = FastAPI(
    title="NinjaBot Telegram Service", 
    version="1.0.0", 
    description="FastAPI сервис для Telegram бота NinjaBot",
    lifespan=lifespan
)

# +++ Подключаем роутер API +++
from telegramNinjaBot.api.routes import router as api_router
app.include_router(api_router) # Убираем префикс "/api"
logger.info("✅ Роутер API подключен")

# --- Добавляем эндпоинт /health --- 
@app.get("/health", tags=["System"], summary="Проверка состояния сервиса")
async def health_check():
    """Возвращает статус 'ok', если сервис работает."""
    return {"status": "ok"}
logger.info("✅ Эндпоинт /health добавлен")
# ---------------------------------

# --- Конец подключения роутера ---

# +++ Добавляем запуск через Uvicorn +++
if __name__ == "__main__":
    # Используем переменные окружения для хоста и порта
    host = os.getenv("BOT_HOST", "0.0.0.0")
    port = int(os.getenv("BOT_PORT", "8001")) # Используем порт 8001 по умолчанию
    # ENVIRONMENT теперь определяется в logging_config
    reload = os.getenv('ENVIRONMENT', 'development') == 'development' # Включаем reload только для development
    
    logger.info(f"Запуск FastAPI (Uvicorn) сервера на {host}:{port} {'с автоперезагрузкой' if reload else ''}...")
    uvicorn.run(
        "main:app", # Указываем на переменную app в этом файле (переименуй файл в main.py)
        host=host,
        port=port,
        reload=reload,
        log_level="info" # Можно настроить уровень логов uvicorn (или убрать, если хотим использовать только наш логгер)
    )