from flask import Blueprint

shifts_bp = Blueprint('shifts', __name__)

from . import routes

__all__ = ['shifts_bp'] 