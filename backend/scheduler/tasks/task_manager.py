import logging
import requests
import traceback
import os
# Меняем импорт на новую модель и добавляем функцию создания таблицы
# from models.scheduler_task import SchedulerTask
from models.scheduler_task import SchedulerTaskDB, create_table_if_not_exists
from datetime import datetime, timezone # Добавляем timezone
from .courier_shifts.shift_access_task import ShiftAccessTask
from .websocket_events.registration_open_event_task import RegistrationOpenEventTask

logger = logging.getLogger(__name__)

class TaskManager:
    def __init__(self, scheduler_instance, timezone=None):
        """
        Инициализация менеджера задач
        :param scheduler_instance: Экземпляр планировщика APScheduler
        :param timezone: Часовой пояс для работы с датами
        """
        self.scheduler = scheduler_instance
        self.timezone = timezone # Этот таймзон используется для APScheduler
        self.api_url = os.getenv('API_URL', 'http://nginx:80')

        logger.info(f"TaskManager инициализирован. API URL: {self.api_url}, Timezone: {self.timezone}")

        # Создаем таблицу в PostgreSQL при инициализации (если она еще не существует) <-- УДАЛЯЕМ/КОММЕНТИРУЕМ БЛОК
        # try:
        #      # SchedulerTask.create_table() # Старый вызов
        #      create_table_if_not_exists() # Новый вызов для PostgreSQL
        # except Exception as e:
        #      # Логируем ошибку, но не падаем (УБИРАЕМ RAISE)
        #      logger.error(f"Критическая ошибка при создании/проверке таблицы {SchedulerTaskDB.__tablename__}: {e}", exc_info=True)
        #      # Возможно, стоит остановить приложение, если БД недоступна?
        #      # raise # Пока что перебрасываем ошибку <-- КОММЕНТИРУЕМ ЭТУ СТРОКУ

        # Инициализируем экземпляры классов задач
        self.shift_access_task = ShiftAccessTask(scheduler_instance, self, timezone, self.api_url)
        self.registration_open_event_task = RegistrationOpenEventTask(scheduler_instance, self, timezone, self.api_url)

        # Регистрируем обработчики задач (ключ - task_type)
        self.task_handlers = {
            'courier_shift_access': self.shift_access_task.execute,
            'registration_open_event': self.registration_open_event_task.execute
        }

    def save_task(self, task_id, chat_id, task_type, next_run_time, data=None):
        """Сохраняет задачу в базу данных PostgreSQL"""
        # next_run_time должен приходить уже Aware, если возможно
        # Логика в SchedulerTaskDB.save обработает и Naive, и Aware (конвертирует в UTC)
        if next_run_time.tzinfo is None:
             logger.warning(f"Время {next_run_time} для задачи {task_id} не содержит информации о часовом поясе. SchedulerTaskDB сохранит его как UTC.")

        task_data = {
            "task_id": str(task_id),
            "chat_id": str(chat_id) if chat_id else None,
            "task_type": task_type,
            "next_run_time": next_run_time, # Передаем как есть
            "data": data or {},
        }

        logger.info(f"⏰ Сохраняем/обновляем задачу {task_id} (тип: {task_type}) в PostgreSQL.")

        # Используем статический метод из обновленного scheduler_task.py
        success = SchedulerTaskDB.save(task_data)
        if not success:
            logger.error(f"Не удалось сохранить задачу {task_id} в PostgreSQL.")
            # TODO: Что делать в этом случае? Повторить? Исключение?

        return success # Возвращаем результат операции

    def get_all_active_tasks(self):
        """Получает все активные задачи из PostgreSQL"""
        # Используем статический метод из обновленного scheduler_task.py
        tasks_list = SchedulerTaskDB.get_all_active()
        logger.debug(f"Получено {len(tasks_list)} активных задач из PostgreSQL.")
        return tasks_list

    def reload_tasks(self):
        """Перезагружает все задачи из PostgreSQL в APScheduler"""
        try:
            logger.info("🔄 Перезагрузка запланированных задач из PostgreSQL")

            # Очищаем все текущие задачи из планировщика APScheduler
            self.scheduler.remove_all_jobs()
            logger.info("Старые задачи из APScheduler удалены.")

            # >>> ПЕРЕПЛАНИРОВАНИЕ УВЕДОМЛЕНИЙ ПРИ СТАРТЕ (остается без изменений) <<<
            logger.info("Планирование уведомлений об открытии регистрации...")
            try:
                courier_chat_ids = self._get_courier_chat_ids()
                if courier_chat_ids:
                    logger.info(f"Найдено {len(courier_chat_ids)} курьерских чатов для планирования уведомлений.")
                    for chat_id in courier_chat_ids:
                        self.schedule_registration_open_event(chat_id)
                else:
                     logger.warning("Не найдено курьерских чатов для планирования уведомлений (API вернул пустой список?).")
            except Exception as e:
                 logger.error(f"Ошибка при планировании уведомлений об открытии регистрации: {e}")
                 logger.error(traceback.format_exc())
            # >>> КОНЕЦ БЛОКА ПЕРЕПЛАНИРОВАНИЯ <<<

            # Загружаем все активные задачи из базы данных PostgreSQL
            active_tasks = self.get_all_active_tasks() # Получаем список словарей
            loaded_tasks_count = 0
            logger.info(f"Загрузка {len(active_tasks)} активных задач из PostgreSQL...")

            for task_dict in active_tasks: # Итерируемся по словарям
                 task_id = task_dict['task_id']
                 task_type = task_dict['task_type']
                 chat_id = task_dict['chat_id']
                 data = task_dict['data']

                 # Время из БД приходит как строка ISO 8601 с таймзоной (UTC)
                 try:
                     run_time_str = task_dict['next_run_time']
                     # Парсим строку ISO, сохраняя информацию о таймзоне
                     run_time_aware = datetime.fromisoformat(run_time_str)
                     # Конвертируем в локальный часовой пояс планировщика для сравнения и логирования
                     run_time_local = run_time_aware.astimezone(self.timezone)
                 except (TypeError, ValueError, KeyError) as e:
                      logger.error(f"Ошибка парсинга времени '{task_dict.get('next_run_time')}' для задачи {task_id}: {e}. Пропускаем.")
                      continue

                 # Проверяем, не в прошлом ли время (в локальном времени планировщика)
                 now_local = datetime.now(self.timezone)
                 if run_time_local < now_local:
                     logger.warning(f"⚠️ Время выполнения задачи {task_id} ({run_time_local}) уже прошло ({now_local}). Пропускаем добавление.")
                     # TODO: Возможно, стоит перепланировать или удалить такую задачу?
                     self.delete_task(task_id) # Пока удаляем просроченные
                     continue # Пропускаем эту задачу

                 handler = self.task_handlers.get(task_type)
                 if handler:
                     try:
                          job_args = [chat_id] if chat_id else []
                          self.scheduler.add_job(
                              handler,
                              'date',
                              # Передаем Aware время (можно UTC или локальное, APScheduler разберется)
                              run_date=run_time_aware, # Используем Aware время (например, UTC из БД)
                              args=job_args,
                              id=task_id,
                              name=f'{task_type} для {chat_id if chat_id else "всех"}',
                              replace_existing=True,
                              misfire_grace_time=3600
                          )
                          loaded_tasks_count += 1
                          logger.info(f" -> Задача {task_id} добавлена на {run_time_local} (UTC: {run_time_aware})")
                     except Exception as add_job_err:
                          logger.error(f"Ошибка при добавлении задачи {task_id} в APScheduler: {add_job_err}")
                 else:
                      logger.warning(f"⚠️ Не найден обработчик для типа задачи: {task_type} (ID: {task_id})")

            logger.info(f"✅ Загружено {loaded_tasks_count} активных задач в APScheduler.")
            return True

        except Exception as e:
            logger.error(f"❌ Критическая ошибка при перезагрузке задач: {e}")
            logger.error(traceback.format_exc())
            return False

    # Метод для существующей задачи (остается без изменений)
    def schedule_shift_access(self, chat_id):
        """Планирует задачу проверки доступа к сменам"""
        return self.shift_access_task.schedule(chat_id)

    # Метод для нашей задачи (остается без изменений)
    def schedule_registration_open_event(self, chat_id):
        """Планирует задачу отправки WS события об открытии регистрации"""
        logger.debug(f"Вызов schedule_registration_open_event для chat_id: {chat_id}")
        return self.registration_open_event_task.schedule(chat_id)

    # Метод _get_courier_chat_ids (остается без изменений)
    def _get_courier_chat_ids(self) -> list[str]:
        """Получает список ID курьерских чатов из API сервера."""
        logger.info("Получение списка ID курьерских чатов из API...")
        try:
            url = f"{self.api_url}/api/v1/groups?type=courier"
            logger.debug(f"Запрос к API: GET {url}")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            groups = response.json()
            chat_ids = [str(group['group_id']) for group in groups if 'group_id' in group]
            if chat_ids:
                 logger.info(f"Получено {len(chat_ids)} ID курьерских чатов: {chat_ids}")
            else:
                 logger.warning("API не вернул курьерских чатов.")
            return chat_ids
        except requests.exceptions.RequestException as e:
            logger.error(f"Ошибка при запросе списка курьерских групп из API: {e}")
            if e.response is not None:
                logger.error(f"API Response Status: {e.response.status_code}")
                logger.error(f"API Response Body: {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Неожиданная ошибка при получении списка курьерских групп: {e}")
            logger.error(traceback.format_exc())
            return []

    # --- Обновляем метод удаления задачи из БД --- 
    def delete_task(self, task_id):
        """Удаляет задачу из базы данных PostgreSQL по ID."""
        try:
            logger.info(f"Удаление задачи {task_id} из PostgreSQL...")
            # Используем статический метод из обновленного scheduler_task.py
            deleted = SchedulerTaskDB.delete(task_id)
            if deleted:
                 logger.info(f"Задача {task_id} успешно удалена из PostgreSQL.")
            else:
                 logger.warning(f"Задача {task_id} не найдена в PostgreSQL для удаления.")
            return deleted
        except Exception as e:
            logger.error(f"Ошибка при удалении задачи {task_id} из PostgreSQL: {e}")
            return False 