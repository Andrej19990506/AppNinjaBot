from fastapi import APIRouter, Request, Depends
import logging
import asyncio
from typing import Dict, Any
from core.config import scheduler_settings
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Определяем модель запроса
class AccessSettingsRequest(BaseModel):
    chat_id: str

# Важно! Создаем роутер с правильным префиксом тэгов
router = APIRouter(
    prefix="/availability",
    tags=["availability"]
)

@router.post("/access-settings")
async def apply_access_settings(
    request: AccessSettingsRequest,
    request_obj: Request
):
    """Применяет настройки доступа для конкретного чата/группы"""
    chat_id = request.chat_id
    logger.info(f"📬 Принят запрос на /scheduler/availability/access-settings для chat_id: {chat_id}")
    
    # Получаем инстанс scheduler из состояния приложения
    scheduler_instance = request_obj.app.state.scheduler_instance
    
    # Запускаем через asyncio.create_task
    # Убедимся, что task_manager существует
    if hasattr(scheduler_instance, 'task_manager') and scheduler_instance.task_manager:
        logger.info(f"Запуск asyncio.create_task для TaskManager.schedule_shift_access и schedule_registration_open_event, chat_id: {chat_id}")
        # Запускаем оба метода: для уведомления в Telegram и для WebSocket события
        asyncio.create_task(scheduler_instance.task_manager.schedule_shift_access(chat_id))
        asyncio.create_task(scheduler_instance.task_manager.schedule_registration_open_event(chat_id))
        message = f"Access settings application started in background for chat_id: {chat_id}"
        status = "success"
    else:
        logger.error(f"TaskManager не найден в scheduler_instance при запросе для chat_id: {chat_id}")
        # Возможно, стоит вернуть ошибку 500?
        message = f"Failed to start background task: TaskManager not found for chat_id: {chat_id}"
        status = "error"
        # Можно изменить код ответа, например, на 500
        # raise HTTPException(status_code=500, detail=message)

    logger.info(f"Отвечаем 200 OK, статус: {status}, сообщение: {message}")
    return {
        "status": status,
        "message": message,
        "chat_id": chat_id
    }

# Удаляем остатки Flask кода, если они были
# availability_bp = Blueprint(...) и т.д. 