import logging
import json
import os
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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
    period_year: Optional[int] = None
    period_month: Optional[int] = None # Ожидаем 1-12 от API
    period_is_weekly: Optional[bool] = None
    period_start_date: Optional[str] = None # YYYY-MM-DD
    period_end_date: Optional[str] = None   # YYYY-MM-DD

# Модель для эндпоинта обновления данных пользователя
class RefreshUserPayload(BaseModel):
    user_id: int

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
        chat_id_str = payload.chat_id
        processed_chat_id: int
        try:
            # Просто преобразуем строку в int, Telegram сам разберется с форматом
            processed_chat_id = int(chat_id_str)
            logger.info(f"ID чата {chat_id_str} обработан как {processed_chat_id}")
        except ValueError:
             logger.error(f"Не удалось преобразовать chat_id '{chat_id_str}' в число")
             raise HTTPException(status_code=400, detail=f"Invalid chat_id format: {chat_id_str}")

        # Отправляем сообщение
        try:
            await bot_app.bot.send_message(
                chat_id=processed_chat_id, # Теперь используем корректный ID
                text=payload.text,
                parse_mode=payload.parse_mode
            )
            logger.info(f"✅ Сообщение успешно отправлено в чат {chat_id_str}") # Логируем исходный строковый ID для ясности
            return {"success": True, "message": "Сообщение успешно отправлено"}
        except Exception as e:
            logger.error(f"❌ Ошибка при вызове bot.send_message для чата {chat_id_str}: {e}") # Логируем исходный строковый ID
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

        # Преобразуем формат ID чата
        try:
            processed_chat_id = int(payload.target_chat_id)
            logger.info(f"ID чата для отправки: {processed_chat_id}")
        except ValueError:
            logger.error(f"Не удалось преобразовать target_chat_id '{payload.target_chat_id}' в число")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid target_chat_id format: {payload.target_chat_id}")

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

        # <<< НАЧАЛО ИЗМЕНЕНИЙ: Генерация подписи >>>
        caption = "📊 Табель"
        months_ru = { 
            1: "Январь", 2: "Февраль", 3: "Март", 4: "Апрель", 5: "Май", 6: "Июнь",
            7: "Июль", 8: "Август", 9: "Сентябрь", 10: "Октябрь", 11: "Ноябрь", 12: "Декабрь"
        }
        
        # <<< Функция для форматирования даты в ДД.ММ >>>
        def format_date_short(date_str: Optional[str]) -> Optional[str]:
            if not date_str:
                return None
            try:
                # Преобразуем YYYY-MM-DD в DD.MM
                return datetime.fromisoformat(date_str).strftime("%d.%m")
            except ValueError:
                 logger.warning(f"Не удалось распарсить дату '{date_str}' для подписи.")
                 return None

        # <<< Обновленная логика генерации подписи >>>
        if payload.period_is_weekly:
             start_formatted = format_date_short(payload.period_start_date)
             end_formatted = format_date_short(payload.period_end_date)
             if start_formatted and end_formatted:
                 caption = f"🗓️ Табель за неделю: {start_formatted} - {end_formatted}"
             else:
                 # Fallback, если даты не пришли или не распарсились
                 caption = "🗓️ Табель за текущую неделю для записи"
        elif payload.period_year is not None and payload.period_month is not None:
             month_name = months_ru.get(payload.period_month, f"Месяц {payload.period_month}")
             caption = f"🗓️ Табель за {month_name} {payload.period_year}"
        
        logger.info(f"Сгенерирована подпись для файла: '{caption}'")
        # <<< КОНЕЦ ИЗМЕНЕНИЙ: Генерация подписи >>>

        # Отправка документа
        try:
            # <<< Открываем файл для чтения в бинарном режиме >>>
            with open(resolved_path, "rb") as document_file:
                try:
                    await bot_app.bot.send_document(
                        chat_id=processed_chat_id,
                        document=document_file, 
                        filename=resolved_path.name,
                        caption=caption
                    )
                    logger.info(f"✅ Файл {resolved_path.name} успешно отправлен в чат {payload.target_chat_id} с подписью.")
                except Exception as send_err:
                    logger.warning(f"❌ Ошибка при отправке документа {resolved_path.name} в чат {processed_chat_id} (первая попытка): {send_err}")
                    # <<< ИСПРАВЛЕНИЕ ЛОГИКИ ОБРАБОТКИ ОШИБКИ ОТПРАВКИ >>>
                    # Пробуем альтернативный ID, если это группа и есть ошибка
                    # (Логика остается прежней, но используем новый caption)
                    if str(processed_chat_id).startswith('-100'): 
                        alternative_chat_id = int(str(processed_chat_id).replace('-100', '-'))
                        logger.info(f"Попытка отправить в чат {alternative_chat_id} (альтернативный ID)")
                        document_file.seek(0)  # Сбрасываем указатель файла
                        try:
                            await bot_app.bot.send_document(
                                chat_id=alternative_chat_id,
                                document=document_file,
                                filename=resolved_path.name,
                                caption=caption
                            )
                            logger.info(f"✅ Файл {resolved_path.name} успешно отправлен в чат {alternative_chat_id} с подписью.")
                        except Exception as alt_send_err:
                            logger.error(f"❌ Ошибка при отправке документа {resolved_path.name} в чат {alternative_chat_id}: {alt_send_err}")
                            # Перевыбрасываем ошибку второй попытки
                            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send document (alt ID): {alt_send_err}")
                    else:
                        # Если это не группа или ошибка не связана с ID, перевыбрасываем исходную ошибку
                         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send document: {send_err}")
                        
            return {"success": True, "message": "File sent successfully"}
        except HTTPException as http_exc: # Перехватываем HTTPException, чтобы не попасть в общий Exception
             raise http_exc
        except Exception as send_err: # Ошибки чтения файла или другие непредвиденные
            logger.error(f"❌ Ошибка при обработке файла {resolved_path.name} или отправке в чат {payload.target_chat_id}: {send_err}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process or send document: {send_err}")

    except HTTPException as http_exc:
        # Перевыбрасываем HTTP исключения (например, от валидации)
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /internal/send-file: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {e}")

# --- НОВЫЙ ЭНДПОИНТ /api/refresh_user --- 
@router.post("/refresh_user", tags=["API"], status_code=status.HTTP_200_OK)
async def refresh_user_data(payload: RefreshUserPayload, request: Request):
    """
    Получает актуальные данные пользователя из Telegram и возвращает их.
    Этот эндпоинт вызывается API сервером для обновления данных пользователя в БД.
    """
    logger.info(f"📬 Получен запрос на /api/refresh_user для пользователя ID {payload.user_id}")
    
    try:
        # Получаем экземпляр бота
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state при запросе refresh_user")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                               detail="Bot instance not available")

        # Получаем данные пользователя из Telegram
        try:
            # Пытаемся получить информацию о пользователе через getChatMember
            # Это работает, даже если пользователь не общался с ботом недавно
            # Но требует, чтобы пользователь был членом чата с ботом
            user_id = payload.user_id
            logger.info(f"Получение данных пользователя {user_id} из Telegram")
            
            # Попробуем получить информацию пользователя через getChat
            try:
                chat = await bot_app.bot.get_chat(user_id)
                user_data = {
                    "user_id": chat.id,
                    "first_name": chat.first_name or "",
                    "last_name": chat.last_name or "",
                    "username": chat.username or "",
                    "photo_url": ""  # Получим фото отдельно
                }
                
                # Попытаемся получить фото профиля
                try:
                    photos = await bot_app.bot.get_user_profile_photos(user_id, limit=1)
                    if photos and photos.photos and len(photos.photos) > 0:
                        photo = photos.photos[0][-1]  # Берём лучшее качество из первого фото
                        photo_file = await bot_app.bot.get_file(photo.file_id)
                        user_data["photo_url"] = photo_file.file_path
                except Exception as photo_err:
                    logger.warning(f"⚠️ Не удалось получить фото пользователя {user_id}: {photo_err}")
                    # Игнорируем эту ошибку, просто оставляем photo_url пустым
                
                logger.info(f"✅ Данные пользователя {user_id} успешно получены")
                return user_data
                
            except Exception as chat_err:
                logger.warning(f"⚠️ Не удалось получить данные через getChat: {chat_err}")
                # Попробуем другой подход - через getChatMember, но для этого
                # нужно знать ID чата, где пользователь состоит вместе с ботом
                
                # Здесь можно добавить код для получения данных через getChatMember,
                # если у вас есть доступ к чатам, где состоит пользователь
                
                # Если все методы не сработали:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User information cannot be retrieved from Telegram: {chat_err}"
                )
                
        except HTTPException as http_exc:
            raise http_exc
        except Exception as e:
            logger.error(f"❌ Ошибка при получении данных пользователя {payload.user_id}: {e}", 
                         exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error retrieving user data from Telegram: {e}"
            )
            
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /api/refresh_user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {e}"
        ) 