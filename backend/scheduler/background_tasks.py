import logging
import asyncio
# from scheduler import InventoryScheduler # <-- Убираем импорт модуля

logger = logging.getLogger(__name__)

# Используем строковый type hint для scheduler_instance
def schedule_access_task_background(scheduler_instance: 'InventoryScheduler', chat_id: str):
    """
    Фоновая задача для запуска планирования доступа.
    Принимает экземпляр шедулера в качестве аргумента.
    """
    if not scheduler_instance:
        logger.error("Фоновая задача: Экземпляр шедулера не передан!")
        return
    logger.info(f"Фоновая задача: Запуск планирования для chat_id: {chat_id}")
    
    # Получаем task_manager из scheduler_instance
    task_manager = getattr(scheduler_instance, 'task_manager', None)
    if not task_manager:
        logger.error("Фоновая задача: TaskManager не найден в шедулере!")
        return
    
    try:
        # Создаем новый event loop для асинхронных операций
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Вызываем напрямую асинхронный метод task_manager.schedule_shift_access
            result = loop.run_until_complete(task_manager.schedule_shift_access(chat_id))
            
            if result:
                logger.info(f"Фоновая задача: Успешно запланировано для chat_id: {chat_id}")
            else:
                logger.error(f"Фоновая задача: Ошибка при планировании для chat_id: {chat_id}")
        finally:
            # Обязательно закрываем event loop
            loop.close()
            
    except Exception as e:
        logger.exception(f"Фоновая задача: Исключение при планировании для chat_id: {chat_id}: {e}") 