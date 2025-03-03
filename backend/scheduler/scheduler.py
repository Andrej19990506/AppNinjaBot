from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import pytz
import requests
import json
import os
import logging
from pathlib import Path
import traceback

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
        self.api_url = api_url or os.getenv('API_URL', 'http://server:8000/api')
        self.timezone = pytz.timezone('Asia/Krasnoyarsk')
        self.reset_jobs = {}  # Словарь для хранения задач сброса по chat_id
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
            
            for chat_id, job_id in list(self.reset_jobs.items()):
                job = self.scheduler.get_job(job_id)
                # Проверяем существование задачи и её актуальность
                if job and job.next_run_time and job.next_run_time > current_time:
                    tasks_data[chat_id] = {
                        'job_id': job_id,
                        'next_run_time': job.next_run_time.isoformat(),
                        'chat_id': chat_id
                    }
                else:
                    # Удаляем просроченные или несуществующие задачи
                    if job:
                        self.scheduler.remove_job(job_id)
                    del self.reset_jobs[chat_id]
                    logger.info(f"Удалена просроченная задача для чата {chat_id}")
            
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

            for chat_id, task_info in tasks_data.items():
                try:
                    next_run_time = datetime.fromisoformat(task_info['next_run_time']) if task_info.get('next_run_time') else None
                    
                    # Проверяем, не прошло ли время выполнения
                    if next_run_time and next_run_time > current_time:
                        # Планируем задачу с сохраненным временем
                        job = self.scheduler.add_job(
                            self.send_to_accounting,
                            'date',
                            run_date=next_run_time,
                            args=[chat_id],
                            id=task_info['job_id'],
                            name=f'Отправка инвентаризации в бухгалтерию для чата {chat_id}'
                        )
                        self.reset_jobs[chat_id] = job.id
                        active_tasks[chat_id] = task_info
                        logger.info(f"Восстановлена задача для чата {chat_id}, время выполнения: {next_run_time}")
                    else:
                        logger.info(f"Пропущена просроченная задача для чата {chat_id}")
                except Exception as e:
                    logger.error(f"Ошибка при восстановлении задачи для чата {chat_id}: {str(e)}")

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

    async def send_to_accounting(self, chat_id):
        """Отправка инвентаризации в бухгалтерию"""
        try:
            if not self._is_running:
                logger.error("Планировщик не запущен")
                return

            chat_id = str(chat_id)
            logger.info(f"=== Отправка инвентаризации в бухгалтерию для чата {chat_id} ===")

            # Генерируем Excel файл
            response = requests.get(f"{self.api_url}/inventory/{chat_id}/excel")
            
            if response.ok:
                # Здесь можно добавить логику отправки файла в бухгалтерию
                # Например, отправка по email или в другую систему
                
                # Очищаем инвентаризацию для чата
                clear_response = requests.delete(f"{self.api_url}/inventory/{chat_id}")
                if clear_response.ok:
                    logger.info(f"Инвентаризация успешно очищена для чата {chat_id}")
                else:
                    logger.error(f"Ошибка при очистке инвентаризации: {clear_response.status_code}")
                
                # Создаем уведомление о успешной отправке
                notification_data = {
                    'chat_id': chat_id,
                    'text': '✅ Инвентаризация успешно отправлена в бухгалтерию и очищена',
                    'parse_mode': 'HTML'
                }
                
                notification_response = requests.post(
                    f"{self.api_url}/telegram/send_message",
                    json=notification_data
                )
                
                if notification_response.ok:
                    logger.info(f"Уведомление об отправке создано для чата {chat_id}")
                else:
                    logger.error(f"Ошибка при создании уведомления: {notification_response.status_code}")
                
                # Удаляем задачу из списка и очищаем файл
                if chat_id in self.reset_jobs:
                    job_id = self.reset_jobs[chat_id]
                    logger.info(f"Удаляем задачу {job_id} из списка")
                    try:
                        self.scheduler.remove_job(job_id)
                    except Exception as e:
                        logger.warning(f"Ошибка при удалении задачи из планировщика: {str(e)}")
                    del self.reset_jobs[chat_id]
                
                # Принудительно очищаем файл с задачами
                with open(self.scheduler_file, 'w', encoding='utf-8') as f:
                    json.dump({}, f, ensure_ascii=False, indent=2)
                logger.info("Файл с задачами очищен")
                
                logger.info(f"✅ Инвентаризация успешно отправлена в бухгалтерию для чата {chat_id}")
            else:
                logger.error(f"Ошибка при генерации Excel файла: {response.status_code}")
                logger.error(f"Ответ сервера: {response.text}")

        except Exception as e:
            logger.error(f"Ошибка при отправке в бухгалтерию: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Создаем уведомление об ошибке
            try:
                error_notification = {
                    'chat_id': chat_id,
                    'text': '❌ Произошла ошибка при отправке данных в бухгалтерию',
                    'parse_mode': 'HTML'
                }
                requests.post(f"{self.api_url}/telegram/send_message", json=error_notification)
            except:
                pass

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

# Создаем экземпляр планировщика
scheduler = InventoryScheduler() 