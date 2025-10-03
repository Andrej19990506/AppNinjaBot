from prometheus_client import Counter, Gauge, Histogram, Summary, REGISTRY

# WebSocket метрики
connected_clients = None
messages_sent = None
events_received = None
connection_errors = None
redis_operations = None
message_processing_time = None
active_rooms = None

def init_metrics():
    """Инициализация метрик Prometheus"""
    global connected_clients, messages_sent, events_received, connection_errors, redis_operations, message_processing_time, active_rooms
    
    # Проверяем, не существуют ли уже метрики
    if 'websocket_connected_clients' not in REGISTRY._collector_to_names:
        connected_clients = Gauge('websocket_connected_clients', 'Number of connected clients')
    if 'websocket_messages_sent' not in REGISTRY._collector_to_names:
        messages_sent = Counter('websocket_messages_sent', 'Number of messages sent', ['room']) 
    if 'websocket_events_received' not in REGISTRY._collector_to_names:
        events_received = Counter('websocket_events_received', 'Number of events received', ['event'])
    if 'websocket_connection_errors' not in REGISTRY._collector_to_names:
        connection_errors = Counter('websocket_connection_errors', 'Number of connection errors', ['error_type'])
    if 'websocket_redis_operations' not in REGISTRY._collector_to_names:
        redis_operations = Counter('websocket_redis_operations', 'Number of Redis operations', ['operation', 'status'])
    if 'websocket_message_processing_time' not in REGISTRY._collector_to_names:
        message_processing_time = Histogram('websocket_message_processing_time', 'Time spent processing messages', ['message_type'])
    if 'websocket_active_rooms' not in REGISTRY._collector_to_names:
        active_rooms = Gauge('websocket_active_rooms', 'Number of active rooms')

# --- Вызываем инициализацию метрик сразу при импорте модуля --- 
init_metrics()
# -------------------------------------------------------------- 