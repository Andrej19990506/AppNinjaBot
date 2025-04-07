from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
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
        print(f"[Shifts Endpoint] Group with Telegram ID {group_telegram_id} not found. Returning empty list.")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Member with Telegram ID {shift_in.user_telegram_id} not found")
        
    # 2. Найти внутренний ID группы (Group) по Telegram ID
    group_result = await db.execute(
        select(Group).where(Group.group_id == shift_in.group_telegram_id)
    )
    group = group_result.scalar_one_or_none()
    if group is None:
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
        await db.refresh(db_shift, attribute_names=['id', 'created_at', 'updated_at'])
        
        # Загружаем связанного Member для ответа
        stmt = select(Shift).options(joinedload(Shift.member)).where(Shift.id == db_shift.id)
        result = await db.execute(stmt)
        created_shift_with_member = result.scalar_one_or_none()
        
        if created_shift_with_member is None:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not fetch created shift details")
        
        return created_shift_with_member
        
    except Exception as e:
        await db.rollback()
        print(f"Error creating shift: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the shift."
        ) 