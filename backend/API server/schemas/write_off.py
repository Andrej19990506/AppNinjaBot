from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class WriteOffBase(BaseModel):
    user_id: int = Field(..., description="ID пользователя (BigInt)")
    name: str = Field(..., description="Название списания")
    reason: str = Field(..., description="Причина списания")
    quantity: float = Field(..., description="Количество")
    description: Optional[str] = Field(None, description="Описание")
    unit_type: Literal['шт', 'гр'] = Field('шт', description="Единица измерения")
    status: str = Field('pending', description="Статус списания")

class WriteOffCreate(WriteOffBase):
    pass

class WriteOffUpdate(BaseModel):
    name: Optional[str] = None
    reason: Optional[str] = None
    quantity: Optional[float] = None
    description: Optional[str] = None
    unit_type: Optional[Literal['шт', 'гр']] = None
    status: Optional[str] = None

class WriteOffInDB(WriteOffBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class WriteOffResponse(WriteOffInDB):
    pass 