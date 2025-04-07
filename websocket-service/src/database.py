import os
import json
import logging
import asyncio
import asyncpg
import socketio

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Загрузка переменных окружения
# load_dotenv()

# Получаем параметры подключения из переменных окружения
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'appninjabot')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')

# Канал для прослушивания
PG_CHANNEL = 'websocket_channel'

# --- НОВАЯ АСИНХРОННАЯ ФУНКЦИЯ СЛУШАТЕЛЯ ---
async def listen_for_notifications(sio: socketio.AsyncServer):
    """
    Подключается к PostgreSQL, слушает канал PG_CHANNEL
    и пересылает уведомления через Socket.IO.
    """
    logger.info(f"Запуск слушателя PostgreSQL для канала '{PG_CHANNEL}'...")
    conn = None
    stop_event = asyncio.Event() # Событие для сигнала остановки

    async def _notification_handler(connection, pid, channel, payload):
        """Обработчик уведомлений от asyncpg."""
        logger.info(f"Получен NOTIFY на канале '{channel}' от PID {pid}")
        try:
            data = json.loads(payload)
            logger.info(f"Payload: {data}")

            event_type = data.get('type')
            chat_id = data.get('chat_id')
            # Другие данные могут быть в data.get('data') или просто в data

            if not event_type or not chat_id:
                logger.warning("Получено уведомление без 'type' или 'chat_id' в payload.")
                return

            # Определяем комнату Socket.IO (должна быть 'couriers_<chat_id>')
            # room_name = str(chat_id) # Старая логика
            room_name = f"couriers_{chat_id}" # Новая логика с префиксом
            logger.info(f"Целевая комната: {room_name}") # Добавим лог для проверки

            logger.info(f"Отправка события '{event_type}' в комнату '{room_name}'")
            # Отправляем событие клиентам в нужной комнате
            await sio.emit(event_type, data, room=room_name)
            logger.info(f"✅ Событие '{event_type}' успешно отправлено в комнату '{room_name}'")

        except json.JSONDecodeError:
            logger.error(f"Ошибка декодирования JSON из payload: {payload}")
        except Exception as e:
            logger.error(f"Ошибка при обработке уведомления или отправке sio.emit: {e}")
            logger.exception("Стек ошибки обработчика уведомлений:")

    async def _keep_listening():
        nonlocal conn # Разрешаем изменять conn во внешней области видимости
        while not stop_event.is_set():
            try:
                if conn is None or conn.is_closed():
                    logger.info("Подключение к PostgreSQL для LISTEN...")
                    conn = await asyncpg.connect(
                        user=POSTGRES_USER,
                        password=POSTGRES_PASSWORD,
                        database=POSTGRES_DB,
                        host=POSTGRES_HOST,
                        port=POSTGRES_PORT
                    )
                    await conn.add_listener(PG_CHANNEL, _notification_handler)
                    logger.info(f"✅ Успешно подключен и слушаю канал '{PG_CHANNEL}'")

                # Просто ждем событий, add_listener работает в фоне
                # Можно добавить проверку соединения раз в N секунд, если нужно
                await asyncio.sleep(30) # Проверка каждые 30 сек

            except (asyncpg.PostgresConnectionError, ConnectionRefusedError, OSError) as e:
                logger.error(f"Ошибка подключения/связи с PostgreSQL: {e}. Повторная попытка через 5 секунд...")
                if conn:
                    try: await conn.close()
                    except: pass
                conn = None
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Непредвиденная ошибка в цикле слушателя: {e}")
                logger.exception("Стек ошибки цикла слушателя:")
                if conn:
                    try: await conn.close()
                    except: pass
                conn = None
                await asyncio.sleep(10) # Пауза подольше при непонятных ошибках

        # Завершение работы
        logger.info("Слушатель PostgreSQL получил сигнал остановки.")
        if conn and not conn.is_closed():
            try:
                logger.info("Удаление слушателя и закрытие соединения с PostgreSQL...")
                await conn.remove_listener(PG_CHANNEL, _notification_handler)
                await conn.close()
                logger.info("Соединение PostgreSQL для слушателя успешно закрыто.")
            except Exception as e:
                logger.error(f"Ошибка при закрытии соединения PostgreSQL: {e}")

    # Запускаем основной цикл слушателя
    listener_task = asyncio.create_task(_keep_listening())

    # Возвращаем задачу и событие остановки, чтобы внешний код мог управлять
    return listener_task, stop_event

# --- УДАЛЯЕМ СТАРУЮ СИНХРОННУЮ ФУНКЦИЮ ---
# async def subscribe_to_events(callback):
#    ... (старый код) ... 