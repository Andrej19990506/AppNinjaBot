from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date, time
import uuid

# Базовая схема для общих полей
class ShiftBase(BaseModel):
    date: date
    shift_type: str # 'day' или 'night' - сохраняем для обратной совместимости
    template_id: Optional[uuid.UUID] = None # ID шаблона смены (новое поле)
    slot_index: int
    group_id: int # ID группы (нашей внутренней)

# Схема для создания новой смены
class ShiftCreate(ShiftBase):
    member_id: int # ID участника (нашей внутренней)

# Схема для представления информации о курьере в смене
class ShiftMemberInfo(BaseModel):
    id: int
    user_id: int # Telegram ID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    is_senior_courier: Optional[bool] = None

    class ConfigDict:
        from_attributes = True

# Схема для представления информации о шаблоне смены
class ShiftTemplateInfo(BaseModel):
    id: uuid.UUID
    name: str
    start_time: time
    end_time: time
    max_slots: int
    has_senior_slot: bool

    class ConfigDict:
        from_attributes = True

# Схема для чтения смены (включая инфо о курьере и шаблоне)
class ShiftRead(ShiftBase):
    id: uuid.UUID # UUID смены
    member: ShiftMemberInfo # Вложенная информация о курьере
    template: Optional[ShiftTemplateInfo] = None # Вложенная информация о шаблоне
    created_at: datetime
    updated_at: datetime

    class ConfigDict:
        from_attributes = True

# Схема для обновления смены (на будущее)
class ShiftUpdate(BaseModel):
    date: Optional[date] = None
    shift_type: Optional[str] = None
    slot_index: Optional[int] = None
    # Не позволяем менять member_id или group_id через этот эндпоинт 