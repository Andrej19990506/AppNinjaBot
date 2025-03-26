"""
API маршруты для работы с курьерами
"""
from flask import Blueprint

# Blueprint для маршрутов курьеров
couriers_bp = Blueprint('couriers', __name__, url_prefix='/couriers')

# Импортируем все обработчики маршрутов
from . import routes

# Экспортируем Blueprint для регистрации в основном приложении
__all__ = ['couriers_bp'] 