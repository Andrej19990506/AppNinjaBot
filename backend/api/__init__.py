"""
API Blueprints для приложения
"""
from flask import Blueprint

# Корневой Blueprint для API
api_bp = Blueprint('api', __name__, url_prefix='/api')

# В будущем здесь будут добавлены другие Blueprint'ы
# по мере создания модулей

# Импорт Blueprint'ов для разных разделов API
from .inventory import inventory_bp
from .couriers import couriers_bp

# Регистрируем подчиненные Blueprint'ы
api_bp.register_blueprint(inventory_bp)
api_bp.register_blueprint(couriers_bp) 