import logging
import json
import os
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from datetime import datetime

# Импортируем типы Telegram и Application
from telegram import Update, InputFile
from telegram.ext import Application
from telegram.constants import ParseMode

# Импортируем модель Pydantic
from .models import SendMessagePayload

# Импортируем конфигурацию (для пути вебхука и секрета)
from telegramNinjaBot.config.config import Config

# Инициализируем логгер для этого модуля
logger = logging.getLogger(__name__)

# Определяем базовую директорию для файлов табеля (для безопасности)
ALLOWED_FILE_DIR = Path("/app/shared/timesheets")

# Модель для эндпоинта отправки файла
class SendFilePayload(BaseModel):
    target_chat_id: int
    file_path: str

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


# --- НОВЫЙ ЭНДПОИНТ /internal/send-file --- 
@router.post("/internal/send-file", tags=["Internal"], status_code=status.HTTP_200_OK)
async def send_file_internal(payload: SendFilePayload, request: Request):
    """Принимает запрос от API Server и отправляет указанный файл пользователю или в группу."""
    logger.info(f"📬 Получен внутренний запрос на /internal/send-file для чата ID {payload.target_chat_id}")
    logger.debug(f"Payload: {payload.model_dump()}")

    try:
        # Получаем экземпляр бота
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state при запросе send-file")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Bot instance not available")

        # Валидация пути к файлу
        requested_path = Path(payload.file_path)
        logger.info(f"Проверка пути файла: {requested_path}")

        # 1. Проверка на абсолютный путь (уже должен быть абсолютным от API)
        if not requested_path.is_absolute():
             logger.error(f"❌ Указан относительный путь: {requested_path}")
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path: Must be absolute.")

        # 2. Проверка существования файла
        if not requested_path.is_file():
             logger.error(f"❌ Файл не найден по пути: {requested_path}")
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found at path: {requested_path.name}") # Не показываем полный путь

        # 3. Проверка нахождения файла в разрешенной директории (ВАЖНО для безопасности!)
        try:
             # resolve() нужен для обработки символических ссылок и '..'
             resolved_path = requested_path.resolve(strict=True)
             allowed_dir_resolved = ALLOWED_FILE_DIR.resolve(strict=True)
             if not resolved_path.is_relative_to(allowed_dir_resolved):
                 logger.error(f"❌ Попытка доступа к файлу вне разрешенной директории: {resolved_path}")
                 raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to the specified file path.")
        except Exception as path_resolve_err:
             logger.error(f"❌ Ошибка при проверке пути файла {requested_path}: {path_resolve_err}", exc_info=True)
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error validating file path.")

        logger.info(f"Путь {resolved_path} прошел валидацию. Попытка отправки документа.")

        # Отправка документа
        try:
            # <<< Открываем файл для чтения в бинарном режиме >>>
            with open(resolved_path, "rb") as document_file:
                await bot_app.bot.send_document(
                    chat_id=payload.target_chat_id,
                    document=document_file, 
                    filename=resolved_path.name,
                    caption=f"Ваш табель за {datetime.now().strftime('%Y-%m-%d')} готов."
                )
            logger.info(f"✅ Файл {resolved_path.name} успешно отправлен в чат {payload.target_chat_id}")
            
            # Удаление файла после отправки (можно убрать, если API это делает)
            # try:
            #    resolved_path.unlink()
            #    logger.info(f"Файл {resolved_path} удален после отправки.")
            # except OSError as unlink_err:
            #    logger.error(f"Ошибка удаления файла {resolved_path}: {unlink_err}")

            return {"success": True, "message": "File sent successfully"}

        except Exception as send_err:
            logger.error(f"❌ Ошибка при отправке документа {resolved_path.name} в чат {payload.target_chat_id}: {send_err}", exc_info=True)
            error_message = str(send_err)
            if hasattr(send_err, 'message'):
                 error_message = send_err.message
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send document via Telegram: {error_message}")

    except HTTPException as http_exc:
        # Перебрасываем HTTP исключения, чтобы FastAPI их правильно обработал
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /internal/send-file: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {e}") 