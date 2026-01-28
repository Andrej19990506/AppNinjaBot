#!/usr/bin/env python3
"""
Скрипт для проверки заполненности товаров, которые выведены из ассортимента.
Проверяет последнюю инвентаризацию в БД для указанных групп.
"""

import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from sqlalchemy import text
import os
from datetime import datetime

# Настройки подключения к БД (из docker-compose)
DATABASE_URL = "postgresql+asyncpg://postgres:qkfUdU9T7hjJm-VelFLI@localhost:5432/appninjabot"

# Список групп для проверки
CHAT_IDS = [
    -1001762337667,
    -1001614098599,
    -1001792581814,
    -1001569973072,
    -1001733610365,
    -1001247080644,
    -1002671092354
]

# Список товаров, которые нужно проверить (из таблицы)
ITEMS_TO_CHECK = [
    # Напитки
    ("Напитки", "Вода БонАква 1л. (гр.)"),
    ("Напитки", "Компотная смесь (гр.)"),
    ("Напитки", "Лёд (гр.)"),
    
    # Овощи и фрукты
    ("Овощи и фрукты", "Компотная смесь (гр.)"),
    ("Овощи и фрукты", "Лайм (гр.)"),
    ("Овощи и фрукты", "Мята (гр.)"),
    
    # Бакалея
    ("Бакалея", "Квашеная капуста в клюквой (мл.)"),
    
    # Мясо и рыба
    ("Мясо и рыба", "Крылья куриные (гр.)"),
    ("Мясо и рыба", "Крылья куриные (Маринованные) (гр.)"),
    ("Мясо и рыба", "Фарш (гр.)"),
    ("Мясо и рыба", "Форель (гр.)"),
    
    # Полуфабрикаты
    ("Полуфабрикаты", "Куриное филе маринованное"),
    
    # Десерты
    ("Десерты", "Макаруны (шт.)"),
    
    # Масла и заправки
    ("Масла и заправки", "Маринад для курицы гриль (гр.)"),
    
    # Соусы
    ("Соусы", "Соус Man (гр.)"),
    
    # Упаковка и приборы
    ("Упаковка и приборы", "Бутылка 0,45 л. (шт.)"),
    ("Упаковка и приборы", "Бутылка 0,65 л. (шт.)"),
    ("Упаковка и приборы", "Крышка к коробке для кусочка"),
    
    # Бар (сиропы)
    ("Бар", "Сироп Арбуз (мл.)"),
    ("Бар", "Сироп Ваниль (мл.)"),
    ("Бар", "Сироп Дыня (мл.)"),
    ("Бар", "Сироп Лаванда (мл.)"),
    ("Бар", "Сироп Малина (мл.)"),
    ("Бар", "Сироп Мандарин (мл.)"),
    ("Бар", "Сироп Мохито (мл.)"),
    ("Бар", "Сироп Перечная мята (мл.)"),
]

# Создаём движок БД
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def check_item_filled(item_data):
    """Проверяет, заполнен ли товар (есть ли количество)"""
    if not isinstance(item_data, dict):
        return False, 0
    
    filled = False
    quantity = 0
    
    # Проверяем raw
    if 'raw' in item_data and isinstance(item_data['raw'], dict):
        raw = item_data['raw']
        if raw.get('filled') or raw.get('quantity', 0) > 0 or raw.get('isOutOfStock'):
            filled = True
            quantity = raw.get('quantity', 0)
    
    # Проверяем semifinished
    if 'semifinished' in item_data and isinstance(item_data['semifinished'], dict):
        semi = item_data['semifinished']
        if semi.get('filled') or semi.get('quantity', 0) > 0:
            filled = True
            if quantity == 0:  # Если raw не заполнен, берём semifinished
                quantity = semi.get('quantity', 0)
    
    return filled, quantity


async def get_group_inventory(session, chat_id):
    """Получает инвентарь группы из БД"""
    try:
        # Находим группу по group_id
        query = text("""
            SELECT id, chat_name, inventory_data, last_updated 
            FROM groups 
            WHERE group_id = :chat_id
        """)
        result = await session.execute(query, {"chat_id": chat_id})
        row = result.fetchone()
        
        if not row:
            return None, None, None
        
        group_id, chat_name, inventory_data, last_updated = row
        
        # Парсим JSON инвентаря
        if inventory_data and isinstance(inventory_data, str):
            inventory_data = json.loads(inventory_data)
        
        return chat_name, inventory_data, last_updated
        
    except Exception as e:
        print(f"❌ Ошибка получения инвентаря для chat_id {chat_id}: {e}")
        return None, None, None


async def check_items_in_groups():
    """Основная функция проверки товаров по группам"""
    
    print("=" * 80)
    print("🔍 ПРОВЕРКА ВЫВЕДЕННЫХ ТОВАРОВ В ИНВЕНТАРИЗАЦИИ")
    print("=" * 80)
    print(f"\n📋 Проверяем {len(ITEMS_TO_CHECK)} товаров в {len(CHAT_IDS)} группах\n")
    
    # Результаты
    groups_with_items = {}
    total_filled_items = 0
    
    async with async_session() as session:
        for chat_id in CHAT_IDS:
            print(f"📦 Проверка группы: {chat_id}")
            
            chat_name, inventory, last_updated = await get_group_inventory(session, chat_id)
            
            if not inventory:
                print(f"  ⚠️  Инвентарь не найден или пуст")
                print()
                continue
            
            print(f"  📝 Название: {chat_name}")
            print(f"  🕐 Последнее обновление: {last_updated}")
            
            # Проверяем каждый товар
            found_items = []
            
            for category, item_name in ITEMS_TO_CHECK:
                # Проверяем разные варианты категорий (с кодировкой/без)
                category_data = inventory.get(category, {})
                
                if not isinstance(category_data, dict):
                    continue
                
                # Ищем товар в категории
                item_data = category_data.get(item_name)
                
                if item_data:
                    is_filled, quantity = check_item_filled(item_data)
                    
                    if is_filled:
                        found_items.append({
                            'category': category,
                            'item': item_name,
                            'quantity': quantity
                        })
                        total_filled_items += 1
            
            if found_items:
                groups_with_items[chat_id] = {
                    'chat_name': chat_name,
                    'items': found_items,
                    'last_updated': str(last_updated) if last_updated else 'N/A'
                }
                
                print(f"  ✅ Найдено {len(found_items)} заполненных товаров:")
                for item in found_items:
                    print(f"     • {item['category']} / {item['item']} = {item['quantity']}")
            else:
                print(f"  ✅ Нет заполненных товаров из списка")
            
            print()
    
    # Итоговый отчёт
    print("=" * 80)
    print("📊 ИТОГОВЫЙ ОТЧЁТ")
    print("=" * 80)
    print()
    
    if groups_with_items:
        print(f"⚠️  ВНИМАНИЕ! Найдены заполненные товары в {len(groups_with_items)} группах:")
        print()
        
        for chat_id, data in groups_with_items.items():
            print(f"🏪 {data['chat_name']} (ID: {chat_id})")
            print(f"   Последнее обновление: {data['last_updated']}")
            print(f"   Заполненных товаров: {len(data['items'])}")
            
            # Группируем по категориям
            by_category = {}
            for item in data['items']:
                cat = item['category']
                if cat not in by_category:
                    by_category[cat] = []
                by_category[cat].append(item)
            
            for cat, items in by_category.items():
                print(f"   📂 {cat}:")
                for item in items:
                    print(f"      • {item['item']} = {item['quantity']}")
            print()
        
        print(f"📈 Всего заполненных товаров: {total_filled_items}")
        print()
        print("⚠️  РЕКОМЕНДАЦИЯ: Перед удалением этих товаров из шаблона,")
        print("   необходимо сбросить инвентаризацию в указанных группах")
        print("   или вручную очистить эти позиции!")
        
    else:
        print("✅ Отлично! Ни в одной группе нет заполненных товаров из списка.")
        print("   Можно безопасно удалять эти позиции из шаблона.")
    
    print()
    print("=" * 80)


async def main():
    """Точка входа"""
    try:
        await check_items_in_groups()
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

