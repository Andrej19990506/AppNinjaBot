#!/usr/bin/env python3
"""
Скрипт для полного заполнения инвентаря из шаблона
Заполняет ВСЕ товары из inventory_template.json с реалистичными тестовыми данными
"""

import asyncio
import httpx
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

# Конфигурация
API_BASE_URL = "http://localhost:8000/api/v1"
CHAT_ID = "-1004799402850"

# Путь к шаблону инвентаря
TEMPLATE_PATH = Path("backend/API server/data/templates/inventory_template.json")

def load_inventory_template():
    """Загружает шаблон инвентаря из JSON файла"""
    try:
        with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Ошибка загрузки шаблона: {e}")
        return None

def generate_realistic_quantity(item_name, category):
    """Генерирует реалистичное количество для товара"""
    
    # Базовые количества по категориям
    category_quantities = {
        "Полуфабрикаты": (5, 50),
        "Соусы": (10, 200),
        "Масла и заправки": (5, 100),
        "Специи и приправы": (1, 50),
        "Напитки": (10, 100),
        "Бакалея": (5, 200),
        "Упаковка и приборы": (50, 1000),
        "Мясо и рыба": (1, 20),
        "Овощи и фрукты": (1, 30),
        "Бар": (5, 50),
        "Молочные продукты": (1, 20),
        "Десерты": (1, 15)
    }
    
    # Специальные случаи для конкретных товаров
    special_cases = {
        "Соус Мутти (гр.) (5000 гр)": (1, 3),  # Большая упаковка
        "Маслины (гр.) (3100 гр)": (1, 2),     # Большая упаковка
        "Ананасы   (3100 гр)": (1, 2),         # Большая упаковка
        "Яйцо куриное (шт.)": (10, 60),        # Яйца поштучно
        "Креветка тигровая (шт.)": (5, 20),    # Креветки поштучно
        "Макаруны (шт.)": (5, 25),             # Десерты поштучно
        "Чизкейк": (1, 8),                     # Чизкейки поштучно
        "Мороженое": (2, 12),                  # Мороженое поштучно
    }
    
    # Проверяем специальные случаи
    for key, (min_qty, max_qty) in special_cases.items():
        if key in item_name:
            return random.randint(min_qty, max_qty)
    
    # Используем базовые количества по категории
    min_qty, max_qty = category_quantities.get(category, (1, 50))
    return random.randint(min_qty, max_qty)

def generate_expiry_date():
    """Генерирует реалистичную дату истечения срока"""
    # 70% товаров с датой истечения (1-30 дней)
    # 30% товаров без даты истечения (долгосрочные)
    if random.random() < 0.7:
        days_ahead = random.randint(1, 30)
        return (datetime.now() + timedelta(days=days_ahead)).isoformat()
    return None

def generate_warning_days():
    """Генерирует дни предупреждения"""
    return random.randint(1, 7)

def generate_notes():
    """Генерирует случайные заметки для некоторых товаров"""
    notes_samples = [
        "В упаковке 720 шт",
        "Хранить в холодильнике",
        "Проверить срок годности",
        "Заказать дополнительно",
        "Осталось мало",
        "Новая партия",
        "Специальная цена",
        "Требует особого хранения"
    ]
    
    # 20% товаров получают заметки
    if random.random() < 0.2:
        return random.choice(notes_samples)
    return ""

def fill_inventory_with_realistic_data(template_inventory):
    """Заполняет инвентарь реалистичными тестовыми данными"""
    filled_inventory = {}
    
    for category, items in template_inventory.items():
        filled_inventory[category] = {}
        
        for item_name, item_data in items.items():
            # Генерируем реалистичные данные
            quantity = generate_realistic_quantity(item_name, category)
            expiry_date = generate_expiry_date()
            warning_days = generate_warning_days() if expiry_date else None
            notes = generate_notes()
            
            # Создаем структуру товара
            filled_item = {
                "raw": {
                    "quantity": quantity,
                    "filled": quantity > 0,
                    "expiry_date": expiry_date,
                    "warning_days": warning_days,
                    "notes": notes
                }
            }
            
            # Некоторые товары могут иметь полуфабрикаты
            if random.random() < 0.3:  # 30% товаров имеют полуфабрикаты
                semifinished_quantity = max(1, quantity // 2)
                filled_item["semifinished"] = {
                    "quantity": semifinished_quantity,
                    "filled": semifinished_quantity > 0,
                    "expiry_date": expiry_date,
                    "warning_days": warning_days,
                    "notes": f"Полуфабрикат: {notes}"
                }
            
            filled_inventory[category][item_name] = filled_item
    
    return filled_inventory

async def fill_full_inventory():
    """Заполняет весь инвентарь из шаблона"""
    
    print("📥 Загружаем шаблон инвентаря...")
    template_inventory = load_inventory_template()
    
    if not template_inventory:
        print("❌ Не удалось загрузить шаблон инвентаря")
        return
    
    print(f"✅ Шаблон загружен: {len(template_inventory)} категорий")
    
    # Подсчитываем общее количество товаров
    total_items = sum(len(items) for items in template_inventory.values())
    print(f"📦 Общее количество товаров: {total_items}")
    
    print("🔄 Генерируем реалистичные тестовые данные...")
    filled_inventory = fill_inventory_with_realistic_data(template_inventory)
    
    # Создаем метаданные
    metadata = {
        "lastUpdated": datetime.now().isoformat(),
        "progress": 100,  # Полностью заполнено
        "chat_id": CHAT_ID,
        "start_time": (datetime.now() - timedelta(hours=3)).isoformat()
    }
    
    # Подготавливаем данные для отправки
    payload = {
        "inventory": filled_inventory,
        "metadata": metadata,
        "history": {
            "action": "full_inventory_fill",
            "timestamp": datetime.now().isoformat(),
            "user_id": "dev_script",
            "details": "Полное заполнение инвентаря из шаблона"
        }
    }
    
    print(f"🚀 Отправляем полный инвентарь для чата {CHAT_ID}...")
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{API_BASE_URL}/inventory/{CHAT_ID}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            print(f"📊 Статус код: {response.status_code}")
            print(f"📊 Headers: {response.headers}")
            print(f"📊 Текст ответа: {response.text[:500]}")  
            if response.status_code == 200:
                result = response.json()
                print("✅ Инвентарь успешно заполнен!")
                print(f"📈 Прогресс: {result.get('metadata', {}).get('progress', 0)}%")
                
                # Показываем статистику по категориям
                print("\n📊 Статистика по категориям:")
                for category, items in filled_inventory.items():
                    total_qty = sum(item.get('raw', {}).get('quantity', 0) for item in items.values())
                    semifinished_qty = sum(item.get('semifinished', {}).get('quantity', 0) for item in items.values())
                    print(f"  {category}: {len(items)} товаров, сырье: {total_qty}, полуфабрикаты: {semifinished_qty}")
                
                # Показываем примеры заполненных товаров
                print("\n📋 Примеры заполненных товаров:")
                count = 0
                for category, items in filled_inventory.items():
                    for item_name, item_data in items.items():
                        if count >= 10:  # Показываем только первые 10
                            break
                        raw_qty = item_data.get('raw', {}).get('quantity', 0)
                        semifinished_qty = item_data.get('semifinished', {}).get('quantity', 0)
                        notes = item_data.get('raw', {}).get('notes', '')
                        print(f"  {category}: {item_name} - сырье: {raw_qty}, полуфабрикаты: {semifinished_qty}" + (f", заметки: {notes}" if notes else ""))
                        count += 1
                    if count >= 10:
                        break
                
                print(f"\n🎉 Инвентарь полностью заполнен! Всего товаров: {total_items}")
                
            else:
                print(f"❌ Ошибка при заполнении инвентаря: {response.status_code}")
                print(f"Ответ сервера: {response.text}")
                
    except Exception as e:
        print(f"❌ Ошибка при отправке запроса: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Главная функция"""
    print("🚀 Запуск полного заполнения инвентаря...")
    print(f"📡 API: {API_BASE_URL}")
    print(f"💬 Чат: {CHAT_ID}")
    print(f"📄 Шаблон: {TEMPLATE_PATH}")
    print("-" * 50)
    
    await fill_full_inventory()

if __name__ == "__main__":
    asyncio.run(main())
