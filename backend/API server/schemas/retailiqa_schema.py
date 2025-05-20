from pydantic import BaseModel, Field
from typing import List, Optional, Union, Any

# Pydantic Schemas for RetailiQA API

# /api/v2/report/ related schemas
class RetailiQAReportItem(BaseModel):
    insp_id: str
    insp_date: str
    insp_type: str 
    insp_obj: str  
    insp_obj_id: str 
    task_pt: float 
    task_sum: float
    task_comments: str 
    task_photos: str 
    is_closed: bool
    state_message: str
    insp_completed: Optional[str] = None
    type: Optional[str] = 'ReportItemDefaultType'

    # --- Поля, которые сделаем Optional для теста ---
    insp_date_plan: Optional[str] = None
    insp_date_plan_iso: Optional[str] = None
    insp_date_closed: Optional[str] = None 
    insp_date_closed_plan: Optional[str] = None
    insp_started: Optional[str] = None
    insp_obj_code: Optional[str] = None
    insp_obj_region: Optional[str] = None
    insp_obj_visited: Optional[str] = None
    insp_schedule: Optional[str] = None
    insp_type_id: Optional[str] = None
    insp_inspector: Optional[str] = None
    inspector_id: Optional[str] = None
    scope_id: Optional[str] = None
    insp_category: Optional[str] = None
    insp_scope: Optional[str] = None 
    scope_description: Optional[str] = None
    task_vp: Optional[float] = None 
    task_counter: Optional[int] = None
    task_answer: Optional[str] = None
    task_files: Optional[str] = None
    insp_supervisor: Optional[str] = None
    supervisor_id: Optional[str] = None
    insp_serial_no: Optional[str] = None
    scope_tags: Optional[List[str]] = None
    task_npp: Optional[int] = None
    scope_type: Optional[str] = None 
    managers_list: Optional[List[Any]] = None 
    is_auto_closed: Optional[bool] = None
    content_type: Optional[int] = None # <--- ДЕЛАЕМ НЕОБЯЗАТЕЛЬНЫМ
    insp_api_id: Optional[str] = None

    class Config:
        extra = "ignore"  # Игнорируем лишние поля в ответе API
        populate_by_name = True  # Разрешаем заполнение по имени поля

class RetailiQAReportResult(BaseModel):
    result: List[RetailiQAReportItem]
    type: Optional[str] = 'ReportResultDefaultType'
    # meta: Optional[Dict[str, Any]] = None # Если meta может быть в этом объекте
    
    class Config:
        extra = "ignore"
        populate_by_name = True

class RetailiQAReportApiResponse(BaseModel):
    result: RetailiQAReportResult
    type: Optional[str] = 'ReportApiResponseDefaultType'
    # meta: Optional[Dict[str, Any]] = None # Если meta может быть на верхнем уровне
    
    class Config:
        extra = "ignore"
        populate_by_name = True

# /api/v2/check_objects/ related schemas
class RetailiQACheckObjectRegion(BaseModel):
    id: str
    name: str
    inspector: Optional[str] = None
    district: Optional[str] = None
    timezone: str
    uid: str
    
    class Config:
        extra = "ignore"
        populate_by_name = True

class RetailiQACheckObjectSigner(BaseModel):
    id: str
    fio: str
    uid: str
    
    class Config:
        extra = "ignore"
        populate_by_name = True

class RetailiQACheckObjectInspector(BaseModel):
    id: str
    fio: str
    uid: str
    
    class Config:
        extra = "ignore"
        populate_by_name = True

class RetailiQACheckObject(BaseModel):
    id: str
    api_id: Optional[str] = None
    name: str
    address: str
    location: List[float] # Список из двух float чисел
    region: RetailiQACheckObjectRegion
    signers: List[RetailiQACheckObjectSigner]
    inspectionType: str # ID типа инспекции
    inspector: List[RetailiQACheckObjectInspector]
    supervisor: Optional[str] = None # или модель, если структура известна
    additional_supervisors: List[RetailiQACheckObjectInspector]
    format: Optional[str] = None # или модель, если структура известна
    uid: str
    managers: List[Any] # Используем Any, если структура неизвестна
    
    class Config:
        extra = "ignore"
        populate_by_name = True

class RetailiQACheckObjectsMeta(BaseModel):
    limit: int
    offset: int
    count: int
    
    class Config:
        extra = "ignore"
        populate_by_name = True

class RetailiQACheckObjectsApiResponse(BaseModel):
    result: List[RetailiQACheckObject]
    meta: RetailiQACheckObjectsMeta 
    
    class Config:
        extra = "ignore"
        populate_by_name = True 