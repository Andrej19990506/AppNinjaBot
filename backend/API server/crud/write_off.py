from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.write_off import WriteOff
from schemas.write_off import WriteOffCreate, WriteOffUpdate
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import date

async def get_write_offs_by_group(db: AsyncSession, group_id: int, date_filter: Optional[date] = None) -> List[WriteOff]:
    query = select(WriteOff).where(WriteOff.group_id == group_id)
    
    # Добавляем фильтр по дате если он указан
    if date_filter:
        query = query.where(WriteOff.date == date_filter)
    
    # Сортируем по дате и времени создания (новые сверху)
    query = query.order_by(WriteOff.date.desc(), WriteOff.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

async def create_write_off(db: AsyncSession, group_id: int, write_off: WriteOffCreate) -> WriteOff:
    write_off_data = write_off.dict()
    
    # Если дата не указана, устанавливаем текущую дату
    if not write_off_data.get('date'):
        write_off_data['date'] = date.today()
    
    db_write_off = WriteOff(**write_off_data, group_id=group_id)
    db.add(db_write_off)
    await db.commit()
    await db.refresh(db_write_off)
    return db_write_off

async def update_write_off(db: AsyncSession, group_id: int, write_off_id: int, write_off: WriteOffUpdate) -> WriteOff:
    result = await db.execute(select(WriteOff).where(WriteOff.id == write_off_id, WriteOff.group_id == group_id))
    db_write_off = result.scalar_one_or_none()
    if not db_write_off:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WriteOff not found")
    for field, value in write_off.dict(exclude_unset=True).items():
        setattr(db_write_off, field, value)
    await db.commit()
    await db.refresh(db_write_off)
    return db_write_off

async def delete_write_off(db: AsyncSession, group_id: int, write_off_id: int) -> None:
    result = await db.execute(select(WriteOff).where(WriteOff.id == write_off_id, WriteOff.group_id == group_id))
    db_write_off = result.scalar_one_or_none()
    if not db_write_off:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WriteOff not found")
    await db.delete(db_write_off)
    await db.commit() 