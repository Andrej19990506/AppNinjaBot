from apscheduler.schedulers.asyncio import AsyncIOScheduler
import pytz
import logging
import asyncio  # Добавляем для работы с асинхронными функциями
from tasks.task_manager import TaskManager
# Добавляем импорт нашего конфига
from core.config import scheduler_settings as default_settings # Импортируем под псевдонимом, чтобы не конфликтовать с аргументом
# Импортируем DatabaseService для типизации
from services.database_service import DatabaseService
import traceback

# УБИРАЕМ базовую конфигурацию логов отсюда
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
logger = logging.getLogger('Scheduler')

class InventoryScheduler:
    def __init__(self, settings=None, db_service=None): # Принимаем настройки и сервис БД
        """Инициализация планировщика"""
        # Используем переданные настройки или дефолтные
        self.settings = settings or default_settings 
        
        # Сохраняем сервис БД
        self.db_service = db_service
        
        # Используем TIMEZONE из настроек
        self.timezone = pytz.timezone(self.settings.TIMEZONE)
        
        # Создаем экземпляр APScheduler с настройками БД из нашего конфига
        # APScheduler может сам использовать URL базы данных
        jobstores = {
            'default': {'type': 'sqlalchemy', 'url': self.settings.DATABASE_URL}
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
        
        self._is_running = False
        
        # Инициализируем менеджер задач, передаем настройки и сервис БД
        self.task_manager = TaskManager(self.scheduler, self.settings, self.db_service) 

    def start(self):
        """Запуск планировщика"""
        try:
            if not self._is_running:
                # Перед стартом APScheduler нужно убедиться, что таблицы созданы,
                # особенно если используется SQLAlchemyJobStore.
                # TaskManager больше не создает таблицу SchedulerTaskDB.
                # APScheduler сам создаст свои таблицы при первом запуске с SQLAlchemyJobStore.
                
                # --- Привязка к event loop перед стартом --- 
                # Убедимся, что планировщик использует event loop FastAPI
                try:
                    loop = asyncio.get_running_loop()
                    self.scheduler.configure(event_loop=loop)
                    logger.info(f"Планировщик будет использовать существующий event loop: {loop}")
                except RuntimeError:
                    # Если get_running_loop() падает (например, вне async контекста FastAPI), 
                    # AsyncIOScheduler создаст свой loop при start(), но это может быть не то, что нам нужно.
                    # В контексте FastAPI lifespan это не должно произойти.
                    logger.warning("Не удалось получить текущий event loop при старте планировщика.")
                    # Можно либо упасть, либо позволить создать свой loop.
                    # raise RuntimeError("Невозможно запустить планировщик без event loop")
                
                self.scheduler.start() # AsyncIOScheduler.start() неблокирующий
                self._is_running = True
                
                # Убираем вызов загрузки активных задач из метода start()
                # Загрузка задач будет выполняться отдельно в app.py
                logger.info("✅ Планировщик успешно запущен")
                
        except Exception as e:
            logger.error(f"❌ Ошибка при запуске планировщика: {str(e)}")
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
            logger.info("🔍 Запущена асинхронная загрузка активных задач")

            # Проверяем, инициализирован ли db_service
            if not self.db_service:
                logger.error("❌ Сервис БД не инициализирован, невозможно загрузить задачи")
                return False

            # Просто вызываем асинхронный метод менеджера задач
            # Больше никакой возни с event loop'ами здесь
            result = await self.task_manager.reload_tasks() 
            
            logger.info(f"✅ Асинхронная загрузка задач успешно завершена: {result}")
            return result
        # Убираем обработку RuntimeError, связанную с event loop
        except Exception as e:
            logger.error(f"❌ Непредвиденная ошибка при асинхронной загрузке задач: {e}")
            # Можно добавить более детальное логирование ошибки, если нужно
            # import traceback
            # logger.error(traceback.format_exc())
            return False

    # Меняем сигнатуру на async def
    async def apply_access_settings(self, chat_id):
        """
        Асинхронно применяет настройки доступа для чата - делегирует вызов в task_manager.
        """
        logger.info(f"Запуск асинхронного apply_access_settings для chat_id: {chat_id}")
        try:
            if hasattr(self, 'task_manager') and self.task_manager:
                # Просто вызываем асинхронный метод менеджера задач
                # Больше никакой возни с event loop'ами здесь
                result = await self.task_manager.schedule_shift_access(chat_id) 
                logger.info(f"✅ Успешно выполнен асинхронный schedule_shift_access для chat_id: {chat_id}")
                return result
            else:
                logger.error("❌ TaskManager не инициализирован!")
                return False
        # Убираем обработку RuntimeError, связанную с event loop
        except Exception as e:
            logger.error(f"❌ Непредвиденная ошибка при асинхронном вызове apply_access_settings для chat_id {chat_id}: {e}")
            # Можно добавить более детальное логирование ошибки, если нужно
            # import traceback
            # logger.error(traceback.format_exc())
            return False

# Удаляем создание глобального экземпляра, он создается в app.py
# scheduler = InventoryScheduler() 