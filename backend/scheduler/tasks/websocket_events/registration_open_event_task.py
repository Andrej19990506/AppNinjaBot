import logging
import requests
import socketio
from datetime import datetime, timedelta
import traceback
import os
from dateutil import tz
from apscheduler.job import Job # Импорт для аннотации типов, если нужно
from ..base_task import BaseTask # Убедимся, что импорт правильный

# Предполагаем, что BaseTask находится там же или импортируется
# Если нет, нужно скорректировать импорт
# from ..base_task import BaseTask 
# Заглушка, если BaseTask не найден

logger = logging.getLogger(__name__)

# Переименовываем класс
class RegistrationOpenEventTask(BaseTask):
    # Используем новый тип задачи
    TASK_TYPE = 'registration_open_event' 

    def __init__(self, scheduler_instance, task_manager, timezone, api_url):
        """
        Задача для отправки WebSocket события об открытии регистрации на смены.
        """
        # Передаем все параметры в super()
        super().__init__(scheduler_instance, task_manager, timezone, api_url)
        # self.timezone = timezone # Убираем, уже есть в BaseTask
        # self.api_url = os.getenv('API_URL', 'http://nginx:80') # Убираем, уже есть в BaseTask
        
        # Оставляем специфичные для WS параметры
        self.ws_url = os.getenv('WS_URL', 'ws://websocket:8001')
        self.ws_connection_timeout = 10

    def _get_access_settings_from_api(self, chat_id):
        """Получает настройки доступа для чата из API сервера."""
        try:
            url = f"{self.api_url}/api/v1/groups/{chat_id}/settings"
            logger.info(f"({self.TASK_TYPE}) Запрос настроек доступа: {url}")
            response = requests.get(url, timeout=10)
            response.raise_for_status() # Вызовет исключение для кодов 4xx/5xx
            settings = response.json()
            logger.info(f"({self.TASK_TYPE}) Настройки доступа для чата {chat_id} получены: {settings}")
            return settings
        except requests.exceptions.RequestException as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка API при получении настроек доступа для {chat_id}: {e}")
            # Если группа не найдена (404), это может быть нормально, просто нет настроек
            if e.response is not None and e.response.status_code == 404:
                logger.warning(f"({self.TASK_TYPE}) Настройки для группы {chat_id} не найдены (404). Задача не будет запланирована.")
                return None
            # Для других ошибок пробрасываем исключение дальше или возвращаем None
            return None 
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Неизвестная ошибка при получении настроек доступа для {chat_id}: {e}")
            return None

    def _calculate_next_registration_time(self, now: datetime, settings: dict) -> datetime | None:
        """Вычисляет следующее время открытия регистрации на основе настроек."""
        try:
            registration_day = settings.get("registrationStartDay") # Ожидаем 0-6 (JS)
            registration_hour = settings.get("registrationStartHour")
            registration_minute = settings.get("registrationStartMinute")

            if registration_day is None or registration_hour is None or registration_minute is None:
                logger.error(f"({self.TASK_TYPE}) Неполные настройки времени регистрации в {settings}")
                return None
                
            # Преобразуем день недели из формата JavaScript (0=Вс, 1=Пн) в формат Python (0=Пн, 6=Вс)
            python_weekday = (int(registration_day) - 1 + 7) % 7 
            
            # Клонируем текущее время, чтобы не изменять оригинал
            reference_time = now 

            # Вычисляем, сколько дней нужно добавить до следующего дня регистрации
            days_ahead = (python_weekday - reference_time.weekday() + 7) % 7
            
            # Создаем временную метку для регистрации с точным временем
            next_run_dt_naive = (reference_time + timedelta(days=days_ahead)).replace(
                hour=int(registration_hour),
                minute=int(registration_minute),
                second=0,
                microsecond=0
            )

            # Если сегодня день регистрации, но время уже прошло, планируем на следующую неделю
            if days_ahead == 0 and reference_time >= self.timezone.localize(next_run_dt_naive.replace(tzinfo=None)):
                 next_run_dt_naive += timedelta(days=7)
                 logger.info(f"({self.TASK_TYPE}) Время регистрации сегодня ({next_run_dt_naive.strftime('%H:%M')}) уже прошло. Планируем на следующую неделю.")

            # Применяем часовой пояс
            next_run_dt_aware = self.timezone.localize(next_run_dt_naive)
            
            logger.info(f"({self.TASK_TYPE}) Следующее время открытия регистрации: {next_run_dt_aware}")
            return next_run_dt_aware
            
        except Exception as e:
             logger.error(f"({self.TASK_TYPE}) Ошибка при расчете следующего времени регистрации: {e}")
             logger.error(traceback.format_exc())
             return None

    def schedule(self, chat_id):
        """Планирует задачу уведомления об открытии регистрации."""
        try:
            chat_id_str = str(chat_id) # Используем строку для ID
            logger.info(f"=== ({self.TASK_TYPE}) Планирование WS события для чата {chat_id_str} ===")

            # Получаем настройки из API
            settings = self._get_access_settings_from_api(chat_id_str)
            if not settings:
                # Если настроек нет (например, 404), удаляем старую задачу, если она была
                task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
                try:
                    self.scheduler.remove_job(task_id)
                    logger.info(f"({self.TASK_TYPE}) Удалена предыдущая задача {task_id}, т.к. настройки не найдены.")
                except Exception:
                    pass # Задача могла и не существовать
                return False # Не планируем новую задачу

            # Рассчитываем следующее время запуска
            now = datetime.now(self.timezone)
            next_run_time = self._calculate_next_registration_time(now, settings)

            if not next_run_time:
                logger.error(f"({self.TASK_TYPE}) Не удалось рассчитать время следующего запуска для {chat_id_str}.")
                return False
                
            # Генерируем ID задачи
            task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
            
            # Сохраняем задачу в базу данных (или обновляем существующую)
            if not self.task_manager.save_task(task_id, chat_id_str, self.TASK_TYPE, next_run_time):
                 logger.error(f"({self.TASK_TYPE}) Ошибка при сохранении задачи {task_id} в БД")
                 # Не прерываем, т.к. задача может быть добавлена в scheduler ниже

            # Добавляем/обновляем задачу в планировщике APScheduler
            # replace_existing=True гарантирует, что если задача уже есть, она будет обновлена новым временем
            job: Job | None = self.scheduler.add_job(
                self.execute,
                'date',
                run_date=next_run_time,
                args=[chat_id_str],
                id=task_id,
                name=f'WS событие об открытии регистрации для {chat_id_str}',
                replace_existing=True, 
                misfire_grace_time=3600 # Если пропустили запуск, пытаемся выполнить в течение часа
            )
            
            if job:
                logger.info(f"({self.TASK_TYPE}) ✅ Задача {task_id} запланирована на {next_run_time}")
                return True
            else:
                # Это может произойти, если время уже в прошлом, add_job вернет None
                logger.warning(f"({self.TASK_TYPE}) ⚠️ Задача {task_id} не была добавлена (возможно, время прошло?).")
                # Попробуем перепланировать сразу на следующий раз
                # (Осторожно, может вызвать рекурсию, если расчет времени всегда будет в прошлом)
                # self.schedule(chat_id) # Пока закомментировано
                return False
                
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при планировании задачи: {e}")
            logger.error(traceback.format_exc())
            return False

    def _send_ws_notification(self, chat_id):
        """Отправляет WebSocket уведомление в комнату курьеров."""
        room = f'couriers_{chat_id}'
        event = 'REGISTRATION_OPENED' # Или другое имя события
        logger.info(f"({self.TASK_TYPE}) Отправка WS события '{event}' в комнату '{room}' по адресу {self.ws_url}")
        sio = None # Определяем переменную заранее
        try:
            sio = socketio.Client(reconnection=False) # Отключаем авто-реконнект для одноразовой отправки
            
            # Обработчик успешного подключения
            @sio.event
            def connect():
                logger.info(f"({self.TASK_TYPE}) WS: Успешно подключено к {self.ws_url}")
                try:
                    sio.emit(event, room=room)
                    logger.info(f"({self.TASK_TYPE}) WS: Событие '{event}' отправлено в комнату '{room}'")
                    # Отключаемся после успешной отправки
                    sio.disconnect()
                    logger.info(f"({self.TASK_TYPE}) WS: Отключено после отправки.")
                except Exception as emit_err:
                    logger.error(f"({self.TASK_TYPE}) WS: Ошибка при отправке события '{event}': {emit_err}")
                    if sio and sio.connected:
                        sio.disconnect() # Пытаемся отключиться при ошибке отправки

            # Обработчик ошибки подключения
            @sio.event
            def connect_error(data):
                logger.error(f"({self.TASK_TYPE}) WS: Ошибка подключения к {self.ws_url}: {data}")
                # Не пытаемся переподключиться, т.к. reconnection=False

            # Обработчик отключения
            @sio.event
            def disconnect():
                logger.info(f"({self.TASK_TYPE}) WS: Отключено от {self.ws_url}")

            # Пытаемся подключиться с таймаутом
            sio.connect(self.ws_url, wait_timeout=self.ws_connection_timeout)
            # wait() не нужен, т.к. disconnect вызывается асинхронно после emit
            return True # Возвращаем True, если команда на подключение и отправку дана
            
        except socketio.exceptions.ConnectionError as e:
            logger.error(f"({self.TASK_TYPE}) WS: Не удалось подключиться к {self.ws_url}: {e}")
            return False
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) WS: Неизвестная ошибка: {e}")
            logger.error(traceback.format_exc())
            # Пытаемся убедиться, что соединение закрыто, если оно было создано
            if sio and sio.connected:
                try:
                    sio.disconnect()
                except Exception as disconnect_err:
                     logger.error(f"({self.TASK_TYPE}) WS: Ошибка при принудительном отключении: {disconnect_err}")
            return False

    def execute(self, chat_id):
        """Выполняет отправку уведомления и перепланирование."""
        logger.info(f"=== ({self.TASK_TYPE}) Выполнение задачи для чата {chat_id} ===")
        success = False
        try:
            # Отправляем WebSocket уведомление
            ws_sent = self._send_ws_notification(chat_id)
            
            if ws_sent:
                logger.info(f"({self.TASK_TYPE}) Команда на отправку WS для {chat_id} выполнена.")
                # Считаем задачу успешной, если команда дана
                success = True 
            else:
                logger.error(f"({self.TASK_TYPE}) Не удалось инициировать отправку WS для {chat_id}.")
                success = False

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при выполнении задачи: {e}")
            logger.error(traceback.format_exc())
            success = False # Считаем неуспешной при любой ошибке
        
        finally:
             # Независимо от успеха отправки WS, ПЕРЕПЛАНИРУЕМ следующую задачу
             # Это важно, чтобы цикл не прервался из-за временной недоступности WS
             logger.info(f"({self.TASK_TYPE}) Перепланирование следующего WS события для {chat_id}...")
             # Используем try-except, чтобы ошибка перепланирования не сломала все
             try:
                 # Используем новое имя метода менеджера для перепланирования
                 rescheduled = self.task_manager.schedule_registration_open_event(chat_id)
                 if rescheduled:
                      logger.info(f"({self.TASK_TYPE}) Следующее WS событие для {chat_id} успешно перепланировано.")
                 else:
                      logger.error(f"({self.TASK_TYPE}) Не удалось перепланировать WS событие для {chat_id}.")
             except Exception as reschedule_err:
                 logger.error(f"Критическая ошибка при перепланировании задачи для {chat_id}: {reschedule_err}")
                 logger.error(traceback.format_exc())

        return success # Возвращаем статус отправки WS (хотя перепланирование важнее) 