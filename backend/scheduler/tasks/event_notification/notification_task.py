import logging
import pytz
from typing import List, Dict, Any, TYPE_CHECKING
from datetime import datetime, timedelta
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger
import httpx
from shared.http_client import get_async_http_client
import asyncio # <<< Добавляем asyncio для sleep

# Импортируем базовый класс и зависимости
from ..base_task import BaseTask
from core.config import SchedulerSettings # Используем SchedulerSettings для типизации
from services.database_service import DatabaseService # Используем DatabaseService для типизации

# Осторожно с циклическими импортами!
if TYPE_CHECKING:
    from tasks.task_manager import TaskManager
    from apscheduler.schedulers.base import BaseScheduler

logger = logging.getLogger(__name__)

# --- Статическая функция-обертка для APScheduler ---
async def send_notification(**kwargs):
    """
    Статическая обертка, вызываемая APScheduler.
    Извлекает данные и настройки, создает экземпляр EventNotificationTask
    и вызывает его метод execute.
    """
    job_id = kwargs.get('job_id')
    message = kwargs.get('message')
    chat_ids = kwargs.get('chat_ids')
    settings = kwargs.get('settings') # <<< Получаем настройки

    if not all([job_id, message, chat_ids, settings]):
        logger.error(f"[send_notification:{job_id}] Недостаточно данных или настроек в kwargs для выполнения.")
        return

    logger.info(f"[send_notification:{job_id}] Запуск execute для уведомления.")

    try:
        # <<< Создаем экземпляр задачи, передавая настройки >>>
        # scheduler_instance и task_manager не нужны для execute, передаем None
        task_instance = EventNotificationTask(scheduler_instance=None, task_manager=None, settings=settings)
        # <<< Вызываем НЕСТАТИЧЕСКИЙ метод execute >>>
        await task_instance.execute(**kwargs) 
        logger.info(f"[send_notification:{job_id}] Вызов execute завершен.")
    except Exception as e:
        logger.error(f"[send_notification:{job_id}] Ошибка при выполнении execute: {e}", exc_info=True)

# --- Класс задачи ---
class EventNotificationTask(BaseTask):
    TASK_TYPE = 'event_notification'

    def __init__(self, scheduler_instance: 'BaseScheduler', task_manager: 'TaskManager', settings: SchedulerSettings):
        """
        Задача для отправки уведомлений о событиях.
        """
        super().__init__(scheduler_instance, task_manager, settings)
        self.timezone = pytz.timezone(self.settings.TIMEZONE) # Берем таймзону из настроек
        logger.debug(f"EventNotificationTask инициализирован. Таймзона: {self.settings.TIMEZONE}")

    async def schedule(self, notification_data: Dict[str, Any]):
        """
        Планирует или обновляет задачу отправки уведомления о событии.
        Вызывается из TaskManager или API шедулера.
        """
        job_id = None # Инициализируем job_id
        try:
            # Извлекаем необходимые данные
            notification_id = notification_data.get('notification_id')
            event_date_str = notification_data.get('event_date')
            time_before = notification_data.get('time_before')
            repeat_settings = notification_data.get('repeat', {})
            message = notification_data.get('message')
            chat_ids = notification_data.get('chat_ids')

            if not all([notification_id, event_date_str, time_before is not None, message, chat_ids]):
                logger.error(f"({self.TASK_TYPE}) Недостаточно данных для планирования: {notification_data}")
                return False

            # Генерируем ID задачи используя метод базового класса
            job_id = self.generate_task_id(self.TASK_TYPE, str(notification_id))

            # --- Парсинг даты и расчет времени запуска (аналогично коду из прошлого шага) ---
            try:
                event_date = datetime.fromisoformat(event_date_str)
                if event_date.tzinfo is None or event_date.tzinfo.utcoffset(event_date) is None:
                    event_date = pytz.utc.localize(event_date).astimezone(self.timezone)
                else:
                    event_date = event_date.astimezone(self.timezone)
            except ValueError as e:
                logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка парсинга даты события '{event_date_str}': {e}")
                return False

            try:
                trigger_time = event_date - timedelta(minutes=int(time_before))
                now_aware = datetime.now(self.timezone)
                if trigger_time < now_aware:
                    logger.warning(f"({self.TASK_TYPE}:{job_id}) Расчетное время запуска ({trigger_time}) уже прошло. Сейчас: {now_aware}")
            except ValueError as e:
                logger.error(f"({self.TASK_TYPE}:{job_id}) Неверное значение time_before '{time_before}': {e}")
                return False

            # --- Определение триггера (аналогично коду из прошлого шага) ---
            trigger = None
            repeat_type = repeat_settings.get('type', 'none')

            if repeat_type == 'none':
                if trigger_time >= now_aware:
                    trigger = DateTrigger(run_date=trigger_time, timezone=self.timezone)
                else:
                    logger.warning(f"({self.TASK_TYPE}:{job_id}) Одноразовое уведомление в прошлом, не будет запланировано.")
                    # Если задача одноразовая и в прошлом, удаляем ее на всякий случай
                    await self.task_manager.delete_task(job_id) # Используем метод менеджера
                    return True
            else:
                cron_args = {
                    'hour': trigger_time.hour, 'minute': trigger_time.minute,
                    'timezone': self.timezone, 'start_date': trigger_time
                }
                if repeat_type == 'daily':
                    trigger = CronTrigger(**cron_args)
                elif repeat_type == 'weekly':
                    weekdays = repeat_settings.get('weekdays')
                    if weekdays is not None and isinstance(weekdays, list):
                        aps_weekdays = [(d - 1 + 7) % 7 for d in weekdays] # 0=Пн .. 6=Вс
                        cron_args['day_of_week'] = ",".join(map(str, aps_weekdays))
                        trigger = CronTrigger(**cron_args)
                    else:
                        logger.error(f"({self.TASK_TYPE}:{job_id}) Некорректные weekdays: {weekdays}")
                        return False
                elif repeat_type == 'monthly':
                    month_day = repeat_settings.get('month_day')
                    if month_day is not None:
                        cron_args['day'] = str(month_day)
                        trigger = CronTrigger(**cron_args)
                    else:
                        logger.error(f"({self.TASK_TYPE}:{job_id}) Некорректный month_day: {month_day}")
                        return False
                else:
                    logger.error(f"({self.TASK_TYPE}:{job_id}) Неизвестный тип повтора: {repeat_type}")
                    return False

            if trigger is None:
                 logger.error(f"({self.TASK_TYPE}:{job_id}) Не удалось создать триггер.")
                 return False

            # --- Подготовка данных ---
            executor_path = self.task_manager.task_executors.get(self.TASK_TYPE)
            if not executor_path:
                logger.error(f"({self.TASK_TYPE}:{job_id}) Путь к исполнителю не найден в task_manager.")
                return False

            job_kwargs_for_executor = {
                'message': message,
                'chat_ids': chat_ids,
                'job_id': job_id,
                'settings': self.settings
            }

            # --- Добавление/Обновление задачи в APScheduler ---
            try:
                existing_job = self.scheduler.get_job(job_id)
                if existing_job:
                    self.scheduler.modify_job(job_id, trigger=trigger, kwargs=job_kwargs_for_executor)
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Задача ОБНОВЛЕНА в APScheduler.")
                else:
                    self.scheduler.add_job(
                        executor_path,
                        trigger=trigger,
                        kwargs=job_kwargs_for_executor,
                        id=job_id,
                        name=f'{self.TASK_TYPE}_{job_id}',
                        replace_existing=False, # Уже проверили через get_job
                        misfire_grace_time=3600
                    )
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Задача ДОБАВЛЕНА в APScheduler.")
            except Exception as job_err:
                logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка APScheduler: {job_err}", exc_info=True)
                return False

            # --- Сохранение/Обновление в кастомной БД ---
            if self.task_manager.db_service:
                job = self.scheduler.get_job(job_id)
                actual_next_run_time = job.next_run_time if job else trigger_time
                actual_next_run_time_utc = actual_next_run_time.astimezone(pytz.utc) if actual_next_run_time else None

                db_save_data = {
                    'task_id': job_id,
                    'chat_id': None,
                    'task_type': self.TASK_TYPE,
                    'next_run_time': actual_next_run_time_utc,
                    'data': notification_data,
                }
                try:
                    save_db_success = await self.task_manager.db_service.save_task(db_save_data)
                    if not save_db_success:
                         logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка сохранения/обновления в scheduler_tasks.")
                         # Не возвращаем False, т.к. в APScheduler уже запланировано
                except Exception as db_err:
                    logger.error(f"({self.TASK_TYPE}:{job_id}) Исключение при сохранении/обновлении в scheduler_tasks: {db_err}", exc_info=True)

            return True # Возвращаем True, если дошли до сюда

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) Непредвиденная ошибка при планировании {job_id or notification_data.get('notification_id')}: {e}", exc_info=True)
            return False

    # --- Метод execute ТЕПЕРЬ НЕ СТАТИЧЕСКИЙ --- 
    async def execute(self, **kwargs):
        """
        Выполняет основную логику задачи - отправку уведомления.
        Теперь это метод экземпляра, имеет доступ к self.settings.
        """
        job_id = kwargs.get('job_id')
        message = kwargs.get('message')
        chat_ids = kwargs.get('chat_ids')

        logger.info(f"({self.TASK_TYPE}:{job_id}) Начало выполнения execute.")

        if not message or not chat_ids:
            logger.error(f"({self.TASK_TYPE}:{job_id}) Отсутствует сообщение или список чатов в kwargs. Отправка невозможна.")
            return
            
        if not isinstance(chat_ids, list):
             logger.error(f"({self.TASK_TYPE}:{job_id}) chat_ids не является списком: {chat_ids}. Отправка невозможна.")
             return

        # --- Получаем URL Бота --- 
        bot_api_url = getattr(self.settings, 'BOT_API_URL', None)
        if not bot_api_url:
            logger.error(f"({self.TASK_TYPE}:{job_id}) URL API телеграм-бота (BOT_API_URL) не задан в настройках.")
            return
        base_bot_url = str(bot_api_url).rstrip('/')
        send_endpoint = f"{base_bot_url}/send_message"
        
        # --- Отправляем сообщение в каждый чат --- 
        sent_count = 0
        error_count = 0
        
        # Получаем HTTP клиент один раз
        client = None
        try:
            client = await get_async_http_client()
            
            for chat_id in chat_ids:
                try:
                    # Убедимся, что chat_id это строка для payload
                    chat_id_str = str(chat_id)
                    payload = {
                        "chat_id": chat_id_str,
                        "text": message,
                        "parse_mode": "HTML" # Или другой режим
                    }
                    
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Отправка в чат {chat_id_str}...")
                    logger.debug(f"({self.TASK_TYPE}:{job_id}) Payload: {payload}")
                    
                    response = await client.post(send_endpoint, json=payload, timeout=10.0) # Таймаут на каждый запрос
                    
                    if response.status_code == 200:
                        logger.info(f"({self.TASK_TYPE}:{job_id}) -> Успешно отправлено в чат {chat_id_str}.")
                        sent_count += 1
                    else:
                        logger.error(f"({self.TASK_TYPE}:{job_id}) -> Ошибка от Бота для чата {chat_id_str}: {response.status_code}, {response.text}")
                        error_count += 1
                        
                except Exception as send_err:
                    logger.error(f"({self.TASK_TYPE}:{job_id}) -> Ошибка при отправке в чат {chat_id}: {send_err}", exc_info=True)
                    error_count += 1
                    
                # Небольшая пауза между запросами
                await asyncio.sleep(0.2) # Пауза 0.2 секунды
                
        except Exception as client_err:
             logger.error(f"({self.TASK_TYPE}:{job_id}) ❌ Ошибка при создании HTTP-клиента: {client_err}", exc_info=True)
             # Если клиент не создался, нет смысла продолжать
             error_count = len(chat_ids) # Считаем все ошибки
        finally:
            if client:
                await client.aclose()

        logger.info(f"({self.TASK_TYPE}:{job_id}) Завершение выполнения execute. Успешно отправлено: {sent_count}, Ошибок: {error_count}") 