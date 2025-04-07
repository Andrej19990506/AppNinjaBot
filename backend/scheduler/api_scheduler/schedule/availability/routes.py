from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel
import logging
# Импортируем фоновую задачу из нового файла
from background_tasks import schedule_access_task_background

logger = logging.getLogger(__name__)
router = APIRouter()

class AccessSettingsData(BaseModel):
    chat_id: str

@router.post("/availability/access-settings")
# Добавляем request: Request
async def apply_access_settings(data: AccessSettingsData, background_tasks: BackgroundTasks, request: Request):
    """
    Принимает chat_id и запускает фоновую задачу для применения настроек доступа.
    """
    chat_id = data.chat_id
    if not chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required")

    logger.info(f"📬 Принят запрос на /scheduler/availability/access-settings для chat_id: {chat_id}")

    # Получаем scheduler_instance из состояния приложения
    try:
        scheduler_instance = request.app.state.scheduler_instance
    except AttributeError:
        logger.error("Экземпляр шедулера не найден в состоянии приложения (request.app.state.scheduler_instance)!")
        raise HTTPException(status_code=500, detail="Scheduler not available")

    if not scheduler_instance:
         logger.error("Экземпляр шедулера найден в state, но он None!")
         raise HTTPException(status_code=500, detail="Scheduler instance is None")

    # Запускаем основную логику в фоне, передавая scheduler_instance
    background_tasks.add_task(schedule_access_task_background, scheduler_instance, chat_id)

    logger.info(f"Отвечаем 200 OK, задача для chat_id: {chat_id} запущена в фоне.")
    # Ответ всегда быстрый
    return {
        "status": "success",
        "message": "Access settings application started in background",
        "chat_id": chat_id
    }

# Удаляем остатки Flask кода, если они были
# availability_bp = Blueprint(...) и т.д. 