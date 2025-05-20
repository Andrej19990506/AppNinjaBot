import logging
import requests
import traceback
# Удаляем импорт os, если он больше не нужен
# Импортируем pytz для работы с временными зонами по имени
import pytz 
import httpx  # Заменяем aiohttp на httpx

# Меняем импорт на новую модель и добавляем функцию создания таблицы
# from models.scheduler_task import SchedulerTask
from models.scheduler_task import SchedulerTaskDB
# Убираем импорт timezone из datetime, т.к. используем pytz
# from datetime import datetime, timezone 
from datetime import datetime, timezone, timedelta, time # <-- Добавляем timedelta, time
from .courier_shifts.shift_access_task import ShiftAccessTask
from .websocket_events.registration_open_event_task import RegistrationOpenEventTask
# Исправляем импорт на абсолютный
# from ..core.config import scheduler_settings as default_settings # Старый относительный импорт
from core.config import scheduler_settings as default_settings # Новый абсолютный импорт
# <<< ИЗМЕНЕНИЕ: Импортируем EventReminderTask >>>
from tasks.event_reminder.reminder_task import EventReminderTask

# Импортируем события и объект события
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, JobExecutionEvent
from apscheduler.triggers.date import DateTrigger # <<< Импортируем DateTrigger
from apscheduler.triggers.cron import CronTrigger # <<< Импортируем CronTrigger
from apscheduler.jobstores.base import JobLookupError

# Удаляем импорт shared.db_utils
# from scheduler.shared.db_utils import init_db, db_connection
# Удаляем импорт http_client
# from backend.shared.http_client import get_http_client

# Добавляем импорт typing для аннотаций типов
from typing import Optional, Dict, Any, List
# Импортируем DatabaseService для типизации
from services.database_service import DatabaseService
import asyncio # Добавляем asyncio сюда, если его еще нет
import json # <-- Добавляем импорт json
from tasks.event_notification.notification_task import EventNotificationTask # <<< Добавляем импорт

# УБИРАЕМ импорт fastapi_app отсюда
# try:
#     from ..app import app as fastapi_app
# except ImportError:
#     fastapi_app = None
#     logging.warning("Не удалось импортировать FastAPI app в TaskManager для доступа к state")

logger = logging.getLogger(__name__)

# --- Функции-прокладки для APScheduler --- 

# Принимаем только **kwargs
async def _run_shift_access(**kwargs):
    """Функция-прокладка для запуска задачи shift_access."""
    # Получаем chat_id из kwargs
    chat_id = kwargs.get('chat_id')
    if not chat_id:
        logger.error("[APScheduler Job] chat_id не найден в kwargs для shift_access.")
        return 
        
    logger.info(f"[APScheduler Job] Запуск shift_access для chat_id: {chat_id}")
    # Пытаемся импортировать app ЗДЕСЬ
    try:
        from ..app import app as fastapi_app
    except ImportError:
        fastapi_app = None
        
    if not fastapi_app or not hasattr(fastapi_app, 'state') or not hasattr(fastapi_app.state, 'scheduler_instance'):
        logger.error("[APScheduler Job] FastAPI app или scheduler_instance недоступен. Невозможно выполнить задачу.")
        return
    try:
        task_manager = fastapi_app.state.scheduler_instance.task_manager
        # Вызываем execute с chat_id
        await task_manager.shift_access_task.execute(chat_id)
        logger.info(f"[APScheduler Job] Успешно вызван shift_access_task.execute для chat_id: {chat_id}")
    except Exception as e:
        logger.error(f"[APScheduler Job] Ошибка выполнения shift_access для chat_id {chat_id}: {e}")
        logger.error(traceback.format_exc())

# Принимаем только **kwargs
async def _run_registration_open(**kwargs):
    """Функция-прокладка для запуска задачи registration_open_event."""
    # Получаем chat_id из kwargs
    chat_id = kwargs.get('chat_id')
    if not chat_id:
        logger.error("[APScheduler Job] chat_id не найден в kwargs для registration_open_event.")
        return
        
    logger.info(f"[APScheduler Job] Запуск registration_open_event для chat_id: {chat_id}")
    # Пытаемся импортировать app ЗДЕСЬ
    try:
        from ..app import app as fastapi_app
    except ImportError:
        fastapi_app = None
        
    if not fastapi_app or not hasattr(fastapi_app, 'state') or not hasattr(fastapi_app.state, 'scheduler_instance'):
        logger.error("[APScheduler Job] FastAPI app или scheduler_instance недоступен. Невозможно выполнить задачу.")
        return
    try:
        task_manager = fastapi_app.state.scheduler_instance.task_manager
        # Вызываем execute с chat_id
        await task_manager.registration_open_event_task.execute(chat_id)
        logger.info(f"[APScheduler Job] Успешно вызван registration_open_event_task.execute для chat_id: {chat_id}")
    except Exception as e:
        logger.error(f"[APScheduler Job] Ошибка выполнения registration_open_event для chat_id {chat_id}: {e}")
        logger.error(traceback.format_exc())

# --- Класс TaskManager --- 

class TaskManager:
    def __init__(self, scheduler_instance, settings=None, db_service=None):
        """
        Инициализация менеджера задач
        :param scheduler_instance: Экземпляр планировщика APScheduler
        :param settings: Объект настроек SchedulerSettings
        :param db_service: Сервис для работы с базой данных
        """
        self.scheduler = scheduler_instance
        # Используем переданные настройки или дефолтные
        self.settings = settings or default_settings
        # Используем TIMEZONE из настроек с помощью pytz
        # self.timezone = timezone(self.settings.TIMEZONE) # Старый неправильный вызов
        self.timezone = pytz.timezone(self.settings.TIMEZONE) # Правильный вызов с pytz
        # Используем API_URL из настроек
        self.api_url = self.settings.API_URL
        # Сохраняем сервис БД
        self.db_service = db_service
        
        # Убираем создание таблицы SchedulerTaskDB отсюда, 
        # т.к. APScheduler с SQLAlchemyJobStore сам создаст свои таблицы.
        # Если SchedulerTaskDB нужна для чего-то еще, ее создание нужно перенести
        # (например, в миграции Alembic, если они используются в scheduler)

        # Оставляем словарь с путями к функциям-оберткам
        self.task_executors = {
            'courier_shift_access': 'tasks.courier_shifts.shift_access_task:execute_job',
            'registration_open_event': 'tasks.websocket_events.registration_open_event_task:execute_job',
            'event_notification': 'tasks.event_notification.notification_task:send_notification',
            # <<< ИЗМЕНЕНИЕ: Добавляем путь к исполнителю напоминаний >>>
            'event_reminder': 'tasks.event_reminder.reminder_task:send_reminder'
        }

        # !!! ДОБАВЛЯЕМ СЛУШАТЕЛЯ СОБЫТИЙ !!!
        self.scheduler.add_listener(self._job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
        logger.info("Слушатель событий APScheduler добавлен.")

        # --- Инициализируем экземпляры классов задач --- 
        # Чтобы иметь к ним доступ для вызова методов schedule
        self.task_classes = { # Словарь для хранения классов
            ShiftAccessTask.TASK_TYPE: ShiftAccessTask,
            EventNotificationTask.TASK_TYPE: EventNotificationTask,
            # <<< ИЗМЕНЕНИЕ: Добавляем класс задачи напоминания >>>
            EventReminderTask.TASK_TYPE: EventReminderTask
            # Добавь другие типы задач здесь
        }
        self.task_instances = {} # Словарь для хранения экземпляров
        for task_type, task_class in self.task_classes.items():
            try:
                # Передаем this TaskManager в конструктор BaseTask
                self.task_instances[task_type] = task_class(scheduler_instance, self, settings)
                logger.info(f"Экземпляр задачи '{task_type}' ({task_class.__name__}) создан и сохранен.")
            except Exception as init_err:
                 logger.error(f"Ошибка инициализации экземпляра задачи {task_type}: {init_err}")
        # ------------------------------------------------

    async def save_task(self, task_id, chat_id, task_type, next_run_time, data=None):
        """Сохраняет задачу в БД и добавляет/обновляет в APScheduler."""
        # <<< ИЗМЕНЕНИЕ: Преобразуем chat_id в строку перед передачей в db_service >>>
        # Также обрабатываем случай, когда chat_id может быть None (для event_notification)
        chat_id_for_db = str(chat_id) if chat_id is not None else None
        db_task_data = {
            'task_id': task_id,
            'chat_id': chat_id_for_db, # Используем преобразованное значение
            'task_type': task_type,
            'next_run_time': next_run_time, # next_run_time уже должен быть datetime
            'data': data or {}
        }
        # <<< КОНЕЦ ИЗМЕНЕНИЯ >>>

        if self.db_service:
            # Пытаемся сохранить в БД. Обрабатываем возможную ошибку с event loop.
            try:
                # <<< ИЗМЕНЕНИЕ: Передаем db_task_data >>>
                success = await self.db_service.save_task(db_task_data)
                if not success:
                    logger.error(f"Ошибка при сохранении задачи {task_id} в БД (db_service вернул False)")
            except RuntimeError as e:
                if "attached to a different loop" in str(e):
                    logger.error(f"Ошибка Event Loop при сохранении задачи {task_id} в БД: {e}")
                    # Попытка запустить сохранение в правильном цикле?
                    # Это сложно и зависит от контекста вызова save_task.
                    # Пока просто логируем и НЕ добавляем в APScheduler.
                    return False # Не добавляем в APScheduler, если не смогли сохранить в БД из-за loop
                else:
                    logger.error(f"Неожиданная RuntimeError при сохранении задачи {task_id} в БД: {e}")
                    return False # Общая ошибка - тоже не добавляем
            except Exception as e:
                 logger.error(f"Непредвиденная ошибка при сохранении задачи {task_id} в БД: {e}")
                 return False # Общая ошибка - тоже не добавляем

        logger.info(f"⏰ Добавление/обновление задачи {task_id} (тип: {task_type}) в APScheduler.")

        # --- Получаем путь к статической функции-обертке --- 
        executor_path = self.task_executors.get(task_type)
        if not executor_path:
            logger.error(f"Не найден путь к исполнителю для типа задачи: {task_type} (ID: {task_id})")
            return False
        # ----------------------------------------------------
        
        job_args = []

        # --- Формируем kwargs для передачи в функцию-исполнитель --- 
        job_kwargs = {
            'task_type': task_type,
            'chat_id': str(chat_id) if chat_id is not None else None, # Передаем как строку
            # Добавляем стандартные зависимости, которые могут понадобиться исполнителю
            'settings': self.settings,      
            'task_manager': self,           
            'db_service': self.db_service, # db_service тоже может быть нужен
            'scheduler_instance': self.scheduler # <--- ДОБАВЛЕНО
        }
        
        # --- Дополнительные kwargs для конкретных типов задач --- 
        if task_type == EventReminderTask.TASK_TYPE and data:
            job_kwargs['job_id'] = task_id 
            job_kwargs['notification_id'] = data.get('notification_id')
            job_kwargs['confirmation_type'] = data.get('confirmation_type', 'default')
            logger.debug(f"Добавлены notification_id и confirmation_type в kwargs для {task_id}")
        # Добавьте здесь elif для других типов задач, если им нужны доп. данные из data в kwargs
        # --------------------------------------------------------

        if task_type == EventReminderTask.TASK_TYPE: # Логируем только для напоминаний
            logger.info(f"[TaskManager.save_task] Для НАПОМИНАНИЯ {task_id}, ПЕРЕД add_job, executor_path: {executor_path}")
            logger.info(f"[TaskManager.save_task] Для НАПОМИНАНИЯ {task_id}, ПЕРЕД add_job, job_kwargs: {job_kwargs}")

        try:
            # --- Передаем kwargs в add_job --- 
            self.scheduler.add_job(
                executor_path,          
                'date', # Напоминания всегда 'date' при первом планировании/перепланировании
                run_date=next_run_time, 
                args=job_args,          
                kwargs=job_kwargs, # Передаем собранные kwargs
                id=str(task_id), # ID самой задачи для APScheduler
                name=f'{task_type} для {chat_id if chat_id else "всех"}',
                replace_existing=True,
                # !!! ВАЖНО: Устанавливаем правильный misfire_grace_time для напоминаний !!!
                # Ранее в EventReminderTask.schedule было 60 секунд
                misfire_grace_time=60 if task_type == EventReminderTask.TASK_TYPE else 3600 
            )
            logger.debug(f"[TaskManager.save_task] Attempting to add/replace job with ID: {repr(str(task_id))}")
            run_time_local = next_run_time.astimezone(self.timezone)
            logger.info(f" -> Задача {task_id} добавлена/обновлена в APScheduler на {run_time_local}")
            return True
        except Exception as add_job_err:
            # Ошибка сериализации должна уйти, но ловим другие возможные ошибки
            logger.error(f"Ошибка при добавлении/обновлении задачи {task_id} в APScheduler: {add_job_err}")
            logger.error(traceback.format_exc())
            # Возможно, стоит попытаться удалить задачу из БД, если она там сохранилась?
            # if self.db_service:
            #     await self.db_service.delete_task(task_id)
            return False

    async def get_all_active_tasks(self):
        """Получает все активные задачи ИЗ БАЗЫ ДАННЫХ"""
        if self.db_service:
            tasks = await self.db_service.get_all_active_tasks()
            logger.info(f"Получено {len(tasks)} активных задач из БД")
            return tasks
        else:
            logger.warning("Сервис БД не инициализирован, не могу получить активные задачи")
            return []

    async def reload_tasks(self):
        """Сначала восстанавливает задачи из БД, затем синхронизирует с API."""
        logger.info("--- Запуск reload_tasks --- ")
        
        # --- Шаг 1: Восстановление задач из нашей БД --- 
        logger.info("🔄 Шаг 1: Восстановление задач из базы данных scheduler_tasks...")
        restored_count = 0
        failed_count = 0
        try:
            if self.db_service:
                active_db_tasks = await self.get_all_active_tasks() # Используем существующий метод
                logger.info(f"Найдено {len(active_db_tasks)} активных задач в scheduler_tasks для восстановления.")
                
                for task_info in active_db_tasks:
                    try:
                        task_id = task_info.get('task_id')
                        chat_id = task_info.get('chat_id') # Может быть None для event_notification
                        task_type = task_info.get('task_type')
                        next_run_str = task_info.get('next_run_time')
                        data = task_info.get('data', {})
                        
                        if not all([task_id, task_type, next_run_str]):
                            logger.warning(f"Пропуск задачи из БД: не хватает данных {task_info}")
                            failed_count += 1
                            continue
                            
                        # Преобразуем время из ISO строки обратно в datetime aware
                        try:
                            next_run_time_aware = datetime.fromisoformat(next_run_str)
                            # Приведем к таймзоне планировщика, чтобы все расчеты были в ней
                            next_run_time_aware = next_run_time_aware.astimezone(self.timezone) 
                        except ValueError:
                             logger.error(f"Ошибка парсинга времени '{next_run_str}' для задачи {task_id}")
                             failed_count += 1
                             continue
                        
                        logger.info(f"Восстановление задачи {task_id} (тип: {task_type}, время: {next_run_time_aware})...")

                        # <<< НАЧАЛО ИЗМЕНЕННОЙ ЛОГИКИ ВОССТАНОВЛЕНИЯ >>>
                        if task_type == EventNotificationTask.TASK_TYPE:
                            logger.debug(f"Обработка восстановления для {task_type} (ID: {task_id})")
                            # 1. Извлекаем данные из 'data'
                            message = data.get('message')
                            chat_ids = data.get('chat_ids')
                            repeat_settings = data.get('repeat', {})
                            # Достаем time_before и event_date_str ТОЛЬКО для расчета времени cron'а
                            time_before_str = data.get('time_before')
                            event_date_str = data.get('event_date')
                            # <<< ИЗМЕНЕНИЕ: Извлекаем requires_confirmation и notification_id >>>
                            requires_confirmation = data.get('requires_confirmation', False)
                            notification_id = data.get('notification_id') # Нужен для callback_data
                            # !!! ИЗВЛЕКАЕМ confirmation_type ИЗ data !!!
                            confirmation_type_from_db = data.get('confirmation_type', 'default') # 'default' на всякий случай

                            if not all([message, chat_ids, time_before_str is not None, event_date_str, notification_id]): # Добавляем notification_id в проверку
                                logger.error(f"Недостаточно данных в поле 'data' для восстановления {task_id} (notification_id отсутствует?): {data}")
                                failed_count += 1
                                continue

                            # 2. Определяем триггер
                            trigger = None
                            repeat_type = repeat_settings.get('type', 'none')
                            
                            # Рассчитаем время HH:MM для cron из event_date и time_before
                            cron_trigger_time = None
                            try:
                                event_date_for_time = datetime.fromisoformat(event_date_str)
                                # Приведем к таймзоне шедулера для корректного вычитания
                                if event_date_for_time.tzinfo is None:
                                     event_date_for_time = self.timezone.localize(event_date_for_time)
                                else:
                                     event_date_for_time = event_date_for_time.astimezone(self.timezone)
                                cron_trigger_time = event_date_for_time - timedelta(minutes=int(time_before_str))
                            except Exception as time_calc_err:
                                logger.error(f"Ошибка расчета времени для cron триггера задачи {task_id}: {time_calc_err}")
                                failed_count += 1
                                continue # Пропускаем задачу, если не можем рассчитать время

                            if repeat_type == 'none':
                                # Если одноразовая, используем next_run_time_aware из БД
                                now_aware = datetime.now(self.timezone)
                                if next_run_time_aware >= now_aware:
                                    trigger = DateTrigger(run_date=next_run_time_aware, timezone=self.timezone)
                                else:
                                    logger.warning(f"Одноразовая задача {task_id} уже в прошлом ({next_run_time_aware}), пропускаем восстановление.")
                                    # Возможно, стоит удалить из БД тут же? Но пока пропускаем.
                                    failed_count += 1
                                    continue
                            elif cron_trigger_time: # Для повторяющихся - создаем CronTrigger
                                cron_args = {
                                    'hour': cron_trigger_time.hour, 
                                    'minute': cron_trigger_time.minute,
                                    'timezone': self.timezone, 
                                    # Важно: start_date должен быть в прошлом или сейчас, 
                                    # чтобы cron сработал как можно скорее, если next_run_time в прошлом
                                    # Используем next_run_time_aware из БД как ориентир, но не позже "сейчас"
                                    'start_date': min(next_run_time_aware, datetime.now(self.timezone)) 
                                }
                                if repeat_type == 'daily':
                                    trigger = CronTrigger(**cron_args)
                                elif repeat_type == 'weekly':
                                    weekdays = repeat_settings.get('weekdays')
                                    if weekdays is not None and isinstance(weekdays, list):
                                        aps_weekdays = [(d - 1 + 7) % 7 for d in weekdays]
                                        cron_args['day_of_week'] = ",".join(map(str, aps_weekdays))
                                        trigger = CronTrigger(**cron_args)
                                    else: logger.error(f"Некорректные weekdays для {task_id}: {weekdays}"); failed_count += 1; continue
                                elif repeat_type == 'monthly':
                                    month_day = repeat_settings.get('month_day')
                                    if month_day is not None:
                                        cron_args['day'] = str(month_day)
                                        trigger = CronTrigger(**cron_args)
                                    else: logger.error(f"Некорректный month_day для {task_id}: {month_day}"); failed_count += 1; continue
                                else: logger.error(f"Неизвестный тип повтора для {task_id}: {repeat_type}"); failed_count += 1; continue
                            
                            if trigger is None:
                                logger.error(f"Не удалось создать триггер для {task_id}")
                                failed_count += 1
                                continue

                            # 3. Собираем полные kwargs
                            executor_path = self.task_executors.get(task_type)
                            if not executor_path: logger.error(f"Путь к исполнителю {task_type} не найден для {task_id}"); failed_count += 1; continue
                            
                            job_kwargs_for_executor = {
                                'message': message,
                                'chat_ids': chat_ids,
                                'job_id': task_id, # Передаем ID для логирования внутри задачи
                                'settings': self.settings, # Передаем настройки
                                # <<< ИЗМЕНЕНИЕ: Добавляем извлеченные поля >>>
                                'requires_confirmation': requires_confirmation,
                                'notification_id': notification_id,
                                # <<< ИЗМЕНЕНИЕ: Передаем TaskManager при восстановлении >>>
                                'task_manager': self,
                                # !!! ДОБАВЛЯЕМ confirmation_type В kwargs !!!
                                'confirmation_type': confirmation_type_from_db
                            }

                            # 4. Вызываем add_job напрямую
                            try:
                                self.scheduler.add_job(
                                    executor_path,
                                    trigger=trigger,
                                    kwargs=job_kwargs_for_executor,
                                    id=str(task_id),
                                    name=f'{task_type} для всех', # Имя можно сделать информативнее, если нужно
                                    replace_existing=True,
                                    misfire_grace_time=3600 
                                )
                                # Логируем время следующего запуска из APScheduler
                                job = self.scheduler.get_job(task_id)
                                next_run_aps = job.next_run_time if job else None
                                logger.info(f" -> Задача {task_id} (event_notification) добавлена/обновлена в APScheduler на {next_run_aps}")
                                restored_count += 1
                            except Exception as add_job_err:
                                logger.error(f"Ошибка APScheduler при восстановлении {task_id}: {add_job_err}")
                                logger.error(traceback.format_exc())
                                failed_count += 1
                        
                        else: 
                            # <<< СТАРАЯ ЛОГИКА для других типов задач >>>
                            # Вызываем save_task, который подходит для courier_shift_access
                            save_success = await self.save_task(
                                task_id, chat_id, task_type, next_run_time_aware, data
                            )
                            if save_success:
                                restored_count += 1
                            else:
                                failed_count += 1
                                logger.error(f"Не удалось восстановить задачу {task_id} при вызове save_task.")
                        # <<< КОНЕЦ ИЗМЕНЕННОЙ ЛОГИКИ ВОССТАНОВЛЕНИЯ >>>
                            
                    except Exception as task_restore_err:
                        logger.error(f"Ошибка при обработке задачи {task_info.get('task_id', 'N/A')} из БД: {task_restore_err}")
                        logger.error(traceback.format_exc())
                        failed_count += 1
            else:
                logger.warning("db_service не инициализирован, пропуск восстановления задач из БД.")
        except Exception as db_restore_err:
             logger.error(f"Критическая ошибка при восстановлении задач из БД: {db_restore_err}")
             logger.error(traceback.format_exc())
             
        logger.info(f"✅ Шаг 1 завершен: Восстановлено={restored_count}, Ошибок={failed_count}")
        # ------------------------------------------------ 
        
        # --- Шаг 1.5: Очистка просроченных задач --- 
        logger.info("🔄 Шаг 1.5: Очистка просроченных задач из scheduler_tasks...")
        deleted_count = 0
        delete_failed_count = 0
        try:
            if self.db_service:
                overdue_ids = await self.db_service.get_overdue_task_ids()
                if overdue_ids:
                    logger.info(f"Найдено {len(overdue_ids)} просроченных задач для удаления: {overdue_ids}")
                    for task_id in overdue_ids:
                        logger.info(f"Удаление просроченной задачи {task_id}...")
                        # Используем delete_task, который удаляет из БД и APScheduler
                        delete_success = await self.delete_task(task_id)
                        if delete_success:
                            deleted_count += 1
                        else:
                            delete_failed_count += 1
                            logger.error(f"Не удалось удалить просроченную задачу {task_id}.")
                else:
                    logger.info("Просроченных задач в scheduler_tasks не найдено.")
            else:
                 logger.warning("db_service не инициализирован, пропуск очистки просроченных задач.")
        except Exception as cleanup_err:
            logger.error(f"Критическая ошибка при очистке просроченных задач: {cleanup_err}")
            logger.error(traceback.format_exc())
            
        logger.info(f"✅ Шаг 1.5 завершен: Удалено={deleted_count}, Ошибок={delete_failed_count}")
        # -------------------------------------------
        
        # --- Шаг 2: Синхронизация с API (существующая логика) --- 
        logger.info("🔄 Шаг 2: Синхронизация задач с API...")
        try:
            logger.info("🔌 Проверка соединения с API...")
            try:
                courier_chat_ids = self._get_courier_chat_ids()
                logger.info(f"✅ Соединение с API проверено, найдено {len(courier_chat_ids)} чатов для синхронизации.")
            except Exception as api_error:
                logger.error(f"❌ Ошибка соединения с API при синхронизации: {api_error}")
                # Не прерываем весь процесс, просто пропускаем этот шаг
                courier_chat_ids = []

            # Если API доступен, планируем/обновляем уведомления для чатов из API
            if courier_chat_ids:
                processed_chats = 0
                for chat_id in courier_chat_ids:
                    # Эта логика теперь ОБНОВИТ или создаст задачи для чатов из API,
                    # используя `replace_existing=True` в `save_task`.
                    # Важно: она не удаляет задачи для чатов, которых больше нет в API.
                    # Если нужно удаление - потребуется доп. логика.
                    logger.info(f"Синхронизация задач для чата {chat_id} из API ({processed_chats+1}/{len(courier_chat_ids)})...")
                    
                    # Вызываем методы schedule у конкретных задач
                    # Эти методы вызовут save_task, который использует replace_existing=True
                    reg_result = await self.schedule_registration_open_event(chat_id)
                    logger.info(f"Синхронизация registration_open_event для {chat_id}: {'✅' if reg_result else '❌'}")
                    
                    shift_result = await self.schedule_shift_access(chat_id)
                    logger.info(f"Синхронизация shift_access для {chat_id}: {'✅' if shift_result else '❌'}")
                    
                    processed_chats += 1
                logger.info(f"✅ Синхронизация для {processed_chats} чатов из API завершена.")    
            else:
                logger.warning("Не найдено курьерских чатов в API для синхронизации.")

            logger.info("✅ Шаг 2 завершен: Синхронизация с API.")
            # Возвращаем True, если хотя бы один шаг прошел успешно (например, восстановление)
            return True 

        except Exception as e:
            logger.error(f"❌ Критическая ошибка при синхронизации задач с API: {e}")
            logger.error(traceback.format_exc())
            return False
        finally:
            logger.info("--- Завершение reload_tasks --- ")

    # Метод для существующей задачи (остается без изменений)
    async def schedule_shift_access(self, chat_id):
        """Планирует задачу проверки доступа к сменам"""
        # Импортируем класс здесь, чтобы избежать циклических зависимостей
        from tasks.courier_shifts.shift_access_task import ShiftAccessTask
        instance = ShiftAccessTask(self.scheduler, self, self.settings)
        return await instance.schedule(chat_id)

    # Метод для нашей задачи (остается без изменений)
    async def schedule_registration_open_event(self, chat_id):
        """Планирует задачу отправки WS события об открытии регистрации"""
        # Импортируем класс здесь
        from tasks.websocket_events.registration_open_event_task import RegistrationOpenEventTask
        instance = RegistrationOpenEventTask(self.scheduler, self, self.settings)
        return await instance.schedule(chat_id)

    # Метод _get_courier_chat_ids (остается без изменений, использует self.api_url)
    def _get_courier_chat_ids(self) -> list[str]:
        """Получает список ID курьерских чатов из API сервера."""
        logger.info(f"Получение списка ID курьерских чатов из API: {self.api_url}")
        try:
            # Проверяем, что API_URL не пустой
            if not self.api_url:
                logger.error("API_URL не указан в настройках!")
                return []
                
            # Собираем URL, убирая возможный слеш в конце api_url
            endpoint = "api/v1/groups?type=courier"
            base_url = str(self.api_url).rstrip('/') # Преобразуем в строку и убираем / в конце
            full_url = f"{base_url}/{endpoint}" # Добавляем один слеш
            logger.info(f"Запрос к API: GET {full_url}")
            
            # Уменьшаем таймаут до 2 секунд, чтобы не ждать долго
            response = requests.get(full_url, timeout=2)
            response.raise_for_status()
            
            # Декодируем ответ
            try:
                groups = response.json()
            except ValueError as json_err:
                logger.error(f"Ошибка декодирования JSON ответа: {json_err}")
                logger.error(f"Ответ API: {response.text[:500]}")  # Логируем только первые 500 символов
                return []
                
            # Извлекаем ID чатов
            chat_ids = [str(group['group_id']) for group in groups if 'group_id' in group]
            if chat_ids:
                 logger.info(f"Получено {len(chat_ids)} ID курьерских чатов: {chat_ids}")
            else:
                 logger.warning("API не вернул курьерских чатов.")
            return chat_ids
        except requests.exceptions.ConnectTimeout as e:
            logger.error(f"Таймаут подключения к API ({full_url}): {e}")
            return []
        except requests.exceptions.ReadTimeout as e:
            logger.error(f"Таймаут чтения ответа от API ({full_url}): {e}")
            return []
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Ошибка соединения с API ({full_url}): {e}")
            return []
        except requests.exceptions.RequestException as e:
            logger.error(f"Ошибка при запросе списка курьерских групп из API: {e}")
            if e.response is not None:
                logger.error(f"API Response Status: {e.response.status_code}")
                logger.error(f"API Response Body: {e.response.text[:500]}")
            return []
        except Exception as e:
            logger.error(f"Неожиданная ошибка при получении списка курьерских групп: {e}")
            logger.error(traceback.format_exc())
            return []

    async def delete_task(self, task_id):
        """Удаляет задачу из БД и пытается удалить из APScheduler."""
        db_deleted = False
        # Шаг 1: Удаляем из нашей БД
        if self.db_service:
            logger.info(f"Удаление задачи {task_id} из БД...")
            db_deleted = await self.db_service.delete_task(task_id)
            if db_deleted:
                logger.info(f"Задача {task_id} успешно удалена из БД.")
            else:
                # Лог об ошибке или "не найдено" будет в db_service
                logger.warning(f"Не удалось удалить задачу {task_id} из БД.")
        else:
            logger.warning("db_service не инициализирован, пропуск удаления из БД.")

        # Шаг 2: Пытаемся удалить из APScheduler (независимо от успеха в БД)
        aps_deleted = False
        try:
            logger.info(f"Удаление задачи {task_id} из APScheduler...")
            self.scheduler.remove_job(str(task_id))
            logger.info(f"Задача {task_id} успешно удалена из APScheduler.")
            aps_deleted = True
        except Exception as e: # JobLookupError и другие
            logger.warning(f"Ошибка или задача {task_id} не найдена в APScheduler для удаления: {e}")
            aps_deleted = False 

        # Возвращаем True, если удалось удалить из НАШЕЙ БД
        # Успех удаления из APScheduler - бонус, но не главный критерий
        return db_deleted 

    def _job_listener(self, event: JobExecutionEvent):
        """Слушает события выполнения задач, отправляет NOTIFY и обрабатывает."""
        job_id = event.job_id

        if event.exception:
            logger.error(f"Слушатель: Задача {job_id} завершилась с ошибкой: {event.exception}")
            # TODO: Возможно, нужно обновить статус задачи в БД на 'error'
            # TODO: Рассмотреть, нужно ли ПЫТАТЬСЯ перепланировать задачу после ошибки?
            #       Зависит от типа ошибки и логики задачи.
            #       Пока что после ошибки перепланирование НЕ происходит.
        else:
            # Задача успешно выполнена
            logger.info(f"Слушатель: Задача {job_id} успешно выполнена.")
            # APScheduler сам обновит next_run_time для повторяющихся задач.
            # Наша задача - обновить это время в НАШЕЙ БД для корректного перезапуска
            # и выполнить доп. действия (например, NOTIFY).

            task_type = None
            chat_id = None
            is_one_time_job = False

            try:
                # --- Получаем Job и его актуальное next_run_time --- 
                job = self.scheduler.get_job(job_id)
                actual_next_run_time = None
                if job:
                    actual_next_run_time = job.next_run_time # Это может быть None для одноразовых задач
                    if actual_next_run_time:
                        logger.info(f"Слушатель: Следующее время запуска для {job_id} по данным APScheduler: {actual_next_run_time}")
                    else:
                         logger.info(f"Слушатель: Задача {job_id} больше не имеет следующего времени запуска (одноразовая или завершена). Пометка для удаления из БД.")
                         is_one_time_job = True
                else:
                    logger.warning(f"Слушатель: Не удалось получить объект Job для {job_id} после выполнения. Предполагаем, что это одноразовая задача.")
                    is_one_time_job = True
                # -------------------------------------------------
                
                # --- Обработка в зависимости от типа задачи ---
                # Если это одноразовая задача, удаляем её из БД
                if is_one_time_job:
                    if self.db_service:
                        logger.info(f"Слушатель: Удаление одноразовой задачи {job_id} из БД после выполнения...")
                        asyncio.create_task(self.db_service.delete_task(job_id))
                # Если это повторяющаяся задача, обновляем время в БД
                elif actual_next_run_time and self.db_service:
                    logger.info(f"Слушатель: Обновление next_run_time для повторяющейся задачи {job_id} в БД...")
                    # Запускаем обновление в фоне, чтобы не блокировать слушатель
                    asyncio.create_task(
                        self.db_service.update_task_next_run_time(job_id, actual_next_run_time)
                    )
                # --------------------------------------------------

                # --- Получаем task_type и ID для ДОПОЛНИТЕЛЬНОЙ обработки (например, NOTIFY) --- 
                if job and job.kwargs:
                    task_type = job.kwargs.get('task_type')
                    if task_type != 'event_notification':
                        chat_id = job.kwargs.get('chat_id') 
                    logger.debug(f"Слушатель: Получены данные из job.kwargs для {job_id}")
                elif not task_type: # Парсим ID, если из kwargs не получили
                    logger.info(f"Слушатель: Попытка парсинга ID '{job_id}' для получения task_type...")
                    # <<< ИЗМЕНЕНИЕ: Добавляем обработку ID напоминания >>>
                    if job_id.startswith("reminder:"):
                        task_type = 'event_reminder'
                        # ID напоминания имеет формат reminder:nid:cid
                        # Можем извлечь nid и cid, если нужно для доп. обработки
                        parts = job_id.split(':')
                        if len(parts) == 3:
                            # notification_id = parts[1]
                            # chat_id = parts[2] # chat_id уже должен быть в kwargs для напоминаний
                            pass # Пока ничего не делаем с извлеченными ID
                        logger.info(f"Слушатель: Получен task_type='{task_type}' из парсинга ID напоминания")
                    else:
                        # Старая логика для ID с подчеркиваниями
                        parts = job_id.split('_')
                        if len(parts) >= 3:
                            task_type = ''.join(parts[:-2])
                            logger.info(f"Слушатель: Получен task_type='{task_type}' из парсинга ID")
                            # Можно извлечь chat_id/notification_id, если нужно для NOTIFY
                            if task_type == 'courier_shift_access' and not chat_id:
                                 try: int(parts[-2]); chat_id = parts[-2]
                                 except ValueError: pass
                        else:
                            logger.error(f"Слушатель: Не удалось распарсить {job_id}. Доп. обработка невозможна.")
                            task_type = None
                    # <<< Конец обработки ID напоминания >>>
                # --- Конец получения task_type и ID --- 

                # --- Дополнительная обработка (NOTIFY) --- 
                if task_type == 'courier_shift_access' and chat_id is not None:
                    websocket_channel = getattr(self.settings, 'WEBSOCKET_CHANNEL', None)
                    if self.db_service and websocket_channel:
                        notify_payload = {
                            'type': 'shift_access_sent',
                            'chat_id': str(chat_id),
                            'task_id': job_id,
                            'timestamp': datetime.now(timezone.utc).isoformat()
                        }
                        logger.info(f"Слушатель: Подготовка к отправке NOTIFY в канал '{websocket_channel}' для задачи {job_id}")
                        asyncio.create_task(
                            self.db_service.notify_channel(websocket_channel, notify_payload)
                        )
                elif task_type == 'event_notification' and is_one_time_job:
                    # Для одноразовых уведомлений event_notification, извлекаем notification_id
                    # и отправляем запрос в API для обновления статуса уведомления
                    notification_id = None
                    if job and job.kwargs:
                        notification_id = job.kwargs.get('notification_id')
                    
                    if notification_id:
                        logger.info(f"Слушатель: Отметка уведомления {notification_id} как выполненного...")
                        # Реализуем вызов API для обновления статуса уведомления в отдельной задаче
                        asyncio.create_task(self._mark_notification_completed(notification_id))
                elif task_type:
                     logger.debug(f"Слушатель: Для задачи типа '{task_type}' дополнительная обработка после успеха не требуется.")
                # --- Конец дополнительной обработки --- 

            except Exception as listener_err:
                logger.error(f"Слушатель: Ошибка при обработке успешного выполнения задачи {job_id}: {listener_err}")
                logger.error(traceback.format_exc())

    async def _mark_notification_completed(self, notification_id):
        """Отправляет запрос к API сервера для обновления статуса уведомления."""
        try:
            # Получаем URL API сервера из настроек
            api_url = getattr(self.settings, 'API_SERVER_URL', None)
            
            if not api_url:
                logger.error(f"URL API сервера (API_SERVER_URL) не задан в настройках. Не удалось обновить статус уведомления {notification_id}.")
                return
                
            # Формируем URL для обновления статуса уведомления
            update_url = f"{api_url.rstrip('/')}/api/v1/notifications/{notification_id}/status"
            
            logger.info(f"Отправка запроса на обновление статуса уведомления {notification_id} по URL: {update_url}")
            
            # Готовим данные для запроса
            payload = {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Отправляем запрос используя httpx вместо aiohttp
            async with httpx.AsyncClient() as client:
                response = await client.patch(update_url, json=payload)
                if response.status_code == 200:
                    logger.info(f"Статус уведомления {notification_id} успешно обновлен на 'completed'")
                else:
                    logger.error(f"Ошибка при обновлении статуса уведомления {notification_id}: {response.status_code}, {response.text}")
        except Exception as e:
            logger.error(f"Исключение при обновлении статуса уведомления {notification_id}: {e}")
            logger.error(traceback.format_exc())

    # ... (остальные методы TaskManager) ...

    # ... (остальные методы TaskManager) ...