from telegram.ext import Application, MessageHandler, filters, ChatMemberHandler, CommandHandler, CallbackQueryHandler
import asyncio
import logging
from telegramNinjaBot.config.config import Config
from telegramNinjaBot.services.json_service import JsonService
from telegramNinjaBot.handlers.group_handlers import GroupHandler
from telegram.constants import ChatMemberStatus
from telegram import Update, Bot
from telegram.ext import ContextTypes
import json
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import traceback
import os
import pickle
from datetime import datetime
import requests
import fcntl
import sys
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from io import BytesIO
import threading
from hypercorn.config import Config as HyperConfig
from hypercorn.asyncio import serve
import aiohttp

# Настраиваем логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Отключаем лишние предупреждения
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('telegram.ext.Application').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Создаем Flask приложение
app = Flask(__name__)
CORS(app)

# Глобальные переменные для хранения экземпляров
bot_application = None
group_handler = None
json_service = None
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
                                        "📤 Запрос на удаление товара\n\n"
                                        f"Категория: {deletion_data['data']['category']}\n"
                                        f"Товар: {deletion_data['data']['item']}\n\n"
                                        "Статус подтверждений:\n"
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

async def run_bot():
    """Асинхронный запуск бота"""
    global bot_application, group_handler, json_service
    
    # Пытаемся получить блокировку
    lock_fd = acquire_lock()
    if not lock_fd:
        logger.error("Другой экземпляр бота уже запущен")
        sys.exit(1)
    
    try:
        # Инициализация конфигурации и сервисов
        config = Config()
        json_service = JsonService(config.DATA_DIR)

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
        
        # Команды и веб-приложение
        bot_application.add_handler(CommandHandler("send_love", send_love))
        bot_application.add_handler(MessageHandler(
            filters.StatusUpdate.WEB_APP_DATA | filters.TEXT,
            handle_webapp_data
        ))

        # Делаем функцию broadcast_item_deletion доступной глобально
        bot_application.broadcast_item_deletion = broadcast_item_deletion

        logger.info("✅ Все обработчики успешно зарегистрированы")

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

@app.route('/api/photo/<path:photo_id>')
async def get_photo(photo_id):
    """Получение фотографии пользователя"""
    try:
        if photo_id.startswith('local:'):
            user_id = photo_id.split(':')[1]
            photos = await bot_application.bot.get_user_profile_photos(user_id, limit=1)
            if photos and photos.photos:
                file_id = photos.photos[0][-1].file_id
                file = await bot_application.bot.get_file(file_id)
                response = requests.get(file.file_path)
                if response.status_code == 200:
                    return send_file(
                        BytesIO(response.content),
                        mimetype='image/jpeg'
                    )
        return jsonify({'error': 'Photo not found'}), 404
    except Exception as e:
        logger.error(f"Error serving photo: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/notify_deletion', methods=['POST'])
async def handle_deletion_notification():
    """Обработка запроса на рассылку уведомления об удалении"""
    try:
        data = request.get_json()
        
        if not all(key in data for key in ['deletion_id', 'branch_name', 'category', 'item']):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Создаем новый event loop для этого запроса
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Запускаем broadcast_item_deletion в новом event loop
            result = await broadcast_item_deletion(data)
            return jsonify({
                'status': 'success',
                'initiator_message_id': result.get('initiator_message_id')
            })
        finally:
            # Закрываем event loop
            loop.close()
            
    except Exception as e:
        logger.error(f"Ошибка при обработке уведомления об удалении: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/send_love', methods=['POST'])
async def handle_send_love():
    """Обработка запроса на отправку любовных сообщений"""
    try:
        data = request.get_json()
        if not data.get('user_id'):
            return jsonify({'error': 'user_id is required'}), 400
            
        await group_handler.send_love_messages(
            bot_application.bot,
            data['user_id'],
            data.get('count', 100)
        )
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"Error sending love messages: {e}")
        return jsonify({'error': str(e)}), 500

async def run_flask():
    """Запуск Flask сервера"""
    config = HyperConfig()
    config.bind = ["0.0.0.0:8001"]
    config.use_reloader = False
    await serve(app, config)

if __name__ == '__main__':
    try:
        # Запускаем бота в основном event loop
        asyncio.run(run_bot())
    except KeyboardInterrupt:
        logger.info("Бот остановлен пользователем")
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}", exc_info=True)
        sys.exit(1) 