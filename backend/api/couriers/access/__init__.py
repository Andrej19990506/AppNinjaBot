"""
API маршруты для управления доступом курьеров
"""
from flask import Blueprint

# Blueprint для маршрутов доступа
access_bp = Blueprint('access', __name__)

from . import routes

# Экспортируем Blueprint для регистрации в основном приложении
__all__ = ['access_bp'] 