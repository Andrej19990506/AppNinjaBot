import os
import json
import logging
import asyncio
import asyncpg
import socketio

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Получаем параметры подключения из переменных окружения
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'appninjabot')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')

# Канал для прослушивания
PG_CHANNEL = 'websocket_channel'


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
            
          
            if not event_type:
                logger.warning("Получено уведомление без 'type' в payload.")
                return
                
            if event_type == 'profile_updated':
                logger.info(f"Отправка ГЛОБАЛЬНОГО события '{event_type}'")
                await sio.emit(event_type, data)
                logger.info(f"✅ ГЛОБАЛЬНОЕ событие '{event_type}' успешно отправлено.")
            elif event_type == 'template_updated':
                logger.info(f"Отправка ГЛОБАЛЬНОГО события '{event_type}' - обновление шаблона инвентаря")
                await sio.emit(event_type, data)
                logger.info(f"✅ ГЛОБАЛЬНОЕ событие '{event_type}' успешно отправлено всем клиентам")
            elif event_type == 'user_permissions_changed':
                user_id = data.get('user_id')
                group_id = data.get('group_id')
                
                if user_id and group_id:
                    # Отправляем уведомление в персональную комнату пользователя
                    user_room = f"user_{user_id}_group_{group_id}"
                    await sio.emit('permissions_changed', data, room=user_room)
                    logger.info(f"✅ Уведомление об изменении прав отправлено пользователю {user_id} в комнату {user_room}")
                else:
                    logger.warning(f"Получено уведомление user_permissions_changed без user_id ({user_id}) или group_id ({group_id})")
            else:
                chat_id = data.get('chat_id')
                if not chat_id:
                    logger.warning(f"Получено уведомление типа '{event_type}' без 'chat_id' в payload.")
                    return
                    
                room_name = None
                if event_type == 'inventory_updated' or event_type == 'inventory_reset':
                    room_name = f"inventory_{chat_id}" # Комната для инвентаря
                elif event_type in ['reserve_added', 'reserve_removed', 'shifts_updated', 'shift_cancelled', 'bulk_reserve_removed', 'reserve_transferred_to_shift', 'shift_access_sent']: 
                    room_name = str(chat_id)
                else:
                    logger.warning(f"Неизвестный тип события '{event_type}' для отправки в комнату.")
                    return 

                logger.info(f"Отправка события '{event_type}' в комнату '{room_name}'")
                await sio.emit(event_type, data, room=room_name)
                logger.info(f"✅ Событие '{event_type}' успешно отправлено в комнату '{room_name}'")


        except json.JSONDecodeError:
            logger.error(f"Ошибка декодирования JSON из payload: {payload}")
        except Exception as e:
            logger.error(f"Ошибка при обработке уведомления или отправке sio.emit: {e}")
            logger.exception("Стек ошибки обработчика уведомлений:")

    async def _keep_listening():
        nonlocal conn 
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
                await asyncio.sleep(30)

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
                await asyncio.sleep(10)

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

