"""
Сервис для миграции существующих настроек слотов в шаблоны смен
"""
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select
import uuid
from datetime import time

from models.shift_template import ShiftTemplate, ShiftTemplateDay
from models.shift import Shift
from models.group import Group


class MigrationService:
    """Сервис для миграции данных из старой логики в новую"""
    
    @staticmethod
    def get_day_name(day_of_week: int) -> str:
        """Получить название дня недели на русском языке"""
        days = {
            0: "Воскресенье",
            1: "Понедельник", 
            2: "Вторник",
            3: "Среда",
            4: "Четверг",
            5: "Пятница",
            6: "Суббота"
        }
        return days.get(day_of_week, f"День {day_of_week}")
    
    @staticmethod
    def parse_time(time_str: str) -> time:
        """Парсинг времени из строки формата 'HH:MM'"""
        try:
            hour, minute = map(int, time_str.split(':'))
            return time(hour, minute)
        except (ValueError, AttributeError):
            # Возвращаем время по умолчанию если парсинг не удался
            return time(9, 0)
    
    @staticmethod
    async def create_template_from_config(
        db: AsyncSession,
        name: str,
        start_time: str,
        end_time: str,
        max_slots: int,
        has_senior_slot: bool,
        days_of_week: List[int],
        group_id: int
    ) -> ShiftTemplate:
        """Создать шаблон смены из конфигурации"""
        
        # Парсим время
        start = MigrationService.parse_time(start_time)
        end = MigrationService.parse_time(end_time)
        
        # Создаем шаблон
        template = ShiftTemplate(
            id=uuid.uuid4(),
            group_id=group_id,
            name=name,
            start_time=start,
            end_time=end,
            max_slots=max_slots,
            has_senior_slot=has_senior_slot
        )
        
        db.add(template)
        await db.flush()  # Получаем ID шаблона
        
        # Создаем связи с днями недели
        for day_of_week in days_of_week:
            template_day = ShiftTemplateDay(
                template_id=template.id,
                group_id=group_id,
                day_of_week=day_of_week
            )
            db.add(template_day)
        
        return template
    
    @staticmethod
    async def migrate_slot_config_to_templates(
        db: AsyncSession,
        slot_config: Dict,
        group_id: int
    ) -> List[ShiftTemplate]:
        """Автоматически создает шаблоны смен из существующих настроек слотов"""
        
        templates_created = []
        
        for day_of_week in range(7):
            day_config = slot_config.get(str(day_of_week), {})
            
            # Проверяем, есть ли настройки для дневной смены
            max_day_slots = day_config.get("maxDaySlots", 0)
            if max_day_slots > 0:
                day_template = await MigrationService.create_template_from_config(
                    db=db,
                    name=f"Дневная смена - {MigrationService.get_day_name(day_of_week)}",
                    start_time=day_config.get("dayShiftStartTime", "09:00"),
                    end_time=day_config.get("dayShiftEndTime", "18:00"),
                    max_slots=max_day_slots,
                    has_senior_slot=day_config.get("hasSeniorSlot", False),
                    days_of_week=[day_of_week],
                    group_id=group_id
                )
                templates_created.append(day_template)
            
            # Проверяем, есть ли настройки для ночной смены
            max_night_slots = day_config.get("maxNightSlots", 0)
            if max_night_slots > 0:
                night_template = await MigrationService.create_template_from_config(
                    db=db,
                    name=f"Вечерняя смена - {MigrationService.get_day_name(day_of_week)}",
                    start_time=day_config.get("nightShiftStartTime", "18:00"),
                    end_time=day_config.get("nightShiftEndTime", "09:00"),
                    max_slots=max_night_slots,
                    has_senior_slot=day_config.get("hasSeniorSlot", False),
                    days_of_week=[day_of_week],
                    group_id=group_id
                )
                templates_created.append(night_template)
        
        return templates_created
    
    @staticmethod
    async def find_template_by_time_and_day(
        db: AsyncSession,
        group_id: int,
        day_of_week: int,
        shift_type: str
    ) -> Optional[ShiftTemplate]:
        """Найти шаблон по дню недели и типу смены (для миграции существующих смен)"""
        
        # Определяем примерное время для поиска
        if shift_type == "day":
            search_time = time(12, 0)  # Середина дня
        else:  # night
            search_time = time(0, 0)   # Полночь
        
        # Ищем шаблон, который применяется к данному дню недели
        # и время начала примерно соответствует типу смены
        stmt = select(ShiftTemplate).join(ShiftTemplateDay).where(
            and_(
                ShiftTemplate.group_id == group_id,
                ShiftTemplateDay.day_of_week == day_of_week,
                ShiftTemplate.start_time <= search_time,
                ShiftTemplate.end_time >= search_time
            )
        )
        
        result = await db.execute(stmt)
        template = result.scalar_one_or_none()
        
        return template
    
    @staticmethod
    async def migrate_existing_shifts_to_templates(db: AsyncSession, group_id: int):
        """Обновляет существующие смены, добавляя template_id"""
        
        # Получаем все смены группы без template_id (старые записи)
        stmt = select(Shift).where(
            and_(
                Shift.group_id == group_id,
                Shift.template_id.is_(None)
            )
        )
        
        result = await db.execute(stmt)
        shifts = result.scalars().all()
        
        updated_count = 0
        
        for shift in shifts:
            # Определяем день недели (0 = понедельник в Python)
            day_of_week = shift.date.weekday()
            
            # Ищем подходящий шаблон
            template = await MigrationService.find_template_by_time_and_day(
                db=db,
                group_id=group_id,
                day_of_week=day_of_week,
                shift_type=shift.shift_type
            )
            
            if template:
                # Обновляем смену, добавляя template_id
                shift.template_id = template.id
                updated_count += 1
        
        return updated_count
    
    @staticmethod
    async def migrate_group_to_templates(db: AsyncSession, group_id: int):
        """Полная миграция группы: настройки слотов -> шаблоны -> обновление смен"""
        
        # Получаем группу
        group_result = await db.execute(
            select(Group).where(Group.id == group_id)
        )
        group = group_result.scalar_one_or_none()
        if not group:
            raise ValueError(f"Группа с ID {group_id} не найдена")
        
        # Проверяем, есть ли уже шаблоны для этой группы
        templates_count_stmt = select(ShiftTemplate).where(
            ShiftTemplate.group_id == group_id
        )
        templates_count_result = await db.execute(templates_count_stmt)
        existing_templates = len(templates_count_result.scalars().all())
        
        if existing_templates > 0:
            # Шаблоны уже существуют, только обновляем смены
            updated_shifts = await MigrationService.migrate_existing_shifts_to_templates(db, group_id)
            return {
                "templates_created": 0,
                "shifts_updated": updated_shifts,
                "message": "Шаблоны уже существуют, обновлены только смены"
            }
        
        # Получаем существующие настройки слотов
        if not group.slot_config:
            return {
                "templates_created": 0,
                "shifts_updated": 0,
                "message": "Нет настроек слотов для миграции"
            }
        
        # Создаем шаблоны из настроек
        templates = await MigrationService.migrate_slot_config_to_templates(
            db=db,
            slot_config=group.slot_config,
            group_id=group_id
        )
        
        # Обновляем существующие смены
        updated_shifts = await MigrationService.migrate_existing_shifts_to_templates(db, group_id)
        
        return {
            "templates_created": len(templates),
            "shifts_updated": updated_shifts,
            "message": f"Создано {len(templates)} шаблонов, обновлено {updated_shifts} смен"
        }
