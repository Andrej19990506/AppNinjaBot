import logging
import json
import traceback
import os
from datetime import datetime
from typing import List, Dict
# import aiohttp # Убедитесь, что aiohttp установлен, если используете handle_deletion_callback
from telegram import Update, Bot, MenuButton, MenuButtonWebApp, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegramNinjaBot.config.config import Config
# Предполагаем, что json_service и deletion_requests будут доступны через context.application.state
# Если нет, их нужно будет передавать иначе или импортировать (менее предпочтительно)
import telegram.error

logger = logging.getLogger(__name__)

def get_personalized_welcome_message(group_type: str, user_role: str, user_name: str, group_name: str, is_senior_courier: bool = False) -> str:
    """
    Генерирует персонализированное приветственное сообщение в зависимости от типа группы и роли пользователя
    """
    base_message = f"ℹ️ *Вы уже зарегистрированы!*\n\n🎯 **Группа:** {group_name}\n👤 **Пользователь:** {user_name}\n"
    
    if group_type == "chef":
        if user_role in ["creator", "administrator"]:
            return (
                f"{base_message}\n"
                f"👨‍🍳 **Роль:** Старший повар/Управляющий\n\n"
                f"🚀 **Доступные функции:**\n"
                f"• 📦 Управление инвентаризацией\n"
                f"• 📋 Управление списанием\n"
                f"• 📊 Отчеты по кухне\n"
                f"• ⚡ Уведомления о событиях\n"
                f"• ⏰ Открытие временного доступа для сотрудников\n"
                f"\n"
                f"Вы можете управлять всеми процессами на кухне!"
            )
        else:
            return (
                f"{base_message}\n"
                f"👨‍🍳 **Роль:** Участник группы\n\n"
                f"🚀 **Доступные функции:**\n"
                f"❗️ У вас ограниченный доступ. После того как Старший повар или Управляющий предоставит вам временный доступ, вы сможете управлять инвентаризацией и списанием.\n\n"
                f"Добро пожаловать в команду кухни!"
            )
    
    elif group_type == "courier":
        if is_senior_courier:
            return (
                f"{base_message}\n"
                f"🚚 **Роль:** Старший курьер\n\n"
                f"🚀 **Доступные функции:**\n"
                f"• 📅 Управление графиком смен\n"
                f"• 👥 Управление курьерами\n"
                f"• 🎯 Назначение смен\n\n"
                f"Вы можете управлять командой курьеров!"
            )
        else:
            return (
                f"{base_message}\n"
                f"🚚 **Роль:** Курьер\n\n"
                f"🚀 **Доступные функции:**\n"
                f"• 📅 Просмотр доступных и занятых смен\n"
                f"• ➕ Запись в смены\n"
                f"• 📝 Запись в резерв\n"
                f"• 📊 Просмотр своих смен\n"
                f"• ⚡ Уведомления об открытии доступа к записи в вашей группе\n"
                f"\n"
                f"❗️ Вы не можете самостоятельно удаляться из смены. Для отмены смены обратитесь к старшему курьеру или администратору.\n"
                f"\n"
                f"Добро пожаловать в команду доставки!"
            )
    
    elif group_type == "purchasing":
        if user_role in ["creator", "administrator"]:
            return (
                f"{base_message}\n"
                f"🛒 **Роль:** Руководитель отдела закупок\n\n"
                f"🚀 **Доступные функции:**\n"
                f"• 📦 Получение уведомлений о поставках\n"
                f"• 📊 Мониторинг принятых товаров\n"
                f"• ⚠️ Отслеживание проблем с поставками\n"
                f"• 📋 Контроль соответствия накладным\n"
                f"• 💼 Управление взаимодействием с поставщиками\n"
                f"\n"
                f"Вы получаете полную информацию о всех поставках!"
            )
        else:
            return (
                f"{base_message}\n"
                f"🛒 **Роль:** Сотрудник отдела закупок\n\n"
                f"🚀 **Доступные функции:**\n"
                f"• 📦 Получение уведомлений о поставках\n"
                f"• 📊 Просмотр информации о принятых товарах\n"
                f"• ⚠️ Отслеживание проблем с поставками\n"
                f"• 📋 Контроль соответствия накладным\n"
                f"\n"
                f"Добро пожаловать в отдел закупок!"
            )


async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик данных от веб-приложения"""
    try:
        # Проверяем наличие сообщения
        if not update.effective_message:
            logger.warning("Нет effective_message в обновлении")
            return

        # Проверяем наличие web_app_data
        if not hasattr(update.effective_message, 'web_app_data') or not update.effective_message.web_app_data:
            # logger.warning("Нет web_app_data в сообщении") # Часто срабатывает, можно убрать лог
            return

        # Проверяем наличие данных
        data_str = update.effective_message.web_app_data.data
        if not data_str:
            logger.warning("Пустые данные в web_app_data")
            return

        logger.info(f"Получены сырые данные от WebApp: {data_str}")

        try:
            data = json.loads(data_str)
            logger.info(f"Распарсенные данные WebApp: {data}")

            if data.get('action') == 'open_user_profile':
                user_id = data.get('user_id')
                first_name = data.get('first_name', 'Пользователь')
                logger.info(f"Попытка открыть профиль пользователя {first_name} (ID: {user_id}) через WebApp")

                if user_id:
                    # Создаем клавиатуру с кнопкой
                    keyboard = InlineKeyboardMarkup([
                        [InlineKeyboardButton(
                            text=f"Открыть чат с {first_name}",
                            url=f"tg://user?id={user_id}"
                        )]
                    ])

                    # Отправляем сообщение с кнопкой
                    await update.effective_message.reply_text(
                        f"Нажмите на кнопку ниже, чтобы открыть чат с {first_name}:",
                        reply_markup=keyboard
                    )
                    logger.info("Сообщение WebApp с кнопкой успешно отправлено")
                else:
                    logger.error("Не указан user_id в данных WebApp")
            # Добавьте здесь обработку других 'action' из вашего WebApp, если нужно
            else:
                logger.warning(f"Неизвестное действие WebApp: {data.get('action')}")
        except json.JSONDecodeError as e:
            logger.error(f"Ошибка парсинга JSON от WebApp: {e}")
            return

    except Exception as e:
        logger.error(f"Ошибка при обработке данных веб-приложения: {e}", exc_info=True)


async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    try:
        user = update.effective_user
        logger.info(f"Пользователь {user.full_name} ({user.id}) запустил команду /start")

        # Проверяем тип бота
        config = Config()
        bot_type = config.BOT_TYPE
        
        # Проверяем параметры команды /start
        args = context.args
        logger.info(f"🔍 Параметры команды /start: {args}, BOT_TYPE: {bot_type}")
        
        # === ОСНОВНОЙ БОТ (main) - только авторизация ===
        if bot_type == 'main':
            # Если есть параметр auth или auth_<session_id> - обрабатываем авторизацию
            if args and len(args) > 0 and (args[0] == 'auth' or args[0].startswith('auth_')):
                logger.info(f"🔐 Пользователь {user.id} запросил авторизацию через бота")
                
                # Проверяем, является ли этот бот основным ботом для авторизации
                try:
                    bot_info = await context.bot.get_me()
                    current_bot_username = bot_info.username.lower() if bot_info.username else None
                    auth_bot_username = config.AUTH_BOT_USERNAME.lower()
                    
                    logger.info(f"🔍 [Auth] Текущий бот: @{bot_info.username}, Основной бот для авторизации: @{config.AUTH_BOT_USERNAME}")
                    
                    # Если это не основной бот приложения - перенаправляем на него
                    if current_bot_username != auth_bot_username:
                        logger.info(f"⚠️ [Auth] Команда /start auth вызвана не через основной бот. Перенаправляем на @{config.AUTH_BOT_USERNAME}")
                        keyboard = InlineKeyboardMarkup([
                            [InlineKeyboardButton(
                                text=f"🔐 Авторизоваться через @{config.AUTH_BOT_USERNAME}",
                                url=f"https://t.me/{config.AUTH_BOT_USERNAME}?start=auth"
                            )]
                        ])
                        await update.message.reply_text(
                            f"ℹ️ *Авторизация через основной бот*\n\n"
                            f"Для авторизации в приложении необходимо использовать основной бот приложения.\n\n"
                            f"Нажмите на кнопку ниже, чтобы перейти к авторизации через @{config.AUTH_BOT_USERNAME}.",
                            reply_markup=keyboard,
                            parse_mode='Markdown'
                        )
                        return
                except Exception as e:
                    logger.error(f"❌ Ошибка при проверке бота: {e}")
                    # Продолжаем выполнение, если не удалось проверить
                
                # Получаем сервис БД из bot_data
                db_service = context.application.bot_data.get('db_service')
                if not db_service:
                    logger.error("DatabaseService не найден в bot_data")
                    await update.message.reply_text(
                        "❌ Ошибка системы. Попробуйте позже."
                    )
                    return
                
                # Проверяем, что пользователь существует в БД
                user_groups = await db_service.get_user_groups(user.id)
                if not user_groups:
                    await update.message.reply_text(
                        f"❌ *Авторизация недоступна*\n\n"
                        f"Вы не зарегистрированы ни в одной группе в системе.\n\n"
                        f"📞 **Для регистрации обратитесь к своему руководителю.**",
                        parse_mode='Markdown'
                    )
                    return
                
                # Генерируем одноразовый токен
                import secrets
                import hashlib
                import time
                import httpx
                
                timestamp = int(time.time())
                random_secret = secrets.token_hex(16)
                token_data = f"{user.id}_{timestamp}_{random_secret}"
                auth_token = hashlib.sha256(token_data.encode()).hexdigest()[:32]
                
                # Проверяем, есть ли session_id в параметрах команды (для WebSocket механизма)
                session_id = None
                if args and len(args) > 0:
                    # Формат: /start auth_<session_id> или /start auth
                    if args[0] == 'auth':
                        # Просто /start auth без session_id (старый формат, fallback)
                        logger.info(f"🔐 [Auth] Команда /start auth без session_id")
                    elif args[0].startswith('auth_'):
                        # Извлекаем session_id из параметра auth_<session_id>
                        session_id = args[0].replace('auth_', '', 1)  # Убираем только первый префикс auth_
                        logger.info(f"🔐 [Auth] Обнаружен session_id: {session_id[:20]}...")
                    elif args[0] == 'auth' and len(args) > 1:
                        # Альтернативный формат: /start auth <session_id>
                        session_id = args[1]
                        logger.info(f"🔐 [Auth] Обнаружен session_id (альтернативный формат): {session_id[:20]}...")
                
                # Сохраняем токен в Redis через API сервер
                # Токен действителен 5 минут
                try:
                    api_url = config.API_URL.rstrip('/')
                    logger.info(f"🔗 [Auth] Отправка запроса на сохранение токена: {api_url}/api/v1/auth/bot-token")
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        request_data = {
                            "token": auth_token,
                            "user_id": user.id,
                            "expires_in": 300  # 5 минут
                        }
                        # Добавляем session_id, если он есть
                        if session_id:
                            request_data["session_id"] = session_id
                        
                        response = await client.post(
                            f"{api_url}/api/v1/auth/bot-token",
                            json=request_data
                        )
                        logger.info(f"📡 [Auth] Ответ API: статус {response.status_code}")
                        if response.status_code != 200:
                            error_detail = response.text if hasattr(response, 'text') else "Unknown error"
                            logger.error(f"❌ [Auth] Не удалось сохранить токен в Redis: статус {response.status_code}, детали: {error_detail}")
                            raise Exception(f"Failed to store token: {response.status_code} - {error_detail}")
                        logger.info(f"✅ [Auth] Токен успешно сохранен в Redis")
                except httpx.ConnectError as e:
                    logger.error(f"❌ [Auth] Ошибка подключения к API серверу ({api_url}): {e}")
                    await update.message.reply_text(
                        f"❌ *Ошибка подключения*\n\n"
                        f"Не удалось подключиться к серверу авторизации.\n\n"
                        f"Попробуйте позже или обратитесь к администратору.",
                        parse_mode='Markdown'
                    )
                    return
                except httpx.TimeoutException as e:
                    logger.error(f"❌ [Auth] Таймаут при подключении к API серверу: {e}")
                    await update.message.reply_text(
                        f"❌ *Таймаут подключения*\n\n"
                        f"Сервер авторизации не отвечает.\n\n"
                        f"Попробуйте позже.",
                        parse_mode='Markdown'
                    )
                    return
                except Exception as e:
                    logger.error(f"❌ [Auth] Ошибка при сохранении токена: {e}", exc_info=True)
                    await update.message.reply_text(
                        f"❌ *Ошибка при создании токена авторизации*\n\n"
                        f"Попробуйте позже или обратитесь к администратору.",
                        parse_mode='Markdown'
                    )
                    return
                
                # Если есть session_id, значит запрос пришел из веб-версии (WebSocket механизм)
                # В этом случае отправляем только сообщение для веб-версии
                if session_id:
                    await update.message.reply_text(
                        f"✅ *Авторизация успешна!*\n\n"
                        f"Вернитесь в приложение в браузере — авторизация произойдет автоматически.\n\n"
                        f"⏰ Токен действителен в течение 5 минут.",
                        parse_mode='Markdown'
                    )
                else:
                    # Для нативного приложения используем WebSocket механизм (как для веб-версии)
                    # Если есть session_id, значит приложение подключено к WebSocket
                    # Отправляем сообщение и токен будет доставлен через WebSocket автоматически
                    await update.message.reply_text(
                        f"✅ *Авторизация успешна!*\n\n"
                        f"Вернитесь в приложение — авторизация произойдет автоматически.\n\n"
                        f"⏰ Токен действителен в течение 5 минут.",
                        parse_mode='Markdown'
                    )
                    
                    logger.info(f"📱 [Auth] Токен создан для нативного приложения, будет доставлен через WebSocket")
                logger.info(f"✅ Токен авторизации создан для пользователя {user.id}: {auth_token[:8]}...")
                return
            else:
                # Основной бот - показываем приветствие с кнопкой мини-аппа
                web_app_url = config.WEB_APP_URL
                
                # Создаем кнопку с мини-аппом, если URL задан
                keyboard_buttons = []
                if web_app_url:
                    keyboard_buttons.append([
                        InlineKeyboardButton(
                            text="🌐 Открыть приложение",
                            web_app=WebAppInfo(url=web_app_url)
                        )
                    ])
                
                # Добавляем кнопку для авторизации через команду (fallback)
                keyboard_buttons.append([
                    InlineKeyboardButton(
                        text="🔐 Авторизация через команду",
                        callback_data="auth_via_command"
                    )
                ])
                
                keyboard = InlineKeyboardMarkup(keyboard_buttons) if keyboard_buttons else None
                
                message_text = (
                    f"🔐 *Основной бот FloWix*\n\n"
                    f"Добро пожаловать! Для авторизации в системе используйте кнопку ниже.\n\n"
                    f"Нажмите *\"Открыть приложение\"* для авторизации через веб-приложение.\n\n"
                    f"Для работы с группами используйте бота вашей компании."
                )
                
                await update.message.reply_text(
                    message_text,
                    reply_markup=keyboard,
                    parse_mode='Markdown'
                )
                return
        
        # === БОТ(Ы) КОМПАНИИ (company/companies) - полный функционал ===
        elif bot_type in ('company', 'companies'):
            # Если есть параметр auth - перенаправляем на основной бот
            if args and args[0] == 'auth':
                logger.info(f"⚠️ [Company Bot] Команда /start auth вызвана в боте компании. Перенаправляем на основной бот.")
                keyboard = InlineKeyboardMarkup([
                    [InlineKeyboardButton(
                        text=f"🔐 Авторизоваться через @{config.AUTH_BOT_USERNAME}",
                        url=f"https://t.me/{config.AUTH_BOT_USERNAME}?start=auth"
                    )]
                ])
                await update.message.reply_text(
                    f"ℹ️ *Авторизация через основной бот*\n\n"
                    f"Для авторизации в приложении необходимо использовать основной бот приложения.\n\n"
                    f"Нажмите на кнопку ниже, чтобы перейти к авторизации через @{config.AUTH_BOT_USERNAME}.",
                    reply_markup=keyboard,
                    parse_mode='Markdown'
                )
                return
            
            # Если есть параметр registry_ - обрабатываем регистрацию
            registry_param = None
            if args and len(args) > 0 and args[0].startswith('registry_'):
                registry_param = args[0]
            
            # Если нет параметра registry_, просто выходим (обычный /start)
            if not registry_param:
                # Обычный /start без параметров - ничего не делаем для ботов компаний
                return
            
            # Парсим параметры: registry_<chat_id>_<token>
            # Используем более надежный способ парсинга для отрицательных ID
            if not registry_param.startswith('registry_'):
                logger.error(f"❌ Неверный формат параметра регистрации: {registry_param}")
                await update.message.reply_text(
                    f"❌ *Ошибка регистрации*\n\n"
                    f"Некорректный формат ссылки регистрации.\n\n"
                    f"Обратитесь к администратору за новой ссылкой регистрации.",
                    parse_mode='Markdown'
                )
                return
            
            # Убираем 'registry_' и разбиваем остальное по последнему '_'
            param_without_prefix = registry_param[9:]  # убираем 'registry_'
            last_underscore_index = param_without_prefix.rfind('_')
            
            if last_underscore_index == -1:
                logger.error(f"❌ Неверный формат параметра регистрации: {registry_param}")
                await update.message.reply_text(
                    f"❌ *Ошибка регистрации*\n\n"
                    f"Некорректный формат ссылки регистрации.\n\n"
                    f"Обратитесь к администратору за новой ссылкой регистрации.",
                    parse_mode='Markdown'
                )
                return
            
            # Получаем group_id (все до последнего '_') и invite_token (после последнего '_')
            group_id = param_without_prefix[:last_underscore_index]
            invite_token = param_without_prefix[last_underscore_index + 1:]
            
            logger.info(f"🔐 Пользователь {user.id} перешел по ссылке регистрации в группу {group_id} с токеном {invite_token}")
            logger.info(f"🔍 Отладочная информация: registry_param='{registry_param}', param_without_prefix='{param_without_prefix}', last_underscore_index={last_underscore_index}")
            
            # Валидируем ID группы
            try:
                group_id_int = int(group_id)
                # Проверяем, что это отрицательное число (группа/канал)
                # Принимаем как обычные группы (-123456789), так и супергруппы (-100123456789)
                if group_id_int >= 0:
                    await update.message.reply_text(
                        f"❌ *Ошибка регистрации*\n\n"
                        f"Некорректный ID группы в ссылке.\n\n"
                        f"Обратитесь к администратору за новой ссылкой регистрации.",
                        parse_mode='Markdown'
                    )
                    return
                logger.info(f"✅ ID группы {group_id} валиден (обычная группа или супергруппа)")
            except ValueError:
                await update.message.reply_text(
                    f"❌ *Ошибка регистрации*\n\n"
                    f"Некорректный формат ID группы в ссылке.\n\n"
                    f"Обратитесь к администратору за новой ссылкой регистрации.",
                    parse_mode='Markdown'
                )
                return
            
            # Валидируем токен приглашения (опционально)
            if invite_token:
                # Здесь можно добавить проверку токена, если нужно
                # Например, проверить в базе данных или валидировать формат
                logger.info(f"🔐 Токен приглашения: {invite_token}")
            
            # Получаем сервис БД из bot_data
            db_service = context.application.bot_data.get('db_service')
            if not db_service:
                logger.error("DatabaseService не найден в bot_data")
                await update.message.reply_text(
                    "❌ Ошибка системы. Попробуйте позже."
                )
                return
            
            # Сначала проверяем существует ли группа в БД
            group_exists = await db_service.group_exists(group_id)
            
            if not group_exists:
                # Группа не существует в БД - отказываем в регистрации
                await update.message.reply_text(
                    f"❌ *Группа не найдена*\n\n"
                    f"Группа с ID `{group_id}` не существует в системе.\n\n"
                    f"📝 **Возможные причины:**\n"
                    f"• Неправильный ID группы\n"
                    f"• Бот не был добавлен в эту группу\n"
                    f"• Группа была удалена из системы\n\n"
                    f"💡 **Что делать:**\n"
                    f"• Проверьте правильность ID группы\n"
                    f"• Обратитесь к администратору группы\n"
                    f"• Убедитесь, что бот добавлен в группу",
                    parse_mode='Markdown'
                )
                logger.info(f"❌ Пользователь {user.id} попытался зарегистрироваться в несуществующей группе {group_id}")
                return
            
            # ГИБРИДНАЯ ПРОВЕРКА ЧЛЕНСТВА
            # Шаг 1: Проверяем в базе данных
            is_registered = await db_service.is_user_in_group(user.id, group_id)
            
            if is_registered:
                # Получаем информацию о группе и роли пользователя
                group_info = await db_service.get_group_info(group_id)
                user_group_info = await db_service.get_user_group_info(user.id, group_id)
                
                # Определяем тип группы
                group_type = group_info.get('group_type', 'general') if group_info else 'general'
                
                # Определяем роль пользователя
                user_role = user_group_info.get('role', 'member') if user_group_info else 'member'
                is_senior_courier = user_group_info.get('is_senior_courier', False) if user_group_info else False
                
                # Получаем название группы из БД или используем ID как fallback
                group_name = group_info.get('title', f'Группа {group_id}') if group_info else f'Группа {group_id}'
                
                # Генерируем персонализированное сообщение
                welcome_message = get_personalized_welcome_message(
                    group_type=group_type,
                    user_role=user_role,
                    user_name=user.full_name,
                    group_name=group_name,
                    is_senior_courier=is_senior_courier
                )
                
                await update.message.reply_text(
                    welcome_message,
                    parse_mode='Markdown'
                )
                logger.info(f"ℹ️ Пользователь {user.id} ({user.full_name}) уже зарегистрирован в группе {group_id} как {user_role} (тип группы: {group_type})")
                return
            
            # Шаг 2: Если не найден в БД - проверяем через Telegram API
            logger.info(f"🔄 Пользователь {user.id} не найден в БД. Проверяем через Telegram API...")
            
            try:
                # Проверяем статус пользователя в группе через Telegram API
                logger.info(f"🔍 Проверяем членство пользователя {user.id} в группе {group_id} через Telegram API...")
                
                # Для обычных групп (не супергрупп) нужно использовать другой формат ID
                # Сначала пробуем с префиксом -100, если не работает - без него
                telegram_group_id = group_id
                if not group_id.startswith('-100'):
                    # Это обычная группа, добавляем префикс -100
                    telegram_group_id = f"-100{group_id.lstrip('-')}"
                    logger.info(f"🔄 Преобразуем ID обычной группы: {group_id} -> {telegram_group_id}")
                
                try:
                    chat_member = await context.bot.get_chat_member(telegram_group_id, user.id)
                    logger.info(f"✅ Успешно найдена группа с ID {telegram_group_id}")
                except telegram.error.BadRequest as e:
                    if "chat not found" in str(e).lower() and group_id.startswith('-100'):
                        # Если группа с -100 не найдена, пробуем без префикса
                        original_group_id = f"-{group_id[4:]}"  # Убираем -100, оставляем -
                        logger.info(f"🔄 Группа с префиксом -100 не найдена, пробуем без префикса: {group_id} -> {original_group_id}")
                        try:
                            chat_member = await context.bot.get_chat_member(original_group_id, user.id)
                            telegram_group_id = original_group_id
                            logger.info(f"✅ Успешно найдена группа с ID {telegram_group_id}")
                        except telegram.error.BadRequest as e2:
                            logger.error(f"❌ Группа не найдена ни с префиксом -100, ни без него: {e2}")
                            raise e2
                    else:
                        raise e
                logger.info(f"📊 Результат проверки: статус пользователя {user.id} в группе {telegram_group_id} = {chat_member.status}")
                
                # Дополнительно получаем информацию о группе для отладки
                try:
                    chat_info = await context.bot.get_chat(telegram_group_id)
                    logger.info(f"📋 Информация о группе: ID={chat_info.id}, Тип={chat_info.type}, Название={chat_info.title}")
                except Exception as chat_info_error:
                    logger.warning(f"⚠️ Не удалось получить информацию о группе: {chat_info_error}")
                
                if chat_member.status in ['member', 'administrator', 'creator']:
                    logger.info(f"✅ Пользователь {user.id} найден в группе {group_id} через Telegram API со статусом: {chat_member.status}")
                    
                    # Пользователь есть в группе, но не в БД - добавляем его вручную
                    await update.message.reply_text(
                        f"🔄 *Синхронизация данных...*\n\n"
                        f"Вы состоите в группе, но данные устарели.\n"
                        f"Добавляю вас в систему...",
                        parse_mode='Markdown'
                    )
                    
                    try:
                        # Получаем данные о пользователе из chat_member
                        user_photo_url = None
                        try:
                            user_profile_photos = await context.bot.get_user_profile_photos(user.id, limit=1)
                            if user_profile_photos.photos:
                                photo_file = user_profile_photos.photos[0][-1]  # Берем наибольший размер
                                file_info = await context.bot.get_file(photo_file.file_id)
                                user_photo_url = f"/users-photo/user_{user.id}.jpg"
                        except Exception as photo_error:
                            logger.warning(f"Не удалось получить фото пользователя {user.id}: {photo_error}")
                            user_photo_url = None
                        
                        # Создаем информацию о пользователе
                        user_info = {
                            'user_id': user.id,
                            'username': user.username,
                            'first_name': user.first_name or "",
                            'last_name': user.last_name or "",
                            'status': chat_member.status,
                            'joined_date': datetime.now().isoformat(),
                            'is_bot': user.is_bot,
                            'photo_url': user_photo_url
                        }
                        
                        # Добавляем пользователя в БД напрямую
                        await db_service.add_user_to_group(user_info, group_id)
                        
                        # Проверяем что пользователь добавлен
                        is_registered_after_manual_add = await db_service.is_user_in_group(user.id, group_id)
                        
                        if is_registered_after_manual_add:
                            # Получаем информацию о группе и роли пользователя для персонализированного сообщения
                            group_info = await db_service.get_group_info(group_id)
                            user_group_info = await db_service.get_user_group_info(user.id, group_id)
                            
                            # Определяем тип группы и роль пользователя
                            group_type = group_info.get('group_type', 'general') if group_info else 'general'
                            user_role = user_group_info.get('role', 'member') if user_group_info else 'member'
                            is_senior_courier = user_group_info.get('is_senior_courier', False) if user_group_info else False
                            
                            # Получаем название группы из БД или используем ID как fallback
                            group_name = group_info.get('title', f'Группа {group_id}') if group_info else f'Группа {group_id}'
                            
                            # Генерируем персонализированное сообщение о успешной регистрации
                            success_message = get_personalized_welcome_message(
                                group_type=group_type,
                                user_role=user_role,
                                user_name=user.full_name,
                                group_name=group_name,
                                is_senior_courier=is_senior_courier
                            )
                            
                            # Заменяем начало сообщения на "Регистрация успешна"
                            success_message = success_message.replace("ℹ️ *Вы уже зарегистрированы!*", "✅ *Регистрация успешна!*")
                            
                            await update.message.reply_text(
                                success_message,
                                parse_mode='Markdown'
                            )
                            logger.info(f"✅ Пользователь {user.id} успешно зарегистрирован в группе {group_id} как {user_role} (тип группы: {group_type})")
                            return
                        else:
                            await update.message.reply_text(
                                f"⚠️ *Ошибка регистрации*\n\n"
                                f"Не удалось завершить регистрацию.\n"
                                f"Обратитесь к администратору группы.",
                                parse_mode='Markdown'
                            )
                            return
                            
                    except Exception as add_error:
                        logger.error(f"❌ Ошибка при добавлении пользователя {user.id} в группу {group_id}: {add_error}")
                        await update.message.reply_text(
                            f"⚠️ *Ошибка регистрации*\n\n"
                            f"Произошла ошибка при добавлении в систему.\n"
                            f"Попробуйте позже или обратитесь к администратору.",
                            parse_mode='Markdown'
                        )
                        return
                        
                else:
                    # Пользователь не состоит в группе или заблокирован
                    logger.info(f"❌ Пользователь {user.id} не состоит в группе {telegram_group_id}. Статус: {chat_member.status}")
                    logger.warning(f"⚠️ Возможные причины: пользователь заблокирован, покинул группу, или бот не имеет прав для проверки")
                    await update.message.reply_text(
                        f"❌ *Регистрация не удалась*\n\n"
                        f"Вы не состоите в группе с ID `{group_id}`\n\n"
                        f"📝 **Что делать:**\n"
                        f"• Обратитесь к администратору группы\n"
                        f"• Убедитесь, что вы добавлены в нужную группу\n"
                        f"• Проверьте правильность ID группы\n\n"
                        f"💡 **Подсказка:** Только участники группы могут зарегистрироваться в боте\n\n"
                        f"🔒 **Безопасность:** Группы создаются только администраторами",
                        parse_mode='Markdown'
                    )
                    logger.info(f"❌ Пользователь {user.id} не состоит в группе {group_id}, регистрация отклонена")
                    return
                    
            except telegram.error.BadRequest as e:
                logger.error(f"❌ BadRequest при проверке пользователя {user.id} в группе {telegram_group_id}: {e}")
                if "user not found" in str(e).lower() or "chat not found" in str(e).lower():
                    logger.info(f"❌ Пользователь {user.id} не найден в группе {telegram_group_id}: {e}")
                    await update.message.reply_text(
                        f"❌ *Регистрация не удалась*\n\n"
                        f"Вы не состоите в группе с ID `{group_id}`\n\n"
                        f"📝 **Что делать:**\n"
                        f"• Обратитесь к администратору группы\n"
                        f"• Убедитесь, что вы добавлены в нужную группу\n"
                        f"• Проверьте правильность ID группы\n\n"
                        f"💡 **Подсказка:** Только участники группы могут зарегистрироваться в боте\n\n"
                        f"🔒 **Безопасность:** Группы создаются только администраторами",
                        parse_mode='Markdown'
                    )
                    return
                else:
                    # Другая ошибка API
                    logger.error(f"❌ Ошибка Telegram API при проверке пользователя {user.id} в группе {telegram_group_id}: {e}")
                    await update.message.reply_text(
                        f"⚠️ *Ошибка проверки*\n\n"
                        f"Не удалось проверить ваш статус в группе.\n"
                        f"Попробуйте позже или обратитесь к администратору.\n\n"
                        f"Техническая информация: {str(e)}",
                        parse_mode='Markdown'
                    )
                    return
                    
            except Exception as e:
                logger.error(f"❌ Неожиданная ошибка при проверке пользователя {user.id} в группе {telegram_group_id}: {e}")
                await update.message.reply_text(
                    f"⚠️ *Системная ошибка*\n\n"
                    f"Произошла неожиданная ошибка при проверке.\n"
                    f"Попробуйте позже или обратитесь к администратору.",
                    parse_mode='Markdown'
                )
                return
            
            # Обычный /start без параметров - показываем приветствие
            # (код ниже продолжается)
        
        else:
            logger.error(f"❌ Неизвестный BOT_TYPE: {bot_type}")
            await update.message.reply_text(
                "❌ Ошибка конфигурации бота. Обратитесь к администратору."
            )
            return

        # Персонализированное приветствие на основе групп пользователя (только для ботов компаний)
        db_service = context.application.bot_data.get('db_service')
        if not db_service:
            logger.error("DatabaseService не найден в bot_data")
            await update.message.reply_text(
                f"Привет, {user.first_name}! 👋\n\n"
                f"Это бот для управления инвентарем и заявками на списание.\n\n"
                f"❌ Ошибка системы. Попробуйте позже."
            )
            return

        # Получаем все группы пользователя
        try:
            user_groups = await db_service.get_user_groups(user.id)
            logger.info(f"Найдено групп для пользователя {user.id}: {len(user_groups) if user_groups else 0}")
            
            if not user_groups:
                # Пользователь не состоит ни в одной группе
                await update.message.reply_text(
                    f"Привет, {user.first_name}! 👋\n\n"
                    f"🤖 Это бот для управления инвентарем, заявками на списание, управления сменами курьеров и другими задачами.\n\n"
                    f"⚠️ **Вы не зарегистрированы ни в одной группе в системе.**\n\n"
                    f"📞 **Для регистрации обратитесь к своему руководителю:**\n"
                    f"• Старшему повару (для кухни)\n"
                    f"• Старшему курьеру (для доставки)\n"
                    f"• Администратору вашего подразделения\n\n",
                    parse_mode='Markdown'
                )
                logger.info(f"Отправлено сообщение о незарегистрированности пользователю {user.id}")
                return
            
            # Формируем персонализированные сообщения для каждой группы
            welcome_messages = []
            
            for group_info in user_groups:
                try:
                    group_id = group_info.get('chat_id', 'unknown')
                    group_name = group_info.get('title', f'Группа {group_id}')
                    
                    # Получаем детальную информацию о пользователе в группе
                    user_group_info = await db_service.get_user_group_info(user.id, group_id)
                    if not user_group_info:
                        continue
                    
                    # Определяем тип группы и роль пользователя
                    group_type = group_info.get('group_type', 'general')
                    user_role = user_group_info.get('role', 'member')
                    is_senior_courier = user_group_info.get('is_senior_courier', False)
                    
                    # Генерируем персонализированное сообщение
                    personalized_message = get_personalized_welcome_message(
                        group_type=group_type,
                        user_role=user_role, 
                        user_name=user.full_name,
                        group_name=group_name,
                        is_senior_courier=is_senior_courier
                    )
                    
                    welcome_messages.append(personalized_message)
                    logger.info(f"Сгенерировано приветствие для группы '{group_name}' (тип: {group_type}, роль: {user_role})")
                    
                except Exception as group_error:
                    logger.error(f"Ошибка при обработке группы {group_info}: {group_error}")
                    continue
            
            if welcome_messages:
                # Объединяем все сообщения
                if len(welcome_messages) == 1:
                    # Одна группа - отправляем как есть
                    final_message = welcome_messages[0]
                else:
                    # Несколько групп - добавляем разделители
                    final_message = f"Привет, {user.first_name}! 👋\n\n"
                    final_message += f"📊 **Вы зарегистрированы в {len(welcome_messages)} группах:**\n\n"
                    
                    # Добавляем разделители между сообщениями
                    separator = "\n\n" + "="*40 + "\n\n"
                    final_message += separator.join(welcome_messages)
                
                await update.message.reply_text(
                    final_message,
                    parse_mode='Markdown'
                )
                logger.info(f"Отправлено персонализированное приветствие пользователю {user.id} для {len(welcome_messages)} групп")
            else:
                # Не удалось обработать ни одну группу
                await update.message.reply_text(
                    f"Привет, {user.first_name}! 👋\n\n"
                    f"🤖 Это бот для управления инвентарем и заявками на списание.\n\n"
                    f"⚠️ **Ошибка при загрузке данных ваших групп.**\n\n"
                    f"Попробуйте позже или обратитесь к администратору.",
                    parse_mode='Markdown'
                )
                logger.warning(f"Не удалось обработать ни одну группу для пользователя {user.id}")
                
        except Exception as groups_error:
            logger.error(f"Ошибка при получении групп пользователя {user.id}: {groups_error}")
            # Fallback к стандартному сообщению
            await update.message.reply_text(
                f"Привет, {user.first_name}! 👋\n\n"
                f"🤖 Это бот для управления инвентарем и заявками на списание.\n\n"
                f"❌ Не удалось загрузить информацию о ваших группах.\n\n"
                f"💡 **Попробуйте:**\n"
                f"• Воспользоваться ссылкой-приглашением\n"
                f"• Использовать команду /registry с ID группы\n"
                f"• Обратиться к администратору",
                parse_mode='Markdown'
            )

    except Exception as e:
        logger.error(f"❌ Ошибка в обработчике /start: {e}")
        logger.error(traceback.format_exc())
        
        if update.effective_message:
            await update.effective_message.reply_text(
                "❌ Произошла системная ошибка. Попробуйте позже."
        )


async def handle_auth_via_command_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик callback для авторизации через команду"""
    try:
        query = update.callback_query
        if not query:
            return
        
        await query.answer()
        
        if query.data == "auth_via_command":
            user = query.from_user
            config = Config()
            
            # Проверяем, что это основной бот
            if config.BOT_TYPE != 'main':
                await query.message.reply_text(
                    "❌ Этот обработчик доступен только в основном боте приложения."
                )
                return
            
            # Получаем сервис БД
            db_service = context.application.bot_data.get('db_service')
            if not db_service:
                await query.message.reply_text(
                    "❌ Ошибка системы. Попробуйте позже."
                )
                return
            
            # Проверяем, что пользователь существует в БД
            user_groups = await db_service.get_user_groups(user.id)
            if not user_groups:
                await query.message.reply_text(
                    f"❌ *Авторизация недоступна*\n\n"
                    f"Вы не зарегистрированы ни в одной группе в системе.\n\n"
                    f"📞 **Для регистрации обратитесь к своему руководителю.**",
                    parse_mode='Markdown'
                )
                return
            
            # Инструкция по авторизации
            await query.message.reply_text(
                f"🔐 *Авторизация через команду*\n\n"
                f"Для авторизации в приложении используйте команду:\n\n"
                f"`/start auth`\n\n"
                f"После выполнения команды откройте приложение в браузере и авторизуйтесь через Telegram.",
                parse_mode='Markdown'
            )
            
    except Exception as e:
        logger.error(f"Ошибка при обработке callback авторизации: {e}", exc_info=True)
        if update.callback_query:
            await update.callback_query.answer("Произошла ошибка. Попробуйте позже.")


async def handle_all_callbacks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик всех callback-запросов для отладки (перехватывает ВСЕ колбэки)"""
    try:
        if not update.callback_query:
            return # Не колбэк

        query = update.callback_query
        logger.debug(f"=== Перехвачен ЛЮБОЙ callback-запрос ===")
        logger.debug(f"Данные callback: {query.data}")
        logger.debug(f"От пользователя: {query.from_user.username} ({query.from_user.id})")
        logger.debug(f"В чате: {query.message.chat.title} ({query.message.chat_id})")

        # НЕ отвечаем здесь query.answer(), чтобы дать сработать другим обработчикам
        # await query.answer()

        # Просто логируем, основная работа в handle_deletion_callback
        if query.data and (query.data.startswith('confirm_del_') or query.data.startswith('reject_del_')):
            logger.debug("Это запрос на удаление, будет обработан handle_deletion_callback")
            # Не вызываем здесь handle_deletion_callback, т.к. он уже зарегистрирован отдельно
        else:
            logger.debug("Это НЕ запрос на удаление")

    except Exception as e:
        logger.error(f"Ошибка при общей обработке callback (handle_all_callbacks): {str(e)}")
        # Не отвечаем на колбэк здесь, чтобы не мешать другим обработчикам 


async def handle_registry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обработчик команды /registry для регистрации пользователей в системе.
    
    Логика:
    1. Проверяет есть ли пользователь в группе через БД
    2. Если нет - проверяет через Telegram API
    3. Если есть в API но нет в БД - синхронизирует данные
    4. Если нет нигде - показывает ошибку
    """
    try:
        user = update.effective_user
        message = update.effective_message
        
        if not user:
            logger.warning("Команда /registry вызвана без пользователя")
            return
            
        logger.info(f"🔐 Пользователь {user.full_name} (@{user.username}) запросил регистрацию")
        
        # Получаем параметры команды
        args = context.args
        if not args:
            await message.reply_text(
                "❌ Укажите ID группы для регистрации!\n\n"
                "Пример: /registry -1004984919338\n\n"
                "Или используйте ссылку регистрации из чата для автоматической регистрации."
            )
            return
            
        target_group_id = args[0]
        logger.info(f"Пользователь {user.id} запросил регистрацию в группе: {target_group_id}")
        
        # Валидируем ID группы
        try:
            group_id_int = int(target_group_id)
            if group_id_int >= 0:
                await message.reply_text(
                    "❌ Некорректный ID группы!\n\n"
                    "ID группы должен быть отрицательным числом."
                )
                return
        except ValueError:
            await message.reply_text(
                "❌ Некорректный формат ID группы!\n\n"
                "Пример: /registry -1004984919338"
            )
            return
            
        # Получаем сервис БД из bot_data
        db_service = context.application.bot_data.get('db_service')
        if not db_service:
            logger.error("DatabaseService не найден в bot_data")
            await message.reply_text(
                "❌ Ошибка системы. Попробуйте позже."
            )
            return
            
        # Сначала проверяем существует ли группа в БД
        group_exists = await db_service.group_exists(target_group_id)
        
        if not group_exists:
            # Группа не существует в БД - отказываем в регистрации
            await message.reply_text(
                f"❌ *Группа не найдена*\n\n"
                f"Группа с ID `{target_group_id}` не существует в системе.\n\n"
                f"📝 **Возможные причины:**\n"
                f"• Неправильный ID группы\n"
                f"• Бот не был добавлен в эту группу\n"
                f"• Группа была удалена из системы\n\n"
                f"💡 **Что делать:**\n"
                f"• Проверьте правильность ID группы\n"
                f"• Обратитесь к администратору группы\n"
                f"• Убедитесь, что бот добавлен в группу",
                parse_mode='Markdown'
            )
            logger.info(f"❌ Пользователь {user.id} попытался зарегистрироваться в несуществующей группе {target_group_id}")
            return
        
        # ГИБРИДНАЯ ПРОВЕРКА ЧЛЕНСТВА
        # Шаг 1: Проверяем в базе данных
        is_registered = await db_service.is_user_in_group(user.id, target_group_id)
        
        if is_registered:
            # Пользователь уже зарегистрирован в боте
            await message.reply_text(
                f"ℹ️ *Вы уже зарегистрированы!*\n\n"
                f"🎯 **Группа:** `{target_group_id}`\n"
                f"👤 **Пользователь:** {user.full_name}\n"
                f"📱 **Username:** @{user.username or 'не указан'}\n\n"
                f"🚀 **Доступные функции:**\n"
                f"• 📦 Управление инвентарем\n"
                f"• 📋 Управление списаниями\n"
                f"Вы можете продолжать использовать все функции бота!",
                parse_mode='Markdown'
            )
            logger.info(f"ℹ️ Пользователь {user.id} ({user.full_name}) уже зарегистрирован в группе {target_group_id}")
            return
            
        # Шаг 2: Если не найден в БД - проверяем через Telegram API
        logger.info(f"🔄 Пользователь {user.id} не найден в БД. Проверяем через Telegram API...")
        
        try:
            # Проверяем статус пользователя в группе через Telegram API
            chat_member = await context.bot.get_chat_member(target_group_id, user.id)
            
            if chat_member.status in ['member', 'administrator', 'creator']:
                logger.info(f"✅ Пользователь {user.id} найден в группе {target_group_id} через Telegram API со статусом: {chat_member.status}")
                
                # Пользователь есть в группе, но не в БД - добавляем его вручную
                await message.reply_text(
                    f"🔄 *Синхронизация данных...*\n\n"
                    f"Вы состоите в группе, но данные устарели.\n"
                    f"Добавляю вас в систему...",
                    parse_mode='Markdown'
                )
                
                try:
                    # Получаем данные о пользователе из chat_member
                    user_photo_url = None
                    try:
                        user_profile_photos = await context.bot.get_user_profile_photos(user.id, limit=1)
                        if user_profile_photos.photos:
                            photo_file = user_profile_photos.photos[0][-1]  # Берем наибольший размер
                            file_info = await context.bot.get_file(photo_file.file_id)
                            user_photo_url = f"/users-photo/user_{user.id}.jpg"
                    except Exception as photo_error:
                        logger.warning(f"Не удалось получить фото пользователя {user.id}: {photo_error}")
                        user_photo_url = None
                    
                    # Создаем информацию о пользователе
                    user_info = {
                        'user_id': user.id,
                        'username': user.username,
                        'first_name': user.first_name or "",
                        'last_name': user.last_name or "",
                        'status': chat_member.status,
                        'joined_date': datetime.now().isoformat(),
                        'is_bot': user.is_bot,
                        'photo_url': user_photo_url
                    }
                    
                    # Добавляем пользователя в БД напрямую
                    await db_service.add_user_to_group(user_info, target_group_id)
                    
                    # Проверяем что пользователь добавлен
                    is_registered_after_manual_add = await db_service.is_user_in_group(user.id, target_group_id)
                    
                    if is_registered_after_manual_add:
                        await message.reply_text(
                            f"✅ *Регистрация успешна!*\n\n"
                            f"🎯 **Группа:** `{target_group_id}`\n"
                            f"👤 **Пользователь:** {user.full_name}\n"
                            f"📱 **Username:** @{user.username or 'не указан'}\n\n"
                            f"🚀 **Доступные функции:**\n"
                            f"• 📦 Управление инвентарем\n"
                            f"• 📋 Управление списаниями\n"
                            f"Теперь вы можете использовать все функции бота!",
                            parse_mode='Markdown'
                        )
                        logger.info(f"✅ Пользователь {user.id} успешно зарегистрирован вручную")
                        return
                    else:
                        await message.reply_text(
                            f"⚠️ *Ошибка регистрации*\n\n"
                            f"Не удалось завершить регистрацию.\n"
                            f"Обратитесь к администратору группы.",
                            parse_mode='Markdown'
                        )
                        return
                        
                except Exception as add_error:
                    logger.error(f"❌ Ошибка при добавлении пользователя {user.id} в группу {target_group_id}: {add_error}")
                    await message.reply_text(
                        f"⚠️ *Ошибка регистрации*\n\n"
                        f"Произошла ошибка при добавлении в систему.\n"
                        f"Попробуйте позже или обратитесь к администратору.",
                        parse_mode='Markdown'
                    )
                    return
                    
            else:
                # Пользователь не состоит в группе или заблокирован
                logger.info(f"❌ Пользователь {user.id} не состоит в группе {target_group_id}. Статус: {chat_member.status}")
                await message.reply_text(
                    f"❌ *Регистрация не удалась*\n\n"
                    f"Вы не состоите в группе с ID `{target_group_id}`\n\n"
                    f"📝 **Что делать:**\n"
                    f"• Обратитесь к администратору группы\n"
                    f"• Убедитесь, что вы добавлены в нужную группу\n"
                    f"• Проверьте правильность ID группы\n\n"
                    f"💡 **Подсказка:** Только участники группы могут зарегистрироваться в боте\n\n"
                    f"🔒 **Безопасность:** Группы создаются только администраторами",
                    parse_mode='Markdown'
                )
                logger.info(f"❌ Пользователь {user.id} не состоит в группе {target_group_id}, регистрация отклонена")
                return
                
        except telegram.error.BadRequest as e:
            if "user not found" in str(e).lower() or "chat not found" in str(e).lower():
                logger.info(f"❌ Пользователь {user.id} не найден в группе {target_group_id}: {e}")
                await message.reply_text(
                    f"❌ *Регистрация не удалась*\n\n"
                    f"Вы не состоите в группе с ID `{target_group_id}`\n\n"
                    f"📝 **Что делать:**\n"
                    f"• Обратитесь к администратору группы\n"
                    f"• Убедитесь, что вы добавлены в нужную группу\n"
                    f"• Проверьте правильность ID группы\n\n"
                    f"💡 **Подсказка:** Только участники группы могут зарегистрироваться в боте\n\n"
                    f"🔒 **Безопасность:** Группы создаются только администраторами",
                    parse_mode='Markdown'
                )
                return
            else:
                # Другая ошибка API
                logger.error(f"❌ Ошибка Telegram API при проверке пользователя {user.id} в группе {target_group_id}: {e}")
                await message.reply_text(
                    f"⚠️ *Ошибка проверки*\n\n"
                    f"Не удалось проверить ваш статус в группе.\n"
                    f"Попробуйте позже или обратитесь к администратору.\n\n"
                    f"Техническая информация: {str(e)}",
                    parse_mode='Markdown'
                )
                return
                
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка при проверке пользователя {user.id} в группе {target_group_id}: {e}")
            await message.reply_text(
                f"⚠️ *Системная ошибка*\n\n"
                f"Произошла неожиданная ошибка при проверке.\n"
                f"Попробуйте позже или обратитесь к администратору.",
                parse_mode='Markdown'
            )
            return
        
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке команды /registry: {e}")
        logger.error(traceback.format_exc())
        
        if update.effective_message:
            await update.effective_message.reply_text(
                "❌ Произошла ошибка при регистрации. Попробуйте позже."
            )