"""
Инициализация Flask-расширений для приложения.
Этот модуль предоставляет центральную точку для инициализации расширений,
которые используются в приложении Flask.
"""
from flask_cors import CORS
from flask_socketio import SocketIO

# Создаем экземпляры расширений с отложенной инициализацией
# Они будут инициализированы позже с экземпляром приложения Flask
cors = CORS()
socketio = SocketIO()

def init_extensions(app):
    """
    Инициализирует все расширения Flask с экземпляром приложения.
    
    Args:
        app: Экземпляр приложения Flask
    """
    # Настраиваем CORS
    cors.init_app(app, resources={
        r"/api/*": {
            "origins": app.config.get('CORS_ALLOWED_ORIGINS', []),
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Origin", "Accept", "X-Requested-With"]
        }
    })

    # Инициализируем Socket.IO
    socketio.init_app(
        app,
        cors_allowed_origins=app.config.get('CORS_ALLOWED_ORIGINS', []),
        async_mode='gevent',
        ping_timeout=app.config.get('WEBSOCKET_PING_TIMEOUT', 60),
        ping_interval=app.config.get('WEBSOCKET_PING_INTERVAL', 25),
        max_http_buffer_size=app.config.get('WEBSOCKET_MAX_BUFFER_SIZE', 1e8),
        logger=True,
        engineio_logger=True
    ) 