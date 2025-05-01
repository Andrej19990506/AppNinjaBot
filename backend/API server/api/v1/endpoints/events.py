from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import logging
import uuid
import os
import httpx

# --- АБСОЛЮТНЫЕ ИМПОРТЫ (Новая попытка) ---
import schemas          # Из /app/schemas/event.py
from db.session import get_db_session # Используем 'db' и 'get_db_session'
import crud # <<< ДОБАВЛЕНО: Импорт CRUD операций
# --- Импортируем нашу утилиту --- 
from utils.scheduler_client import notify_scheduler

# Удаляем заглушки
# class EventRead: ...
# class Event: ...
# def get_db(): ...

logger = logging.getLogger(__name__)

router = APIRouter()

# Используем EventRead напрямую
@router.get("/", response_model=List[schemas.EventRead], summary="Получить список всех событий") 
async def read_events(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получает список событий с пагинацией.
    Уведомления для каждого события также подгружаются.
    """
    logger.info(f"Запрос на получение списка событий (skip={skip}, limit={limit})")
    try:
        db_events = await crud.event.get_events(db=db, skip=skip, limit=limit)
        logger.info(f"Найдено {len(db_events)} событий")
        return db_events
    except Exception as e:
        logger.exception("Ошибка при получении списка событий:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при получении событий"
        )

# --- Эндпоинт для создания события --- 
@router.post(
    "/", 
    response_model=schemas.EventRead, 
    status_code=status.HTTP_201_CREATED, # Возвращаем 201 при успешном создании
    summary="Создать новое событие"
)
async def create_event(
    event_in: schemas.EventCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Создает новое событие.
    Принимает `description` и `date`.
    """
    logger.info(f"Запрос на создание нового события: {event_in.description}")
    try:
        db_event = await crud.event.create_event(db=db, event_in=event_in)
        logger.info(f"Событие создано с ID: {db_event.id}")
        # Важно: чтобы в ответе были уведомления (пустой список), 
        # нужно снова запросить событие или использовать refresh с options,
        # но для POST проще вернуть созданный объект как есть.
        # Pydantic сам создаст пустой список notifications.
        return db_event 
    except Exception as e:
        logger.exception("Ошибка при создании события:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при создании события"
        )

# --- Эндпоинт для удаления события --- 
@router.delete(
    "/{event_id}", 
    response_model=schemas.EventRead, # Возвращаем удаленный объект
    summary="Удалить событие по ID"
)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Удаляет событие и все связанные с ним уведомления.
    Возвращает удаленное событие или 404, если не найдено.
    """
    logger.info(f"Запрос на удаление события с ID: {event_id}")
    try:
        deleted_event = await crud.event.delete_event(db=db, event_id=event_id)
        if not deleted_event:
            logger.warning(f"Событие с ID {event_id} не найдено для удаления")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие не найдено")
        logger.info(f"Событие с ID {event_id} успешно удалено")
        return deleted_event
    except HTTPException: # Пробрасываем HTTP исключения (например, 404)
        raise
    except Exception as e:
        logger.exception(f"Ошибка при удалении события {event_id}:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при удалении события"
        )

# --- Эндпоинт для создания уведомления для события --- 
@router.post(
    "/{event_id}/notifications", 
    response_model=schemas.NotificationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить уведомление к событию"
)
async def create_notification_for_event(
    event_id: int,
    notification_in: schemas.NotificationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Создает новое уведомление для события с указанным `event_id`.
    После успешного создания отправляет задачу в Шедулер.
    """
    logger.info(f"Запрос на добавление уведомления к событию {event_id}")
    event = await crud.event.get_event(db=db, event_id=event_id)
    if not event:
        logger.warning(f"Событие с ID {event_id} не найдено для добавления уведомления")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие не найдено")
        
    try:
        # --- Создаем уведомление в БД --- 
        db_notification = await crud.event.create_event_notification(
            db=db, notification_in=notification_in, event_id=event_id
        )
        await db.commit()
        await db.refresh(db_notification)
        logger.info(f"Уведомление создано с ID: {db_notification.id} для события {event_id}")
        
        # --- Преобразуем SQLAlchemy в Pydantic и добавляем event_time --- 
        try:
            notification_pydantic = schemas.NotificationRead.from_orm(db_notification)
            logger.info(f"Добавление фоновой задачи для отправки уведомления {db_notification.id} в Шедулер")
            # --- ИЗМЕНЕНИЕ: Передаем Pydantic объект и дату события --- 
            background_tasks.add_task(notify_scheduler, notification_pydantic, event.date)
        except Exception as pydantic_error:
            logger.error(f"Ошибка подготовки данных для Шедулера (уведомление {db_notification.id}): {pydantic_error}", exc_info=True)

        return db_notification
    except Exception as e:
        await db.rollback()
        logger.exception(f"Ошибка при создании уведомления {notification_id} или отправке в Шедулер для события {event_id}:", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при создании уведомления"
        )

# --- Эндпоинт для обновления уведомления события --- 
@router.put(
    "/{event_id}/notifications/{notification_id}", 
    response_model=schemas.NotificationRead,
    summary="Обновить существующее уведомление события"
)
async def update_notification_for_event(
    event_id: int,
    notification_id: uuid.UUID,
    notification_in: schemas.NotificationUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновляет существующее уведомление по его ID и ID события.
    После успешного обновления отправляет задачу в Шедулер.
    """
    logger.info(f"Запрос на обновление уведомления {notification_id} для события {event_id}")
    try:
        # --- Обновляем уведомление в БД --- 
        updated_notification = await crud.event.update_event_notification(
            db=db, 
            event_id=event_id, 
            notification_id=notification_id, 
            notification_in=notification_in
        )
        if not updated_notification:
            logger.warning(f"Уведомление {notification_id} не найдено или не принадлежит событию {event_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Уведомление не найдено или не принадлежит этому событию"
            )
        await db.commit()
        await db.refresh(updated_notification)
        logger.info(f"Уведомление {notification_id} успешно обновлено")

        # --- ВАЖНО: Загружаем событие, чтобы получить его время --- 
        # Мы можем либо модифицировать crud.update_event_notification, чтобы он возвращал 
        # обновленное уведомление С предзагруженным событием (через joinedload), 
        # либо запросить событие здесь отдельно. Запросим отдельно для простоты.
        event = await crud.event.get_event(db=db, event_id=event_id)
        if not event:
             # Если событие вдруг удалили между проверкой и этим моментом
             logger.error(f"Событие {event_id} не найдено после обновления уведомления {notification_id}. Невозможно отправить event_time.")
             # Можно либо падать, либо отправлять без event_time, либо не отправлять вообще
             # Пока что просто залогируем и продолжим
             pass
             
        await db.commit()
        await db.refresh(updated_notification)
        logger.info(f"Уведомление {notification_id} успешно обновлено")

        # --- Преобразуем SQLAlchemy в Pydantic и добавляем event_time --- 
        try:
            notification_pydantic = schemas.NotificationRead.from_orm(updated_notification)
            logger.info(f"Добавление фоновой задачи для отправки обновления уведомления {updated_notification.id} в Шедулер")
            # --- ИЗМЕНЕНИЕ: Передаем Pydantic объект и дату события --- 
            background_tasks.add_task(notify_scheduler, notification_pydantic, event.date)
        except Exception as pydantic_error:
            logger.error(f"Ошибка подготовки данных для Шедулера (уведомление {updated_notification.id}): {pydantic_error}", exc_info=True)

        return updated_notification
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.exception(f"Ошибка при обновлении уведомления {notification_id} или отправке в Шедулер для события {event_id}:", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при обновлении уведомления"
        )

# TODO: Добавить эндпоинты для обновления (PUT /id), получения одного (GET /id) событий,
# и, возможно, для удаления уведомлений.
