#!/usr/bin/env python3
"""
Быстрое заполнение инвентаря тестовыми данными
"""

import asyncio
import httpx
import json
import random
from datetime import datetime, timedelta

# Конфигурация
API_BASE_URL = "http://localhost:8000/api/v1"
CHAT_ID = "-1004917263769"  # ID тестового чата

# Простые тестовые данные
QUICK_TEST_DATA = {
    "Полуфабрикаты": {
        "Соус греческий": {
            "raw": {
                "quantity": 25,
                "filled": True,
                "expiry_date": (datetime.now() + timedelta(days=15)).isoformat(),
                "warning_days": 7,
                "notes": "В холодильнике"
            }
        },
        "Картофельные шарики ветчина с сыром (гр.)": {
            "raw": {
                "quantity": 50,
                "filled": True,
                "expiry_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "warning_days": 3,
                "notes": "Замороженные"
            }
        }
    },
    "Мясо и рыба": {
        "Говядина на чефан": {
            "raw": {
                "quantity": 15,
                "filled": True,
                "expiry_date": (datetime.now() + timedelta(days=3)).isoformat(),
                "warning_days": 1,
                "notes": "Свежая говядина"
            }
        }
    },
    "Овощи и фрукты": {
        "Помидоры": {
            "raw": {
                "quantity": 30,
                "filled": True,
                "expiry_date": (datetime.now() + timedelta(days=5)).isoformat(),
                "warning_days": 2,
                "notes": "Свежие помидоры"
            }
        }
    },
    "Напитки": {
        "Кока-кола 0.5л": {
            "raw": {
                "quantity": 50,
                "filled": True,
                "expiry_date": (datetime.now() + timedelta(days=180)).isoformat(),
                "warning_days": 30,
                "notes": "Газированный напиток"
            }
        }
    }
}

async def quick_fill():
    """Быстрое заполнение инвентаря"""
    
    print(f"📥 Получаем существующий инвентарь...")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Сначала получаем существующий инвентарь
            response = await client.get(f"{API_BASE_URL}/inventory/{CHAT_ID}")
            
            if response.status_code == 200:
                existing_data = response.json()
                existing_inventory = existing_data.get('inventory', {})
                existing_metadata = existing_data.get('metadata', {})
                
                print(f"✅ Получен существующий инвентарь")
                print(f"📊 Категорий: {len(existing_inventory)}")
                
                # Объединяем существующий инвентарь с нашими тестовыми данными
                merged_inventory = existing_inventory.copy()
                
                for category, items in QUICK_TEST_DATA.items():
                    if category not in merged_inventory:
                        merged_inventory[category] = {}
                    
                    for item_name, item_data in items.items():
                        merged_inventory[category][item_name] = item_data
                        print(f"➕ Добавлен: {category} - {item_name}")
                
                # Обновляем метаданные
                metadata = {
                    "lastUpdated": datetime.now().isoformat(),
                    "progress": min(existing_metadata.get('progress', 0) + 20, 100),  # Увеличиваем прогресс на 20%
                    "chat_id": CHAT_ID,
                    "start_time": existing_metadata.get('start_time', (datetime.now() - timedelta(hours=1)).isoformat())
                }
                
                payload = {
                    "inventory": merged_inventory,
                    "metadata": metadata,
                    "history": {
                        "action": "quick_fill",
                        "timestamp": datetime.now().isoformat(),
                        "user_id": "dev_script",
                        "details": "Быстрое заполнение тестовыми данными"
                    }
                }
                
            else:
                print(f"❌ Не удалось получить существующий инвентарь: {response.status_code}")
                print("🔄 Используем только тестовые данные...")
                
                metadata = {
                    "lastUpdated": datetime.now().isoformat(),
                    "progress": 60,
                    "chat_id": CHAT_ID,
                    "start_time": (datetime.now() - timedelta(hours=1)).isoformat()
                }
                
                payload = {
                    "inventory": QUICK_TEST_DATA,
                    "metadata": metadata,
                    "history": {
                        "action": "quick_fill",
                        "timestamp": datetime.now().isoformat(),
                        "user_id": "dev_script",
                        "details": "Быстрое заполнение тестовыми данными"
                    }
                }
                
    except Exception as e:
        print(f"❌ Ошибка при получении инвентаря: {e}")
        print("🔄 Используем только тестовые данные...")
        
        metadata = {
            "lastUpdated": datetime.now().isoformat(),
            "progress": 60,
            "chat_id": CHAT_ID,
            "start_time": (datetime.now() - timedelta(hours=1)).isoformat()
        }
        
        payload = {
            "inventory": QUICK_TEST_DATA,
            "metadata": metadata,
            "history": {
                "action": "quick_fill",
                "timestamp": datetime.now().isoformat(),
                "user_id": "dev_script",
                "details": "Быстрое заполнение тестовыми данными"
            }
        }
    
    print(f"🚀 Отправляем обновленный инвентарь...")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{API_BASE_URL}/inventory/{CHAT_ID}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                print("✅ Инвентарь успешно заполнен!")
                print(f"📈 Прогресс: {result.get('metadata', {}).get('progress', 0)}%")
                
                # Показываем что заполнено
                inventory = result.get('inventory', {})
                print("\n📋 Заполненные товары:")
                for category, items in inventory.items():
                    for item_name, item_data in items.items():
                        if item_data.get('raw', {}).get('filled', False):
                            quantity = item_data.get('raw', {}).get('quantity', 0)
                            print(f"  {category}: {item_name} - {quantity} шт.")
                
            else:
                print(f"❌ Ошибка: {response.status_code}")
                print(f"📝 Ответ: {response.text}")
                
    except httpx.ConnectError:
        print("❌ Не удалось подключиться к API серверу")
        print("💡 Убедитесь, что сервер запущен на http://localhost:8000")
    except Exception as e:
        print(f"❌ Произошла ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(quick_fill())
