from scheduler import InventoryScheduler
import logging
from flask import Flask, request, jsonify
import os
from datetime import datetime

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SchedulerService')

# Создаем и запускаем шедулер
scheduler_instance = InventoryScheduler()

# Создаем Flask-приложение
app = Flask(__name__)

# Регистрируем blueprint
from api_scheduler import api_scheduler_bp
app.register_blueprint(api_scheduler_bp)

# Добавляем маршрут для обратной совместимости
@app.route('/apply-access-settings', methods=['POST'])
def legacy_apply_access_settings():
    """Обертка для обратной совместимости с маршрутом /apply-access-settings"""
    try:
        data = request.json
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return jsonify({
                'status': 'error',
                'message': 'chat_id is required'
            }), 400
            
        logger.info(f"📬 Запрос на применение настроек доступа (legacy route)")
        logger.info(f"🆔 Применяем настройки доступа для чата: {chat_id}")
        
        result = scheduler_instance.apply_access_settings(chat_id)
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

if __name__ == '__main__':
    try:
        logger.info("🚀 Запуск сервиса шедулера...")
        scheduler_instance.start()
        logger.info("✅ Шедулер успешно запущен")
        
        # Запускаем Flask-сервер
        app.run(host='0.0.0.0', port=8002)
    except KeyboardInterrupt:
        logger.info("👋 Получен сигнал завершения")
        scheduler_instance.stop()
        logger.info("✅ Шедулер остановлен") 