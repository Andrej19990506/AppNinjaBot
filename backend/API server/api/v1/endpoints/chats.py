from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
import httpx
from loguru import logger

from db.session import get_db_session
from core.config import settings

router = APIRouter()

@router.post(
    "/{chat_id}/invite-link",
    summary="Generate Invite Link",
    description="Generates a secure invite link for the specified chat by requesting it from the Telegram bot service.",
    tags=["Chats"]
)
async def generate_invite_link(
    chat_id: str = Path(..., description="Telegram chat ID"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Генерирует безопасную ссылку приглашения для чата через запрос к Telegram боту.
    Соблюдает архитектуру микросервисов - API сервер не работает напрямую с Telegram API.
    """
    logger.info(f"🔗 Получен запрос на генерацию ссылки приглашения для чата {chat_id}")
    
    try:
        # Получаем URL бота из конфигурации
        bot_service_url = settings.BOT_SERVICE_URL
        if not bot_service_url:
            logger.error("❌ BOT_SERVICE_URL не найден в конфигурации")
            raise HTTPException(status_code=500, detail="Bot service URL not configured")
        
        # Делаем запрос к боту для генерации ссылки
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{bot_service_url}/api/chats/{chat_id}/invite-link",
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"✅ Ссылка приглашения успешно получена от бота для чата {chat_id}")
                return result
            else:
                logger.error(f"❌ Ошибка от бота при генерации ссылки: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"Bot service error: {response.text}"
                )
                
    except httpx.TimeoutException:
        logger.error(f"❌ Таймаут при запросе к боту для чата {chat_id}")
        raise HTTPException(status_code=504, detail="Bot service timeout")
    except httpx.RequestError as e:
        logger.error(f"❌ Ошибка соединения с ботом для чата {chat_id}: {e}")
        raise HTTPException(status_code=503, detail="Bot service unavailable")
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка при генерации ссылки приглашения: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}") 