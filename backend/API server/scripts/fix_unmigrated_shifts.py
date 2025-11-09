#!/usr/bin/env python3
"""
Скрипт для исправления смен, которые не получили template_id после миграции 000037
Запускает MigrationService.migrate_existing_shifts_to_templates для проблемных групп
"""

import asyncio
import sys
from sqlalchemy import text

# Добавляем путь к проекту
sys.path.insert(0, '/app')

from db.session import AsyncSessionFactory
from services.migration_service import MigrationService


async def fix_unmigrated_shifts():
    """Исправляет смены без template_id"""
    
    print("=" * 80)
    print("🔧 ИСПРАВЛЕНИЕ СМЕН БЕЗ TEMPLATE_ID")
    print("=" * 80)
    print()
    
    async with AsyncSessionFactory() as db:
        # Находим группы со сменами без template_id
        query = text("""
            SELECT DISTINCT g.id, g.title, COUNT(s.id) as unmigrated_count
            FROM groups g
            JOIN shifts s ON g.id = s.group_id
            WHERE s.template_id IS NULL
            GROUP BY g.id, g.title
            ORDER BY unmigrated_count DESC
        """)
        
        result = await db.execute(query)
        groups = result.fetchall()
        
        if not groups:
            print("✅ Все смены уже имеют template_id!")
            return
        
        print(f"Найдено {len(groups)} групп со сменами без template_id:")
        print()
        
        for group in groups:
            print(f"   - {group.title}: {group.unmigrated_count} смен")
        
        print()
        print("Начинаем исправление...")
        print()
        
        total_fixed = 0
        
        for group in groups:
            print(f"📍 Обработка группы: {group.title} (ID: {group.id})")
            
            try:
                # Проверяем, есть ли шаблоны для группы
                check_templates = text("""
                    SELECT COUNT(*) FROM shift_templates WHERE group_id = :group_id
                """)
                templates_count = await db.execute(check_templates, {"group_id": group.id})
                templates_count = templates_count.scalar()
                
                if templates_count == 0:
                    print(f"   ⚠️  У группы нет шаблонов! Создаем из slot_config...")
                    
                    # Получаем slot_config
                    get_slot_config = text("""
                        SELECT slot_config FROM groups WHERE id = :group_id
                    """)
                    slot_config_result = await db.execute(get_slot_config, {"group_id": group.id})
                    slot_config = slot_config_result.scalar()
                    
                    if slot_config:
                        # Создаем шаблоны
                        templates = await MigrationService.migrate_slot_config_to_templates(
                            db=db,
                            slot_config=slot_config,
                            group_id=group.id
                        )
                        print(f"   ✅ Создано {len(templates)} шаблонов")
                    else:
                        print(f"   ⚠️  У группы нет slot_config! Пропускаем...")
                        continue
                
                # Мигрируем смены
                updated_count = await MigrationService.migrate_existing_shifts_to_templates(
                    db=db,
                    group_id=group.id
                )
                
                print(f"   ✅ Обновлено {updated_count} смен")
                total_fixed += updated_count
                
            except Exception as e:
                print(f"   ❌ Ошибка: {e}")
                import traceback
                traceback.print_exc()
        
        # Коммитим изменения
        await db.commit()
        
        print()
        print("=" * 80)
        print(f"✅ Исправление завершено! Всего обновлено смен: {total_fixed}")
        print("=" * 80)
        
        # Проверяем, остались ли смены без template_id
        check_query = text("""
            SELECT COUNT(*) FROM shifts WHERE template_id IS NULL
        """)
        remaining = await db.execute(check_query)
        remaining = remaining.scalar()
        
        if remaining > 0:
            print(f"\n⚠️  Все еще осталось {remaining} смен без template_id")
            print("Возможно, для них нет подходящих шаблонов")
        else:
            print("\n🎉 Все смены теперь имеют template_id!")


if __name__ == "__main__":
    try:
        asyncio.run(fix_unmigrated_shifts())
    except KeyboardInterrupt:
        print("\n\n⚠️  Исправление прервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Ошибка при исправлении: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

