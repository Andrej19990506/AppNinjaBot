from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import and_
from typing import List, Optional
from uuid import UUID
import logging

from db.session import get_db_session
from models.shift_template import ShiftTemplate, ShiftTemplateDay
from schemas.shift_template import (
    ShiftTemplateCreate,
    ShiftTemplateUpdate,
    ShiftTemplateRead,
    ShiftTemplateListResponse,
    ShiftTemplateApplyPayload,
    ShiftTemplatesByDayResponse,
    RemoveTemplatesFromDaysPayload,
    CloneTemplatePayload
)
from crud import shift_template as crud_shift_template
from models.group import Group
from services.migration_service import MigrationService

# Инициализируем логгер
logger = logging.getLogger(__name__)

# Создаем роутер
router = APIRouter()

# === Эндпоинты для шаблонов смен ===

@router.post("/", response_model=List[ShiftTemplateRead], status_code=status.HTTP_201_CREATED)
async def create_shift_template(
    *,
    db: AsyncSession = Depends(get_db_session),
    chat_id: int = Query(..., description="ID чата (group_id)"),
    template_data: ShiftTemplateCreate
):
    """Создает новый шаблон смены."""
    try:
        # Получаем группу по chat_id
        group_result = await db.execute(
            select(Group).where(Group.group_id == chat_id)
        )
        group = group_result.scalars().first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Группа не найдена"
            )
        
        # Обновляем template_data с правильным group_id
        template_data.group_id = group.id
        
        # Создаем шаблоны (для каждого дня недели создается отдельный шаблон)
        templates = await crud_shift_template.create_shift_template(
            db, template_data=template_data
        )
        
        logger.info(f"Created {len(templates)} shift template(s) for chat_id {chat_id}")
        
        # Преобразуем список шаблонов в список ShiftTemplateRead
        templates_list = []
        for template in templates:
            template_dict = {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "start_time": template.start_time,
                "end_time": template.end_time,
                "max_slots": template.max_slots,
                "has_senior_slot": template.has_senior_slot,
                "template_metadata": template.template_metadata,
                "group_id": template.group_id,
                "created_at": template.created_at,
                "updated_at": template.updated_at
            }
            templates_list.append(ShiftTemplateRead(**template_dict))
        
        # Возвращаем список шаблонов
        return templates_list
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating shift template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании шаблона смены"
        )

@router.get("/", response_model=ShiftTemplateListResponse)
async def get_shift_templates_by_group(
    *,
    db: AsyncSession = Depends(get_db_session),
    chat_id: int = Query(..., description="ID чата (group_id)")
):
    """Получает все шаблоны смен для группы."""
    try:
        # Получаем группу по chat_id (group_id в таблице groups)
        group_result = await db.execute(
            select(Group).where(Group.group_id == chat_id)
        )
        group = group_result.scalars().first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Группа не найдена"
            )
        
        templates = await crud_shift_template.get_shift_templates_by_group(
            db, group_id=group.id
        )
        
        # Если шаблонов нет, автоматически выполняем миграцию
        if not templates:
            try:
                logger.info(f"No templates found for group {group.id}, starting migration...")
                
                # Выполняем миграцию
                result = await MigrationService.migrate_group_to_templates(db, group.id)
                logger.info(f"Migration completed: {result}")
                
                # Получаем шаблоны после миграции
                templates = await crud_shift_template.get_shift_templates_by_group(
                    db, group_id=group.id
                )
            except Exception as migration_error:
                logger.error(f"Migration failed for group {group.id}: {str(migration_error)}")
                # Продолжаем работу без миграции
        
        # Если шаблоны есть, но у них нет связей с днями недели, выполняем миграцию
        if templates:
            templates_without_days = [t for t in templates if not t.days or len(t.days) == 0]
            if templates_without_days:
                logger.info(f"Found {len(templates_without_days)} templates without days of week, running migration...")
                try:
                    result = await MigrationService.migrate_group_to_templates(db, group.id)
                    logger.info(f"Migration completed: {result}")
                    
                    # Получаем шаблоны после миграции
                    templates = await crud_shift_template.get_shift_templates_by_group(
                        db, group_id=group.id
                    )
                except Exception as migration_error:
                    logger.error(f"Migration failed for group {group.id}: {str(migration_error)}")
                    # Продолжаем работу без миграции
        
        # Преобразуем SQLAlchemy объекты в Pydantic модели
        template_reads = []
        for template in templates:
            # Получаем дни недели из связи
            days_of_week = [day.day_of_week for day in template.days] if template.days else []
            
            template_dict = {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "start_time": template.start_time,
                "end_time": template.end_time,
                "max_slots": template.max_slots,
                "has_senior_slot": template.has_senior_slot,
                "template_metadata": template.template_metadata,
                "days_of_week": days_of_week,
                "group_id": template.group_id,
                "created_at": template.created_at,
                "updated_at": template.updated_at
            }
            template_read = ShiftTemplateRead(**template_dict)
            template_reads.append(template_read)
        
        return ShiftTemplateListResponse(templates=template_reads)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching shift templates for chat_id {chat_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении шаблонов смен"
        )

@router.get("/applied", response_model=dict)
async def get_applied_templates_for_all_days(
    *,
    db: AsyncSession = Depends(get_db_session),
    chat_id: int = Query(..., description="ID чата (group_id)"),
    for_date: Optional[str] = Query(None, description="Дата для определения версии шаблона (YYYY-MM-DD). Если не указана, используется текущая дата.")
):
    """Получает примененные шаблоны смен для всех дней недели.
    
    Параметр for_date позволяет указать дату, для которой нужно определить актуальную версию шаблона.
    Это важно, когда пользователь смотрит на будущие даты в календаре.
    """
    try:
        # Получаем группу по chat_id
        group_result = await db.execute(
            select(Group).where(Group.group_id == chat_id)
        )
        group = group_result.scalars().first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Группа не найдена"
            )
        
        # Получаем все шаблоны для группы с их днями
        templates_result = await db.execute(
            select(ShiftTemplate)
            .where(ShiftTemplate.group_id == group.id)
            .options(selectinload(ShiftTemplate.days))
        )
        templates = templates_result.scalars().all()
        
        # Группируем шаблоны по дням недели
        templates_by_day = {i: [] for i in range(7)}
        
        logger.info(f"Found {len(templates)} templates for group {group.id}")
        
        # Определяем дату для версии шаблона
        from datetime import date as date_type, datetime
        if for_date:
            try:
                version_date = datetime.strptime(for_date, "%Y-%m-%d").date()
                logger.info(f"Using version date: {version_date} (from parameter)")
            except ValueError:
                logger.warning(f"Invalid for_date format: {for_date}, using today")
                version_date = date_type.today()
        else:
            version_date = date_type.today()
            logger.info(f"Using version date: {version_date} (today, no parameter)")
        
        for template in templates:
            logger.info(f"Template {template.name} has {len(template.days)} days: {[d.day_of_week for d in template.days]}")
            
            # Получаем актуальную версию шаблона для текущей даты
            from crud import shift_template as crud_shift_template
            from models.shift_template import ShiftTemplateVersion
            
            version = await crud_shift_template.get_template_version_for_date(
                db,
                template_id=template.id,
                shift_date=version_date
            )
            
            # Логируем информацию о версии
            if version:
                logger.info(f"Template {template.name} (id={template.id}) has active version for date {version_date}: max_slots={version.max_slots}, valid_from={version.valid_from_date}, valid_to={version.valid_to_date}")
            else:
                # Проверяем, есть ли будущая версия
                future_version_result = await db.execute(
                    select(ShiftTemplateVersion)
                    .where(
                        and_(
                            ShiftTemplateVersion.template_id == template.id,
                            ShiftTemplateVersion.valid_from_date > version_date
                        )
                    )
                    .order_by(ShiftTemplateVersion.valid_from_date.asc())
                )
                future_version = future_version_result.scalars().first()
                if future_version:
                    logger.info(f"Template {template.name} (id={template.id}) has future version: max_slots={future_version.max_slots}, valid_from={future_version.valid_from_date}, but using base template (max_slots={template.max_slots}) for date {version_date}")
                else:
                    logger.info(f"Template {template.name} (id={template.id}) has no versions, using base template: max_slots={template.max_slots}")
            
            # Используем данные из версии, если она существует, иначе из базового шаблона
            effective_max_slots = version.max_slots if version else template.max_slots
            effective_start_time = version.start_time if version else template.start_time
            effective_end_time = version.end_time if version else template.end_time
            effective_has_senior_slot = version.has_senior_slot if version else template.has_senior_slot
            
            logger.info(f"Template {template.name} (id={template.id}): using max_slots={effective_max_slots} (version={version is not None}, base={template.max_slots})")
            
            for template_day in template.days:
                # Показываем только активные шаблоны
                if not template_day.is_active:
                    continue
                
                # Проверяем, не деактивирован ли шаблон для этой даты
                if template_day.deactivate_from_date and version_date >= template_day.deactivate_from_date:
                    # Шаблон должен быть деактивирован для этой даты
                    logger.info(f"Template {template.name} (id={template.id}) is deactivated from {template_day.deactivate_from_date}, skipping for date {version_date}")
                    continue
                    
                day_of_week = template_day.day_of_week
                template_dict = {
                    "id": template.id,
                    "name": template.name,
                    "start_time": effective_start_time,
                    "end_time": effective_end_time,
                    "max_slots": effective_max_slots,
                    "has_senior_slot": effective_has_senior_slot,
                    "template_metadata": template.template_metadata,
                    "group_id": template.group_id,
                    "created_at": template.created_at,
                    "updated_at": template.updated_at,
                    "days_of_week": [d.day_of_week for d in template.days if d.is_active]  # Только активные дни
                }
                templates_by_day[day_of_week].append(template_dict)
        
        logger.info(f"Returning templates_by_day: {templates_by_day}")
        return templates_by_day
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting applied templates for all days: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении примененных шаблонов"
        )

# ВАЖНО: Специфичные маршруты должны быть ПЕРЕД общими маршрутами с параметрами
# Используем POST вместо DELETE, чтобы избежать конфликта маршрутов с /{template_id}
# и проблем с body в DELETE-запросах
@router.post("/remove-from-days", status_code=status.HTTP_200_OK)
async def remove_templates_from_days(
    *,
    db: AsyncSession = Depends(get_db_session),
    chat_id: int = Query(..., description="ID чата (group_id)"),
    remove_data: RemoveTemplatesFromDaysPayload
):
    """Деактивирует связи шаблонов с указанными днями недели (устанавливает is_active=False).
    
    Проверяет наличие смен с записанными курьерами. Если есть такие смены,
    деактивирует шаблон, но предупреждает, что изменения вступят в силу при следующем открытии смен.
    """
    try:
        # Получаем группу по chat_id
        group_result = await db.execute(
            select(Group).where(Group.group_id == chat_id)
        )
        group = group_result.scalars().first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Группа не найдена"
            )
        
        # Получаем настройки доступа группы
        group_access_settings = None
        if hasattr(group, 'access_settings') and group.access_settings:
            group_access_settings = group.access_settings
        
        result = await crud_shift_template.remove_templates_from_days(
            db,
            group_id=group.id,
            template_ids=remove_data.template_ids,
            days_of_week=remove_data.days_of_week,
            check_future_shifts=True,
            group_access_settings=group_access_settings
        )
        
        logger.info(f"Deactivated {result['deactivated_count']} template-day links for group {group.id}, skipped {result.get('skipped_count', 0)} due to existing shifts")
        
        # Проверяем, есть ли шаблоны, которые будут деактивированы для следующего периода
        templates_deactivated_for_next_period = result.get('templates_deactivated_for_next_period', [])
        
        if templates_deactivated_for_next_period:
            # Есть шаблоны, которые будут деактивированы для следующего периода
            return {
                "message": f"Шаблон будет отменен в следующем периоде. Подтвердить?",
                "has_future_shifts": True,
                "templates_with_shifts": result['templates_with_shifts'],
                "templates_deactivated_for_next_period": templates_deactivated_for_next_period,
                "deactivated_count": result['deactivated_count'],
                "skipped_count": result.get('skipped_count', 0)
            }
        elif result['has_future_shifts']:
            skipped_info = f" Пропущено {result.get('skipped_count', 0)} связей из-за наличия записанных курьеров." if result.get('skipped_count', 0) > 0 else ""
            return {
                "message": f"Деактивировано {result['deactivated_count']} связей шаблонов с днями.{skipped_info}",
                "warning": "Некоторые шаблоны не были деактивированы, так как на них уже записаны курьеры на будущие даты.",
                "templates_with_shifts": result['templates_with_shifts'],
                "has_future_shifts": True,
                "skipped_count": result.get('skipped_count', 0)
            }
        
        return {
            "message": f"Деактивировано {result['deactivated_count']} связей шаблонов с днями",
            "has_future_shifts": False,
            "skipped_count": result.get('skipped_count', 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing templates from days for chat_id {chat_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при деактивации связей шаблонов с днями"
        )

@router.get("/{template_id}", response_model=ShiftTemplateRead)
async def get_shift_template_by_id(
    *,
    db: AsyncSession = Depends(get_db_session),
    template_id: UUID
):
    """Получает шаблон смены по ID."""
    try:
        template = await crud_shift_template.get_shift_template_by_id(
            db, template_id=template_id
        )
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Шаблон смены не найден"
            )
        
        template_dict = {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "start_time": template.start_time,
            "end_time": template.end_time,
            "max_slots": template.max_slots,
            "has_senior_slot": template.has_senior_slot,
            "template_metadata": template.template_metadata,
            "group_id": template.group_id,
            "created_at": template.created_at,
            "updated_at": template.updated_at
        }
        return ShiftTemplateRead(**template_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching shift template {template_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении шаблона смены"
        )

@router.put("/{template_id}", response_model=ShiftTemplateRead)
async def update_shift_template(
    *,
    db: AsyncSession = Depends(get_db_session),
    template_id: UUID,
    template_data: ShiftTemplateUpdate
):
    """Обновляет шаблон смены с поддержкой версионирования по периодам."""
    try:
        # Получаем шаблон для определения group_id
        template_result = await db.execute(
            select(ShiftTemplate).where(ShiftTemplate.id == template_id)
        )
        db_template = template_result.scalar_one_or_none()
        
        if not db_template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Шаблон смены не найден"
            )
        
        # Получаем access_settings из группы
        group_result = await db.execute(
            select(Group).where(Group.id == db_template.group_id)
        )
        group = group_result.scalar_one_or_none()
        access_settings = group.access_settings if group else None
        
        logger.info(f"[update_shift_template endpoint] Received template_data: {template_data.model_dump(exclude_unset=True)}")
        logger.info(f"[update_shift_template endpoint] apply_to_period: {template_data.apply_to_period}")
        logger.info(f"[update_shift_template endpoint] access_settings exists: {access_settings is not None}")
        
        # Обновляем шаблон с учетом версионирования
        template = await crud_shift_template.update_shift_template(
            db, 
            template_id=template_id, 
            template_data=template_data,
            group_access_settings=access_settings
        )
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Шаблон смены не найден"
            )
        
        logger.info(f"Updated shift template {template_id}")
        template_dict = {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "start_time": template.start_time,
            "end_time": template.end_time,
            "max_slots": template.max_slots,
            "has_senior_slot": template.has_senior_slot,
            "template_metadata": template.template_metadata,
            "group_id": template.group_id,
            "created_at": template.created_at,
            "updated_at": template.updated_at
        }
        return ShiftTemplateRead(**template_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating shift template {template_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при обновлении шаблона смены"
        )

@router.delete("/{template_id}", status_code=status.HTTP_200_OK)
async def delete_shift_template(
    *,
    db: AsyncSession = Depends(get_db_session),
    template_id: UUID
):
    """Удаляет шаблон смены.
    
    Проверяет наличие смен с записанными курьерами на будущие даты.
    Если есть такие смены, возвращает предупреждение, но не удаляет шаблон.
    """
    try:
        result = await crud_shift_template.delete_shift_template(
            db, template_id=template_id, check_future_shifts=True
        )
        
        if not result.get("deleted", False):
            if result.get("has_future_shifts", False):
                # Есть смены с курьерами - возвращаем предупреждение
                return {
                    "deleted": False,
                    "has_future_shifts": True,
                    "shifts_count": result.get("shifts_count", 0),
                    "message": result.get("message", "Невозможно удалить шаблон: есть смены с записанными курьерами на будущие даты. Отмена/удаление будет применено при следующем открытии смен.")
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Шаблон смены не найден"
                )
        
        logger.info(f"Deleted shift template {template_id}")
        return {
            "deleted": True,
            "has_future_shifts": False,
            "message": "Шаблон успешно удален"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting shift template {template_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении шаблона смены"
        )

@router.post("/template/{template_id}/clone", response_model=ShiftTemplateRead)
async def clone_shift_template(
    *,
    db: AsyncSession = Depends(get_db_session),
    template_id: UUID,
    clone_data: CloneTemplatePayload
):
    """Клонирует существующий шаблон смены."""
    try:
        # Проверяем, что исходный шаблон существует
        source_template = await crud_shift_template.get_shift_template_by_id(
            db, template_id=template_id
        )
        if not source_template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Исходный шаблон смены не найден"
            )
        
        # Клонируем шаблон
        cloned_templates = await crud_shift_template.clone_shift_template(
            db,
            source_template_id=template_id,
            new_name=clone_data.new_name,
            group_id=clone_data.group_id
        )
        
        if not cloned_templates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Исходный шаблон смены не найден"
            )
        
        # Для обратной совместимости возвращаем первый клонированный шаблон
        cloned_template = cloned_templates[0]
        
        if not cloned_template:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка при клонировании шаблона"
            )
        
        logger.info(f"Cloned shift template {template_id} to {cloned_template.id}")
        return ShiftTemplateRead.model_validate(cloned_template)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cloning shift template {template_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при клонировании шаблона смены"
        )

# === Эндпоинты для применения шаблонов к дням недели ===

@router.post("/apply", status_code=status.HTTP_201_CREATED)
async def apply_templates_to_days(
    *,
    db: AsyncSession = Depends(get_db_session),
    chat_id: int = Query(..., description="ID чата (group_id)"),
    apply_data: ShiftTemplateApplyPayload
):
    """Применяет шаблоны смен к указанным дням недели."""
    try:
        # Получаем группу по chat_id
        group_result = await db.execute(
            select(Group).where(Group.group_id == chat_id)
        )
        group = group_result.scalars().first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Группа не найдена"
            )
        
        # Проверяем, что все шаблоны принадлежат указанной группе
        for template_id in apply_data.template_ids:
            exists = await crud_shift_template.check_template_exists_in_group(
                db, template_id=template_id, group_id=group.id
            )
            if not exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Шаблон {template_id} не принадлежит группе {chat_id}"
                )
        
        # Применяем шаблоны
        created_links = await crud_shift_template.apply_templates_to_days(
            db, group_id=group.id, apply_data=apply_data
        )
        
        logger.info(f"Applied {len(created_links)} template-day links for chat_id {chat_id}")
        return {"message": f"Применено {len(created_links)} связей шаблонов с днями"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying templates to days for chat_id {chat_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при применении шаблонов к дням"
        )

@router.get("/day/{day_of_week}", response_model=ShiftTemplatesByDayResponse)
async def get_templates_for_day(
    *,
    db: AsyncSession = Depends(get_db_session),
    chat_id: int = Query(..., description="ID чата (group_id)"),
    day_of_week: int = Path(..., ge=0, le=6, description="День недели (0-6)")
):
    """Получает все шаблоны смен для указанного дня недели."""
    try:
        # Получаем группу по chat_id
        group_result = await db.execute(
            select(Group).where(Group.group_id == chat_id)
        )
        group = group_result.scalars().first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Группа не найдена"
            )
        
        templates = await crud_shift_template.get_templates_for_day(
            db, group_id=group.id, day_of_week=day_of_week
        )
        
        # Преобразуем SQLAlchemy объекты в Pydantic модели
        template_reads = []
        for template in templates:
            template_dict = {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "start_time": template.start_time,
                "end_time": template.end_time,
                "max_slots": template.max_slots,
                "has_senior_slot": template.has_senior_slot,
                "template_metadata": template.template_metadata,
                "group_id": template.group_id,
                "created_at": template.created_at,
                "updated_at": template.updated_at
            }
            template_read = ShiftTemplateRead(**template_dict)
            template_reads.append(template_read)
        
        return ShiftTemplatesByDayResponse(
            day_of_week=day_of_week,
            templates=template_reads
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching templates for day {day_of_week}, chat_id {chat_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении шаблонов для дня"
        )

@router.patch("/template-day/{template_id}/status", status_code=status.HTTP_200_OK)
async def update_template_day_status(
    *,
    db: AsyncSession = Depends(get_db_session),
    template_id: UUID = Path(..., description="ID шаблона"),
    chat_id: int = Query(..., description="ID чата (group_id)"),
    day_of_week: int = Query(..., ge=0, le=6, description="День недели (0-6)"),
    is_active: bool = Query(..., description="Активен ли шаблон для этого дня")
):
    """Обновляет статус активации шаблона для конкретного дня недели."""
    try:
        # Получаем группу по chat_id
        group_result = await db.execute(
            select(Group).where(Group.group_id == chat_id)
        )
        group = group_result.scalars().first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Группа не найдена"
            )
        
        template_day = await crud_shift_template.update_template_day_status(
            db,
            template_id=template_id,
            group_id=group.id,
            day_of_week=day_of_week,
            is_active=is_active
        )
        
        if not template_day:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Связь шаблона с днем недели не найдена"
            )
        
        logger.info(f"Updated template-day status: template_id={template_id}, day={day_of_week}, is_active={is_active}")
        return {"message": "Статус активации обновлен", "is_active": is_active}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating template-day status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при обновлении статуса активации"
        )

@router.delete("/clear-all-days", status_code=status.HTTP_200_OK)
async def clear_all_template_days_for_group(
    *,
    db: AsyncSession = Depends(get_db_session),
    group_id: int = Query(..., description="ID группы")
):
    """Удаляет все связи шаблонов с днями для группы."""
    try:
        removed_count = await crud_shift_template.clear_all_templates_for_group(
            db, group_id=group_id
        )
        
        logger.info(f"Cleared all template-day links for group {group_id}: {removed_count} removed")
        return {"message": f"Удалено {removed_count} связей шаблонов с днями"}
        
    except Exception as e:
        logger.error(f"Error clearing template days for group {group_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при очистке связей шаблонов с днями"
        )


@router.post("/migrate", response_model=dict)
async def migrate_group_to_templates(
    chat_id: str = Query(..., description="ID чата для миграции"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Автоматическая миграция настроек слотов в шаблоны смен для группы
    """
    try:
        # Получаем group_id по chat_id
        group_result = await db.execute(
            select(Group).where(Group.group_id == chat_id)
        )
        group = group_result.scalar_one_or_none()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Группа не найдена"
            )
        
        # Выполняем миграцию
        result = await MigrationService.migrate_group_to_templates(db, group.id)
        
        # Сохраняем изменения
        await db.commit()
        
        return {
            "success": True,
            "group_id": group.id,
            "chat_id": chat_id,
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error migrating group {chat_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при миграции группы: {str(e)}"
        )
