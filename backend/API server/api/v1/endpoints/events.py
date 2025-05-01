from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import logging
import uuid # <<< Добавляем импорт uuid

# --- АБСОЛЮТНЫЕ ИМПОРТЫ (Новая попытка) ---
import schemas          # Из /app/schemas/event.py
from db.session import get_db_session # Используем 'db' и 'get_db_session'
import crud # <<< ДОБАВЛЕНО: Импорт CRUD операций

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
    db: AsyncSession = Depends(get_db_session)
):
    """
    Создает новое уведомление для события с указанным `event_id`.
    """
    logger.info(f"Запрос на добавление уведомления к событию {event_id}")
    # Проверяем, существует ли само событие
    event = await crud.event.get_event(db=db, event_id=event_id)
    if not event:
        logger.warning(f"Событие с ID {event_id} не найдено для добавления уведомления")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие не найдено")
    
    # TODO: Добавить логику, если нужно ограничить кол-во уведомлений (например, только одно)
    # if event.notifications:
    #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Уведомление для этого события уже существует")
        
    try:
        db_notification = await crud.event.create_event_notification(
            db=db, notification_in=notification_in, event_id=event_id
        )
        logger.info(f"Уведомление создано с ID: {db_notification.id} для события {event_id}")
        return db_notification
    except Exception as e:
        logger.exception(f"Ошибка при создании уведомления для события {event_id}:")
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
    notification_id: uuid.UUID, # <<< Принимаем UUID из пути
    notification_in: schemas.NotificationUpdate, # <<< Принимаем данные для обновления
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновляет существующее уведомление по его ID и ID события.
    """
    logger.info(f"Запрос на обновление уведомления {notification_id} для события {event_id}")
    try:
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
        logger.info(f"Уведомление {notification_id} успешно обновлено")
        return updated_notification
    except HTTPException:
        raise # Пробрасываем HTTP исключения (например, 404)
    except Exception as e:
        logger.exception(f"Ошибка при обновлении уведомления {notification_id} для события {event_id}:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при обновлении уведомления"
        )

# TODO: Добавить эндпоинты для обновления (PUT /id), получения одного (GET /id) событий,
# и, возможно, для удаления уведомлений.
