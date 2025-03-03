from flask import Flask, jsonify, request
from scheduler import scheduler
import logging
from datetime import datetime
import traceback

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SchedulerService')

app = Flask(__name__)

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

if __name__ == '__main__':
    # Запускаем планировщик
    scheduler.start()
    try:
        # Запускаем сервис на порту 8002
        app.run(host='0.0.0.0', port=8002)
    finally:
        # Останавливаем планировщик при завершении
        scheduler.stop() 