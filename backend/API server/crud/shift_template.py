from sqlalchemy.orm import Session, selectinload
from sqlalchemy.future import select
from sqlalchemy import and_, or_
from typing import List, Optional
from uuid import UUID

from models.shift_template import ShiftTemplate, ShiftTemplateDay
from models.group import Group
from schemas.shift_template import (
    ShiftTemplateCreate, 
    ShiftTemplateUpdate,
    ShiftTemplateApplyPayload
)

# === CRUD операции для шаблонов смен ===

async def create_shift_template(
    db: Session, 
    *, 
    template_data: ShiftTemplateCreate
) -> ShiftTemplate:
    """Создает новый шаблон смены."""
    db_template = ShiftTemplate(
        group_id=template_data.group_id,
        name=template_data.name,
        description=template_data.description,
        start_time=template_data.start_time,
        end_time=template_data.end_time,
        max_slots=template_data.max_slots,
        has_senior_slot=template_data.has_senior_slot,
        template_metadata=template_data.template_metadata
    )
    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)
    
    # Создаем связи с днями недели
    if template_data.days_of_week:
        for day_of_week in template_data.days_of_week:
            template_day = ShiftTemplateDay(
                template_id=db_template.id,
                group_id=template_data.group_id,
                day_of_week=day_of_week
            )
            db.add(template_day)
        await db.commit()
        await db.refresh(db_template)
    
    return db_template

async def get_shift_template_by_id(
    db: Session, 
    *, 
    template_id: UUID
) -> Optional[ShiftTemplate]:
    """Получает шаблон смены по ID."""
    result = await db.execute(
        select(ShiftTemplate).where(ShiftTemplate.id == template_id)
    )
    return result.scalars().first()

async def get_shift_templates_by_group(
    db: Session, 
    *, 
    group_id: int
) -> List[ShiftTemplate]:
    """Получает все шаблоны смен для группы."""
    result = await db.execute(
        select(ShiftTemplate)
        .options(selectinload(ShiftTemplate.days))
        .where(ShiftTemplate.group_id == group_id)
        .order_by(ShiftTemplate.created_at.desc())
    )
    return result.scalars().all()

async def update_shift_template(
    db: Session, 
    *, 
    template_id: UUID,
    template_data: ShiftTemplateUpdate
) -> Optional[ShiftTemplate]:
    """Обновляет шаблон смены."""
    db_template = await get_shift_template_by_id(db, template_id=template_id)
    if not db_template:
        return None
    
    update_data = template_data.model_dump(exclude_unset=True)
    
    # Обрабатываем дни недели отдельно
    days_of_week = update_data.pop('days_of_week', None)
    
    # Обновляем остальные поля
    for field, value in update_data.items():
        setattr(db_template, field, value)
    
    await db.commit()
    
    # Обновляем дни недели если они переданы
    if days_of_week is not None:
        # Удаляем старые связи
        await db.execute(
            select(ShiftTemplateDay).where(ShiftTemplateDay.template_id == template_id)
        )
        old_days = await db.execute(
            select(ShiftTemplateDay).where(ShiftTemplateDay.template_id == template_id)
        )
        for old_day in old_days.scalars().all():
            await db.delete(old_day)
        
        # Создаем новые связи
        for day_of_week in days_of_week:
            template_day = ShiftTemplateDay(
                template_id=template_id,
                group_id=db_template.group_id,
                day_of_week=day_of_week
            )
            db.add(template_day)
        
        await db.commit()
    
    await db.refresh(db_template)
    return db_template

async def delete_shift_template(
    db: Session, 
    *, 
    template_id: UUID
) -> bool:
    """Удаляет шаблон смены.
    
    Raises:
        ValueError: Если существуют смены, привязанные к этому шаблону
    """
    db_template = await get_shift_template_by_id(db, template_id=template_id)
    if not db_template:
        return False
    
    # Проверяем, есть ли смены с этим шаблоном
    from models.shift import Shift
    shifts_result = await db.execute(
        select(Shift).where(Shift.template_id == template_id).limit(1)
    )
    existing_shift = shifts_result.scalars().first()
    
    if existing_shift:
        raise ValueError(
            f"Невозможно удалить шаблон: существуют смены, использующие этот шаблон. "
            f"Сначала удалите или переназначьте смены."
        )
    
    await db.delete(db_template)
    await db.commit()
    return True

async def clone_shift_template(
    db: Session, 
    *, 
    source_template_id: UUID,
    new_name: str,
    group_id: int
) -> Optional[ShiftTemplate]:
    """Клонирует существующий шаблон смены."""
    source_template = await get_shift_template_by_id(db, template_id=source_template_id)
    if not source_template:
        return None
    
    new_template_data = ShiftTemplateCreate(
        group_id=group_id,
        name=new_name,
        description=source_template.description,
        start_time=source_template.start_time,
        end_time=source_template.end_time,
        max_slots=source_template.max_slots,
        has_senior_slot=source_template.has_senior_slot,
        template_metadata=source_template.template_metadata
    )
    
    return await create_shift_template(db, template_data=new_template_data)

# === CRUD операции для связей шаблонов с днями недели ===

async def apply_templates_to_days(
    db: Session, 
    *, 
    group_id: int,
    apply_data: ShiftTemplateApplyPayload
) -> List[ShiftTemplateDay]:
    """Применяет шаблоны смен к указанным дням недели."""
    created_links = []
    
    for template_id in apply_data.template_ids:
        for day_of_week in apply_data.days_of_week:
            # Проверяем, не существует ли уже такая связь
            existing_link = await get_template_day_link(
                db, 
                template_id=template_id, 
                group_id=group_id, 
                day_of_week=day_of_week
            )
            
            if not existing_link:
                db_link = ShiftTemplateDay(
                    template_id=template_id,
                    group_id=group_id,
                    day_of_week=day_of_week
                )
                db.add(db_link)
                created_links.append(db_link)
    
    await db.commit()
    return created_links

async def get_template_day_link(
    db: Session, 
    *, 
    template_id: UUID,
    group_id: int,
    day_of_week: int
) -> Optional[ShiftTemplateDay]:
    """Получает связь между шаблоном и днем недели."""
    result = await db.execute(
        select(ShiftTemplateDay)
        .where(
            and_(
                ShiftTemplateDay.template_id == template_id,
                ShiftTemplateDay.group_id == group_id,
                ShiftTemplateDay.day_of_week == day_of_week
            )
        )
    )
    return result.scalars().first()

async def get_templates_for_day(
    db: Session, 
    *, 
    group_id: int,
    day_of_week: int
) -> List[ShiftTemplate]:
    """Получает все шаблоны смен для указанного дня недели."""
    result = await db.execute(
        select(ShiftTemplate)
        .join(ShiftTemplateDay, ShiftTemplate.id == ShiftTemplateDay.template_id)
        .where(
            and_(
                ShiftTemplateDay.group_id == group_id,
                ShiftTemplateDay.day_of_week == day_of_week
            )
        )
        .order_by(ShiftTemplate.start_time)
    )
    return result.scalars().all()

async def remove_templates_from_days(
    db: Session, 
    *, 
    group_id: int,
    template_ids: List[UUID],
    days_of_week: List[int]
) -> int:
    """Удаляет связи шаблонов с указанными днями недели."""
    result = await db.execute(
        select(ShiftTemplateDay)
        .where(
            and_(
                ShiftTemplateDay.group_id == group_id,
                ShiftTemplateDay.template_id.in_(template_ids),
                ShiftTemplateDay.day_of_week.in_(days_of_week)
            )
        )
    )
    links_to_delete = result.scalars().all()
    
    for link in links_to_delete:
        await db.delete(link)
    
    await db.commit()
    return len(links_to_delete)

async def get_all_template_days_for_group(
    db: Session, 
    *, 
    group_id: int
) -> List[ShiftTemplateDay]:
    """Получает все связи шаблонов с днями для группы."""
    result = await db.execute(
        select(ShiftTemplateDay)
        .where(ShiftTemplateDay.group_id == group_id)
        .order_by(ShiftTemplateDay.day_of_week, ShiftTemplateDay.template_id)
    )
    return result.scalars().all()

async def clear_all_templates_for_group(
    db: Session, 
    *, 
    group_id: int
) -> int:
    """Удаляет все связи шаблонов с днями для группы."""
    result = await db.execute(
        select(ShiftTemplateDay).where(ShiftTemplateDay.group_id == group_id)
    )
    links_to_delete = result.scalars().all()
    
    for link in links_to_delete:
        await db.delete(link)
    
    await db.commit()
    return len(links_to_delete)

async def check_template_exists_in_group(
    db: Session, 
    *, 
    template_id: UUID,
    group_id: int
) -> bool:
    """Проверяет, принадлежит ли шаблон указанной группе."""
    result = await db.execute(
        select(ShiftTemplate)
        .where(
            and_(
                ShiftTemplate.id == template_id,
                ShiftTemplate.group_id == group_id
            )
        )
    )
    return result.scalars().first() is not None
