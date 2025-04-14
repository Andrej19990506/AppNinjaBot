import logging
import json
from fastapi import APIRouter, Request, HTTPException

# Импортируем типы Telegram и Application
from telegram import Update
from telegram.ext import Application

# Импортируем модель Pydantic
from .models import SendMessagePayload

# Импортируем конфигурацию (для пути вебхука и секрета)
from telegramNinjaBot.config.config import Config

# Инициализируем логгер для этого модуля
logger = logging.getLogger(__name__)

# Создаем APIRouter
router = APIRouter()

# --- Эндпоинт /api/send_message --- 
@router.post("/send_message", tags=["API"])
async def send_message_api_v2(payload: SendMessagePayload, request: Request):
    """Прямой маршрут для отправки сообщений через Telegram бота (FastAPI)"""
    logger.info("📬 Получен FastAPI запрос на /api/send_message")
    logger.info(f"Данные payload: {payload.model_dump()}")
    
    try:
        # Получаем экземпляр бота из app.state
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state")
            raise HTTPException(status_code=503, detail="Bot instance not available")
            
        # Преобразуем формат ID чата
        chat_id = payload.chat_id
        processed_chat_id: int | str
        try:
            if chat_id.startswith('-100'):
                processed_chat_id = int(chat_id.replace('-100', '-'))
            elif chat_id.startswith('-'):
                 processed_chat_id = int(chat_id)
            else:
                processed_chat_id = int(chat_id)
            logger.info(f"ID чата {chat_id} обработан как {processed_chat_id}")
        except ValueError:
             logger.error(f"Не удалось преобразовать chat_id '{chat_id}' в число")
             raise HTTPException(status_code=400, detail=f"Invalid chat_id format: {chat_id}")

        # Отправляем сообщение
        try:
            await bot_app.bot.send_message(
                chat_id=processed_chat_id,
                text=payload.text,
                parse_mode=payload.parse_mode
            )
            logger.info(f"✅ Сообщение успешно отправлено в чат {chat_id}")
            return {"success": True, "message": "Сообщение успешно отправлено"}
        except Exception as e:
            logger.error(f"❌ Ошибка при вызове bot.send_message для чата {chat_id}: {e}")
            error_message = str(e)
            if hasattr(e, 'message'):
                error_message = e.message
            raise HTTPException(status_code=500, detail=f"Failed to send message: {error_message}")
            
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /api/send_message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# --- Эндпоинт для проверки доступности отправки сообщений ---
@router.get("/send_message/health", tags=["System"])
async def check_send_message_availability(request: Request):
    """
    Проверяет доступность маршрута /send_message без фактической отправки сообщения в Telegram.
    Используется шедулером для проверки готовности бота к отправке сообщений.
    """
    try:
        # Получаем экземпляр бота из app.state только для проверки, что он доступен
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state при проверке health")
            raise HTTPException(status_code=503, detail="Bot instance not available")
            
        # Если бот доступен, возвращаем успешный статус
        logger.info("✅ Проверка доступности маршрута /send_message успешна")
        return {
            "status": "ok",
            "message": "Send message endpoint is available",
            "send_message_url": "/send_message"
        }
            
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /send_message/health: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# --- Эндпоинт для вебхука --- 
# Используем значения из Config
c = Config()
WEBHOOK_TELEGRAM_PATH = c.WEBHOOK_PATH if c.WEBHOOK_PATH else "/webhook" # Используем /webhook по умолчанию, если путь не задан
WEBHOOK_SECRET = c.WEBHOOK_SECRET

if not WEBHOOK_TELEGRAM_PATH:
    logger.warning("WEBHOOK_PATH не задан, эндпоинт вебхука не может быть создан динамически в роутере.")
    # Можно либо не создавать роут, либо использовать статический путь
    # raise ValueError("WEBHOOK_PATH не может быть пустым для регистрации эндпоинта вебхука")
    WEBHOOK_TELEGRAM_PATH = "/webhook_fallback_path" # Запасной статический путь

logger.info(f"Регистрация эндпоинта вебхука в роутере по пути: {WEBHOOK_TELEGRAM_PATH}")
@router.post(WEBHOOK_TELEGRAM_PATH, include_in_schema=False) # Скрываем из автодокументации Swagger/OpenAPI
async def telegram_webhook_endpoint(update_data: dict, request: Request):
    """Принимает обновления от Telegram через вебхук."""
    
    # Проверка секретного токена (если используется)
    if WEBHOOK_SECRET:
        secret_token_header = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
        if secret_token_header != WEBHOOK_SECRET:
            logger.warning(f"Неверный секретный токен вебхука: {secret_token_header}")
            raise HTTPException(status_code=403, detail="Invalid secret token")
    
    try:
        bot_app: Application = request.app.state.bot_application
        if not bot_app:
            logger.error("Экземпляр bot_application не найден в app.state")
            raise HTTPException(status_code=503, detail="Bot application not available")
        
        update = Update.de_json(update_data, bot_app.bot)
        logger.info(f"Получено обновление через вебхук: {update.update_id}")
        
        await bot_app.update_queue.put(update)
        
        return {"ok": True}
        
    except json.JSONDecodeError:
        logger.error("Ошибка декодирования JSON в вебхуке")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        logger.error(f"Ошибка при обработке вебхука: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error handling webhook") 