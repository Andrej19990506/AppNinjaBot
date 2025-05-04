import logging
import pytz
from typing import TYPE_CHECKING
from datetime import datetime, timedelta
import httpx
import asyncio
import json

# Импортируем базовый класс и зависимости
from ..base_task import BaseTask
from core.config import SchedulerSettings
from shared.http_client import get_async_http_client # Нужен для отправки боту

# Осторожно с циклическими импортами!
if TYPE_CHECKING:
    from tasks.task_manager import TaskManager
    from apscheduler.schedulers.base import BaseScheduler
    from apscheduler.job import Job

logger = logging.getLogger(__name__)

# --- Статическая функция-обертка для APScheduler --- 
async def send_reminder(**kwargs):
    """Статическая обертка для EventReminderTask, вызываемая APScheduler."""
    job_id = kwargs.get('job_id') # ID задачи-напоминания (reminder:nid:cid)
    chat_id = kwargs.get('chat_id')
    notification_id = kwargs.get('notification_id') # ID исходного уведомления
    confirmation_type = kwargs.get('confirmation_type', 'default')
    settings = kwargs.get('settings')
    task_manager = kwargs.get('task_manager')
    # Получаем планировщик из kwargs, его должен передать TaskManager
    scheduler_instance = kwargs.get('scheduler_instance')

    if not all([job_id, chat_id, notification_id, settings, scheduler_instance, task_manager]):
        logger.error(f"[send_reminder:{job_id}] Недостаточно данных, scheduler_instance или task_manager в kwargs.")
        return

    logger.info(f"[send_reminder:{job_id}] Запуск execute для напоминания в чат {chat_id}.")

    try:
        # Создаем экземпляр
        task_instance = EventReminderTask(scheduler_instance=scheduler_instance, task_manager=task_manager, settings=settings)
        # Вызываем execute, передавая все необходимое
        await task_instance.execute(**kwargs)
        logger.info(f"[send_reminder:{job_id}] Вызов execute завершен.")
    except Exception as e:
        logger.error(f"[send_reminder:{job_id}] Ошибка при выполнении execute: {e}", exc_info=True)

# --- Класс задачи --- 
class EventReminderTask(BaseTask):
    TASK_TYPE = 'event_reminder'

    def __init__(self, scheduler_instance: 'BaseScheduler', task_manager: 'TaskManager', settings: SchedulerSettings):
        super().__init__(scheduler_instance, task_manager, settings)
        self.timezone = pytz.timezone(self.settings.TIMEZONE)
        logger.debug(f"EventReminderTask инициализирован. Таймзона: {self.settings.TIMEZONE}")

    async def schedule(self, reminder_data: dict):
        """Планирует ОДНОКРАТНУЮ задачу-напоминание через TaskManager."""
        job_id = reminder_data.get('job_id')
        chat_id = reminder_data.get('chat_id')
        notification_id = reminder_data.get('notification_id')
        confirmation_type = reminder_data.get('confirmation_type', 'default')
        run_time = reminder_data.get('run_time') # Ожидаем datetime

        if not all([job_id, chat_id, notification_id, run_time]):
            logger.error(f"({self.TASK_TYPE}) Недостаточно данных для планирования напоминания: {reminder_data}")
            return False
            
        # <<< ИЗМЕНЕНИЕ: Собираем данные для save_task >>>
        # Данные, которые должны храниться в поле 'data' в БД
        db_data = {
            'notification_id': notification_id,
            'confirmation_type': confirmation_type
        }
        
        # Используем TaskManager для планирования и сохранения
        logger.info(f"({self.TASK_TYPE}:{job_id}) Попытка планирования через TaskManager на {run_time}...")
        try:
            # Убедимся, что task_manager доступен
            if not self.task_manager:
                 logger.error(f"({self.TASK_TYPE}:{job_id}) TaskManager не инициализирован. Невозможно запланировать.")
                 return False
                 
            success = await self.task_manager.save_task(
                task_id=job_id,
                chat_id=chat_id,
                task_type=self.TASK_TYPE,
                next_run_time=run_time, # Время первого (и единственного) запуска
                data=db_data
            )
            
            if success:
                logger.info(f"({self.TASK_TYPE}:{job_id}) Напоминание успешно запланировано через TaskManager на {run_time}")
                return True
            else:
                logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка при планировании напоминания через TaskManager.")
                return False
                
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}:{job_id}) Исключение при планировании напоминания через TaskManager: {e}", exc_info=True)
            return False

    async def execute(self, **kwargs):
        """Выполняет отправку напоминания и перепланирование."""
        job_id = kwargs.get('job_id')
        chat_id = kwargs.get('chat_id')
        notification_id = kwargs.get('notification_id')
        confirmation_type = kwargs.get('confirmation_type', 'default')
        scheduler = kwargs.get('scheduler_instance') # Получаем планировщик

        # --- ИЗМЕНЕНИЕ: Логируем начало выполнения ---
        logger.info(f"({self.TASK_TYPE}:{job_id}) Начало выполнения execute для чата {chat_id}.")

        # Формируем текст напоминания
        # --- ИЗМЕНЕНИЕ: Возвращаем условие if/else --- 
        reminder_text = "" # Инициализируем пустой строкой
        if confirmation_type == 'end_of_shift':
            reminder_text = "❗️ Внимание! Пожалуйста, подтвердите проведение осмотра и соблюдение техники безопасности перед закрытием смены."
        else:
             # Используем стандартный текст для всех остальных случаев
            reminder_text = "❗️ Внимание! Требуется ваше подтверждение для предыдущего уведомления."
        # --- КОНЕЦ ИЗМЕНЕНИЯ ---

        # 3. Отправляем напоминание боту
        bot_api_url = getattr(self.settings, 'BOT_API_URL', None)
        if not bot_api_url:
            logger.error(f"({self.TASK_TYPE}:{job_id}) URL API телеграм-бота (BOT_API_URL) не задан.")
            return
        base_bot_url = str(bot_api_url).rstrip('/')
        send_endpoint = f"{base_bot_url}/send_message"

        payload = {
            "chat_id": str(chat_id),
            "text": reminder_text,
            "parse_mode": "HTML",
            # Кнопку к напоминанию не добавляем, чтобы не загромождать
        }

        client = None
        send_success = False
        try:
            client = await get_async_http_client()
            logger.info(f"({self.TASK_TYPE}:{job_id}) Отправка напоминания в чат {chat_id}...")
            logger.debug(f"({self.TASK_TYPE}:{job_id}) Payload: {json.dumps(payload, ensure_ascii=False)}")
            response = await client.post(send_endpoint, json=payload, timeout=10.0)
            if response.status_code == 200:
                logger.info(f"({self.TASK_TYPE}:{job_id}) -> Напоминание успешно отправлено в чат {chat_id}.")
                send_success = True
            else:
                logger.error(f"({self.TASK_TYPE}:{job_id}) -> Ошибка от Бота для чата {chat_id}: {response.status_code}, {response.text}")
        except Exception as send_err:
            logger.error(f"({self.TASK_TYPE}:{job_id}) -> Ошибка при отправке напоминания в чат {chat_id}: {send_err}", exc_info=True)
        finally:
            if client:
                await client.aclose()

        # 4. Перепланируем себя на следующие 1 минуту, ТОЛЬКО если отправка была успешной
        if send_success:
            try:
                next_run_time = datetime.now(self.timezone) + timedelta(minutes=1)

                # <<< НАЧАЛО ИЗМЕНЕНИЯ: Используем task_manager.save_task >>>
                # Собираем данные для сохранения/перепланирования
                # ID задачи (job_id) и chat_id уже есть из kwargs
                task_type = self.TASK_TYPE
                # Данные, специфичные для напоминания (извлекаем из kwargs)
                reminder_data_for_save = {
                    'notification_id': notification_id, # ID исходного уведомления
                    'confirmation_type': confirmation_type # Тип подтверждения
                    # Можно добавить и другие поля из kwargs, если они нужны
                    # при следующем выполнении и не передаются через job_id/chat_id
                }

                # Вызываем метод TaskManager для сохранения/перепланирования
                # Он обновит и APScheduler, и нашу БД
                logger.info(f"({self.TASK_TYPE}:{job_id}) Попытка перепланирования через TaskManager на {next_run_time}...")
                success = await self.task_manager.save_task(
                    task_id=job_id,
                    chat_id=chat_id,
                    task_type=task_type,
                    next_run_time=next_run_time,
                    data=reminder_data_for_save
                )

                if success:
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Задача успешно перепланирована через TaskManager на {next_run_time}")
                else:
                    # save_task уже логирует ошибки, но добавим и сюда
                    logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка перепланирования задачи через TaskManager.")
                # <<< КОНЕЦ ИЗМЕНЕНИЯ >>>

            except Exception as reschedule_err:
                # Логируем ошибку именно этапа подготовки к перепланированию
                # Ошибка самого save_task будет залогирована внутри него или выше
                logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка при подготовке к перепланированию: {reschedule_err}", exc_info=True)
        else:
             logger.warning(f"({self.TASK_TYPE}:{job_id}) Отправка напоминания не удалась. Задача НЕ будет перепланирована.")

        logger.info(f"({self.TASK_TYPE}:{job_id}) Завершение выполнения execute для напоминания.") 