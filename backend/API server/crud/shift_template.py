from sqlalchemy.orm import Session, selectinload
from sqlalchemy.future import select
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, timedelta

from models.shift_template import ShiftTemplate, ShiftTemplateDay, ShiftTemplateVersion
from models.group import Group
from schemas.shift_template import (
    ShiftTemplateCreate, 
    ShiftTemplateUpdate,
    ShiftTemplateApplyPayload
)
from utils.period_calculator import calculate_next_period_start_date, calculate_current_period_dates

# === CRUD операции для шаблонов смен ===

async def create_shift_template(
    db: Session, 
    *, 
    template_data: ShiftTemplateCreate
) -> List[ShiftTemplate]:
    """
    Создает шаблоны смены.
    Для каждого выбранного дня недели создается отдельный шаблон.
    Это позволяет независимо управлять шаблонами для каждого дня.
    """
    created_templates = []
    
    # Если дни недели не указаны, создаем один шаблон без привязки к дням
    if not template_data.days_of_week:
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
        await db.flush()
        await db.refresh(db_template)
        created_templates.append(db_template)
    else:
        # Для каждого дня недели создаем отдельный шаблон
        day_names = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
        
        for day_of_week in template_data.days_of_week:
            # Формируем имя шаблона с указанием дня недели
            day_name = day_names[day_of_week] if 0 <= day_of_week < len(day_names) else f"День {day_of_week}"
            template_name = f"{template_data.name} ({day_name})"
            
            db_template = ShiftTemplate(
                group_id=template_data.group_id,
                name=template_name,
                description=template_data.description,
                start_time=template_data.start_time,
                end_time=template_data.end_time,
                max_slots=template_data.max_slots,
                has_senior_slot=template_data.has_senior_slot,
                template_metadata=template_data.template_metadata
            )
            db.add(db_template)
            await db.flush()
            await db.refresh(db_template)
            
            # Создаем связь с днем недели (только для одного дня)
            template_day = ShiftTemplateDay(
                template_id=db_template.id,
                group_id=template_data.group_id,
                day_of_week=day_of_week,
                is_active=True  # По умолчанию шаблон активен
            )
            db.add(template_day)
            created_templates.append(db_template)
    
    await db.commit()
    
    # Обновляем все созданные шаблоны
    for template in created_templates:
        await db.refresh(template)
    
    return created_templates

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


async def get_template_version_for_date(
    db: Session,
    *,
    template_id: UUID,
    shift_date: date
) -> Optional[ShiftTemplateVersion]:
    """
    Получает актуальную версию шаблона для указанной даты.
    
    Если версия не найдена, возвращает None (используется базовый шаблон).
    """
    result = await db.execute(
        select(ShiftTemplateVersion)
        .where(
            and_(
                ShiftTemplateVersion.template_id == template_id,
                ShiftTemplateVersion.valid_from_date <= shift_date,
                or_(
                    ShiftTemplateVersion.valid_to_date.is_(None),
                    ShiftTemplateVersion.valid_to_date >= shift_date
                )
            )
        )
        .order_by(ShiftTemplateVersion.valid_from_date.desc())
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
    template_data: ShiftTemplateUpdate,
    group_access_settings: Optional[Dict[str, Any]] = None
) -> Optional[ShiftTemplate]:
    """
    Обновляет шаблон смены с поддержкой версионирования.
    
    Если указан apply_to_period:
    - 'next': создает новую версию для следующего периода
    - 'current': применяет изменения к текущему периоду (с предупреждением, если есть записи)
    Если не указан: обновляет шаблон напрямую (старая логика)
    """
    db_template = await get_shift_template_by_id(db, template_id=template_id)
    if not db_template:
        return None
    
    update_data = template_data.model_dump(exclude_unset=True)
    
    # Логируем полученные данные
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[update_shift_template] Received update_data: {update_data}")
    
    # Извлекаем apply_to_period
    apply_to_period = update_data.pop('apply_to_period', None)
    logger.info(f"[update_shift_template] Extracted apply_to_period: {apply_to_period}, group_access_settings exists: {group_access_settings is not None}")
    
    # Обрабатываем дни недели отдельно
    days_of_week = update_data.pop('days_of_week', None)
    
    # Если указан период применения, используем версионирование
    should_update_template = True  # Флаг для обновления самого шаблона
    
    logger.info(f"[update_shift_template] Checking versioning: apply_to_period={apply_to_period}, has_access_settings={group_access_settings is not None}")
    
    if apply_to_period and group_access_settings:
        if apply_to_period == 'next':
            # Создаем новую версию для следующего периода
            # ВАЖНО: НЕ обновляем сам шаблон, только создаем версию
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[update_shift_template] Creating new version for next period, template_id={template_id}, update_data={update_data}")
            
            next_period_start = calculate_next_period_start_date(group_access_settings)
            logger.info(f"[update_shift_template] Next period starts: {next_period_start}")
            
            # Получаем текущую активную версию (если есть)
            current_version_result = await db.execute(
                select(ShiftTemplateVersion)
                .where(
                    and_(
                        ShiftTemplateVersion.template_id == template_id,
                        ShiftTemplateVersion.valid_to_date.is_(None)  # Активная версия
                    )
                )
                .order_by(ShiftTemplateVersion.version_number.desc())
            )
            current_version = current_version_result.scalars().first()
            
            # Закрываем текущую версию (если есть)
            if current_version:
                current_version.valid_to_date = next_period_start - timedelta(days=1)
            
            # Определяем номер новой версии
            if current_version:
                new_version_number = current_version.version_number + 1
            else:
                # Если версий нет, это первая версия
                # Проверяем, есть ли уже версии для этого шаблона
                all_versions_result = await db.execute(
                    select(ShiftTemplateVersion)
                    .where(ShiftTemplateVersion.template_id == template_id)
                    .order_by(ShiftTemplateVersion.version_number.desc())
                )
                all_versions = all_versions_result.scalars().all()
                if all_versions:
                    new_version_number = all_versions[0].version_number + 1
                else:
                    new_version_number = 1
            
            # Создаем новую версию с обновленными данными
            # Используем значения из update_data, если они есть, иначе берем из текущего шаблона
            new_version = ShiftTemplateVersion(
                template_id=template_id,
                version_number=new_version_number,
                valid_from_date=next_period_start,
                valid_to_date=None,  # Активная версия
                max_slots=update_data.get('max_slots') if 'max_slots' in update_data else db_template.max_slots,
                start_time=update_data.get('start_time') if 'start_time' in update_data else db_template.start_time,
                end_time=update_data.get('end_time') if 'end_time' in update_data else db_template.end_time,
                has_senior_slot=update_data.get('has_senior_slot') if 'has_senior_slot' in update_data else db_template.has_senior_slot,
                template_metadata=update_data.get('template_metadata') if 'template_metadata' in update_data else db_template.template_metadata
            )
            db.add(new_version)
            await db.flush()  # Сохраняем версию в БД
            
            logger.info(f"[update_shift_template] Created version {new_version_number} for template {template_id}, valid_from={next_period_start}")
            
            # НЕ обновляем сам шаблон при apply_to_period='next'
            should_update_template = False
            
        elif apply_to_period == 'current':
            # Применяем изменения к текущему периоду
            # Проверяем наличие записанных курьеров в текущем периоде
            current_start, current_end = calculate_current_period_dates(group_access_settings)
            
            from models.shift import Shift
            shifts_in_period_result = await db.execute(
                select(Shift)
                .where(
                    and_(
                        Shift.template_id == template_id,
                        Shift.date >= current_start,
                        Shift.date <= current_end,
                        Shift.member_id.isnot(None)
                    )
                )
            )
            shifts_in_period = shifts_in_period_result.scalars().all()
            
            if shifts_in_period:
                # Есть записи - предупреждаем, но все равно применяем
                # В будущем можно добавить проверку и возврат предупреждения
                pass
            
            # Обновляем шаблон напрямую (изменения применяются сразу)
            for field, value in update_data.items():
                if hasattr(db_template, field):
                    setattr(db_template, field, value)
    
    else:
        # Старая логика: обновляем шаблон напрямую
        for field, value in update_data.items():
            if hasattr(db_template, field):
                setattr(db_template, field, value)
    
    # Обновляем сам шаблон только если нужно
    if should_update_template and update_data:
        logger.info(f"[update_shift_template] Updating template directly with data: {update_data}")
        for field, value in update_data.items():
            if hasattr(db_template, field) and field not in ['apply_to_period', 'days_of_week']:
                setattr(db_template, field, value)
    else:
        logger.info(f"[update_shift_template] Skipping template update (should_update_template={should_update_template}, has_update_data={bool(update_data)})")
    
    # ВАЖНО: Если не обновляем шаблон, удаляем его из сессии перед коммитом,
    # чтобы SQLAlchemy не обновлял updated_at автоматически
    template_id_for_refresh = None
    template_group_id = None
    if not should_update_template:
        # Сохраняем ID и group_id для последующего refresh
        template_id_for_refresh = db_template.id
        template_group_id = db_template.group_id
        # Удаляем объект из сессии
        db.expunge(db_template)
        logger.info(f"[update_shift_template] Expunged template from session to prevent updated_at change")
    
    # Обновляем дни недели только если нужно (НЕ для версионирования следующего периода)
    if days_of_week is not None and should_update_template:
        logger.info(f"[update_shift_template] Updating days_of_week: {days_of_week}")
        # Удаляем старые связи
        old_days_result = await db.execute(
            select(ShiftTemplateDay).where(ShiftTemplateDay.template_id == template_id)
        )
        for old_day in old_days_result.scalars().all():
            await db.delete(old_day)
        
        # Создаем новые связи
        for day_of_week in days_of_week:
            template_day = ShiftTemplateDay(
                template_id=template_id,
                group_id=db_template.group_id,
                day_of_week=day_of_week,
                is_active=True
            )
            db.add(template_day)
    elif days_of_week is not None and not should_update_template:
        logger.info(f"[update_shift_template] Skipping days_of_week update (versioning for next period)")
    
    # Коммитим все изменения
    await db.commit()
    logger.info(f"[update_shift_template] Changes committed")
    
    # Если шаблон был удален из сессии, загружаем его заново
    if template_id_for_refresh:
        db_template = await get_shift_template_by_id(db, template_id=template_id_for_refresh)
        logger.info(f"[update_shift_template] Reloaded template after expunge, max_slots={db_template.max_slots}")
    else:
        await db.refresh(db_template)
    
    return db_template

async def check_template_has_any_shifts(
    db: Session,
    *,
    template_id: UUID
) -> int:
    """Проверяет, есть ли смены с записанными курьерами для шаблона.
    
    Возвращает количество смен с записанными курьерами (member_id не NULL) на будущие даты.
    """
    from models.shift import Shift
    from datetime import date
    
    # Проверяем наличие смен с курьерами для этого шаблона на будущие даты
    result = await db.execute(
        select(Shift)
        .where(
            and_(
                Shift.template_id == template_id,
                Shift.date >= date.today(),
                Shift.member_id.isnot(None)  # Только смены с записанными курьерами
            )
        )
    )
    shifts = result.scalars().all()
    return len(shifts)

async def delete_shift_template(
    db: Session, 
    *, 
    template_id: UUID,
    check_future_shifts: bool = True  # Проверять ли наличие будущих смен
) -> Dict[str, Any]:
    """Удаляет шаблон смены.
    
    Если check_future_shifts=True и есть смены с курьерами на будущие даты,
    возвращает информацию об этом, но не удаляет шаблон.
    
    Returns:
        Dict с ключами:
        - deleted: bool - был ли шаблон удален
        - has_future_shifts: bool - есть ли смены с курьерами на будущие даты
        - shifts_count: int - количество смен с курьерами
    """
    db_template = await get_shift_template_by_id(db, template_id=template_id)
    if not db_template:
        return {"deleted": False, "has_future_shifts": False, "shifts_count": 0}
    
    if check_future_shifts:
        # Проверяем наличие смен с курьерами на будущие даты
        shifts_count = await check_template_has_any_shifts(db, template_id=template_id)
        
        if shifts_count > 0:
            # Есть смены с курьерами - не удаляем, но возвращаем информацию
            return {
                "deleted": False,
                "has_future_shifts": True,
                "shifts_count": shifts_count,
                "message": f"Невозможно удалить шаблон: есть {shifts_count} смен(ы) с записанными курьерами на будущие даты. Отмена/удаление будет применено при следующем открытии смен."
            }
    
    # Проверяем, есть ли вообще смены с этим шаблоном (включая прошлые)
    from models.shift import Shift
    shifts_result = await db.execute(
        select(Shift).where(Shift.template_id == template_id).limit(1)
    )
    existing_shift = shifts_result.scalars().first()
    
    if existing_shift and not check_future_shifts:
        raise ValueError(
            f"Невозможно удалить шаблон: существуют смены, использующие этот шаблон. " 
            f"Сначала удалите или переназначьте смены."
        )
    
    await db.delete(db_template)
    await db.commit()
    return {"deleted": True, "has_future_shifts": False, "shifts_count": 0}

async def clone_shift_template(
    db: Session, 
    *, 
    source_template_id: UUID,
    new_name: str,
    group_id: int
) -> Optional[List[ShiftTemplate]]:
    """Клонирует существующий шаблон смены.
    
    Возвращает список клонированных шаблонов (один для каждого дня недели исходного шаблона).
    """
    source_template = await get_shift_template_by_id(db, template_id=source_template_id)
    if not source_template:
        return None
    
    # Получаем дни недели исходного шаблона
    source_days_result = await db.execute(
        select(ShiftTemplateDay).where(ShiftTemplateDay.template_id == source_template_id)
    )
    source_days = source_days_result.scalars().all()
    days_of_week = [day.day_of_week for day in source_days] if source_days else []
    
    new_template_data = ShiftTemplateCreate(
        group_id=group_id,
        name=new_name,
        description=source_template.description,
        start_time=source_template.start_time,
        end_time=source_template.end_time,
        max_slots=source_template.max_slots,
        has_senior_slot=source_template.has_senior_slot,
        template_metadata=source_template.template_metadata,
        days_of_week=days_of_week  # Сохраняем дни недели исходного шаблона
    )
    
    return await create_shift_template(db, template_data=new_template_data)

# === CRUD операции для связей шаблонов с днями недели ===

async def apply_templates_to_days(
    db: Session, 
    *, 
    group_id: int,
    apply_data: ShiftTemplateApplyPayload
) -> List[ShiftTemplateDay]:
    """Применяет шаблоны смен к указанным дням недели.
    
    Если связь уже существует, активирует её (is_active=True).
    Если связи нет, создает новую с is_active=True.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    created_or_updated_links = []
    
    logger.info(f"[apply_templates_to_days] Applying templates {apply_data.template_ids} to days {apply_data.days_of_week} for group {group_id}")
    
    for template_id in apply_data.template_ids:
        for day_of_week in apply_data.days_of_week:
            # Проверяем, не существует ли уже такая связь (включая неактивные)
            existing_link = await get_template_day_link(
                db, 
                template_id=template_id, 
                group_id=group_id, 
                day_of_week=day_of_week,
                include_inactive=True  # Ищем и активные, и неактивные связи
            )
            
            if existing_link:
                # Если связь существует, активируем её (даже если уже активна)
                logger.info(f"[apply_templates_to_days] Found existing link: template_id={template_id}, day={day_of_week}, is_active={existing_link.is_active}, deactivate_from_date={existing_link.deactivate_from_date}")
                
                # Сбрасываем deactivate_from_date, чтобы шаблон снова стал активным
                if existing_link.deactivate_from_date:
                    logger.info(f"[apply_templates_to_days] Resetting deactivate_from_date for template_id={template_id}, day={day_of_week} (was {existing_link.deactivate_from_date})")
                    existing_link.deactivate_from_date = None
                
                if not existing_link.is_active:
                    existing_link.is_active = True
                    logger.info(f"[apply_templates_to_days] Activated link: template_id={template_id}, day={day_of_week}")
                else:
                    logger.info(f"[apply_templates_to_days] Link already active: template_id={template_id}, day={day_of_week}")
                
                # Добавляем объект в сессию, если его там еще нет (нужно для сохранения изменений deactivate_from_date)
                db.add(existing_link)
                # Добавляем в список, даже если уже была активна (для логирования)
                created_or_updated_links.append(existing_link)
            else:
                # Если связи нет, создаем новую
                logger.info(f"[apply_templates_to_days] Creating new link: template_id={template_id}, day={day_of_week}")
                db_link = ShiftTemplateDay(
                    template_id=template_id,
                    group_id=group_id,
                    day_of_week=day_of_week,
                    is_active=True  # По умолчанию шаблон активен
                )
                db.add(db_link)
                created_or_updated_links.append(db_link)
    
    await db.commit()
    logger.info(f"[apply_templates_to_days] Applied {len(created_or_updated_links)} template-day links for group {group_id}")
    return created_or_updated_links

async def get_template_day_link(
    db: Session, 
    *, 
    template_id: UUID,
    group_id: int,
    day_of_week: int,
    include_inactive: bool = True  # Включать ли неактивные связи
) -> Optional[ShiftTemplateDay]:
    """Получает связь между шаблоном и днем недели."""
    conditions = [
        ShiftTemplateDay.template_id == template_id,
        ShiftTemplateDay.group_id == group_id,
        ShiftTemplateDay.day_of_week == day_of_week
    ]
    
    # Если не нужно включать неактивные, добавляем фильтр
    if not include_inactive:
        conditions.append(ShiftTemplateDay.is_active == True)
    
    result = await db.execute(
        select(ShiftTemplateDay)
        .where(and_(*conditions))
    )
    return result.scalars().first()

async def get_templates_for_day(
    db: Session, 
    *, 
    group_id: int,
    day_of_week: int,
    only_active: bool = True,  # По умолчанию возвращаем только активные шаблоны
    for_date: Optional[date] = None  # Дата для проверки deactivate_from_date
) -> List[ShiftTemplate]:
    """Получает все шаблоны смен для указанного дня недели.
    
    Если указана for_date, проверяет deactivate_from_date и исключает шаблоны,
    которые должны быть деактивированы для этой даты.
    """
    conditions = [
        ShiftTemplateDay.group_id == group_id,
        ShiftTemplateDay.day_of_week == day_of_week
    ]
    
    # Фильтруем по is_active, если требуется только активные
    if only_active:
        conditions.append(ShiftTemplateDay.is_active == True)
    
    result = await db.execute(
        select(ShiftTemplate, ShiftTemplateDay)
        .join(ShiftTemplateDay, ShiftTemplate.id == ShiftTemplateDay.template_id)
        .where(and_(*conditions))
        .order_by(ShiftTemplate.start_time)
    )
    
    templates = []
    for template, template_day in result.all():
        # Проверяем deactivate_from_date, если указана дата
        if for_date and template_day.deactivate_from_date and for_date >= template_day.deactivate_from_date:
            # Шаблон должен быть деактивирован для этой даты, пропускаем
            continue
        templates.append(template)
    
    return templates

async def check_template_has_assigned_shifts(
    db: Session,
    *,
    template_id: UUID,
    group_id: int,
    day_of_week: int
) -> int:
    """Проверяет, есть ли смены с записанными курьерами для шаблона на конкретный день недели.
    
    Возвращает количество смен с записанными курьерами (member_id не NULL) на будущие даты.
    Проверяет все будущие даты, которые соответствуют этому дню недели.
    
    day_of_week: 0 = понедельник, 6 = воскресенье (как в ShiftTemplateDay)
    """
    from models.shift import Shift
    from datetime import date
    from sqlalchemy import extract
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Проверяем наличие смен с курьерами для этого шаблона на будущие даты
    # Фильтруем по дню недели: EXTRACT(DOW FROM date) возвращает 1=воскресенье, 2=понедельник, ..., 7=суббота
    # В PostgreSQL: 0=воскресенье, 1=понедельник, ..., 6=суббота (ISO 8601)
    # Но в нашей системе: 0=понедельник, 6=воскресенье
    # Преобразуем: наш 0 (понедельник) = PostgreSQL 1, наш 6 (воскресенье) = PostgreSQL 0
    
    today = date.today()
    
    # PostgreSQL DOW: 0=воскресенье, 1=понедельник, ..., 6=суббота
    # Наша система: 0=понедельник, 1=вторник, ..., 6=воскресенье
    # Преобразование: наш день -> PostgreSQL день
    pg_day_of_week = (day_of_week + 1) % 7  # 0->1, 1->2, ..., 5->6, 6->0
    
    logger.info(f"[check_template_has_assigned_shifts] Checking shifts for template_id={template_id}, group_id={group_id}, day_of_week={day_of_week} (pg_dow={pg_day_of_week}), date>={today}")
    
    # Проверяем все будущие даты с этим днем недели
    result = await db.execute(
        select(Shift)
        .where(
            and_(
                Shift.template_id == template_id,
                Shift.group_id == group_id,
                Shift.date >= today,
                extract('dow', Shift.date) == pg_day_of_week,  # День недели в PostgreSQL
                Shift.member_id.isnot(None)  # Только смены с записанными курьерами
            )
        )
    )
    shifts = result.scalars().all()
    
    logger.info(f"[check_template_has_assigned_shifts] Found {len(shifts)} shifts with assigned couriers for template_id={template_id}, day_of_week={day_of_week}")
    if len(shifts) > 0:
        for shift in shifts:
            logger.info(f"[check_template_has_assigned_shifts] Shift: id={shift.id}, date={shift.date}, member_id={shift.member_id}, template_id={shift.template_id}")
    
    return len(shifts)

async def remove_templates_from_days(
    db: Session, 
    *, 
    group_id: int,
    template_ids: List[UUID],
    days_of_week: List[int],
    check_future_shifts: bool = True,  # Проверять ли наличие будущих смен
    group_access_settings: Optional[Dict[str, Any]] = None  # Настройки доступа для расчета периодов
) -> Dict[str, Any]:
    """Деактивирует связи шаблонов с указанными днями недели (устанавливает is_active=False).
    
    Если в текущем периоде есть записанные курьеры, шаблон остается активным в текущем периоде,
    но деактивируется для следующего периода (создается версия с деактивацией).
    
    Возвращает словарь с информацией о деактивированных связях и наличии смен.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    from models.shift import Shift
    from models.shift_template import ShiftTemplateVersion
    from utils.period_calculator import calculate_current_period_dates, calculate_next_period_start_date
    from datetime import date
    
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
    links_to_deactivate = result.scalars().all()
    
    deactivated_count = 0
    skipped_count = 0
    templates_with_shifts = []
    templates_deactivated_for_next_period = []
    
    # Рассчитываем периоды, если есть настройки доступа
    current_period_start = None
    current_period_end = None
    next_period_start = None
    
    if group_access_settings:
        try:
            current_period_start, current_period_end = calculate_current_period_dates(group_access_settings)
            next_period_start = calculate_next_period_start_date(group_access_settings)
            logger.info(f"[remove_templates_from_days] Current period: {current_period_start} - {current_period_end}, Next period starts: {next_period_start}")
        except Exception as e:
            logger.warning(f"[remove_templates_from_days] Error calculating periods: {e}")
    
    for link in links_to_deactivate:
        if check_future_shifts and group_access_settings and current_period_start and current_period_end:
            # Проверяем наличие смен с курьерами в текущем периоде
            from sqlalchemy import extract
            pg_day_of_week = (link.day_of_week + 1) % 7  # Преобразуем наш формат в PostgreSQL
            
            logger.info(f"[remove_templates_from_days] Checking shifts for template_id={link.template_id}, day_of_week={link.day_of_week}, period={current_period_start} - {current_period_end}")
            
            # Сначала проверяем все смены с этим template_id в периоде (без фильтра по дню недели и member_id)
            all_period_shifts_result = await db.execute(
                select(Shift)
                .where(
                    and_(
                        Shift.template_id == link.template_id,
                        Shift.group_id == group_id,
                        Shift.date >= current_period_start,
                        Shift.date <= current_period_end
                    )
                )
            )
            all_period_shifts = all_period_shifts_result.scalars().all()
            logger.info(f"[remove_templates_from_days] Found {len(all_period_shifts)} total shifts in period for template_id={link.template_id}")
            for shift in all_period_shifts:
                # Python weekday(): 0=понедельник, 1=вторник, ..., 6=воскресенье
                # Наша система: 0=понедельник, 1=вторник, ..., 6=воскресенье
                # Они совпадают!
                shift_day_of_week = shift.date.weekday()  # Прямое соответствие
                logger.info(f"[remove_templates_from_days] Shift: id={shift.id}, date={shift.date}, weekday()={shift.date.weekday()}, day_of_week={shift_day_of_week}, member_id={shift.member_id}, template_id={shift.template_id}")
            
            # Проверяем все смены с курьерами в текущем периоде для этого шаблона
            # ВАЖНО: Не фильтруем по дню недели, так как смена может быть на любой день недели
            # Главное - это шаблон и наличие курьера
            current_period_shifts_result = await db.execute(
                select(Shift)
                .where(
                    and_(
                        Shift.template_id == link.template_id,
                        Shift.group_id == group_id,
                        Shift.date >= current_period_start,
                        Shift.date <= current_period_end,
                        Shift.member_id.isnot(None)  # Только смены с записанными курьерами
                    )
                )
            )
            current_period_shifts = current_period_shifts_result.scalars().all()
            
            logger.info(f"[remove_templates_from_days] Found {len(current_period_shifts)} shifts with couriers in current period for template_id={link.template_id} (any day of week)")
            for shift in current_period_shifts:
                shift_weekday = shift.date.weekday()
                logger.info(f"[remove_templates_from_days] Shift with courier: id={shift.id}, date={shift.date}, weekday()={shift_weekday}, member_id={shift.member_id}")
            
            if len(current_period_shifts) > 0:
                # В текущем периоде есть записанные курьеры
                # Шаблон остается активным в текущем периоде, но будет деактивирован для следующего периода
                # Устанавливаем deactivate_from_date на дату начала следующего периода
                if next_period_start:
                    link.deactivate_from_date = next_period_start
                    templates_deactivated_for_next_period.append({
                        "template_id": str(link.template_id),
                        "day_of_week": link.day_of_week,
                        "deactivate_from_date": next_period_start.isoformat()
                    })
                    logger.info(f"[remove_templates_from_days] Template {link.template_id} has {len(current_period_shifts)} shifts in current period ({current_period_start} - {current_period_end}), will be deactivated from {next_period_start}")
                else:
                    # Не можем рассчитать следующий период, не деактивируем
                    templates_with_shifts.append({
                        "template_id": str(link.template_id),
                        "day_of_week": link.day_of_week,
                        "shifts_count": len(current_period_shifts),
                        "current_period_shifts": len(current_period_shifts)
                    })
                    skipped_count += 1
                    logger.info(f"[remove_templates_from_days] Template {link.template_id} has {len(current_period_shifts)} shifts in current period, but cannot calculate next period, keeping active")
            else:
                # В текущем периоде нет курьеров, проверяем все будущие даты (после текущего периода)
                # Используем дату окончания текущего периода + 1 день как начальную дату для проверки
                from datetime import timedelta
                future_date = current_period_end + timedelta(days=1)
                
                logger.info(f"[remove_templates_from_days] No shifts in current period, checking future shifts after {future_date}")
                
                # Проверяем смены после текущего периода
                future_shifts_result = await db.execute(
                    select(Shift)
                    .where(
                        and_(
                            Shift.template_id == link.template_id,
                            Shift.group_id == group_id,
                            Shift.date >= future_date,
                            extract('dow', Shift.date) == pg_day_of_week,
                            Shift.member_id.isnot(None)
                        )
                    )
                )
                future_shifts = future_shifts_result.scalars().all()
                future_shifts_count = len(future_shifts)
                
                logger.info(f"[remove_templates_from_days] Found {future_shifts_count} future shifts with couriers after {future_date}")
                
                if future_shifts_count > 0:
                    # Есть смены с курьерами в будущем (но не в текущем периоде)
                    templates_with_shifts.append({
                        "template_id": str(link.template_id),
                        "day_of_week": link.day_of_week,
                        "shifts_count": future_shifts_count
                    })
                    skipped_count += 1
                else:
                    # Нет смен с курьерами ни в текущем периоде, ни в будущем, деактивируем
                    link.is_active = False
                    deactivated_count += 1
                    logger.info(f"[remove_templates_from_days] No shifts found, deactivating template_id={link.template_id}, day_of_week={link.day_of_week}")
        elif check_future_shifts:
            # Проверяем наличие смен с курьерами (старая логика, если нет настроек доступа)
            shifts_count = await check_template_has_assigned_shifts(
                db,
                template_id=link.template_id,
                group_id=group_id,
                day_of_week=link.day_of_week
            )
            
            if shifts_count > 0:
                # НЕ деактивируем, если есть смены с записанными курьерами
                templates_with_shifts.append({
                    "template_id": str(link.template_id),
                    "day_of_week": link.day_of_week,
                    "shifts_count": shifts_count
                })
                skipped_count += 1
            else:
                # Деактивируем только если нет смен с курьерами
                link.is_active = False
                deactivated_count += 1
        else:
            # Если проверка отключена, деактивируем без проверки
            link.is_active = False
            deactivated_count += 1
    
    await db.commit()
    
    return {
        "deactivated_count": deactivated_count,
        "skipped_count": skipped_count,
        "templates_with_shifts": templates_with_shifts,
        "has_future_shifts": len(templates_with_shifts) > 0,
        "templates_deactivated_for_next_period": templates_deactivated_for_next_period
    }

async def update_template_day_status(
    db: Session,
    *,
    template_id: UUID,
    group_id: int,
    day_of_week: int,
    is_active: bool
) -> Optional[ShiftTemplateDay]:
    """Обновляет статус активации шаблона для конкретного дня недели."""
    template_day = await get_template_day_link(
        db,
        template_id=template_id,
        group_id=group_id,
        day_of_week=day_of_week
    )
    
    if not template_day:
        return None
    
    template_day.is_active = is_active
    await db.commit()
    await db.refresh(template_day)
    return template_day

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

async def get_future_version_by_template_id(
    db: Session,
    template_id: UUID
) -> Optional[ShiftTemplateVersion]:
    """Получает будущую версию шаблона (если есть)."""
    from datetime import date
    today = date.today()
    
    result = await db.execute(
        select(ShiftTemplateVersion)
        .where(
            and_(
                ShiftTemplateVersion.template_id == template_id,
                ShiftTemplateVersion.valid_from_date > today
            )
        )
        .order_by(ShiftTemplateVersion.valid_from_date.asc())
        .limit(1)
    )
    return result.scalars().first()

async def delete_template_version(
    db: Session,
    version_id: UUID
) -> bool:
    """Удаляет версию шаблона."""
    result = await db.execute(
        select(ShiftTemplateVersion)
        .where(ShiftTemplateVersion.id == version_id)
    )
    version = result.scalars().first()
    
    if not version:
        return False
    
    await db.delete(version)
    await db.flush()
    return True

async def update_template_version(
    db: Session,
    version_id: UUID,
    update_data: Dict[str, Any]
) -> Optional[ShiftTemplateVersion]:
    """Обновляет версию шаблона."""
    result = await db.execute(
        select(ShiftTemplateVersion)
        .where(ShiftTemplateVersion.id == version_id)
    )
    version = result.scalars().first()
    
    if not version:
        return None
    
    # Обновляем только разрешенные поля
    allowed_fields = ['max_slots', 'start_time', 'end_time', 'has_senior_slot', 'valid_from_date']
    for field, value in update_data.items():
        if field in allowed_fields and hasattr(version, field):
            setattr(version, field, value)
    
    await db.flush()
    await db.refresh(version)
    return version