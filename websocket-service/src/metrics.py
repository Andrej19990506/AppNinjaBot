from prometheus_client import Counter, Gauge, REGISTRY

# Метрики
connected_clients = None
messages_sent = None
events_received = None

def init_metrics():
    """Инициализация метрик Prometheus"""
    global connected_clients, messages_sent, events_received
    
    # Проверяем, не существуют ли уже метрики
    if 'websocket_connected_clients' not in REGISTRY._collector_to_names:
        connected_clients = Gauge('websocket_connected_clients', 'Number of connected clients')
    if 'websocket_messages_sent' not in REGISTRY._collector_to_names:
        messages_sent = Counter('websocket_messages_sent', 'Number of messages sent') 
    if 'websocket_events_received' not in REGISTRY._collector_to_names:
        events_received = Counter('websocket_events_received', 'Number of events received', ['event'])

# --- Вызываем инициализацию метрик сразу при импорте модуля --- 
init_metrics()
# -------------------------------------------------------------- 