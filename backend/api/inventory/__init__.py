"""
API маршруты для работы с инвентарем
"""
from flask import Blueprint

# Blueprint для маршрутов инвентаря
inventory_bp = Blueprint('inventory', __name__, url_prefix='/inventory')

# Импортируем все обработчики маршрутов
from . import routes

# Экспортируем Blueprint для регистрации в основном приложении
__all__ = ['inventory_bp'] 