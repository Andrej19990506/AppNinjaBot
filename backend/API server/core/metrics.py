"""
Prometheus metrics for API Server
"""
from prometheus_client import Counter, Gauge, Histogram, REGISTRY
import time
from functools import wraps

# API Server метрики
http_requests_total = None
http_request_duration_seconds = None
http_errors_total = None
http_requests_in_progress = None
active_connections = None
database_connections = None
redis_operations = None
business_logic_operations = None

def init_metrics():
    """Инициализация метрик Prometheus для API Server"""
    global http_requests_total, http_request_duration_seconds, http_errors_total, http_requests_in_progress
    global active_connections, database_connections, redis_operations, business_logic_operations
    
    # HTTP метрики
    if 'api_http_requests_total' not in REGISTRY._collector_to_names:
        http_requests_total = Counter(
            'api_http_requests_total', 
            'Total HTTP requests', 
            ['method', 'endpoint', 'status_code']
        )
    
    if 'api_http_request_duration_seconds' not in REGISTRY._collector_to_names:
        http_request_duration_seconds = Histogram(
            'api_http_request_duration_seconds',
            'HTTP request duration in seconds',
            ['method', 'endpoint']
        )
    
    if 'api_http_errors_total' not in REGISTRY._collector_to_names:
        http_errors_total = Counter(
            'api_http_errors_total',
            'Total HTTP errors',
            ['error_type', 'endpoint']
        )
    
    if 'api_http_requests_in_progress' not in REGISTRY._collector_to_names:
        http_requests_in_progress = Gauge(
            'api_http_requests_in_progress',
            'Number of HTTP requests currently being processed',
            ['method', 'endpoint']
        )
    
    # Connection метрики
    if 'api_active_connections' not in REGISTRY._collector_to_names:
        active_connections = Gauge(
            'api_active_connections',
            'Number of active connections'
        )
    
    # Database метрики
    if 'api_database_connections' not in REGISTRY._collector_to_names:
        database_connections = Gauge(
            'api_database_connections',
            'Number of database connections',
            ['status']  # active, idle, total
        )
    
    # Redis метрики
    if 'api_redis_operations' not in REGISTRY._collector_to_names:
        redis_operations = Counter(
            'api_redis_operations',
            'Number of Redis operations',
            ['operation', 'status']  # get, set, delete, success, error
        )
    
    # Business logic метрики
    if 'api_business_operations' not in REGISTRY._collector_to_names:
        business_logic_operations = Counter(
            'api_business_operations',
            'Business logic operations',
            ['operation', 'status']  # shift_created, shift_deleted, user_registered, etc.
        )

def track_request_duration(func):
    """Декоратор для отслеживания времени выполнения запросов"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            duration = time.time() - start_time
            if http_request_duration_seconds:
                # Извлекаем информацию о запросе из kwargs или args
                endpoint = kwargs.get('endpoint', 'unknown')
                method = kwargs.get('method', 'unknown')
                http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)
    return wrapper

def increment_http_requests(method: str, endpoint: str, status_code: int):
    """Увеличить счетчик HTTP запросов"""
    if http_requests_total:
        http_requests_total.labels(method=method, endpoint=endpoint, status_code=status_code).inc()

def increment_http_errors(error_type: str, endpoint: str):
    """Увеличить счетчик HTTP ошибок"""
    if http_errors_total:
        http_errors_total.labels(error_type=error_type, endpoint=endpoint).inc()

def increment_business_operation(operation: str, status: str = 'success'):
    """Увеличить счетчик бизнес-операций"""
    if business_logic_operations:
        business_logic_operations.labels(operation=operation, status=status).inc()

def increment_redis_operation(operation: str, status: str = 'success'):
    """Увеличить счетчик Redis операций"""
    if redis_operations:
        redis_operations.labels(operation=operation, status=status).inc()

def set_database_connections(active: int, idle: int, total: int):
    """Установить количество подключений к БД"""
    if database_connections:
        database_connections.labels(status='active').set(active)
        database_connections.labels(status='idle').set(idle)
        database_connections.labels(status='total').set(total)

def set_active_connections(count: int):
    """Установить количество активных подключений"""
    if active_connections:
        active_connections.set(count)

def increment_requests_in_progress(method: str, endpoint: str):
    """Увеличить счетчик запросов в обработке"""
    if http_requests_in_progress:
        http_requests_in_progress.labels(method=method, endpoint=endpoint).inc()

def decrement_requests_in_progress(method: str, endpoint: str):
    """Уменьшить счетчик запросов в обработке"""
    if http_requests_in_progress:
        http_requests_in_progress.labels(method=method, endpoint=endpoint).dec()

# Инициализируем метрики при импорте
init_metrics()
