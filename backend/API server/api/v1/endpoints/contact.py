from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict
from typing import Optional
import httpx
import os
from dotenv import load_dotenv
from loguru import logger
from datetime import datetime

# Загружаем переменные окружения
load_dotenv()

router = APIRouter()

# Telegram Bot настройки
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8012479473:AAHHMhUpZb2XD_08Plv_o5mr_YUMbMLYhUw")
TELEGRAM_CHAT_ID = int(os.getenv("TELEGRAM_CHAT_ID", "6843570748"))
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"


# Схема для запроса контактной формы
class ContactFormRequest(BaseModel):
    model_config = ConfigDict(extra='ignore')
    
    name: str
    company: Optional[str] = None
    phone: str
    points: str
    message: Optional[str] = None


@router.post(
    "/landing/contact",
    summary="Send Landing Page Contact Form",
    description="Отправляет данные контактной формы лендинга в Telegram",
    tags=["Contact"]
)
async def send_contact_form(form_data: ContactFormRequest):
    """
    Получает данные с формы лендинга и отправляет их в Telegram.
    
    Токен бота и Chat ID хранятся в переменных окружения для безопасности.
    """
    try:
        # Валидация обязательных полей
        if not form_data.name or not form_data.phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Имя и телефон обязательны для заполнения"
            )
        
        # Формируем сообщение для Telegram
        telegram_message = f"""
🔔 Новая заявка с сайта FloWix!

👤 Имя: {form_data.name}
🏢 Компания: {form_data.company or 'Не указано'}
📞 Телефон: {form_data.phone}
📍 Точек: {form_data.points}
💬 Сообщение: {form_data.message or 'Нет'}

⏰ {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}
        """.strip()
        
        # Логируем настройки
        logger.info(f"Отправка в Telegram. Chat ID: {TELEGRAM_CHAT_ID}, Token: {TELEGRAM_BOT_TOKEN[:20]}...")
        
        # Отправляем сообщение в Telegram
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TELEGRAM_API_URL,
                json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": telegram_message,
                    "parse_mode": "HTML"
                }
            )
            
            # Логируем ответ для отладки
            if not response.is_success:
                error_detail = response.text
                logger.error(f"Ошибка Telegram API: {response.status_code} - {error_detail}")
            
            # Проверяем успешность отправки
            response.raise_for_status()
            
            logger.info(f"Заявка успешно отправлена в Telegram: {form_data.name} ({form_data.phone})")
            
            return {
                "success": True,
                "message": "Заявка успешно отправлена!"
            }
            
    except httpx.HTTPError as e:
        logger.error(f"Ошибка при отправке в Telegram: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось отправить заявку. Попробуйте позже."
        )
    except Exception as e:
        logger.error(f"Неожиданная ошибка при обработке формы: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

