"""
Сервис для работы с шаблонами смен.
Содержит бизнес-логику для управления шаблонами смен и их применением к дням недели.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import time, datetime
import logging

from models.shift_template import ShiftTemplate, ShiftTemplateDay
from models.group import Group
from schemas.shift_template import (
    ShiftTemplateCreate,
    ShiftTemplateUpdate,
    ShiftTemplateApplyPayload,
    ShiftTemplateRead
)
from crud import shift_template as crud_shift_template

logger = logging.getLogger(__name__)

class ShiftTemplateService:
    """Сервис для работы с шаблонами смен."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_template_with_validation(
        self, 
        template_data: ShiftTemplateCreate
    ) -> ShiftTemplateRead:
        """
        Создает шаблон смены с дополнительной валидацией.
        """
        # Валидация времени
        if template_data.start_time >= template_data.end_time:
            raise ValueError("Время начала смены должно быть меньше времени окончания")
        
        # Валидация количества слотов
        if template_data.max_slots <= 0:
            raise ValueError("Количество слотов должно быть больше 0")
        
        # Проверяем, что группа существует
        group_result = await self.db.execute(
            select(Group).where(Group.id == template_data.group_id)
        )
        group = group_result.scalars().first()
        if not group:
            raise ValueError(f"Группа с ID {template_data.group_id} не найдена")
        
        # Проверяем уникальность названия в группе
        existing_templates = await crud_shift_template.get_shift_templates_by_group(
            self.db, group_id=template_data.group_id
        )
        
        for existing_template in existing_templates:
            if existing_template.name.lower() == template_data.name.lower():
                raise ValueError(f"Шаблон с названием '{template_data.name}' уже существует в группе")
        
        # Создаем шаблоны (для каждого дня недели создается отдельный шаблон)
        templates = await crud_shift_template.create_shift_template(
            self.db, template_data=template_data
        )
        
        # Для обратной совместимости возвращаем первый шаблон
        # В будущем можно изменить сигнатуру на List[ShiftTemplateRead]
        if templates:
            logger.info(f"Created {len(templates)} shift template(s) for group {template_data.group_id}")
            return templates[0]  # Возвращаем первый шаблон для обратной совместимости
        else:
            raise ValueError("Не удалось создать шаблон смены")
    
    async def update_template_with_validation(
        self,
        template_id: UUID,
        template_data: ShiftTemplateUpdate
    ) -> Optional[ShiftTemplateRead]:
        """
        Обновляет шаблон смены с дополнительной валидацией.
        """
        # Получаем существующий шаблон
        existing_template = await crud_shift_template.get_shift_template_by_id(
            self.db, template_id=template_id
        )
        
        if not existing_template:
            return None
        
        # Валидация времени (если обновляется)
        if template_data.start_time is not None and template_data.end_time is not None:
            if template_data.start_time >= template_data.end_time:
                raise ValueError("Время начала смены должно быть меньше времени окончания")
        elif template_data.start_time is not None:
            if template_data.start_time >= existing_template.end_time:
                raise ValueError("Время начала смены должно быть меньше времени окончания")
        elif template_data.end_time is not None:
            if existing_template.start_time >= template_data.end_time:
                raise ValueError("Время начала смены должно быть меньше времени окончания")
        
        # Валидация количества слотов
        if template_data.max_slots is not None and template_data.max_slots <= 0:
            raise ValueError("Количество слотов должно быть больше 0")
        
        # Проверяем уникальность названия (если обновляется)
        if template_data.name is not None:
            existing_templates = await crud_shift_template.get_shift_templates_by_group(
                self.db, group_id=existing_template.group_id
            )
            
            for template in existing_templates:
                if (template.id != template_id and 
                    template.name.lower() == template_data.name.lower()):
                    raise ValueError(f"Шаблон с названием '{template_data.name}' уже существует в группе")
        
        # Обновляем шаблон
        updated_template = await crud_shift_template.update_shift_template(
            self.db, template_id=template_id, template_data=template_data
        )
        
        logger.info(f"Updated shift template {template_id}")
        return updated_template
    
    async def apply_templates_with_validation(
        self,
        group_id: int,
        apply_data: ShiftTemplateApplyPayload
    ) -> Dict[str, Any]:
        """
        Применяет шаблоны к дням недели с дополнительной валидацией.
        """
        # Проверяем, что группа существует
        group_result = await self.db.execute(
            select(Group).where(Group.id == group_id)
        )
        group = group_result.scalars().first()
        if not group:
            raise ValueError(f"Группа с ID {group_id} не найдена")
        
        # Проверяем, что все шаблоны принадлежат группе
        for template_id in apply_data.template_ids:
            exists = await crud_shift_template.check_template_exists_in_group(
                self.db, template_id=template_id, group_id=group_id
            )
            if not exists:
                raise ValueError(f"Шаблон {template_id} не принадлежит группе {group_id}")
        
        # Валидация дней недели
        if not apply_data.days_of_week:
            raise ValueError("Необходимо указать хотя бы один день недели")
        
        invalid_days = [day for day in apply_data.days_of_week if day < 0 or day > 6]
        if invalid_days:
            raise ValueError(f"Недопустимые дни недели: {invalid_days}. Допустимые значения: 0-6")
        
        # Применяем шаблоны
        created_links = await crud_shift_template.apply_templates_to_days(
            self.db, group_id=group_id, apply_data=apply_data
        )
        
        logger.info(f"Applied {len(created_links)} template-day links for group {group_id}")
        return {
            "applied_count": len(created_links),
            "template_ids": apply_data.template_ids,
            "days_of_week": apply_data.days_of_week
        }
    
    async def get_templates_for_week(
        self,
        group_id: int
    ) -> Dict[int, List[ShiftTemplateRead]]:
        """
        Получает все шаблоны смен для всех дней недели.
        """
        week_templates = {}
        
        for day_of_week in range(7):  # 0-6 (понедельник-воскресенье)
            templates = await crud_shift_template.get_templates_for_day(
                self.db, group_id=group_id, day_of_week=day_of_week
            )
            week_templates[day_of_week] = templates
        
        return week_templates
    
    async def clone_template_with_validation(
        self,
        source_template_id: UUID,
        new_name: str,
        target_group_id: int
    ) -> ShiftTemplateRead:
        """
        Клонирует шаблон смены с дополнительной валидацией.
        """
        # Получаем исходный шаблон
        source_template = await crud_shift_template.get_shift_template_by_id(
            self.db, template_id=source_template_id
        )
        
        if not source_template:
            raise ValueError(f"Исходный шаблон {source_template_id} не найден")
        
        # Проверяем, что целевая группа существует
        group_result = await self.db.execute(
            select(Group).where(Group.id == target_group_id)
        )
        group = group_result.scalars().first()
        if not group:
            raise ValueError(f"Группа с ID {target_group_id} не найдена")
        
        # Проверяем уникальность названия в целевой группе
        existing_templates = await crud_shift_template.get_shift_templates_by_group(
            self.db, group_id=target_group_id
        )
        
        for template in existing_templates:
            if template.name.lower() == new_name.lower():
                raise ValueError(f"Шаблон с названием '{new_name}' уже существует в группе")
        
        # Клонируем шаблон
        cloned_templates = await crud_shift_template.clone_shift_template(
            self.db,
            source_template_id=source_template_id,
            new_name=new_name,
            group_id=target_group_id
        )
        
        if not cloned_templates:
            raise ValueError("Ошибка при клонировании шаблона")
        
        # Для обратной совместимости возвращаем первый клонированный шаблон
        cloned_template = cloned_templates[0]
        logger.info(f"Cloned shift template {source_template_id} to {len(cloned_templates)} template(s)")
        return cloned_template
    
    async def validate_template_conflicts(
        self,
        group_id: int,
        day_of_week: int,
        exclude_template_id: Optional[UUID] = None
    ) -> List[str]:
        """
        Проверяет конфликты между шаблонами на один день недели.
        """
        templates = await crud_shift_template.get_templates_for_day(
            self.db, group_id=group_id, day_of_week=day_of_week
        )
        
        conflicts = []
        
        # Исключаем шаблон из проверки (для обновления)
        if exclude_template_id:
            templates = [t for t in templates if t.id != exclude_template_id]
        
        # Проверяем пересечения временных интервалов
        for i, template1 in enumerate(templates):
            for template2 in templates[i+1:]:
                if self._time_intervals_overlap(
                    template1.start_time, template1.end_time,
                    template2.start_time, template2.end_time
                ):
                    conflicts.append(
                        f"Шаблоны '{template1.name}' и '{template2.name}' "
                        f"имеют пересекающиеся временные интервалы"
                    )
        
        return conflicts
    
    def _time_intervals_overlap(
        self,
        start1: time,
        end1: time,
        start2: time,
        end2: time
    ) -> bool:
        """
        Проверяет, пересекаются ли два временных интервала.
        """
        # Преобразуем время в минуты для удобства сравнения
        start1_minutes = start1.hour * 60 + start1.minute
        end1_minutes = end1.hour * 60 + end1.minute
        start2_minutes = start2.hour * 60 + start2.minute
        end2_minutes = end2.hour * 60 + end2.minute
        
        # Проверяем пересечение
        return not (end1_minutes <= start2_minutes or end2_minutes <= start1_minutes)
    
    async def get_template_statistics(
        self,
        group_id: int
    ) -> Dict[str, Any]:
        """
        Получает статистику по шаблонам смен для группы.
        """
        templates = await crud_shift_template.get_shift_templates_by_group(
            self.db, group_id=group_id
        )
        
        # Подсчитываем статистику
        total_templates = len(templates)
        templates_with_senior_slot = sum(1 for t in templates if t.has_senior_slot)
        avg_slots = sum(t.max_slots for t in templates) / total_templates if total_templates > 0 else 0
        
        # Получаем распределение по дням недели
        week_distribution = await self.get_templates_for_week(group_id)
        days_with_templates = sum(1 for day_templates in week_distribution.values() if day_templates)
        
        return {
            "total_templates": total_templates,
            "templates_with_senior_slot": templates_with_senior_slot,
            "average_slots": round(avg_slots, 2),
            "days_with_templates": days_with_templates,
            "week_distribution": {
                day: len(templates) for day, templates in week_distribution.items()
            }
        }
