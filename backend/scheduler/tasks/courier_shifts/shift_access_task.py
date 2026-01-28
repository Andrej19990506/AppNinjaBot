import logging
import requests
import httpx
import psycopg
from datetime import datetime, timedelta, time, date, timezone
import traceback
import os
import json
from ..base_task import BaseTask
from core.config import scheduler_settings
from zoneinfo import ZoneInfo
from typing import Optional, Dict, Any, TYPE_CHECKING
from shared.http_client import get_async_http_client
from services.database_service import DatabaseService 
from core.config import SchedulerSettings
if TYPE_CHECKING:
    from tasks.task_manager import TaskManager 

logger = logging.getLogger(__name__)


# --- Статическая функция-обертка для APScheduler --- 
async def execute_job(chat_id: str, db_service: DatabaseService, settings: SchedulerSettings, task_manager: 'TaskManager', task_type: str = None, scheduler_instance = None):
    """Статическая обертка, вызываемая APScheduler.
       Выполняет основную логику задачи и запускает перепланирование.
    """
    logger.info(f"[ShiftAccessTask.execute_job] Запуск для chat_id: {chat_id} (тип: {task_type})")
    task_success = False
    try:
        # Создаем временный экземпляр только с настройками
        task_instance = ShiftAccessTask(scheduler_instance=None, task_manager=None, settings=settings)
        await task_instance.execute(chat_id, settings) 
        task_success = True
    except Exception as e:
        logger.error(f"[ShiftAccessTask.execute_job] Ошибка при выполнении для chat_id {chat_id}: {e}")
        logger.error(traceback.format_exc())
        task_success = False
    # Перепланируем задачу независимо от успеха
    logger.info(f"[ShiftAccessTask.execute_job] Запуск перепланирования для chat_id: {chat_id}")
    try:
        if task_manager and hasattr(task_manager, 'schedule_shift_access'):
            await task_manager.schedule_shift_access(chat_id) 
            logger.info(f"[ShiftAccessTask.execute_job] Перепланирование для {chat_id} успешно инициировано.")
        else:
            logger.error(f"[ShiftAccessTask.execute_job] TaskManager недоступен. Не удалось перепланировать задачу для {chat_id}.")
    except Exception as reschedule_err:
        logger.error(f"[ShiftAccessTask.execute_job] Ошибка при перепланировании для {chat_id}: {reschedule_err}")
        logger.error(traceback.format_exc())
# --------------------------------------------------

class ShiftAccessTask(BaseTask):
    TASK_TYPE = 'courier_shift_access'

    def __init__(self, scheduler_instance, task_manager, settings):
        """
        Задача для УВЕДОМЛЕНИЯ В ТЕЛЕГРАМ об открытии доступа к сменам курьеров.
        """
        super().__init__(scheduler_instance, task_manager, settings)
        logger.info(f"ShiftAccessTask инициализирован. API URL: {self.settings.API_URL}. Telegram Bot API URL: {getattr(self.settings, 'BOT_API_URL', 'Не задан')}")

    async def _get_access_settings_from_api(self, chat_id, settings: scheduler_settings):
        """Получает настройки доступа для чата из API сервера (асинхронно)."""
        try:
            chat_id_param = str(chat_id)
            base_api_url = str(settings.API_URL).rstrip('/')
            url = f"{base_api_url}/api/v1/groups/{chat_id_param}/settings"
            logger.info(f"({self.TASK_TYPE}) Запрос настроек доступа (async): {url}")
            client = await get_async_http_client()
            response = await client.get(url, timeout=10)
            response.raise_for_status() 
            settings_data = response.json()
            logger.info(f"({self.TASK_TYPE}) Настройки доступа для чата {chat_id} получены из API (async): {settings_data}")
            await client.aclose()
            return settings_data
        except httpx.HTTPStatusError as e:
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

    async def schedule(self, chat_id):
        """Планирует задачу уведомления в телеграм (асинхронно)"""
        try:
            chat_id_str = str(chat_id)
            logger.info(f"=== ({self.TASK_TYPE}) Планирование уведомления в телеграм для чата {chat_id_str} (async) ===")
            access_settings = await self._get_access_settings_from_api(chat_id_str, self.settings)
            if not access_settings:
                logger.error(f"({self.TASK_TYPE}) ❌ Настройки доступа не найдены в API для {chat_id_str}. Планирование отменено (async).")
                # Удаляем все задачи для этого чата
                await self.task_manager.delete_tasks_by_chat_and_type(chat_id_str, self.TASK_TYPE)
                return False
            registration_day = access_settings.get("registrationStartDay")
            registration_hour = access_settings.get("registrationStartHour")
            registration_minute = access_settings.get("registrationStartMinute")
            period_length = access_settings.get("periodLength", 7)
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
            
            # Удаляем все старые задачи для этого чата перед созданием новой
            logger.info(f"({self.TASK_TYPE}) 🧹 Удаление старых задач для чата {chat_id_str}")
            await self.task_manager.delete_tasks_by_chat_and_type(chat_id_str, self.TASK_TYPE)
            
            # Генерируем стабильный ID БЕЗ timestamp
            task_id = f"{self.TASK_TYPE}_{chat_id_str}"
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
        """
        Рассчитывает следующее время запуска с использованием правильной логики циклов.
        ИСПРАВЛЕНО: Использует якорь (activeStartDate) для определения валидных дней регистрации.
        """
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
            
            # Находим ближайший день недели (target_weekday) назад от now
            days_back_to_target = (now.weekday() - target_weekday + 7) % 7
            if days_back_to_target == 0:
                # Сегодня - целевой день, проверяем время
                candidate_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                if now < candidate_dt:
                    # Время ещё не наступило сегодня
                    logger.info(f"({self.TASK_TYPE}) Расчет: Время {candidate_dt} ещё не наступило сегодня. Планируем на него.")
                    return candidate_dt
                # Время уже прошло, берём вчерашний целевой день
                days_back_to_target = 7
            
            last_target_dt = now - timedelta(days=days_back_to_target)
            last_target_dt = last_target_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # Получаем activeStartDate из настроек API (если есть)
            active_start_date_str = None
            try:
                # Пробуем получить из переданных настроек или делаем запрос к API
                # (в данном контексте у нас нет прямого доступа к activeStartDate, 
                # поэтому используем упрощённую логику)
                pass
            except:
                pass
            
            # Определяем якорь для расчёта циклов
            if active_start_date_str:
                anchor_dt = datetime.fromisoformat(active_start_date_str).replace(tzinfo=tz)
                # Находим первый target_weekday от якоря
                days_to_target = (target_weekday - anchor_dt.weekday() + 7) % 7
                anchor_dt = anchor_dt + timedelta(days=days_to_target)
            else:
                # Fallback: используем первый target_weekday 2024 года
                anchor_dt = datetime(2024, 1, 1, hour, minute, tzinfo=tz)
                days_to_target = (target_weekday - anchor_dt.weekday() + 7) % 7
                anchor_dt = anchor_dt + timedelta(days=days_to_target)
            
            # Нормализуем даты к полуночи для подсчёта дней
            last_target_normalized = last_target_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            anchor_normalized = anchor_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Считаем разницу в днях
            days_diff = (last_target_normalized - anchor_normalized).days
            
            # Находим остаток от деления на periodLength
            remainder = days_diff % period_length
            
            # Если остаток не 0, значит last_target_dt НЕ валидный день регистрации
            # Отматываем назад на остаток
            if remainder != 0:
                last_target_dt = last_target_dt - timedelta(days=remainder)
                logger.info(f"({self.TASK_TYPE}) Корректировка: Последний день {last_target_dt} не в цикле, откатываем на {remainder} дней")
            
            # Следующая регистрация = последняя + period_length
            next_registration_dt = last_target_dt + timedelta(days=period_length)
            
            logger.info(f"({self.TASK_TYPE}) Расчет: Последняя регистрация={last_target_dt.strftime('%Y-%m-%d %H:%M')}, Период={period_length}, Следующая={next_registration_dt.strftime('%Y-%m-%d %H:%M')}")
            return next_registration_dt
            
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка в _calculate_next_registration_time: {e}")
            logger.error(traceback.format_exc())
            return None

    async def execute(self, chat_id, settings: scheduler_settings):
        """Выполняет основную логику задачи - отправку уведомления."""
        if not chat_id:
            logger.error(f"({self.TASK_TYPE}) ❌ Не передан chat_id для выполнения задачи.")
            return
        chat_id_str = str(chat_id)
        logger.info(f"({self.TASK_TYPE}) ▶️ Выполнение задачи для чата: {chat_id_str}")
        access_settings = await self._get_access_settings_from_api(chat_id_str, settings)
        if not access_settings:
            logger.error(f"({self.TASK_TYPE}) ❌ Не удалось получить настройки для {chat_id_str} перед отправкой. Задача не будет выполнена.")
            return 
        success = await self._send_notification(chat_id_str, settings)
        if success:
            logger.info(f"({self.TASK_TYPE}) ✅ Основное действие (отправка уведомления) для {chat_id_str} успешно завершено.")

    async def _get_company_bot_url_for_group(self, chat_id: str, settings: scheduler_settings) -> Optional[str]:
        """Получает URL бота компании для группы через API."""
        try:
            chat_id_int = int(chat_id)
            base_api_url = str(settings.API_URL).rstrip('/')
            # Получаем информацию о боте компании для этой группы
            url = f"{base_api_url}/api/v1/company-bots/by-group/{chat_id_int}"
            logger.info(f"({self.TASK_TYPE}) Запрос бота компании для группы {chat_id}: {url}")
            
            client = await get_async_http_client()
            try:
                response = await client.get(url, timeout=10)
                if response.status_code == 200:
                    bot_data = response.json()
                    # Получаем URL бота компании из ответа API
                    bot_api_url = bot_data.get('bot_api_url')
                    if bot_api_url:
                        # В dev окружении заменяем http://bot:8003 на http://bot-companies:8003
                        import os
                        env = os.getenv('ENVIRONMENT', 'development')
                        if env == 'development' and 'http://bot:8003' in str(bot_api_url):
                            bot_api_url = str(bot_api_url).replace('http://bot:8003', 'http://bot-companies:8003')
                            logger.info(f"({self.TASK_TYPE}) 🔄 Заменен URL бота с http://bot:8003 на http://bot-companies:8003 для dev окружения")
                        logger.info(f"({self.TASK_TYPE}) ✅ Найден бот компании для группы {chat_id}: {bot_data.get('company_name', 'Unknown')}, URL: {bot_api_url}")
                        return str(bot_api_url).rstrip('/')
                    else:
                        logger.warning(f"({self.TASK_TYPE}) ⚠️ Бот компании найден, но bot_api_url не указан. Используем основной BOT_API_URL.")
                        return str(settings.BOT_API_URL).rstrip('/') if hasattr(settings, 'BOT_API_URL') and settings.BOT_API_URL else None
                elif response.status_code == 404:
                    logger.warning(f"({self.TASK_TYPE}) ⚠️ Бот компании не найден для группы {chat_id}. Используем основной BOT_API_URL.")
                    return str(settings.BOT_API_URL).rstrip('/') if hasattr(settings, 'BOT_API_URL') and settings.BOT_API_URL else None
                else:
                    logger.warning(f"({self.TASK_TYPE}) ⚠️ Ошибка при получении бота компании для группы {chat_id}: {response.status_code}. Используем основной BOT_API_URL.")
                    return str(settings.BOT_API_URL).rstrip('/') if hasattr(settings, 'BOT_API_URL') and settings.BOT_API_URL else None
            finally:
                await client.aclose()
        except Exception as e:
            logger.warning(f"({self.TASK_TYPE}) ⚠️ Ошибка при получении бота компании для группы {chat_id}: {e}. Используем основной BOT_API_URL.")
            return str(settings.BOT_API_URL).rstrip('/') if hasattr(settings, 'BOT_API_URL') and settings.BOT_API_URL else None

    async def _send_notification(self, chat_id: str, settings: scheduler_settings) -> bool:
        """Отправляет уведомление через API телеграм-бота компании для этой группы."""
        # Получаем URL бота компании для этой группы
        bot_url = await self._get_company_bot_url_for_group(chat_id, settings)
        if not bot_url:
            logger.error(f"({self.TASK_TYPE}) ❌ Не удалось определить URL бота для группы {chat_id}.")
            return False
            
        logger.info(f"({self.TASK_TYPE}) Используется бот компании для группы {chat_id}: {bot_url}")
                
        api_endpoint = f"{bot_url}/send_message"
        message_text = "Доступ к записи на смены открыт!"
        payload = {
            "chat_id": chat_id,
            "text": message_text,
            "parse_mode": "HTML"
        }
        logger.info(f"({self.TASK_TYPE}) Отправка уведомления в Telegram Bot API: {api_endpoint}, Payload: {payload}")
        
        try:
            client = await get_async_http_client()
            try:
                response = await client.post(api_endpoint, json=payload)
                if response.status_code == 200:
                    logger.info(f"({self.TASK_TYPE}) ✅ Уведомление успешно отправлено в Telegram Bot API компании.")
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