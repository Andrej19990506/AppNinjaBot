# backend/API server/crud/event.py
import uuid
from typing import List, Optional, Any
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

# Предполагаем, что модели и схемы импортируются так:
import models
import schemas

async def create_event(db: AsyncSession, *, event_in: schemas.EventCreate) -> models.Event:
    """Создает новое событие в базе данных."""
    db_event = models.Event(
        description=event_in.description,
        date=event_in.date,
        event_type=event_in.event_type,
        chat_ids=event_in.chat_ids if hasattr(event_in, 'chat_ids') else None,
        retailiqa_insp_id=event_in.retailiqa_insp_id,
        retailiqa_insp_obj_id=event_in.retailiqa_insp_obj_id,
        retailiqa_insp_obj_name=event_in.retailiqa_insp_obj_name,
        retailiqa_total_points=event_in.retailiqa_total_points,
        retailiqa_penalty_points=event_in.retailiqa_penalty_points,
        retailiqa_comments=event_in.retailiqa_comments,
        retailiqa_photos=event_in.retailiqa_photos,
        # Добавляем новые поля для процента выполнения и баллов проверки
        retailiqa_score_percentage=event_in.retailiqa_score_percentage,
        retailiqa_max_points=event_in.retailiqa_max_points,
        retailiqa_earned_points=event_in.retailiqa_earned_points,
        # Добавляем новые поля для детальной информации о нарушениях
        retailiqa_violation_count=event_in.retailiqa_violation_count,
        retailiqa_detailed_violations=event_in.retailiqa_detailed_violations
    )
    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)
    return db_event

async def get_events(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[models.Event]:
    """Получает список событий с их уведомлениями."""
    query = (
        select(models.Event)
        .options(selectinload(models.Event.notifications))
        .offset(skip)
        .limit(limit)
        .order_by(models.Event.date.desc())
    )
    result = await db.execute(query)
    events = result.scalars().all()
    return events

async def get_event(db: AsyncSession, event_id: int) -> Optional[models.Event]:
    """Получает одно событие по ID с его уведомлениями."""
    query = (
        select(models.Event)
        .where(models.Event.id == event_id)
        .options(selectinload(models.Event.notifications))
    )
    result = await db.execute(query)
    event = result.scalars().first()
    return event

async def get_event_by_retailiqa_insp_id(db: AsyncSession, retailiqa_insp_id: str) -> Optional[models.Event]:
    """Получает одно событие по retailiqa_insp_id с его уведомлениями."""
    if not retailiqa_insp_id:
        return None
    query = (
        select(models.Event)
        .where(models.Event.retailiqa_insp_id == retailiqa_insp_id)
        .options(selectinload(models.Event.notifications))
    )
    result = await db.execute(query)
    event = result.scalars().first()
    return event

async def update_event(
    db: AsyncSession,
    *,
    db_event: models.Event,
    event_in: schemas.EventUpdate
) -> models.Event:
    """Обновляет существующее событие."""
    update_data = event_in.model_dump(exclude_unset=True)

    # Убедимся, что event_in содержит все необходимые поля, включая новые
    # Это уже делается автоматически методом model_dump

    for field, value in update_data.items():
        setattr(db_event, field, value)
    
    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)
    return db_event

async def delete_event(db: AsyncSession, event_id: int) -> Optional[models.Event]:
    """Удаляет событие по ID."""
    db_event = await get_event(db, event_id=event_id)
    if db_event:
        await db.delete(db_event)
        await db.commit()
    return db_event

async def create_event_notification(
    db: AsyncSession, 
    *, 
    notification_in: schemas.NotificationCreate, 
    event_id: int
) -> models.Notification:
    """Создает новое уведомление для указанного события."""
    db_notification = models.Notification(
        message = notification_in.message,
        time = notification_in.time,
        chat_ids = notification_in.chat_ids,
        event_id=event_id,
        requires_confirmation = notification_in.requires_confirmation,
        # Добавляем новые поля для управления временем
        send_now = notification_in.send_now,
        use_absolute_time = notification_in.use_absolute_time,
        absolute_time = notification_in.absolute_time
    )
    # Обработка repeat_config и repeat_type
    if notification_in.repeat.type == 'none':
        db_notification.repeat_config = None
        db_notification.repeat_type = 'none'
    else:
        db_notification.repeat_type = notification_in.repeat.type
        # Собираем repeat_config только из нужных полей
        config_data = {}
        if notification_in.repeat.weekdays is not None:
            config_data['weekdays'] = notification_in.repeat.weekdays
        if notification_in.repeat.month_day is not None:
            config_data['month_day'] = notification_in.repeat.month_day
        db_notification.repeat_config = config_data if config_data else None

    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)
    return db_notification

async def get_notification(db: AsyncSession, notification_id: uuid.UUID) -> Optional[models.Notification]:
    """Получает одно уведомление по его UUID."""
    query = select(models.Notification).where(models.Notification.id == notification_id)
    result = await db.execute(query)
    return result.scalars().first()

async def update_event_notification(
    db: AsyncSession, 
    *, 
    notification_id: uuid.UUID,
    notification_in: schemas.NotificationUpdate,
    event_id: int
) -> Optional[models.Notification]:
    """Обновляет существующее уведомление."""
    db_notification = await get_notification(db, notification_id=notification_id)

    if not db_notification or db_notification.event_id != event_id:
        return None

    update_data = notification_in.model_dump(exclude_unset=True) 

    # Специальная обработка для repeat
    if 'repeat' in update_data:
        repeat_data = update_data.pop('repeat')
        if repeat_data:
            if repeat_data['type'] == 'none':
                db_notification.repeat_type = 'none'
                db_notification.repeat_config = None
            else:
                db_notification.repeat_type = repeat_data['type']
                config_data = {}
                if 'weekdays' in repeat_data and repeat_data['weekdays'] is not None:
                    config_data['weekdays'] = repeat_data['weekdays']
                if 'month_day' in repeat_data and repeat_data['month_day'] is not None:
                    config_data['month_day'] = repeat_data['month_day']
                db_notification.repeat_config = config_data if config_data else None
        else:
            db_notification.repeat_type = 'none'
            db_notification.repeat_config = None
    
    # Обработка полей времени
    # Явно обрабатываем, чтобы удостовериться, что они корректно обновляются
    if 'send_now' in update_data:
        db_notification.send_now = update_data.pop('send_now')
    
    if 'use_absolute_time' in update_data:
        db_notification.use_absolute_time = update_data.pop('use_absolute_time')
    
    if 'absolute_time' in update_data:
        db_notification.absolute_time = update_data.pop('absolute_time')

    # Обновляем остальные поля
    for field, value in update_data.items():
        setattr(db_notification, field, value)

    await db.commit()
    await db.refresh(db_notification)
    return db_notification

async def get_notification_by_id(db: AsyncSession, notification_id: uuid.UUID) -> Optional[models.Notification]:
    """Получает уведомление по его ID без привязки к конкретному событию."""
    query = select(models.Notification).where(models.Notification.id == notification_id)
    result = await db.execute(query)
    return result.scalars().first()

# TODO: Добавить функцию для удаления уведомлений при необходимости 