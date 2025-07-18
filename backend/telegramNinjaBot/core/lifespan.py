import logging
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI
import os # Добавим os для переменных окружения БД
import asyncpg # Импортируем asyncpg
import asyncio

# Импортируем Application и типы PTB
from telegram import Update
from telegram.ext import (
    Application,
    ChatMemberHandler,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)
from telegram.constants import ChatMemberStatus

# Импортируем конфигурацию и сервисы
from telegramNinjaBot.config.config import Config
from telegramNinjaBot.services.database_service import DatabaseService

# Импортируем хэндлеры
from telegramNinjaBot.handlers.group_handlers import GroupHandler
from telegramNinjaBot.handlers.message_handlers import MessageHandler as BotMessageHandler
from telegramNinjaBot.handlers.common_handlers import handle_start, handle_webapp_data, handle_registry
from telegramNinjaBot.api.routes import handle_confirmation_callback

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управляет жизненным циклом Telegram бота и пула соединений БД в приложении FastAPI."""
    logger.info("🚀 Инициализация сервиса Telegram бота и пула БД через lifespan...")
    
    # === Инициализация ===
    db_pool = None # Инициализируем переменные для finally
    http_client = None
    bot_app = None
    db_service = None

    try:
        # 1. Инициализация конфигурации
        config = Config()
        app.state.config = config # Сохраняем конфиг
        
        # 2. Создание пула соединений asyncpg
        logger.info("Создание пула соединений asyncpg...")
        # Берем данные из переменных окружения (или из config, если они там)
        db_user = os.getenv('POSTGRES_USER', 'postgres')
        db_password = os.getenv('POSTGRES_PASSWORD', 'postgres')
        db_host = os.getenv('POSTGRES_HOST', 'postgres')
        db_port = os.getenv('POSTGRES_PORT', '5432')
        db_name = os.getenv('POSTGRES_DB', 'appninjabot')
        dsn = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        
        db_pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=config.DB_POOL_MIN_SIZE, # Добавьте эти параметры в Config или используйте значения по умолчанию
            max_size=config.DB_POOL_MAX_SIZE, # Например, min_size=1, max_size=10
            # Можно добавить timeout и другие параметры пула
        )
        app.state.db_pool = db_pool # Сохраняем пул
        logger.info("✅ Пул соединений asyncpg создан")

        # 3. Инициализация DatabaseService с пулом
        db_service = DatabaseService(pool=db_pool) 
        app.state.db_service = db_service # Сохраняем сервис БД
        logger.info("✅ Сервис базы данных (asyncpg) инициализирован")

        # 4. Создание HTTP-клиента для Telegram
        logger.info("Создание HTTP-клиента (httpx) для Telegram...")
        limits = httpx.Limits(max_connections=100, max_keepalive_connections=50)
        timeout = httpx.Timeout(30.0)
        http_client = httpx.AsyncClient(limits=limits, timeout=timeout)
        app.state.http_client = http_client # Сохраняем клиент
        logger.info("✅ HTTP-клиент (httpx) для Telegram создан")

        # 5. Создание экземпляра Application
        logger.info("Создание экземпляра Telegram Application...")
        
        # Проверяем режим работы
        environment = os.getenv('ENVIRONMENT', 'development')
        use_polling = os.getenv('USE_POLLING', 'false').lower() == 'true'
        
        # Определяем, используем ли лонг-поллинг
        use_long_polling = (environment == 'development' or use_polling)
        
        # Создаем разные билдеры для вебхука и лонг-поллинга
        if use_long_polling:
            logger.info("🔄 Инициализация бота в режиме long polling...")
            # Для лонг-поллинга создаем экземпляр без вебхука
            bot_app = (
                Application.builder()
                .token(config.TOKEN) 
                .connect_timeout(60.0)
                .read_timeout(60.0)
                .write_timeout(60.0)
                .pool_timeout(60.0)
                .build()
            )
        else:
            # Для вебхука используем стандартную инициализацию
            bot_app = (
                Application.builder()
                .token(config.TOKEN) 
                .connect_timeout(60.0)
                .read_timeout(60.0)
                .write_timeout(60.0)
                .pool_timeout(60.0)
                .build()
            )
        
        app.state.bot_application = bot_app # Сохраняем приложение бота
        logger.info("✅ Экземпляр Telegram Application создан")
        
        # !!! ВАЖНО: Сохраняем db_service в bot_data для обработчиков команд !!!
        bot_app.bot_data['db_service'] = db_service
        logger.info("✅ db_service сохранен в bot_data")
        
        # !!! ВАЖНО: Передаем db_service в GroupHandler !!!
        # 6. Инициализация хэндлеров
        logger.info("Инициализация хэндлеров...")
        group_handler = GroupHandler(bot_app, db_service) # Передаем application и db_service
        message_handler = BotMessageHandler(config.DATA_DIR)
        logger.info("✅ Хэндлеры инициализированы")

        # 7. Регистрация хэндлеров
        logger.info("=== Регистрация обработчиков Telegram ===")
        # Групповые события
        bot_app.add_handler(ChatMemberHandler(group_handler.handle_my_chat_member, ChatMemberHandler.MY_CHAT_MEMBER), group=-3)
        bot_app.add_handler(MessageHandler(filters.StatusUpdate.NEW_CHAT_MEMBERS, group_handler.handle_new_chat_members), group=-1)
        bot_app.add_handler(ChatMemberHandler(group_handler.handle_chat_member_update, ChatMemberHandler.CHAT_MEMBER), group=0)
        bot_app.add_handler(MessageHandler(filters.StatusUpdate.LEFT_CHAT_MEMBER, group_handler.handle_left_chat_member), group=0)
        # Команды
        bot_app.add_handler(CommandHandler("start", handle_start))
        bot_app.add_handler(CommandHandler("registry", handle_registry))
        # Сообщения
        bot_app.add_handler(MessageHandler(filters.TEXT & filters.ChatType.PRIVATE, message_handler.handle_private_message))
        bot_app.add_handler(MessageHandler(filters.ALL & filters.ChatType.GROUP, handle_webapp_data))
        bot_app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data))
        # Добавляем обработчик для кнопки подтверждения
        confirmation_handler = CallbackQueryHandler(handle_confirmation_callback, pattern=r"^confirm(?:_eos)?:")
        bot_app.add_handler(confirmation_handler)
        logger.info("✅ Обработчик для кнопок подтверждения добавлен.")
        logger.info("✅ Обработчики Telegram зарегистрированы")

        # 8. Инициализация, запуск Application и настройка вебхука/лонг-поллинга
        logger.info("Инициализация и запуск Telegram Application...")
        await bot_app.initialize()
        await bot_app.start()
        logger.info("✅ Telegram Application запущено")
        
        # Настраиваем режим работы в зависимости от окружения
        if use_long_polling:
            # В режиме лонг-поллинга удаляем вебхук и запускаем update_queue
            logger.info("🔄 Настройка режима long polling...")
            
            # Сначала удаляем вебхук, если он был установлен
            await bot_app.bot.delete_webhook(drop_pending_updates=True)
            logger.info("✅ Вебхук удален для режима long polling")
            
            # Запускаем метод для получения обновлений (не блокирующий)
            # Это создаст в экземпляре update_queue, куда будут попадать обновления
            asyncio.create_task(bot_app.updater.start_polling(drop_pending_updates=True))
            logger.info("✅ Long polling запущен успешно")
        else:
            # В режиме вебхука устанавливаем его
            if not config.WEBHOOK_URL or not config.WEBHOOK_PATH:
                logger.error("WEBHOOK_URL или WEBHOOK_PATH не заданы. Вебхук НЕ УСТАНОВЛЕН.")
            else:
                webhook_url = f"{config.WEBHOOK_URL.rstrip('/')}{config.WEBHOOK_PATH}"
                secret_token = config.WEBHOOK_SECRET
                logger.info(f"Попытка установить вебхук: {webhook_url}")
                try:
                    await bot_app.bot.set_webhook(
                        url=webhook_url,
                        allowed_updates=Update.ALL_TYPES,
                        secret_token=secret_token
                    )
                    logger.info(f"✅ Вебхук успешно установлен: {webhook_url}")                    
                    # КРИТИЧЕСКИ ВАЖНО: Запускаем обработчик очереди для webhook режима
                    logger.info("🔄 Запуск обработчика очереди обновлений для webhook режима...")
                    asyncio.create_task(bot_app.updater.start_processing_updates())
                    logger.info("✅ Обработчик очереди обновлений запущен для webhook режима")
                    
                except Exception as e:
                    logger.error(f"❌ Ошибка при установке вебхука: {e}. Приложение продолжит работу, но вебхук может быть неактивен.")

        # Приложение готово к работе
        logger.info("🏁 Lifespan инициализация завершена, приложение готово к работе.")
        yield

    except Exception as e:
         # Ловим любые ошибки при инициализации
         logger.critical(f"❌ КРИТИЧЕСКАЯ ОШИБКА во время инициализации lifespan: {e}", exc_info=True)
         # Попытаемся корректно завершить то, что успело инициализироваться
         # (Логика завершения перенесена в finally)
         raise # Перевыбрасываем исключение, чтобы FastAPI понял, что старт не удался

    # === Завершение работы ===
    finally:
        logger.info("👋 Завершение работы lifespan...")
        
        # Получаем ресурсы из app.state безопасно, используя getattr
        bot_app_to_stop = getattr(app.state, 'bot_application', None)
        # db_service сам ничего не закрывает, его можно не получать
        http_client_to_close = getattr(app.state, 'http_client', None)
        db_pool_to_close = getattr(app.state, 'db_pool', None) 

        # Удаление вебхука
        if bot_app_to_stop and getattr(bot_app_to_stop, 'bot', None):
            logger.info("Удаление вебхука...")
            try:
                 await bot_app_to_stop.bot.delete_webhook(drop_pending_updates=True) # Можно добавить drop_pending_updates
                 logger.info("✅ Вебхук удален")
            except Exception as e:
                logger.error(f"❌ Ошибка при удалении вебхука: {e}", exc_info=True)
        elif bot_app_to_stop:
             logger.warning("Экземпляр бота не был инициализирован, пропуск удаления вебхука.")

        # Остановка Application
        if bot_app_to_stop:
            logger.info("Остановка Telegram Application...")
            try:
                 if bot_app_to_stop.running:
                     await bot_app_to_stop.stop()
                 # await bot_app_to_stop.shutdown() # shutdown вызывается автоматически при stop, если нужно
                 logger.info("✅ Telegram Application остановлено")
            except Exception as e:
                 logger.error(f"❌ Ошибка при остановке Telegram Application: {e}", exc_info=True)

        # Закрытие HTTP клиента
        if http_client_to_close:
            logger.info("Закрытие HTTP-клиента Telegram...")
            try:
                await http_client_to_close.aclose()
                logger.info("✅ HTTP-клиент Telegram закрыт")
            except Exception as e:
                logger.error(f"❌ Ошибка при закрытии HTTP-клиента: {e}", exc_info=True)
        
        # Закрытие пула соединений БД
        if db_pool_to_close:
            logger.info("Закрытие пула соединений asyncpg...")
            try:
                await db_pool_to_close.close()
                logger.info("✅ Пул соединений asyncpg закрыт")
            except Exception as e:
                 logger.error(f"❌ Ошибка при закрытии пула соединений БД: {e}", exc_info=True)

        logger.info("🏁 Lifespan завершен.") 