from fastapi import APIRouter, Depends, status, BackgroundTasks, HTTPException, Query, Form, File, UploadFile
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional, Union
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from schemas.write_off import WriteOffResponse, WriteOffCreate, WriteOffUpdate
from services.write_off import get_write_off_service, WriteOffService
from db.session import get_db_session
from services.write_off_service.document_generator import generate_and_send_write_off_report
from models.member import Member
from models.write_off import WriteOff
from sqlalchemy.future import select
import json
import os
import uuid
from pathlib import Path
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["write-offs"])

@router.get("/{group_id}", response_model=List[WriteOffResponse])
async def get_write_offs(
    group_id: int,
    date: Optional[str] = Query(None, description="Фильтр по дате в формате YYYY-MM-DD"),
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    # Преобразуем строковую дату в объект date если она указана
    date_filter = None
    if date:
        try:
            from datetime import datetime
            date_filter = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Неверный формат даты. Используйте YYYY-MM-DD"
            )
    
    return await service.get_write_offs_by_group(db, group_id, date_filter)

@router.get("/photos/{photo_filename}")
async def get_write_off_photo(photo_filename: str):
    """
    Возвращает файл фотографии списания с сервера.
    Если фото не найдено, возвращает 404 ошибку.
    """
    try:
        # Путь к папке с фото списаний
        photos_dir = Path("/app/shared/write_off_photos")
        photo_path = photos_dir / photo_filename
        
        # Проверяем существование файла
        if not photo_path.exists():
            logger.warning(f"Фото списания {photo_filename} не найдено: {photo_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Фото списания {photo_filename} не найдено"
            )
        
        # Определяем MIME тип на основе расширения
        extension = photo_path.suffix.lower()
        if extension in ['.jpg', '.jpeg']:
            media_type = "image/jpeg"
        elif extension == '.png':
            media_type = "image/png"
        elif extension == '.webp':
            media_type = "image/webp"
        else:
            media_type = "image/jpeg"  # По умолчанию
        
        logger.info(f"Возвращаем фото списания {photo_filename}: {photo_path}")
        return FileResponse(
            path=str(photo_path),
            media_type=media_type,
            filename=photo_filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении фото списания {photo_filename}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера при получении фото: {str(e)}"
        )

@router.post("/{group_id}", response_model=WriteOffResponse, status_code=status.HTTP_201_CREATED)
async def create_write_off(
    group_id: int,
    # Для JSON данных
    write_off: Optional[WriteOffCreate] = None,
    # Для Form данных с файлом
    user_id: Optional[int] = Form(None),
    name: Optional[str] = Form(None),
    reason: Optional[str] = Form(None),
    quantity: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    unit_type: Optional[str] = Form('шт'),
    status: Optional[str] = Form('pending'),
    date: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Создает новое списание.
    Поддерживает два формата данных:
    1. JSON (application/json) - для обратной совместимости
    2. Form data (multipart/form-data) - для загрузки фото
    """
    
    # Определяем откуда взять данные
    if write_off is not None:
        # JSON данные
        write_off_data = write_off
        photo_path = None
    else:
        # Form данные
        if not all([user_id, name, reason, quantity]):
            raise HTTPException(
                status_code=422,
                detail="Обязательные поля: user_id, name, reason, quantity"
            )
        
        # Сохраняем фото если есть
        photo_path = None
        if photo:
            # Создаем директорию для фото если не существует
            photos_dir = Path("/app/shared/write_off_photos")
            photos_dir.mkdir(parents=True, exist_ok=True)
            
            # Генерируем уникальное имя файла
            file_extension = photo.filename.split('.')[-1] if '.' in photo.filename else 'jpg'
            photo_filename = f"writeoff_{group_id}_{uuid.uuid4().hex}.{file_extension}"
            photo_path = photos_dir / photo_filename
            
            # Сохраняем файл
            with open(photo_path, "wb") as f:
                content = await photo.read()
                f.write(content)
            
            # Сохраняем только имя файла, а не полный путь
            photo_path = photo_filename
        
        # Создаем объект WriteOffCreate из form данных
        date_obj = None
        if date:
            try:
                from datetime import datetime
                date_obj = datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=422,
                    detail="Неверный формат даты. Используйте YYYY-MM-DD"
                )
        
        write_off_data = WriteOffCreate(
            user_id=user_id,
            name=name,
            reason=reason,
            quantity=quantity,
            description=description,
            unit_type=unit_type,
            status=status,
            photo_path=photo_path,
            date=date_obj
        )
    
    return await service.create_write_off(db, group_id, write_off_data)

@router.put("/{group_id}/{write_off_id}", response_model=WriteOffResponse)
async def update_write_off(
    group_id: int,
    write_off_id: int,
    write_off: WriteOffUpdate,
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    return await service.update_write_off(db, group_id, write_off_id, write_off)

@router.delete("/{group_id}/{write_off_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_write_off(
    group_id: int,
    write_off_id: int,
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    await service.delete_write_off(db, group_id, write_off_id)
    return None

@router.post("/{group_id}/report", status_code=status.HTTP_200_OK)
async def generate_write_off_report(
    group_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Генерирует DOCX-акт списания и отправляет его в чат через бота (без скачивания).
    """
    # Получаем первое списание по группе
    write_off_result = await db.execute(
        select(WriteOff).where(WriteOff.group_id == group_id).order_by(WriteOff.id.asc())
    )
    write_off = write_off_result.scalars().first()
    responsible_first_name = None
    responsible_last_name = None
    if write_off:
        member_result = await db.execute(
            select(Member).where(Member.user_id == write_off.user_id)
        )
        member = member_result.scalars().first()
        if member:
            responsible_first_name = member.first_name
            responsible_last_name = member.last_name
    return await generate_and_send_write_off_report(
        group_id, db, background_tasks,
        responsible_first_name=responsible_first_name,
        responsible_last_name=responsible_last_name
    )

@router.get("/{group_id}/inventory-template")
async def get_inventory_template(group_id: int) -> Dict[str, Any]:
    """
    Возвращает шаблон инвентаря для выбора товаров при списании.
    Загружает данные из inventory_template.json и преобразует в список товаров.
    """
    try:
        # Путь к файлу шаблона относительно корня проекта
        template_path = os.path.join(
            os.path.dirname(__file__), 
            "..", "..", "..", "data", "templates", "inventory_template.json"
        )
        
        # Проверяем существование файла
        if not os.path.exists(template_path):
            raise HTTPException(
                status_code=404, 
                detail="Шаблон инвентаря не найден"
            )
        
        # Загружаем JSON данные
        with open(template_path, 'r', encoding='utf-8') as file:
            template_data = json.load(file)
        
        # Преобразуем данные в список товаров с категориями
        items = []
        for category_name, category_items in template_data.items():
            for item_name, item_data in category_items.items():
                items.append({
                    "name": item_name,
                    "category": category_name
                })
        
        return {
            "items": items,
            "total_count": len(items),
            "categories": list(template_data.keys())
        }
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Ошибка при чтении шаблона инвентаря"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        ) 