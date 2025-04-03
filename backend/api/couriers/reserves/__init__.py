from flask import Blueprint

reserves_bp = Blueprint('reserves', __name__)

from . import routes

__all__ = ['reserves_bp'] 