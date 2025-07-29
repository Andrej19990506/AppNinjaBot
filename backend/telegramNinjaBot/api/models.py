from pydantic import BaseModel
from typing import Optional, Any

class SendMessagePayload(BaseModel):
    chat_id: str
    text: str
    parse_mode: str = 'HTML'
    reply_markup: Optional[dict[str, Any]] = None 

# Модель для эндпоинта отправки файла
class SendFilePayload(BaseModel):
    target_chat_id: int
    file_path: str
    caption: Optional[str] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None # Ожидаем 1-12 от API
    period_is_weekly: Optional[bool] = None
    period_start_date: Optional[str] = None # YYYY-MM-DD
    period_end_date: Optional[str] = None   # YYYY-MM-DD

# Модель для эндпоинта обновления данных пользователя
class RefreshUserPayload(BaseModel):
    user_id: int

# ---> ДОБАВЛЕНИЕ: Модель для эндпоинта отправки Excel отчета < ---
class SendExcelReportPayload(BaseModel):
    chat_id: str # Принимаем как строку, т.к. API отправляет строку
    file_path: str
# ---> КОНЕЦ ДОБАВЛЕНИЯ < ---

# --- Модель для отправки DOCX write-off отчёта ---
class SendWriteOffReportPayload(BaseModel):
    chat_id: str
    file_path: str
    photos: Optional[list[dict[str, Any]]] = []  # Массив фотографий
    photos_count: Optional[int] = 0
    items_count: Optional[int] = 0
# --- КОНЕЦ МОДЕЛИ ДЛЯ ОТПРАВКИ DOCX write-off отчёта ---

# --- Модель для отправки запроса на добавление товара ---
class SendItemRequestPayload(BaseModel):
    inventory_group_id: str  # ID группы инвентаризации
    chef_group_id: str       # ID chef группы
    chef_group_title: str    # Название chef группы
    item_name: str           # Название товара
    category: str           # Категория товара
    has_semifinished: bool  # Есть ли полуфабрикаты
# --- КОНЕЦ МОДЕЛИ ДЛЯ ОТПРАВКИ ЗАПРОСА НА ДОБАВЛЕНИЕ ТОВАРА ---