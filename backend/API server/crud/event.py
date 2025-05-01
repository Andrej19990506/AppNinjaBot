# backend/API server/crud/event.py
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload # Для эффективной загрузки relationships

# Предполагаем, что модели и схемы импортируются так:
import models
import schemas

async def create_event(db: AsyncSession, *, event_in: schemas.EventCreate) -> models.Event:
    """Создает новое событие в базе данных."""
    # TODO: Реализовать создание объекта модели и сохранение
    db_event = models.Event(
        description=event_in.description,
        date=event_in.date
        # Другие поля будут иметь значения по умолчанию из модели
    )
    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)
    return db_event

async def get_events(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[models.Event]:
    """Получает список событий с их уведомлениями."""
    # TODO: Реализовать запрос с пагинацией и загрузкой уведомлений
    query = (
        select(models.Event)
        .options(selectinload(models.Event.notifications)) # Загружаем уведомления
        .offset(skip)
        .limit(limit)
        .order_by(models.Event.date.desc()) # Сортируем по дате (например)
    )
    result = await db.execute(query)
    return result.scalars().all()

async def get_event(db: AsyncSession, event_id: int) -> Optional[models.Event]:
    """Получает одно событие по ID с его уведомлениями."""
    # TODO: Реализовать запрос одного события с уведомлениями
    query = (
        select(models.Event)
        .where(models.Event.id == event_id)
        .options(selectinload(models.Event.notifications))
    )
    result = await db.execute(query)
    return result.scalars().first()

async def delete_event(db: AsyncSession, event_id: int) -> Optional[models.Event]:
    """Удаляет событие по ID."""
    # TODO: Реализовать получение и удаление события
    db_event = await get_event(db, event_id=event_id) # Находим событие
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
        db_notification.repeat_config = config_data if config_data else None # Сохраняем {} или None

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
    event_id: int # Добавляем event_id для проверки принадлежности
) -> Optional[models.Notification]:
    """Обновляет существующее уведомление."""
    db_notification = await get_notification(db, notification_id=notification_id)

    if not db_notification or db_notification.event_id != event_id:
        # Уведомление не найдено или принадлежит другому событию
        return None

    # Получаем данные для обновления, исключая неустановленные поля
    update_data = notification_in.model_dump(exclude_unset=True) 

    # Особая обработка поля repeat, если оно есть в update_data
    if 'repeat' in update_data:
        repeat_data = update_data.pop('repeat') # Удаляем 'repeat' из основного словаря
        if repeat_data:
            # Парсим repeat_data (это будет объект RepeatSettingsCreate или None)
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
        else: # Если repeat = None в запросе
            db_notification.repeat_type = 'none'
            db_notification.repeat_config = None


    # Обновляем остальные поля модели
    for field, value in update_data.items():
        setattr(db_notification, field, value)

    await db.commit()
    await db.refresh(db_notification)
    return db_notification

# TODO: Добавить функцию для удаления уведомлений при необходимости 