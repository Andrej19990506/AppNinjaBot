from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
import logging
import sys
import os

# Добавляем директорию проекта в sys.path для правильного импорта
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# Удаляем импорт InventoryScheduler, так как он больше не нужен напрямую
# from scheduler import InventoryScheduler

logger = logging.getLogger(__name__)
router = APIRouter()

# Удаляем создание глобального экземпляра, он должен быть получен из состояния приложения
# scheduler = InventoryScheduler()

@router.get('/health')
async def health_check(request: Request):
    """Проверка здоровья шедулера"""
    try:
        # Получаем экземпляр шедулера из состояния приложения
        scheduler = request.app.state.scheduler_instance
        if not scheduler:
            return {
                'status': 'error',
                'message': 'Шедулер не инициализирован',
                'timestamp': datetime.now().isoformat()
            }
            
        return {
            'status': 'healthy',
            'scheduler_running': scheduler.is_running(),
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Ошибка при проверке здоровья шедулера: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )

@router.get('/status')
async def scheduler_status(request: Request):
    """Получение полного статуса планировщика и всех активных задач"""
    try:
        # Получаем экземпляр шедулера из состояния приложения
        scheduler = request.app.state.scheduler_instance
        if not scheduler:
            raise HTTPException(
                status_code=500,
                detail="Шедулер не инициализирован"
            )
            
        status = {
            'is_running': scheduler.is_running(),
            'active_tasks': [],
            'timestamp': datetime.now().isoformat()
        }
        
        if scheduler.is_running():
            # Метод переименован или не существует, используем правильный метод
            try:
                # Пытаемся получить задачи через TaskManager
                if hasattr(scheduler.task_manager, 'get_all_active_tasks'):
                    active_tasks = await scheduler.task_manager.get_all_active_tasks()
                    for task in active_tasks:
                        status['active_tasks'].append({
                            'id': task.get('task_id'),
                            'type': task.get('task_type'),
                            'chat_id': task.get('chat_id'),
                            'next_run_time': task.get('next_run_time'),
                            'data': task.get('data', {})
                        })
            except Exception as task_err:
                logger.error(f"Ошибка при получении активных задач: {task_err}")
                status['active_tasks_error'] = str(task_err)
        
        return status
        
    except Exception as e:
        logger.error(f"❌ Ошибка при получении статуса планировщика: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )

@router.post('/reload-tasks')
async def reload_tasks(request: Request):
    """Принудительная перезагрузка всех запланированных задач"""
    try:
        # Получаем экземпляр шедулера из состояния приложения
        scheduler = request.app.state.scheduler_instance
        if not scheduler:
            raise HTTPException(
                status_code=500,
                detail="Шедулер не инициализирован"
            )
            
        success = scheduler.reload_scheduled_tasks()
        if success:
            return {
                "status": "success",
                "message": "Задачи успешно перезагружены",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Не удалось перезагрузить задачи"
            )
    except Exception as e:
        logger.error(f"❌ Ошибка при перезагрузке задач: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload tasks: {str(e)}"
        ) 