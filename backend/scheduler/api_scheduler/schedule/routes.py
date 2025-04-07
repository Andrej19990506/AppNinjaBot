from fastapi import APIRouter, HTTPException
from datetime import datetime
import logging
import sys
import os

# Добавляем директорию проекта в sys.path для правильного импорта
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from scheduler import InventoryScheduler

logger = logging.getLogger(__name__)
router = APIRouter()

# Получаем инстанс шедулера
scheduler = InventoryScheduler()

@router.get('/health')
def health_check():
    """Проверка здоровья шедулера"""
    try:
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
def scheduler_status():
    """Получение полного статуса планировщика и всех активных задач"""
    try:
        status = {
            'is_running': scheduler.is_running(),
            'active_tasks': [],
            'timestamp': datetime.now().isoformat()
        }
        
        if scheduler.is_running():
            active_tasks = scheduler._get_all_active_tasks()
            for task in active_tasks:
                status['active_tasks'].append({
                    'id': task.task_id,
                    'type': task.task_type,
                    'chat_id': task.chat_id,
                    'next_run_time': task.next_run_time.isoformat() if task.next_run_time else None,
                    'data': task.data
                })
        
        return status
        
    except Exception as e:
        logger.error(f"❌ Ошибка при получении статуса планировщика: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )

@router.post('/reload-tasks')
def reload_tasks():
    """Принудительная перезагрузка всех запланированных задач"""
    try:
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