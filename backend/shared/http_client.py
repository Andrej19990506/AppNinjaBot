"""
Общий HTTP клиент для всех сервисов.
Этот файл располагается в общем volume и используется всеми микросервисами.
"""

import httpx
import os
from typing import Dict, Any, Optional, Union

def get_http_client(
    headers: Optional[Dict[str, Any]] = None,
    timeout: float = 10.0,
    follow_redirects: bool = True
) -> httpx.Client:
    """
    Создает и возвращает синхронный HTTP-клиент для запросов к сервисам.
    
    Args:
        headers: Дополнительные заголовки для запросов
        timeout: Таймаут для запросов в секундах
        follow_redirects: Следовать ли редиректам
        
    Returns:
        Синхронный httpx.Client для выполнения запросов
    """
    if headers is None:
        headers = {}
    
    return httpx.Client(
        headers=headers,
        timeout=timeout,
        follow_redirects=follow_redirects
    )

async def get_async_http_client(
    headers: Optional[Dict[str, Any]] = None,
    timeout: float = 10.0,
    follow_redirects: bool = True
) -> httpx.AsyncClient:
    """
    Создает и возвращает асинхронный HTTP-клиент для запросов к сервисам.

    Args:
        headers: Дополнительные заголовки для запросов
        timeout: Таймаут для запросов в секундах
        follow_redirects: Следовать ли редиректам

    Returns:
        Асинхронный httpx.AsyncClient для выполнения запросов
    """
    if headers is None:
        headers = {}

    return httpx.AsyncClient(
        headers=headers,
        timeout=timeout,
        follow_redirects=follow_redirects
    )

