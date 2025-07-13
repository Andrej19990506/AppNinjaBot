from fastapi import APIRouter, Depends, status, BackgroundTasks, HTTPException, Query, Form, File, UploadFile, Body, Request, Response
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
    response: Response,
    date: Optional[str] = Query(None, description="Фильтр по дате в формате YYYY-MM-DD"),
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получает список списаний для группы с опциональной фильтрацией по дате.
    Добавлены заголовки против кэширования для решения проблемы с переключением дат.
    """
    logger.info(f"🔍 [get_write_offs] Запрос списаний для группы {group_id}, дата: {date}")
    
    # Добавляем заголовки против кэширования
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Преобразуем строковую дату в объект date если она указана
    date_filter = None
    if date:
        try:
            from datetime import datetime
            date_filter = datetime.strptime(date, "%Y-%m-%d").date()
            logger.info(f"📅 [get_write_offs] Дата преобразована: {date} -> {date_filter}")
        except ValueError:
            logger.error(f"❌ [get_write_offs] Неверный формат даты: {date}")
            raise HTTPException(
                status_code=400,
                detail="Неверный формат даты. Используйте YYYY-MM-DD"
            )
    
    # Получаем списания из сервиса
    write_offs = await service.get_write_offs_by_group(db, group_id, date_filter)
    logger.info(f"✅ [get_write_offs] Найдено {len(write_offs)} списаний для группы {group_id}")
    
    # Преобразуем данные для правильной сериализации автора
    result = []
    for write_off in write_offs:
        write_off_dict = write_off.__dict__.copy()
        
        # Явно добавляем информацию об авторе
        if hasattr(write_off, 'author_member') and write_off.author_member:
            author_data = {
                'user_id': write_off.author_member.user_id,
                'first_name': write_off.author_member.first_name,
                'last_name': write_off.author_member.last_name,
                'username': write_off.author_member.username,
                'photo_url': write_off.author_member.photo_url
            }
            write_off_dict['author'] = author_data
            logger.info(f"📋 [get_write_offs] Добавлена информация об авторе для списания {write_off.id}: {write_off.author_member.first_name}")
            logger.info(f"📋 [get_write_offs] Данные автора: {author_data}")
        else:
            write_off_dict['author'] = None
            logger.info(f"📋 [get_write_offs] Информация об авторе недоступна для списания {write_off.id}")
        
        # Удаляем внутренние SQLAlchemy поля перед отправкой
        write_off_dict.pop('_sa_instance_state', None)
        write_off_dict.pop('author_member', None)
        
        # Преобразуем datetime объекты в строки для JSON сериализации
        from datetime import datetime, date
        for key, value in write_off_dict.items():
            if isinstance(value, datetime):
                write_off_dict[key] = value.isoformat()
            elif isinstance(value, date):
                write_off_dict[key] = value.isoformat()
        
        result.append(write_off_dict)
    
    logger.info(f"📋 [get_write_offs] Итоговый результат: {len(result)} записей")
    if result:
        logger.info(f"📋 [get_write_offs] Пример первой записи: {result[0]}")
    
    return result

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
    request: Request,
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Создает новое списание.
    Поддерживает два формата данных:
    1. JSON (application/json) - для обратной совместимости
    2. Form data (multipart/form-data) - для загрузки фото
    """
    
    # Определяем тип содержимого
    content_type = request.headers.get("content-type", "")
    logger.info(f"🔍 [create_write_off] Content-Type: {content_type}")
    
    if content_type.startswith("application/json"):
        # JSON данные
        try:
            json_data = await request.json()
            logger.info(f"✅ [create_write_off] Обрабатываем JSON данные: {json_data}")
            
            # Создаем объект WriteOffCreate из JSON
            write_off_data = WriteOffCreate(**json_data)
            photo_path = None
            
        except Exception as e:
            logger.error(f"❌ [create_write_off] Ошибка парсинга JSON: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Ошибка парсинга JSON данных: {str(e)}"
            )
    elif content_type.startswith("multipart/form-data"):
        # Form данные с файлом
        try:
            form_data = await request.form()
            logger.info(f"🔄 [create_write_off] Обрабатываем Form данные: {dict(form_data)}")
            
            # Извлекаем обязательные поля
            user_id = form_data.get("user_id")
            name = form_data.get("name")
            reason = form_data.get("reason")
            quantity = form_data.get("quantity")
            
            # Проверяем обязательные поля
            if not all([user_id, name, reason, quantity]):
                logger.error(f"❌ [create_write_off] Отсутствуют обязательные поля: user_id={user_id}, name={name}, reason={reason}, quantity={quantity}")
                raise HTTPException(
                    status_code=422,
                    detail="Обязательные поля: user_id, name, reason, quantity"
                )
            
            # Обрабатываем фото
            photo_path = None
            photo_file = form_data.get("photo")
            if photo_file and hasattr(photo_file, 'filename'):
                # Создаем директорию для фото если не существует
                photos_dir = Path("/app/shared/write_off_photos")
                photos_dir.mkdir(parents=True, exist_ok=True)
                
                # Генерируем уникальное имя файла
                file_extension = photo_file.filename.split('.')[-1] if '.' in photo_file.filename else 'jpg'
                photo_filename = f"writeoff_{group_id}_{uuid.uuid4().hex}.{file_extension}"
                photo_path_full = photos_dir / photo_filename
                
                # Сохраняем файл
                with open(photo_path_full, "wb") as f:
                    content = await photo_file.read()
                    f.write(content)
                
                # Сохраняем только имя файла
                photo_path = photo_filename
                logger.info(f"📸 [create_write_off] Сохранено фото: {photo_filename}")
            
            # Обрабатываем дату
            date_obj = None
            date_str = form_data.get("date")
            if date_str:
                try:
                    from datetime import datetime
                    date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(
                        status_code=422,
                        detail="Неверный формат даты. Используйте YYYY-MM-DD"
                    )
            
            # Создаем объект WriteOffCreate из form данных
            write_off_data = WriteOffCreate(
                user_id=int(user_id),
                name=name,
                reason=reason,
                quantity=float(quantity),
                description=form_data.get("description") or "",
                unit_type=form_data.get("unit_type") or "шт",
                status=form_data.get("status") or "pending",
                photo_path=photo_path,
                date=date_obj
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ [create_write_off] Ошибка парсинга Form данных: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Ошибка парсинга Form данных: {str(e)}"
            )
    else:
        logger.error(f"❌ [create_write_off] Неподдерживаемый Content-Type: {content_type}")
        raise HTTPException(
            status_code=415,
            detail="Неподдерживаемый тип содержимого. Используйте application/json или multipart/form-data"
        )
    
    logger.info(f"🚀 [create_write_off] Создаем списание: {write_off_data}")
    return await service.create_write_off(db, group_id, write_off_data)

@router.put("/{group_id}/{write_off_id}", response_model=WriteOffResponse)
async def update_write_off(
    group_id: int,
    write_off_id: int,
    request: Request,
    service: WriteOffService = Depends(get_write_off_service),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновляет списание.
    Поддерживает два формата данных:
    1. JSON (application/json) - для обратной совместимости
    2. Form data (multipart/form-data) - для загрузки фото
    """
    
    # Определяем тип содержимого
    content_type = request.headers.get("content-type", "")
    logger.info(f"🔍 [update_write_off] Content-Type: {content_type}")
    
    if content_type.startswith("application/json"):
        # JSON данные
        try:
            json_data = await request.json()
            logger.info(f"✅ [update_write_off] Обрабатываем JSON данные: {json_data}")
            
            # Создаем объект WriteOffUpdate из JSON
            write_off_data = WriteOffUpdate(**json_data)
            
        except Exception as e:
            logger.error(f"❌ [update_write_off] Ошибка парсинга JSON: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Ошибка парсинга JSON данных: {str(e)}"
            )
    elif content_type.startswith("multipart/form-data"):
        # Form данные с файлом
        try:
            form_data = await request.form()
            logger.info(f"🔄 [update_write_off] Обрабатываем Form данные: {dict(form_data)}")
            
            # Обрабатываем фото
            photo_path = None
            photo_file = form_data.get("photo")
            if photo_file and hasattr(photo_file, 'filename'):
                # Создаем директорию для фото если не существует
                photos_dir = Path("/app/shared/write_off_photos")
                photos_dir.mkdir(parents=True, exist_ok=True)
                
                # Генерируем уникальное имя файла
                file_extension = photo_file.filename.split('.')[-1] if '.' in photo_file.filename else 'jpg'
                photo_filename = f"writeoff_{group_id}_{uuid.uuid4().hex}.{file_extension}"
                photo_path_full = photos_dir / photo_filename
                
                # Сохраняем файл
                with open(photo_path_full, "wb") as f:
                    content = await photo_file.read()
                    f.write(content)
                
                # Сохраняем только имя файла
                photo_path = photo_filename
                logger.info(f"📸 [update_write_off] Сохранено фото: {photo_filename}")
            
            # Обрабатываем дату
            date_obj = None
            date_str = form_data.get("date")
            if date_str:
                try:
                    from datetime import datetime
                    date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(
                        status_code=422,
                        detail="Неверный формат даты. Используйте YYYY-MM-DD"
                    )
            
            # Создаем объект WriteOffUpdate из form данных
            update_data = {}
            if form_data.get("name"):
                update_data["name"] = form_data.get("name")
            if form_data.get("reason"):
                update_data["reason"] = form_data.get("reason")
            if form_data.get("quantity"):
                update_data["quantity"] = float(form_data.get("quantity"))
            if form_data.get("description") is not None:
                update_data["description"] = form_data.get("description")
            if form_data.get("unit_type"):
                update_data["unit_type"] = form_data.get("unit_type")
            if form_data.get("status"):
                update_data["status"] = form_data.get("status")
            if photo_path:
                update_data["photo_path"] = photo_path
            if date_obj:
                update_data["date"] = date_obj
            
            write_off_data = WriteOffUpdate(**update_data)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ [update_write_off] Ошибка парсинга Form данных: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Ошибка парсинга Form данных: {str(e)}"
            )
    else:
        logger.error(f"❌ [update_write_off] Неподдерживаемый Content-Type: {content_type}")
        raise HTTPException(
            status_code=415,
            detail="Неподдерживаемый тип содержимого. Используйте application/json или multipart/form-data"
        )
    
    logger.info(f"🚀 [update_write_off] Обновляем списание: {write_off_data}")
    return await service.update_write_off(db, group_id, write_off_id, write_off_data)

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