#!/usr/bin/env python3
"""
Скрипт для тестирования миграции 000037
Проверяет:
1. Созданы ли шаблоны для всех групп
2. Все ли смены получили template_id
3. Корректность привязки shift_type к шаблонам
"""

import asyncio
import sys
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

# Добавляем путь к проекту
sys.path.insert(0, '/app')

from db.session import AsyncSessionFactory


async def test_migration():
    """Основная функция тестирования"""
    
    print("=" * 80)
    print("🧪 ТЕСТИРОВАНИЕ МИГРАЦИИ 000037: Переход на шаблоны смен")
    print("=" * 80)
    print()
    
    async with AsyncSessionFactory() as db:
        # 1. Проверяем создание шаблонов
        await check_templates_created(db)
        
        # 2. Проверяем обновление смен
        await check_shifts_updated(db)
        
        # 3. Проверяем корректность привязки
        await check_shift_template_mapping(db)
        
        # 4. Проверяем по группам
        await check_groups_status(db)
        
        # 5. Финальный отчет
        await final_report(db)
    
    print()
    print("=" * 80)
    print("✅ Тестирование завершено!")
    print("=" * 80)


async def check_templates_created(db: AsyncSession):
    """Проверяет, созданы ли шаблоны"""
    print("📋 1. Проверка созданных шаблонов...")
    print("-" * 80)
    
    # Количество шаблонов
    query = text("""
        SELECT 
            COUNT(DISTINCT st.id) as templates_count,
            COUNT(DISTINCT st.group_id) as groups_with_templates,
            COUNT(DISTINCT std.id) as template_day_links
        FROM shift_templates st
        LEFT JOIN shift_template_days std ON st.id = std.template_id
    """)
    
    result = await db.execute(query)
    row = result.first()
    
    print(f"   Создано шаблонов: {row.templates_count}")
    print(f"   Групп с шаблонами: {row.groups_with_templates}")
    print(f"   Связей шаблон-день: {row.template_day_links}")
    
    if row.templates_count == 0:
        print("   ⚠️  ВНИМАНИЕ: Нет созданных шаблонов!")
    else:
        print("   ✅ Шаблоны созданы")
    
    # Детализация по группам
    query = text("""
        SELECT 
            g.title,
            COUNT(DISTINCT st.id) as templates_count,
            string_agg(DISTINCT st.name, ', ' ORDER BY st.name) as template_names
        FROM groups g
        LEFT JOIN shift_templates st ON g.id = st.group_id
        WHERE g.slot_config IS NOT NULL 
            AND g.slot_config::text != '{}'
        GROUP BY g.id, g.title
        ORDER BY g.title
    """)
    
    result = await db.execute(query)
    rows = result.fetchall()
    
    print()
    print("   Детализация по группам:")
    for row in rows:
        print(f"   - {row.title}: {row.templates_count} шаблонов")
        if row.templates_count > 0 and row.template_names:
            print(f"     ({row.template_names[:100]}...)" if len(row.template_names) > 100 else f"     ({row.template_names})")
    
    print()


async def check_shifts_updated(db: AsyncSession):
    """Проверяет обновление смен"""
    print("🔄 2. Проверка обновления смен...")
    print("-" * 80)
    
    query = text("""
        SELECT 
            COUNT(*) as total_shifts,
            COUNT(template_id) as with_template,
            COUNT(*) - COUNT(template_id) as without_template,
            ROUND(100.0 * COUNT(template_id) / NULLIF(COUNT(*), 0), 2) as percentage_with_template
        FROM shifts
    """)
    
    result = await db.execute(query)
    row = result.first()
    
    print(f"   Всего смен: {row.total_shifts}")
    print(f"   Смен с template_id: {row.with_template} ({row.percentage_with_template}%)")
    print(f"   Смен без template_id: {row.without_template}")
    
    if row.without_template > 0:
        print(f"   ⚠️  ВНИМАНИЕ: {row.without_template} смен не получили template_id!")
        
        # Показываем примеры смен без template_id
        query = text("""
            SELECT s.id, s.date, s.shift_type, g.title as group_name
            FROM shifts s
            JOIN groups g ON s.group_id = g.id
            WHERE s.template_id IS NULL
            ORDER BY s.date DESC
            LIMIT 5
        """)
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        print()
        print("   Примеры смен без template_id:")
        for row in rows:
            print(f"   - ID: {row.id}, Дата: {row.date}, Тип: {row.shift_type}, Группа: {row.group_name}")
    else:
        print("   ✅ Все смены обновлены")
    
    print()


async def check_shift_template_mapping(db: AsyncSession):
    """Проверяет корректность привязки shift_type к шаблонам"""
    print("🔗 3. Проверка корректности привязки shift_type → template...")
    print("-" * 80)
    
    # Проверяем, что дневные смены привязаны к дневным шаблонам
    query = text("""
        SELECT 
            s.shift_type,
            st.name as template_name,
            COUNT(*) as count
        FROM shifts s
        JOIN shift_templates st ON s.template_id = st.id
        GROUP BY s.shift_type, st.name
        ORDER BY s.shift_type, count DESC
    """)
    
    result = await db.execute(query)
    rows = result.fetchall()
    
    print("   Распределение смен по шаблонам:")
    current_type = None
    for row in rows:
        if row.shift_type != current_type:
            current_type = row.shift_type
            print(f"\n   Тип смены: {row.shift_type}")
        print(f"   - {row.template_name}: {row.count} смен")
    
    # Проверяем некорректные привязки
    query = text("""
        WITH incorrect_mappings AS (
            SELECT 
                s.id,
                s.shift_type,
                st.name,
                CASE 
                    WHEN s.shift_type = 'day' AND st.start_time < '06:00:00' THEN true
                    WHEN s.shift_type = 'day' AND st.start_time >= '16:00:00' THEN true
                    WHEN s.shift_type = 'night' AND st.start_time >= '06:00:00' AND st.start_time < '16:00:00' THEN true
                    ELSE false
                END as is_incorrect
            FROM shifts s
            JOIN shift_templates st ON s.template_id = st.id
        )
        SELECT COUNT(*) as incorrect_count
        FROM incorrect_mappings
        WHERE is_incorrect = true
    """)
    
    result = await db.execute(query)
    incorrect_count = result.scalar()
    
    print()
    if incorrect_count > 0:
        print(f"   ⚠️  ВНИМАНИЕ: Найдено {incorrect_count} смен с некорректной привязкой!")
    else:
        print("   ✅ Все привязки корректны")
    
    print()


async def check_groups_status(db: AsyncSession):
    """Проверяет статус по каждой группе"""
    print("👥 4. Проверка статуса по группам...")
    print("-" * 80)
    
    query = text("""
        SELECT 
            g.id,
            g.title,
            g.slot_config IS NOT NULL AND g.slot_config::text != '{}' as has_slot_config,
            COUNT(DISTINCT st.id) as templates_count,
            COUNT(s.id) as total_shifts,
            COUNT(s.template_id) as shifts_with_template,
            COUNT(s.id) - COUNT(s.template_id) as shifts_without_template
        FROM groups g
        LEFT JOIN shift_templates st ON g.id = st.group_id
        LEFT JOIN shifts s ON g.id = s.group_id
        WHERE g.slot_config IS NOT NULL 
            AND g.slot_config::text != '{}'
        GROUP BY g.id, g.title, g.slot_config
        ORDER BY g.title
    """)
    
    result = await db.execute(query)
    rows = result.fetchall()
    
    print("   Статус групп:")
    print()
    
    all_ok = True
    for row in rows:
        status = "✅" if row.shifts_without_template == 0 and row.templates_count > 0 else "⚠️"
        print(f"   {status} {row.title}")
        print(f"      Шаблонов: {row.templates_count}")
        print(f"      Смен всего: {row.total_shifts}")
        print(f"      Смен с template_id: {row.shifts_with_template}")
        
        if row.shifts_without_template > 0:
            print(f"      ⚠️  Смен БЕЗ template_id: {row.shifts_without_template}")
            all_ok = False
        
        if row.templates_count == 0 and row.has_slot_config:
            print(f"      ⚠️  Нет шаблонов, хотя есть slot_config!")
            all_ok = False
        
        print()
    
    if all_ok:
        print("   ✅ Все группы в порядке")
    
    print()


async def final_report(db: AsyncSession):
    """Финальный отчет"""
    print("📊 5. Финальный отчет...")
    print("-" * 80)
    
    # Общая статистика
    queries = {
        "Групп с slot_config": """
            SELECT COUNT(*) 
            FROM groups 
            WHERE slot_config IS NOT NULL AND slot_config::text != '{}'
        """,
        "Всего шаблонов": "SELECT COUNT(*) FROM shift_templates",
        "Всего смен": "SELECT COUNT(*) FROM shifts",
        "Смен с template_id": "SELECT COUNT(*) FROM shifts WHERE template_id IS NOT NULL",
        "Смен без template_id": "SELECT COUNT(*) FROM shifts WHERE template_id IS NULL",
    }
    
    results = {}
    for label, query_str in queries.items():
        result = await db.execute(text(query_str))
        results[label] = result.scalar()
    
    print()
    print("   Общая статистика:")
    for label, value in results.items():
        print(f"   - {label}: {value}")
    
    print()
    
    # Выводим вердикт
    if results["Смен без template_id"] == 0 and results["Всего шаблонов"] > 0:
        print("   ✅ ✅ ✅ МИГРАЦИЯ УСПЕШНА! ✅ ✅ ✅")
    elif results["Смен без template_id"] < results["Всего смен"] * 0.01:  # Менее 1%
        print("   ⚠️  Миграция в основном успешна, но есть небольшие проблемы")
    else:
        print("   ❌ МИГРАЦИЯ ИМЕЕТ ПРОБЛЕМЫ!")
        print("   Проверьте логи и запустите миграцию повторно")


if __name__ == "__main__":
    try:
        asyncio.run(test_migration())
    except KeyboardInterrupt:
        print("\n\n⚠️  Тестирование прервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Ошибка при тестировании: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

