from apscheduler.schedulers.background import BackgroundScheduler
import pytz
import logging
from tasks.task_manager import TaskManager # <-- Раскомментируем этот импорт

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('Scheduler')

class InventoryScheduler:
    def __init__(self, api_url=None):
        """Инициализация планировщика"""
        # Создаем экземпляр APScheduler
        self.scheduler = BackgroundScheduler()
        self.timezone = pytz.timezone('Asia/Krasnoyarsk')
        self._is_running = False
        
        # Инициализируем менеджер задач
        self.task_manager = TaskManager(self.scheduler, self.timezone) # <-- Раскомментируем использование

    def start(self):
        """Запуск планировщика"""
        try:
            if not self._is_running:
                self.scheduler.start()
                self._is_running = True
                
                # Загружаем все активные задачи
                self.reload_scheduled_tasks()
                logger.info("✅ Планировщик успешно запущен")
                
        except Exception as e:
            logger.error(f"❌ Ошибка при запуске планировщика: {str(e)}")
            raise

    def stop(self):
        """Остановка планировщика"""
        if self._is_running:
            self.scheduler.shutdown()
            self._is_running = False
            logger.info("✅ Планировщик остановлен")

    def is_running(self):
        """Проверка состояния планировщика"""
        return self._is_running

    def reload_scheduled_tasks(self):
        """Перезагружает все задачи из базы данных"""
        return self.task_manager.reload_tasks() # <-- Раскомментируем использование

    def apply_access_settings(self, chat_id):
        """Применяет настройки доступа для чата"""
        return self.task_manager.schedule_shift_access(chat_id) # <-- Раскомментируем использование

# Создаем экземпляр планировщика
scheduler = InventoryScheduler() # <-- Раскомментируем создание экземпляра 