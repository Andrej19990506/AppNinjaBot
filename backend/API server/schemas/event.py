# backend/API server/api/v1/schemas/event.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal, Any
from datetime import datetime
import uuid

# Новая схема для детализированного нарушения
class DetailedViolation(BaseModel):
    title: str = Field(..., description="Название пункта нарушения (insp_scope)")
    text: Optional[str] = Field(None, description="Текст комментария к нарушению (task_comments)")
    penalty: float = Field(..., description="Штрафные баллы за данный пункт (task_sum)")
    photos: Optional[List[str]] = Field(None, description="Список URL фотографий для данного нарушения")
    type: Optional[str] = Field(None, description="Тип пункта: 'нарушение' или 'замечание'")
    
    class Config:
        from_attributes = True
    
    def dict(self, **kwargs):
        """Метод для конвертации объекта в словарь для сериализации"""
        data = {}
        if hasattr(super(), 'model_dump'):
            data = super().model_dump(**kwargs)
        else:
            data = super().dict(**kwargs)
        
        data['photos'] = data.get('photos') or []
        if data.get('type') is None:
            data['type'] = 'нарушение' if data.get('penalty', 0) > 0 else 'замечание'
        return data
        
    def model_dump(self, **kwargs):
        """Метод для конвертации объекта в словарь для сериализации"""
        return self.dict(**kwargs)

# --- Модели для Настроек Повтора ---
class RepeatSettingsBase(BaseModel):
    type: Literal['none', 'daily', 'weekly', 'monthly'] = 'none'
    weekdays: Optional[List[int]] = Field(None, description="Дни недели (0=Пн, 6=Вс) для еженедельного повтора")
    month_day: Optional[int] = Field(None, ge=1, le=31, description="День месяца для ежемесячного повтора")

    @validator('weekdays', always=True)
    def check_weekdays(cls, v, values):
        if values.get('type') == 'weekly' and not v:
            raise ValueError("Для еженедельного повтора необходимо указать 'weekdays'")
        if values.get('type') != 'weekly' and v:
            return None # Очищаем, если тип не weekly
        if v and not all(0 <= day <= 6 for day in v):
             raise ValueError("Дни недели должны быть в диапазоне от 0 до 6")
        return v

    @validator('month_day', always=True)
    def check_month_day(cls, v, values):
        if values.get('type') == 'monthly' and v is None:
            raise ValueError("Для ежемесячного повтора необходимо указать 'month_day'")
        if values.get('type') != 'monthly' and v is not None:
            return None # Очищаем, если тип не monthly
        return v

class RepeatSettingsCreate(RepeatSettingsBase):
    pass

class RepeatSettingsRead(RepeatSettingsBase):
    class Config:
        from_attributes = True

# --- Модели для Уведомлений ---
class NotificationBase(BaseModel):
    message: str = Field(..., max_length=10000)
    time: int = Field(..., ge=0, description="Время уведомления в минутах до события")
    repeat: RepeatSettingsBase = Field(default_factory=RepeatSettingsBase)
    chat_ids: List[int] = []
    requires_confirmation: bool = Field(False, description="Требуется ли подтверждение в чате?")
    # Новые поля для управления временем уведомления
    use_absolute_time: bool = Field(False, description="Использовать абсолютное время вместо относительного")
    absolute_time: Optional[datetime] = Field(None, description="Абсолютное время для отправки уведомления")
    send_now: bool = Field(False, description="Отправить уведомление немедленно после создания")

class NotificationCreate(NotificationBase):
    repeat: RepeatSettingsCreate = Field(default_factory=RepeatSettingsCreate)
    
    @validator('time', pre=True)
    def validate_time(cls, v, values):
        # Для абсолютного времени или немедленной отправки time может быть произвольным
        if values.get('use_absolute_time') or values.get('send_now'):
            return v or 0  # Возвращаем значение или 0 по умолчанию
        # Для относительного времени time должен быть положительным числом
        return v

    @validator('absolute_time', pre=True)
    def validate_absolute_time(cls, v, values):
        # Для режима абсолютного времени должно быть указано absolute_time
        if values.get('use_absolute_time') and v is None:
            raise ValueError("Для режима абсолютного времени необходимо указать 'absolute_time'")
        return v

class NotificationRead(NotificationBase):
    id: uuid.UUID
    event_id: int
    repeat: Optional[RepeatSettingsRead] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    requires_confirmation: bool
    
    class Config:
        from_attributes = True

# <<< ДОБАВЛЕНО: Схема для обновления уведомления >>>
class NotificationUpdate(NotificationBase):
    # Делаем все поля базового класса опциональными для частичного обновления
    message: Optional[str] = Field(None, max_length=10000)
    time: Optional[int] = Field(None, ge=0)
    # repeat и chat_ids тоже могут быть опциональными
    repeat: Optional[RepeatSettingsCreate] = None # Используем Create, так как можем передать настройки
    chat_ids: Optional[List[int]] = None
    requires_confirmation: Optional[bool] = None # None означает "не изменять"
    # Новые поля также должны быть опциональными
    use_absolute_time: Optional[bool] = None
    absolute_time: Optional[datetime] = None
    send_now: Optional[bool] = None
    
    @validator('time', pre=True)
    def validate_time(cls, v, values):
        # Для абсолютного времени или немедленной отправки time может быть произвольным
        if values.get('use_absolute_time') or values.get('send_now'):
            return v or 0  # Возвращаем значение или 0 по умолчанию
        # Для относительного времени time должен быть положительным числом
        return v

    @validator('absolute_time', pre=True)
    def validate_absolute_time(cls, v, values):
        # Для режима абсолютного времени должно быть указано absolute_time
        if values.get('use_absolute_time') and v is None:
            raise ValueError("Для режима абсолютного времени необходимо указать 'absolute_time'")
        return v

# --- Модели для Статуса Планирования ---
class SchedulingStatus(BaseModel):
    active: bool = True

# --- Основные Модели События ---
class EventBase(BaseModel):
    description: Optional[str] = Field(None, max_length=1000)
    date: Optional[datetime] = None

    # --- Поля для типа события и интеграции с RetailiQA (АТО) ---
    event_type: Optional[str] = Field(None, description="Тип события, например: АТО, Зарплата")
    retailiqa_insp_id: Optional[str] = Field(None, description="ID проверки из RetailiQA")
    retailiqa_insp_obj_id: Optional[str] = Field(None, description="ID объекта проверки из RetailiQA")
    retailiqa_insp_obj_name: Optional[str] = Field(None, description="Название объекта проверки")
    retailiqa_total_points: Optional[float] = Field(None, description="Общий набранный балл АТО")
    retailiqa_penalty_points: Optional[float] = Field(None, description="Общий штрафной балл АТО")
    retailiqa_comments: Optional[List[Any]] = Field(None, description="Замечания АТО (список строк или объектов)")
    retailiqa_photos: Optional[List[str]] = Field(None, description="Фото АТО (список URL)")
    # --- Новые поля для результатов проверки RetailiQA ---
    retailiqa_score_percentage: Optional[float] = Field(None, description="Процент выполнения проверки")
    retailiqa_max_points: Optional[float] = Field(None, description="Максимально возможные баллы")
    retailiqa_earned_points: Optional[float] = Field(None, description="Набранные баллы")
    # --- Параметры для управления уведомлениями RetailiQA ---
    create_retailiqa_result_notification: Optional[bool] = Field(False, description="Создать одноразовое уведомление с результатами проверки RetailiQA")
    create_retailiqa_daily_reminder: Optional[bool] = Field(False, description="Создать ежедневное напоминание о проверке проблемных пунктов")
    # --- Конец полей для RetailiQA ---

    # <<< Добавляем новые поля в EventBase >>>
    retailiqa_detailed_violations: Optional[List[DetailedViolation]] = Field(None, description="Список детализированных нарушений из RetailiQA")
    retailiqa_violation_count: Optional[int] = Field(None, description="Количество нарушений в отчете RetailiQA")
    # --- Новое поле ---
    group_type: Optional[str] = Field(None, description="Тип группы (chef, courier, admin и т.д.)")

class EventCreate(EventBase):
    description: str = Field(..., max_length=1000)
    date: datetime
    # group_type уже унаследовано

class EventUpdate(EventBase):
    pass

class EventRead(EventBase):
    id: int
    description: str
    date: datetime
    notifications: List[NotificationRead] = []
    scheduling_status: SchedulingStatus
    last_check: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True 