import logging
import json
import traceback
import os
from datetime import datetime
# import aiohttp # Убедитесь, что aiohttp установлен, если используете handle_deletion_callback
from telegram import Update, Bot, MenuButton, MenuButtonWebApp, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegramNinjaBot.config.config import Config
# Предполагаем, что json_service и deletion_requests будут доступны через context.application.state
# Если нет, их нужно будет передавать иначе или импортировать (менее предпочтительно)

logger = logging.getLogger(__name__)

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

        # Проверяем параметры команды /start
        args = context.args
        logger.info(f"🔍 Параметры команды /start: {args}")
        
        # Если есть параметр registry_ - обрабатываем регистрацию
        if args and args[0].startswith('registry_'):
            registry_param = args[0]
            group_id = registry_param.replace('registry_', '')
            
            logger.info(f"🔐 Пользователь {user.id} перешел по ссылке регистрации в группу {group_id}")
            
            # Валидируем ID группы
            try:
                group_id_int = int(group_id)
                if group_id_int >= 0:
                    await update.message.reply_text(
                        f"❌ *Ошибка регистрации*\n\n"
                        f"Некорректный ID группы в ссылке.\n\n"
                        f"Обратитесь к администратору за новой ссылкой регистрации.",
                        parse_mode='Markdown'
                    )
                    return
            except ValueError:
                await update.message.reply_text(
                    f"❌ *Ошибка регистрации*\n\n"
                    f"Некорректный формат ID группы в ссылке.\n\n"
                    f"Обратитесь к администратору за новой ссылкой регистрации.",
                    parse_mode='Markdown'
                )
                return
            
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
            
            # Проверяем зарегистрирован ли пользователь уже в боте
            is_registered = await db_service.is_user_in_group(user.id, group_id)
            
            if is_registered:
                # Пользователь уже зарегистрирован в боте
                await update.message.reply_text(
                    f"ℹ️ *Вы уже зарегистрированы!*\n\n"
                    f"🎯 **Группа:** `{group_id}`\n"
                    f"👤 **Пользователь:** {user.full_name}\n"
                    f"📱 **Username:** @{user.username or 'не указан'}\n\n"
                    f"🚀 **Доступные функции:**\n"
                    f"• 📦 Управление инвентарем\n"
                    f"• 📋 Заявки на списание\n"
                    f"• 📊 Отчеты и аналитика\n"
                    f"• ⚡ Уведомления в реальном времени\n\n"
                    f"Вы можете продолжать использовать все функции бота!",
                    parse_mode='Markdown'
                )
                logger.info(f"ℹ️ Пользователь {user.id} ({user.full_name}) уже зарегистрирован в группе {group_id}")
                return
            
            # Пользователь НЕ состоит в группе - отказываем в регистрации
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

        # Обычное приветствие без параметров
        await update.message.reply_text(
            f"Привет, {user.first_name}! 👋\n\n"
            f"Это бот для управления инвентарем и заявками на списание.\n\n"
            f"Если у вас есть ссылка-приглашение, используйте её для регистрации.\n"
            f"Или воспользуйтесь командой /registry с ID группы."
        )
        logger.info(f"Отправлено приветствие пользователю {user.id}")

    except Exception as e:
        logger.error(f"Ошибка при обработке команды /start: {str(e)}")
        logger.error(traceback.format_exc())
        await update.message.reply_text(
            "Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже."
        )


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
    2. Если нет - показывает ошибку с просьбой обратиться к админу
    3. Если есть - регистрирует в БД или уведомляет об успешной регистрации
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
        
        # Проверяем зарегистрирован ли пользователь уже в боте
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
                f"• 📋 Заявки на списание\n"
                f"• 📊 Отчеты и аналитика\n"
                f"• ⚡ Уведомления в реальном времени\n\n"
                f"Вы можете продолжать использовать все функции бота!",
                parse_mode='Markdown'
            )
            logger.info(f"ℹ️ Пользователь {user.id} ({user.full_name}) уже зарегистрирован в группе {target_group_id}")
            return
            
        # Пользователь НЕ состоит в группе - отказываем в регистрации
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
        
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке команды /registry: {e}")
        logger.error(traceback.format_exc())
        
        if update.effective_message:
            await update.effective_message.reply_text(
                "❌ Произошла ошибка при регистрации. Попробуйте позже."
            )