from apscheduler.schedulers.asyncio import AsyncIOScheduler
import pytz
import logging
import asyncio 
from tasks.task_manager import TaskManager
from core.config import scheduler_settings as default_settings 
from services.database_service import DatabaseService
import traceback

logger = logging.getLogger('Scheduler')

class InventoryScheduler:
    def __init__(self, settings=None, db_service=None): 
        """Инициализация планировщика"""
        self.settings = settings or default_settings 
        

        self.db_service = db_service
        
 
        self.timezone = pytz.timezone(self.settings.TIMEZONE)
        

        try:
            import redis
        except ImportError:
            raise

        jobstores = {
            'default': { 'type': 'redis',
                         'host': self.settings.REDIS_HOST,
                         'port': self.settings.REDIS_PORT,
                         'db': self.settings.REDIS_DB_SCHEDULER,
                         'password': self.settings.REDIS_PASSWORD
                       }
        }

        job_defaults = {
            'coalesce': False,
            'max_instances': 3
        }
        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            job_defaults=job_defaults,
            timezone=self.timezone,
        )
        redis_host = self.settings.REDIS_HOST
        redis_port = self.settings.REDIS_PORT
        redis_db = self.settings.REDIS_DB_SCHEDULER
        logger.info(f"💾 APScheduler настроен с RedisJobStore (DragonflyDB) -> {redis_host}:{redis_port}, DB: {redis_db}")
        
        self._is_running = False
        
        # Инициализируем менеджер задач, передаем настройки и сервис БД
        self.task_manager = TaskManager(self.scheduler, self.settings, self.db_service) 

    def start(self):
        """Запуск планировщика"""
        try:
            if not self._is_running:

                try:
                    loop = asyncio.get_running_loop()
                    self.scheduler.configure(event_loop=loop)
                    logger.info(f"Планировщик будет использовать существующий event loop: {loop}")
                except RuntimeError:

                    logger.warning("Не удалось получить текущий event loop при старте планировщика.")

                
                self.scheduler.start() # AsyncIOScheduler.start() неблокирующий
                self._is_running = True
                
                # Убираем вызов загрузки активных задач из метода start()
                # Загрузка задач будет выполняться отдельно в app.py
                logger.info("✅ Планировщик успешно запущен")
                
        except Exception as e:
            logger.error(f"Ошибка при запуске планировщика: {str(e)}")
            logger.error(traceback.format_exc()) # Добавим трейсбек для детальной ошибки
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

    # Меняем сигнатуру на async def
    async def reload_scheduled_tasks(self): 
        """Асинхронно перезагружает все задачи из базы данных"""
        try:
            logger.info("Запущена асинхронная загрузка активных задач")

 
            if not self.db_service:
                logger.error("Сервис БД не инициализирован, невозможно загрузить задачи")
                return False


            result = await self.task_manager.reload_tasks() 
            
            logger.info(f"Асинхронная загрузка задач успешно завершена: {result}")
            return result
        except Exception as e:
            logger.error(f"Непредвиденная ошибка при асинхронной загрузке задач: {e}")
            return False


    async def apply_access_settings(self, chat_id):
        """
        Асинхронно применяет настройки доступа для чата - делегирует вызов в task_manager.
        """
        logger.info(f"Запуск асинхронного apply_access_settings для chat_id: {chat_id}")
        try:
            if hasattr(self, 'task_manager') and self.task_manager:
                result = await self.task_manager.schedule_shift_access(chat_id) 
                logger.info(f"Успешно выполнен асинхронный schedule_shift_access для chat_id: {chat_id}")
                return result
            else:
                logger.error("TaskManager не инициализирован!")
                return False
        except Exception as e:
            logger.error(f"Непредвиденная ошибка при асинхронном вызове apply_access_settings для chat_id {chat_id}: {e}")
            return False

