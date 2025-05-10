from flask import Flask, jsonify, request
from scheduler import scheduler
import logging
from datetime import datetime
import traceback
from scheduler import InventoryScheduler

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SchedulerService')

app = Flask(__name__)
scheduler = InventoryScheduler()

@app.route('/health')
def health_check():
    """Проверка здоровья сервиса"""
    return jsonify({
        'status': 'healthy',
        'scheduler_running': scheduler.is_running()
    })

@app.route('/scheduler/start', methods=['POST'])
def start_scheduler():
    """Запуск планировщика"""
    try:
        scheduler.start()
        return jsonify({'status': 'success', 'message': 'Scheduler started'})
    except Exception as e:
        logger.error(f"Error starting scheduler: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/scheduler/stop', methods=['POST'])
def stop_scheduler():
    """Остановка планировщика"""
    try:
        scheduler.stop()
        return jsonify({'status': 'success', 'message': 'Scheduler stopped'})
    except Exception as e:
        logger.error(f"Error stopping scheduler: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/scheduler/status')
def scheduler_status():
    """Получение статуса планировщика"""
    return jsonify({
        'running': scheduler.is_running(),
        'jobs': len(scheduler.reset_jobs)
    })

@app.route('/scheduler/job_status/<chat_id>')
def job_status(chat_id):
    """Получение статуса задачи сброса для конкретного чата"""
    try:
        # Преобразуем chat_id в строку для единообразия
        chat_id = str(chat_id)
        logger.info(f"=== Получение статуса задачи для чата {chat_id} ===")
        logger.info(f"Текущие задачи: {scheduler.reset_jobs}")
        
        # Проверяем наличие задачи сброса для данного чата
        job_id = scheduler.reset_jobs.get(chat_id)
        logger.info(f"Найден job_id: {job_id}")
        
        if not job_id:
            logger.info("Задача сброса не найдена для этого чата")
            return jsonify({
                'scheduled': False,
                'message': 'No reset job scheduled for this chat'
            })

        # Получаем информацию о задаче
        job = scheduler.scheduler.get_job(job_id)
        logger.info(f"Информация о задаче: {job}")
        
        if not job:
            # Если задача не найдена, удаляем её из словаря
            logger.info("Задача не найдена в планировщике, удаляем из словаря")
            if chat_id in scheduler.reset_jobs:
                del scheduler.reset_jobs[chat_id]
            return jsonify({
                'scheduled': False,
                'message': 'Reset job not found'
            })

        # Возвращаем информацию о задаче
        response = {
            'scheduled': True,
            'reset_time': job.next_run_time.isoformat(),
            'job_id': job_id,
            'remaining_seconds': int((job.next_run_time - datetime.now(job.next_run_time.tzinfo)).total_seconds())
        }
        logger.info(f"Отправляем ответ: {response}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Ошибка при получении статуса задачи: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'scheduled': False,
            'error': str(e)
        }), 500

@app.route('/scheduler/schedule_reset', methods=['POST'])
def schedule_reset():
    """Планирование сброса инвентаризации"""
    try:
        data = request.get_json()
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return jsonify({'error': 'chat_id is required'}), 400
            
        scheduler.schedule_inventory_reset(chat_id)
        return jsonify({'status': 'success', 'message': f'Reset scheduled for chat {chat_id}'})
    except Exception as e:
        logger.error(f"Error scheduling reset: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/schedule/availability', methods=['POST'])
def schedule_availability():
    """Планирование уведомления о доступности смен"""
    try:
        # Получаем chat_id из запроса
        data = request.json
        chat_id = data.get('chat_id') if data else None
        
        logger.info(f"Запрос на планирование доступности смен для чата {chat_id if chat_id else 'по умолчанию'}")
        
        # Вызываем apply_access_settings вместо ensure_availability_task
        result = scheduler.apply_access_settings(chat_id)
        
        if result:
            return jsonify({
                "status": "success",
                "message": f"Задача уведомления о доступности смен успешно создана для чата {chat_id if chat_id else 'по умолчанию'}"
            })
        else:
            return jsonify({
                "status": "error", 
                "message": f"Не удалось создать задачу для чата {chat_id if chat_id else 'по умолчанию'}"
            }), 500
    except Exception as e:
        logger.error(f"Ошибка при планировании уведомления: {str(e)}")
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/schedule/availability/status', methods=['GET'])
def get_availability_status():
    """Получение статуса задачи уведомлений о доступности"""
    try:
        status = scheduler.get_availability_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Ошибка при получении статуса задачи уведомлений: {str(e)}")
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/scheduler/availability/status', methods=['GET'])
def get_scheduler_status():
    """Получение статуса планировщика и активных задач"""
    try:
        status = {
            'is_running': scheduler.is_running(),
            'active_tasks': []
        }
        
        if scheduler.is_running():
            # Получаем информацию о задаче уведомления о доступности
            if scheduler.availability_job:
                job = scheduler.scheduler.get_job(scheduler.availability_job)
                if job:
                    status['active_tasks'].append({
                        'id': job.id,
                        'name': job.name,
                        'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                        'trigger': str(job.trigger)
                    })
            
            # Получаем информацию о задачах сброса инвентаризации
            for chat_id, job_id in scheduler.reset_jobs.items():
                job = scheduler.scheduler.get_job(job_id)
                if job:
                    status['active_tasks'].append({
                        'id': job.id,
                        'name': job.name,
                        'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                        'trigger': str(job.trigger),
                        'chat_id': chat_id
                    })
        
        return jsonify(status), 200
        
    except Exception as e:
        logger.error(f"Ошибка при получении статуса планировщика: {str(e)}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/scheduler/reload-tasks', methods=['POST'])
def reload_tasks():
    """Принудительная перезагрузка запланированных задач"""
    try:
        success = scheduler.reload_scheduled_tasks()
        if success:
            return jsonify({"status": "success", "message": "Задачи успешно перезагружены"})
        else:
            return jsonify({"status": "error", "message": "Не удалось перезагрузить задачи"})
    except Exception as e:
        logger.error(f"Ошибка при перезагрузке задач: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/apply-access-settings', methods=['POST'])
def apply_access_settings():
    """Запускает задачу применения настроек доступа к сменам"""
    try:
        logger.info("📬 Запрос на применение настроек доступа")
        
        # Получаем chat_id из запроса
        data = request.json
        chat_id = data.get('chat_id') if data else None
        
        if not chat_id:
            logger.warning("⚠️ chat_id не указан в запросе, применяем общие настройки")
        else:
            logger.info(f"🆔 Применяем настройки доступа для чата: {chat_id}")
        
        # Запуск задачи
        result = scheduler.apply_access_settings(chat_id)
        
        return jsonify({
            'status': 'success',
            'message': 'Настройки доступа успешно применены',
            'chat_id': chat_id,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Ошибка при применении настроек доступа: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Ошибка при применении настроек доступа: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Запускаем планировщик при старте приложения
    scheduler.start()
    try:
        # Запускаем сервис на порту 8002
        app.run(host='0.0.0.0', port=8002)
    finally:
        # Останавливаем планировщик при завершении
        scheduler.stop() 