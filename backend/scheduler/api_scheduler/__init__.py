from flask import Blueprint
from .schedule.routes import schedule_bp

# Создаем главный blueprint для API шедулера
api_scheduler_bp = Blueprint('api_scheduler', __name__)

# Регистрируем blueprint'ы
api_scheduler_bp.register_blueprint(schedule_bp, url_prefix='/scheduler') 