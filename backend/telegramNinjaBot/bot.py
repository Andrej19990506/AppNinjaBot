from telegram.ext import Application, MessageHandler, filters, ChatMemberHandler, CommandHandler
import asyncio
import logging
from config.config import Config
from services.json_service import JsonService
from handlers.group_handlers import GroupHandler
from telegram.constants import ChatMemberStatus
from telegram import Update
from telegram.ext import ContextTypes
import json
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Настраиваем логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Отключаем лишние предупреждения
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('telegram.ext.Application').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Глобальные переменные для хранения экземпляров
bot_application = None
group_handler = None

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
        # Проверяем, что это данные от веб-приложения
        if not update.effective_message or not hasattr(update.effective_message, 'web_app_data'):
            return

        logger.info("Получены данные от веб-приложения")
        logger.info(f"Сырые данные: {update.effective_message.web_app_data.data}")
        
        data = json.loads(update.effective_message.web_app_data.data)
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
    except Exception as e:
        logger.error(f"Ошибка при обработке данных веб-приложения: {e}", exc_info=True)

def run_bot():
    global bot_application, group_handler
    
    # Инициализация конфигурации и сервисов
    config = Config()
    json_service = JsonService(config.DATA_DIR)

    # Настраиваем планировщик с явным указанием часового пояса
    scheduler = AsyncIOScheduler(timezone=pytz.UTC)

    # Создаем приложение с базовыми настройками
    bot_application = (
        Application.builder()
        .token(config.TOKEN)
        .connect_timeout(30.0)
        .read_timeout(30.0)
        .write_timeout(30.0)
        .pool_timeout(30.0)
        .build()
    )

    # Создаем обработчик групповых событий
    group_handler = GroupHandler(bot_application, json_service)

    # Добавляем обработчик команды отправки сообщений
    bot_application.add_handler(
        CommandHandler("send_love", send_love)
    )

    # Добавляем обработчик для данных от веб-приложения
    bot_application.add_handler(
        MessageHandler(
            filters.StatusUpdate.WEB_APP_DATA | filters.TEXT,
            handle_webapp_data
        )
    )

    logger.info("Бот запущен и ожидает сообщений...")
    
    # Запускаем бота с расширенным списком обновлений
    bot_application.run_polling(
        allowed_updates=[
            "message",
            "chat_member",
            "my_chat_member",
            "callback_query",
            "web_app_data"
        ],
        drop_pending_updates=True
    )

if __name__ == '__main__':
    try:
        run_bot()
    except KeyboardInterrupt:
        logger.info("Бот остановлен пользователем")
    except Exception as e:
        logger.error(f"Ошибка при запуске бота: {e}", exc_info=True) 