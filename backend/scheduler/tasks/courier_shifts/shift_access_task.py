import logging
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import traceback
import os
from ..base_task import BaseTask

logger = logging.getLogger(__name__)

class ShiftAccessTask(BaseTask):
    def __init__(self, scheduler_instance, task_manager, timezone):
        """
        Задача для управления доступом к сменам курьеров
        :param scheduler_instance: Экземпляр планировщика APScheduler
        :param task_manager: Экземпляр TaskManager
        :param timezone: Часовой пояс для работы с датами
        """
        super().__init__(scheduler_instance, task_manager)
        self.timezone = timezone
        self.api_url = os.getenv('API_URL', 'http://nginx:80')
        self.database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@postgres:5432/appninjabot')

    def _get_access_settings_from_db(self, chat_id):
        """Получает настройки доступа для чата из базы данных"""
        try:
            with psycopg2.connect(self.database_url) as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute("""
                        SELECT * FROM access_settings 
                        WHERE chat_id = %s
                    """, (str(chat_id),))
                    result = cursor.fetchone()
                    return dict(result) if result else None
        except Exception as e:
            logger.error(f"❌ Ошибка при получении настроек доступа: {str(e)}")
            return None

    def schedule(self, chat_id):
        """Планирует задачу проверки доступа к сменам"""
        try:
            # Преобразуем chat_id в строку для единообразия
            chat_id = str(chat_id)
            logger.info(f"=== Планирование проверки доступа к сменам для чата {chat_id} ===")

            # Получаем настройки из базы данных
            access_settings = self._get_access_settings_from_db(chat_id)
            if not access_settings:
                logger.error("❌ Настройки доступа не найдены в базе данных")
                return False

            # Получаем день и время регистрации из настроек
            registration_day = access_settings.get("registration_start_day", 0)
            registration_hour = access_settings.get("registration_start_hour", 0)
            registration_minute = access_settings.get("registration_start_minute", 0)

            # Преобразуем день недели из формата JavaScript в формат Python
            python_weekday = (registration_day - 1) % 7

            # Получаем текущее время в нужном часовом поясе
            now = datetime.now(self.timezone)
            
            # Вычисляем следующую дату регистрации
            next_registration = self._calculate_next_registration_time(
                now, python_weekday, registration_hour, registration_minute
            )
            
            logger.info(f"📅 Запланировано уведомление на: {next_registration}")
            
            # Генерируем ID задачи
            task_id = self.generate_task_id('courier_shift_access', chat_id)
            
            # Сохраняем дополнительные данные
            task_data = {
                'registration_day': registration_day,
                'registration_hour': registration_hour,
                'registration_minute': registration_minute,
                'is_always_active': access_settings.get("is_always_active", True)
            }
            
            # Создаем задачу в планировщике
            self.scheduler.add_job(
                self.execute,
                'date',
                run_date=next_registration,
                args=[chat_id],
                id=task_id,
                name=f'Проверка доступа к сменам для чата {chat_id}'
            )
            
            # Сохраняем задачу в базу данных
            if self.task_manager.save_task(task_id, chat_id, 'courier_shift_access', next_registration, task_data):
                logger.info(f"✅ Задача проверки смен успешно создана с ID: {task_id}")
                return True
            else:
                logger.error("❌ Ошибка при сохранении задачи в базу данных")
                return False
                
        except Exception as e:
            logger.error(f"❌ Ошибка при создании задачи проверки смен: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    def _calculate_next_registration_time(self, now, weekday, hour, minute):
        """Вычисляет следующее время регистрации"""
        # Вычисляем, сколько дней нужно добавить до следующей регистрации
        days_ahead = (weekday - now.weekday()) % 7
        
        # Создаем временную метку для регистрации с точным временем
        target_time = now.replace(
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0
        )
        target_time = self.timezone.localize(target_time.replace(tzinfo=None))
        
        # Если сегодня день регистрации и время еще не наступило
        if days_ahead == 0 and now < target_time:
            return target_time
        else:
            # Если сегодня день регистрации, но время уже прошло, 
            # или это другой день, планируем на следующий подходящий день
            if days_ahead == 0:
                days_ahead = 7  # Планируем на следующую неделю
            
            next_time = (now + timedelta(days=days_ahead)).replace(
                hour=hour,
                minute=minute,
                second=0,
                microsecond=0
            )
            return self.timezone.localize(next_time.replace(tzinfo=None))

    def execute(self, chat_id=None):
        """Выполняет проверку доступа к сменам и отправляет уведомление"""
        try:
            logger.info(f"=== Проверка доступа к сменам для чата {chat_id} ===")
            
            # Отправляем уведомление через API
            success = self._send_notification(chat_id)
            
            # Проверяем, нужно ли пересоздать задачу
            if chat_id and success:
                # Получаем настройки доступа
                access_settings = self._get_access_settings_from_db(chat_id)
                if access_settings and access_settings.get('is_always_active', True):
                    # Создаем новую задачу на следующую неделю
                    self.schedule(chat_id)
            
            return success
            
        except Exception as e:
            logger.error(f"❌ Ошибка при проверке доступа к сменам: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    def _send_notification(self, chat_id=None):
        """Отправляет уведомление о доступности смен"""
        try:
            # Получаем список чатов для уведомления
            chat_ids = []
            if chat_id:
                chat_ids = [chat_id]
            else:
                try:
                    response = requests.get(f"{self.api_url}/telegram/courier-chats", timeout=10)
                    if response.status_code == 200:
                        data = response.json()
                        chat_ids = [str(chat['chat_id']) for chat in data.get('chats', [])]
                except Exception as e:
                    logger.error(f"❌ Ошибка при получении списка чатов: {str(e)}")
            
            if not chat_ids:
                logger.warning("⚠️ Нет чатов для отправки уведомлений")
                return False
            
            # Формируем сообщение
            message = (
                "🎉 <b>Открылась запись на смены на следующую неделю!</b>\n\n"
                "📱 Пожалуйста, перейдите в приложение и запишитесь на удобное время:\n"
                "1️⃣ Откройте бота @NinjaSlovtsova_bot\n"
                "2️⃣ Нажмите кнопку 'Открыть приложение'\n"
                "Спешите записаться на удобное время! 🚀"
            )
            
            # Отправляем уведомления
            success = True
            for current_chat_id in chat_ids:
                try:
                    notification_data = {
                        'chat_id': current_chat_id,
                        'text': message,
                        'parse_mode': 'HTML'
                    }
                    
                    # Исправляем URL - используем /send_message без префикса /api/
                    response = requests.post(
                        f"{self.api_url}/send_message",
                        json=notification_data,
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        logger.info(f"✅ Уведомление успешно отправлено в чат {current_chat_id}")
                    else:
                        logger.error(f"❌ Ошибка при отправке уведомления в чат {current_chat_id}: Статус {response.status_code}, Ответ: {response.text}")
                        success = False
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке уведомления в чат {current_chat_id}: {str(e)}")
                    success = False
            
            return success
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке уведомлений: {str(e)}")
            return False 