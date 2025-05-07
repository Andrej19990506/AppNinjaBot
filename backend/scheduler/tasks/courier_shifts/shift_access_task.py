import logging
import requests
import httpx
import psycopg # Добавляем импорт psycopg
# from psycopg2.extras import RealDictCursor # Убираем зависимость от psycopg2
from datetime import datetime, timedelta, time, date, timezone
import traceback
import os
import json # Добавляем импорт json
from ..base_task import BaseTask
# Импортируем абсолютным путем
from core.config import scheduler_settings
from zoneinfo import ZoneInfo # Добавляем импорт ZoneInfo
from typing import Optional, Dict, Any, TYPE_CHECKING
# Импортируем асинхронный HTTP-клиент
from shared.http_client import get_async_http_client
# Импортируем DatabaseService и SchedulerSettings для статической функции
from services.database_service import DatabaseService 
from core.config import SchedulerSettings
# Осторожно с циклическими импортами!
# Возможно, лучше использовать TYPE_CHECKING
if TYPE_CHECKING:
    from tasks.task_manager import TaskManager 

logger = logging.getLogger(__name__)

# --- УДАЛЯЕМ блок чтения настроек БД из окружения ---
# POSTGRES_HOST = ...
# ...
# DATABASE_URL = ...
# ---------------------------------------------------

# --- Статическая функция-обертка для APScheduler --- 
async def execute_job(chat_id: str, db_service: DatabaseService, settings: SchedulerSettings, task_manager: 'TaskManager', task_type: str = None):
    """Статическая обертка, вызываемая APScheduler.
       Выполняет основную логику задачи и запускает перепланирование.
    """
    logger.info(f"[ShiftAccessTask.execute_job] Запуск для chat_id: {chat_id} (тип: {task_type})")
    task_success = False
    try:
        # Создаем временный экземпляр ТОЛЬКО с настройками
        task_instance = ShiftAccessTask(scheduler_instance=None, task_manager=None, settings=settings)
        # Передаем только chat_id и settings
        await task_instance.execute(chat_id, settings) 
        task_success = True # Считаем успехом, если execute не упал
    except Exception as e:
        logger.error(f"[ShiftAccessTask.execute_job] Ошибка при выполнении для chat_id {chat_id}: {e}")
        logger.error(traceback.format_exc())
        task_success = False
        
    # --- Перепланирование --- 
    # Перепланируем независимо от успеха выполнения основной задачи
    logger.info(f"[ShiftAccessTask.execute_job] Запуск перепланирования для chat_id: {chat_id}")
    try:
        if task_manager and hasattr(task_manager, 'schedule_shift_access'):
            # Используем await, чтобы дождаться завершения планирования
            await task_manager.schedule_shift_access(chat_id) 
            logger.info(f"[ShiftAccessTask.execute_job] Перепланирование для {chat_id} успешно инициировано.")
        else:
            logger.error(f"[ShiftAccessTask.execute_job] TaskManager недоступен. Не удалось перепланировать задачу для {chat_id}.")
    except Exception as reschedule_err:
        logger.error(f"[ShiftAccessTask.execute_job] Ошибка при перепланировании для {chat_id}: {reschedule_err}")
        logger.error(traceback.format_exc())
    # ------------------------
# --------------------------------------------------

class ShiftAccessTask(BaseTask):
    TASK_TYPE = 'courier_shift_access' # Тип задачи остается прежним

    def __init__(self, scheduler_instance, task_manager, settings):
        """
        Задача для УВЕДОМЛЕНИЯ В ТЕЛЕГРАМ об открытии доступа к сменам курьеров.
        """
        super().__init__(scheduler_instance, task_manager, settings)
        logger.info(f"ShiftAccessTask инициализирован. API URL: {self.settings.API_URL}. Telegram Bot API URL: {getattr(self.settings, 'BOT_API_URL', 'Не задан')}")

    # УДАЛЯЕМ МЕТОД ДЛЯ ДОСТУПА К БД
    # def _get_access_settings_from_db(self, chat_id): ...

    # Возвращаем асинхронный метод
    async def _get_access_settings_from_api(self, chat_id, settings: scheduler_settings):
        """Получает настройки доступа для чата из API сервера (асинхронно)."""
        try:
            chat_id_param = str(chat_id)
            # Используем основной API URL для получения настроек
            # --- ИСПРАВЛЕНИЕ: Убираем возможный слеш в конце api_url --- #
            base_api_url = str(settings.API_URL).rstrip('/')
            url = f"{base_api_url}/api/v1/groups/{chat_id_param}/settings"
            logger.info(f"({self.TASK_TYPE}) Запрос настроек доступа (async): {url}")
            
            # Используем асинхронный HTTP-клиент
            client = await get_async_http_client()
            response = await client.get(url, timeout=10)
            response.raise_for_status() 
            settings_data = response.json()
            logger.info(f"({self.TASK_TYPE}) Настройки доступа для чата {chat_id} получены из API (async): {settings_data}")
            # Закрываем клиент
            await client.aclose()
            return settings_data
        except httpx.HTTPStatusError as e:
             # Обрабатываем 404 отдельно
            if e.response.status_code == 404:
                logger.warning(f"({self.TASK_TYPE}) Настройки для группы {chat_id} не найдены (404) в API. Задача не будет запланирована.")
                return None
            else:
                 logger.error(f"({self.TASK_TYPE}) ❌ Ошибка статуса HTTP при получении настроек доступа для {chat_id}: {e}")
                 return None 
        except httpx.RequestError as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка HTTP при получении настроек доступа для {chat_id}: {e}")
            return None 
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Неизвестная ошибка при получении настроек доступа для {chat_id}: {e}")
            return None

    # Восстанавливаем асинхронный метод schedule
    async def schedule(self, chat_id):
        """Планирует задачу уведомления в телеграм (асинхронно)"""
        try:
            chat_id_str = str(chat_id)
            logger.info(f"=== ({self.TASK_TYPE}) Планирование уведомления в телеграм для чата {chat_id_str} (async) ===")

            access_settings = await self._get_access_settings_from_api(chat_id_str, self.settings)
            if not access_settings:
                logger.error(f"({self.TASK_TYPE}) ❌ Настройки доступа не найдены в API для {chat_id_str}. Планирование отменено (async).")
                task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
                try: self.scheduler.remove_job(task_id)
                except Exception: pass
                return False

            registration_day = access_settings.get("registrationStartDay")
            registration_hour = access_settings.get("registrationStartHour")
            registration_minute = access_settings.get("registrationStartMinute")
            period_length = access_settings.get("periodLength", 7) # Дефолт 7 на всякий случай

            if registration_day is None or registration_hour is None or registration_minute is None:
                 logger.error(f"({self.TASK_TYPE}) ❌ Неполные настройки времени регистрации для {chat_id_str}: {access_settings}")
                 return False

            python_weekday = (int(registration_day) - 1 + 7) % 7
            now = datetime.now(ZoneInfo(self.settings.TIMEZONE))
            
            next_registration = self._calculate_next_registration_time(
                now, python_weekday, int(registration_hour), int(registration_minute), period_length, self.settings
            )
            
            if not next_registration:
                 logger.error(f"({self.TASK_TYPE}) ❌ Не удалось рассчитать время следующей регистрации для {chat_id_str}")
                 return False
                 
            logger.info(f"({self.TASK_TYPE}) 📅 Следующее телеграм-уведомление запланировано на: {next_registration}")
            
            task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
            task_data = {'comment': f'Telegram notification for {chat_id_str}'}
            save_result = await self.task_manager.save_task(task_id, chat_id_str, self.TASK_TYPE, next_registration, task_data)
            
            if not save_result:
                 logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при сохранении/планировании задачи {task_id} через TaskManager")
                 return False
                 
            logger.info(f"({self.TASK_TYPE}) ✅ Задача {task_id} успешно передана в TaskManager для сохранения и планирования на {next_registration} (async)")
            return True

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при планировании задачи (async): {e}")
            logger.error(traceback.format_exc())
            return False

    def _calculate_next_registration_time(self, now: datetime, target_weekday: int, hour: int, minute: int, period_length: int, settings: scheduler_settings) -> Optional[datetime]:
        """Рассчитывает следующее время запуска, УЧИТЫВАЯ periodLength."""
        try:
            if not settings.TIMEZONE:
                logger.error(f"({self.TASK_TYPE}) ❌ Отсутствует настройка TIMEZONE.")
                return None
            try:
                tz = ZoneInfo(settings.TIMEZONE)
            except Exception as tz_err:
                logger.error(f"({self.TASK_TYPE}) ❌ Неверный формат TIMEZONE '{settings.TIMEZONE}': {tz_err}")
                return None

            if now.tzinfo is None:
                 logger.warning(f"({self.TASK_TYPE}) ⚠️ Переданное 'now' не содержит информации о часовом поясе. Используем текущее время с tz.")
                 now = datetime.now(tz)
            else:
                now = now.astimezone(tz)

            # 1. Рассчитываем БЛИЖАЙШЕЕ время регистрации (как в старой логике)
            days_ahead = (target_weekday - now.weekday() + 7) % 7
            next_potential_date = (now + timedelta(days=days_ahead)).date()
            immediate_next_dt_naive = datetime.combine(next_potential_date, time(hour=hour, minute=minute))
            immediate_next_dt_aware = immediate_next_dt_naive.replace(tzinfo=tz)

            # 2. Проверяем, не наступило ли оно уже СЕГОДНЯ
            # Если сегодня нужный день, и время еще не наступило
            if days_ahead == 0 and now < immediate_next_dt_aware:
                logger.info(f"({self.TASK_TYPE}) Расчет: Ближайшее время ({immediate_next_dt_aware}) еще не наступило сегодня. Планируем на него.")
                return immediate_next_dt_aware
            # Если сегодня нужный день, но время уже прошло ИЛИ наступило
            elif days_ahead == 0 and now >= immediate_next_dt_aware:
                 # Переходим к расчету на следующий цикл (через period_length)
                 logger.info(f"({self.TASK_TYPE}) Расчет: Ближайшее время ({immediate_next_dt_aware}) уже прошло сегодня. Рассчитываем следующий цикл.")
                 pass # Продолжаем выполнение функции
            # Если нужный день не сегодня (days_ahead > 0)
            else:
                logger.info(f"({self.TASK_TYPE}) Расчет: Ближайшее время ({immediate_next_dt_aware}) будет через {days_ahead} дней. Планируем на него.")
                return immediate_next_dt_aware
            
            # 3. Если мы здесь, значит время регистрации СЕГОДНЯ уже прошло.
            #    Рассчитываем следующий запуск через period_length.
            
            # 3.1 Находим дату ПОСЛЕДНЕГО прошедшего дня регистрации (target_weekday)
            #    (так как время сегодня уже прошло, последним точно был сегодняшний день)
            last_target_date = now.date()
            last_target_dt_naive = datetime.combine(last_target_date, time(hour=hour, minute=minute))
            last_target_dt_aware = last_target_dt_naive.replace(tzinfo=tz)
            # Эта дата используется как база для отсчета period_length

            # 3.2 Добавляем period_length к дате последнего запуска
            base_date_for_next = last_target_dt_aware + timedelta(days=max(1, period_length) -1)
            
            # 3.3 Находим СЛЕДУЮЩИЙ день регистрации ПОСЛЕ base_date_for_next
            days_until_next_target_day = (target_weekday - base_date_for_next.weekday() + 7) % 7
            if days_until_next_target_day == 0:
                 days_until_next_target_day = 7 
                 
            next_run_date = (base_date_for_next + timedelta(days=days_until_next_target_day)).date()
            next_run_dt_naive = datetime.combine(next_run_date, time(hour=hour, minute=minute))
            next_run_dt_aware = next_run_dt_naive.replace(tzinfo=tz)

            logger.info(f"({self.TASK_TYPE}) Расчет след. цикла: Последний зап.={last_target_dt_aware}, Period={period_length}, База+Period={base_date_for_next}, След.зап.={next_run_dt_aware}")
            return next_run_dt_aware
            
        except Exception as e:
             logger.error(f"({self.TASK_TYPE}) ❌ Ошибка в _calculate_next_registration_time: {e}")
             logger.error(traceback.format_exc())
             return None

    # Переименовываем _do_execute обратно в execute
    async def execute(self, chat_id, settings: scheduler_settings):
        """Выполняет основную логику задачи - отправку уведомления."""
        if not chat_id:
            logger.error(f"({self.TASK_TYPE}) ❌ Не передан chat_id для выполнения задачи.")
            return

        chat_id_str = str(chat_id)
        logger.info(f"({self.TASK_TYPE}) ▶️ Выполнение задачи для чата: {chat_id_str}")
        
        # Получаем актуальные настройки перед отправкой (могут понадобиться для текста уведомления)
        access_settings = await self._get_access_settings_from_api(chat_id_str, settings)
        if not access_settings:
            logger.error(f"({self.TASK_TYPE}) ❌ Не удалось получить настройки для {chat_id_str} перед отправкой. Задача не будет выполнена.")
            # Перепланирование будет обрабатываться слушателем, здесь просто выходим
            return 

        # Выполняем основное действие - отправку уведомления через Telegram Bot API
        success = await self._send_notification(chat_id_str, settings) # Убираем access_settings из аргументов

        if success:
             logger.info(f"({self.TASK_TYPE}) ✅ Основное действие (отправка уведомления) для {chat_id_str} успешно завершено.")
        else:
             logger.warning(f"({self.TASK_TYPE}) ⚠️ Основное действие (отправка уведомления) для {chat_id_str} не удалось.")
             
        # Перепланирование будет обрабатываться Event Listener'ом в TaskManager.

    # _send_notification теперь принимает settings и отправляет запрос в Telegram Bot API
    async def _send_notification(self, chat_id: str, settings: scheduler_settings) -> bool:
        """Отправляет уведомление через API телеграм-бота."""
        # Проверяем, задан ли URL API телеграм-бота
        if not hasattr(settings, 'BOT_API_URL') or not settings.BOT_API_URL:
            logger.error(f"({self.TASK_TYPE}) ❌ URL API телеграм-бота (BOT_API_URL) не задан в настройках.")
            return False
            
        # Проверяем доступность эндпоинта отправки сообщений перед отправкой
        if hasattr(settings, 'HEALTHCHECK_BOT_SEND_MESSAGE_URL') and settings.HEALTHCHECK_BOT_SEND_MESSAGE_URL:
            logger.info(f"({self.TASK_TYPE}) 🔍 Проверка доступности эндпоинта отправки сообщений перед отправкой...")
            try:
                client = await get_async_http_client()
                try:
                    health_response = await client.get(settings.HEALTHCHECK_BOT_SEND_MESSAGE_URL, timeout=5)
                    if health_response.status_code != 200:
                        logger.error(f"({self.TASK_TYPE}) ❌ Эндпоинт отправки сообщений недоступен. Статус: {health_response.status_code}. Отмена отправки.")
                        return False
                    logger.info(f"({self.TASK_TYPE}) ✅ Эндпоинт отправки сообщений доступен.")
                except Exception as health_error:
                    logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при проверке доступности эндпоинта отправки сообщений: {health_error}")
                    return False
                finally:
                    await client.aclose()
            except Exception as e:
                logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при создании HTTP-клиента: {e}")
                return False
                
        # Формируем URL и payload для эндпоинта /send_message
        # --- ИСПРАВЛЕНИЕ: Убираем возможный слеш в конце bot_api_url --- #
        base_bot_url = str(settings.BOT_API_URL).rstrip('/')
        api_endpoint = f"{base_bot_url}/send_message"  # Используем исправленный URL
        message_text = "Доступ к записи на смены открыт!"  # Стандартный текст сообщения
        payload = {
            "chat_id": chat_id,
            "text": message_text,
            "parse_mode": "HTML"  # Оставляем HTML по умолчанию
        }
        logger.info(f"({self.TASK_TYPE}) Отправка уведомления в Telegram Bot API: {api_endpoint}, Payload: {payload}")
        
        # Используем асинхронный HTTP-клиент
        try:
            client = await get_async_http_client()
            try:
                response = await client.post(api_endpoint, json=payload)
                if response.status_code == 200:
                    logger.info(f"({self.TASK_TYPE}) ✅ Уведомление успешно отправлено в Telegram Bot API.")
                    return True
                else:
                    logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при отправке уведомления в Telegram Bot API: {response.status_code}, {response.text}")
                    return False
            except Exception as e:
                logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при отправке уведомления в Telegram Bot API: {e}")
                return False
            finally:
                await client.aclose()
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при создании HTTP-клиента: {e}")
            return False 