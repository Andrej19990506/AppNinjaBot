from flask import Blueprint, jsonify, request
from datetime import datetime
import logging
import sys
import os

# Добавляем директорию проекта в sys.path для правильного импорта
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from scheduler import InventoryScheduler

logger = logging.getLogger(__name__)
availability_bp = Blueprint('schedule_availability', __name__)

# Получаем инстанс шедулера
scheduler = InventoryScheduler()

@availability_bp.route('/access-settings', methods=['POST'])
def apply_access_settings():
    """Применение настроек доступа к сменам для чата"""
    try:
        data = request.json
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return jsonify({
                'status': 'error',
                'message': 'chat_id is required'
            }), 400
            
        logger.info(f"📬 Применяем настройки доступа для чата: {chat_id}")
        
        result = scheduler.apply_access_settings(chat_id)
        if result:
            return jsonify({
                'status': 'success',
                'message': 'Настройки доступа успешно применены',
                'chat_id': chat_id,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Не удалось применить настройки доступа'
            }), 500
            
    except Exception as e:
        logger.error(f"❌ Ошибка при применении настроек доступа: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@availability_bp.route('/check', methods=['POST'])
def schedule_availability():
    """Планирование уведомления о доступности смен"""
    try:
        data = request.json
        chat_id = data.get('chat_id')
        
        logger.info(f"📅 Запрос на планирование доступности смен для чата {chat_id if chat_id else 'по умолчанию'}")
        
        result = scheduler.apply_access_settings(chat_id)
        
        if result:
            return jsonify({
                "status": "success",
                "message": f"Задача уведомления о доступности смен успешно создана",
                "chat_id": chat_id,
                "timestamp": datetime.now().isoformat()
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Не удалось создать задачу"
            }), 500
    except Exception as e:
        logger.error(f"❌ Ошибка при планировании уведомления: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500 