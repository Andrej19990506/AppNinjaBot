from fastapi import APIRouter, Depends, status, BackgroundTasks
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from schemas.write_off import WriteOffResponse, WriteOffCreate, WriteOffUpdate
from services.write_off import get_write_off_service, WriteOffService
from db.session import get_db_session
from services.write_off_service.document_generator import generate_and_send_write_off_report
from models.member import Member
from models.write_off import WriteOff
from sqlalchemy.future import select

router = APIRouter(tags=["write-offs"])

@router.get("/{group_id}", response_model=List[WriteOffResponse])
async def get_write_offs(
    group_id: int,
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    return await service.get_write_offs_by_group(db, group_id)

@router.post("/{group_id}", response_model=WriteOffResponse, status_code=status.HTTP_201_CREATED)
async def create_write_off(
    group_id: int,
    write_off: WriteOffCreate,
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    return await service.create_write_off(db, group_id, write_off)

@router.put("/{group_id}/{write_off_id}", response_model=WriteOffResponse)
async def update_write_off(
    group_id: int,
    write_off_id: int,
    write_off: WriteOffUpdate,
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    return await service.update_write_off(db, group_id, write_off_id, write_off)

@router.delete("/{group_id}/{write_off_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_write_off(
    group_id: int,
    write_off_id: int,
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    await service.delete_write_off(db, group_id, write_off_id)
    return None

@router.post("/{group_id}/report", status_code=status.HTTP_200_OK)
async def generate_write_off_report(
    group_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Генерирует DOCX-акт списания и отправляет его в чат через бота (без скачивания).
    """
    # Получаем первое списание по группе
    write_off_result = await db.execute(
        select(WriteOff).where(WriteOff.group_id == group_id).order_by(WriteOff.id.asc())
    )
    write_off = write_off_result.scalars().first()
    responsible_first_name = None
    responsible_last_name = None
    if write_off:
        member_result = await db.execute(
            select(Member).where(Member.user_id == write_off.user_id)
        )
        member = member_result.scalars().first()
        if member:
            responsible_first_name = member.first_name
            responsible_last_name = member.last_name
    return await generate_and_send_write_off_report(
        group_id, db, background_tasks,
        responsible_first_name=responsible_first_name,
        responsible_last_name=responsible_last_name
    ) 