import asyncio
from fastapi import FastAPI, Request, status, Depends
from dotenv import load_dotenv
import os
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from models.base import Base
from core.config import settings
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from loguru import logger
import redis.asyncio as redis
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
import time

# Импортируем метрики для их инициализации (метрики инициализируются при импорте)
from core import metrics

from api.v1.api import api_router as api_v1_router # Импортируем наш агрегатор V1
from core.logging_config import setup_logging
from db.session import get_db_session, async_engine

# Загрузка переменных окружения из .env файла
load_dotenv() 

# Настройка логирования
setup_logging()

# Создание таблиц в базе данных (если они еще не созданы)
async def create_tables():
    # Отключаем автоматическое создание таблиц, так как используем Alembic миграции
    # и есть проблемы с дублированием индексов
    logger.info("Database tables creation skipped - using Alembic migrations.")
    pass


redis_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код, который выполняется при старте
    logger.info("Приложение запускается...")
    
    # Метрики Prometheus уже инициализированы при импорте модуля
    logger.info("Метрики Prometheus инициализированы")
    
    # Создаем таблицы при старте (если они не существуют)
    await create_tables()
    
    # ---> Инициализация Redis клиента < ---
    global redis_client
    redis_host = os.getenv("REDIS_HOST", "cache") # Имя сервиса из docker-compose
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    logger.info(f"🔗 [Redis] Попытка подключения к Redis/DragonflyDB: {redis_host}:{redis_port}")
    # Иногда на старте срабатывает гонка готовности DNS/сервиса.
    # Чтобы не оставлять redis_client=None навсегда, делаем повторные попытки ping.
    max_tries = int(os.getenv("REDIS_CONNECT_MAX_TRIES", "10"))
    retry_delay_sec = float(os.getenv("REDIS_CONNECT_RETRY_DELAY_SEC", "1.0"))

    try:
        redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True) # decode_responses=True для строк

        last_error: Exception | None = None
        for attempt in range(1, max_tries + 1):
            try:
                logger.info(f"🔗 [Redis] Попытка подключения ({attempt}/{max_tries}): {redis_host}:{redis_port}")
                await redis_client.ping()
                logger.info(f"✅ [Redis] Успешное подключение к Redis/DragonflyDB по адресу {redis_host}:{redis_port}")
                last_error = None
                break
            except redis.ConnectionError as e:
                last_error = e
                logger.error(f"❌ [Redis] Ошибка подключения ({attempt}/{max_tries}): {e}")
                if attempt < max_tries:
                    await asyncio.sleep(retry_delay_sec)

        if last_error is not None:
            logger.error(
                f"❌ [Redis] Не удалось подключиться к Redis/DragonflyDB после {max_tries} попыток: {redis_host}:{redis_port}: {last_error}"
            )
            redis_client = None
    except Exception as e:
        logger.error(f"❌ [Redis] Неожиданная ошибка при подключении к Redis/DragonflyDB: {e}", exc_info=True)
        redis_client = None # Устанавливаем в None, если не удалось подключиться
    # ---> Конец инициализации Redis < ---

    yield # Приложение работает

    logger.info("Приложение останавливается...")

    if redis_client:
        await redis_client.close()
        logger.info("Соединение с Redis/DragonflyDB закрыто.")


# ---> Создание экземпляра FastAPI с lifespan < ---
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# Добавляем настройки CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3002",  # Admin panel
        "http://localhost", 
        "http://localhost:8888",  # Landing page local server
        "https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net", 
        "http://192.168.0.115:3000", 
        "http://10.0.2.2:3000",
        # Google Sheets домены
        "https://docs.google.com",
        "https://*.googleusercontent.com",
        "https://*.googleapis.com",
        "https://script.google.com",
        # Для локальной разработки Google Apps Script
        "https://script.googleusercontent.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Добавляем endpoint для метрик Prometheus
@app.get("/metrics")
async def get_metrics():
    """Endpoint для получения метрик Prometheus"""
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

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

# Добавляем middleware для сбора метрик HTTP запросов
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Middleware для сбора метрик HTTP запросов"""
    # Получаем метрики из модуля
    http_requests_total = getattr(metrics, 'http_requests_total', None)
    http_request_duration_seconds = getattr(metrics, 'http_request_duration_seconds', None)
    http_errors_total = getattr(metrics, 'http_errors_total', None)
    http_requests_in_progress = getattr(metrics, 'http_requests_in_progress', None)
    
    # Извлекаем информацию о запросе
    method = request.method
    endpoint = request.url.path
    if endpoint.startswith('/api/'):
        endpoint = endpoint[4:]  # Убираем '/api/' префикс
    
    # Засекаем время начала обработки
    start_time = time.time()
    
    # Увеличиваем счетчик запросов в обработке
    if http_requests_in_progress:
        http_requests_in_progress.labels(method=method, endpoint=endpoint).inc()
    
    try:
        # Выполняем запрос
        response = await call_next(request)
        
        # Вычисляем время обработки
        duration = time.time() - start_time
        
        # Обновляем метрики
        if http_requests_total:
            http_requests_total.labels(
                method=method, 
                endpoint=endpoint, 
                status_code=response.status_code
            ).inc()
        
        if http_request_duration_seconds:
            http_request_duration_seconds.labels(
                method=method, 
                endpoint=endpoint
            ).observe(duration)
        
        # Считаем ошибки (4xx и 5xx)
        if response.status_code >= 400 and http_errors_total:
            error_type = f"http_{response.status_code}"
            http_errors_total.labels(
                error_type=error_type, 
                endpoint=endpoint
            ).inc()
        
        # Уменьшаем счетчик запросов в обработке
        if http_requests_in_progress:
            http_requests_in_progress.labels(method=method, endpoint=endpoint).dec()
        
        return response
        
    except Exception as e:
        # В случае ошибки
        duration = time.time() - start_time
        
        # Обновляем метрики ошибок
        if http_requests_total:
            http_requests_total.labels(
                method=method, 
                endpoint=endpoint, 
                status_code=500
            ).inc()
        
        if http_request_duration_seconds:
            http_request_duration_seconds.labels(
                method=method, 
                endpoint=endpoint
            ).observe(duration)
        
        if http_errors_total:
            http_errors_total.labels(
                error_type="internal_error", 
                endpoint=endpoint
            ).inc()
        
        # Уменьшаем счетчик запросов в обработке
        if http_requests_in_progress:
            http_requests_in_progress.labels(method=method, endpoint=endpoint).dec()
        
        # Пробрасываем ошибку дальше
        raise e

@app.get("/")
async def root():
    return {"message": "API server is running"}

@app.get("/health")
async def health_check():
    """Эндпоинт для проверки состояния API."""
    return {"status": "ok"}

app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
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
    host = os.getenv("FASTAPI_HOST", "127.0.0.1")
    port = int(os.getenv("FASTAPI_PORT", "8000")) 
    
    print(f"🚀 Starting FastAPI server on http://{host}:{port}")
    uvicorn.run(
        "main:app",
        host=host, 
        port=port, 
        reload=True
    ) 