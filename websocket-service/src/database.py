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
            
            # <<< ИЗМЕНЕННАЯ ЛОГИКА ОБРАБОТКИ >>>
            if not event_type:
                logger.warning("Получено уведомление без 'type' в payload.")
                return
                
            if event_type == 'profile_updated':
                # Отправляем всем подключенным (без указания комнаты)
                logger.info(f"Отправка ГЛОБАЛЬНОГО события '{event_type}'")
                await sio.emit(event_type, data) # Убираем room=...
                logger.info(f"✅ ГЛОБАЛЬНОЕ событие '{event_type}' успешно отправлено.")
            else:
                # Для остальных событий ожидаем chat_id
                chat_id = data.get('chat_id')
                if not chat_id:
                    logger.warning(f"Получено уведомление типа '{event_type}' без 'chat_id' в payload.")
                    return
                    
                # <<< ИСПРАВЛЕНИЕ: Определяем комнату на основе event_type >>>
                room_name = None
                if event_type == 'inventory_updated' or event_type == 'inventory_reset':
                    room_name = f"inventory_{chat_id}" # Комната для инвентаря
                elif event_type in ['reserve_added', 'reserve_removed', 'shifts_updated', 'shift_cancelled', 'bulk_reserve_removed', 'reserve_transferred_to_shift', 'shift_access_sent']: 
                    room_name = str(chat_id) # <<< ОТПРАВЛЯЕМ В КОМНАТУ С ID ЧАТА >>>
                else:
                    logger.warning(f"Неизвестный тип события '{event_type}' для отправки в комнату.")
                    return # Не отправляем, если не знаем куда

                logger.info(f"Отправка события '{event_type}' в комнату '{room_name}'")
                await sio.emit(event_type, data, room=room_name)
                logger.info(f"✅ Событие '{event_type}' успешно отправлено в комнату '{room_name}'")
            # <<< КОНЕЦ ИЗМЕНЕННОЙ ЛОГИКИ >>>

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