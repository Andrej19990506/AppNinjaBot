# backend/API server/schemas/competition.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class CompetitionStatus(str, Enum):
    DRAFT = "draft"
    ANNOUNCEMENT = "announcement"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# --- Победители ---
class WinnerBase(BaseModel):
    place: int = Field(..., ge=1)
    prize: Optional[str] = None
    user_name: Optional[str] = None
    user_position: Optional[str] = None
    user_department: Optional[str] = None
    winner_data: Optional[Dict[str, Any]] = None

class WinnerCreate(WinnerBase):
    user_id: Optional[int] = None
    group_id: Optional[int] = None
    long_term_status: Optional[bool] = False
    status_expires_at: Optional[datetime] = None
    
    @validator('user_id', 'group_id')
    def validate_winner_identifier(cls, v, values):
        # Проверяем, что хотя бы одно из полей user_id или group_id заполнено
        if 'user_id' in values and values['user_id'] is not None:
            return v
        if 'group_id' in values and values['group_id'] is not None:
            return v
        if v is not None:
            return v
        raise ValueError('Должен быть указан либо user_id, либо group_id')

class WinnerUpdate(BaseModel):
    place: Optional[int] = Field(None, ge=1)
    prize: Optional[str] = None
    user_name: Optional[str] = None
    user_position: Optional[str] = None
    user_department: Optional[str] = None
    winner_data: Optional[Dict[str, Any]] = None
    long_term_status: Optional[bool] = None
    status_expires_at: Optional[datetime] = None

class WinnerInDB(WinnerBase):
    id: int
    competition_id: int
    user_id: Optional[int] = None
    group_id: Optional[int] = None
    announced_at: datetime

    class Config:
        from_attributes = True

class WinnerResponse(WinnerInDB):
    pass

# --- Базовые схемы ---
class CompetitionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    full_description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    registration_deadline: Optional[datetime] = None
    prize: Optional[str] = None
    max_participants: Optional[int] = Field(None, ge=1)
    competition_data: Optional[Dict[str, Any]] = None
    rules: Optional[List[str]] = None
    victory_description: Optional[str] = None
    target_groups: Optional[List[str]] = None
    target_chat_ids: Optional[List[int]] = None
    images: Optional[List[str]] = None
    attachments: Optional[List[str]] = None

class CompetitionCreate(CompetitionBase):
    pass

class CompetitionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    full_description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    prize: Optional[str] = None
    max_participants: Optional[int] = Field(None, ge=1)
    competition_data: Optional[Dict[str, Any]] = None
    rules: Optional[List[str]] = None
    victory_description: Optional[str] = None
    target_groups: Optional[List[str]] = None
    target_chat_ids: Optional[List[int]] = None
    images: Optional[List[str]] = None
    attachments: Optional[List[str]] = None
    status: Optional[CompetitionStatus] = None

class CompetitionInDB(CompetitionBase):
    id: int
    status: CompetitionStatus
    current_participants: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CompetitionResponse(CompetitionInDB):
    winners: List[WinnerResponse] = []

# --- Участники ---
class ParticipantBase(BaseModel):
    user_name: Optional[str] = None
    user_position: Optional[str] = None
    user_department: Optional[str] = None
    participant_data: Optional[Dict[str, Any]] = None

class ParticipantCreate(ParticipantBase):
    user_id: int

class ParticipantUpdate(BaseModel):
    status: Optional[str] = None
    user_name: Optional[str] = None
    user_position: Optional[str] = None
    user_department: Optional[str] = None
    participant_data: Optional[Dict[str, Any]] = None

class ParticipantInDB(ParticipantBase):
    id: int
    competition_id: int
    user_id: int
    status: str
    registered_at: datetime
    updated_at: datetime
    result_score: Optional[int] = None
    result_time: Optional[int] = None
    ranking_position: Optional[int] = None
    video_url: Optional[str] = None
    class Config:
        from_attributes = True

class ParticipantResponse(ParticipantInDB):
    pass

class ParticipantResultUpdate(BaseModel):
    result_score: Optional[int] = None
    result_time: Optional[int] = None

class ParticipantResultUpdateWithUserId(ParticipantResultUpdate):
    user_id: int
    video_url: Optional[str] = None

# --- Детальная информация о конкурсе ---
class CompetitionDetail(CompetitionResponse):
    participants: List[ParticipantResponse] = []
    winners: List[WinnerResponse] = []

# --- Списки ---
class CompetitionList(BaseModel):
    competitions: List[CompetitionResponse]
    total: int
    page: int
    size: int

class ParticipantList(BaseModel):
    participants: List[ParticipantResponse]
    total: int
    page: int
    size: int

class WinnerList(BaseModel):
    winners: List[WinnerResponse]
    total: int
    page: int
    size: int

# --- Фильтры ---
class CompetitionFilter(BaseModel):
    status: Optional[CompetitionStatus] = None
    created_by: Optional[int] = None
    target_groups: Optional[List[str]] = None
    start_date_from: Optional[datetime] = None
    start_date_to: Optional[datetime] = None
    end_date_from: Optional[datetime] = None
    end_date_to: Optional[datetime] = None
    search: Optional[str] = None

# --- Статистика ---
class CompetitionStats(BaseModel):
    total_competitions: int
    active_competitions: int
    completed_competitions: int
    total_participants: int
    total_winners: int 