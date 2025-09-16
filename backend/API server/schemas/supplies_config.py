from pydantic import BaseModel, Field
from typing import Optional, List

class SuppliesConfig(BaseModel):
    """
    Схема для конфигурации поставок филиала
    """
    spreadsheet_id: str = Field(..., description="ID Google Sheets таблицы")
    default_sheet_pattern: str = Field(default="{month}-25", description="Паттерн для названия листа (например: {month}-25)")
    branch_name: str = Field(..., description="Название филиала")
    
    # Дополнительные настройки
    start_row: Optional[int] = Field(default=2, description="Стартовая строка для чтения данных")
    header_row: Optional[int] = Field(default=1, description="Строка с заголовками")
    
    # Опциональные настройки для кастомизации генерации месяцев
    months_range_back: Optional[int] = Field(default=2, description="Сколько месяцев назад показывать")
    months_range_forward: Optional[int] = Field(default=2, description="Сколько месяцев вперед показывать")
    
    class Config:
        json_schema_extra = {
            "example": {
                "spreadsheet_id": "1DcfcGqNxX_ZFF994YP6scXnK21NFYjQBQi29g0hHCJE",
                "default_sheet_pattern": "{month}-25",
                "branch_name": "Свердловская",
                "start_row": 2,
                "header_row": 1,
                "months_range_back": 2,
                "months_range_forward": 2
            }
        }

class SuppliesConfigCreate(SuppliesConfig):
    """Схема для создания конфигурации поставок"""
    pass

class SuppliesConfigUpdate(BaseModel):
    """Схема для обновления конфигурации поставок"""
    spreadsheet_id: Optional[str] = None
    default_sheet_pattern: Optional[str] = None
    branch_name: Optional[str] = None
    start_row: Optional[int] = None
    header_row: Optional[int] = None
    months_range_back: Optional[int] = None
    months_range_forward: Optional[int] = None
