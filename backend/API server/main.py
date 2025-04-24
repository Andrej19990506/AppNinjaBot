from fastapi import FastAPI, Request, status, Depends
from dotenv import load_dotenv
import os
# Добавляем импорт CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
# Удаляем неиспользуемый импорт SessionLocal
from models.base import Base      # <<< ИСПРАВЛЕНО: Импорт из models.base
from core.config import settings    # <<< ИЗМЕНЕНО: Абсолютный импорт
# Удаляем старый импорт из routers
# from routers import users as user, reserve 
import logging
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
import redis.asyncio as redis

# Импортируем роутеры
# Удаляем старые импорты
# from .routers import couriers, users 
# Убираем префикс backend.API_server.
from api.v1.api import api_router as api_v1_router # Импортируем наш агрегатор V1
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

# ---> ДОБАВЛЕНИЕ: Настройка клиента Redis/DragonflyDB < ---
# Глобальная переменная для хранения клиента (или использовать state)
redis_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код, который выполняется при старте
    logger.info("Приложение запускается...")
    # Создаем таблицы при старте (если они не существуют)
    await create_tables()
    
    # ---> Инициализация Redis клиента < ---
    global redis_client
    redis_host = os.getenv("REDIS_HOST", "cache") # Имя сервиса из docker-compose
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    try:
        redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True) # decode_responses=True для строк
        await redis_client.ping() # Проверяем соединение
        logger.info(f"Успешное подключение к Redis/DragonflyDB по адресу {redis_host}:{redis_port}")
    except Exception as e:
        logger.error(f"Не удалось подключиться к Redis/DragonflyDB: {e}")
        redis_client = None # Устанавливаем в None, если не удалось подключиться
    # ---> Конец инициализации Redis < ---

    yield # Приложение работает

    # Код, который выполняется при остановке
    logger.info("Приложение останавливается...")
    # ---> Закрытие Redis клиента < ---
    if redis_client:
        await redis_client.close()
        logger.info("Соединение с Redis/DragonflyDB закрыто.")
    # ---> Конец закрытия Redis < ---

# ---> Создание экземпляра FastAPI с lifespan < ---
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs", # Стандартный путь для Swagger
    redoc_url=f"{settings.API_V1_STR}/redoc", # Стандартный путь для ReDoc
    lifespan=lifespan # Используем новый lifespan
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

# Подключаем ТОЛЬКО агрегированный роутер V1 с префиксом /api/v1
app.include_router(api_v1_router, prefix=settings.API_V1_STR)

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