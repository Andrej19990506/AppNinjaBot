from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import logging

# --- АБСОЛЮТНЫЕ ИМПОРТЫ (Новая попытка) ---
from schemas import EventRead          # Из /app/schemas/event.py
from models import Event               # Из /app/models/event.py
# Исправляем путь и имя функции для сессии БД
from db.session import get_db_session # Используем 'db' и 'get_db_session'

# Удаляем заглушки
# class EventRead: ...
# class Event: ...
# def get_db(): ...

logger = logging.getLogger(__name__)

router = APIRouter()

# Используем EventRead напрямую
@router.get("/", response_model=List[EventRead], summary="Получить список всех событий") 
async def read_events(
    db: AsyncSession = Depends(get_db_session) # Используем 'get_db_session'
):
    """
    Получает список всех событий из базы данных (асинхронно).
    """
    logger.info("Запрос на получение списка всех событий")
    try:
        # --- АСИНХРОННЫЙ ЗАПРОС К БД ---
        query = select(Event) # Создаем запрос
        result = await db.execute(query) # Выполняем асинхронно
        db_events = result.scalars().all() # Получаем результат

        logger.info(f"Найдено {len(db_events)} событий")
        # Автоматическое преобразование в List[EventRead] благодаря response_model и orm_mode=True в схеме
        return db_events
    except Exception as e:
        logger.exception("Ошибка при получении списка событий:")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера при получении событий")

# TODO: Добавить эндпоинты для создания (POST), получения одного (GET /id), обновления (PUT /id), удаления (DELETE /id) событий.
