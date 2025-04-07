from telegram.ext import Application, MessageHandler, filters, ChatMemberHandler, CommandHandler, CallbackQueryHandler
import asyncio
import logging
from telegramNinjaBot.config.config import Config
from telegramNinjaBot.services.json_service import JsonService
from telegramNinjaBot.services.courier_group_service import CourierGroupService
from telegramNinjaBot.services.database_service import DatabaseService
from telegramNinjaBot.services.group_service_adapter import GroupServiceAdapter
from telegramNinjaBot.handlers.group_handlers import GroupHandler
from telegramNinjaBot.handlers.message_handlers import MessageHandler as BotMessageHandler
from telegram.constants import ChatMemberStatus
from telegram import Update, Bot, MenuButton, MenuButtonWebApp, WebAppInfo
from telegram.ext import ContextTypes
import json
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import traceback
import os
import pickle
from datetime import datetime
# import requests # Не используется напрямую здесь
# import fcntl # Убираем fcntl
import sys
# from flask import Flask, request, jsonify, send_file, Response # Убираем Flask импорт
# from io import BytesIO # Не используется напрямую здесь
# import threading # Убираем threading
# from hypercorn.config import Config as HyperConfig # Убираем Hypercorn
# from hypercorn.asyncio import serve # Убираем импорт Hypercorn serve
# import aiohttp # Убираем неиспользуемый aiohttp
from fastapi import FastAPI, Request, HTTPException
from contextlib import asynccontextmanager
import uvicorn
from pydantic import BaseModel

# Определяем текущее окружение
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

# Настраиваем базовое логирование на уровне ERROR для всех окружений
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Отключаем все лишние логи
logging.getLogger('httpx').setLevel(logging.ERROR)
logging.getLogger('telegram.ext.Application').setLevel(logging.ERROR)
logging.getLogger('apscheduler').setLevel(logging.ERROR)
logging.getLogger('asyncio').setLevel(logging.ERROR)
logging.getLogger('telegram').setLevel(logging.ERROR)

# Инициализируем логгер
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logger.info(f"Бот запущен в окружении: {ENVIRONMENT}")

# Глобальные переменные для хранения экземпляров
bot_application = None
group_handler = None
json_service = None
courier_service = None
db_service = None
group_service = None  # Новый адаптер для работы с группами
deletion_requests = {}  # Добавляем словарь для хранения запросов на удаление

# Путь к файлу для сохранения экземпляра бота
SHARED_DIR = '/app/shared'
BOT_INSTANCE_PATH = os.path.join(SHARED_DIR, 'bot_instance.pkl')
LOCK_FILE = os.path.join(SHARED_DIR, 'bot.lock')

def acquire_lock():
    """Попытка получить блокировку"""
    try:
        # Создаем директорию, если её нет
        os.makedirs(SHARED_DIR, exist_ok=True)
        
        # Открываем файл блокировки
        lock_fd = open(LOCK_FILE, 'w')
        
        # Пытаемся получить эксклюзивную блокировку
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        
        # Сохраняем файловый дескриптор
        return lock_fd
    except (IOError, OSError) as e:
        logger.error(f"Не удалось получить блокировку: {e}")
        return None

def release_lock(lock_fd):
    """Освобождение блокировки"""
    try:
        if lock_fd:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            lock_fd.close()
    except Exception as e:
        logger.error(f"Ошибка при освобождении блокировки: {e}")

def save_bot_instance():
    """Сохраняет экземпляр бота в общей директории"""
    try:
        os.makedirs(SHARED_DIR, exist_ok=True)
        with open(BOT_INSTANCE_PATH, 'wb') as f:
            pickle.dump({
                'token': bot_application.bot.token,
                'initialized': True
            }, f)
        logger.info("Экземпляр бота успешно сохранен")
    except Exception as e:
        logger.error(f"Ошибка при сохранении экземпляра бота: {e}")

def load_bot_data(filename):
    """Загрузка данных из JSON файла"""
    try:
        return json_service.load_from_json(filename)
    except Exception as e:
        logger.error(f"Ошибка при загрузке {filename}: {e}")
        return {}

async def send_love(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды для отправки любовных сообщений"""
    try:
        # Получаем ID пользователя из аргументов команды
        args = context.args
        if not args:
            await update.message.reply_text("Укажите ID пользователя!")
            return

        user_id = int(args[0])
        count = int(args[1]) if len(args) > 1 else 100
        
        # Отправляем сообщения
        await group_handler.send_love_messages(context.bot, user_id, count)
        await update.message.reply_text(f"Отправлено {count} сообщений пользователю {user_id}!")
        
    except ValueError:
        await update.message.reply_text("Неверный формат аргументов!")
    except Exception as e:
        logger.error(f"Ошибка при отправке сообщений: {e}", exc_info=True)
        await update.message.reply_text("Произошла ошибка при отправке сообщений.")

async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик данных от веб-приложения"""
    try:
        # Проверяем наличие сообщения
        if not update.effective_message:
            logger.warning("Нет effective_message в обновлении")
            return

        # Проверяем наличие web_app_data
        if not hasattr(update.effective_message, 'web_app_data') or not update.effective_message.web_app_data:
            logger.warning("Нет web_app_data в сообщении")
            return

        # Проверяем наличие данных
        data_str = update.effective_message.web_app_data.data
        if not data_str:
            logger.warning("Пустые данные в web_app_data")
            return

        logger.info(f"Получены сырые данные: {data_str}")
        
        try:
            data = json.loads(data_str)
            logger.info(f"Распарсенные данные: {data}")
            
            if data.get('action') == 'open_user_profile':
                user_id = data.get('user_id')
                first_name = data.get('first_name', 'Пользователь')
                logger.info(f"Попытка открыть профиль пользователя {first_name} (ID: {user_id})")
                
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
                    logger.info("Сообщение с кнопкой успешно отправлено")
                else:
                    logger.error("Не указан user_id в данных")
            else:
                logger.warning(f"Неизвестное действие: {data.get('action')}")
        except json.JSONDecodeError as e:
            logger.error(f"Ошибка парсинга JSON: {e}")
            return
            
    except Exception as e:
        logger.error(f"Ошибка при обработке данных веб-приложения: {e}", exc_info=True)

async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    try:
        user = update.effective_user
        logger.info(f"Пользователь {user.full_name} ({user.id}) запустил команду /start")

        # Создаем кнопку с веб-приложением
        web_app_url = Config().WEB_APP_URL # Получаем URL из конфига
        if not web_app_url:
            logger.error("Не задан URL веб-приложения в конфигурации (WEB_APP_URL)")
            await update.message.reply_text(
                "К сожалению, веб-приложение сейчас недоступно."
            )
            return

        web_app_info = WebAppInfo(url=web_app_url)
        button = InlineKeyboardButton(text="Открыть приложение", web_app=web_app_info)
        keyboard = InlineKeyboardMarkup([[button]])

        # Отправляем приветственное сообщение и кнопку
        await update.message.reply_text(
            f"Привет, {user.first_name}! 👋\n\n"
            "Я бот AppNinja, помогу тебе с инвентаризацией и не только!\n"
            "Нажми кнопку ниже, чтобы открыть приложение:",
            reply_markup=keyboard
        )
        logger.info(f"Отправлено приветствие и кнопка WebApp пользователю {user.id}")

        # Устанавливаем кнопку меню
        await context.bot.set_chat_menu_button(
            chat_id=update.effective_chat.id,
            menu_button=MenuButtonWebApp(text="Открыть приложение", web_app=web_app_info)
        )
        logger.info(f"Установлена кнопка меню для чата {update.effective_chat.id}")

    except Exception as e:
        logger.error(f"Ошибка при обработке команды /start: {str(e)}")
        logger.error(traceback.format_exc())
        await update.message.reply_text(
            "Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже."
        )

async def broadcast_item_deletion(data):
    """Рассылка уведомления о запросе на удаление товара"""
    logger.info("=== Начало рассылки уведомления об удалении товара ===")
    logger.info(f"Филиал: {data['branch_name']}, Категория: {data['category']}, Товар: {data['item']}")
    
    # Клавиатура для других филиалов
    keyboard = [
        [
            InlineKeyboardButton("✅ Подтвердить", callback_data=f"confirm_del_{data['deletion_id']}"),
            InlineKeyboardButton("❌ Отклонить", callback_data=f"reject_del_{data['deletion_id']}")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Сообщение для других филиалов
    message_text = (
        "❗️ Запрос на удаление товара\n\n"
        f"Филиал '{data['branch_name']}' предлагает удалить товар:\n"
        f"Категория: {data['category']}\n"
        f"Товар: {data['item']}\n\n"
        "Пожалуйста, подтвердите или отклоните удаление.\n"
        "Товар будет удален из шаблона только если все филиалы подтвердят удаление."
    )
    
    # Сообщение для инициатора
    initiator_message = (
        "📤 Запрос на удаление товара\n\n"
        f"Категория: {data['category']}\n"
        f"Товар: {data['item']}\n\n"
        "Статус подтверждений:\n"
    )
    
    try:
        # Получаем список всех чатов
        members_data = json_service.load_from_json('members.json')
        
        success_count = 0
        failed_count = 0
        initiator_message_id = None
        
        # Собираем список других чатов и добавляем их статусы в сообщение
        other_chats = []
        for chat_id, chat_data in members_data.items():
            if chat_id != data['chat_id']:
                chat_title = chat_data.get('chat_title', f'Чат {chat_id}')
                other_chats.append({
                    'id': chat_id,
                    'title': chat_title
                })
                # Добавляем статус в сообщение инициатора
                initiator_message += f"\n⏳ {chat_title}"
        
        # Создаем новый клиент для каждого запроса
        async with Bot(token=bot_application.bot.token) as temp_bot:
            # Отправляем сообщение инициатору
            initiator_chat_id = str(data['chat_id'])
            chat_id_formats = []
            
            if initiator_chat_id.startswith('-'):
                if initiator_chat_id.startswith('-100'):
                    chat_id_formats = [initiator_chat_id, f"-{initiator_chat_id[4:]}"]
                else:
                    chat_id_formats = [initiator_chat_id, f"-100{initiator_chat_id[1:]}"]
            else:
                chat_id_formats = [f"-{initiator_chat_id}", f"-100{initiator_chat_id}"]
            
            # Проверяем, есть ли уже сообщение с этим deletion_id
            existing_request = deletion_requests.get(data['deletion_id'])
            if existing_request and existing_request.get('initiator_message_id'):
                # Если есть существующее сообщение, обновляем его
                existing_message_id = existing_request['initiator_message_id']
                success = False
                last_error = None
                
                for format_id in chat_id_formats:
                    try:
                        await temp_bot.edit_message_text(
                            chat_id=format_id,
                            message_id=existing_message_id,
                            text=initiator_message,
                            reply_markup=None
                        )
                        initiator_message_id = existing_message_id
                        logger.info(f"✅ Обновлено существующее сообщение инициатора {data['chat_id']} (формат ID: {format_id})")
                        success = True
                        break
                    except Exception as e:
                        last_error = e
                        logger.error(f"❌ Ошибка при обновлении сообщения с ID {format_id}: {str(e)}")
                
                if not success:
                    logger.error(f"❌ Не удалось обновить существующее сообщение: {str(last_error)}")
            else:
                # Если нет существующего сообщения, отправляем новое
                for format_id in chat_id_formats:
                    try:
                        initiator_msg = await temp_bot.send_message(
                            chat_id=format_id,
                            text=initiator_message,
                            reply_markup=None
                        )
                        initiator_message_id = initiator_msg.message_id
                        logger.info(f"✅ Отправлено новое сообщение инициатору {data['chat_id']} (формат ID: {format_id})")
                        success = True
                        break
                    except Exception as e:
                        last_error = e
                        logger.error(f"❌ Ошибка отправки сообщения с ID {format_id}: {str(e)}")
            
            # Отправляем уведомления другим чатам
            for chat in other_chats:
                try:
                    chat_id_str = str(chat['id'])
                    chat_id_formats = []
                    
                    # Определяем форматы ID для попыток
                    if len(chat_id_str) >= 10:
                        chat_id_formats = [f"-100{chat_id_str}", f"-{chat_id_str}"]
                    else:
                        chat_id_formats = [f"-{chat_id_str}", f"-100{chat_id_str}"]
                        
                    logger.info(f"Отправка в чат {chat['title']} (ID: {chat_id_formats[0]})")
                    
                    sent = False
                    last_error = None
                    
                    for format_id in chat_id_formats:
                        try:
                            await temp_bot.send_message(
                                chat_id=format_id,
                                text=message_text,
                                reply_markup=reply_markup
                            )
                            success_count += 1
                            sent = True
                            logger.info(f"✅ Уведомление отправлено в чат {chat['title']}")
                            break
                        except Exception as e:
                            last_error = e
                            logger.error(f"❌ Ошибка отправки в чат {chat['title']}: {str(e)}")
                    
                    if not sent:
                        failed_count += 1
                        if last_error:
                            logger.error(f"❌ Не удалось отправить сообщение в чат {chat['title']}: {str(last_error)}")
                            
                except Exception as e:
                    failed_count += 1
                    logger.error(f"❌ Ошибка при обработке чата {chat['title']}: {str(e)}")
        
        total_chats = len(other_chats)
        result = {
            'success': True,
            'sent_count': success_count,
            'failed_count': failed_count,
            'total_chats': total_chats,
            'initiator_message_id': initiator_message_id
        }
        logger.info(f"Результаты рассылки: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Ошибка при рассылке уведомления: {str(e)}")
        logger.error(traceback.format_exc())
        raise

async def handle_deletion_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработка ответов на запрос удаления"""
    try:
        if not update.callback_query:
            logger.error("Нет callback_query в update")
            return
            
        query = update.callback_query
        logger.info(f"=== Получен callback запрос ===")
        logger.info(f"Данные callback: {query.data}")
        logger.info(f"От пользователя: {query.from_user.username} ({query.from_user.id})")
        logger.info(f"В чате: {query.message.chat.title} ({query.message.chat_id})")
        
        # Проверяем, что это запрос на удаление
        if not query.data or (not query.data.startswith('confirm_del_') and not query.data.startswith('reject_del_')):
            # Проверяем, не является ли это запросом статуса
            if query.data and query.data.startswith('status_del_'):
                await query.answer("Это информационная кнопка")
                return
                
            logger.info("Это не запрос на удаление, игнорируем")
            await query.answer("Неверный формат запроса")
            return

        # Проверяем, является ли пользователь администратором
        chat_member = await context.bot.get_chat_member(query.message.chat_id, query.from_user.id)
        if chat_member.status not in ['administrator', 'creator']:
            await query.answer("❌ Только администраторы могут подтверждать или отклонять запросы на удаление")
            return
        
        # Сразу отвечаем на callback query
        await query.answer("Обрабатываем ваш ответ...")
        logger.info("Ответили на callback query")
        
        # Получаем действие и ID запроса на удаление
        try:
            action, deletion_id = query.data.split('_del_')
            confirmed = action == 'confirm'
            logger.info(f"Разобрали данные: action={action}, deletion_id={deletion_id}, confirmed={confirmed}")
        except Exception as e:
            logger.error(f"Ошибка при разборе данных callback: {str(e)}")
            await query.edit_message_text(
                text=f"{query.message.text}\n\n❌ Ошибка при обработке запроса",
                reply_markup=None
            )
            return
        
        # Получаем и форматируем ID чата
        chat_id = str(query.message.chat_id)
        original_chat_id = chat_id
        if chat_id.startswith('-'):
            if chat_id.startswith('-100'):
                chat_id = chat_id[4:]  # Убираем '-100' для супергрупп
            else:
                chat_id = chat_id[1:]  # Убираем '-' для обычных групп
        
        # Функция для удаления кнопок
        async def remove_buttons():
            try:
                # Первая попытка: через query.edit_message_reply_markup
                try:
                    await query.edit_message_reply_markup(reply_markup=None)
                    logger.info("✅ Кнопки удалены через query.edit_message_reply_markup")
                    return True
                except Exception as e:
                    logger.error(f"❌ Ошибка при удалении кнопок через query.edit_message_reply_markup: {str(e)}")

                # Вторая попытка: через context.bot.edit_message_reply_markup
                try:
                    await context.bot.edit_message_reply_markup(
                        chat_id=query.message.chat_id,
                        message_id=query.message.message_id,
                        reply_markup=None
                    )
                    logger.info("✅ Кнопки удалены через context.bot.edit_message_reply_markup")
                    return True
                except Exception as e:
                    logger.error(f"❌ Ошибка при удалении кнопок через context.bot.edit_message_reply_markup: {str(e)}")

                # Третья попытка: через новое соединение с ботом
                try:
                    async with Bot(token=context.bot.token) as temp_bot:
                        await temp_bot.edit_message_reply_markup(
                            chat_id=query.message.chat_id,
                            message_id=query.message.message_id,
                            reply_markup=None
                        )
                    logger.info("✅ Кнопки удалены через новое соединение с ботом")
                    return True
                except Exception as e:
                    logger.error(f"❌ Ошибка при удалении кнопок через новое соединение: {str(e)}")

                return False
            except Exception as e:
                logger.error(f"❌ Общая ошибка при попытке удаления кнопок: {str(e)}")
                return False

        # Удаляем кнопки перед любыми другими действиями
        buttons_removed = await remove_buttons()
        if not buttons_removed:
            logger.warning("⚠️ Не удалось удалить кнопки всеми доступными способами")
            
        logger.info(f"=== Обработка подтверждения удаления ===")
        logger.info(f"ID чата (оригинальный): {original_chat_id}")
        logger.info(f"ID чата (форматированный): {chat_id}")
        logger.info(f"ID запроса: {deletion_id}")
        logger.info(f"Действие: {action}")
        logger.info(f"Подтверждено: {confirmed}")
        
        # Отправляем подтверждение на сервер
        try:
            logger.info("Отправляем запрос на сервер...")
            logger.info(f"URL: http://server:8000/api/confirm_deletion")
            logger.info(f"Данные запроса: {{'deletion_id': {deletion_id}, 'chat_id': {chat_id}, 'confirmed': {confirmed}}}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post('http://server:8000/api/confirm_deletion', json={
                    'deletion_id': deletion_id,
                    'chat_id': chat_id,
                    'confirmed': confirmed
                }) as response:
                    logger.info(f"Получен ответ от сервера: {response.status}")
                    
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Ответ сервера (JSON): {result}")
                        
                        # Обновляем текст сообщения
                        try:
                            # Формируем текст сообщения в зависимости от статуса
                            header = query.message.text.split('\n\n')[0]  # Берем заголовок и информацию о товаре
                            if result.get('status') in ['success', 'cancelled']:
                                message_text = (
                                    f"{header}\n\n"
                                    f"{'✅ Товар успешно удален из шаблона' if result.get('status') == 'success' else '❌ Удаление отменено - не все филиалы подтвердили'}"
                                )
                            else:
                                message_text = (
                                    f"{header}\n\n"
                                    f"{'✅ Вы подтвердили' if confirmed else '❌ Вы отклонили'} удаление товара\n"
                                    "Ожидаем ответа других филиалов..."
                                )

                            # Обновляем текст сообщения
                            await query.edit_message_text(
                                text=message_text,
                                reply_markup=None
                            )
                            logger.info("✅ Текст сообщения обновлен")
                        except Exception as e:
                            logger.error(f"❌ Ошибка при обновлении текста сообщения: {str(e)}")
                            # Если не удалось обновить текст, пробуем еще раз удалить кнопки
                            await remove_buttons()
                        
                        # Получаем актуальные данные о запросе с сервера
                        async with session.get(f'http://server:8000/api/deletion_request/{deletion_id}') as del_response:
                            if del_response.status == 200:
                                deletion_data = await del_response.json()
                                
                                # Проверяем статус запроса
                                if deletion_data.get('status') == 'completed':
                                    logger.info("Запрос уже завершен, пропускаем обновление сообщения")
                                    return
                                
                                deletion_requests[deletion_id] = deletion_data
                                
                                # Обновляем статусное сообщение у инициатора
                                try:
                                    initiator_chat_id = deletion_data['data']['chat_id']
                                    initiator_message_id = deletion_data.get('initiator_message_id')
                                    
                                    if not initiator_message_id:
                                        logger.error("❌ Не найден ID сообщения инициатора")
                                        return
                                    
                                    # Получаем все подтверждения
                                    confirmations = deletion_data['confirmations']
                                    
                                    # Проверяем, все ли чаты ответили
                                    members_data = json_service.load_from_json('members.json')
                                    all_chats = set(members_data.keys())
                                    responded_chats = set(confirmations.keys())
                                    all_responded = all_chats == responded_chats
                                    
                                    logger.info(f"=== Проверка статусов ===")
                                    logger.info(f"Все чаты: {all_chats}")
                                    logger.info(f"Ответившие чаты: {responded_chats}")
                                    logger.info(f"Все ответили: {all_responded}")
                                    logger.info(f"Статус результата: {result.get('status')}")
                                    
                                    # Создаем обновленное сообщение для инициатора
                                    status_message = (
                                        "📢 Результат запроса на удаление товара\n\n"
                                        f"Категория: {deletion_data['data']['category']}\n"
                                        f"Товар: {deletion_data['data']['item']}\n\n"
                                    )
                                    
                                    # Формируем статусы для всех чатов
                                    for member_id, member_data in members_data.items():
                                        if member_id != initiator_chat_id:
                                            chat_title = member_data.get('chat_title', f'Чат {member_id}')
                                            status = confirmations.get(member_id)
                                            
                                            if status is None:
                                                status_text = f"⏳ {chat_title}"
                                            elif status:
                                                status_text = f"✅ {chat_title}"
                                            else:
                                                status_text = f"❌ {chat_title}"
                                            
                                            # Добавляем статус в сообщение
                                            status_message += f"\n{status_text}"
                                    
                                    # Добавляем итоговый статус если все ответили или есть финальный статус
                                    if all_responded or result.get('status') in ['success', 'cancelled']:
                                        logger.info("Условие для финального статуса выполнено")
                                        all_confirmed = all(confirmations.values())
                                        
                                        # Отправляем итоговое сообщение во все чаты
                                        final_message = (
                                            "📢 Результат запроса на удаление товара\n\n"
                                            f"Категория: {deletion_data['data']['category']}\n"
                                            f"Товар: {deletion_data['data']['item']}\n\n"
                                        )
                                        
                                        if all_confirmed:
                                            final_message += "✅ Товар успешно удален из шаблона"
                                            status_message += "\n\n✅ Товар успешно удален из шаблона"
                                        else:
                                            final_message += "❌ Удаление отменено - не все филиалы подтвердили"
                                            status_message += "\n\n❌ Удаление отменено - не все филиалы подтвердили"
                                        
                                        # Отправляем сообщение во все чаты и удаляем старые сообщения
                                        for member_id, member_data in members_data.items():
                                            try:
                                                # Определяем форматы ID для попыток
                                                chat_id_formats = []
                                                if str(member_id).startswith('-'):
                                                    if str(member_id).startswith('-100'):
                                                        chat_id_formats = [str(member_id), f"-{str(member_id)[4:]}"]
                                                    else:
                                                        chat_id_formats = [str(member_id), f"-100{str(member_id)[1:]}"]
                                                else:
                                                    chat_id_formats = [f"-{member_id}", f"-100{member_id}"]
                                                
                                                success = False
                                                last_error = None
                                                
                                                # Пробуем каждый формат ID
                                                for formatted_chat_id in chat_id_formats:
                                                    try:
                                                        # Отправляем новое сообщение
                                                        await context.bot.send_message(
                                                            chat_id=formatted_chat_id,
                                                            text=final_message
                                                        )
                                                        logger.info(f"✅ Отправлено итоговое сообщение в чат {member_data['chat_title']}")
                                                        
                                                        # Пытаемся удалить старое сообщение, если это возможно
                                                        if member_id == initiator_chat_id:
                                                            try:
                                                                await context.bot.delete_message(
                                                                    chat_id=formatted_chat_id,
                                                                    message_id=initiator_message_id
                                                                )
                                                                logger.info(f"✅ Удалено старое сообщение в чате {member_data['chat_title']}")
                                                            except Exception as e:
                                                                logger.error(f"❌ Ошибка при удалении сообщения в чате {member_data['chat_title']}: {str(e)}")
                                                                # Если не удалось удалить, пробуем обновить текст
                                                                try:
                                                                    await context.bot.edit_message_text(
                                                                        chat_id=formatted_chat_id,
                                                                        message_id=initiator_message_id,
                                                                        text=final_message
                                                                    )
                                                                    logger.info(f"✅ Обновлен текст старого сообщения в чате {member_data['chat_title']}")
                                                                except Exception as e2:
                                                                    logger.error(f"❌ Ошибка при обновлении текста в чате {member_data['chat_title']}: {str(e2)}")
                                                        
                                                        success = True
                                                        break
                                                    except Exception as e:
                                                        last_error = e
                                                        logger.error(f"❌ Ошибка при использовании формата {formatted_chat_id}: {str(e)}")
                                                        continue
                                                
                                                if not success:
                                                    logger.error(f"❌ Не удалось обработать чат {member_data['chat_title']}: {str(last_error)}")
                                                    
                                            except Exception as e:
                                                logger.error(f"❌ Ошибка при обработке чата {member_data['chat_title']}: {str(e)}")
                                        
                                        # Удаляем запрос из словаря
                                        if deletion_id in deletion_requests:
                                            del deletion_requests[deletion_id]
                                            logger.info(f"✅ Удален запрос {deletion_id} из словаря")
                                    
                                    logger.info(f"Текст сообщения: {status_message}")
                                    
                                    # Обновляем сообщение у инициатора
                                    try:
                                        # Пробуем разные форматы ID чата
                                        chat_id_formats = []
                                        initiator_chat_id = str(initiator_chat_id)
                                        
                                        if initiator_chat_id.startswith('-'):
                                            if initiator_chat_id.startswith('-100'):
                                                chat_id_formats = [initiator_chat_id, f"-{initiator_chat_id[4:]}"]
                                            else:
                                                chat_id_formats = [initiator_chat_id, f"-100{initiator_chat_id[1:]}"]
                                        else:
                                            chat_id_formats = [f"-{initiator_chat_id}", f"-100{initiator_chat_id}"]
                                        
                                        success = False
                                        last_error = None
                                        
                                        for format_id in chat_id_formats:
                                            try:
                                                await context.bot.edit_message_text(
                                                    chat_id=format_id,
                                                    message_id=initiator_message_id,
                                                    text=status_message,
                                                    reply_markup=None
                                                )
                                                logger.info(f"✅ Обновлено статусное сообщение у инициатора (формат ID: {format_id})")
                                                success = True
                                                break
                                            except Exception as e:
                                                last_error = e
                                                logger.error(f"❌ Ошибка при обновлении статусного сообщения с ID {format_id}: {str(e)}")
                                                continue
                                        
                                        if not success:
                                            logger.error(f"❌ Не удалось обновить статусное сообщение всеми способами: {str(last_error)}")
                                    except Exception as e:
                                        logger.error(f"❌ Ошибка при обновлении статусного сообщения: {str(e)}")
                                except Exception as e:
                                    logger.error(f"❌ Ошибка при обновлении статусного сообщения: {str(e)}")
                            else:
                                logger.error(f"Ошибка при получении данных о запросе: {del_response.status}")
                    else:
                        logger.error(f"Ошибка при отправке подтверждения: {response.status}")
                        response_text = await response.text()
                        logger.error(f"Тело ответа: {response_text}")
                        # Пробуем обновить сообщение с ошибкой, но без кнопок
                        await query.edit_message_text(
                            text=f"{query.message.text}\n\n❌ Ошибка при обработке ответа",
                            reply_markup=None
                        )
                
        except Exception as e:
            logger.error(f"Ошибка при отправке подтверждения: {str(e)}")
            logger.error(traceback.format_exc())
            # Пробуем обновить сообщение с ошибкой, но без кнопок
            await query.edit_message_text(
                text=f"{query.message.text}\n\n❌ Ошибка при отправке подтверждения",
                reply_markup=None
            )
            
    except Exception as e:
        logger.error(f"Ошибка при обработке callback: {str(e)}")
        logger.error(traceback.format_exc())
        try:
            await update.callback_query.answer("Произошла ошибка при обработке запроса")
            await update.callback_query.edit_message_text(
                text=f"{update.callback_query.message.text}\n\n❌ Произошла ошибка при обработке",
                reply_markup=None
            )
        except Exception as e2:
            logger.error(f"Ошибка при отправке сообщения об ошибке: {str(e2)}")

async def handle_all_callbacks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик всех callback-запросов для отладки"""
    try:
        if not update.callback_query:
            return
            
        query = update.callback_query
        logger.info("=== Получен любой callback-запрос ===")
        logger.info(f"Данные callback: {query.data}")
        logger.info(f"От пользователя: {query.from_user.username} ({query.from_user.id})")
        logger.info(f"В чате: {query.message.chat.title} ({query.message.chat_id})")
        
        # Отвечаем на callback query в любом случае
        await query.answer()
        
        # Проверяем, что это запрос на удаление
        if query.data and (query.data.startswith('confirm_del_') or query.data.startswith('reject_del_')):
            logger.info("Это запрос на удаление, передаем в handle_deletion_callback")
            await handle_deletion_callback(update, context)
        else:
            logger.info("Это не запрос на удаление")
            
    except Exception as e:
        logger.error(f"Ошибка при обработке callback: {str(e)}")
        logger.error(traceback.format_exc())

async def run_flask():
    """Запуск Flask сервера"""
    config = HyperConfig()
    config.bind = ["0.0.0.0:8001"]
    config.use_reloader = False
    await serve(app, config)

def register_api_endpoints(bot):
    """
    Регистрирует эндпоинты API и делает сервисы доступными для Flask приложения.
    
    Args:
        bot: Экземпляр Telegram бота
    """
    global app, group_service
    
    try:
        logger.info("Регистрация API эндпоинтов и добавление сервисов в контекст Flask")
        
        # Добавляем group_service в контекст Flask приложения 
        app.group_service = group_service
        logger.info(f"✅ Сервис групп добавлен в контекст Flask: {app.group_service.__class__.__name__}")
        
        # Передаем экземпляр бота в приложение Flask
        app.telegram_bot = bot
        
        # Инициализируем обработчик API
        api_handler = ApiHandler(app, bot)
        logger.info("✅ API эндпоинты и сервисы успешно зарегистрированы")

    except Exception as e:
        logger.error(f"❌ Ошибка при регистрации API эндпоинтов: {e}")
        logger.error(traceback.format_exc())

async def run_bot():
    """Асинхронный запуск бота"""
    global bot_application, group_handler, json_service, courier_service, db_service, group_service
    
    # Пытаемся получить блокировку
    lock_fd = acquire_lock()
    if not lock_fd:
        logger.error("Другой экземпляр бота уже запущен")
        sys.exit(1)
    
    try:
        # Инициализация конфигурации и сервисов
        config = Config()
        json_service = JsonService(config.DATA_DIR)
        courier_service = CourierGroupService(config.DATA_DIR)

        use_database = os.getenv('USE_DATABASE', 'false').lower() == 'true'
        logger.info(f"Использование базы данных: {use_database}")

        # Если включено использование базы данных, инициализируем сервис БД
        if use_database:
            try:
                db_service = DatabaseService()
                logger.info(f"Сервис базы данных инициализирован")
            except Exception as e:
                logger.error(f"❌ Ошибка при инициализации сервиса базы данных: {e}")
                logger.error(traceback.format_exc())
                db_service = None
        else:
            db_service = None
        
        # Инициализируем адаптер групп
        group_service = GroupServiceAdapter(courier_service, db_service)
        logger.info(f"Адаптер групп инициализирован")

        # Настраиваем планировщик с явным указанием часового пояса
        scheduler = AsyncIOScheduler(timezone=pytz.UTC)

        # Создаем приложение с базовыми настройками
        bot_application = (
            Application.builder()
            .token(config.TOKEN)
            .connect_timeout(60.0)
            .read_timeout(60.0)
            .write_timeout(60.0)
            .pool_timeout(60.0)
            .get_updates_read_timeout(60.0)
            .get_updates_write_timeout(60.0)
            .get_updates_connection_pool_size(128)
            .connection_pool_size(128)
            .build()
        )

        # Создаем групповой обработчик
        group_handler = GroupHandler(bot_application, json_service)
        
        # Используем новый адаптер групп - ВАЖНО: заменяем courier_service на group_service
        logger.info(f"Перед заменой: group_handler.courier_service = {group_handler.courier_service.__class__.__name__}")
        group_handler.courier_service = group_service
        logger.info(f"После замены: group_handler.courier_service = {group_handler.courier_service.__class__.__name__}")

        # Создаем обработчик сообщений
        message_handler = BotMessageHandler(config.DATA_DIR)

        # Добавляем логирование всех входящих обновлений
        async def log_update(update: Update, context: ContextTypes.DEFAULT_TYPE):
            logger.info("=== Получено новое обновление ===")
            logger.info(f"Тип обновления: {update.update_id}")
            
            if update.callback_query:
                logger.info("Тип: Callback Query")
                logger.info(f"Данные callback: {update.callback_query.data}")
                logger.info(f"От пользователя: {update.callback_query.from_user.username} ({update.callback_query.from_user.id})")
                logger.info(f"В чате: {update.callback_query.message.chat.title} ({update.callback_query.message.chat_id})")
                logger.info(f"Сообщение: {update.callback_query.message.text}")
            elif update.message:
                logger.info("Тип: Message")
                logger.info(f"Текст сообщения: {update.message.text}")
                logger.info(f"От пользователя: {update.message.from_user.username} ({update.message.from_user.id})")
                logger.info(f"В чате: {update.message.chat.title} ({update.message.chat_id})")
                if update.message.new_chat_members:
                    logger.info("Обнаружены новые участники:")
                    for member in update.message.new_chat_members:
                        logger.info(f"- {member.full_name} ({member.id})")
            elif update.my_chat_member:
                logger.info("Тип: My Chat Member Update")
                logger.info(f"Чат: {update.my_chat_member.chat.title} ({update.my_chat_member.chat.id})")
                logger.info(f"Старый статус: {update.my_chat_member.old_chat_member.status}")
                logger.info(f"Новый статус: {update.my_chat_member.new_chat_member.status}")
            else:
                logger.info(f"Другой тип обновления: {update}")
            
            return True

        # Регистрируем обработчики
        logger.info("=== Регистрация обработчиков ===")

        # Сначала регистрируем логгер обновлений
        logger.info("1. Регистрация логгера обновлений")
        bot_application.add_handler(MessageHandler(filters.ALL, log_update), group=-2)

        # Регистрируем обработчики групповых событий
        logger.info("2. Регистрация обработчиков групповых событий")
        
        # Обработчик добавления/удаления бота из группы (высший приоритет)
        bot_application.add_handler(ChatMemberHandler(
            group_handler.handle_my_chat_member,
            ChatMemberHandler.MY_CHAT_MEMBER
        ), group=-3)  # Самый высокий приоритет

        # Обработчик новых участников (включая бота)
        bot_application.add_handler(MessageHandler(
            filters.StatusUpdate.NEW_CHAT_MEMBERS,
            group_handler.handle_new_chat_members
        ), group=-1)

        # Обработчик изменений участников
        bot_application.add_handler(ChatMemberHandler(
            group_handler.handle_chat_member_update,
            ChatMemberHandler.CHAT_MEMBER
        ), group=0)

        # Обработчик удаления участников
        bot_application.add_handler(MessageHandler(
            filters.StatusUpdate.LEFT_CHAT_MEMBER,
            group_handler.handle_left_chat_member
        ), group=0)

        # Регистрируем остальные обработчики
        logger.info("3. Регистрация остальных обработчиков")
        
        # Обработчик callback-запросов
        bot_application.add_handler(CallbackQueryHandler(handle_deletion_callback))
        
        # Обработчик личных сообщений для смены пароля
        bot_application.add_handler(MessageHandler(
            filters.TEXT & filters.ChatType.PRIVATE,
            message_handler.handle_private_message
        ))
        
        # Команды и веб-приложение
        bot_application.add_handler(CommandHandler("start", handle_start))
        bot_application.add_handler(CommandHandler("send_love", send_love))
        # Удаляем обработчик веб-приложения, оставляем только текстовые сообщения
        bot_application.add_handler(MessageHandler(
            filters.TEXT,
            handle_webapp_data
        ))

        # Делаем функцию broadcast_item_deletion доступной глобально
        bot_application.broadcast_item_deletion = broadcast_item_deletion

        logger.info("✅ Все обработчики успешно зарегистрированы")

        # Обновляем структуру файлов групп
        logger.info("Обновление структуры файлов групп...")
        updated = await group_handler.courier_service.update_all_groups_structure()
        logger.info(f"✅ Обновлено {updated} файлов групп курьеров")

        # Сохраняем экземпляр бота в общей директории
        save_bot_instance()

        logger.info("✅ Бот запущен и ожидает сообщений...")
        
        # Запускаем бота
        await bot_application.initialize()
        await bot_application.start()
        
        # Запускаем получение обновлений
        logger.info("Запуск получения обновлений...")
        await bot_application.updater.start_polling(
            drop_pending_updates=True,
            allowed_updates=[
                "message",
                "callback_query", 
                "chat_member", 
                "edited_message",
                "my_chat_member",
                "new_chat_members",
                "left_chat_member",
                "channel_post",
                "edited_channel_post",
                "inline_query",
                "chosen_inline_result",
                "chat_join_request"
            ]
        )
        logger.info("✅ Получение обновлений запущено")
        
        # Добавляем отладочное сообщение о регистрации обработчиков
        logger.info("=== Зарегистрированные обработчики ===")
        for group_id, handlers in bot_application.handlers.items():
            logger.info(f"Группа {group_id}:")
            for handler in handlers:
                handler_name = handler.__class__.__name__
                handler_group = getattr(handler, 'group', None)
                if handler_group is not None:
                    logger.info(f"- {handler_name} (группа {handler_group})")
                else:
                    logger.info(f"- {handler_name}")
        logger.info("=== Конец списка обработчиков ===")
        
        # Запускаем Flask с Hypercorn в том же event loop
        asyncio.create_task(run_flask())
        
        try:
            # Ждем, пока бот не будет остановлен
            while True:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            # Если задача была отменена, корректно останавливаем бота
            await bot_application.updater.stop()
            await bot_application.stop()
            await bot_application.shutdown()
            raise
        except Exception as e:
            logger.error(f"Ошибка при работе бота: {e}", exc_info=True)
            await bot_application.updater.stop()
            await bot_application.stop()
            await bot_application.shutdown()
            raise
        
    except Exception as e:
        logger.error(f"Ошибка при запуске бота: {e}", exc_info=True)
        if bot_application:
            try:
                await bot_application.stop()
                await bot_application.shutdown()
            except Exception:
                pass
        raise
    finally:
        # Освобождаем блокировку при завершении
        release_lock(lock_fd)

def init_bot():
    """Инициализация бота и сервисов"""
    global bot_application, group_handler, json_service, courier_service, db_service, group_service
    
    # Настройки бота
    config = Config()
    logger.info(f"Конфигурация загружена")

    # Инициализируем JSON сервис
    json_service = JsonService(config.DATA_DIR)
    logger.info(f"Сервис JSON инициализирован")

    # Инициализируем сервис групп курьеров
    courier_service = CourierGroupService(config.DATA_DIR)
    logger.info(f"Сервис групп курьеров инициализирован")
    
    # Если включено использование базы данных, инициализируем сервис БД
    if config.USE_DATABASE:
        try:
            db_service = DatabaseService()
            logger.info(f"Сервис базы данных инициализирован")
        except Exception as e:
            logger.error(f"❌ Ошибка при инициализации сервиса базы данных: {e}")
            logger.error(traceback.format_exc())
            db_service = None
    else:
        db_service = None
    
    # Инициализируем адаптер групп
    group_service = GroupServiceAdapter(courier_service, db_service)
    logger.info(f"Адаптер групп инициализирован")

    # Создаем экземпляр бота
    token = config.TOKEN
    application = Application.builder().token(token).build()
    logger.info(f"✅ Экземпляр бота создан")

    # Инициализируем обработчики
    bot_application = application
    
    # Инициализируем обработчик групповых событий
    group_handler = GroupHandler(application, json_service)
    
    # Используем новый адаптер групп
    logger.info(f"Перед заменой: group_handler.courier_service = {group_handler.courier_service.__class__.__name__}")
    group_handler.courier_service = group_service
    logger.info(f"После замены: group_handler.courier_service = {group_handler.courier_service.__class__.__name__}")
    
    asyncio.get_event_loop().run_until_complete(group_handler.initialize())
    logger.info(f"✅ Обработчик групповых событий инициализирован")

    # Регистрируем REST API эндпоинты
    register_api_endpoints(bot_application.bot)
    
    return application

# +++ Добавляем Lifespan Manager +++
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Инициализация сервиса Telegram бота...")
    
    # 1. Инициализация конфигурации и сервисов
    config = Config()
    json_service = JsonService(config.DATA_DIR)
    courier_service = CourierGroupService(config.DATA_DIR)
    use_database = os.getenv('USE_DATABASE', 'false').lower() == 'true'
    db_service = None
    if use_database:
        try:
            db_service = DatabaseService()
            logger.info("Сервис базы данных инициализирован")
        except Exception as e:
            logger.error(f"❌ Ошибка при инициализации сервиса базы данных: {e}")
    group_service = GroupServiceAdapter(courier_service, db_service)
    logger.info(f"Адаптер групп инициализирован")
    
    # 2. Создание экземпляра Application
    bot_app = (
        Application.builder()
        .token(config.TOKEN)
        # Добавляем таймауты (можно вынести в config)
        .connect_timeout(60.0)
        .read_timeout(60.0)
        .write_timeout(60.0)
        .pool_timeout(60.0)
        .build()
    )
    logger.info("✅ Экземпляр Telegram Application создан")
    
    # 3. Сохранение экземпляров в app.state
    app.state.bot_application = bot_app
    app.state.json_service = json_service
    app.state.group_service = group_service # GroupServiceAdapter
    # Сохраняем и другие сервисы если они нужны в API или хэндлерах
    app.state.config = config 

    # 4. Инициализация хэндлеров (передаем им нужные сервисы/приложение)
    group_handler = GroupHandler(bot_app, json_service)
    group_handler.courier_service = group_service # Заменяем на адаптер
    message_handler = BotMessageHandler(config.DATA_DIR)
    # Инициализация других хэндлеров, если есть
    logger.info("✅ Хэндлеры инициализированы")

    # 5. Регистрация хэндлеров
    logger.info("=== Регистрация обработчиков Telegram ===")
    # Логгер обновлений (низкий приоритет)
    # bot_app.add_handler(MessageHandler(filters.ALL, log_update), group=-2)
    # Групповые события (ChatMemberHandler, MessageHandler для status updates)
    bot_app.add_handler(ChatMemberHandler(group_handler.handle_my_chat_member, ChatMemberHandler.MY_CHAT_MEMBER), group=-3)
    bot_app.add_handler(MessageHandler(filters.StatusUpdate.NEW_CHAT_MEMBERS, group_handler.handle_new_chat_members), group=-1)
    bot_app.add_handler(ChatMemberHandler(group_handler.handle_chat_member_update, ChatMemberHandler.CHAT_MEMBER), group=0)
    bot_app.add_handler(MessageHandler(filters.StatusUpdate.LEFT_CHAT_MEMBER, group_handler.handle_left_chat_member), group=0)
    # Команды
    bot_app.add_handler(CommandHandler("start", handle_start))
    # bot_app.add_handler(CommandHandler("send_love", send_love)) # Убрал, если не нужна
    # Сообщения (включая web_app_data)
    bot_app.add_handler(MessageHandler(filters.TEXT & filters.ChatType.PRIVATE, message_handler.handle_private_message))
    bot_app.add_handler(MessageHandler(filters.ALL & filters.ChatType.GROUP, handle_webapp_data)) # Обработка web_app_data в группах
    bot_app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data)) # Явная обработка web_app_data
    # Callback Queries
    bot_app.add_handler(CallbackQueryHandler(handle_deletion_callback)) # Обработчик удаления
    # bot_app.add_handler(CallbackQueryHandler(handle_all_callbacks)) # Общий обработчик для отладки (если нужен)
    logger.info("✅ Обработчики Telegram зарегистрированы")
    
    try:
        # 6. Запуск бота
        logger.info("Инициализация и запуск Telegram Application...")
        await bot_app.initialize()
        await bot_app.start()
        await bot_app.updater.start_polling(drop_pending_updates=True) # Разрешаем все апдейты по умолчанию
        logger.info("✅ Бот запущен и получает обновления")
        
        # Код приложения FastAPI работает здесь
        yield
        
    finally:
        # 7. Остановка бота при завершении работы FastAPI
        logger.info("👋 Остановка Telegram Application...")
        if bot_app.updater and bot_app.updater.is_running:
            await bot_app.updater.stop()
        if bot_app.running:
            await bot_app.stop()
        await bot_app.shutdown()
        logger.info("✅ Бот остановлен")
# +++ Конец Lifespan Manager +++

# +++ Создаем FastAPI приложение +++
app = FastAPI(
    title="NinjaBot Telegram Service", 
    version="1.0.0", 
    description="FastAPI сервис для Telegram бота NinjaBot",
    lifespan=lifespan
)

# +++ Определяем Pydantic модель для API +++
class SendMessagePayload(BaseModel):
    chat_id: str
    text: str
    parse_mode: str = 'HTML'

# +++ Определяем API эндпоинт +++
@app.post("/api/send_message")
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
                # Убираем префикс '-100' и оставляем '-' для супергрупп
                processed_chat_id = int(chat_id.replace('-100', '-'))
            elif chat_id.startswith('-'):
                 # Обычные группы уже имеют правильный формат '-'
                 processed_chat_id = int(chat_id)
            else:
                # Личные сообщения - ID без минуса
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
            # Попытка получить более детальную ошибку от Telegram API
            error_message = str(e)
            if hasattr(e, 'message'): # Для ошибок PTB
                error_message = e.message
            raise HTTPException(status_code=500, detail=f"Failed to send message: {error_message}")
            
    except HTTPException as http_exc: # Перебрасываем HTTPException
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /api/send_message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

# +++ Добавляем запуск через Uvicorn +++
if __name__ == "__main__":
    # Используем переменные окружения для хоста и порта
    host = os.getenv("BOT_HOST", "0.0.0.0")
    port = int(os.getenv("BOT_PORT", "8001")) # Используем порт 8001 по умолчанию
    reload = ENVIRONMENT == 'development' # Включаем reload только для development
    
    logger.info(f"Запуск FastAPI (Uvicorn) сервера на {host}:{port} {'с автоперезагрузкой' if reload else ''}...")
    uvicorn.run(
        "main:app", # Указываем на переменную app в этом файле (переименуй файл в main.py)
        host=host,
        port=port,
        reload=reload,
        log_level="info" # Можно настроить уровень логов uvicorn
    )
# --- Конец файла --- 