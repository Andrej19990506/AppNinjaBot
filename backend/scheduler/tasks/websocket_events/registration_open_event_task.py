import logging
import httpx
from datetime import datetime, timedelta, time, date, timezone
import traceback
import os
from zoneinfo import ZoneInfo
from ..base_task import BaseTask
from core.config import SchedulerSettings
from shared.http_client import get_async_http_client
from typing import Optional, Dict, Any, TYPE_CHECKING
from services.database_service import DatabaseService 
if TYPE_CHECKING:
    from tasks.task_manager import TaskManager

logger = logging.getLogger(__name__)

# --- Статическая функция-обертка для APScheduler --- 
async def execute_job(chat_id: str, db_service: DatabaseService, settings: SchedulerSettings, task_manager: 'TaskManager', task_type: str = None, scheduler_instance = None):
    """Статическая обертка, вызываемая APScheduler.
       Выполняет основную логику задачи и запускает перепланирование.
    """
    logger.info(f"[RegOpenEventTask.execute_job] Запуск для chat_id: {chat_id} (тип: {task_type})")
    task_success = False
    try:
        task_instance = RegistrationOpenEventTask(scheduler_instance=None, task_manager=None, settings=settings)
        await task_instance.execute(chat_id, db_service, settings)
        task_success = True
    except Exception as e:
        logger.error(f"[RegOpenEventTask.execute_job] Ошибка при выполнении для chat_id {chat_id}: {e}")
        logger.error(traceback.format_exc())
        task_success = False
        
    # --- Перепланирование --- 
    logger.info(f"[RegOpenEventTask.execute_job] Запуск перепланирования для chat_id: {chat_id}")
    try:
        if task_manager and hasattr(task_manager, 'schedule_registration_open_event'):
            await task_manager.schedule_registration_open_event(chat_id)
            logger.info(f"[RegOpenEventTask.execute_job] Перепланирование для {chat_id} успешно инициировано.")
        else:
            logger.error(f"[RegOpenEventTask.execute_job] TaskManager недоступен. Не удалось перепланировать задачу для {chat_id}.")
    except Exception as reschedule_err:
        logger.error(f"[RegOpenEventTask.execute_job] Ошибка при перепланировании для {chat_id}: {reschedule_err}")
        logger.error(traceback.format_exc())


class RegistrationOpenEventTask(BaseTask):
    TASK_TYPE = 'registration_open_event'

    def __init__(self, scheduler_instance, task_manager, settings):
        """
        Задача для отправки NOTIFY события при открытии регистрации.
        """
        super().__init__(scheduler_instance, task_manager, settings)
        logger.info(f"RegistrationOpenEventTask инициализирован. API URL: {self.settings.API_URL}")

    async def _get_access_settings_from_api(self, chat_id, settings: SchedulerSettings) -> Optional[Dict[str, Any]]:
        """Получает настройки доступа для чата из API сервера (асинхронно)."""
        try:
            chat_id_param = str(chat_id)
            base_url = str(settings.API_URL).rstrip('/')
            url = f"{base_url}/api/v1/groups/{chat_id_param}/settings"
            logger.info(f"({self.TASK_TYPE}) Запрос настроек доступа (async): {url}")
            client = await get_async_http_client()
            response = await client.get(url, timeout=10)
            response.raise_for_status()
            settings_data = response.json()
            logger.info(f"({self.TASK_TYPE}) Настройки доступа для чата {chat_id} получены из API (async): {settings_data}")
            return settings_data
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"({self.TASK_TYPE}) Настройки для группы {chat_id} не найдены (404) в API.")
            else:
                logger.error(f"({self.TASK_TYPE}) ❌ Ошибка статуса HTTP при получении настроек доступа для {chat_id}: {e}")
            return None
        except httpx.RequestError as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка HTTP при получении настроек доступа для {chat_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Неизвестная ошибка при получении настроек доступа для {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return None

    # Метод расчета остается синхронным, но используем ZoneInfo
    def _calculate_next_registration_time(self, now: datetime, weekday: int, hour: int, minute: int, period_length: int, active_start_date_str: Optional[str], settings: SchedulerSettings) -> Optional[datetime]:
        """
        Вычисляет следующее время открытия регистрации с учетом periodLength.
        Использует ту же логику, что и shift_access_task.
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
                
            # now должно быть timezone-aware
            if now.tzinfo is None:
                logger.warning(f"({self.TASK_TYPE}) ⚠️ Переданное 'now' не содержит TZ. Используем текущее время с tz.")
                now = datetime.now(tz)
            else:
                # Убедимся, что now в правильной таймзоне
                now = now.astimezone(tz)

            python_weekday = (int(weekday) - 1 + 7) % 7
            
            # Находим ближайший день недели (python_weekday) назад от now
            days_back_to_target = (now.weekday() - python_weekday + 7) % 7
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
            
            # Определяем якорь для расчёта циклов
            if active_start_date_str:
                try:
                    anchor_dt = datetime.fromisoformat(active_start_date_str).replace(tzinfo=tz)
                    # Находим первый python_weekday от якоря
                    days_to_target = (python_weekday - anchor_dt.weekday() + 7) % 7
                    anchor_dt = anchor_dt + timedelta(days=days_to_target)
                    anchor_dt = anchor_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
                except Exception as e:
                    logger.warning(f"({self.TASK_TYPE}) ⚠️ Не удалось распарсить activeStartDate '{active_start_date_str}': {e}. Используем fallback.")
                    active_start_date_str = None
            
            if not active_start_date_str:
                # Fallback: используем первый python_weekday 2024 года
                anchor_dt = datetime(2024, 1, 1, hour, minute, tzinfo=tz)
                days_to_target = (python_weekday - anchor_dt.weekday() + 7) % 7
                anchor_dt = anchor_dt + timedelta(days=days_to_target)
            
            # Нормализуем даты к полуночи для подсчёта дней
            last_target_normalized = last_target_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            anchor_normalized = anchor_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Считаем разницу в днях
            days_diff = (last_target_normalized - anchor_normalized).days
            
            # Находим остаток от деления на period_length
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
            logger.error(f"({self.TASK_TYPE}) Ошибка при расчете времени: {e}")
            logger.error(traceback.format_exc())
            return None

    # Делаем schedule асинхронным
    async def schedule(self, chat_id) -> bool:
        """Планирует задачу уведомления об открытии регистрации (асинхронно)."""
        try:
            chat_id_str = str(chat_id)
            logger.info(f"=== ({self.TASK_TYPE}) Планирование события WS для чата {chat_id_str} (async) ===")

            access_settings = await self._get_access_settings_from_api(chat_id_str, self.settings)
            if not access_settings:
                # ✅ Используем фиксированный ID без timestamp (как у courier_shift_access)
                task_id = f"{self.TASK_TYPE}_{chat_id_str}"
                # Попытаемся удалить задачу из планировщика и БД
                await self.task_manager.delete_task(task_id) 
                logger.info(f"({self.TASK_TYPE}) Удалена задача {task_id} (если была), т.к. настройки не найдены.")
                return False

            # Рассчитываем следующее время запуска
            # Используем ZoneInfo для now
            now = datetime.now(ZoneInfo(self.settings.TIMEZONE))
            period_length = access_settings.get("periodLength", 7)
            active_start_date = access_settings.get("activeStartDate")
            next_opening_date = access_settings.get("nextOpeningDate")
            
            # ✅ Если есть nextOpeningDate из API - используем его напрямую
            if next_opening_date:
                try:
                    # Парсим ISO формат с таймзоной
                    next_registration = datetime.fromisoformat(next_opening_date.replace('Z', '+00:00'))
                    if next_registration.tzinfo is None:
                        # Если нет таймзоны, добавляем
                        tz = ZoneInfo(self.settings.TIMEZONE)
                        next_registration = next_registration.replace(tzinfo=tz)
                    else:
                        # Конвертируем в нужную таймзону
                        tz = ZoneInfo(self.settings.TIMEZONE)
                        next_registration = next_registration.astimezone(tz)
                    logger.info(f"({self.TASK_TYPE}) Используем nextOpeningDate из API: {next_registration}")
                except Exception as e:
                    logger.warning(f"({self.TASK_TYPE}) ⚠️ Не удалось распарсить nextOpeningDate '{next_opening_date}': {e}. Используем расчет.")
                    next_registration = self._calculate_next_registration_time(
                        now, 
                        access_settings.get("registrationStartDay"), 
                        access_settings.get("registrationStartHour"), 
                        access_settings.get("registrationStartMinute"),
                        period_length,
                        active_start_date,
                        self.settings
                    )
            else:
                # Если nextOpeningDate нет - рассчитываем
                next_registration = self._calculate_next_registration_time(
                    now, 
                    access_settings.get("registrationStartDay"), 
                    access_settings.get("registrationStartHour"), 
                    access_settings.get("registrationStartMinute"),
                    period_length,
                    active_start_date,
                    self.settings
                )

            if not next_registration:
                logger.error(f"({self.TASK_TYPE}) Не удалось рассчитать время следующего запуска для {chat_id_str}.")
                return False

            # ✅ Удаляем все старые задачи для этого чата перед созданием новой (как у courier_shift_access)
            logger.info(f"({self.TASK_TYPE}) 🧹 Удаление старых задач для чата {chat_id_str}")
            await self.task_manager.delete_tasks_by_chat_and_type(chat_id_str, self.TASK_TYPE)
            
            # ✅ Используем фиксированный ID без timestamp (как у courier_shift_access)
            task_id = f"{self.TASK_TYPE}_{chat_id_str}"
            task_data = {
                 'comment': f'WS event trigger for {chat_id_str}'
            }
            
            # --- ИСПОЛЬЗУЕМ TaskManager.save_task --- 
            save_result = await self.task_manager.save_task(
                 task_id, 
                 chat_id_str, 
                 self.TASK_TYPE, 
                 next_registration, 
                 task_data
            )
            # ----------------------------------------

            if save_result:
                logger.info(f"({self.TASK_TYPE}) ✅ Задача {task_id} успешно передана в TaskManager для сохранения и планирования на {next_registration} (async)")
                return True
            else:
                logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при сохранении/планировании задачи {task_id} через TaskManager")
                return False

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при планировании задачи для {chat_id_str}: {e}")
            logger.error(traceback.format_exc())
            return False

    # Переименовываем _do_execute обратно в execute и принимаем db_service, settings
    async def execute(self, chat_id, db_service: DatabaseService, settings: SchedulerSettings):
        """Выполняет отправку NOTIFY через DatabaseService и уведомляет API сервер об открытии доступа."""
        logger.info(f"=== ({self.TASK_TYPE}) Выполнение задачи для чата {chat_id} (async) ===")
        try:
            if not db_service:
                logger.error(f"({self.TASK_TYPE}) ❌ DatabaseService недоступен. Невозможно отправить NOTIFY.")
                return False
            chat_id_str = str(chat_id)
           
            # ✅ УВЕДОМЛЯЕМ API СЕРВЕР об открытии доступа
            # Вызываем GET /api/v1/groups/{chat_id}/settings, который автоматически обновит activeStartDate
            try:
                if settings.API_URL:
                    api_url = str(settings.API_URL).rstrip('/')
                    settings_url = f"{api_url}/api/v1/groups/{chat_id_str}/settings"
                    logger.info(f"({self.TASK_TYPE}) 🔔 Уведомляем API сервер об открытии доступа: {settings_url}")
                    
                    client = await get_async_http_client()
                    headers = {
                        'X-Request-Source': 'scheduler-registration-open-event',
                        'User-Agent': 'Scheduler/1.0'
                    }
                    response = await client.get(settings_url, headers=headers, timeout=10)
                    response.raise_for_status()
                    logger.info(f"({self.TASK_TYPE}) ✅ API сервер уведомлен об открытии доступа для {chat_id_str}, статус: {response.status_code}")
                else:
                    logger.warning(f"({self.TASK_TYPE}) ⚠️ API_URL не указан, пропускаем уведомление API сервера")
            except Exception as api_error:
                logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при уведомлении API сервера: {api_error}")
                # Не прерываем выполнение, продолжаем отправку WebSocket события

            # Формируем payload для NOTIFY
            payload_dict = {
                'type': 'SHIFT_ACCESS_SENT',
                'chat_id': chat_id_str,
                'timestamp': datetime.now(timezone.utc).isoformat() + 'Z',
                'source': 'scheduler_task_execution'
            }
            
            # Канал для уведомления
            channel = 'websocket_channel'
            env = os.getenv('ENVIRONMENT', 'development')
            if env == 'development':
                logger.info(f"🔥🔥🔥 DEV ОКРУЖЕНИЕ: ({self.TASK_TYPE}) Отправка события SHIFT_ACCESS_SENT в канал '{channel}' для chat_id: {chat_id_str} 🔥🔥🔥")
            elif env == 'production':
                logger.info(f"🔴🔴🔴 PROD ОКРУЖЕНИЕ: ({self.TASK_TYPE}) Отправка события SHIFT_ACCESS_SENT в канал '{channel}' для chat_id: {chat_id_str} 🔴🔴🔴")
            else:
                logger.info(f"({self.TASK_TYPE}) Отправка NOTIFY в канал '{channel}' для chat_id: {chat_id_str}")
            
            # Вызываем метод DatabaseService
            notify_success = await db_service.notify_websocket(channel, payload_dict)
            
            if notify_success:
                logger.info(f"({self.TASK_TYPE}) ✅ NOTIFY для {chat_id_str} успешно отправлен через DatabaseService.")
                return True
            else:
                logger.error(f"({self.TASK_TYPE}) ❌ DatabaseService не смог отправить NOTIFY для {chat_id_str}.")
                return False

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Неожиданная ошибка при выполнении задачи для {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False 