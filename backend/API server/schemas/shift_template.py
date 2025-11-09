from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Annotated
from datetime import datetime, time
import uuid

# Базовая схема для общих полей шаблона смены
class ShiftTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Название шаблона смены")
    description: Optional[str] = Field(None, max_length=1000, description="Описание шаблона")
    start_time: time = Field(..., description="Время начала смены")
    end_time: time = Field(..., description="Время окончания смены")
    max_slots: int = Field(..., ge=1, le=50, description="Максимальное количество слотов")
    has_senior_slot: bool = Field(False, description="Есть ли слот для старшего курьера")
    template_metadata: Optional[Dict[str, Any]] = Field(None, description="Дополнительные метаданные")
    days_of_week: List[int] = Field(default_factory=list, description="Дни недели (0-6, где 0 = воскресенье)")

# Схема для создания нового шаблона смены
class ShiftTemplateCreate(ShiftTemplateBase):
    group_id: Optional[int] = Field(None, description="ID группы (chat_id) - устанавливается автоматически")

# Схема для обновления шаблона смены
class ShiftTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    max_slots: Optional[int] = Field(None, ge=1, le=50)
    has_senior_slot: Optional[bool] = None
    template_metadata: Optional[Dict[str, Any]] = None

# Схема для чтения шаблона смены
class ShiftTemplateRead(ShiftTemplateBase):
    id: uuid.UUID = Field(..., description="Уникальный идентификатор шаблона")
    group_id: int = Field(..., description="ID группы")
    created_at: datetime = Field(..., description="Время создания")
    updated_at: datetime = Field(..., description="Время последнего обновления")

    class ConfigDict:
        from_attributes = True

# Схема для ответа со списком шаблонов
class ShiftTemplateListResponse(BaseModel):
    templates: List[ShiftTemplateRead] = Field(..., description="Список шаблонов смен")

# Схема для применения шаблонов к дням недели
class ShiftTemplateApplyPayload(BaseModel):
    template_ids: List[uuid.UUID] = Field(..., description="Список ID шаблонов для применения")
    days_of_week: List[Annotated[int, Field(ge=0, le=6)]] = Field(..., description="Дни недели (0-6, где 0=понедельник)")

# Схема для связи шаблона с днем недели
class ShiftTemplateDayBase(BaseModel):
    template_id: uuid.UUID = Field(..., description="ID шаблона смены")
    group_id: int = Field(..., description="ID группы")
    day_of_week: Annotated[int, Field(ge=0, le=6)] = Field(..., description="День недели (0-6)")

class ShiftTemplateDayCreate(ShiftTemplateDayBase):
    pass

class ShiftTemplateDayRead(ShiftTemplateDayBase):
    id: uuid.UUID = Field(..., description="Уникальный идентификатор")
    created_at: datetime = Field(..., description="Время создания")
    updated_at: datetime = Field(..., description="Время последнего обновления")

    class ConfigDict:
        from_attributes = True

# Схема для получения шаблонов по дням недели
class ShiftTemplatesByDayResponse(BaseModel):
    day_of_week: int = Field(..., description="День недели")
    templates: List[ShiftTemplateRead] = Field(..., description="Шаблоны для этого дня")

# Схема для массового применения шаблонов
class BulkApplyTemplatesPayload(BaseModel):
    group_id: int = Field(..., description="ID группы")
    applications: List[ShiftTemplateApplyPayload] = Field(..., description="Список применений шаблонов")

# Схема для удаления шаблонов с дней
class RemoveTemplatesFromDaysPayload(BaseModel):
    template_ids: List[uuid.UUID] = Field(..., description="Список ID шаблонов для удаления")
    days_of_week: List[Annotated[int, Field(ge=0, le=6)]] = Field(..., description="Дни недели")

# Схема для клонирования шаблона
class CloneTemplatePayload(BaseModel):
    source_template_id: uuid.UUID = Field(..., description="ID исходного шаблона")
    new_name: str = Field(..., min_length=1, max_length=255, description="Название нового шаблона")
    group_id: int = Field(..., description="ID группы для нового шаблона")
