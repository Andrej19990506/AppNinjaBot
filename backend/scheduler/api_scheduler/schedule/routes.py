from flask import Blueprint, jsonify, request
from datetime import datetime
import logging
import sys
import os

# Добавляем директорию проекта в sys.path для правильного импорта
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from scheduler import InventoryScheduler
from .availability import availability_bp

logger = logging.getLogger(__name__)
schedule_bp = Blueprint('schedule', __name__)

# Регистрируем подмодули
schedule_bp.register_blueprint(availability_bp, url_prefix='/availability')

# Получаем инстанс шедулера
scheduler = InventoryScheduler()

@schedule_bp.route('/health')
def health_check():
    """Проверка здоровья шедулера"""
    try:
        return jsonify({
            'status': 'healthy',
            'scheduler_running': scheduler.is_running(),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"❌ Ошибка при проверке здоровья шедулера: {str(e)}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@schedule_bp.route('/status')
def scheduler_status():
    """Получение полного статуса планировщика и всех активных задач"""
    try:
        status = {
            'is_running': scheduler.is_running(),
            'active_tasks': [],
            'timestamp': datetime.now().isoformat()
        }
        
        if scheduler.is_running():
            active_tasks = scheduler._get_all_active_tasks()
            for task in active_tasks:
                status['active_tasks'].append({
                    'id': task.task_id,
                    'type': task.task_type,
                    'chat_id': task.chat_id,
                    'next_run_time': task.next_run_time.isoformat() if task.next_run_time else None,
                    'data': task.data
                })
        
        return jsonify(status)
        
    except Exception as e:
        logger.error(f"❌ Ошибка при получении статуса планировщика: {str(e)}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@schedule_bp.route('/reload-tasks', methods=['POST'])
def reload_tasks():
    """Принудительная перезагрузка всех запланированных задач"""
    try:
        success = scheduler.reload_scheduled_tasks()
        if success:
            return jsonify({
                "status": "success",
                "message": "Задачи успешно перезагружены",
                "timestamp": datetime.now().isoformat()
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Не удалось перезагрузить задачи"
            }), 500
    except Exception as e:
        logger.error(f"❌ Ошибка при перезагрузке задач: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500 