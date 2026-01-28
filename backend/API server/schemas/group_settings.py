from pydantic import BaseModel, Field
from typing import Optional, List, Literal

# Схема для чтения и ответа (включает group_id)
class GroupSettings(BaseModel):
    group_id: Optional[int] = Field(None, description="Telegram Group ID (для ответа)")

    # Общие настройки (копируем поля из AccessSettings фронтенда)
    allowMultipleShifts: bool = Field(default=False)
    autoApprove: bool = Field(default=False)
    allowSameDay: bool = Field(default=False)

    # Настройки периода регистрации
    registrationStartDay: int = Field(default=4) # Четверг
    registrationStartHour: int = Field(default=12)
    registrationStartMinute: int = Field(default=0)

    # Гибкие настройки периода доступа
    offsetType: Literal['days', 'weeks', 'none'] = Field(default='weeks')
    offsetAmount: int = Field(default=1)
    periodLength: int = Field(default=7)

    # Период активности правила
    isAlwaysActive: bool = Field(default=True)
    activeStartDate: Optional[str] = Field(default=None)
    activeEndDate: Optional[str] = Field(default=None)

    # Старые поля (оставлены для обратной совместимости?)
    daysAhead: Optional[int] = Field(default=14) # 2 недели

    # Список конкретных дат
    enabledDates: Optional[List[str]] = Field(default=None)

    # Персональные ограничения
    restrictedUsers: Optional[List[int]] = Field(default_factory=list) # Используем int для ID

    # Предупреждение о существующих сменах (только в ответе)
    hasExistingShifts: Optional[bool] = Field(default=None, description="Флаг наличия существующих смен при изменении дня регистрации")
    existingShiftsCount: Optional[int] = Field(default=None, description="Количество существующих смен в будущем")
    
    # Стратегия перехода при конфликте (мягкий/жесткий переход)
    transitionStrategy: Optional[Literal['soft', 'hard']] = Field(default=None, description="Стратегия: 'soft' - мягкий переход, 'hard' - жесткий стоп")
    isAccessBlocked: Optional[bool] = Field(default=False, description="Флаг блокировки доступа при жестком стопе")
    nextOpeningDate: Optional[str] = Field(default=None, description="Дата следующего открытия доступа (ISO формат)")
    
    # Статус доступа (вычисляемое поле для UI)
    accessStatus: Optional[Literal['active', 'pending', 'blocked']] = Field(default=None, description="Статус доступа: active/pending/blocked")

    # Метаданные (не храним в этой схеме, т.к. они не часть настроек)
    # lastUpdated: Optional[str] = None
    # updatedBy: Optional[int] = None

    class Config:
        from_attributes = True # Для совместимости с SQLAlchemy

# Схема для обновления (не включает group_id, все поля опциональны)
class GroupSettingsUpdate(BaseModel):
    allowMultipleShifts: Optional[bool] = None
    autoApprove: Optional[bool] = None
    allowSameDay: Optional[bool] = None
    registrationStartDay: Optional[int] = None
    registrationStartHour: Optional[int] = None
    registrationStartMinute: Optional[int] = None
    offsetType: Optional[Literal['days', 'weeks', 'none']] = None
    offsetAmount: Optional[int] = None
    periodLength: Optional[int] = None
    isAlwaysActive: Optional[bool] = None
    activeStartDate: Optional[str] = None
    activeEndDate: Optional[str] = None
    daysAhead: Optional[int] = None
    enabledDates: Optional[List[str]] = None
    restrictedUsers: Optional[List[int]] = None
    transitionStrategy: Optional[Literal['soft', 'hard']] = None
    isAccessBlocked: Optional[bool] = None 