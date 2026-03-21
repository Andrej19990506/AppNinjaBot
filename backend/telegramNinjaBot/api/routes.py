import logging
import json
import os
import asyncio
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from telegram.error import BadRequest
import random

# Импортируем типы Telegram и Application
from telegram import Update, InputFile
from telegram.ext import Application
from telegram.constants import ParseMode
from telegram.ext import ContextTypes, CallbackQueryHandler

# Импортируем httpx и get_async_http_client
import httpx

# Импортируем модель Pydantic
from .models import SendMessagePayload, SendFilePayload, RefreshUserPayload, SendExcelReportPayload, SendWriteOffReportPayload, SendItemRequestPayload

# Импортируем конфигурацию (для пути вебхука и секрета)
from telegramNinjaBot.config.config import Config

# Инициализируем логгер для этого модуля
logger = logging.getLogger(__name__)

# Определяем базовую директорию для файлов табеля (для безопасности)
ALLOWED_FILE_DIR = Path("/app/shared/timesheets")

# ---> ДОБАВЛЕНИЕ: Директория для отчетов инвентаризации < ---
ALLOWED_REPORTS_DIR = Path(os.getenv("SHARED_REPORTS_FOLDER", "/app/shared/inventory_reports"))
# ---> КОНЕЦ ДОБАВЛЕНИЯ < ---

# ---> ДОБАВЛЕНИЕ: Директория для write-off отчетов < ---
ALLOWED_WRITEOFF_REPORTS_DIR = Path(os.getenv("SHARED_WRITEOFF_REPORTS_FOLDER", "/app/shared/write_off_reports"))
# ---> КОНЕЦ ДОБАВЛЕНИЯ < ---

# ---> ДОБАВЛЕНИЕ: Директория для видео конкурсов < ---
ALLOWED_VIDEOS_DIR = Path("/app/shared/competition_videos")
# ---> КОНЕЦ ДОБАВЛЕНИЯ < ---


# Создаем APIRouter
router = APIRouter()

# --- Вспомогательная функция для поиска правильного бота компании ---
async def find_company_bot_for_chat(chat_id: int, request: Request) -> Optional[Application]:
    """
    Находит правильный бот компании для указанного chat_id.
    Возвращает Application или None, если не найден.
    """
    from telegramNinjaBot.config.config import Config
    config = Config()
    
    if config.BOT_TYPE != 'companies':
        return None
    
    bot_applications = getattr(request.app.state, 'bot_applications', None)
    if not bot_applications:
        return None
    
    db_pool = getattr(request.app.state, 'db_pool', None)
    if not db_pool:
        return None
    
    try:
        # Сначала пробуем найти через group_role_mappings
        query = """
            SELECT cb.id, cb.bot_token, cb.company_name 
            FROM company_bots cb
            JOIN company_roles cr ON cb.id = cr.company_bot_id
            JOIN group_role_mappings grm ON cr.id = grm.company_role_id
            WHERE grm.group_id = $1 
                AND cb.is_active = true 
                AND cr.is_active = true
            LIMIT 1
        """
        bot_row = await db_pool.fetchrow(query, chat_id)
        
        if not bot_row:
            # Если не найден через group_role_mappings, пробуем напрямую по group_id
            query = """
                SELECT id, bot_token, company_name 
                FROM company_bots 
                WHERE group_id = $1 AND is_active = true
                LIMIT 1
            """
            bot_row = await db_pool.fetchrow(query, chat_id)
        
        if bot_row:
            company_bot_id = bot_row['id']
            logger.info(f"🔍 Найден бот компании для группы {chat_id}: {bot_row['company_name']} (ID: {company_bot_id})")
            
            # Ищем соответствующий bot_app по company_bot_id
            for app_instance in bot_applications:
                app_bot_id = app_instance.bot_data.get('company_bot_id')
                if app_bot_id == company_bot_id:
                    logger.info(f"✅ Найден bot_app для бота компании {bot_row['company_name']}")
                    return app_instance
            
            logger.warning(f"⚠️ Bot_app не найден для company_bot_id={company_bot_id}, хотя бот найден в БД")
        else:
            logger.warning(f"⚠️ Бот компании не найден для группы {chat_id} в БД")
    except Exception as e:
        logger.error(f"❌ Ошибка при поиске бота компании для группы {chat_id}: {e}", exc_info=True)
    
    return None

# --- Эндпоинт /api/send_message --- 
@router.post("/send_message", tags=["API"])
async def send_message_api_v2(payload: SendMessagePayload, request: Request):
    """Прямой маршрут для отправки сообщений через Telegram бота (FastAPI)"""
    logger.info("📬 Получен FastAPI запрос на /api/send_message")
    logger.info(f"Данные payload: {payload.model_dump()}")
    
    try:
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

        # Определяем, какой бот использовать для этой группы
        bot_app: Application = None
        
        # Если режим companies, пытаемся найти правильный бот для группы
        from telegramNinjaBot.config.config import Config
        config = Config()
        if config.BOT_TYPE == 'companies':
            # Получаем все боты компаний
            bot_applications = getattr(request.app.state, 'bot_applications', None)
            if bot_applications:
                # Пытаемся найти бот компании для этой группы через БД
                db_pool = getattr(request.app.state, 'db_pool', None)
                if db_pool:
                    try:
                        # Сначала пробуем найти через group_role_mappings (как в API сервере)
                        logger.info(f"🔍 Поиск бота компании для группы {chat_id_str} через group_role_mappings...")
                        query = """
                            SELECT cb.id, cb.bot_token, cb.company_name 
                            FROM company_bots cb
                            JOIN company_roles cr ON cb.id = cr.company_bot_id
                            JOIN group_role_mappings grm ON cr.id = grm.company_role_id
                            WHERE grm.group_id = $1 
                                AND cb.is_active = true 
                                AND cr.is_active = true
                            LIMIT 1
                        """
                        bot_row = await db_pool.fetchrow(query, processed_chat_id)
                        
                        if bot_row:
                            logger.info(f"✅ Найден бот через group_role_mappings: {bot_row['company_name']} (ID: {bot_row['id']})")
                        else:
                            logger.info(f"⚠️ Бот не найден через group_role_mappings, пробуем напрямую по group_id...")
                            # Если не найден через group_role_mappings, пробуем напрямую через group_id в CompanyBot
                            query = """
                                SELECT id, bot_token, company_name 
                                FROM company_bots 
                                WHERE group_id = $1 AND is_active = true
                                LIMIT 1
                            """
                            bot_row = await db_pool.fetchrow(query, processed_chat_id)
                            
                            if bot_row:
                                logger.info(f"✅ Найден бот напрямую по group_id: {bot_row['company_name']} (ID: {bot_row['id']})")
                        
                        if bot_row:
                            company_bot_id = bot_row['id']
                            logger.info(f"🔍 Найден бот компании для группы {chat_id_str}: {bot_row['company_name']} (ID: {company_bot_id})")
                            
                            # Ищем соответствующий bot_app по company_bot_id
                            found_app = False
                            for app_instance in bot_applications:
                                app_bot_id = app_instance.bot_data.get('company_bot_id')
                                logger.debug(f"Проверяем bot_app: company_bot_id={app_bot_id}, ищем {company_bot_id}")
                                if app_bot_id == company_bot_id:
                                    bot_app = app_instance
                                    logger.info(f"✅ Найден bot_app для бота компании {bot_row['company_name']}")
                                    found_app = True
                                    break
                            
                            if not found_app:
                                logger.warning(f"⚠️ Bot_app не найден для company_bot_id={company_bot_id}, хотя бот найден в БД")
                        else:
                            logger.warning(f"⚠️ Бот компании не найден для группы {chat_id_str} в БД (ни через group_role_mappings, ни напрямую)")
                    except Exception as e:
                        logger.error(f"❌ Ошибка при поиске бота компании для группы {chat_id_str}: {e}", exc_info=True)
            
            # Если не нашли конкретный бот, используем первый доступный
            if not bot_app and bot_applications:
                bot_app = bot_applications[0]
                logger.warning(f"⚠️ Используем первый доступный бот для группы {chat_id_str} (бот компании не найден)")
        else:
            # Для других режимов используем основной бот
            bot_app = request.app.state.bot_application
        
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state")
            raise HTTPException(status_code=503, detail="Bot instance not available")

        # Отправляем сообщение
        try:
            await bot_app.bot.send_message(
                chat_id=processed_chat_id,
                text=payload.text,
                parse_mode=payload.parse_mode,
                reply_markup=payload.reply_markup if payload.reply_markup else None
            )
            logger.info(f"✅ Сообщение успешно отправлено в чат {chat_id_str}")
            return {"success": True, "message": "Сообщение успешно отправлено"}
        
        except BadRequest as e:
            error_message = str(e)
            logger.warning(f"⚠️ Ошибка BadRequest при первой попытке отправки сообщения в чат {chat_id_str} ({processed_chat_id}): {error_message}")

            if "chat not found" in error_message.lower() and chat_id_str.startswith("-100"):
                try:
                    alternative_chat_id_str = f"-{chat_id_str[4:]}"
                    alternative_chat_id = int(alternative_chat_id_str)
                    logger.info(f"Попытка отправить сообщение в чат {alternative_chat_id_str} (альтернативный ID)")
                    
                    await bot_app.bot.send_message(
                        chat_id=alternative_chat_id,
                        text=payload.text,
                        parse_mode=payload.parse_mode,
                        reply_markup=payload.reply_markup if payload.reply_markup else None
                    )
                    logger.info(f"✅ Сообщение успешно отправлено в альтернативный чат {alternative_chat_id_str}")
                    return {"success": True, "message": "Сообщение успешно отправлено в альтернативный чат"}
                except Exception as alt_e:
                    logger.error(f"❌ Ошибка при отправке в альтернативный чат {alternative_chat_id_str}: {alt_e}")
                    raise HTTPException(status_code=500, detail=f"Failed to send message to alternative chat: {alt_e}")
            else:
                raise HTTPException(status_code=400, detail=f"Failed to send message: {error_message}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Неожиданная ошибка при отправке сообщения: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")

# --- Эндпоинт /internal/send-message --- 
@router.post("/internal/send-message", tags=["Internal"], status_code=status.HTTP_200_OK)
async def send_message_internal(payload: SendMessagePayload, request: Request):
    """Внутренний эндпоинт для отправки сообщений через Telegram бота"""
    logger.info("📬 Получен внутренний запрос на /internal/send-message")
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
            processed_chat_id = int(chat_id_str)
            logger.info(f"ID чата {chat_id_str} обработан как {processed_chat_id}")
        except ValueError:
             logger.error(f"Не удалось преобразовать chat_id '{chat_id_str}' в число")
             raise HTTPException(status_code=400, detail=f"Invalid chat_id format: {chat_id_str}")

        # Отправляем сообщение
        try:
            await bot_app.bot.send_message(
                chat_id=processed_chat_id,
                text=payload.text,
                parse_mode=payload.parse_mode,
                reply_markup=payload.reply_markup if payload.reply_markup else None
            )
            logger.info(f"✅ Сообщение успешно отправлено в чат {chat_id_str}")
            return {"success": True, "message": "Сообщение успешно отправлено"}
        
        except BadRequest as e:
            error_message = str(e)
            logger.warning(f"⚠️ Ошибка BadRequest при первой попытке отправки сообщения в чат {chat_id_str} ({processed_chat_id}): {error_message}")

            if "chat not found" in error_message.lower() and chat_id_str.startswith("-100"):
                try:
                    alternative_chat_id_str = f"-{chat_id_str[4:]}"
                    alternative_chat_id = int(alternative_chat_id_str)
                    logger.info(f"Попытка отправить сообщение в чат {alternative_chat_id_str} (альтернативный ID)")
                    
                    await bot_app.bot.send_message(
                        chat_id=alternative_chat_id,
                        text=payload.text,
                        parse_mode=payload.parse_mode,
                        reply_markup=payload.reply_markup if payload.reply_markup else None
                    )
                    logger.info(f"✅ Сообщение успешно отправлено в чат {alternative_chat_id_str} при второй попытке.")
                    return {"success": True, "message": "Сообщение успешно отправлено (со второй попытки)"}
                
                except Exception as retry_exc:
                    logger.error(f"❌ Ошибка Telegram при ВТОРОЙ попытке отправки сообщения в чат {alternative_chat_id_str}: {retry_exc}")
                    raise HTTPException(status_code=500, detail=f"Failed to send message after retry: {retry_exc}")
            else:
                logger.error(f"❌ Ошибка BadRequest (не chat not found или ID без -100) при отправке сообщения в чат {chat_id_str}: {error_message}")
                raise HTTPException(status_code=500, detail=f"Failed to send message: {error_message}")
        
        except Exception as e:
            logger.error(f"❌ Непредвиденная ошибка при вызове bot.send_message для чата {chat_id_str}: {e}", exc_info=True)
            error_detail = str(e)
            if hasattr(e, 'message'): error_detail = e.message
            raise HTTPException(status_code=500, detail=f"Failed to send message: {error_detail}")
            
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


# --- УНИВЕРСАЛЬНЫЙ ЭНДПОИНТ ДЛЯ ВЕБХУКОВ --- 
# Поддерживает динамические пути: /api/telegram/webhook/{bot_identifier}
# где bot_identifier = "main" для основного бота или {bot_id} для ботов компаний

# Используем значения из Config для обратной совместимости
c = Config()
WEBHOOK_SECRET = c.WEBHOOK_SECRET

# Универсальный endpoint для всех webhook путей
@router.post("/api/telegram/webhook/{bot_identifier}", include_in_schema=False)
async def telegram_webhook_universal(bot_identifier: str, update_data: dict, request: Request):
    """Универсальный endpoint для обработки webhook от Telegram.
    
    Поддерживает пути:
    - /api/telegram/webhook/main - основной бот
    - /api/telegram/webhook/{bot_id} - боты компаний (где bot_id - ID из таблицы company_bots)
    """
    
    logger.info(f"📥 Получено обновление через вебхук для бота: {bot_identifier}")
    logger.debug(f"Обновление: {json.dumps(update_data, ensure_ascii=False, default=str)[:500]}")

    # Optional Go-gateway auth: when token is configured, reject direct unsigned traffic.
    # .strip() как в lifespan.py: в .env на сервере часто бывает \r\n — без strip вебхук 401 при верном токене.
    forward_auth_token = (os.getenv("FORWARD_AUTH_TOKEN") or "").strip()
    if forward_auth_token:
        auth_header = (request.headers.get("Authorization") or "").strip()
        expected = f"Bearer {forward_auth_token}"
        if auth_header != expected:
            logger.warning("Неверный Authorization токен для webhook proxy запроса")
            raise HTTPException(status_code=401, detail="Invalid proxy authorization token")
    
    # Проверка секретного токена (если используется)
    if WEBHOOK_SECRET:
        secret_token_header = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
        if secret_token_header != WEBHOOK_SECRET:
            logger.warning(f"Неверный секретный токен вебхука: {secret_token_header}")
            raise HTTPException(status_code=403, detail="Invalid secret token")
        else:
            logger.debug("✅ Секретный токен вебхука проверен успешно")
    
    try:
        from telegramNinjaBot.config.config import Config
        config = Config()
        
        # Определяем, какой бот использовать по bot_identifier
        bot_app: Application = None
        
        if bot_identifier == "main":
            # Основной бот
            bot_app = getattr(request.app.state, 'bot_application', None)
            if not bot_app:
                logger.error("Экземпляр bot_application не найден в app.state для основного бота")
                raise HTTPException(status_code=503, detail="Main bot application not available")
            logger.info("✅ Используется основной бот (main)")
            
        elif bot_identifier.isdigit():
            # Бот компании по ID из пути webhook
            bot_id = int(bot_identifier)
            logger.info(f"🔍 Поиск бота компании по ID: {bot_id}")
            
            # Ищем бота в bot_applications по company_bot_id
            bot_applications = getattr(request.app.state, 'bot_applications', None)
            if bot_applications:
                for app_instance in bot_applications:
                    app_bot_id = app_instance.bot_data.get('company_bot_id')
                    if app_bot_id == bot_id:
                        bot_app = app_instance
                        bot_name = app_instance.bot_data.get('company_name', f'Bot {bot_id}')
                        logger.info(f"✅ Найден bot_app для бота компании: {bot_name} (ID: {bot_id})")
                        break
                
                if not bot_app:
                    logger.error(f"❌ Бот компании с ID {bot_id} не найден в bot_applications")
                    raise HTTPException(status_code=404, detail=f"Company bot with ID {bot_id} not found")
            else:
                # Проверяем, может быть это режим company (один бот)
                if config.BOT_TYPE == 'company':
                    bot_app = getattr(request.app.state, 'bot_application', None)
                    app_bot_id = bot_app.bot_data.get('company_bot_id') if bot_app else None
                    if app_bot_id == bot_id:
                        logger.info(f"✅ Найден bot_app для бота компании (single bot mode, ID: {bot_id})")
                    else:
                        logger.error(f"❌ Бот компании с ID {bot_id} не соответствует текущему боту")
                        raise HTTPException(status_code=404, detail=f"Company bot with ID {bot_id} not found")
                else:
                    logger.error("bot_applications не найдены в app.state")
                    raise HTTPException(status_code=503, detail="Bot applications not available")
        else:
            # Неизвестный bot_identifier
            logger.error(f"❌ Неизвестный bot_identifier: {bot_identifier}")
            raise HTTPException(status_code=404, detail=f"Invalid bot identifier: {bot_identifier}")
        
        if not bot_app:
            logger.error("Экземпляр bot_application не найден в app.state")
            raise HTTPException(status_code=503, detail="Bot application not available")
        
        # Создаем временный бот для десериализации Update (нужен для определения типа обновления)
        temp_bot = bot_app.bot if hasattr(bot_app, 'bot') else None
        if not temp_bot:
            # Fallback: пытаемся получить из bot_applications, если доступны
            bot_applications = getattr(request.app.state, 'bot_applications', None)
            if bot_applications:
                temp_bot = bot_applications[0].bot
        
        update = Update.de_json(update_data, temp_bot)
        # Определяем тип обновления вручную
        update_type = None
        if update.message:
            if update.message.new_chat_members:
                update_type = "new_chat_members"
            elif update.message.left_chat_member:
                update_type = "left_chat_member"
            else:
                update_type = "message"
        elif update.chat_member:
            update_type = "chat_member"
        elif update.my_chat_member:
            update_type = "my_chat_member"
        elif update.callback_query:
            update_type = "callback_query"
        else:
            update_type = "unknown"
        logger.info(f"📥 Получено обновление через вебхук: update_id={update.update_id}, type={update_type}")
        
        # Логируем детали обновления для отладки
        if update.message and update.message.new_chat_members:
            logger.info(f"👥 Обновление содержит новых участников: {[m.id for m in update.message.new_chat_members]}")
        if update.chat_member:
            logger.info(f"👤 Обновление chat_member: user_id={update.chat_member.from_user.id}, status={update.chat_member.new_chat_member.status}")
        
        await bot_app.update_queue.put(update)
        logger.info(f"✅ Обновление {update.update_id} добавлено в очередь бота ({bot_identifier})")
        
        return {"ok": True}
        
    except json.JSONDecodeError:
        logger.error("Ошибка декодирования JSON в вебхуке")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except HTTPException:
        # Пробрасываем HTTP исключения как есть
        raise
    except Exception as e:
        logger.error(f"Ошибка при обработке вебхука: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error handling webhook")


# --- СТАРЫЙ ЭНДПОИНТ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ---
# Оставляем для совместимости со старыми webhook путями
c = Config()
WEBHOOK_TELEGRAM_PATH = c.WEBHOOK_PATH if c.WEBHOOK_PATH else None
if WEBHOOK_TELEGRAM_PATH and WEBHOOK_TELEGRAM_PATH != "/api/telegram/webhook/{bot_identifier}":
    logger.info(f"Регистрация старого эндпоинта вебхука для обратной совместимости: {WEBHOOK_TELEGRAM_PATH}")
    @router.post(WEBHOOK_TELEGRAM_PATH, include_in_schema=False)
    async def telegram_webhook_endpoint_legacy(update_data: dict, request: Request):
        """Старый endpoint для обратной совместимости. Перенаправляет на универсальный endpoint."""
        logger.warning(f"⚠️ Используется старый webhook path: {WEBHOOK_TELEGRAM_PATH}. Рекомендуется перейти на новый формат.")
        # Определяем bot_identifier из конфига или по умолчанию "main"
        from telegramNinjaBot.config.config import Config
        config = Config()
        if config.BOT_TYPE == 'main':
            bot_identifier = "main"
        elif config.BOT_TYPE in ('company', 'companies'):
            # Для ботов компаний пытаемся определить ID
            bot_app = getattr(request.app.state, 'bot_application', None)
            if bot_app:
                bot_id = bot_app.bot_data.get('company_bot_id')
                if bot_id:
                    bot_identifier = str(bot_id)
                else:
                    bot_identifier = "main"  # Fallback
            else:
                bot_identifier = "main"
        else:
            bot_identifier = "main"
        
        # Перенаправляем на универсальный endpoint
        return await telegram_webhook_universal(bot_identifier, update_data, request)


# --- НОВЫЙ ЭНДПОИНТ /internal/send-file --- 
@router.post("/internal/send-file", tags=["Internal"], status_code=status.HTTP_200_OK)
async def send_file_internal(payload: SendFilePayload, request: Request):
    """Принимает запрос от API Server и отправляет указанный файл пользователю или в группу."""
    logger.info(f"📬 Получен внутренний запрос на /internal/send-file для чата ID {payload.target_chat_id}")
    logger.debug(f"Payload: {payload.model_dump()}")

    try:
        # Преобразуем формат ID чата
        try:
            processed_chat_id = int(payload.target_chat_id)
            logger.info(f"ID чата для отправки: {processed_chat_id}")
        except ValueError:
            logger.error(f"Не удалось преобразовать target_chat_id '{payload.target_chat_id}' в число")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid target_chat_id format: {payload.target_chat_id}")

        # Определяем, какой бот использовать для этой группы
        bot_app: Application = None
        
        # Пытаемся найти бот компании для этой группы
        company_bot = await find_company_bot_for_chat(processed_chat_id, request)
        if company_bot:
            bot_app = company_bot
        else:
            # Если режим companies, но бот не найден, используем первый доступный
            from telegramNinjaBot.config.config import Config
            config = Config()
            if config.BOT_TYPE == 'companies':
                bot_applications = getattr(request.app.state, 'bot_applications', None)
                if bot_applications:
                    bot_app = bot_applications[0]
                    logger.warning(f"⚠️ Используем первый доступный бот для группы {payload.target_chat_id} (бот компании не найден)")
                else:
                    logger.error("❌ bot_applications не найдены в app.state")
            else:
                # Для других режимов используем основной бот
                bot_app = request.app.state.bot_application
        
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
             
             # Проверяем все разрешенные директории
             allowed_dirs = [
                 ALLOWED_FILE_DIR.resolve(strict=True),
                 ALLOWED_REPORTS_DIR.resolve(strict=True),
                 ALLOWED_WRITEOFF_REPORTS_DIR.resolve(strict=True),
                 ALLOWED_VIDEOS_DIR.resolve(strict=True)
             ]
             
             is_allowed = False
             for allowed_dir in allowed_dirs:
                 try:
                     if resolved_path.is_relative_to(allowed_dir):
                         is_allowed = True
                         logger.info(f"✅ Файл {resolved_path} разрешен в директории {allowed_dir}")
                         break
                 except ValueError:
                     continue
             
             if not is_allowed:
                 logger.error(f"❌ Попытка доступа к файлу вне разрешенных директорий: {resolved_path}")
                 raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to the specified file path.")
        except Exception as path_resolve_err:
             logger.error(f"❌ Ошибка при проверке пути файла {requested_path}: {path_resolve_err}", exc_info=True)
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error validating file path.")

        logger.info(f"Путь {resolved_path} прошел валидацию. Попытка отправки документа.")

        # <<< НАЧАЛО ИЗМЕНЕНИЙ: Генерация подписи >>>
        caption = payload.caption if hasattr(payload, 'caption') and payload.caption else "📊 Табель"
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

        # Отправка файла
        try:
            # <<< Открываем файл для чтения в бинарном режиме >>>
            with open(resolved_path, "rb") as file:
                # Определяем тип файла по расширению
                file_extension = resolved_path.suffix.lower()
                is_video = file_extension in ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv']
                
                try:
                    # Проверяем размер файла
                    file_size = os.path.getsize(resolved_path)
                    file_size_mb = file_size / (1024 * 1024)
                    logger.info(f"📊 Размер файла {resolved_path.name}: {file_size_mb:.2f} МБ")
                    
                    if is_video:
                        if file_size_mb <= 50:  # Telegram лимит для видео
                            # Для видео файлов используем send_video
                            await bot_app.bot.send_video(
                                chat_id=processed_chat_id,
                                video=file,
                                caption=caption,
                                supports_streaming=True
                            )
                            logger.info(f"✅ Видео файл {resolved_path.name} успешно отправлен в чат {payload.target_chat_id} с подписью.")
                        else:
                            # Если видео слишком большое, отправляем как документ
                            logger.warning(f"⚠️ Видео {resolved_path.name} слишком большое ({file_size_mb:.2f} МБ), отправляем как документ")
                            await bot_app.bot.send_document(
                                chat_id=processed_chat_id,
                                document=file, 
                                filename=resolved_path.name,
                                caption=caption
                            )
                            logger.info(f"✅ Видео {resolved_path.name} отправлено как документ в чат {payload.target_chat_id}.")
                    else:
                        # Для остальных файлов используем send_document
                        await bot_app.bot.send_document(
                            chat_id=processed_chat_id,
                            document=file, 
                            filename=resolved_path.name,
                            caption=caption
                        )
                        logger.info(f"✅ Файл {resolved_path.name} успешно отправлен в чат {payload.target_chat_id} с подписью.")
                except Exception as send_err:
                    logger.warning(f"❌ Ошибка при отправке файла {resolved_path.name} в чат {processed_chat_id} (первая попытка): {send_err}")

                    if str(processed_chat_id).startswith('-100'): 
                        alternative_chat_id = int(str(processed_chat_id).replace('-100', '-'))
                        logger.info(f"Попытка отправить в чат {alternative_chat_id} (альтернативный ID)")
                        file.seek(0)  # Сбрасываем указатель файла
                        try:
                            if is_video:
                                if file_size_mb <= 50:  # Telegram лимит для видео
                                    await bot_app.bot.send_video(
                                        chat_id=alternative_chat_id,
                                        video=file,
                                        caption=caption,
                                        supports_streaming=True
                                    )
                                else:
                                    # Если видео слишком большое, отправляем как документ
                                    await bot_app.bot.send_document(
                                        chat_id=alternative_chat_id,
                                        document=file,
                                        filename=resolved_path.name,
                                        caption=caption
                                    )
                            else:
                                await bot_app.bot.send_document(
                                    chat_id=alternative_chat_id,
                                    document=file,
                                    filename=resolved_path.name,
                                    caption=caption
                                )
                            logger.info(f"✅ Файл {resolved_path.name} успешно отправлен в чат {alternative_chat_id} с подписью.")
                        except Exception as alt_send_err:
                            logger.error(f"❌ Ошибка при отправке файла {resolved_path.name} в чат {alternative_chat_id}: {alt_send_err}")
                            # Перевыбрасываем ошибку второй попытки
                            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send file (alt ID): {alt_send_err}")
                    else:
                        # Если это не группа или ошибка не связана с ID, перевыбрасываем исходную ошибку
                         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send file: {send_err}")
                        
            return {"success": True, "message": "File sent successfully"}
        except HTTPException as http_exc: # Перехватываем HTTPException, чтобы не попасть в общий Exception
             raise http_exc
        except Exception as send_err: # Ошибки чтения файла или другие непредвиденные
            logger.error(f"❌ Ошибка при обработке файла {resolved_path.name} или отправке в чат {payload.target_chat_id}: {send_err}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process or send file: {send_err}")

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
    Обновляет данные пользователя из Telegram и сохраняет фото на сервер.
    """
    logger.info(f"📬 Получен запрос на обновление данных пользователя: {payload.user_id}")

    # Получаем экземпляр бота
    bot_app: Application = request.app.state.bot_application
    if not bot_app or not bot_app.bot:
        logger.error("❌ Экземпляр бота не доступен в app.state")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Bot instance not available")

    # Получаем данные пользователя из Telegram
    try:
        user_id = payload.user_id
        logger.info(f"Получение данных пользователя {user_id} из Telegram")
        
        try:
            chat = await bot_app.bot.get_chat(user_id)
            user_data = {
                "user_id": chat.id,
                "first_name": chat.first_name or "",
                "last_name": chat.last_name or "",
                "username": chat.username or "",
                "photo_url": "" 
            }
            
            # Попытаемся получить и сохранить фото профиля
            try:
                photos = await bot_app.bot.get_user_profile_photos(user_id, limit=1)
                if photos and photos.photos and len(photos.photos) > 0:
                    photo = photos.photos[0][-1]
                    photo_file = await bot_app.bot.get_file(photo.file_id)
                    
                    # Создаем папку для фото пользователей
                    photos_dir = Path("/app/shared/users-photo")
                    photos_dir.mkdir(exist_ok=True)
                    
                    # Путь к файлу фото пользователя
                    photo_filename = f"user_{user_id}.jpg"
                    photo_path = photos_dir / photo_filename
                    
                    # Скачиваем фото на сервер
                    await photo_file.download_to_drive(custom_path=photo_path)
                    
                    # Сохраняем относительный путь
                    user_data["photo_url"] = f"/users-photo/{photo_filename}"
                    logger.info(f"Фото пользователя {user_id} сохранено на сервер")
                    
            except Exception as photo_err:
                logger.warning(f"⚠️ Не удалось получить/сохранить фото пользователя {user_id}: {photo_err}")
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

# --- НОВЫЙ ЭНДПОИНТ /internal/send_excel_report --- 
@router.post("/internal/send_excel_report", tags=["Internal"], status_code=status.HTTP_200_OK)
async def send_excel_report_internal(payload: SendExcelReportPayload, request: Request):
    """Принимает запрос от API Server и отправляет сгенерированный Excel отчет в группу."""
    logger.info(f"📬 Получен внутренний запрос на /internal/send_excel_report для чата ID {payload.chat_id}")
    logger.debug(f"Payload: {payload.model_dump()}")
    resolved_path: Optional[Path] = None # Инициализируем перед try

    try:
        # Преобразуем формат ID чата (ожидаем ID группы, он должен быть отрицательным)
        try:
            # Убедимся, что chat_id начинается с "-", как и должно быть для групп
            if not payload.chat_id.startswith('-'):
                # Если API прислал ID без минуса, пытаемся его добавить (хотя API должен слать правильный)
                logger.warning(f"Получен chat_id '{payload.chat_id}' без минуса для группы. Пытаюсь добавить...")
                processed_chat_id = int(f"-{payload.chat_id}")
            else:
                processed_chat_id = int(payload.chat_id)
            logger.info(f"ID чата для отправки отчета: {processed_chat_id}")
        except ValueError:
            logger.error(f"Не удалось преобразовать chat_id '{payload.chat_id}' в число")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid chat_id format: {payload.chat_id}")

        # Определяем, какой бот использовать для этой группы
        bot_app: Application = None
        
        # Пытаемся найти бот компании для этой группы
        company_bot = await find_company_bot_for_chat(processed_chat_id, request)
        if company_bot:
            bot_app = company_bot
        else:
            # Если режим companies, но бот не найден, используем первый доступный
            from telegramNinjaBot.config.config import Config
            config = Config()
            if config.BOT_TYPE == 'companies':
                bot_applications = getattr(request.app.state, 'bot_applications', None)
                if bot_applications:
                    bot_app = bot_applications[0]
                    logger.warning(f"⚠️ Используем первый доступный бот для группы {payload.chat_id} (бот компании не найден)")
                else:
                    logger.error("❌ bot_applications не найдены в app.state")
            else:
                # Для других режимов используем основной бот
                bot_app = request.app.state.bot_application
        
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state при запросе send_excel_report")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Bot instance not available")

        # Валидация пути к файлу
        requested_path = Path(payload.file_path)
        logger.info(f"Проверка пути Excel файла: {requested_path}")
        
        # Создаем директорию, если она не существует (для синхронизации с API сервером)
        parent_dir = ALLOWED_REPORTS_DIR.parent
        logger.info(f"🔍 [Excel Report] Проверяем родительскую директорию: {parent_dir}")
        logger.info(f"🔍 [Excel Report] Родительская директория существует: {parent_dir.exists()}")
        
        ALLOWED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        logger.info(f"🔍 [Excel Report] ALLOWED_REPORTS_DIR: {ALLOWED_REPORTS_DIR}")
        logger.info(f"🔍 [Excel Report] ALLOWED_REPORTS_DIR exists: {ALLOWED_REPORTS_DIR.exists()}")
        
        # Дополнительное логирование для диагностики
        if ALLOWED_REPORTS_DIR.exists():
            try:
                files_in_dir = list(ALLOWED_REPORTS_DIR.iterdir())
                logger.info(f"🔍 [Excel Report] Files in directory ({len(files_in_dir)}): {[f.name for f in files_in_dir]}")
            except Exception as list_err:
                logger.warning(f"⚠️ [Excel Report] Не удалось прочитать содержимое директории: {list_err}")

        # 1. Проверка на абсолютный путь
        if not requested_path.is_absolute():
             logger.error(f"❌ Указан относительный путь для Excel: {requested_path}")
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Excel file path: Must be absolute.")

        # 2. Проверка существования файла с retry (для синхронизации Docker volume)
        max_retries = 10
        retry_delay = 0.5
        file_found = False
        
        for attempt in range(max_retries):
            if requested_path.exists() and requested_path.is_file():
                logger.info(f"✅ [Excel Report] Файл найден на попытке {attempt + 1}: {requested_path}")
                file_found = True
                break
            else:
                if attempt < max_retries - 1:
                    logger.info(f"⏳ [Excel Report] Файл не найден, ожидание... (попытка {attempt + 1}/{max_retries})")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.error(f"❌ [Excel Report] Файл не найден после {max_retries} попыток: {requested_path}")
                    logger.error(f"❌ [Excel Report] Путь существует: {requested_path.exists()}, это файл: {requested_path.is_file() if requested_path.exists() else 'N/A'}")
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Excel file not found at path: {requested_path.name}")

        # 3. Проверка нахождения файла в разрешенной директории отчетов
        try:
             resolved_path = requested_path.resolve(strict=True)
             allowed_dir_resolved = ALLOWED_REPORTS_DIR.resolve(strict=True)
             if not resolved_path.is_relative_to(allowed_dir_resolved):
                 logger.error(f"❌ Попытка доступа к Excel файлу вне разрешенной директории: {resolved_path}")
                 raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to the specified Excel file path.")
        except Exception as path_resolve_err:
             logger.error(f"❌ Ошибка при проверке пути Excel файла {requested_path}: {path_resolve_err}", exc_info=True)
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error validating Excel file path.")

        logger.info(f"Путь Excel {resolved_path} прошел валидацию. Попытка отправки документа.")

        # Формируем подпись для документа
        report_date = datetime.now().strftime("%d.%m.%Y")
        caption = f"📊 Отчет по инвентаризации от {report_date}"
        logger.info(f"Сгенерирован подпись для Excel: '{caption}'")

        # Отправка документа
        try:
            with open(resolved_path, "rb") as document_file:
                await bot_app.bot.send_document(
                    chat_id=processed_chat_id,
                    document=InputFile(document_file, filename=resolved_path.name), # Оборачиваем в InputFile
                    caption=caption
                )
                logger.info(f"✅ Excel файл {resolved_path.name} успешно отправлен в чат {payload.chat_id}.")
            
            # --- Удаление файла после успешной отправки --- 
            try:
                os.remove(resolved_path)
                logger.info(f"✅ Временный Excel файл {resolved_path} удален после отправки.")
            except Exception as remove_err:
                logger.error(f"⚠️ Не удалось удалить временный Excel файл {resolved_path} после отправки: {remove_err}")
                # Не прерываем выполнение, просто логируем
            # --- Конец удаления файла --- 

            return {"success": True, "message": "Excel report sent successfully"}

        except BadRequest as tg_err:
            logger.error(f"❌ Ошибка BadRequest при отправке Excel {resolved_path.name} в чат {payload.chat_id}: {tg_err}")
            # Попытка отправить с альтернативным ID (если это группа)
            if str(processed_chat_id).startswith('-100'):
                 alternative_chat_id = int(str(processed_chat_id).replace('-100', '-'))
                 logger.info(f"Попытка отправить Excel в чат {alternative_chat_id} (альтернативный ID)")
                 try:
                     with open(resolved_path, "rb") as document_file:
                         await bot_app.bot.send_document(
                             chat_id=alternative_chat_id,
                             document=InputFile(document_file, filename=resolved_path.name),
                             caption=caption
                         )
                         logger.info(f"✅ Excel файл {resolved_path.name} успешно отправлен в чат {alternative_chat_id}.")
                         # Удаляем файл после успешной второй попытки
                         try:
                             os.remove(resolved_path)
                             logger.info(f"✅ Временный Excel файл {resolved_path} удален после второй попытки отправки.")
                         except Exception as remove_err:
                             logger.error(f"⚠️ Не удалось удалить временный Excel файл {resolved_path} после второй попытки отправки: {remove_err}")
                         return {"success": True, "message": "Excel report sent successfully (alt ID)"}
                 except Exception as alt_send_err:
                     logger.error(f"❌ Ошибка при отправке Excel {resolved_path.name} в чат {alternative_chat_id}: {alt_send_err}")
                     # Если и вторая попытка не удалась, выбрасываем ошибку
                     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send Excel report (alt ID): {alt_send_err}")
            else:
                 # Если это не группа или другая ошибка BadRequest
                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"BadRequest error sending Excel report: {tg_err}")
        except Exception as send_err: # Ошибки чтения файла или другие
            logger.error(f"❌ Ошибка при обработке Excel файла {resolved_path.name} или отправке в чат {payload.chat_id}: {send_err}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process or send Excel report: {send_err}")

    except HTTPException as http_exc:
        # Перевыбрасываем HTTP исключения (например, от валидации)
        # Важно: не удаляем файл, если была ошибка до отправки
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /internal/send_excel_report: {e}", exc_info=True)
        # Не удаляем файл, если была ошибка
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {e}")
    finally:
        # --- Дополнительная проверка на удаление файла, если он все еще существует после ошибки отправки --- 
        # Это маловероятно из-за логики выше, но как подстраховка
        if resolved_path and os.path.exists(resolved_path):
           
            pass # Пока не удаляем здесь, чтобы избежать случайного удаления
 

# --- НОВЫЙ ЭНДПОИНТ /internal/send_excel_report_file (принимает файл напрямую через multipart/form-data) ---
@router.post("/internal/send_excel_report_file", tags=["Internal"], status_code=status.HTTP_200_OK)
async def send_excel_report_file_internal(
    request: Request,
    chat_id: str = Form(...),
    file: UploadFile = File(...)
):
    """Принимает файл напрямую через multipart/form-data и отправляет сгенерированный Excel отчет в группу."""
    logger.info(f"📬 Получен запрос на /internal/send_excel_report_file для чата ID {chat_id}")
    logger.info(f"📎 Получен файл: {file.filename}, размер: {file.size if hasattr(file, 'size') else 'unknown'}")

    try:
        # Преобразуем формат ID чата
        try:
            if not chat_id.startswith('-'):
                logger.warning(f"Получен chat_id '{chat_id}' без минуса для группы. Пытаюсь добавить...")
                processed_chat_id = int(f"-{chat_id}")
            else:
                processed_chat_id = int(chat_id)
            logger.info(f"ID чата для отправки отчета: {processed_chat_id}")
        except ValueError:
            logger.error(f"Не удалось преобразовать chat_id '{chat_id}' в число")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid chat_id format: {chat_id}")

        # Определяем, какой бот использовать для этой группы
        bot_app: Application = None
        
        company_bot = await find_company_bot_for_chat(processed_chat_id, request)
        if company_bot:
            bot_app = company_bot
        else:
            from telegramNinjaBot.config.config import Config
            config = Config()
            if config.BOT_TYPE == 'companies':
                bot_applications = getattr(request.app.state, 'bot_applications', None)
                if bot_applications:
                    bot_app = bot_applications[0]
                    logger.warning(f"⚠️ Используем первый доступный бот для группы {chat_id} (бот компании не найден)")
                else:
                    logger.error("❌ bot_applications не найдены в app.state")
            else:
                bot_app = request.app.state.bot_application
        
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state при запросе send_excel_report_file")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Bot instance not available")

        # Формируем подпись для документа
        report_date = datetime.now().strftime("%d.%m.%Y")
        caption = f"📊 Отчет по инвентаризации от {report_date}"
        logger.info(f"Сгенерирована подпись для Excel: '{caption}'")

        # Читаем содержимое файла
        file_content = await file.read()
        file_size = len(file_content)
        logger.info(f"✅ Файл прочитан: {file_size} байт")

        # Отправка документа
        try:
            # Используем BytesIO для создания файлового объекта из байтов
            from io import BytesIO
            file_stream = BytesIO(file_content)
            
            # Получаем имя файла
            filename = file.filename or f"inventory_report_{processed_chat_id}.xlsx"
            
            await bot_app.bot.send_document(
                chat_id=processed_chat_id,
                document=InputFile(file_stream, filename=filename),
                caption=caption
            )
            logger.info(f"✅ Excel файл {filename} успешно отправлен в чат {chat_id}.")
            
            return {"success": True, "message": "Excel report sent successfully"}

        except BadRequest as tg_err:
            logger.error(f"❌ Ошибка BadRequest при отправке Excel {filename} в чат {chat_id}: {tg_err}")
            # Попытка отправить с альтернативным ID (если это группа)
            if str(processed_chat_id).startswith('-100'):
                 alternative_chat_id = int(str(processed_chat_id).replace('-100', '-'))
                 logger.info(f"Попытка отправить Excel в чат {alternative_chat_id} (альтернативный ID)")
                 try:
                     file_stream = BytesIO(file_content)
                     await bot_app.bot.send_document(
                         chat_id=alternative_chat_id,
                         document=InputFile(file_stream, filename=filename),
                         caption=caption
                     )
                     logger.info(f"✅ Excel файл {filename} успешно отправлен в чат {alternative_chat_id}.")
                     return {"success": True, "message": "Excel report sent successfully (alt ID)"}
                 except Exception as alt_send_err:
                     logger.error(f"❌ Ошибка при отправке Excel {filename} в чат {alternative_chat_id}: {alt_send_err}")
                     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send Excel report (alt ID): {alt_send_err}")
            else:
                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"BadRequest error sending Excel report: {tg_err}")
        except Exception as send_err:
            logger.error(f"❌ Ошибка при отправке Excel файла в чат {chat_id}: {send_err}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send Excel report: {send_err}")

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /internal/send_excel_report_file: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {e}")


# --- НОВЫЙ ЭНДПОИНТ /internal/send_write_off_report --- 
@router.post("/internal/send_write_off_report", tags=["Internal"], status_code=status.HTTP_200_OK)
async def send_write_off_report_internal(payload: SendWriteOffReportPayload, request: Request):
    """Принимает запрос от API Server и отправляет сгенерированный DOCX write-off отчёт в группу."""
    logger.info(f"\ud83d\udce8 Получен внутренний запрос на /internal/send_write_off_report для чата ID {payload.chat_id}")
    logger.debug(f"Payload: {payload.model_dump()}")
    resolved_path: Optional[Path] = None

    try:
        # Преобразуем chat_id
        try:
            if not payload.chat_id.startswith('-'):
                logger.warning(f"Получен chat_id '{payload.chat_id}' без минуса для группы. Пытаюсь добавить...")
                processed_chat_id = int(f"-{payload.chat_id}")
            else:
                processed_chat_id = int(payload.chat_id)
            logger.info(f"ID чата для отправки отчёта: {processed_chat_id}")
        except ValueError:
            logger.error(f"Не удалось преобразовать chat_id '{payload.chat_id}' в число")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid chat_id format: {payload.chat_id}")

        # Определяем, какой бот использовать для этой группы
        bot_app: Application = None
        
        # Пытаемся найти бот компании для этой группы
        company_bot = await find_company_bot_for_chat(processed_chat_id, request)
        if company_bot:
            bot_app = company_bot
        else:
            # Если режим companies, но бот не найден, используем первый доступный
            from telegramNinjaBot.config.config import Config
            config = Config()
            if config.BOT_TYPE == 'companies':
                bot_applications = getattr(request.app.state, 'bot_applications', None)
                if bot_applications:
                    bot_app = bot_applications[0]
                    logger.warning(f"⚠️ Используем первый доступный бот для группы {payload.chat_id} (бот компании не найден)")
                else:
                    logger.error("❌ bot_applications не найдены в app.state")
            else:
                # Для других режимов используем основной бот
                bot_app = request.app.state.bot_application
        
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state при запросе send_write_off_report")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Bot instance not available")

        # \u0412\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u044f \u043f\u0443\u0442\u0438 \u043a \u0444\u0430\u0439\u043b\u0443
        requested_path = Path(payload.file_path)
        logger.info(f"\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043f\u0443\u0442\u0438 DOCX \u0444\u0430\u0439\u043b\u0430: {requested_path}")

        if not requested_path.is_absolute():
            logger.error(f"\u274c \u0423\u043a\u0430\u0437\u0430\u043d \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u043f\u0443\u0442\u044c \u0434\u043b\u044f DOCX: {requested_path}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid DOCX file path: Must be absolute.")

        if not requested_path.is_file():
            logger.error(f"\u274c DOCX \u0444\u0430\u0439\u043b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d \u043f\u043e \u043f\u0443\u0442\u0438: {requested_path}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"DOCX file not found at path: {requested_path.name}")

        try:
            resolved_path = requested_path.resolve(strict=True)
            allowed_dir_resolved = ALLOWED_WRITEOFF_REPORTS_DIR.resolve(strict=True)
            if not resolved_path.is_relative_to(allowed_dir_resolved):
                logger.error(f"❌ Попытка доступа к DOCX файлу вне разрешённой директории: {resolved_path}")
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to the specified DOCX file path.")
        except Exception as path_resolve_err:
            logger.error(f"❌ Ошибка при проверке пути DOCX файла {requested_path}: {path_resolve_err}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error validating DOCX file path.")

        logger.info(f"Путь DOCX {resolved_path} прошел валидацию. Попытка отправки документа.")

        # Сначала отправляем фотографии, если есть
        if payload.photos and len(payload.photos) > 0:
            logger.info(f"📷 Отправляем {len(payload.photos)} фотографий списания...")
            
            for i, photo in enumerate(payload.photos, 1):
                try:
                    photo_path = photo.get('file_path')
                    photo_caption = photo.get('caption', f'Фото списания {i}')
                    
                    if photo_path and os.path.exists(photo_path):
                        try:
                            with open(photo_path, "rb") as photo_file:
                                await bot_app.bot.send_photo(
                                    chat_id=processed_chat_id,
                                    photo=InputFile(photo_file, filename=f"writeoff_photo_{i}.jpg"),
                                    caption=photo_caption
                                )
                            logger.info(f"✅ Фото {i}/{len(payload.photos)} успешно отправлено: {photo.get('item_name', 'неизвестно')}")
                        
                        except BadRequest as photo_tg_err:
                            # Пытаемся с альтернативным chat_id
                            if str(processed_chat_id).startswith('-100'):
                                alternative_chat_id = int(str(processed_chat_id).replace('-100', '-'))
                                logger.info(f"Попытка отправить фото {i} в чат {alternative_chat_id} (альтернативный ID)")
                                try:
                                    with open(photo_path, "rb") as photo_file:
                                        await bot_app.bot.send_photo(
                                            chat_id=alternative_chat_id,
                                            photo=InputFile(photo_file, filename=f"writeoff_photo_{i}.jpg"),
                                            caption=photo_caption
                                        )
                                    logger.info(f"✅ Фото {i} успешно отправлено в чат {alternative_chat_id}")
                                except Exception as alt_photo_err:
                                    logger.error(f"❌ Ошибка при отправке фото {i} в альтернативный чат: {alt_photo_err}")
                            else:
                                logger.error(f"❌ BadRequest при отправке фото {i}: {photo_tg_err}")
                    else:
                        logger.warning(f"⚠️ Фото {i} не найдено: {photo_path}")
                        
                except Exception as photo_err:
                    logger.error(f"❌ Ошибка при отправке фото {i}: {photo_err}")
                    # Продолжаем отправку остальных фото
                    continue
            
            logger.info(f"📷 Завершена отправка фотографий. Переходим к DOCX...")
        
        # Формируем подпись для документа
        report_date = datetime.now().strftime("%d.%m.%Y")
        photos_text = f" ({payload.photos_count} фото)" if payload.photos_count > 0 else ""
        caption = f"📝 Акт списания от {report_date}{photos_text}"
        logger.info(f"Сгенерирован подпись для DOCX: '{caption}'")

        # Отправка документа
        try:
            with open(resolved_path, "rb") as document_file:
                await bot_app.bot.send_document(
                    chat_id=processed_chat_id,
                    document=InputFile(document_file, filename=resolved_path.name),
                    caption=caption
                )
                logger.info(f"✅ DOCX файл {resolved_path.name} успешно отправлен в чат {payload.chat_id}.")

            # Удаляем файл после успешной отправки
            try:
                os.remove(resolved_path)
                logger.info(f"✅ Временный DOCX файл {resolved_path} удален после отправки.")
            except Exception as remove_err:
                logger.error(f"⚠️ Не удалось удалить временный DOCX файл {resolved_path} после отправки: {remove_err}")

            return {"success": True, "message": "Write-off report sent successfully"}

        except BadRequest as tg_err:
            logger.error(f"❌ Ошибка BadRequest при отправке DOCX {resolved_path.name} в чат {payload.chat_id}: {tg_err}")
            if str(processed_chat_id).startswith('-100'):
                alternative_chat_id = int(str(processed_chat_id).replace('-100', '-'))
                logger.info(f"Попытка отправить DOCX в чат {alternative_chat_id} (альтернативный ID)")
                try:
                    with open(resolved_path, "rb") as document_file:
                        await bot_app.bot.send_document(
                            chat_id=alternative_chat_id,
                            document=InputFile(document_file, filename=resolved_path.name),
                            caption=caption
                        )
                        logger.info(f"✅ DOCX файл {resolved_path.name} успешно отправлен в чат {alternative_chat_id}.")
                        try:
                            os.remove(resolved_path)
                            logger.info(f"✅ Временный DOCX файл {resolved_path} удален после второй попытки отправки.")
                        except Exception as remove_err:
                            logger.error(f"⚠️ Не удалось удалить временный DOCX файл {resolved_path} после второй попытки отправки: {remove_err}")
                        return {"success": True, "message": "Write-off report sent successfully (alt ID)"}
                except Exception as alt_send_err:
                    logger.error(f"❌ Ошибка при отправке DOCX {resolved_path.name} в чат {alternative_chat_id}: {alt_send_err}")
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send write-off report (alt ID): {alt_send_err}")
            else:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"BadRequest error sending write-off report: {tg_err}")
        except Exception as send_err:
            logger.error(f"❌ Ошибка при обработке DOCX файла {resolved_path.name} или отправке в чат {payload.chat_id}: {send_err}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process or send write-off report: {send_err}")

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"\u274c \u041d\u0435\u043f\u0440\u0435\u0434\u0432\u0438\u0434\u0435\u043d\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430 \u0432 /internal/send_write_off_report: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {e}")

# --- НОВЫЙ ОБРАБОТЧИК ДЛЯ КНОПКИ ПОДТВЕРЖДЕНИЯ --- 
async def handle_confirmation_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает нажатие на кнопку подтверждения."""
    query = update.callback_query
    if not query or not query.data:
        return

    # Отвечаем на колбэк, чтобы убрать "часики" на кнопке
    await query.answer()

    # <<< ИЗМЕНЕНИЕ: Проверяем префикс и парсим ID >>>
    notification_id_str = None
    confirmation_type = 'default' # По умолчанию
    # <<< ДОБАВЛЯЕМ СПИСОК СЛОВ >>>
    positive_words = [
        "Отлично", "Замечательно", "Супер",
        "Прекрасно", "Так держать",
        "Класс", "Здорово",
        "Одобрено", "Принято", 
        "Хорошо",  "Зафиксировано",
    ]

    if query.data.startswith("confirm_eos:"):
        confirmation_type = 'end_of_shift'
        notification_id_str = query.data.removeprefix("confirm_eos:")
    elif query.data.startswith("confirm:"):
        confirmation_type = 'default'
        notification_id_str = query.data.removeprefix("confirm:")
    else:
        logger.warning(f"Получен неизвестный callback_data: {query.data}")
        return # Выходим, если префикс неизвестен

    # Простая проверка, что ID извлекся
    if not notification_id_str:
        logger.error(f"Не удалось извлечь notification_id из callback_data: {query.data}")
        return
    # --- Конец проверки префикса ---

    user = query.from_user
    username = f"@{user.username}" if user.username else user.full_name

    logger.info(f"✅ Подтверждение ({confirmation_type}) получено для уведомления {notification_id_str} от пользователя {username} (ID: {user.id})")

    # <<< ИЗМЕНЕНИЕ: Формируем сообщение в зависимости от типа >>>
    if confirmation_type == 'end_of_shift':
        # <<< ИЗМЕНЕНИЕ: Добавляем рандомное слово ПЕРЕД ЭМОДЗИ и пожелание В КОНЦЕ >>>
        random_word = random.choice(positive_words)
        confirmation_message = f"{random_word} 👍 Сотрудник {username} подтверждает, что провел визуальный осмотр для обеспечения техники пожарной безопасности. Приятного отдыха! 🌙"
    else: # Для 'default' и других возможных типов в будущем
        confirmation_message = f"✅ Уведомление подтверждено пользователем {username}."
    # <<< Конец формирования сообщения >>>

    try:
        # Отправляем подтверждение в тот же чат
        if query.message:
            await context.bot.send_message(
                chat_id=query.message.chat_id,
                text=confirmation_message,
                # Можно добавить reply_to_message_id, чтобы связать с исходным сообщением
                # reply_to_message_id=query.message.message_id
            )
            # Опционально: Убираем кнопки из исходного сообщения
            try:
                await query.edit_message_reply_markup(reply_markup=None)
                logger.info(f"Убраны кнопки из сообщения для уведомления {notification_id_str}")
            except Exception as edit_err:
                logger.warning(f"Не удалось убрать кнопки из сообщения для уведомления {notification_id_str}: {edit_err}")

            # <<< ИЗМЕНЕНИЕ: Отправляем запрос на отмену напоминания в шедулер >>>
            chat_id_full = query.message.chat_id
            
            # --- НОВЫЙ КОД: Подготовка обоих вариантов ID чата ---
            original_chat_id = str(chat_id_full) # Оригинальный ID
            alternative_chat_id = None  # Альтернативный ID
            
            # Создаем альтернативную версию ID в зависимости от формата
            if original_chat_id.startswith('-100'):
                # Если ID с префиксом "-100", создаем версию без префикса
                alternative_chat_id = '-' + original_chat_id[4:]
                logger.debug(f"Создан альтернативный ID без префикса: {alternative_chat_id}")
            elif original_chat_id.startswith('-'):
                # Если ID без префикса "-100", добавляем префикс
                alternative_chat_id = '-100' + original_chat_id[1:]
                logger.debug(f"Создан альтернативный ID с префиксом: {alternative_chat_id}")
                
            logger.debug(f"Подготовлены ID для отмены напоминания: оригинальный={original_chat_id}, альтернативный={alternative_chat_id}")
            # --- КОНЕЦ НОВОГО КОДА ---
            
            config = Config()
            scheduler_api_url = getattr(config, 'SCHEDULER_API_URL', None)
            if scheduler_api_url:
                base_scheduler_url = str(scheduler_api_url).rstrip('/')
                
                # --- НОВЫЙ КОД: Пробуем оба варианта ID чата ---
                cancel_success = False
                client = None
                
                try:
                    client = httpx.AsyncClient()
                    
                    # Сначала пробуем с оригинальным ID
                    original_endpoint = f"{base_scheduler_url}/scheduler/notifications/reminders/{notification_id_str}/{original_chat_id}"
                    logger.info(f"Отправка запроса на отмену напоминания для notification_id={notification_id_str} с оригинальным ID {original_chat_id}")
                    
                    orig_response = await client.delete(original_endpoint, timeout=5.0)
                    if orig_response.status_code == 200:
                        logger.info(f"✅ Напоминание успешно отменено с оригинальным ID чата {original_chat_id}")
                        cancel_success = True
                    elif orig_response.status_code == 404 and alternative_chat_id:
                        # Если не найдено, пробуем с альтернативным ID
                        logger.warning(f"Напоминание не найдено с оригинальным ID. Пробуем с альтернативным ID: {alternative_chat_id}")
                        
                        alt_endpoint = f"{base_scheduler_url}/scheduler/notifications/reminders/{notification_id_str}/{alternative_chat_id}"
                        alt_response = await client.delete(alt_endpoint, timeout=5.0)
                        
                        if alt_response.status_code == 200:
                            logger.info(f"✅ Напоминание успешно отменено с альтернативным ID чата {alternative_chat_id}")
                            cancel_success = True
                        else:
                            logger.warning(f"❌ Напоминание не найдено и с альтернативным ID: {alt_response.status_code}, {alt_response.text}")
                    elif orig_response.status_code != 200:
                        logger.error(f"❌ Ошибка от API шедулера: {orig_response.status_code}, {orig_response.text}")
                except httpx.RequestError as req_err:
                    logger.error(f"❌ Ошибка сети при отправке запроса на отмену напоминания: {req_err}")
                except Exception as req_err:
                    logger.error(f"❌ Ошибка при отправке запроса на отмену напоминания: {req_err}", exc_info=True)
                finally:
                    if client:
                        await client.aclose()
                
                if cancel_success:
                    logger.info(f"✅ Задача-напоминание для {notification_id_str} успешно отменена")
                else:
                    logger.warning(f"⚠️ Не удалось найти и отменить задачу напоминания для {notification_id_str}")
                # --- КОНЕЦ НОВОГО КОДА ---
                
            else:
                logger.error("SCHEDULER_API_URL не найден в конфигурации. Невозможно отменить напоминание.")
        else:
             # <<< ИЗМЕНЕНИЕ: Используем notification_id в логе >>>
             logger.warning(f"Не удалось отправить сообщение подтверждения для уведомления {notification_id_str}, query.message отсутствует.")
    except Exception as send_err:
        # <<< ИЗМЕНЕНИЕ: Используем notification_id в логе >>>
        logger.error(f"Ошибка при отправке сообщения подтверждения для уведомления {notification_id_str}: {send_err}", exc_info=True)


# --- Эндпоинт для отправки запроса на добавление товара в группу инвентаризации ---
@router.post("/internal/send_item_request", tags=["Internal"], status_code=status.HTTP_200_OK)
async def send_item_request_internal(payload: SendItemRequestPayload, request: Request):
    """
    Отправляет запрос на добавление товара в группу инвентаризации.
    """
    logger.info(f"📋 Получен запрос на добавление товара в группу инвентаризации")
    logger.info(f"Данные: inventory_group_id={payload.inventory_group_id}, chef_group_id={payload.chef_group_id}, item_name={payload.item_name}")
    
    try:
        # Получаем экземпляр бота из app.state
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state")
            raise HTTPException(status_code=503, detail="Bot instance not available")
        
        # Преобразуем ID группы инвентаризации в int
        try:
            inventory_group_id = int(payload.inventory_group_id)
        except ValueError:
            logger.error(f"❌ Неверный формат inventory_group_id: {payload.inventory_group_id}")
            raise HTTPException(status_code=400, detail="Invalid inventory_group_id format")
        
        # Формируем красивое сообщение с запросом
        semicolon_icon = "🔗" if payload.has_semifinished else "➖"
        message_text = f"""
🔥 <b>Новый запрос на добавление товара</b> 🔥

📦 <b>Товар:</b> {payload.item_name}
📂 <b>Категория:</b> {payload.category}
{semicolon_icon} <b>Полуфабрикаты:</b> {"Есть" if payload.has_semifinished else "Нет"}

🏢 <b>Группа:</b> {payload.chef_group_title}

⏰ <b>Время запроса:</b> {datetime.now().strftime("%H:%M:%S")}
         """.strip()
        
        # Отправляем сообщение в группу инвентаризации
        try:
            await bot_app.bot.send_message(
                chat_id=inventory_group_id,
                text=message_text,
                parse_mode=ParseMode.HTML
            )
            logger.info(f"✅ Запрос на добавление товара '{payload.item_name}' успешно отправлен в группу инвентаризации {payload.inventory_group_id}")
            sent_to_inventory_group = True
            
        except BadRequest as e:
            error_message = str(e)
            logger.warning(f"⚠️ Ошибка BadRequest при отправке запроса в группу инвентаризации {payload.inventory_group_id}: {error_message}")
            
            # Пробуем альтернативный ID
            if payload.inventory_group_id.startswith("-100"):
                try:
                    alternative_inventory_group_id = int(f"-{payload.inventory_group_id[4:]}")
                    logger.info(f"Попытка отправить запрос в группу инвентаризации {alternative_inventory_group_id} (альтернативный ID)")
                    
                    await bot_app.bot.send_message(
                        chat_id=alternative_inventory_group_id,
                        text=message_text,
                        parse_mode=ParseMode.HTML
                    )
                    logger.info(f"✅ Запрос на добавление товара '{payload.item_name}' успешно отправлен в группу инвентаризации {alternative_inventory_group_id} (альтернативный ID)")
                    sent_to_inventory_group = True
                    
                except Exception as retry_exc:
                    logger.error(f"❌ Ошибка при второй попытке отправки запроса в группу инвентаризации {alternative_inventory_group_id}: {retry_exc}")
                    sent_to_inventory_group = False
                    raise HTTPException(status_code=500, detail=f"Failed to send item request after retry: {retry_exc}")
            else:
                sent_to_inventory_group = False
                raise HTTPException(status_code=500, detail=f"Failed to send item request: {error_message}")
        
        except Exception as e:
            logger.error(f"❌ Непредвиденная ошибка при отправке запроса в группу инвентаризации {payload.inventory_group_id}: {e}", exc_info=True)
            sent_to_inventory_group = False
            raise HTTPException(status_code=500, detail=f"Failed to send item request: {e}")
        
        return {
            "success": True,
            "message": "Запрос на добавление товара успешно отправлен",
            "sent_to_inventory_group": sent_to_inventory_group,
            "inventory_group_id": payload.inventory_group_id,
            "item_name": payload.item_name
        }
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /internal/send_item_request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# --- Эндпоинт для генерации безопасных ссылок приглашения ---
@router.post("/api/chats/{chat_id}/invite-link", tags=["Chat Management"], status_code=status.HTTP_200_OK)
async def generate_invite_link(chat_id: str, request: Request):
    """
    Генерирует безопасную ссылку приглашения для чата.
    Безопасность: ссылка генерируется на бэкенде, а не на фронте.
    """
    logger.info(f"🔗 Получен запрос на генерацию ссылки приглашения для чата {chat_id}")
    
    try:
        # Получаем экземпляр бота из app.state
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state")
            raise HTTPException(status_code=503, detail="Bot instance not available")
        
        # Преобразуем ID чата в int
        try:
            processed_chat_id = int(chat_id)
            logger.info(f"ID чата {chat_id} обработан как {processed_chat_id}")
        except ValueError:
            logger.error(f"❌ Неверный формат chat_id: {chat_id}")
            raise HTTPException(status_code=400, detail="Invalid chat_id format")
        
        # Получаем информацию о боте через Telegram API
        try:
            bot_info = await bot_app.bot.get_me()
            bot_username = bot_info.username
            logger.info(f"✅ Получен username бота: {bot_username}")
            
            if not bot_username:
                logger.error("❌ У бота не настроен username")
                raise HTTPException(
                    status_code=500, 
                    detail="Bot username not configured. Please set username for the bot in @BotFather"
                )
                
        except Exception as e:
            logger.error(f"❌ Не удалось получить информацию о боте: {e}")
            raise HTTPException(status_code=500, detail="Failed to get bot information")
        
        # Генерируем уникальный параметр для ссылки
        import secrets
        import hashlib
        import time
        
        # Создаем уникальный токен на основе chat_id и времени
        timestamp = int(time.time())
        random_secret = secrets.token_hex(8)
        token_data = f"{chat_id}_{timestamp}_{random_secret}"
        invite_token = hashlib.sha256(token_data.encode()).hexdigest()[:16]
        
        # Создаем безопасную ссылку
        invite_link = f"https://t.me/{bot_username}?start=registry_{chat_id}_{invite_token}"
        
        logger.info(f"✅ Сгенерирована безопасная ссылка приглашения для чата {chat_id}")
        logger.info(f"🔗 Ссылка: {invite_link}")
        
        return {
            "success": True,
            "invite_link": invite_link,
            "chat_id": chat_id,
            "expires_at": timestamp + (24 * 60 * 60),  # Ссылка действительна 24 часа
            "message": "Безопасная ссылка приглашения успешно сгенерирована"
        }
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка при генерации ссылки приглашения: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
