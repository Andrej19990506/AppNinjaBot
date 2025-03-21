from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class Shift(BaseModel):
    """Модель смены курьера"""
    id: str
    user_id: str
    date: str
    shift_type: str
    slot_index: int
    chat_id: str
    photo_url: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ShiftBase(BaseModel):
    date: str
    shift_type: str
    slot_index: int

class ShiftCreate(ShiftBase):
    user_id: int

class ShiftResponse(ShiftBase):
    id: int
    user_id: int
    avatar_url: Optional[str] = None
    first_name: str
    last_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ShiftDB(ShiftBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 