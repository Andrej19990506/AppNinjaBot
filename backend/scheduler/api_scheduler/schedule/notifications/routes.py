# backend/scheduler/api_scheduler/schedule/notifications/routes.py
import logging
from fastapi import APIRouter, HTTPException, Request, Depends, status
from pydantic import BaseModel, Field, UUID4
from typing import Optional, List, Dict, Any
from datetime import datetime

# Импорты для TaskManager и структур данных
# Важно: Нужно убедиться, что TaskManager доступен через request.app.state
# и что структура входящих данных (NotificationSchedulePayload) соответствует
# тому, что отправляет API сервер (schemas.NotificationRead)

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Pydantic модель для входящих данных ---
# Эта модель должна максимально соответствовать schemas.NotificationRead из API сервера
# или, как минимум, содержать все поля, необходимые для schedule_event_notification
class NotificationSchedulePayload(BaseModel):
    # id: UUID4 # <<< УДАЛЯЕМ старый
    notification_id: UUID4 # <<< Ожидаем notification_id
    message: str
    event_id: int
    # event_time: datetime # <<< УДАЛЯЕМ старый
    event_date: str # <<< Ожидаем event_date как строку ISO
    repeat: Optional[Dict[str, Any]] = None
    chat_ids: List[int] = Field(default_factory=list)
    # time: Optional[int] = None # <<< УДАЛЯЕМ старый
    time_before: Optional[int] = None # <<< Ожидаем time_before
    created_at: Optional[datetime] = None # Эти можно оставить или убрать
    updated_at: Optional[datetime] = None # Эти можно оставить или убрать
    # <<< НОВОЕ ПОЛЕ >>>
    requires_confirmation: bool = Field(False, description="Требуется ли подтверждение в чате?")
    
    # <<< НОВЫЕ ПОЛЯ ДЛЯ УПРАВЛЕНИЯ ВРЕМЕНЕМ >>>
    use_absolute_time: bool = Field(False, description="Использовать абсолютное время вместо относительного")
    absolute_time: Optional[str] = Field(None, description="Абсолютное время для отправки уведомления (ISO строка)")
    send_now: bool = Field(False, description="Отправить уведомление немедленно после создания")

    # Config здесь не нужен, так как мы не создаем из ORM
    # class Config:
    #     from_attributes = True

# --- Эндпоинт для планирования уведомления ---
@router.post(
    "/schedule",
    summary="Schedule or Reschedule Event Notification",
    status_code=status.HTTP_200_OK # Можно 200 или 202 Accepted
)
async def schedule_notification(
    payload: NotificationSchedulePayload,
    request: Request # Добавляем Request для доступа к app.state
):
    """
    Принимает данные уведомления от API сервера и передает их в TaskManager
    для планирования или обновления задачи.
    """
    logger.info(f"[Schedule Notification] Received request for notification ID: {payload.notification_id}")
    
    # Логируем данные из payload
    try:
        # Преобразуем Pydantic модель в словарь для логирования
        payload_dict = payload.model_dump()
        logger.info(f"[Schedule Notification] Processed Payload: {payload_dict}")
        # Проверяем конкретные поля
        logger.info(f"[Schedule Notification] Значение send_now в payload: {payload.send_now}, тип: {type(payload.send_now)}")
    except Exception as e:
        logger.error(f"[Schedule Notification] Ошибка при логировании payload: {e}")
    
    # Логируем критически важные параметры для отладки
    logger.info(f"[Schedule Notification] Параметры времени: send_now={payload.send_now}, use_absolute_time={payload.use_absolute_time}, time_before={payload.time_before}")
    if payload.send_now:
        logger.info(f"[Schedule Notification] Уведомление {payload.notification_id} настроено на немедленную отправку")
    elif payload.use_absolute_time:
        logger.info(f"[Schedule Notification] Уведомление {payload.notification_id} настроено на абсолютное время: {payload.absolute_time}")
    else:
        logger.info(f"[Schedule Notification] Уведомление {payload.notification_id} настроено на относительное время: за {payload.time_before} мин до {payload.event_date}")
    
    # --- Получаем TaskManager из состояния приложения ---
    try:
        # --- ИЗМЕНЕНИЕ: Получаем task_manager через scheduler_instance --- 
        scheduler_instance = request.app.state.scheduler_instance
        if not scheduler_instance:
            logger.error("[Schedule Notification] scheduler_instance не найден в request.app.state")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Scheduler internal error: Scheduler not initialized"
            )
            
        task_manager = scheduler_instance.task_manager
        if not task_manager:
            logger.error("[Schedule Notification] task_manager не найден в scheduler_instance")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Scheduler internal error: TaskManager not available"
            )
    except AttributeError:
         logger.error("[Schedule Notification] scheduler_instance или task_manager отсутствует в request.app.state")
         raise HTTPException(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             detail="Scheduler internal error: Scheduler state not found"
         )

    # --- Вызываем метод планирования в TaskManager ---
    try:
        # Получаем экземпляр EventNotificationTask для планирования
        event_notification_task = task_manager.task_instances.get('event_notification')
        if not event_notification_task:
            logger.error(f"[Schedule Notification] EventNotificationTask не найден в task_manager.task_instances")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Scheduler internal error: EventNotificationTask not available"
            )
            
        # Вызываем метод schedule экземпляра EventNotificationTask
        success = await event_notification_task.schedule(payload_dict)

        if success:
            logger.info(f"[Schedule Notification] Task scheduling initiated successfully for notification ID: {payload.notification_id}")
            return {"status": "success", "message": "Notification scheduling initiated"}
        else:
            # Если schedule вернул False (например, из-за ошибки валидации или API)
            logger.error(f"[Schedule Notification] EventNotificationTask.schedule вернул False для уведомления ID: {payload.notification_id}")
            # Возвращаем ошибку, чтобы API сервер знал о проблеме
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, # Или 400, если проблема в данных?
                detail="Failed to schedule notification via EventNotificationTask"
            )
    except Exception as e:
        logger.exception(f"[Schedule Notification] Ошибка при вызове event_notification_task.schedule для ID {payload.notification_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal scheduler error during scheduling: {e}"
        ) 

# --- НОВЫЙ ЭНДПОИНТ для удаления напоминания --- 
@router.delete(
    "/reminders/{notification_id}/{chat_id}",
    summary="Cancel Reminder Task",
    status_code=status.HTTP_200_OK
)
async def cancel_reminder(
    notification_id: UUID4,
    chat_id: int,
    request: Request
):
    """
    Принимает запрос от бота на отмену задачи-напоминания после подтверждения.
    """
    # <<< ИЗМЕНЕНИЕ: Добавляем лог с информацией о запросе >>>
    client_host = request.client.host if request.client else "unknown"
    logger.info(f"[Cancel Reminder] Запрос на отмену напоминания от клиента: {client_host}")
    # <<< Конец добавления лога >>>

    # <<< ИЗМЕНЕНИЕ: Используем оригинальный chat_id (int) при формировании ID >>>
    reminder_job_id = f"reminder:{notification_id}:{chat_id}"
    # <<< ИЗМЕНЕНИЕ: Добавляем repr(chat_id) в лог >>>
    logger.info(f"[Cancel Reminder] Received request for notification ID: {notification_id}, Chat ID: {repr(chat_id)}. Target job ID: {reminder_job_id}")

    # --- Получаем TaskManager --- 
    try:
        scheduler_instance = request.app.state.scheduler_instance
        if not scheduler_instance:
            logger.error("[Cancel Reminder] scheduler_instance не найден")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Scheduler not initialized")
        task_manager = scheduler_instance.task_manager
        if not task_manager:
            logger.error("[Cancel Reminder] task_manager не найден")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="TaskManager not available")
    except AttributeError:
        logger.error("[Cancel Reminder] Ошибка доступа к scheduler_instance или task_manager")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Scheduler state not found")

    # --- Вызываем метод отмены в TaskManager --- 
    try:
        # <<< ПРЕДПОЛАГАЕМ, что будет такой метод в TaskManager >>>
        success = await task_manager.cancel_reminder_task(reminder_job_id)

        if success:
            logger.info(f"[Cancel Reminder] Task {reminder_job_id} successfully cancelled.")
            return {"status": "success", "message": "Reminder task cancelled"}
        else:
            # TaskManager мог вернуть False, если задача не найдена или ошибка
            logger.warning(f"[Cancel Reminder] TaskManager.cancel_reminder_task вернул False для {reminder_job_id}. Возможно, задача уже удалена или не существовала.")
            # Возвращаем успех, т.к. желаемое состояние (отсутствие задачи) достигнуто
            # или возвращаем 404? Пока вернем успех.
            return {"status": "success", "message": "Reminder task likely already cancelled or did not exist"}

    except Exception as e:
        logger.exception(f"[Cancel Reminder] Ошибка при вызове task_manager.cancel_reminder_task для {reminder_job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal scheduler error during cancellation: {e}"
        ) 