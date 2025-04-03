"""
API маршруты для работы с курьерами
"""
from flask import Blueprint

# Blueprint для маршрутов курьеров
couriers_bp = Blueprint('couriers', __name__)

from .shifts import shifts_bp
from .reserves import reserves_bp
from .access import access_bp
from . import routes

# Регистрируем подмодули
couriers_bp.register_blueprint(shifts_bp, url_prefix='/shifts')
couriers_bp.register_blueprint(reserves_bp, url_prefix='/reserves')
couriers_bp.register_blueprint(access_bp, url_prefix='/access')

# Экспортируем Blueprint для регистрации в основном приложении
__all__ = ['couriers_bp'] 