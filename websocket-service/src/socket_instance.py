import socketio

# Создаем Socket.IO сервер
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['*'],
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    allow_upgrades=True,
    max_http_buffer_size=1e8,
    ssl_context=True,  # Включаем SSL для работы с Cloudflare
    cookie=None,
    namespace='/',
    path='/socket.io',
    allow_unsafe_werkzeug=True,
    always_connect=True,
    http_compression=True,
    websocket_compression=True,
    websocket_class=None,
    websocket_max_message_size=1e8,
    websocket_ping_interval=25,
    websocket_ping_timeout=60,
    websocket_per_message_deflate=True,
    websocket_allow_upgrades=True,
    websocket_compression_options=None,
    websocket_compression_threshold=1024,
    websocket_compression_level=6,
    websocket_compression_strategy=None,
    websocket_compression_window_bits=15,
    websocket_compression_mem_level=8
) 