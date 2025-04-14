import httpx
import os
from typing import Dict, Any, Optional

def get_http_client(
    headers: Optional[Dict[str, Any]] = None,
    timeout: float = 10.0,
    follow_redirects: bool = True
) -> httpx.Client:
    """
    Создает и возвращает клиент HTTP для запросов к сервисам.
    
    Args:
        headers: Дополнительные заголовки для запросов
        timeout: Таймаут для запросов в секундах
        follow_redirects: Следовать ли редиректам
        
    Returns:
        Клиент httpx для выполнения запросов
    """
    if headers is None:
        headers = {}
    
    return httpx.Client(
        headers=headers,
        timeout=timeout,
        follow_redirects=follow_redirects
    ) 