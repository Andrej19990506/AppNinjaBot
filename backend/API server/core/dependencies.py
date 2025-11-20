import redis.asyncio as redis
from typing import Optional
import sys

async def get_redis_client() -> Optional[redis.Redis]:
    """
    Получает Redis клиент из main модуля.
    Импортирует модуль динамически при каждом вызове, чтобы получить актуальное значение redis_client.
    Это нужно, потому что redis_client инициализируется в lifespan, а не при загрузке модуля.
    """
    try:
        # Пробуем найти модуль main в sys.modules (может быть 'main' или полный путь)
        for module_name in sys.modules.keys():
            if module_name == 'main' or module_name.endswith('.main'):
                main_module = sys.modules[module_name]
                redis_client = getattr(main_module, 'redis_client', None)
                if redis_client is not None:
                    return redis_client
        
        # Если не нашли в sys.modules, пробуем импортировать напрямую
        # Это fallback на случай, если модуль еще не загружен
        try:
            import main
            return getattr(main, 'redis_client', None)
        except ImportError:
            try:
                from .. import main
                return getattr(main, 'redis_client', None)
            except ImportError:
                return None
    except Exception:
        # В случае любой ошибки возвращаем None
        return None 