import logging
import os
import asyncio
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from pydantic import BaseModel
from scheduler import InventoryScheduler
# Импортируем фоновую задачу из нового файла
from background_tasks import schedule_access_task_background

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SchedulerServiceAPI')

# Удаляем определение schedule_access_task_background отсюда

# Импортируем роутеры
from api_scheduler.schedule.availability.routes import router as availability_router
from api_scheduler.schedule.routes import router as schedule_router

# Удаляем старую логику присваивания функции

# Lifespan менеджер для запуска/остановки шедулера
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Инициализация сервиса и запуск шедулера...")
    # Объявляем scheduler_instance как nonlocal или global, если он вне функции
    # Если он используется только внутри lifespan, то объявление не нужно
    scheduler_instance = InventoryScheduler()
    app.state.scheduler_instance = scheduler_instance # Сохраняем в state
    try:
        # Запускаем шедулер (он сам загрузит задачи)
        scheduler_instance.start()
        logger.info("✅ Шедулер успешно запущен.")
        yield # Приложение работает здесь
    finally:
        logger.info("👋 Остановка шедулера...")
        if app.state.scheduler_instance and app.state.scheduler_instance.is_running():
            app.state.scheduler_instance.stop()
        logger.info("✅ Шедулер остановлен.")
        # Очищаем state при остановке, если нужно
        # del app.state.scheduler_instance

# Создаем FastAPI приложение с lifespan
app = FastAPI(
    title="Scheduler Service API",
    description="API для управления задачами шедулера (FastAPI).",
    version="1.0.0",
    lifespan=lifespan
)

# Подключаем роутеры
app.include_router(schedule_router, prefix="/scheduler")
app.include_router(availability_router, prefix="/scheduler")

# Обработчик исключений (на всякий случай)
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Критическая ошибка при обработке запроса {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal Server Error"},
    )

# --- Маршрут /apply-access-settings (для совместимости, если нужен) ---
class LegacySettingsData(BaseModel):
    chat_id: str

@app.post("/apply-access-settings")
async def legacy_apply_access_settings(data: LegacySettingsData, background_tasks: BackgroundTasks, request: Request):
    chat_id = data.chat_id
    logger.info(f"📬 Запрос на применение настроек (legacy route) для chat_id: {chat_id}")
    # Получаем scheduler_instance из состояния приложения
    scheduler_instance = request.app.state.scheduler_instance
    if not scheduler_instance:
         logger.error("Legacy route: Экземпляр шедулера не найден в состоянии приложения!")
         raise HTTPException(status_code=500, detail="Scheduler not available")
    # Передаем scheduler_instance и chat_id в фоновую задачу
    background_tasks.add_task(schedule_access_task_background, scheduler_instance, chat_id)
    logger.info(f"Эндпоинт (legacy): Отвечаю 200 OK для {chat_id}")
    return {"status": "success", "message": "Scheduling started in background", "chat_id": chat_id}

# Запуск через uvicorn будет в Dockerfile или docker-compose
# Блок if __name__ == '__main__' больше не нужен для основного запуска 