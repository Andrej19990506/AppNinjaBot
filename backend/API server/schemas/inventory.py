from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Импортируем базовую модель для админа (как в groups.py)
# Убедись, что путь к user правильный
from .user import UserSimple

# Повторно используем определение AdminInfo (или импортируем из groups, если это возможно структурно)
class AdminInfo(UserSimple):
    pass

# Модель для метаданных инвентаря
class InventoryMetadata(BaseModel):
    lastUpdated: Optional[str] = None
    progress: int = 0
    chat_id: str # Строковый ID чата
    start_time: Optional[str] = None # Время начала инвентаризации (когда прогресс стал > 0)

# Основная модель ответа для GET /inventory/{chat_id}
class InventoryData(BaseModel):
    inventory: Dict[str, Any] # Сам инвентарь (пока Any, можно уточнить)
    metadata: InventoryMetadata # Вложенные метаданные
    chat_title: str # Название чата
    admins: List[AdminInfo] # Список админов

    class Config:
        from_attributes = True # Для совместимости с ORM объектами, если нужно 

# Модель для тела запроса POST /inventory/{chat_id}
class InventoryUpdatePayload(BaseModel):
    inventory: Dict[str, Any] # Полная структура инвентаря для сохранения
    metadata: Optional[Dict[str, Any]] = None # Опциональные метаданные (может обновляться и отдельно)
    # Добавляем поле history, так как оно передается с фронта
    history: Optional[Dict[str, Any]] = None 

# Модель для точечного обновления одного товара
class InventoryItemUpdatePayload(BaseModel):
    item: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None
    history: Optional[Dict[str, Any]] = None