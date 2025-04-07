import logging
import requests
import psycopg # Добавляем импорт psycopg
# from psycopg2.extras import RealDictCursor # Убираем зависимость от psycopg2
from datetime import datetime, timedelta
import traceback
import os
import json # Добавляем импорт json
from ..base_task import BaseTask

logger = logging.getLogger(__name__)

# --- Данные для подключения к PostgreSQL (берем из окружения) ---
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'db') # 'db' - имя сервиса в docker-compose
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'appninjabot')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')
DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
# -----------------------------------------------------------------

class ShiftAccessTask(BaseTask):
    TASK_TYPE = 'courier_shift_access' # Тип задачи остается прежним

    def __init__(self, scheduler_instance, task_manager, timezone, api_url):
        """
        Задача для УВЕДОМЛЕНИЯ В ТЕЛЕГРАМ об открытии доступа к сменам курьеров.
        """
        super().__init__(scheduler_instance, task_manager, timezone, api_url)
        # self.timezone = timezone # Убираем, уже есть в BaseTask
        # self.api_url = os.getenv('API_URL', 'http://nginx:80') # Убираем, уже есть в BaseTask

    # УДАЛЯЕМ МЕТОД ДЛЯ ДОСТУПА К БД
    # def _get_access_settings_from_db(self, chat_id): ...

    # ДОБАВЛЯЕМ МЕТОД ДЛЯ ПОЛУЧЕНИЯ НАСТРОЕК ИЗ API (аналогично RegistrationOpenEventTask)
    def _get_access_settings_from_api(self, chat_id):
        """Получает настройки доступа для чата из API сервера."""
        try:
            chat_id_param = str(chat_id) # Используем как есть, API принимает отрицательные
            url = f"{self.api_url}/api/v1/groups/{chat_id_param}/settings"
            logger.info(f"({self.TASK_TYPE}) Запрос настроек доступа: {url}")
            response = requests.get(url, timeout=10)
            response.raise_for_status() 
            settings = response.json()
            # Важно: API возвращает ключи в camelCase (registrationStartDay)
            logger.info(f"({self.TASK_TYPE}) Настройки доступа для чата {chat_id} получены из API: {settings}")
            return settings
        except requests.exceptions.RequestException as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка API при получении настроек доступа для {chat_id}: {e}")
            if e.response is not None and e.response.status_code == 404:
                logger.warning(f"({self.TASK_TYPE}) Настройки для группы {chat_id} не найдены (404) в API. Задача не будет запланирована.")
                return None
            return None 
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Неизвестная ошибка при получении настроек доступа для {chat_id}: {e}")
            return None

    def schedule(self, chat_id):
        """Планирует задачу уведомления в телеграм"""
        try:
            chat_id_str = str(chat_id)
            logger.info(f"=== ({self.TASK_TYPE}) Планирование уведомления в телеграм для чата {chat_id_str} ===")

            # Получаем настройки из API
            access_settings = self._get_access_settings_from_api(chat_id_str)
            if not access_settings:
                logger.error(f"({self.TASK_TYPE}) ❌ Настройки доступа не найдены в API для {chat_id_str}. Планирование отменено.")
                 # Удаляем старую задачу, если она была
                task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
                try: self.scheduler.remove_job(task_id)
                except Exception: pass
                return False

            # Используем ключи camelCase из API
            registration_day = access_settings.get("registrationStartDay")
            registration_hour = access_settings.get("registrationStartHour")
            registration_minute = access_settings.get("registrationStartMinute")
            is_always_active = access_settings.get("isAlwaysActive", True) 

            if registration_day is None or registration_hour is None or registration_minute is None:
                 logger.error(f"({self.TASK_TYPE}) ❌ Неполные настройки времени регистрации для {chat_id_str}: {access_settings}")
                 return False

            # Преобразуем день недели из формата JavaScript (0=Вс) в Python (0=Пн)
            python_weekday = (int(registration_day) - 1 + 7) % 7

            now = datetime.now(self.timezone)
            next_registration = self._calculate_next_registration_time(
                now, python_weekday, int(registration_hour), int(registration_minute)
            )
            
            if not next_registration:
                 logger.error(f"({self.TASK_TYPE}) ❌ Не удалось рассчитать время следующей регистрации для {chat_id_str}")
                 return False
                 
            logger.info(f"({self.TASK_TYPE}) 📅 Следующее телеграм-уведомление запланировано на: {next_registration}")
            
            task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
            
            # Сохраняем/обновляем задачу в базу данных (task_data можно упростить или убрать)
            task_data = {
                'comment': f'Telegram notification for {chat_id_str}'
            }
            if not self.task_manager.save_task(task_id, chat_id_str, self.TASK_TYPE, next_registration, task_data):
                 logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при сохранении задачи {task_id} в базу данных")

            # Создаем/обновляем задачу в планировщике
            job = self.scheduler.add_job(
                self.execute,
                'date',
                run_date=next_registration,
                args=[chat_id_str],
                id=task_id,
                name=f'Телеграм-уведомление о доступе к сменам для {chat_id_str}',
                replace_existing=True,
                misfire_grace_time=3600 
            )
            
            if job:
                logger.info(f"({self.TASK_TYPE}) ✅ Задача {task_id} успешно запланирована на {next_registration}")
                return True
            else:
                 logger.warning(f"({self.TASK_TYPE}) ⚠️ Задача {task_id} не была добавлена в планировщик (возможно, время уже прошло?).")
                 return False
                
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при планировании задачи: {e}")
            logger.error(traceback.format_exc())
            return False

    # Метод расчета времени остается прежним
    def _calculate_next_registration_time(self, now, weekday, hour, minute):
        days_ahead = (weekday - now.weekday() + 7) % 7
        next_run_dt_naive = (now + timedelta(days=days_ahead)).replace(
             hour=hour, minute=minute, second=0, microsecond=0
        )
        # Корректное сравнение времени с учетом TZ
        if days_ahead == 0 and now >= self.timezone.localize(next_run_dt_naive.replace(tzinfo=None)):
             next_run_dt_naive += timedelta(days=7)
             logger.info(f"({self.TASK_TYPE}) Время регистрации сегодня ({next_run_dt_naive.strftime('%H:%M')}) уже прошло. Планируем на след. неделю.")
             
        return self.timezone.localize(next_run_dt_naive.replace(tzinfo=None))

    def execute(self, chat_id=None):
        """Выполняет отправку уведомления в телеграм и перепланирование"""
        try:
            if chat_id is None:
                 logger.error(f"({self.TASK_TYPE}) Ошибка: chat_id не передан в execute.")
                 return False
                 
            chat_id_str = str(chat_id)
            logger.info(f"=== ({self.TASK_TYPE}) Выполнение задачи для чата {chat_id_str} ===")
            
            # Получаем настройки из API ПЕРЕД отправкой (чтобы проверить isAlwaysActive)
            access_settings = self._get_access_settings_from_api(chat_id_str)
            if not access_settings:
                 logger.error(f"({self.TASK_TYPE}) Не удалось получить настройки для {chat_id_str} перед отправкой. Перепланирование не будет выполнено.")
                 # Можно попробовать отправить уведомление все равно, но лучше не надо
                 return False
                 
            # Отправляем уведомление через API
            logger.info(f"({self.TASK_TYPE}) Попытка отправки телеграм-уведомления в чат {chat_id_str}...")
            success = self._send_notification(chat_id_str)
            
            # --- Отправляем NOTIFY после успешного уведомления ---
            if success:
                try:
                    logger.info(f"({self.TASK_TYPE}) Попытка отправки NOTIFY websocket_channel для chat_id: {chat_id_str}")
                    payload_dict = {
                        'type': 'registration_opened',
                        'chat_id': chat_id_str,
                        'source': 'scheduler_task_execution'
                    }
                    payload_json = json.dumps(payload_dict)

                    conn = None
                    cur = None
                    try:
                        # Используем psycopg (v3)
                        conn = psycopg.connect(DATABASE_URL, autocommit=True)
                        cur = conn.cursor()
                        # Используем pg_notify для безопасности и простоты
                        cur.execute("SELECT pg_notify(%s, %s)", ('websocket_channel', payload_json))
                        logger.info(f"({self.TASK_TYPE}) ✅ Успешно отправлен NOTIFY websocket_channel для chat_id: {chat_id_str}")
                    except Exception as notify_err:
                        logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при отправке NOTIFY для {chat_id_str}: {notify_err}")
                    finally:
                        if cur:
                            cur.close()
                        if conn:
                            conn.close()
                except Exception as outer_notify_err:
                     logger.error(f"({self.TASK_TYPE}) ❌ Внешняя ошибка при обработке NOTIFY для {chat_id_str}: {outer_notify_err}")
            # -----------------------------------------------------

            # Перепланируем только если активно
            if success and access_settings.get('isAlwaysActive', True):
                logger.info(f"({self.TASK_TYPE}) Перепланирование следующего уведомления для чата {chat_id_str}...")
                # Вызываем schedule для перепланирования
                rescheduled = self.schedule(chat_id_str)
                if not rescheduled:
                     logger.error(f"({self.TASK_TYPE}) Не удалось перепланировать уведомление для {chat_id_str}")
                     
            elif not success:
                 logger.warning(f"({self.TASK_TYPE}) Отправка уведомления для {chat_id_str} не удалась. Перепланирование не выполняется.")
            else: # success is True, but isAlwaysActive is False
                 logger.info(f"({self.TASK_TYPE}) Автоматическое перепланирование отключено (isAlwaysActive=false) для чата {chat_id_str}.")
                 # Удаляем задачу из базы, т.к. она больше не нужна
                 task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
                 try:
                     if hasattr(self.task_manager, 'delete_task'): # Проверяем наличие метода
                          self.task_manager.delete_task(task_id)
                          logger.info(f"({self.TASK_TYPE}) Задача {task_id} удалена из базы, т.к. isAlwaysActive=false.")
                     else:
                          logger.warning(f"({self.TASK_TYPE}) Метод delete_task не найден в TaskManager. Не удалось удалить задачу {task_id}.")
                 except Exception as del_err:
                      logger.error(f"({self.TASK_TYPE}) Ошибка при удалении задачи {task_id}: {del_err}")

            return success
            
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при выполнении задачи: {e}")
            logger.error(traceback.format_exc())
            # Пытаемся перепланировать даже при ошибке?
            # if chat_id: self.schedule(chat_id) # Пока не перепланируем при ошибке
            return False

    # Метод отправки уведомления остается прежним, но добавим task_type в логи
    def _send_notification(self, chat_id):
        """Отправляет уведомление о доступности смен"""
        try:
            chat_ids_to_notify = [chat_id]
            logger.info(f"({self.TASK_TYPE}) Отправка телеграм-уведомления в чат(ы): {chat_ids_to_notify}")
            
            # Формируем сообщение (оставляем как было)
            message = (
                "🎉 <b>Открылась запись на смены на следующую неделю!</b>\n\n"
                "📱 Пожалуйста, перейдите в приложение и запишитесь на удобное время:\n"
                "1️⃣ Откройте бота @NinjaSlovtsova_bot\n"
                "2️⃣ Нажмите кнопку 'Открыть приложение'\n"
                "Спешите записаться на удобное время! 🚀"
            )
            
            all_success = True
            for current_chat_id in chat_ids_to_notify:
                try:
                    notification_data = {
                        'chat_id': current_chat_id,
                        'text': message,
                        'parse_mode': 'HTML'
                    }
                    
                    response = requests.post(
                        "http://bot:8001/api/send_message", # URL бота и его эндпоинта
                        json=notification_data,
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        logger.info(f"({self.TASK_TYPE}) ✅ Уведомление успешно отправлено в чат {current_chat_id}")
                    else:
                        logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при отправке уведомления в чат {current_chat_id}: Статус {response.status_code}, Ответ: {response.text}")
                        all_success = False
                except Exception as e:
                    logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при отправке уведомления в чат {current_chat_id}: {e}")
                    all_success = False
            
            return all_success
            
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при отправке уведомлений: {e}")
            return False 