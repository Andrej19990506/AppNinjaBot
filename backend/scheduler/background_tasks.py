import logging
from scheduler import InventoryScheduler # Импортируем для type hinting

logger = logging.getLogger(__name__)

def schedule_access_task_background(scheduler_instance: InventoryScheduler, chat_id: str):
    """
    Фоновая задача для запуска планирования доступа.
    Принимает экземпляр шедулера в качестве аргумента.
    """
    if not scheduler_instance:
        logger.error("Фоновая задача: Экземпляр шедулера не передан!")
        return
    logger.info(f"Фоновая задача: Запуск планирования для chat_id: {chat_id}")
    try:
        # Используем переданный экземпляр
        result = scheduler_instance.apply_access_settings(chat_id)
        if result:
            logger.info(f"Фоновая задача: Успешно запланировано для chat_id: {chat_id}")
        else:
            logger.error(f"Фоновая задача: Ошибка при планировании для chat_id: {chat_id}")
    except Exception as e:
        logger.exception(f"Фоновая задача: Исключение при планировании для chat_id: {chat_id}: {e}") 