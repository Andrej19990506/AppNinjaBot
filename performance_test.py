#!/usr/bin/env python3
"""
Скрипт для тестирования производительности записи в смены
Имитирует 250 одновременных пользователей
"""

import asyncio
import aiohttp
import time
import json
import random
from datetime import datetime, timedelta
import statistics

# Конфигурация теста
API_BASE_URL = "http://localhost:8000/api/v1"
CONCURRENT_USERS = 250
TEST_DURATION = 60  # секунд

# Тестовые данные
TEST_GROUPS = [
    {"group_id": -1001234567890, "group_type": "courier"},
    {"group_id": -1001234567891, "group_type": "courier"},
    {"group_id": -1001234567892, "group_type": "courier"},
]

TEST_USERS = [
    {"user_id": 123456789, "name": "TestUser1"},
    {"user_id": 123456790, "name": "TestUser2"},
    {"user_id": 123456791, "name": "TestUser3"},
    # ... добавьте реальные Telegram ID пользователей
]

async def create_shift_request(session, user_data, group_data):
    """Отправляет запрос на создание смены"""
    shift_data = {
        "date": (datetime.now() + timedelta(days=random.randint(1, 7))).strftime("%Y-%m-%d"),
        "shift_type": random.choice(["day", "night"]),
        "slot_index": random.randint(0, 10),
        "user_telegram_id": user_data["user_id"],
        "group_telegram_id": group_data["group_id"]
    }
    
    start_time = time.time()
    
    try:
        async with session.post(
            f"{API_BASE_URL}/shifts/",
            json=shift_data,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            end_time = time.time()
            response_time = end_time - start_time
            
            if response.status == 200:
                return {
                    "status": "success",
                    "response_time": response_time,
                    "status_code": response.status
                }
            else:
                return {
                    "status": "error",
                    "response_time": response_time,
                    "status_code": response.status,
                    "error": await response.text()
                }
                
    except asyncio.TimeoutError:
        return {
            "status": "timeout",
            "response_time": 30.0,
            "status_code": 0
        }
    except Exception as e:
        return {
            "status": "exception",
            "response_time": time.time() - start_time,
            "status_code": 0,
            "error": str(e)
        }

async def run_performance_test():
    """Запускает нагрузочный тест"""
    print(f"🚀 Запуск теста производительности...")
    print(f"📊 Параметры: {CONCURRENT_USERS} пользователей, {TEST_DURATION} секунд")
    
    connector = aiohttp.TCPConnector(limit=300, limit_per_host=100)
    timeout = aiohttp.ClientTimeout(total=30)
    
    async with aiohttp.ClientSession(
        connector=connector,
        timeout=timeout
    ) as session:
        
        # Создаем задачи для всех пользователей
        tasks = []
        for i in range(CONCURRENT_USERS):
            user = TEST_USERS[i % len(TEST_USERS)]
            group = TEST_GROUPS[i % len(TEST_GROUPS)]
            
            task = create_shift_request(session, user, group)
            tasks.append(task)
        
        # Запускаем все запросы одновременно
        print(f"⏱️  Отправляем {len(tasks)} запросов одновременно...")
        start_time = time.time()
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Анализируем результаты
        analyze_results(results, total_time)

def analyze_results(results, total_time):
    """Анализирует результаты теста"""
    print(f"\n📈 РЕЗУЛЬТАТЫ ТЕСТА:")
    print(f"⏱️  Общее время: {total_time:.2f} секунд")
    print(f"📊 Всего запросов: {len(results)}")
    
    # Статистика по статусам
    status_counts = {}
    response_times = []
    errors = []
    
    for result in results:
        if isinstance(result, Exception):
            errors.append(str(result))
            continue
            
        status = result["status"]
        status_counts[status] = status_counts.get(status, 0) + 1
        
        if "response_time" in result:
            response_times.append(result["response_time"])
        
        if status == "error" and "error" in result:
            errors.append(result["error"])
    
    # Выводим статистику
    print(f"\n✅ Успешные запросы: {status_counts.get('success', 0)}")
    print(f"❌ Ошибки: {status_counts.get('error', 0)}")
    print(f"⏰ Timeout'ы: {status_counts.get('timeout', 0)}")
    print(f"💥 Исключения: {status_counts.get('exception', 0)}")
    
    if response_times:
        print(f"\n⏱️  ВРЕМЯ ОТВЕТА:")
        print(f"   Среднее: {statistics.mean(response_times):.3f} сек")
        print(f"   Медиана: {statistics.median(response_times):.3f} сек")
        print(f"   Минимум: {min(response_times):.3f} сек")
        print(f"   Максимум: {max(response_times):.3f} сек")
        print(f"   95-й перцентиль: {sorted(response_times)[int(len(response_times) * 0.95)]:.3f} сек")
    
    # RPS (Requests Per Second)
    rps = len(results) / total_time
    print(f"\n🚀 ПРОИЗВОДИТЕЛЬНОСТЬ:")
    print(f"   RPS: {rps:.2f} запросов/сек")
    print(f"   Успешных RPS: {status_counts.get('success', 0) / total_time:.2f} запросов/сек")
    
    # Показываем ошибки
    if errors:
        print(f"\n❌ ОШИБКИ ({len(errors)}):")
        for error in errors[:5]:  # Показываем первые 5 ошибок
            print(f"   {error}")
        if len(errors) > 5:
            print(f"   ... и еще {len(errors) - 5} ошибок")

if __name__ == "__main__":
    asyncio.run(run_performance_test())
