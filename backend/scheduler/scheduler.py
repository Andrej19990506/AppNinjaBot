from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import pytz
import requests
import json
import os
import logging
from pathlib import Path
import traceback
import asyncio
import threading

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('Scheduler')

# В начале файла добавим функцию для получения следующей среды
def get_next_wednesday(from_date=None):
    """Получает дату следующей среды"""
    if from_date is None:
        from_date = datetime.now()
    # 0 = понедельник, 1 = вторник, 2 = среда и т.д.
    days_ahead = 2 - from_date.weekday()  # Сколько дней до следующей среды
    if days_ahead <= 0:  # Если сегодня среда или позже
        days_ahead += 7  # Переходим к следующей неделе
    next_wednesday = from_date + timedelta(days=days_ahead)
    return next_wednesday.replace(hour=5, minute=28, second=0, microsecond=0)

class InventoryScheduler:
    def __init__(self, api_url=None):
        self.scheduler = BackgroundScheduler()
        self.api_url = api_url or os.getenv('API_URL', 'http://localhost:8000/api')
        self.timezone = pytz.timezone('Asia/Krasnoyarsk')
        self.reset_jobs = {}  # Словарь для хранения задач сброса по chat_id
        self.availability_jobs = {}  # Словарь для хранения задач доступности по chat_id
        self.availability_job = None  # Глобальная задача для уведомлений о доступности (для обратной совместимости)
        self._is_running = False
        
        # Пути к директориям
        self.base_dir = Path(os.path.dirname(os.path.abspath(__file__)))
        self.data_dir = self.base_dir.parent / 'data'
        self.inventory_dir = self.data_dir / 'inventory'
        self.scheduler_dir = self.data_dir / 'scheduler'
        self.scheduler_file = self.scheduler_dir / 'scheduled_tasks.json'

        # Создаем директории если их нет
        self.inventory_dir.mkdir(parents=True, exist_ok=True)
        self.scheduler_dir.mkdir(parents=True, exist_ok=True)

        # Загружаем сохраненные задачи при инициализации
        self._load_scheduled_tasks()

    def _save_scheduled_tasks(self):
        """Сохраняет информацию о запланированных задачах в файл"""
        try:
            tasks_data = {}
            current_time = datetime.now(self.timezone)
            
            # Сохраняем задачи сброса инвентаризации
            for chat_id, job_id in list(self.reset_jobs.items()):
                job = self.scheduler.get_job(job_id)
                # Проверяем существование задачи и её актуальность
                if job and job.next_run_time and job.next_run_time > current_time:
                    tasks_data[chat_id] = {
                        'job_id': job_id,
                        'next_run_time': job.next_run_time.isoformat(),
                        'chat_id': chat_id,
                        'type': 'reset'
                    }
                else:
                    # Удаляем просроченные или несуществующие задачи
                    if job:
                        self.scheduler.remove_job(job_id)
                    del self.reset_jobs[chat_id]
                    logger.info(f"Удалена просроченная задача для чата {chat_id}")
            
            # Сохраняем задачи уведомлений о доступности
            for chat_id, job_id in list(self.availability_jobs.items()):
                job = self.scheduler.get_job(job_id)
                if job and job.next_run_time and job.next_run_time > current_time:
                    # Генерируем уникальный ключ для задачи доступности
                    task_key = f"availability_{chat_id}"
                    
                    tasks_data[task_key] = {
                        'job_id': job_id,
                        'next_run_time': job.next_run_time.isoformat(),
                        'chat_id': chat_id,
                        'type': 'availability'
                    }
                else:
                    # Удаляем просроченные или несуществующие задачи
                    if job:
                        self.scheduler.remove_job(job_id)
                    del self.availability_jobs[chat_id]
                    logger.info(f"Удалена просроченная задача доступности для чата {chat_id}")
            
            # Очищаем файл если нет активных задач
            if not tasks_data:
                tasks_data = {}
                
            with open(self.scheduler_file, 'w', encoding='utf-8') as f:
                json.dump(tasks_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Задачи успешно сохранены в {self.scheduler_file}")
        except Exception as e:
            logger.error(f"Ошибка при сохранении задач: {str(e)}")
            logger.error(traceback.format_exc())

    def _load_scheduled_tasks(self):
        """Загружает и восстанавливает запланированные задачи из файла"""
        try:
            # Очищаем текущее состояние
            for chat_id, job_id in list(self.reset_jobs.items()):
                try:
                    self.scheduler.remove_job(job_id)
                except Exception:
                    pass
            self.reset_jobs.clear()
            
            # Очищаем задачи уведомлений о доступности
            for chat_id, job_id in list(self.availability_jobs.items()):
                try:
                    self.scheduler.remove_job(job_id)
                except Exception:
                    pass
            self.availability_jobs.clear()
            
            if not self.scheduler_file.exists():
                logger.info("Файл с сохраненными задачами не найден")
                return

            with open(self.scheduler_file, 'r', encoding='utf-8') as f:
                tasks_data = json.load(f)

            # Если файл пустой, ничего не делаем
            if not tasks_data:
                logger.info("Файл с задачами пуст")
                return

            current_time = datetime.now(self.timezone)
            active_tasks = {}

            for task_id, task_info in tasks_data.items():
                try:
                    next_run_time = datetime.fromisoformat(task_info['next_run_time']) if task_info.get('next_run_time') else None
                    
                    # Проверяем, не прошло ли время выполнения
                    if next_run_time and next_run_time > current_time:
                        if task_info['type'] == 'reset':
                            # Планируем задачу сброса инвентаризации
                            job = self.scheduler.add_job(
                                self.send_to_accounting,
                                'date',
                                run_date=next_run_time,
                                args=[task_info['chat_id']],
                                id=task_info['job_id'],
                                name=f'Отправка инвентаризации в бухгалтерию для чата {task_info["chat_id"]}'
                            )
                            self.reset_jobs[task_info['chat_id']] = job.id
                            active_tasks[task_id] = task_info
                            logger.info(f"Восстановлена задача сброса для чата {task_info['chat_id']}, время выполнения: {next_run_time}")
                        elif task_info['type'] == 'availability':
                            # Планируем задачу уведомлений о доступности
                            chat_id = task_info.get('chat_id')
                            
                            # Передаем chat_id в функцию check_availability через args, если он указан
                            if chat_id:
                                job = self.scheduler.add_job(
                                    self.check_availability,
                                    'date',
                                    run_date=next_run_time,
                                    args=[chat_id],
                                    id=task_info['job_id'],
                                    name=f'Проверка доступности смен для чата {chat_id}'
                                )
                                self.availability_jobs[chat_id] = job.id
                                logger.info(f"Восстановлена задача уведомлений о доступности для чата {chat_id}, время выполнения: {next_run_time}")
                            else:
                                # Для глобальной задачи без chat_id
                                job = self.scheduler.add_job(
                                    self.check_availability,
                                    'date',
                                    run_date=next_run_time,
                                    id=task_info['job_id'],
                                    name='Проверка доступности смен'
                                )
                                self.availability_jobs[task_id] = job.id
                                logger.info(f"Восстановлена задача уведомлений о доступности, время выполнения: {next_run_time}")
                            
                            active_tasks[task_id] = task_info
                    else:
                        logger.info(f"Пропущена просроченная задача {task_id}")
                except Exception as e:
                    logger.error(f"Ошибка при восстановлении задачи {task_id}: {str(e)}")

            # Сохраняем только активные задачи обратно в файл
            with open(self.scheduler_file, 'w', encoding='utf-8') as f:
                json.dump(active_tasks, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.error(f"Ошибка при загрузке задач: {str(e)}")
            logger.error(traceback.format_exc())

    def start(self):
        """Запуск планировщика"""
        try:
            if not self._is_running:
                self.scheduler.start()
                self._is_running = True
                # Загружаем сохраненные задачи при старте
                self._load_scheduled_tasks()
                # Проверяем и создаем задачу уведомлений о доступности
                self.ensure_availability_task()
                
                # Логируем все активные задачи
                logger.info("=== Активные задачи планировщика ===")
                
                # Логируем задачи сброса инвентаризации
                if self.reset_jobs:
                    logger.info("Задачи сброса инвентаризации:")
                    for chat_id, job_id in self.reset_jobs.items():
                        job = self.scheduler.get_job(job_id)
                        if job:
                            logger.info(f"  - Чат {chat_id}:")
                            logger.info(f"    ID задачи: {job.id}")
                            logger.info(f"    Время выполнения: {job.next_run_time}")
                            logger.info(f"    Тип триггера: {job.trigger}")
                else:
                    logger.info("Нет активных задач сброса инвентаризации")
                
                # Логируем задачи уведомлений о доступности
                if self.availability_job:
                    job = self.scheduler.get_job(self.availability_job)
                    if job:
                        logger.info("Задача уведомлений о доступности смен:")
                        logger.info(f"  ID задачи: {job.id}")
                        logger.info(f"  Время выполнения: {job.next_run_time}")
                        logger.info(f"  Тип триггера: {job.trigger}")
                else:
                    logger.info("Задача уведомлений о доступности смен не найдена")
                
                logger.info("=====================================")
                logger.info("Планировщик успешно запущен")
                
        except Exception as e:
            logger.error(f"Ошибка при запуске планировщика: {str(e)}")
            raise

    def stop(self):
        """Остановка планировщика"""
        if self._is_running:
            # Сохраняем задачи перед остановкой
            self._save_scheduled_tasks()
            self.scheduler.shutdown()
            self._is_running = False
            logger.info("Планировщик остановлен")

    def is_running(self):
        """Проверка состояния планировщика"""
        return self._is_running

    def schedule_inventory_reset(self, chat_id):
        """Планирование сброса инвентаризации в 7 утра следующего дня"""
        try:
            if not self._is_running:
                logger.error("Планировщик не запущен")
                return

            # Преобразуем chat_id в строку для единообразия
            chat_id = str(chat_id)
            logger.info(f"=== Планирование отправки инвентаризации в бухгалтерию для чата {chat_id} ===")

            # Проверяем существующую задачу
            if chat_id in self.reset_jobs:
                existing_job_id = self.reset_jobs[chat_id]
                existing_job = self.scheduler.get_job(existing_job_id)
                
                if existing_job and existing_job.next_run_time > datetime.now(self.timezone):
                    logger.info(f"Найдена активная задача {existing_job_id}, пропускаем создание новой")
                    logger.info(f"Время выполнения: {existing_job.next_run_time.isoformat()}")
                    return

            # Проверяем, есть ли файл с задачами и не пуст ли он
            if self.scheduler_file.exists():
                try:
                    with open(self.scheduler_file, 'r', encoding='utf-8') as f:
                        tasks_data = json.load(f)
                    # Проверяем задачу для текущего чата
                    if chat_id in tasks_data:
                        task_info = tasks_data[chat_id]
                        next_run_time = datetime.fromisoformat(task_info['next_run_time']) if task_info.get('next_run_time') else None
                        
                        # Проверяем, не прошло ли время выполнения
                        if next_run_time and next_run_time > datetime.now(self.timezone):
                            logger.info("Есть активная задача для этого чата, пропускаем планирование")
                            return
                        else:
                            logger.info("Найдена просроченная задача, будет создана новая")
                except json.JSONDecodeError:
                    pass

            # Вычисляем время следующего сброса (7:00 следующего дня)
            now = datetime.now(self.timezone)
            next_reset = (now + timedelta(days=1)).replace(hour=7, minute=0, second=0, microsecond=0)
                        
            job_id = f"reset_{chat_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            logger.info(f"Создаем новую задачу {job_id}")
            logger.info(f"Время отправки в бухгалтерию: {next_reset.isoformat()}")

            job = self.scheduler.add_job(
                self.send_to_accounting,
                'date',
                run_date=next_reset,
                args=[chat_id],
                id=job_id,
                name=f'Отправка инвентаризации в бухгалтерию для чата {chat_id}'
            )

            # Сохраняем информацию о задаче
            self.reset_jobs[chat_id] = job_id
            
            # Сохраняем обновленный список задач
            self._save_scheduled_tasks()
            
            logger.info(f"Задача успешно создана и сохранена")
            logger.info(f"Текущие задачи: {self.reset_jobs}")

        except Exception as e:
            logger.error(f"Ошибка при планировании отправки в бухгалтерию: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    def schedule_availability_notification(self):
        """Планирование уведомления о доступности смен"""
        try:
            if not self._is_running:
                logger.error("Планировщик не запущен")
                return

            # Удаляем существующую задачу, если она есть
            if self.availability_job:
                try:
                    self.scheduler.remove_job(self.availability_job)
                except Exception as e:
                    logger.error(f"Ошибка при удалении старой задачи уведомлений: {str(e)}")

            # Получаем текущее время в нужном часовом поясе
            now = datetime.now(self.timezone)
            logger.info(f"Текущее время: {now.isoformat()}")
            
            target_time = now.replace(hour=5, minute=9, second=0, microsecond=0)
            logger.info(f"Целевое время: {target_time.isoformat()}")
            
            # Вычисляем время следующего четверга в 2:50
            days_ahead = 3 - now.weekday()  # 3 = четверг
            logger.info(f"Дней до четверга: {days_ahead}")
            
            if days_ahead < 0 or (days_ahead == 0 and now > target_time):
                # Если сегодня четверг и уже после 2:50, или если сегодня после четверга
                days_ahead += 7  # Переходим к следующей неделе
                logger.info("Переходим к следующей неделе")
            
            next_thursday = (now + timedelta(days=days_ahead)).replace(hour=5, minute=9, second=0, microsecond=0)
            logger.info(f"Следующий четверг: {next_thursday.isoformat()}")

            # Создаем новую задачу
            job_id = f"availability_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            job = self.scheduler.add_job(
                self.check_availability,
                'date',
                run_date=next_thursday,
                id=job_id,
                name='Проверка доступности смен'
            )

            self.availability_jobs[next_thursday.strftime('%Y-%m-%d')] = job_id
            logger.info(f"Запланирована проверка доступности смен на {next_thursday.isoformat()}")

            # Сохраняем задачи в файл
            self._save_scheduled_tasks()

        except Exception as e:
            logger.error(f"Ошибка при планировании проверки доступности: {str(e)}")
            logger.error(traceback.format_exc())

    def check_availability(self, chat_id=None):
        """Проверяет доступность смен и при необходимости уведомляет пользователей"""
        try:
            logger.info(f"=== Проверка доступности смен {f'для чата {chat_id}' if chat_id else 'для всех чатов'} ===")
            
            # Получаем список курьерских чатов для уведомления
            chat_ids = []  # Инициализируем пустым списком
            
            if chat_id:
                chat_ids = [chat_id]
                logger.info(f"Проверка доступности для конкретного чата: {chat_id}")
            else:
                # Получаем список всех чатов из API телеграма напрямую
                try:
                    chat_response = requests.get(f"{self.api_url}/telegram/courier-chats", timeout=10)
                    
                    if chat_response.status_code == 200:
                        data = chat_response.json()
                        chats = data.get('chats', [])
                        chat_ids = [str(chat['chat_id']) for chat in chats]
                        logger.info(f"Получено {len(chat_ids)} курьерских чатов для уведомления")
                    else:
                        logger.error(f"Ошибка при получении списка чатов: {chat_response.status_code}")
                except Exception as e:
                    logger.error(f"Ошибка при получении списка чатов: {str(e)}")
            
            # Проверяем наличие смен локально
            is_available = True  # Упрощенная логика
            dates = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
            
            # Формируем сообщение
            message = (
                "🎉 <b>Открылась запись на смены на следующую неделю!</b>\n\n"
                "📱 Пожалуйста, перейдите в приложение и запишитесь на удобное время:\n"
                "1️⃣ Откройте бота @NinjaSlovtsova_bot\n"
                "2️⃣ Нажмите кнопку 'Открыть приложение'\n"
                "Спешите записаться на удобное время! 🚀"
            )
            
            if is_available and chat_ids:
                # Отправляем уведомления напрямую через Telegram API
                logger.info(f"Смены доступны, отправляем уведомления в {len(chat_ids)} чатов")
                
                # Отправляем уведомление через Telegram API
                for current_chat_id in chat_ids:
                    try:
                        # Используем параметр chat_id вместо создания массива chat_ids
                        notification_data = {
                            'chat_id': current_chat_id,
                            'message': message,
                            'parse_mode': 'HTML'
                        }
                        
                        notification_response = requests.post(
                            f"{self.api_url}/telegram/send_message",
                            json=notification_data,
                            timeout=10
                        )
                        
                        if notification_response.status_code == 200:
                            logger.info(f"✅ Уведомление успешно отправлено в чат {current_chat_id}")
                        else:
                            logger.error(f"❌ Ошибка при отправке уведомления в чат {current_chat_id}: {notification_response.status_code} - {notification_response.text}")
                    except Exception as e:
                        logger.error(f"❌ Ошибка при отправке уведомления в чат {current_chat_id}: {str(e)}")
                
                logger.info("✅ Процесс отправки уведомлений завершен")
            else:
                logger.info("⚠️ Смены не доступны или нет получателей для уведомлений")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при проверке доступности смен: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    def send_availability_notification(self):
        """Отправляет уведомление в чаты курьеров о доступности смен"""
        try:
            logger.info("=== Отправка уведомления о доступности смен ===")
            logger.info(f"Используемый API URL: {self.api_url}")
            logger.info("Получение списка курьерских чатов...")
            
            # Получаем список курьерских чатов с таймаутом
            try:
                # Используем контекстный менеджер для автоматического закрытия сессии
                with requests.Session() as session:
                    response = session.get(
                        f"{self.api_url}/telegram/courier-chats",
                        timeout=10  # 10 секунд таймаут
                    )
                
                if response.status_code != 200:
                    logger.error(f"Ошибка при получении списка чатов: {response.status_code} - {response.text}")
                    return
                    
                data = response.json()
                chats = data.get('chats', [])
                
                if not chats:
                    logger.warning("Нет доступных курьерских чатов для отправки уведомления")
                    return
                    
                logger.info(f"Отправка уведомлений в {len(chats)} курьерских чатов")
                
                # Формируем сообщение
                message = (
                    "🎉 <b>Открылась запись на смены на следующую неделю!</b>\n\n"
                    "📱 Пожалуйста, перейдите в приложение и запишитесь на удобное время:\n"
                    "1️⃣ Откройте бота @NinjaSlovtsova_bot\n"
                    "2️⃣ Нажмите кнопку 'Открыть приложение' (можно найти двумя способами):\n"
                    "   • Нажмите на имя бота и выберите 'Открыть приложение' в информации о боте\n"
                    "   • Или нажмите кнопку 'Открыть приложение' справа от имени бота в общем окне сообщений\n"
                    "Спешите записаться на удобное время! 🚀"
                )
                
                # Отправляем уведомление через API
                notification_data = {
                    'message': message,
                    'chat_ids': [str(chat['chat_id']) for chat in chats]
                }
                
                logger.info(f"Отправка запроса на {self.api_url}/telegram/send_message")
                logger.info(f"Данные запроса: {notification_data}")
                
                # Также используем контекстный менеджер для запроса отправки сообщения
                with requests.Session() as session:
                    send_response = session.post(
                        f"{self.api_url}/telegram/send_message",
                        json=notification_data,
                        timeout=90  # 90 секунд таймаут для отправки сообщений
                    )
                
                logger.info(f"Статус ответа: {send_response.status_code}")
                logger.info(f"Текст ответа: {send_response.text}")
                
                if send_response.status_code != 200:
                    logger.error(f"Ошибка при отправке уведомления: {send_response.status_code} - {send_response.text}")
                    
            except requests.exceptions.Timeout:
                logger.error("Превышено время ожидания при запросе к API (таймаут)")
            except requests.exceptions.ConnectionError as e:
                logger.error(f"Ошибка соединения при запросе к API: {str(e)}")
            except Exception as e:
                logger.error(f"Ошибка при работе с API: {str(e)}")
                logger.error(traceback.format_exc())
                
        except Exception as e:
            logger.error(f"Ошибка при отправке уведомления: {str(e)}")
            logger.error(traceback.format_exc())

    def get_job_status(self, chat_id):
        """Получение статуса задачи для чата"""
        try:
            # Синхронизируем состояние с файлом
            self._load_scheduled_tasks()
            
            chat_id = str(chat_id)
            logger.info(f"=== Получение статуса задачи для чата {chat_id} ===")
            logger.info(f"Текущие задачи: {self.reset_jobs}")
            
            job_id = self.reset_jobs.get(chat_id)
            logger.info(f"Найден job_id: {job_id}")
            
            if job_id:
                job = self.scheduler.get_job(job_id)
                if job and job.next_run_time:
                    # Получаем дату следующей инвентаризации
                    next_inventory_date = get_next_wednesday(job.next_run_time)
                    return {
                        "status": "scheduled",
                        "next_run_time": job.next_run_time.isoformat(),
                        "next_inventory_date": next_inventory_date.isoformat()
                    }
            
            # Если нет активной задачи, возвращаем дату следующей инвентаризации
            next_inventory_date = get_next_wednesday()
            logger.info("Задача сброса не найдена для этого чата")
            return {
                "status": "not_found",
                "next_inventory_date": next_inventory_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Ошибка при получении статуса задачи: {str(e)}")
            return {"status": "error", "message": str(e)}

    def ensure_availability_task(self):
        """Проверяет наличие задачи уведомлений и создает её, если необходимо"""
        try:
            if not self._is_running:
                logger.error("Планировщик не запущен")
                return

            # Проверяем существующую задачу
            if self.availability_job:
                job = self.scheduler.get_job(self.availability_job)
                if job and job.next_run_time and job.next_run_time > datetime.now(self.timezone):
                    logger.info(f"Задача уведомлений о доступности уже существует и запланирована на {job.next_run_time}")
                    return
                else:
                    logger.info("Существующая задача уведомлений просрочена или не найдена, создаем новую")
                    try:
                        self.scheduler.remove_job(self.availability_job)
                    except Exception as e:
                        logger.error(f"Ошибка при удалении старой задачи: {str(e)}")

            # Создаем новую задачу
            self.schedule_availability_notification()
            
            # Сохраняем задачи в файл
            self._save_scheduled_tasks()
            
        except Exception as e:
            logger.error(f"Ошибка при проверке/создании задачи уведомлений: {str(e)}")
            logger.error(traceback.format_exc())

    def get_availability_status(self):
        """Получение статуса задачи уведомлений о доступности"""
        try:
            if not self._is_running:
                return {
                    "is_running": False,
                    "active_tasks": []
                }

            active_tasks = []
            if self.availability_job:
                job = self.scheduler.get_job(self.availability_job)
                if job:
                    active_tasks.append({
                        "id": job.id,
                        "name": job.name,
                        "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                        "trigger": str(job.trigger)
                    })

            return {
                "is_running": self._is_running,
                "active_tasks": active_tasks
            }
            
        except Exception as e:
            logger.error(f"Ошибка при получении статуса задачи уведомлений: {str(e)}")
            return {
                "is_running": self._is_running,
                "active_tasks": [],
                "error": str(e)
            }

    def reload_scheduled_tasks(self):
        """Принудительная перезагрузка запланированных задач из файла"""
        try:
            if not self._is_running:
                logger.error("Планировщик не запущен")
                return False

            logger.info("=== Принудительная перезагрузка запланированных задач ===")
            
            # Очищаем текущие задачи
            for chat_id, job_id in list(self.reset_jobs.items()):
                try:
                    self.scheduler.remove_job(job_id)
                except Exception as e:
                    logger.error(f"Ошибка при удалении задачи {job_id}: {str(e)}")
            self.reset_jobs.clear()
            
            # Очищаем задачи уведомлений о доступности
            for chat_id, job_id in list(self.availability_jobs.items()):
                try:
                    self.scheduler.remove_job(job_id)
                except Exception as e:
                    logger.error(f"Ошибка при удалении задачи уведомлений: {str(e)}")
            self.availability_jobs.clear()
            
            # Загружаем задачи из файла
            self._load_scheduled_tasks()
            
            logger.info("Задачи успешно перезагружены")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка при перезагрузке задач: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    def apply_access_settings(self, chat_id=None):
        """Применяет настройки доступа к сменам и создает задачу для шедулера"""
        try:
            if not self._is_running:
                logger.error("Планировщик не запущен")
                return False
            
            logger.info(f"=== Применение настроек доступа к сменам {f'для чата {chat_id}' if chat_id else 'глобально'} ===")
            
            # Проверяем, чтобы chat_id не конфликтовал с reset_jobs
            if chat_id and chat_id in self.reset_jobs:
                # Это особенная ситуация - для одного и того же chat_id мы имеем разные типы задач
                # Добавляем логирование
                logger.warning(f"⚠️ Внимание: chat_id {chat_id} уже используется для задачи инвентаризации")
                logger.warning(f"⚠️ Это может привести к конфликтам между разными типами задач")
                logger.warning(f"⚠️ Чтобы избежать проблем, для задач доступности будет использоваться префикс 'availability_'")
            
            # Загружаем настройки доступа напрямую из файла
            try:
                # Путь к файлу настроек в зависимости от chat_id
                if chat_id:
                    # Новая структура с отдельным файлом для каждого чата
                    access_settings_dir = self.base_dir.parent / "data" / "access_settings"
                    access_settings_file = access_settings_dir / f"settings_{chat_id}.json"
                    
                    # Если файла для чата нет, проверяем старый общий файл
                    if not access_settings_file.exists():
                        old_file = self.base_dir.parent / "data" / "shift_access_settings.json"
                        if old_file.exists():
                            # Если старый файл существует, копируем настройки из него
                            access_settings_file = old_file
                            logger.info(f"Файл настроек для чата {chat_id} не найден, используем общие настройки")
                        else:
                            logger.error(f"Файлы настроек доступа не найдены: ни {access_settings_file}, ни {old_file}")
                            return False
                else:
                    # Старая структура с общим файлом для всех чатов
                    access_settings_file = self.base_dir.parent / "data" / "shift_access_settings.json"
                
                if not access_settings_file.exists():
                    logger.error(f"Файл настроек доступа не найден: {access_settings_file}")
                    return False
                
                with open(access_settings_file, 'r', encoding='utf-8') as file:
                    access_settings = json.load(file)
                
                logger.info(f"Загружены настройки доступа для чата {chat_id if chat_id else 'по умолчанию'}")
                
                # Асинхронная проверка доступности чатов в отдельном потоке
                def check_chats_async():
                    try:
                        logger.info("Проверка доступности курьерских чатов...")
                        # Добавляем таймаут для запроса
                        chat_response = requests.get(
                            f"{self.api_url}/telegram/courier-chats", 
                            timeout=5  # таймаут 5 секунд
                        )
                        
                        if chat_response.status_code == 200:
                            # Исправляем обработку ответа - получаем 'chats' вместо 'chat_ids'
                            response_data = chat_response.json()
                            chats = response_data.get('chats', [])
                            if chats:
                                chat_ids = [chat['chat_id'] for chat in chats]
                                logger.info(f"✅ Найдено {len(chat_ids)} доступных чатов для отправки уведомлений")
                                for chat in chats:
                                    logger.info(f"📲 Чат: {chat.get('title', 'Без названия')} (ID: {chat.get('chat_id', 'Нет ID')})")
                            else:
                                logger.warning("⚠️ Нет доступных чатов для отправки уведомлений!")
                        else:
                            logger.error(f"❌ Ошибка при получении списка чатов: {chat_response.status_code} - {chat_response.text}")
                    except requests.exceptions.Timeout:
                        logger.error("❌ Превышено время ожидания при получении списка чатов (таймаут)")
                    except requests.exceptions.ConnectionError as e:
                        logger.error(f"❌ Ошибка соединения при получении списка чатов: {str(e)}")
                    except Exception as e:
                        logger.error(f"❌ Не удалось получить список чатов: {str(e)}")
                    
                    logger.info("Проверка чатов завершена")
                
                # Запускаем проверку чатов в отдельном потоке, чтобы не блокировать основной процесс
                chat_thread = threading.Thread(target=check_chats_async)
                chat_thread.daemon = True  # Поток будет остановлен при завершении основного процесса
                chat_thread.start()
                logger.info("Запущена асинхронная проверка чатов")
                
                # Продолжаем работу, не дожидаясь результата проверки чатов
                registration_day = access_settings.get("registrationStartDay", 5)  # Пятница по умолчанию
                registration_hour = access_settings.get("registrationStartHour", 4)  # 4:00 по умолчанию
                registration_minute = access_settings.get("registrationStartMinute", 15)  # 15 минут по умолчанию
                
                # Преобразуем день из формата 0-6 (воскресенье-суббота) в 0-6 (понедельник-воскресенье)
                # Python использует 0 для понедельника, 6 для воскресенья
                python_weekday = registration_day % 7
                if python_weekday == 0:
                    python_weekday = 6  # Воскресенье
                else:
                    python_weekday -= 1  # Остальные дни
                
                # Получаем текущее время в нужном часовом поясе
                now = datetime.now(self.timezone)
                
                # Функция для нахождения ближайшего указанного дня недели
                def next_weekday(d, weekday):
                    # Вычисляем разницу в днях до нужного дня недели
                    days_ahead = weekday - d.weekday()
                    if days_ahead < 0:  # Если нужный день был раньше на этой неделе
                        days_ahead += 7
                    return d + timedelta(days=days_ahead)
                
                # Находим следующий день регистрации
                next_registration_day = next_weekday(now.replace(hour=0, minute=0, second=0, microsecond=0), python_weekday)
                
                # Устанавливаем время открытия регистрации
                registration_datetime = next_registration_day.replace(
                    hour=registration_hour,
                    minute=registration_minute,
                    second=0,
                    microsecond=0
                )
                
                # Если дата уже в прошлом, переходим к следующей неделе
                if registration_datetime < now:
                    logger.info(f"Дата регистрации {registration_datetime.isoformat()} в прошлом, переходим к следующей неделе")
                    registration_datetime = registration_datetime + timedelta(days=7)
                
                logger.info(f"📅 Запланировано уведомление о доступности смен на: {registration_datetime.isoformat()}")
                logger.info(f"🕒 День недели: {registration_day} (день {python_weekday}), Время: {registration_hour}:{registration_minute:02d}")
                
                # Для каждого чата мы используем отдельный job_id 
                job_id_suffix = f"_{chat_id}" if chat_id else ""
                job_id = f"availability{job_id_suffix}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
                
                # Удаляем существующую задачу, если она есть
                try:
                    # Если это задача для конкретного чата
                    if chat_id:
                        # Проверяем наличие задачи для чата в словаре задач доступности
                        if chat_id in self.availability_jobs:
                            old_job_id = self.availability_jobs[chat_id]
                            try:
                                self.scheduler.remove_job(old_job_id)
                                logger.info(f"✅ Удалена предыдущая задача уведомления {old_job_id} для чата {chat_id}")
                            except Exception as e:
                                logger.error(f"❌ Ошибка при удалении предыдущей задачи {old_job_id} для чата {chat_id}: {str(e)}")
                        
                        # Также проверяем, нет ли конфликта с задачей инвентаризации
                        if chat_id in self.reset_jobs:
                            logger.warning(f"⚠️ Для чата {chat_id} уже запланирована задача инвентаризации")
                            logger.warning(f"⚠️ Обе задачи будут выполняться независимо")
                    # Если это общая задача
                    else:
                        if self.availability_job:
                            try:
                                self.scheduler.remove_job(self.availability_job)
                                logger.info(f"✅ Удалена предыдущая общая задача уведомления {self.availability_job}")
                            except Exception as e:
                                logger.error(f"❌ Ошибка при удалении предыдущей общей задачи: {str(e)}")
                except Exception as e:
                    logger.error(f"❌ Ошибка при проверке и удалении предыдущей задачи: {str(e)}")
                
                # Создаем новую задачу с функцией для проверки доступности
                # Для чата нужна специальная функция, которая будет учитывать chat_id
                if chat_id:
                    # Вместо создания обертки, передаем chat_id напрямую через args
                    job = self.scheduler.add_job(
                        self.check_availability,
                        'date',
                        run_date=registration_datetime,
                        id=job_id,
                        args=[chat_id],  # Передаем chat_id как аргумент функции
                        name=f'Проверка доступности смен для чата {chat_id} (День: {registration_day}, Время: {registration_hour}:{registration_minute:02d})'
                    )
                    
                    # Сохраняем задачу в словаре availability_jobs
                    self.availability_jobs[chat_id] = job_id
                    
                    logger.info(f"✅ Задача доступности успешно создана с ID: {job_id} для чата {chat_id}")
                else:
                    # Для общих настроек используем стандартную задачу
                    job = self.scheduler.add_job(
                        self.check_availability,
                        'date',
                        run_date=registration_datetime,
                        id=job_id,
                        name=f'Проверка доступности смен (День: {registration_day}, Время: {registration_hour}:{registration_minute:02d})'
                    )
                    
                    self.availability_job = job_id
                    self.availability_jobs["global"] = job_id
                    logger.info(f"✅ Общая задача доступности успешно создана с ID: {job_id}")
                
                logger.info(f"📅 Запланирована проверка доступности смен на {registration_datetime.isoformat()}")
                
                # Информация о режиме пересоздания задачи
                is_always_active = access_settings.get("isAlwaysActive", True)
                if is_always_active:
                    logger.info("🔁 Настройка isAlwaysActive=True - после выполнения задача будет автоматически пересоздана на следующую неделю")
                else:
                    logger.info("⚠️ Настройка isAlwaysActive=False - задача выполнится однократно и не будет пересоздана")
                
                # Сохраняем задачи в файл
                self._save_scheduled_tasks()
                logger.info("✅ Задачи успешно сохранены в файл")
                
                # Перезагружаем задачи для применения изменений
                self.reload_scheduled_tasks()
                logger.info("✅ Задачи успешно перезагружены")
                
                return True
                
            except Exception as e:
                logger.error(f"Ошибка при загрузке настроек доступа: {str(e)}")
                logger.error(traceback.format_exc())
                return False
                
        except Exception as e:
            logger.error(f"Ошибка при применении настроек доступа: {str(e)}")
            logger.error(traceback.format_exc())
            return False

# Создаем экземпляр планировщика
scheduler = InventoryScheduler() 