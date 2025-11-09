from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
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

@router.post("/", response_model=ShiftTemplateRead, status_code=status.HTTP_201_CREATED)
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
        
        # Создаем шаблон
        template = await crud_shift_template.create_shift_template(
            db, template_data=template_data
        )
        
        logger.info(f"Created shift template {template.id} for chat_id {chat_id}")
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
    chat_id: int = Query(..., description="ID чата (group_id)")
):
    """Получает примененные шаблоны смен для всех дней недели."""
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
        
        for template in templates:
            logger.info(f"Template {template.name} has {len(template.days)} days: {[d.day_of_week for d in template.days]}")
            for template_day in template.days:
                day_of_week = template_day.day_of_week
                template_dict = {
                    "id": template.id,
                    "name": template.name,
                    "start_time": template.start_time,
                    "end_time": template.end_time,
                    "max_slots": template.max_slots,
                    "has_senior_slot": template.has_senior_slot,
                    "template_metadata": template.template_metadata,
                    "group_id": template.group_id,
                    "created_at": template.created_at,
                    "updated_at": template.updated_at,
                    "days_of_week": [d.day_of_week for d in template.days]
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
    """Обновляет шаблон смены."""
    try:
        template = await crud_shift_template.update_shift_template(
            db, template_id=template_id, template_data=template_data
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

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift_template(
    *,
    db: AsyncSession = Depends(get_db_session),
    template_id: UUID
):
    """Удаляет шаблон смены.
    
    Возвращает ошибку 409, если существуют смены с этим шаблоном.
    """
    try:
        success = await crud_shift_template.delete_shift_template(
            db, template_id=template_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Шаблон смены не найден"
            )
        
        logger.info(f"Deleted shift template {template_id}")
        
    except ValueError as e:
        # Ошибка валидации - есть связанные смены
        logger.warning(f"Cannot delete shift template {template_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
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
        cloned_template = await crud_shift_template.clone_shift_template(
            db,
            source_template_id=template_id,
            new_name=clone_data.new_name,
            group_id=clone_data.group_id
        )
        
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

@router.delete("/remove-from-days", status_code=status.HTTP_200_OK)
async def remove_templates_from_days(
    *,
    db: AsyncSession = Depends(get_db_session),
    group_id: int = Query(..., description="ID группы"),
    remove_data: RemoveTemplatesFromDaysPayload
):
    """Удаляет связи шаблонов с указанными днями недели."""
    try:
        removed_count = await crud_shift_template.remove_templates_from_days(
            db,
            group_id=group_id,
            template_ids=remove_data.template_ids,
            days_of_week=remove_data.days_of_week
        )
        
        logger.info(f"Removed {removed_count} template-day links for group {group_id}")
        return {"message": f"Удалено {removed_count} связей шаблонов с днями"}
        
    except Exception as e:
        logger.error(f"Error removing templates from days for group {group_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении связей шаблонов с днями"
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
