from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class PermissionCleanupRequest(BaseModel):
    user_id: int
    group_id: int
    permission_type: str
    expires_at: str  # ISO format datetime

@router.post("/schedule-cleanup")
async def schedule_permissions_cleanup(request: Request, cleanup_request: PermissionCleanupRequest):
    """Планирует задачу очистки истекших прав на конкретное время"""
    try:
        # Получаем экземпляр шедулера из состояния приложения
        scheduler = request.app.state.scheduler_instance
        if not scheduler:
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        # Парсим время истечения
        expires_at = datetime.fromisoformat(cleanup_request.expires_at.replace('Z', '+00:00'))
        
        # Подготавливаем данные для планирования
        cleanup_data = {
            'user_id': cleanup_request.user_id,
            'group_id': cleanup_request.group_id,
            'permission_type': cleanup_request.permission_type,
            'expires_at': expires_at
        }
        
        # Планируем задачу очистки
        success = await scheduler.schedule_permissions_cleanup(cleanup_data)
        
        if success:
            return {
                "status": "success",
                "message": f"Задача очистки запланирована на {expires_at}",
                "user_id": cleanup_request.user_id,
                "group_id": cleanup_request.group_id,
                "permission_type": cleanup_request.permission_type,
                "expires_at": expires_at.isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to schedule cleanup task")
            
    except ValueError as e:
        logger.error(f"Invalid datetime format: {e}")
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    except Exception as e:
        logger.error(f"Error scheduling permissions cleanup: {e}")
        raise HTTPException(status_code=500, detail=f"Error scheduling cleanup: {str(e)}") 