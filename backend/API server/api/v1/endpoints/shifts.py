from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy import text
import json
import logging
from typing import List, Optional
from pydantic import BaseModel

# Используем АБСОЛЮТНЫЕ импорты от /app
from db.session import get_db_session
from models.shift import Shift
from schemas.shift import ShiftRead, ShiftCreate, ShiftBase
from models.member import Member
from models.group import Group

# Добавляем схемы для создания и базовую
from schemas.shift import ShiftRead, ShiftCreate, ShiftBase

# Инициализируем логгер
logger = logging.getLogger(__name__)

# <<< Новая схема для создания через Telegram ID >>>
class ShiftCreateTelegram(BaseModel):
    date: str # ISO string date only YYYY-MM-DD
    shift_type: str # 'day' or 'night'
    slot_index: int
    user_telegram_id: int # Telegram ID пользователя
    group_telegram_id: int # Telegram ID группы
    # is_drag_action: Optional[bool] = None # Если нужно передавать

router = APIRouter()

@router.get("/", response_model=List[ShiftRead])
async def read_shifts(
    # Принимаем Telegram ID группы как параметр запроса
    group_telegram_id: int = Query(..., description="Telegram ID of the group to fetch shifts for"),
    db: AsyncSession = Depends(get_db_session)
):
    """Получает список всех смен для указанной группы (по Telegram ID)."""
    
    # 1. Найти внутренний ID группы по Telegram ID
    group_result = await db.execute(
        select(Group.id).where(Group.group_id == group_telegram_id)
    )
    group_internal_id = group_result.scalar_one_or_none()
    
    if group_internal_id is None:
        # Если группа не найдена по Telegram ID, возвращаем пустой список (или 404?)
        # Пока вернем пустой список, т.к. фронт может запрашивать для разных чатов
        logger.warning(f"[Shifts Endpoint] Group with Telegram ID {group_telegram_id} not found. Returning empty list.")
        return [] 
        # Либо: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group with Telegram ID {group_telegram_id} not found")

    # 2. Запрос для выбора смен по ВНУТРЕННЕМУ ID группы
    stmt = (
        select(Shift)
        .options(joinedload(Shift.member))
        .where(Shift.group_id == group_internal_id) # <<< Используем внутренний ID
        .order_by(Shift.date, Shift.shift_type, Shift.slot_index)
    )
    
    result = await db.execute(stmt)
    shifts = result.scalars().all()
    
    return shifts

@router.post("/", response_model=ShiftRead, status_code=status.HTTP_201_CREATED)
async def create_shift(
    shift_in: ShiftCreateTelegram, # <<< Используем новую схему
    db: AsyncSession = Depends(get_db_session)
):
    """Создает новую запись о смене по Telegram ID пользователя и группы."""
    
    # 1. Найти внутренний ID пользователя (Member) по Telegram ID
    member_result = await db.execute(
        select(Member).where(Member.user_id == shift_in.user_telegram_id)
    )
    member = member_result.scalar_one_or_none()
    if member is None:
        logger.error(f"[Create Shift] Member with Telegram ID {shift_in.user_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Member with Telegram ID {shift_in.user_telegram_id} not found")
        
    # 2. Найти внутренний ID группы (Group) по Telegram ID
    group_result = await db.execute(
        select(Group).where(Group.group_id == shift_in.group_telegram_id)
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        logger.error(f"[Create Shift] Group with Telegram ID {shift_in.group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group with Telegram ID {shift_in.group_telegram_id} not found")

    # 3. Создать смену, используя найденные внутренние ID
    db_shift = Shift(
        member_id=member.id, # <<< Используем member.id
        group_id=group.id,   # <<< Используем group.id
        date=shift_in.date,
        shift_type=shift_in.shift_type,
        slot_index=shift_in.slot_index
    )
    
    db.add(db_shift)
    try:
        await db.commit()
        logger.info(f"[Create Shift] Shift committed for member {member.id} in group {group.id} ({shift_in.group_telegram_id}) on {shift_in.date}")
        await db.refresh(db_shift, attribute_names=['id', 'created_at', 'updated_at'])
        
        # --- Отправка NOTIFY после успешного коммита --- >
        try:
            notify_payload = json.dumps({
                "type": "shifts_updated",
                # Передаем ТЕЛЕГРАМ ID группы, т.к. вебсокет работает с ним
                "chat_id": str(shift_in.group_telegram_id),
                "source": "shift_creation"
            })
            # Исправляем команду NOTIFY: вставляем payload прямо в строку
            # и оборачиваем одинарными кавычками для SQL
            # sql_command = text(f"NOTIFY websocket_channel, :payload") # Старая версия
            # await db.execute(sql_command, {'payload': notify_payload}) # Старая версия
            sql_command = text(f"NOTIFY websocket_channel, '{notify_payload}'")
            await db.execute(sql_command) # Выполняем без параметров

            # Commit после NOTIFY обычно не нужен
            logger.info(f"[Create Shift] Sent NOTIFY websocket_channel for chat_id {shift_in.group_telegram_id}")
        except Exception as notify_err:
            # Логируем ошибку NOTIFY, но не прерываем основной ответ
            logger.error(f"[Create Shift] Failed to send NOTIFY for chat_id {shift_in.group_telegram_id}: {notify_err}", exc_info=True)
        # --- Конец блока NOTIFY ---

        # Загружаем связанного Member для ответа
        stmt = select(Shift).options(joinedload(Shift.member)).where(Shift.id == db_shift.id)
        result = await db.execute(stmt)
        created_shift_with_member = result.scalar_one_or_none()
        
        if created_shift_with_member is None:
             logger.error(f"[Create Shift] Could not fetch created shift details after commit (Shift ID: {db_shift.id})")
             # Возможно, стоит вернуть созданный db_shift без member?
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not fetch created shift details")
        
        return created_shift_with_member
        
    except Exception as e:
        await db.rollback()
        logger.error(f"[Create Shift] Error during shift creation or commit: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the shift."
        ) 