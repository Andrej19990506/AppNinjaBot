import json
import logging
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Union

logger = logging.getLogger(__name__)

class SchedulerTaskDB(BaseModel):
    """Модель задачи планировщика для хранения и сериализации"""
    task_id: str = Field(..., description="Уникальный идентификатор задачи")
    chat_id: Optional[str] = Field(None, description="ID чата/группы, к которому относится задача")
    task_type: str = Field(..., description="Тип задачи (courier_shift_access, registration_open_event, и т.д.)")
    next_run_time: datetime = Field(..., description="Время следующего запуска задачи")
    data: Dict[str, Any] = Field(default_factory=dict, description="Дополнительные данные задачи")
    status: str = Field("scheduled", description="Статус задачи (scheduled, completed, error)")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SchedulerTaskDB':
        """Создает экземпляр задачи из словаря"""
        # Преобразуем next_run_time из строки в datetime, если нужно
        if isinstance(data.get('next_run_time'), str):
            data['next_run_time'] = datetime.fromisoformat(data['next_run_time'])
        
        # Преобразуем данные created_at и updated_at, если они есть
        for field in ['created_at', 'updated_at']:
            if field in data and isinstance(data[field], str):
                data[field] = datetime.fromisoformat(data[field])
            elif field not in data:
                data[field] = datetime.now(timezone.utc)
        
        return cls(**data)

    def to_dict(self) -> Dict[str, Any]:
        """Преобразует объект в словарь для сохранения в БД"""
        result = self.dict()
        # Преобразуем datetime в строку ISO-формата для совместимости с JSON
        for field in ['next_run_time', 'created_at', 'updated_at']:
            if field in result and result[field]:
                result[field] = result[field].isoformat()
        return result 