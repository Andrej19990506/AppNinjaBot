from datetime import datetime
from typing import Optional
from pydantic import BaseModel

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