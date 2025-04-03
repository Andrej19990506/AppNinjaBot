import logging
from models.scheduler_task import SchedulerTask
from datetime import datetime
from .courier_shifts.shift_access_task import ShiftAccessTask

logger = logging.getLogger(__name__)

class TaskManager:
    def __init__(self, scheduler_instance, timezone=None):
        """
        Инициализация менеджера задач
        :param scheduler_instance: Экземпляр планировщика APScheduler
        :param timezone: Часовой пояс для работы с датами
        """
        self.scheduler = scheduler_instance
        self.timezone = timezone
        
        # Создаем таблицу в базе данных при инициализации
        SchedulerTask.create_table()
        
        # Инициализируем доступные типы задач
        self.shift_access_task = ShiftAccessTask(scheduler_instance, self, timezone)
        
        # Регистрируем обработчики задач
        self.task_handlers = {
            'courier_shift_access': self.shift_access_task.execute
        }

    def save_task(self, task_id, chat_id, task_type, next_run_time, data=None):
        """Сохраняет задачу в базу данных"""
        task = SchedulerTask(
            task_id=task_id,
            chat_id=chat_id,
            task_type=task_type,
            next_run_time=next_run_time,
            data=data or {}
        )
        logger.info(f"⏰ Сохраняем задачу с временем выполнения: {next_run_time} (тип задачи: {task_type})")
        return SchedulerTask.save(task)

    def get_all_active_tasks(self):
        """Получает все активные задачи"""
        return SchedulerTask.get_all_active()

    def reload_tasks(self):
        """Перезагружает все задачи из базы данных"""
        try:
            logger.info("🔄 Перезагрузка запланированных задач")
            
            # Очищаем все текущие задачи
            self.scheduler.remove_all_jobs()
            
            # Загружаем все активные задачи из базы данных
            active_tasks = self.get_all_active_tasks()
            loaded_tasks = 0

            for task in active_tasks:
                handler = self.task_handlers.get(task.task_type)
                if handler:
                    self.scheduler.add_job(
                        handler,
                        'date',
                        run_date=task.next_run_time,
                        args=[task.chat_id] if task.chat_id else [],
                        id=task.task_id,
                        name=f'{task.task_type} для чата {task.chat_id if task.chat_id else "всех"}'
                    )
                    loaded_tasks += 1
                else:
                    logger.warning(f"⚠️ Не найден обработчик для типа задачи: {task.task_type}")
            
            logger.info(f"✅ Перезагружено {loaded_tasks} активных задач")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при перезагрузке задач: {str(e)}")
            return False

    def schedule_shift_access(self, chat_id):
        """Планирует задачу проверки доступа к сменам"""
        return self.shift_access_task.schedule(chat_id) 