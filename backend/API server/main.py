from fastapi import FastAPI, Request, status, Depends
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
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger

# Импортируем роутеры
# Удаляем старые импорты
# from .routers import couriers, users 
# Убираем префикс backend.API_server.
from api.v1.api import api_router as api_v1_router # Импортируем наш агрегатор V1
from api.v1.endpoints import groups
from core.logging_config import setup_logging
from db.session import get_db_session, async_engine

# Загрузка переменных окружения из .env файла
# Убедись, что .env файл находится в корне проекта или укажи путь: load_dotenv(dotenv_path='path/to/.env')
load_dotenv() 

# Настройка логирования
setup_logging()

# Создание таблиц в базе данных (если они еще не созданы)
async def create_tables():
    async with async_engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all) # Раскомментировать для удаления таблиц
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables checked/created.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs", # Стандартный путь для Swagger
    redoc_url=f"{settings.API_V1_STR}/redoc", # Стандартный путь для ReDoc
    # Добавляем обработчик запуска для создания таблиц
    on_startup=[create_tables]
)

# Добавляем настройки CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost", "https://appninjabot.ru"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Добавляем middleware для доверия заголовкам прокси
@app.middleware("http")
async def trust_proxy_headers(request, call_next):
    # Всегда устанавливаем схему HTTPS для запросов от Cloudflare
    if "cf-connecting-ip" in request.headers:
        request.scope["scheme"] = "https"
    
    # Устанавливаем схему как HTTPS, если заголовок X-Forwarded-Proto указывает на это
    if "x-forwarded-proto" in request.headers:
        request.scope["scheme"] = request.headers["x-forwarded-proto"]
    
    # Также обрабатываем заголовок X-Forwarded-Ssl
    if "x-forwarded-ssl" in request.headers and request.headers["x-forwarded-ssl"].lower() == "on":
        request.scope["scheme"] = "https"
    
    # Продолжаем обработку запроса
    response = await call_next(request)
    return response

@app.get("/")
async def root():
    return {"message": "API server is running"}

@app.get("/health")
async def health_check():
    """Эндпоинт для проверки состояния API."""
    return {"status": "ok"}

# Подключаем роутеры с общим префиксом /api
# Удаляем старые подключения
# app.include_router(users.router, prefix="/api")
# app.include_router(couriers.router, prefix="/api")

# Подключаем роутер V1 с префиксом /api/v1
app.include_router(api_v1_router, prefix=settings.API_V1_STR)

# Включаем роутеры
app.include_router(user.router, prefix="/api/v1/users", tags=["users"])
app.include_router(reserve.router, prefix="/api/v1/reserves", tags=["reserves"]) # Регистрируем новый роутер

# TODO: Подключить другие роутеры (списания, инвентаризация) по мере их создания
# from .routers import writeoffs, inventory
# app.include_router(writeoffs.router, prefix="/api")
# app.include_router(inventory.router, prefix="/api")

# Роутеры
app.include_router(groups.router, prefix=settings.API_V1_STR + "/groups", tags=["groups"])

# Глобальный обработчик ошибок валидации
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Здесь должна быть логика обработки ошибки
    # Например, логирование и возврат стандартизированного ответа
    errors = []
    for error in exc.errors():
        errors.append({
            "loc": error["loc"],
            "msg": error["msg"],
            "type": error["type"],
        })
    logger.error(f"Validation error for {request.url.path}: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors},
    )

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