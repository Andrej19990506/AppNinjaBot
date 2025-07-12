from crud import write_off as crud_write_off
from schemas.write_off import WriteOffCreate, WriteOffUpdate
from models.write_off import WriteOff
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date

class WriteOffService:
    async def get_write_offs_by_group(self, db: AsyncSession, group_id: int, date_filter: Optional[date] = None) -> List[WriteOff]:
        return await crud_write_off.get_write_offs_by_group(db, group_id, date_filter)

    async def create_write_off(self, db: AsyncSession, group_id: int, write_off: WriteOffCreate) -> WriteOff:
        return await crud_write_off.create_write_off(db, group_id, write_off)

    async def update_write_off(self, db: AsyncSession, group_id: int, write_off_id: int, write_off: WriteOffUpdate) -> WriteOff:
        return await crud_write_off.update_write_off(db, group_id, write_off_id, write_off)

    async def delete_write_off(self, db: AsyncSession, group_id: int, write_off_id: int) -> None:
        await crud_write_off.delete_write_off(db, group_id, write_off_id)

# Dependency для FastAPI
write_off_service = WriteOffService()
def get_write_off_service() -> WriteOffService:
    return write_off_service 