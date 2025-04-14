from abc import ABC, abstractmethod
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class BaseTask(ABC):
    def __init__(self, scheduler_instance, task_manager, settings):
        """
        Базовый класс для всех задач
        :param scheduler_instance: Экземпляр планировщика APScheduler
        :param task_manager: Экземпляр TaskManager
        :param settings: Объект настроек SchedulerSettings
        """
        self.scheduler = scheduler_instance
        self.task_manager = task_manager
        self.settings = settings # Сохраняем настройки

    @abstractmethod
    def execute(self, *args, **kwargs):
        """Выполнение задачи"""
        pass

    @abstractmethod
    def schedule(self, *args, **kwargs):
        """Планирование задачи"""
        pass

    def generate_task_id(self, task_type, identifier=None):
        """Генерирует уникальный ID для задачи"""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return f"{task_type}_{identifier}_{timestamp}" if identifier else f"{task_type}_{timestamp}"