"""migrate existing shifts to use templates

Revision ID: 000037
Revises: 000036
Create Date: 2025-11-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, select, and_
from sqlalchemy.orm import Session
from sqlalchemy.dialects import postgresql
import uuid
from datetime import time, datetime
import logging

# revision identifiers, used by Alembic.
revision = '000037'
down_revision = '000036'
branch_labels = None
depends_on = None

logger = logging.getLogger('alembic.runtime.migration')


def get_day_name(day_of_week: int) -> str:
    """Получить название дня недели на русском языке"""
    days = {
        0: "Воскресенье",
        1: "Понедельник", 
        2: "Вторник",
        3: "Среда",
        4: "Четверг",
        5: "Пятница",
        6: "Суббота"
    }
    return days.get(day_of_week, f"День {day_of_week}")


def parse_time(time_str: str) -> time:
    """Парсинг времени из строки формата 'HH:MM'"""
    try:
        if not time_str:
            return time(9, 0)
        hour, minute = map(int, time_str.split(':'))
        return time(hour, minute)
    except (ValueError, AttributeError, TypeError):
        # Возвращаем время по умолчанию если парсинг не удался
        return time(9, 0)


def upgrade() -> None:
    """
    Миграция данных: создает шаблоны смен из slot_config и обновляет существующие смены
    """
    logger.info("[Migration 000037] Starting migration of shifts to templates...")
    
    # Получаем соединение и создаем сессию
    bind = op.get_bind()
    session = Session(bind=bind)
    
    try:
        # 1. Получаем все группы с их slot_config
        groups_query = text("""
            SELECT id, group_id, title, slot_config 
            FROM groups 
            WHERE slot_config IS NOT NULL 
                AND slot_config::text != '{}'
                AND slot_config::text != 'null'
        """)
        
        groups_result = session.execute(groups_query)
        groups = groups_result.fetchall()
        
        logger.info(f"[Migration 000037] Found {len(groups)} groups with slot_config")
        
        total_templates_created = 0
        total_shifts_updated = 0
        
        for group in groups:
            group_id = group.id
            group_telegram_id = group.group_id
            group_title = group.title
            slot_config = group.slot_config
            
            logger.info(f"[Migration 000037] Processing group {group_id} ({group_title}, TG ID: {group_telegram_id})")
            
            # Проверяем, есть ли уже шаблоны для этой группы
            check_templates_query = text("""
                SELECT COUNT(*) as count FROM shift_templates WHERE group_id = :group_id
            """)
            templates_count_result = session.execute(
                check_templates_query, 
                {"group_id": group_id}
            )
            existing_templates_count = templates_count_result.scalar()
            
            if existing_templates_count > 0:
                logger.info(f"[Migration 000037] Group {group_id} already has {existing_templates_count} templates, skipping template creation")
            else:
                # 2. Создаем шаблоны из slot_config для каждого дня недели
                templates_created = 0
                
                for day_of_week in range(7):
                    day_config = slot_config.get(str(day_of_week), {})
                    
                    # Создаем дневную смену, если есть настройки
                    max_day_slots = day_config.get("maxDaySlots", 0)
                    if max_day_slots > 0:
                        day_template_id = uuid.uuid4()
                        day_start_time = parse_time(day_config.get("dayShiftStartTime", "09:00"))
                        day_end_time = parse_time(day_config.get("dayShiftEndTime", "18:00"))
                        has_senior = day_config.get("hasSeniorSlot", False)
                        
                        # Вставляем шаблон дневной смены
                        insert_template_query = text("""
                            INSERT INTO shift_templates 
                            (id, group_id, name, description, start_time, end_time, max_slots, has_senior_slot, created_at, updated_at)
                            VALUES 
                            (:id, :group_id, :name, :description, :start_time, :end_time, :max_slots, :has_senior_slot, NOW(), NOW())
                        """)
                        
                        session.execute(insert_template_query, {
                            "id": day_template_id,
                            "group_id": group_id,
                            "name": f"Дневная смена - {get_day_name(day_of_week)}",
                            "description": f"Дневная смена для {get_day_name(day_of_week)}",
                            "start_time": day_start_time,
                            "end_time": day_end_time,
                            "max_slots": max_day_slots,
                            "has_senior_slot": has_senior
                        })
                        
                        # Вставляем связь с днем недели
                        insert_template_day_query = text("""
                            INSERT INTO shift_template_days
                            (id, template_id, group_id, day_of_week, created_at, updated_at)
                            VALUES
                            (:id, :template_id, :group_id, :day_of_week, NOW(), NOW())
                        """)
                        
                        session.execute(insert_template_day_query, {
                            "id": uuid.uuid4(),
                            "template_id": day_template_id,
                            "group_id": group_id,
                            "day_of_week": day_of_week
                        })
                        
                        templates_created += 1
                        logger.info(f"[Migration 000037] Created day template for {get_day_name(day_of_week)} in group {group_id}")
                    
                    # Создаем ночную смену, если есть настройки
                    max_night_slots = day_config.get("maxNightSlots", 0)
                    if max_night_slots > 0:
                        night_template_id = uuid.uuid4()
                        night_start_time = parse_time(day_config.get("nightShiftStartTime", "18:00"))
                        night_end_time = parse_time(day_config.get("nightShiftEndTime", "09:00"))
                        has_senior = day_config.get("hasSeniorSlot", False)
                        
                        # Вставляем шаблон ночной смены
                        insert_template_query = text("""
                            INSERT INTO shift_templates 
                            (id, group_id, name, description, start_time, end_time, max_slots, has_senior_slot, created_at, updated_at)
                            VALUES 
                            (:id, :group_id, :name, :description, :start_time, :end_time, :max_slots, :has_senior_slot, NOW(), NOW())
                        """)
                        
                        session.execute(insert_template_query, {
                            "id": night_template_id,
                            "group_id": group_id,
                            "name": f"Вечерняя смена - {get_day_name(day_of_week)}",
                            "description": f"Вечерняя смена для {get_day_name(day_of_week)}",
                            "start_time": night_start_time,
                            "end_time": night_end_time,
                            "max_slots": max_night_slots,
                            "has_senior_slot": has_senior
                        })
                        
                        # Вставляем связь с днем недели
                        insert_template_day_query = text("""
                            INSERT INTO shift_template_days
                            (id, template_id, group_id, day_of_week, created_at, updated_at)
                            VALUES
                            (:id, :template_id, :group_id, :day_of_week, NOW(), NOW())
                        """)
                        
                        session.execute(insert_template_day_query, {
                            "id": uuid.uuid4(),
                            "template_id": night_template_id,
                            "group_id": group_id,
                            "day_of_week": day_of_week
                        })
                        
                        templates_created += 1
                        logger.info(f"[Migration 000037] Created night template for {get_day_name(day_of_week)} in group {group_id}")
                
                total_templates_created += templates_created
                logger.info(f"[Migration 000037] Created {templates_created} templates for group {group_id}")
            
            # 3. Обновляем существующие смены без template_id
            # Получаем все смены группы без template_id
            shifts_query = text("""
                SELECT id, date, shift_type
                FROM shifts
                WHERE group_id = :group_id
                    AND template_id IS NULL
            """)
            
            shifts_result = session.execute(shifts_query, {"group_id": group_id})
            shifts = shifts_result.fetchall()
            
            logger.info(f"[Migration 000037] Found {len(shifts)} shifts without template_id in group {group_id}")
            
            shifts_updated = 0
            
            for shift in shifts:
                shift_id = shift.id
                shift_date = shift.date
                shift_type = shift.shift_type
                
                # Определяем день недели (0 = понедельник в Python)
                # Но в нашем slot_config 0 = воскресенье, поэтому конвертируем
                if isinstance(shift_date, str):
                    shift_date = datetime.strptime(shift_date, '%Y-%m-%d').date()
                
                python_weekday = shift_date.weekday()  # 0=Пн, 6=Вс
                our_weekday = (python_weekday + 1) % 7  # 0=Вс, 1=Пн, ..., 6=Сб
                
                # Ищем подходящий шаблон
                # Для day смены ищем шаблон с началом в дневное время (08:00 - 16:00)
                # Для night смены ищем шаблон с началом в вечернее время (16:00 - 08:00)
                if shift_type == "day":
                    # Ищем дневной шаблон
                    template_query = text("""
                        SELECT st.id 
                        FROM shift_templates st
                        JOIN shift_template_days std ON st.id = std.template_id
                        WHERE st.group_id = :group_id
                            AND std.day_of_week = :day_of_week
                            AND st.start_time >= '06:00:00'
                            AND st.start_time < '16:00:00'
                        LIMIT 1
                    """)
                else:  # night
                    # Ищем ночной шаблон
                    template_query = text("""
                        SELECT st.id 
                        FROM shift_templates st
                        JOIN shift_template_days std ON st.id = std.template_id
                        WHERE st.group_id = :group_id
                            AND std.day_of_week = :day_of_week
                            AND (st.start_time >= '16:00:00' OR st.start_time < '06:00:00')
                        LIMIT 1
                    """)
                
                template_result = session.execute(
                    template_query, 
                    {"group_id": group_id, "day_of_week": our_weekday}
                )
                template_id = template_result.scalar()
                
                if template_id:
                    # Обновляем смену
                    update_shift_query = text("""
                        UPDATE shifts
                        SET template_id = :template_id, updated_at = NOW()
                        WHERE id = :shift_id
                    """)
                    
                    session.execute(update_shift_query, {
                        "template_id": template_id,
                        "shift_id": shift_id
                    })
                    
                    shifts_updated += 1
                else:
                    logger.warning(f"[Migration 000037] Could not find template for shift {shift_id} (type={shift_type}, date={shift_date}, weekday={our_weekday})")
            
            total_shifts_updated += shifts_updated
            logger.info(f"[Migration 000037] Updated {shifts_updated} shifts in group {group_id}")
        
        # Коммитим все изменения
        session.commit()
        
        logger.info(f"[Migration 000037] Migration completed successfully!")
        logger.info(f"[Migration 000037] Total templates created: {total_templates_created}")
        logger.info(f"[Migration 000037] Total shifts updated: {total_shifts_updated}")
        
    except Exception as e:
        logger.error(f"[Migration 000037] Error during migration: {e}", exc_info=True)
        session.rollback()
        raise
    finally:
        session.close()


def downgrade() -> None:
    """
    Откат миграции: удаляет template_id из смен и удаляет созданные шаблоны
    ВНИМАНИЕ: Это удалит все шаблоны, включая созданные вручную после миграции!
    """
    logger.info("[Migration 000037] Downgrading - removing template_id from shifts...")
    
    bind = op.get_bind()
    session = Session(bind=bind)
    
    try:
        # 1. Обнуляем template_id у всех смен
        update_query = text("""
            UPDATE shifts
            SET template_id = NULL
            WHERE template_id IS NOT NULL
        """)
        session.execute(update_query)
        
        # 2. Удаляем все записи из shift_template_days
        delete_template_days_query = text("""
            DELETE FROM shift_template_days
        """)
        session.execute(delete_template_days_query)
        
        # 3. Удаляем все шаблоны
        delete_templates_query = text("""
            DELETE FROM shift_templates
        """)
        session.execute(delete_templates_query)
        
        session.commit()
        logger.info("[Migration 000037] Downgrade completed")
        
    except Exception as e:
        logger.error(f"[Migration 000037] Error during downgrade: {e}", exc_info=True)
        session.rollback()
        raise
    finally:
        session.close()

