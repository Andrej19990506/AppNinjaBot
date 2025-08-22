from typing import Dict, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from models import Event
from crud import event as crud_event

async def sync_event_with_report(
    db: AsyncSession,
    event_data_dict: Dict,
    latest_insp_id: str,
    first_item,
    event_date: datetime,
    total_possible_points: int,
    penalty_points_final: float,
    number_of_violations: int,
    score_percentage: Optional[float],
    total_earned_points: int
) -> Event:
    """
    Создаёт или обновляет Event на основе данных отчёта RetailiQA.
    """
    existing_event = await crud_event.get_event_by_retailiqa_insp_id(db, retailiqa_insp_id=latest_insp_id)
    if existing_event:
        # Обновление существующего события
        existing_event.description = event_data_dict.get("description", f"Аудит RetailiQA: {first_item.insp_type} для {first_item.insp_obj}")
        existing_event.date = event_date
        existing_event.event_type = event_data_dict.get("event_type", "АТО")
        existing_event.retailiqa_insp_id = latest_insp_id
        existing_event.retailiqa_insp_obj_id = first_item.insp_obj_id
        existing_event.retailiqa_insp_obj_name = first_item.insp_obj
        existing_event.retailiqa_max_points = total_possible_points
        existing_event.retailiqa_penalty_points = penalty_points_final
        existing_event.retailiqa_violation_count = number_of_violations
        existing_event.retailiqa_comments = event_data_dict.get("retailiqa_comments", [])
        existing_event.retailiqa_detailed_violations = event_data_dict.get("retailiqa_detailed_violations", [])
        existing_event.retailiqa_photos = event_data_dict.get("retailiqa_photos", [])
        existing_event.retailiqa_score_percentage = score_percentage
        existing_event.retailiqa_earned_points = total_earned_points
        existing_event.group_type = event_data_dict.get("group_type")
        existing_event.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing_event)
        return existing_event
    else:
        # Создание нового события
        from models import Event as EventModel
        new_event = EventModel(
            description=event_data_dict.get("description", f"Аудит RetailiQA для {first_item.insp_obj}"),
            date=event_date,
            event_type=event_data_dict.get("event_type", "АТО"),
            retailiqa_insp_id=latest_insp_id,
            retailiqa_insp_obj_id=first_item.insp_obj_id,
            retailiqa_insp_obj_name=first_item.insp_obj,
            retailiqa_max_points=total_possible_points,
            retailiqa_penalty_points=penalty_points_final,
            retailiqa_violation_count=number_of_violations,
            retailiqa_comments=event_data_dict.get("retailiqa_comments", []),
            retailiqa_detailed_violations=event_data_dict.get("retailiqa_detailed_violations", []),
            retailiqa_photos=event_data_dict.get("retailiqa_photos", []),
            retailiqa_score_percentage=score_percentage,
            retailiqa_earned_points=total_earned_points,
            group_type=event_data_dict.get("group_type"),
            is_active=True,
            updated_at=datetime.now(timezone.utc)
        )
        db.add(new_event)
        await db.commit()
        await db.refresh(new_event)
        return new_event 