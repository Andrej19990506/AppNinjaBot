from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from db.session import get_db_session
import crud
import schemas
from models.reserve import Reserve
from models.group import Group

router = APIRouter()

@router.post("", response_model=schemas.ReserveRead, status_code=201)
async def add_to_reserve(
    reserve_in: schemas.ReserveCreate,
    db: AsyncSession = Depends(get_db_session),
):
    """Добавляет пользователя в резерв на указанную дату."""
    # TODO: Добавить проверку прав доступа (например, только админ или сам пользователь)
    
    print(f"DEBUG: Создание резерва с данными: user_telegram_id={reserve_in.user_telegram_id}, group_telegram_id={reserve_in.group_telegram_id}, date={reserve_in.reserve_date}")
    
    # Проверяем, нет ли уже резерва у пользователя на эту дату
    existing_reserve = await crud.reserve.check_existing_reserve(
        db=db, 
        user_telegram_id=reserve_in.user_telegram_id,
        group_telegram_id=reserve_in.group_telegram_id,
        reserve_date=reserve_in.reserve_date
    )
    
    if existing_reserve:
        print(f"DEBUG: Резерв уже существует с ID: {existing_reserve.id}")
        raise HTTPException(
            status_code=409, 
            detail="User is already in reserve for this date and group."
        )
    
    # Создаем новый резерв если существующего нет
    db_reserve = await crud.reserve.create_reserve(db=db, reserve_in=reserve_in)
    
    if db_reserve is None:
        print(f"DEBUG: Ошибка создания резерва - пользователь или группа не найдены")
        # Либо пользователь не найден, либо другая ошибка при создании
        raise HTTPException(
            status_code=404, 
            detail=f"User with telegram_id {reserve_in.user_telegram_id} not found or reserve creation failed."
        )
        
    print(f"DEBUG: Резерв создан с ID: {db_reserve.id}, member_id: {db_reserve.member_id}, group_id: {db_reserve.group_id}")
    print(f"DEBUG: Member загружен: {hasattr(db_reserve, 'member') and db_reserve.member is not None}")
    print(f"DEBUG: Group загружен: {hasattr(db_reserve, 'group') and db_reserve.group is not None}")
    
    # Проверяем, есть ли связанный пользователь (на всякий случай)
    if not hasattr(db_reserve, 'member') or not db_reserve.member:
         # Если member не загрузился, попробуем перезагрузить весь объект Reserve
         await db.refresh(db_reserve)
         await db.refresh(db_reserve.member)
         if not db_reserve.member:
              raise HTTPException(
                  status_code=500, 
                  detail="Failed to load member data for the created reserve."
              )
              
    # Проверка перед созданием схемы ReserveRead
    if not all([db_reserve.member.id, db_reserve.member.user_id]):
         raise HTTPException(
            status_code=500, 
            detail="Member data is incomplete for the created reserve."
         )
         
    return db_reserve

@router.get("", response_model=List[schemas.ReserveRead])
async def read_reserves(
    group_telegram_id: int = Query(..., description="Telegram ID группы для фильтрации резервов"),
    reserve_date: date = Query(None, description="Дата для фильтрации резервов (YYYY-MM-DD), если не указана - вернутся все резервы группы"),
    db: AsyncSession = Depends(get_db_session),
):
    """Получает список резервов для указанной группы, опционально фильтруя по дате."""
    # TODO: Добавить проверку прав доступа
    
    # Находим внутренний ID группы по Telegram ID
    group_result = await db.execute(select(Group.id).where(Group.group_id == group_telegram_id))
    group_id = group_result.scalar_one_or_none()
    
    if group_id is None:
        # Если группа не найдена, возвращаем пустой список
        print(f"DEBUG: Группа с Telegram ID {group_telegram_id} не найдена, возвращаем []")
        return []
    
    # Базовый запрос
    query = (
        select(Reserve)
        .where(Reserve.group_id == group_id)
        .options(
            selectinload(Reserve.member),
            selectinload(Reserve.group)
        )
    )
    
    # Если указана дата, добавляем фильтр по дате
    if reserve_date:
        print(f"DEBUG: Фильтруем резервы по дате {reserve_date}")
        query = query.where(Reserve.date == reserve_date)
    
    result = await db.execute(query.order_by(Reserve.date, Reserve.created_at))
    reserves = result.scalars().all()
    
    # Логирование для отладки
    print(f"DEBUG: Получено резервов: {len(reserves)}")
    for idx, reserve in enumerate(reserves):
        print(f"DEBUG: Резерв #{idx+1}:")
        print(f"  - ID: {reserve.id}")
        print(f"  - Date: {reserve.date}")
        print(f"  - Member ID: {reserve.member_id}")
        print(f"  - Group ID: {reserve.group_id}")
        print(f"  - Member loaded: {reserve.member is not None}")
        print(f"  - Group loaded: {reserve.group is not None}")
        if reserve.member:
            print(f"  - Member User ID: {reserve.member.user_id}")
            print(f"  - Member Name: {reserve.member.first_name} {reserve.member.last_name}")
        if reserve.group:
            print(f"  - Group Telegram ID: {reserve.group.group_id}")
            print(f"  - Group Title: {reserve.group.title}")
    
    return reserves

@router.get("/all", response_model=List[schemas.ReserveRead])
async def read_all_reserves(
    db: AsyncSession = Depends(get_db_session),
):
    """Получает список всех резервов в системе (только для отладки)."""
    result = await db.execute(
        select(Reserve)
        .options(
            selectinload(Reserve.member),
            selectinload(Reserve.group)
        )
        .order_by(Reserve.date, Reserve.created_at)
    )
    reserves = result.scalars().all()
    
    print(f"DEBUG: Получено всех резервов: {len(reserves)}")
    
    return reserves

@router.delete("/{reserve_id}", response_model=schemas.ReserveRead)
async def remove_from_reserve(
    reserve_id: UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """Удаляет пользователя из резерва по ID записи резерва."""
    # TODO: Добавить проверку прав доступа (например, только админ или сам пользователь)
    
    db_reserve = await crud.reserve.delete_reserve(db=db, reserve_id=reserve_id)
    if db_reserve is None:
        raise HTTPException(status_code=404, detail="Reserve entry not found")
    return db_reserve 