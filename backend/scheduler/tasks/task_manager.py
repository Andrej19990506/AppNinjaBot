import logging
import requests
import traceback
import pytz 
import httpx 

from models.scheduler_task import SchedulerTaskDB
from datetime import datetime, timezone, timedelta, time
from .courier_shifts.shift_access_task import ShiftAccessTask
from .websocket_events.registration_open_event_task import RegistrationOpenEventTask
from core.config import scheduler_settings as default_settings
from tasks.event_reminder.reminder_task import EventReminderTask
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, JobExecutionEvent
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.base import JobLookupError

from typing import Optional, Dict, Any, List
from services.database_service import DatabaseService
import asyncio
import json
from tasks.event_notification.notification_task import EventNotificationTask
from tasks.permissions_cleanup.cleanup_task import PermissionsCleanupTask

logger = logging.getLogger(__name__)


async def _run_shift_access(**kwargs):
    # Запуск задачи доступа к сменам (через FastAPI app)
    chat_id = kwargs.get('chat_id')
    if not chat_id:
        logger.error("[APScheduler Job] chat_id не найден в kwargs для shift_access.")
        return 
        
    logger.info(f"[APScheduler Job] Запуск shift_access для chat_id: {chat_id}")
    try:
        from ..app import app as fastapi_app
    except ImportError:
        fastapi_app = None
        
    if not fastapi_app or not hasattr(fastapi_app, 'state') or not hasattr(fastapi_app.state, 'scheduler_instance'):
        logger.error("[APScheduler Job] FastAPI app или scheduler_instance недоступен. Невозможно выполнить задачу.")
        return
    try:
        task_manager = fastapi_app.state.scheduler_instance.task_manager
        await task_manager.shift_access_task.execute(chat_id)
        logger.info(f"[APScheduler Job] Успешно вызван shift_access_task.execute для chat_id: {chat_id}")
    except Exception as e:
        logger.error(f"[APScheduler Job] Ошибка выполнения shift_access для chat_id {chat_id}: {e}")
        logger.error(traceback.format_exc())

async def _run_registration_open(**kwargs):
    # Запуск задачи открытия регистрации (через FastAPI app)
    chat_id = kwargs.get('chat_id')
    if not chat_id:
        logger.error("[APScheduler Job] chat_id не найден в kwargs для registration_open_event.")
        return
        
    logger.info(f"[APScheduler Job] Запуск registration_open_event для chat_id: {chat_id}")
    try:
        from ..app import app as fastapi_app
    except ImportError:
        fastapi_app = None
        
    if not fastapi_app or not hasattr(fastapi_app, 'state') or not hasattr(fastapi_app.state, 'scheduler_instance'):
        logger.error("[APScheduler Job] FastAPI app или scheduler_instance недоступен. Невозможно выполнить задачу.")
        return
    try:
        task_manager = fastapi_app.state.scheduler_instance.task_manager
        await task_manager.registration_open_event_task.execute(chat_id)
        logger.info(f"[APScheduler Job] Успешно вызван registration_open_event_task.execute для chat_id: {chat_id}")
    except Exception as e:
        logger.error(f"[APScheduler Job] Ошибка выполнения registration_open_event для chat_id {chat_id}: {e}")
        logger.error(traceback.format_exc())

# --- Класс TaskManager --- 

class TaskManager:
    def __init__(self, scheduler_instance, settings=None, db_service=None):
        # Инициализация менеджера задач, сохраняем все нужные ссылки
        self.scheduler = scheduler_instance
        self.settings = settings or default_settings
        self.timezone = pytz.timezone(self.settings.TIMEZONE)
        self.api_url = self.settings.API_URL
        self.db_service = db_service
        
        # Сопоставление типов задач с путями до функций-исполнителей
        self.task_executors = {
            'courier_shift_access': 'tasks.courier_shifts.shift_access_task:execute_job',
            'registration_open_event': 'tasks.websocket_events.registration_open_event_task:execute_job',
            'event_notification': 'tasks.event_notification.notification_task:send_notification',
            'event_reminder': 'tasks.event_reminder.reminder_task:send_reminder',
            'permissions_cleanup': 'tasks.permissions_cleanup.cleanup_task:cleanup_expired_permissions'
        }

        self.scheduler.add_listener(self._job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
        logger.info("Слушатель событий APScheduler добавлен.")

        # Сохраняем классы задач для быстрого доступа
        self.task_classes = {
            ShiftAccessTask.TASK_TYPE: ShiftAccessTask,
            EventNotificationTask.TASK_TYPE: EventNotificationTask,
            EventReminderTask.TASK_TYPE: EventReminderTask,
            PermissionsCleanupTask.TASK_TYPE: PermissionsCleanupTask
        }
        self.task_instances = {}
        for task_type, task_class in self.task_classes.items():
            try:
                self.task_instances[task_type] = task_class(scheduler_instance, self, settings)
                logger.info(f"Экземпляр задачи '{task_type}' ({task_class.__name__}) создан и сохранен.")
            except Exception as init_err:
                 logger.error(f"Ошибка инициализации экземпляра задачи {task_type}: {init_err}")

    async def save_task(self, task_id, chat_id, task_type, next_run_time, data=None):
        # Сохраняем задачу в БД и добавляем/обновляем в APScheduler
        chat_id_for_db = str(chat_id) if chat_id is not None else None
        db_task_data = {
            'task_id': task_id,
            'chat_id': chat_id_for_db,
            'task_type': task_type,
            'next_run_time': next_run_time,
            'data': data or {}
        }

        if self.db_service:
            try:
                success = await self.db_service.save_task(db_task_data)
                if not success:
                    logger.error(f"Ошибка при сохранении задачи {task_id} в БД (db_service вернул False)")
            except RuntimeError as e:
                if "attached to a different loop" in str(e):
                    logger.error(f"Ошибка Event Loop при сохранении задачи {task_id} в БД: {e}")    
                    return False
                else:
                    logger.error(f"Неожиданная RuntimeError при сохранении задачи {task_id} в БД: {e}")
                    return False
            except Exception as e:
                 logger.error(f"Непредвиденная ошибка при сохранении задачи {task_id} в БД: {e}")
                 return False

        logger.info(f"⏰ Добавление/обновление задачи {task_id} (тип: {task_type}) в APScheduler.")

        # Получаем путь к функции-исполнителю
        executor_path = self.task_executors.get(task_type)
        if not executor_path:
            logger.error(f"Не найден путь к исполнителю для типа задачи: {task_type} (ID: {task_id})")
            return False
        
        job_args = []

        # Собираем параметры для функции-исполнителя
        job_kwargs = {
            'task_type': task_type,
            'chat_id': str(chat_id) if chat_id is not None else None,
            'settings': self.settings,      
            'task_manager': self,           
            'db_service': self.db_service,
            'scheduler_instance': self.scheduler 
        }
        
        if task_type == EventReminderTask.TASK_TYPE and data:
            job_kwargs['job_id'] = task_id 
            job_kwargs['notification_id'] = data.get('notification_id')
            job_kwargs['confirmation_type'] = data.get('confirmation_type', 'default')
            logger.debug(f"Добавлены notification_id и confirmation_type в kwargs для {task_id}")

        if task_type == EventReminderTask.TASK_TYPE:
            logger.info(f"[TaskManager.save_task] Для НАПОМИНАНИЯ {task_id}, ПЕРЕД add_job, executor_path: {executor_path}")
            logger.info(f"[TaskManager.save_task] Для НАПОМИНАНИЯ {task_id}, ПЕРЕД add_job, job_kwargs: {job_kwargs}")

        try:
            self.scheduler.add_job(
                executor_path,          
                'date',
                run_date=next_run_time, 
                args=job_args,          
                kwargs=job_kwargs,
                id=str(task_id),
                name=f'{task_type} для {chat_id if chat_id else "всех"}',
                replace_existing=True,
                misfire_grace_time=60 if task_type == EventReminderTask.TASK_TYPE else 3600 
            )
            logger.debug(f"[TaskManager.save_task] Attempting to add/replace job with ID: {repr(str(task_id))}")
            run_time_local = next_run_time.astimezone(self.timezone)
            logger.info(f" -> Задача {task_id} добавлена/обновлена в APScheduler на {run_time_local}")
            return True
        except Exception as add_job_err:
            logger.error(f"Ошибка при добавлении/обновлении задачи {task_id} в APScheduler: {add_job_err}")
            logger.error(traceback.format_exc())
            return False

    async def get_all_active_tasks(self):
        # Получаем все активные задачи из БД
        if self.db_service:
            tasks = await self.db_service.get_all_active_tasks()
            logger.info(f"Получено {len(tasks)} активных задач из БД")
            return tasks
        else:
            logger.warning("Сервис БД не инициализирован, не могу получить активные задачи")
            return []

    async def reload_tasks(self):
        # Восстанавливаем задачи из БД и синхронизируем с API
        logger.info("--- Запуск reload_tasks --- ")
        
        logger.info("🔄 Шаг 1: Восстановление задач из базы данных scheduler_tasks...")
        restored_count = 0
        failed_count = 0
        try:
            if self.db_service:
                active_db_tasks = await self.get_all_active_tasks()
                logger.info(f"Найдено {len(active_db_tasks)} активных задач в scheduler_tasks для восстановления.")
                
                for task_info in active_db_tasks:
                    try:
                        task_id = task_info.get('task_id')
                        chat_id = task_info.get('chat_id')
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
                            if next_run_time_aware.tzinfo is None:
                                 next_run_time_aware = self.timezone.localize(next_run_time_aware)
                            else:
                                 next_run_time_aware = next_run_time_aware.astimezone(self.timezone)
                        except ValueError:
                             logger.error(f"Ошибка парсинга времени '{next_run_str}' для задачи {task_id}")
                             failed_count += 1
                             continue
                        
                        logger.info(f"Восстановление задачи {task_id} (тип: {task_type}, время: {next_run_time_aware})...")

                        # Для event_notification — отдельная логика
                        if task_type == EventNotificationTask.TASK_TYPE:
                            logger.debug(f"Обработка восстановления для {task_type} (ID: {task_id})")
                            message = data.get('message')
                            chat_ids = data.get('chat_ids')
                            repeat_settings = data.get('repeat', {})
                            time_before_str = data.get('time_before')
                            event_date_str = data.get('event_date')
                            requires_confirmation = data.get('requires_confirmation', False)
                            notification_id = data.get('notification_id')
                            confirmation_type_from_db = data.get('confirmation_type', 'default')

                            if not all([message, chat_ids, time_before_str is not None, event_date_str, notification_id]):
                                logger.error(f"Недостаточно данных в поле 'data' для восстановления {task_id} (notification_id отсутствует?): {data}")
                                failed_count += 1
                                continue

                            trigger = None
                            repeat_type = repeat_settings.get('type', 'none')
                            try:
                                event_date_for_time = datetime.fromisoformat(event_date_str)
                                if event_date_for_time.tzinfo is None:
                                     event_date_for_time = self.timezone.localize(event_date_for_time)
                                else:
                                     event_date_for_time = event_date_for_time.astimezone(self.timezone)
                                cron_trigger_time = event_date_for_time - timedelta(minutes=int(time_before_str))
                            except Exception as time_calc_err:
                                logger.error(f"Ошибка расчета времени для cron триггера задачи {task_id}: {time_calc_err}")
                                failed_count += 1
                                continue

                            if repeat_type == 'none':
                                now_aware = datetime.now(self.timezone)
                                if next_run_time_aware >= now_aware:
                                    trigger = DateTrigger(run_date=next_run_time_aware, timezone=self.timezone)
                                else:
                                    logger.warning(f"Одноразовая задача {task_id} уже в прошлом ({next_run_time_aware}), пропускаем восстановление.")
                                    failed_count += 1
                                    continue
                            elif cron_trigger_time:
                                cron_args = {
                                    'hour': cron_trigger_time.hour, 
                                    'minute': cron_trigger_time.minute,
                                    'timezone': self.timezone, 
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

                            executor_path = self.task_executors.get(task_type)
                            if not executor_path: logger.error(f"Путь к исполнителю {task_type} не найден для {task_id}"); failed_count += 1; continue
                            
                            job_kwargs_for_executor = {
                                'message': message,
                                'chat_ids': chat_ids,
                                'job_id': task_id, 
                                'settings': self.settings, 
                                'requires_confirmation': requires_confirmation,
                                'notification_id': notification_id,
                                'task_manager': self,
                                'confirmation_type': confirmation_type_from_db
                            }

                            try:
                                self.scheduler.add_job(
                                    executor_path,
                                    trigger=trigger,
                                    kwargs=job_kwargs_for_executor,
                                    id=str(task_id),
                                    name=f'{task_type} для всех',
                                    replace_existing=True,
                                    misfire_grace_time=3600 
                                )
                                job = self.scheduler.get_job(task_id)
                                next_run_aps = job.next_run_time if job else None
                                logger.info(f" -> Задача {task_id} (event_notification) добавлена/обновлена в APScheduler на {next_run_aps}")
                                restored_count += 1
                            except Exception as add_job_err:
                                logger.error(f"Ошибка APScheduler при восстановлении {task_id}: {add_job_err}")
                                logger.error(traceback.format_exc())
                                failed_count += 1
                        
                        else: 
                            save_success = await self.save_task(
                                task_id, chat_id, task_type, next_run_time_aware, data
                            )
                            if save_success:
                                restored_count += 1
                            else:
                                failed_count += 1
                                logger.error(f"Не удалось восстановить задачу {task_id} при вызове save_task.")
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
                courier_chat_ids = []

            if courier_chat_ids:
                processed_chats = 0
                for chat_id in courier_chat_ids:
                    logger.info(f"Синхронизация задач для чата {chat_id} из API ({processed_chats+1}/{len(courier_chat_ids)})...")
                    reg_result = await self.schedule_registration_open_event(chat_id)
                    logger.info(f"Синхронизация registration_open_event для {chat_id}: {'✅' if reg_result else '❌'}")
                    
                    shift_result = await self.schedule_shift_access(chat_id)
                    logger.info(f"Синхронизация shift_access для {chat_id}: {'✅' if shift_result else '❌'}")
                    
                    processed_chats += 1
                logger.info(f"✅ Синхронизация для {processed_chats} чатов из API завершена.")    
            else:
                logger.warning("Не найдено курьерских чатов в API для синхронизации.")

            logger.info("✅ Шаг 2 завершен: Синхронизация с API.")
            return True 

        except Exception as e:
            logger.error(f"❌ Критическая ошибка при синхронизации задач с API: {e}")
            logger.error(traceback.format_exc())
            return False
        finally:
            logger.info("--- Завершение reload_tasks --- ")

    async def schedule_shift_access(self, chat_id):
        # Планируем задачу доступа к сменам для чата
        from tasks.courier_shifts.shift_access_task import ShiftAccessTask
        instance = ShiftAccessTask(self.scheduler, self, self.settings)
        return await instance.schedule(chat_id)

    async def schedule_registration_open_event(self, chat_id):
        # Планируем задачу открытия регистрации для чата
        from tasks.websocket_events.registration_open_event_task import RegistrationOpenEventTask
        instance = RegistrationOpenEventTask(self.scheduler, self, self.settings)
        return await instance.schedule(chat_id)

    def _get_courier_chat_ids(self) -> list[str]:
        # Получаем список ID курьерских чатов из API
        logger.info(f"Получение списка ID курьерских чатов из API: {self.api_url}")
        try:
            if not self.api_url:
                logger.error("API_URL не указан в настройках!")
                return []
                
            endpoint = "api/v1/groups?type=courier"
            base_url = str(self.api_url).rstrip('/')
            full_url = f"{base_url}/{endpoint}"
            logger.info(f"Запрос к API: GET {full_url}")
            
            response = requests.get(full_url, timeout=2)
            response.raise_for_status()
            
            try:
                groups = response.json()
            except ValueError as json_err:
                logger.error(f"Ошибка декодирования JSON ответа: {json_err}")
                logger.error(f"Ответ API: {response.text[:500]}")
                return []
                
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
        # Удаляем задачу из БД и из APScheduler
        db_deleted = False
        if self.db_service:
            logger.info(f"Удаление задачи {task_id} из БД...")
            db_deleted = await self.db_service.delete_task(task_id)
            if db_deleted:
                logger.info(f"Задача {task_id} успешно удалена из БД.")
            else:
                logger.warning(f"Не удалось удалить задачу {task_id} из БД.")
        else:
            logger.warning("db_service не инициализирован, пропуск удаления из БД.")

        aps_deleted = False
        try:
            logger.info(f"Удаление задачи {task_id} из APScheduler...")
            self.scheduler.remove_job(str(task_id))
            logger.info(f"Задача {task_id} успешно удалена из APScheduler.")
            aps_deleted = True
        except Exception as e:
            logger.warning(f"Ошибка или задача {task_id} не найдена в APScheduler для удаления: {e}")
            aps_deleted = False 

        return db_deleted 

    async def delete_tasks_by_chat_and_type(self, chat_id: str, task_type: str) -> int:
        """
        Удаляет ВСЕ задачи для указанного чата и типа.
        Возвращает количество удалённых задач.
        """
        deleted_count = 0
        
        if not self.db_service:
            logger.warning("db_service не инициализирован, невозможно удалить задачи из БД.")
            return 0
        
        try:
            logger.info(f"🧹 Поиск и удаление всех задач типа '{task_type}' для чата {chat_id}...")
            
            # Получаем все задачи для этого чата и типа из БД
            tasks = await self.db_service.get_tasks_by_chat_and_type(chat_id, task_type)
            
            if not tasks:
                logger.info(f"Задачи типа '{task_type}' для чата {chat_id} не найдены.")
                return 0
            
            logger.info(f"Найдено {len(tasks)} задач для удаления: {[t['task_id'] for t in tasks]}")
            
            # Удаляем каждую задачу
            for task in tasks:
                task_id = task['task_id']
                try:
                    # Удаляем из БД
                    await self.db_service.delete_task(task_id)
                    
                    # Удаляем из APScheduler
                    try:
                        self.scheduler.remove_job(str(task_id))
                        logger.info(f"✅ Задача {task_id} удалена из APScheduler")
                    except JobLookupError:
                        logger.debug(f"Задача {task_id} не найдена в APScheduler (уже удалена или не была добавлена)")
                    except Exception as aps_err:
                        logger.warning(f"Ошибка при удалении задачи {task_id} из APScheduler: {aps_err}")
                    
                    deleted_count += 1
                    logger.info(f"✅ Задача {task_id} успешно удалена")
                    
                except Exception as task_err:
                    logger.error(f"❌ Ошибка при удалении задачи {task_id}: {task_err}")
                    continue
            
            logger.info(f"🧹 Удалено {deleted_count} задач типа '{task_type}' для чата {chat_id}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"❌ Ошибка при удалении задач для чата {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return deleted_count

    async def cancel_reminder_task(self, reminder_job_id: str) -> bool:
        # Отмена задачи-напоминания (удаление из БД и APScheduler)
        logger.info(f"Попытка отмены задачи-напоминания: {reminder_job_id}")
        success = await self.delete_task(reminder_job_id)
        if success:
            logger.info(f"Задача-напоминание {reminder_job_id} успешно отменена (удалена).")
        else:
            logger.warning(f"Не удалось отменить (удалить) задачу-напоминание {reminder_job_id}. Возможно, она уже была удалена или не существовала.")
        return success

    def _job_listener(self, event: JobExecutionEvent):
        # Слушаем события выполнения задач, обновляем БД и отправляем NOTIFY
        job_id = event.job_id

        if event.exception:
            logger.error(f"Слушатель: Задача {job_id} завершилась с ошибкой: {event.exception}")
        else:
            logger.info(f"Слушатель: Задача {job_id} успешно выполнена.")
            task_type = None
            chat_id = None
            is_one_time_job = False

            try:
                job = self.scheduler.get_job(job_id)
                actual_next_run_time = None
                if job:
                    actual_next_run_time = job.next_run_time
                    if actual_next_run_time:
                        logger.info(f"Слушатель: Следующее время запуска для {job_id} по данным APScheduler: {actual_next_run_time}")
                    else:
                         logger.info(f"Слушатель: Задача {job_id} больше не имеет следующего времени запуска (одноразовая или завершена). Пометка для удаления из БД.")
                         is_one_time_job = True
                else:
                    logger.warning(f"Слушатель: Не удалось получить объект Job для {job_id} после выполнения.")
                    # Проверяем тип задачи - некоторые задачи пересоздаются при перепланировании
                    if 'courier_shift_access' in job_id or 'registration_open_event' in job_id:
                        logger.info(f"Слушатель: Задача {job_id} будет пересоздана при перепланировании. НЕ удаляем из БД.")
                        is_one_time_job = False
                    else:
                        logger.info(f"Слушатель: Предполагаем что это одноразовая задача.")
                        is_one_time_job = True
                
                if is_one_time_job:
                    if self.db_service:
                        logger.info(f"Слушатель: Удаление одноразовой задачи {job_id} из БД после выполнения...")
                        asyncio.create_task(self.db_service.delete_task(job_id))
                elif actual_next_run_time and self.db_service:
                    logger.info(f"Слушатель: Обновление next_run_time для повторяющейся задачи {job_id} в БД...")
                    asyncio.create_task(
                        self.db_service.update_task_next_run_time(job_id, actual_next_run_time)
                    )
                
                if job and job.kwargs:
                    task_type = job.kwargs.get('task_type')
                    if task_type != 'event_notification':
                        chat_id = job.kwargs.get('chat_id') 
                    logger.debug(f"Слушатель: Получены данные из job.kwargs для {job_id}")
                elif not task_type:
                    logger.info(f"Слушатель: Попытка парсинга ID '{job_id}' для получения task_type...")
                    if job_id.startswith("reminder:"):
                        task_type = 'event_reminder'
                        parts = job_id.split(':')
                        if len(parts) == 3:
                            pass
                        logger.info(f"Слушатель: Получен task_type='{task_type}' из парсинга ID напоминания")
                    elif job_id.startswith("cleanup_permission_"):
                        task_type = 'permissions_cleanup'
                        logger.info(f"Слушатель: Получен task_type='{task_type}' из парсинга ID очистки прав")
                    else:
                        parts = job_id.split('_')
                        if len(parts) >= 3:
                            task_type = ''.join(parts[:-2])
                            logger.info(f"Слушатель: Получен task_type='{task_type}' из парсинга ID")
                            if task_type == 'courier_shift_access' and not chat_id:
                                 try: int(parts[-2]); chat_id = parts[-2]
                                 except ValueError: pass
                        else:
                            logger.error(f"Слушатель: Не удалось распарсить {job_id}. Доп. обработка невозможна.")
                            task_type = None
                
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
                    notification_id = None
                    if job and job.kwargs:
                        notification_id = job.kwargs.get('notification_id')
                    
                    if notification_id:
                        logger.info(f"Слушатель: Отметка уведомления {notification_id} как выполненного...")
                        asyncio.create_task(self._mark_notification_completed(notification_id))
                elif task_type == 'permissions_cleanup':
                    logger.info(f"Слушатель: Задача очистки прав {job_id} успешно выполнена. Дополнительная обработка не требуется.")
                elif task_type:
                     logger.debug(f"Слушатель: Для задачи типа '{task_type}' дополнительная обработка после успеха не требуется.")

            except Exception as listener_err:
                logger.error(f"Слушатель: Ошибка при обработке успешного выполнения задачи {job_id}: {listener_err}")
                logger.error(traceback.format_exc())

    async def _mark_notification_completed(self, notification_id):
        # Отправляем PATCH в API, чтобы отметить уведомление как выполненное
        try:
            api_url = getattr(self.settings, 'API_SERVER_URL', None)
            
            if not api_url:
                logger.error(f"URL API сервера (API_SERVER_URL) не задан в настройках. Не удалось обновить статус уведомления {notification_id}.")
                return
                
            update_url = f"{api_url.rstrip('/')}/api/v1/notifications/{notification_id}/status"
            
            logger.info(f"Отправка запроса на обновление статуса уведомления {notification_id} по URL: {update_url}")
            
            payload = {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.patch(update_url, json=payload)
                if response.status_code == 200:
                    logger.info(f"Статус уведомления {notification_id} успешно обновлен на 'completed'")
                else:
                    logger.error(f"Ошибка при обновлении статуса уведомления {notification_id}: {response.status_code}, {response.text}")
        except Exception as e:
            logger.error(f"Исключение при обновлении статуса уведомления {notification_id}: {e}")
            logger.error(traceback.format_exc())

