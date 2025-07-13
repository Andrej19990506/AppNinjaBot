from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from models.write_off import WriteOff
from models.member import Member
from schemas.write_off import WriteOffCreate, WriteOffUpdate
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import date
import logging

logger = logging.getLogger(__name__)

async def get_write_offs_by_group(db: AsyncSession, group_id: int, date_filter: Optional[date] = None) -> List[WriteOff]:
    logger.info(f"🔍 [CRUD] get_write_offs_by_group вызван: group_id={group_id}, date_filter={date_filter}")
    
    # Добавляем join с таблицей Member для получения информации об авторе
    query = (
        select(WriteOff)
        .outerjoin(Member, WriteOff.user_id == Member.user_id)
        .where(WriteOff.group_id == group_id)
        .options(selectinload(WriteOff.author_member))  # Загружаем связанного автора
    )
    
    # Добавляем фильтр по дате если он указан
    if date_filter:
        logger.info(f"📅 [CRUD] Добавляем фильтр по дате: {date_filter}")
        query = query.where(WriteOff.date == date_filter)
    else:
        logger.info(f"📅 [CRUD] Фильтр по дате не применяется - запрашиваем все даты")
    
    # Сортируем по дате и времени создания (новые сверху)
    query = query.order_by(WriteOff.date.desc(), WriteOff.created_at.desc())
    
    logger.info(f"🔍 [CRUD] Выполняем запрос к БД...")
    result = await db.execute(query)
    write_offs = result.scalars().all()
    
    logger.info(f"✅ [CRUD] Найдено {len(write_offs)} списаний")
    
    # Логируем детали найденных списаний для отладки
    if write_offs:
        logger.info(f"📋 [CRUD] Детали найденных списаний:")
        for i, wo in enumerate(write_offs):
            author_info = f"author_member: {wo.author_member.first_name if wo.author_member else 'None'}" if hasattr(wo, 'author_member') else "author_member: НЕТ АТРИБУТА"
            logger.info(f"  {i+1}. ID: {wo.id}, name: {wo.name}, date: {wo.date}, user_id: {wo.user_id}, {author_info}")
    else:
        logger.info(f"📋 [CRUD] Списания не найдены")
    
    return write_offs

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