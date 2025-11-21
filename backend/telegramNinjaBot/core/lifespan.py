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
    bot_apps = []  # Список для хранения всех Application (для режима companies)
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
        
        # 3.1. Загрузка токена/токенов из БД
        bot_token = config.TOKEN
        company_bots_data = []  # Список данных ботов компаний (для режима companies)
        
        if config.BOT_TYPE == 'company':
            logger.info(f"🔍 Загрузка токена бота компании из БД...")
            try:
                # Загружаем токен из БД
                if config.COMPANY_BOT_ID:
                    # Поиск по ID
                    query = "SELECT id, bot_token, bot_username, company_name FROM company_bots WHERE id = $1 AND is_active = true"
                    row = await db_pool.fetchrow(query, config.COMPANY_BOT_ID)
                elif config.TOKEN:
                    # Поиск по токену (если указан в env)
                    query = "SELECT id, bot_token, bot_username, company_name FROM company_bots WHERE bot_token = $1 AND is_active = true"
                    row = await db_pool.fetchrow(query, config.TOKEN)
                else:
                    raise ValueError("Для бота компании необходимо указать либо COMPANY_BOT_ID, либо BOT_TOKEN в env")
                
                if not row:
                    raise ValueError(f"Бот компании не найден в БД (ID: {config.COMPANY_BOT_ID or 'поиск по токену'})")
                
                bot_token = row['bot_token']
                company_bots_data = [row]  # Сохраняем данные для единообразия
                logger.info(f"✅ Токен бота компании загружен из БД: {bot_token[:20]}... (ID: {row['id']}, {row['company_name']})")
                
                # Обновляем токен в конфиге
                config.TOKEN = bot_token
            except Exception as e:
                logger.error(f"❌ Ошибка при загрузке токена бота компании из БД: {e}")
                raise
        elif config.BOT_TYPE == 'companies':
            logger.info(f"🔍 Загрузка всех активных ботов компаний из БД...")
            try:
                # Загружаем все активные боты компаний
                query = "SELECT id, bot_token, bot_username, company_name FROM company_bots WHERE is_active = true ORDER BY id"
                rows = await db_pool.fetch(query)
                
                if not rows:
                    logger.warning("⚠️ В БД нет активных ботов компаний")
                    company_bots_data = []
                else:
                    company_bots_data = [dict(row) for row in rows]
                    logger.info(f"✅ Загружено {len(company_bots_data)} активных ботов компаний из БД")
                    for bot_data in company_bots_data:
                        logger.info(f"   - ID: {bot_data['id']}, {bot_data['company_name']}, username: {bot_data['bot_username']}")
            except Exception as e:
                logger.error(f"❌ Ошибка при загрузке ботов компаний из БД: {e}")
                raise

        # 4. Создание HTTP-клиента для Telegram
        logger.info("Создание HTTP-клиента (httpx) для Telegram...")
        limits = httpx.Limits(max_connections=100, max_keepalive_connections=50)
        timeout = httpx.Timeout(30.0)
        http_client = httpx.AsyncClient(limits=limits, timeout=timeout)
        app.state.http_client = http_client # Сохраняем клиент
        logger.info("✅ HTTP-клиент (httpx) для Telegram создан")

        # 5. Создание экземпляра/экземпляров Application
        logger.info("Создание экземпляра(ов) Telegram Application...")
        
        # Проверяем режим работы
        environment = os.getenv('ENVIRONMENT', 'development')
        use_polling = os.getenv('USE_POLLING', 'false').lower() == 'true'
        
        # Определяем, используем ли лонг-поллинг
        use_long_polling = (environment == 'development' or use_polling)
        
        async def create_bot_application(token: str, bot_id: int = None, bot_name: str = None) -> Application:
            """Создает и настраивает Application для одного бота"""
            if use_long_polling:
                bot_app = (
                    Application.builder()
                    .token(token) 
                    .connect_timeout(60.0)
                    .read_timeout(60.0)
                    .write_timeout(60.0)
                    .pool_timeout(60.0)
                    .build()
                )
            else:
                bot_app = (
                    Application.builder()
                    .token(token) 
                    .connect_timeout(60.0)
                    .read_timeout(60.0)
                    .write_timeout(60.0)
                    .pool_timeout(60.0)
                    .build()
                )
            
            # Сохраняем db_service в bot_data
            bot_app.bot_data['db_service'] = db_service
            if bot_id:
                bot_app.bot_data['company_bot_id'] = bot_id
            if bot_name:
                bot_app.bot_data['company_name'] = bot_name
            
            return bot_app
        
        if config.BOT_TYPE == 'companies':
            # Создаем Application для каждого бота компании
            logger.info(f"🏢 Создание Application для {len(company_bots_data)} ботов компаний...")
            for bot_data in company_bots_data:
                bot_app_instance = await create_bot_application(
                    bot_data['bot_token'],
                    bot_data['id'],
                    bot_data['company_name']
                )
                bot_apps.append(bot_app_instance)
                logger.info(f"✅ Application создан для бота: {bot_data['company_name']} (ID: {bot_data['id']})")
            
            # Для обратной совместимости сохраняем первый бот как основной
            if bot_apps:
                bot_app = bot_apps[0]
                app.state.bot_application = bot_app
                app.state.bot_applications = bot_apps  # Сохраняем все приложения
            else:
                raise ValueError("Не найдено активных ботов компаний для запуска")
        else:
            # Обычный режим - один бот
            # Для режима company сохраняем данные бота из БД
            bot_id = None
            bot_name = None
            if config.BOT_TYPE == 'company' and company_bots_data:
                bot_id = company_bots_data[0]['id']
                bot_name = company_bots_data[0]['company_name']
            
            bot_app = await create_bot_application(bot_token, bot_id, bot_name)
            app.state.bot_application = bot_app
            bot_apps = [bot_app]
        
        logger.info("✅ Экземпляр(ы) Telegram Application создан(ы)")
        
        # 6. Инициализация хэндлеров в зависимости от типа бота
        logger.info(f"Инициализация хэндлеров (BOT_TYPE={config.BOT_TYPE})...")
        group_handlers = {}  # Словарь: bot_app -> GroupHandler
        message_handler = None
        
        if config.BOT_TYPE in ('company', 'companies'):
            # Для ботов компаний инициализируем все хендлеры
            message_handler = BotMessageHandler(config.DATA_DIR)
            
            # Создаем GroupHandler для каждого Application
            for bot_app_instance in bot_apps:
                group_handler = GroupHandler(bot_app_instance, db_service)
                group_handlers[bot_app_instance] = group_handler
                bot_app_instance.bot_data['group_handler'] = group_handler
                logger.info(f"✅ GroupHandler создан для бота (ID: {bot_app_instance.bot_data.get('company_bot_id', 'unknown')})")
            
            logger.info("✅ Хэндлеры для ботов компаний инициализированы")
        elif config.BOT_TYPE == 'main':
            # Для основного бота хендлеры не нужны (только авторизация)
            logger.info("✅ Основной бот: хендлеры не требуются (только авторизация)")
        else:
            raise ValueError(f"Неизвестный BOT_TYPE: {config.BOT_TYPE}")

        # 7. Регистрация хэндлеров в зависимости от типа бота
        logger.info(f"=== Регистрация обработчиков Telegram (BOT_TYPE={config.BOT_TYPE}) ===")
        
        if config.BOT_TYPE == 'main':
            # === ОСНОВНОЙ БОТ ПРИЛОЖЕНИЯ (Flouix_bot) ===
            # Только авторизация через /start auth
            logger.info("🔐 Регистрация хендлеров для основного бота (только авторизация)")
            bot_app.add_handler(CommandHandler("start", handle_start))
            logger.info("✅ Основной бот: зарегистрирован только /start (для авторизации)")
            
        elif config.BOT_TYPE in ('company', 'companies'):
            # === БОТ(Ы) КОМПАНИИ ===
            # Весь функционал: группы, регистрация, сообщения, webapp и т.д.
            logger.info(f"🏢 Регистрация хендлеров для {'ботов компаний' if config.BOT_TYPE == 'companies' else 'бота компании'} (полный функционал)")
            
            if not group_handlers or not message_handler:
                raise ValueError("GroupHandler и MessageHandler должны быть инициализированы для ботов компаний")
            
            # Регистрируем хендлеры для каждого бота
            for bot_app_instance in bot_apps:
                group_handler = group_handlers[bot_app_instance]
                bot_name = bot_app_instance.bot_data.get('company_name', 'Unknown')
                bot_id = bot_app_instance.bot_data.get('company_bot_id', 'Unknown')
                
                logger.info(f"   Регистрация хендлеров для бота: {bot_name} (ID: {bot_id})")
                
                # Групповые события
                bot_app_instance.add_handler(ChatMemberHandler(group_handler.handle_my_chat_member, ChatMemberHandler.MY_CHAT_MEMBER), group=-3)
                bot_app_instance.add_handler(MessageHandler(filters.StatusUpdate.NEW_CHAT_MEMBERS, group_handler.handle_new_chat_members), group=-1)
                bot_app_instance.add_handler(ChatMemberHandler(group_handler.handle_chat_member_update, ChatMemberHandler.CHAT_MEMBER), group=0)
                bot_app_instance.add_handler(MessageHandler(filters.StatusUpdate.LEFT_CHAT_MEMBER, group_handler.handle_left_chat_member), group=0)
                
                # Обработчик видео для конкурсов
                bot_app_instance.add_handler(
                    MessageHandler(
                        (filters.VIDEO | (filters.Document.MimeType("video/mp4"))) & filters.ChatType.GROUPS,
                        group_handler.handle_competition_video
                    )
                )
                
                # Команды
                bot_app_instance.add_handler(CommandHandler("start", handle_start))  # /start и /start registry_*
                bot_app_instance.add_handler(CommandHandler("registry", handle_registry))
                
                # Сообщения
                bot_app_instance.add_handler(MessageHandler(filters.TEXT & filters.ChatType.PRIVATE, message_handler.handle_private_message))
                bot_app_instance.add_handler(MessageHandler(filters.ALL & filters.ChatType.GROUP, handle_webapp_data))
                bot_app_instance.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data))
                
                # Обработчик для кнопок подтверждения
                confirmation_handler = CallbackQueryHandler(handle_confirmation_callback, pattern=r"^confirm(?:_eos)?:")
                bot_app_instance.add_handler(confirmation_handler)
                
                logger.info(f"   ✅ Хендлеры зарегистрированы для бота: {bot_name}")
            
            logger.info(f"✅ {'Боты компаний' if config.BOT_TYPE == 'companies' else 'Бот компании'}: зарегистрированы все хендлеры (группы, регистрация, сообщения)")
        else:
            raise ValueError(f"Неизвестный BOT_TYPE: {config.BOT_TYPE}")
        
        logger.info("✅ Обработчики Telegram зарегистрированы")

        # 8. Инициализация, запуск Application(ов) и настройка вебхука/лонг-поллинга
        logger.info(f"Инициализация и запуск Telegram Application ({len(bot_apps)} шт.)...")
        
        async def start_bot_application(bot_app_instance: Application, bot_name: str = "Unknown", bot_id: int = None):
            """Инициализирует и запускает один Application"""
            try:
                await bot_app_instance.initialize()
                await bot_app_instance.start()
                logger.info(f"✅ Telegram Application запущено: {bot_name}")
                
                # Настраиваем режим работы
                if use_long_polling:
                    await bot_app_instance.bot.delete_webhook(drop_pending_updates=True)
                    asyncio.create_task(bot_app_instance.updater.start_polling(drop_pending_updates=True))
                    logger.info(f"✅ Long polling запущен для бота: {bot_name}")
                else:
                    if config.WEBHOOK_URL:
                        # Генерируем уникальный webhook path для каждого бота
                        # Основной бот: /api/telegram/webhook/main
                        # Боты компаний: /api/telegram/webhook/{bot_id}
                        if config.BOT_TYPE == 'main':
                            webhook_path = "/api/telegram/webhook/main"
                        elif bot_id:
                            # Для ботов компаний используем ID из БД
                            webhook_path = f"/api/telegram/webhook/{bot_id}"
                        else:
                            # Fallback для старой конфигурации
                            webhook_path = config.WEBHOOK_PATH if config.WEBHOOK_PATH else "/api/telegram/webhook/main"
                            logger.warning(f"⚠️ Используется fallback webhook path: {webhook_path}")
                        
                        webhook_url = f"{config.WEBHOOK_URL.rstrip('/')}{webhook_path}"
                        secret_token = config.WEBHOOK_SECRET
                        
                        # Сохраняем webhook_path в bot_data для использования в routes
                        bot_app_instance.bot_data['webhook_path'] = webhook_path
                        
                        # Указываем allowed_updates для получения событий о новых участниках
                        allowed_updates = [
                            "message",  # Включает new_chat_members
                            "edited_message",
                            "channel_post",
                            "edited_channel_post",
                            "inline_query",
                            "chosen_inline_result",
                            "callback_query",
                            "shipping_query",
                            "pre_checkout_query",
                            "poll",
                            "poll_answer",
                            "my_chat_member",
                            "chat_member",
                            "chat_join_request"
                        ]
                        await bot_app_instance.bot.set_webhook(
                            url=webhook_url,
                            secret_token=secret_token,
                            drop_pending_updates=True,
                            allowed_updates=allowed_updates
                        )
                        logger.info(f"✅ Вебхук установлен для бота: {bot_name} на {webhook_path}")
                        logger.info(f"   URL: {webhook_url}")
                        logger.info(f"   Allowed updates: {allowed_updates}")
                        
                        # Для webhook режима нужно запустить обработку очереди обновлений
                        # updater.start_webhook() не нужен, так как мы получаем обновления через FastAPI
                        # но нужно запустить обработку очереди обновлений
                        if bot_app_instance.updater:
                            bot_app_instance.updater._start_webhook = lambda: None  # Отключаем встроенный webhook сервер
                            # Запускаем обработку очереди обновлений в фоне
                            async def process_updates_from_queue():
                                """Обрабатывает обновления из очереди для webhook режима"""
                                try:
                                    while bot_app_instance.running:
                                        try:
                                            # Получаем обновление из очереди с таймаутом
                                            update = await asyncio.wait_for(
                                                bot_app_instance.update_queue.get(),
                                                timeout=1.0
                                            )
                                            # Обрабатываем обновление
                                            await bot_app_instance.process_update(update)
                                            logger.debug(f"✅ Обновление {update.update_id} обработано")
                                        except asyncio.TimeoutError:
                                            # Таймаут - это нормально, продолжаем цикл
                                            continue
                                        except Exception as e:
                                            logger.error(f"❌ Ошибка при обработке обновления из очереди: {e}", exc_info=True)
                                except Exception as e:
                                    logger.error(f"❌ Критическая ошибка в обработчике очереди обновлений: {e}", exc_info=True)
                            
                            # Запускаем обработку очереди в фоне
                            asyncio.create_task(process_updates_from_queue())
                            logger.info(f"✅ Обработка очереди обновлений запущена для бота: {bot_name}")
            except Exception as e:
                logger.error(f"❌ Ошибка при запуске бота {bot_name}: {e}")
                raise
        
        # Запускаем все Application параллельно
        if config.BOT_TYPE == 'companies':
            for bot_app_instance in bot_apps:
                bot_name = bot_app_instance.bot_data.get('company_name', 'Unknown')
                bot_id = bot_app_instance.bot_data.get('company_bot_id')
                await start_bot_application(bot_app_instance, bot_name, bot_id)
        else:
            # Для основного бота bot_id = None (будет использован путь /main)
            await start_bot_application(bot_app, "Main/Company Bot", bot_id=None)
        
        logger.info(f"✅ Все Telegram Application запущены ({len(bot_apps)} шт.)")

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
        bot_apps_to_stop = getattr(app.state, 'bot_applications', None)
        if not bot_apps_to_stop:
            # Для обратной совместимости
            bot_app_to_stop = getattr(app.state, 'bot_application', None)
            if bot_app_to_stop:
                bot_apps_to_stop = [bot_app_to_stop]
        
        # db_service сам ничего не закрывает, его можно не получать
        http_client_to_close = getattr(app.state, 'http_client', None)
        db_pool_to_close = getattr(app.state, 'db_pool', None) 

        # Удаление вебхуков и остановка всех Application
        if bot_apps_to_stop:
            logger.info(f"Остановка {len(bot_apps_to_stop)} Telegram Application...")
            for bot_app_to_stop in bot_apps_to_stop:
                bot_name = bot_app_to_stop.bot_data.get('company_name', 'Unknown') if hasattr(bot_app_to_stop, 'bot_data') else 'Unknown'
                
                # Удаление вебхука
                if getattr(bot_app_to_stop, 'bot', None):
                    try:
                        await bot_app_to_stop.bot.delete_webhook(drop_pending_updates=True)
                        logger.info(f"✅ Вебхук удален для бота: {bot_name}")
                    except Exception as e:
                        logger.error(f"❌ Ошибка при удалении вебхука для бота {bot_name}: {e}", exc_info=True)
                
                # Остановка Application
                try:
                    if bot_app_to_stop.running:
                        await bot_app_to_stop.stop()
                    logger.info(f"✅ Telegram Application остановлено: {bot_name}")
                except Exception as e:
                    logger.error(f"❌ Ошибка при остановке Telegram Application {bot_name}: {e}", exc_info=True)

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