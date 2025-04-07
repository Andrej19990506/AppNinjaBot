from fastapi import FastAPI
from dotenv import load_dotenv
import os
# Добавляем импорт CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
# Удаляем неиспользуемый импорт SessionLocal
from models.base import Base      # <<< ИСПРАВЛЕНО: Импорт из models.base
from core.config import settings    # <<< ИЗМЕНЕНО: Абсолютный импорт
from routers import users as user, reserve # <<< ИЗМЕНЕНО: Используем существующий файл users.py как user
import logging

# Импортируем роутеры
# Удаляем старые импорты
# from .routers import couriers, users 
# Убираем префикс backend.API_server.
from api.v1.api import api_router as api_v1_router # Импортируем наш агрегатор V1

# Загрузка переменных окружения из .env файла
# Убедись, что .env файл находится в корне проекта или укажи путь: load_dotenv(dotenv_path='path/to/.env')
load_dotenv() 

app = FastAPI(
    title="AppNinjaBot API",
    description="API для сервиса AppNinjaBot (FastAPI).",
    version="0.1.0",
    openapi_url="/api/openapi.json", # Путь к OpenAPI схеме
    docs_url="/api/docs", # Путь к Swagger UI
    redoc_url="/api/redoc" # Путь к ReDoc
)

# Настройка CORS
# Источники, которым разрешено отправлять запросы
# В production тут должен быть URL твоего frontend
origins = [
    "http://localhost:3000", # Для React dev server
    "http://localhost",      # Если frontend доступен через Nginx на 80 порту локально
    # "https://your_frontend_domain.com", # Добавить в production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Разрешенные источники
    allow_credentials=True, # Разрешить cookies/авторизацию
    allow_methods=["*"],    # Разрешить все стандартные методы (GET, POST, etc.)
    allow_headers=["*"],    # Разрешить все заголовки
)

@app.get("/")
async def read_root():
    """Корневой эндпоинт для проверки работы API."""
    return {"message": "Добро пожаловать в AppNinjaBot API (FastAPI)!"}

@app.get("/health")
async def health_check():
    """Эндпоинт для проверки состояния API."""
    return {"status": "ok"}

# Подключаем роутеры с общим префиксом /api
# Удаляем старые подключения
# app.include_router(users.router, prefix="/api")
# app.include_router(couriers.router, prefix="/api")

# Подключаем роутер V1 с префиксом /api/v1
app.include_router(api_v1_router, prefix="/api/v1")

# Инициализация базы данных (опционально, если у вас есть такой механизм)
# init_db()

# Включаем роутеры
app.include_router(user.router, prefix="/api/v1/users", tags=["users"])
app.include_router(reserve.router, prefix="/api/v1/reserves", tags=["reserves"]) # Регистрируем новый роутер

# TODO: Подключить другие роутеры (списания, инвентаризация) по мере их создания
# from .routers import writeoffs, inventory
# app.include_router(writeoffs.router, prefix="/api")
# app.include_router(inventory.router, prefix="/api")

# Пример обработчика ошибок валидации Pydantic
# ... (exception_handlers)

if __name__ == "__main__":
    import uvicorn
    # Получаем хост и порт из переменных окружения или используем значения по умолчанию
    host = os.getenv("FASTAPI_HOST", "127.0.0.1")
    # Используем порт 8000
    port = int(os.getenv("FASTAPI_PORT", "8000")) 
    
    print(f"🚀 Starting FastAPI server on http://{host}:{port}")
    uvicorn.run(
        "main:app",
        host=host, 
        port=port, 
        reload=True
    ) 