import logging
import httpx
import asyncio
from typing import TYPE_CHECKING
from datetime import datetime, timedelta

# Импортируем базовый класс и зависимости
from ..base_task import BaseTask
from core.config import SchedulerSettings
from shared.http_client import get_async_http_client

# Осторожно с циклическими импортами!
if TYPE_CHECKING:
    from tasks.task_manager import TaskManager
    from apscheduler.schedulers.base import BaseScheduler

logger = logging.getLogger(__name__)

# --- Статическая функция-обертка для APScheduler ---
async def cleanup_expired_permissions(**kwargs):
    """Статическая обертка для PermissionsCleanupTask, вызываемая APScheduler."""
    logger.info(f"[cleanup_expired_permissions] Запуск очистки истекших прав...")
    
    job_id = kwargs.get('job_id')
    settings = kwargs.get('settings')
    task_manager = kwargs.get('task_manager')
    scheduler_instance = kwargs.get('scheduler_instance')

    if not all([settings, scheduler_instance, task_manager]):
        logger.error(f"[cleanup_expired_permissions] Недостаточно данных для выполнения задачи.")
        return

    try:
        # Создаем экземпляр
        task_instance = PermissionsCleanupTask(
            scheduler_instance=scheduler_instance, 
            task_manager=task_manager, 
            settings=settings
        )
        # Вызываем execute
        await task_instance.execute(**kwargs)
        logger.info(f"[cleanup_expired_permissions] Очистка истекших прав завершена.")
    except Exception as e:
        logger.error(f"[cleanup_expired_permissions] Ошибка при выполнении очистки: {e}", exc_info=True)

# --- Класс задачи ---
class PermissionsCleanupTask(BaseTask):
    TASK_TYPE = 'permissions_cleanup'

    def __init__(self, scheduler_instance: 'BaseScheduler', task_manager: 'TaskManager', settings: SchedulerSettings):
        super().__init__(scheduler_instance, task_manager, settings)
        logger.debug(f"PermissionsCleanupTask инициализирован.")

    async def schedule(self, cleanup_data: dict = None):
        """Планирует одноразовую задачу очистки истекших прав на конкретное время."""
        if not cleanup_data or 'expires_at' not in cleanup_data:
            logger.error("Не указано время истечения прав для планирования задачи очистки")
            return False
        
        expires_at = cleanup_data['expires_at']
        user_id = cleanup_data.get('user_id')
        group_id = cleanup_data.get('group_id')
        permission_type = cleanup_data.get('permission_type')
        
        # Генерируем уникальный ID для задачи
        job_id = f"cleanup_permission_{user_id}_{group_id}_{permission_type}_{expires_at.strftime('%Y%m%d_%H%M%S')}"
        
        try:
            # Используем TaskManager для сохранения задачи в БД
            success = await self.task_manager.save_task(
                task_id=job_id,
                chat_id=None,  # Системная задача без привязки к чату
                task_type=self.TASK_TYPE,
                next_run_time=expires_at,
                data={
                    'cleanup_type': 'permissions',
                    'user_id': user_id,
                    'group_id': group_id,
                    'permission_type': permission_type,
                    'expires_at': expires_at.isoformat()
                }
            )
            
            if success:
                logger.info(f"Задача очистки истекших прав запланирована с ID: {job_id} на {expires_at}")
                return True
            else:
                logger.error(f"Ошибка при сохранении задачи очистки в БД: {job_id}")
                return False
            
        except Exception as e:
            logger.error(f"Ошибка при планировании задачи очистки: {e}", exc_info=True)
            return False

    async def execute(self, **kwargs):
        """Выполняет очистку истекших прав через API."""
        job_id = kwargs.get('job_id')
        logger.info(f"Начинаю очистку истекших временных прав (Job ID: {job_id})...")
        
        # Получаем данные из задачи для уведомления
        task_data = kwargs.get('data', {})
        user_id = task_data.get('user_id')
        group_id = task_data.get('group_id')
        
        logger.info(f"[cleanup_task] kwargs: {kwargs}")
        logger.info(f"[cleanup_task] task_data: {task_data}")
        logger.info(f"[cleanup_task] user_id: {user_id}, group_id: {group_id}")
        
        # Получаем URL API сервера
        api_url = getattr(self.settings, 'API_URL', None)
        if not api_url:
            logger.error("URL API сервера (API_URL) не задан в настройках.")
            return
        
        # Отправляем WebSocket уведомление перед очисткой
        if user_id and group_id:
            await self._send_expiration_notification(user_id, group_id)
        
        # Формируем URL для очистки (преобразуем AnyUrl в строку)
        api_url_str = str(api_url)
        cleanup_url = f"{api_url_str.rstrip('/')}/api/v1/user-permissions/cleanup"
        
        client = None
        try:
            client = await get_async_http_client()
            
            logger.info(f"Отправляю запрос на очистку: {cleanup_url}")
            response = await client.delete(cleanup_url, timeout=30.0)
            
            if response.status_code == 200:
                result = response.json()
                message = result.get('message', 'Очистка завершена')
                logger.info(f"✅ Очистка истекших прав выполнена успешно: {message}")
            else:
                logger.error(f"❌ Ошибка при очистке истекших прав: {response.status_code}, {response.text}")
                
        except Exception as e:
            logger.error(f"❌ Исключение при очистке истекших прав: {e}", exc_info=True)
        finally:
            if client:
                await client.aclose()
                
        logger.info("Задача очистки истекших прав завершена.")
    
    async def _send_expiration_notification(self, user_id: int, group_id: int):
        """Отправляет WebSocket уведомление о истечении прав"""
        try:
            # Подключаемся к БД через настройки
            import asyncpg
            
            # Получаем настройки БД из scheduler settings
            db_host = getattr(self.settings, 'POSTGRES_HOST', 'postgres')
            db_port = getattr(self.settings, 'POSTGRES_PORT', 5432)
            db_name = getattr(self.settings, 'POSTGRES_DB', 'postgres')
            db_user = getattr(self.settings, 'POSTGRES_USER', 'postgres')
            db_password = getattr(self.settings, 'POSTGRES_PASSWORD', 'postgres')
            
            conn = await asyncpg.connect(
                host=db_host,
                port=db_port,
                database=db_name,
                user=db_user,
                password=db_password
            )
            
            # Формируем уведомление
            notify_payload = {
                "type": "user_permissions_changed",
                "user_id": user_id,
                "group_id": group_id,
                "notification_type": "expired_automatically",
                "message": "Ваш доступ истек. Обратитесь к Администратору вашей группы",
                "timestamp": datetime.now().isoformat()
            }
            
            import json
            notification_json = json.dumps(notify_payload)
            await conn.execute("SELECT pg_notify('websocket_channel', $1)", notification_json)
            
            logger.info(f"WebSocket уведомление об истечении прав отправлено для пользователя {user_id} в группе {group_id}")
            
            await conn.close()
            
        except Exception as e:
            logger.error(f"Ошибка при отправке WebSocket уведомления об истечении прав: {e}", exc_info=True) 