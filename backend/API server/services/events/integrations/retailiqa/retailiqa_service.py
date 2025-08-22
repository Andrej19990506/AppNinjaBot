from typing import List, Optional, Dict
from fastapi import HTTPException, status
from loguru import logger
from datetime import datetime 
from sqlalchemy import select
import schemas 


from schemas.retailiqa_schema import (
    RetailiQAReportItem,

)
from core.config import settings 
from crud import event as crud_event
from models import Event
from sqlalchemy.ext.asyncio import AsyncSession 
from services.events.integrations.retailiqa.api_client import RetailiQAApiClient
from services.events.integrations.retailiqa.report_processor import (
    filter_violations, group_by_insp_id, build_detailed_violations, calculate_score, get_periods_for_fallback, find_latest_inspection, is_acceptable_status
)
from services.events.integrations.retailiqa.notification_builder import (
    build_result_notification, build_daily_reminder
)
from services.events.integrations.retailiqa.event_sync import sync_event_with_report


class RetailiQAService:
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = base_url or settings.RETAILIQA_API_BASE_URL
        self.api_token = token or settings.RETAILIQA_TOKEN

        if not self.base_url:
            raise ValueError("RETAILIQA_API_BASE_URL must be configured.")
        

    async def process_new_reports(
        self, 
        db: AsyncSession, 
        check_obj_name_param: str, 
        role: str,
        date_from_param: Optional[str] = None, 
        date_to_param: Optional[str] = None,
        max_pages: int = 1
    ) -> List[Event]:
        """
        Получает новые отчеты из RetailiQA, обрабатывает их и сохраняет/обновляет события в БД.

        Параметры:
            db: AsyncSession — сессия БД
            check_obj_name_param: str — имя объекта проверки в RetailiQA
            role: str — роль для выбора типа отчета
            date_from_param: Optional[str] — дата начала периода (YYYY-MM-DD)
            date_to_param: Optional[str] — дата конца периода (YYYY-MM-DD)
            max_pages: int — максимум страниц для API

        Возвращает:
            List[Event] — список созданных/обновлённых событий

        Исключения:
            HTTPException — если что-то пошло не так
        Этапы работы:
            1. Логирование и подготовка параметров
            2. Перебор периодов (текущий и предыдущий месяц), сбор отчётов
            3. Группировка отчётов по инспекциям
            4. Поиск последней инспекции
            5. Проверка статуса инспекции
            6. Получение полного списка пунктов для выбранной инспекции
            7. Формирование данных для события
            8. Сохранение/обновление события в БД
            9. Создание уведомлений (если нужно)
            10. Обработка ошибок
        """
        # === 1. Логирование и подготовка параметров ===
        logger.info(f"Запуск обработки новых отчетов RetailiQA для объекта '{check_obj_name_param}' с {date_from_param=} по {date_to_param=}, максимум страниц: {max_pages}, роль: {role}")
        processed_events: List[Event] = []
        # --- Выбор insp_type_name по роли ---
        ROLE_TO_INSP_TYPE = {
            "chef": "АТО_Производство_new",
            "courier": "АТО_Курьеры_new"
        }
        insp_type_name = ROLE_TO_INSP_TYPE.get(role)
        if not insp_type_name:
            raise ValueError(f"Неизвестная роль для insp_type_name: {role}")
        try:
            api_client = RetailiQAApiClient(base_url=self.base_url, token=self.api_token)
            all_report_items: List[RetailiQAReportItem] = []
            offset = 0
            page_limit = 100
            iteration = 0
            if not check_obj_name_param:
                logger.error("Ошибка: Имя объекта для RetailiQA (check_obj_name_param) не предоставлено.")
                raise ValueError("check_obj_name_param is required for process_new_reports")
            logger.info(f"Целевой объект для запроса к API RetailiQA: '{check_obj_name_param}'")
            if date_from_param and date_to_param:
                logger.info(f"Поиск отчетов будет производиться за период: с {date_from_param} по {date_to_param}")
            elif date_from_param:
                 logger.info(f"Поиск отчетов будет производиться за дату: {date_from_param} (используется для from_date и to_date)")
            else:
                logger.info("Поиск отчетов будет производиться без фильтра по дате (для получения последних отчетов согласно логике RetailiQA API).")

            # === 2. Перебор периодов (текущий и предыдущий месяц), сбор отчётов ===
            periods = get_periods_for_fallback()
            for date_from, date_to in periods:
                offset = 0
                iteration = 0
                while iteration < max_pages:
                    iteration += 1
                    report_batch = await api_client.get_reports(
                        date_from=date_from.isoformat(),
                        date_to=date_to.isoformat(),
                        limit=page_limit,
                        offset=offset,
                        check_obj_name=check_obj_name_param,
                        insp_type_name=insp_type_name
                    )
                    if isinstance(report_batch, dict):
                        if "result" in report_batch:
                            report_batch = report_batch["result"]
                        if isinstance(report_batch, dict) and "result" in report_batch:
                            report_batch = report_batch["result"]
                    if report_batch and len(report_batch) > 0 and isinstance(report_batch[0], dict):
                        report_batch = [RetailiQAReportItem.model_validate(item) for item in report_batch]
                    if not report_batch:
                        break
                    all_report_items.extend(filter_violations(report_batch))
                    if len(report_batch) < page_limit:
                        break
                    offset += page_limit
                if all_report_items:
                    logger.info(f"Нашли проверки за период с {date_from} по {date_to}, всего пунктов: {len(all_report_items)}")
                    break
            if not all_report_items:
                logger.info("Новых пунктов отчетов (нарушений или важных замечаний) для обработки (тип 'АТО_Производство_new') нет ни в текущем, ни в предыдущем месяце.")
                return processed_events

            # === 3. Группировка отчётов по инспекциям ===
            reports_by_insp_id: Dict[str, List[RetailiQAReportItem]] = group_by_insp_id(all_report_items)

            # === 4. Поиск последней инспекции ===
            latest = find_latest_inspection(reports_by_insp_id)
            if latest is not None:
                latest_insp_id, latest_insp_date = latest
            else:
                logger.info("Проверок не было ни в текущем, ни в предыдущем месяце.")
                return processed_events
            if latest_insp_id is None:
                logger.warning("Не удалось найти ни одной подходящей проверки для обработки")
                return processed_events

            # === 5. Проверка статуса инспекции ===
            initial_items_for_latest_insp = reports_by_insp_id.get(latest_insp_id, [])
            if not initial_items_for_latest_insp:
                logger.warning(f"Для последней выбранной проверки {latest_insp_id} не найдено пунктов в первоначальном сканировании. Невозможно продолжить.")
                return processed_events
            logger.debug(f'[DEBUG] initial_items_for_latest_insp[0] будет использоваться, len={len(initial_items_for_latest_insp)}')
            first_item = initial_items_for_latest_insp[0]
            if not is_acceptable_status(first_item.state_message):
                logger.info(f"Проверка {latest_insp_id} ({first_item.insp_obj}) имеет неприемлемый для обработки статус: '{first_item.state_message}' (is_closed: {first_item.is_closed}). Пропускаем.")
                return processed_events
            logger.info(f"Проверка {latest_insp_id} ({first_item.insp_obj}) в статусе '{first_item.state_message}' (is_closed: {first_item.is_closed}) будет обработана.")
            logger.info(f"Получение полного списка пунктов для проверки ID: {latest_insp_id} от {first_item.insp_date} для объекта '{first_item.insp_obj}'")

            # === 6. Получение полного списка пунктов для выбранной инспекции ===
            try:
                check_date_obj = datetime.strptime(first_item.insp_date, "%d.%m.%Y")
                specific_insp_date_iso = check_date_obj.strftime("%Y-%m-%d")
            except ValueError:
                specific_insp_date_iso = first_item.insp_date
            all_items_for_selected_inspection = await api_client.get_reports(
                date_from=specific_insp_date_iso,
                date_to=specific_insp_date_iso,
                limit=1000,
                check_obj_name=first_item.insp_obj,
                insp_type_name=insp_type_name
            )
            if isinstance(all_items_for_selected_inspection, dict):
                if "result" in all_items_for_selected_inspection:
                    all_items_for_selected_inspection = all_items_for_selected_inspection["result"]
                if isinstance(all_items_for_selected_inspection, dict) and "result" in all_items_for_selected_inspection:
                    all_items_for_selected_inspection = all_items_for_selected_inspection["result"]
            # Преобразуем dict в RetailiQAReportItem, если нужно
            if all_items_for_selected_inspection and len(all_items_for_selected_inspection) > 0 and isinstance(all_items_for_selected_inspection[0], dict):
                all_items_for_selected_inspection = [RetailiQAReportItem.model_validate(item) for item in all_items_for_selected_inspection]
            if not all_items_for_selected_inspection:
                items_to_detail = initial_items_for_latest_insp
            else:
                items_to_detail = filter_violations(all_items_for_selected_inspection)

            # === 7. Формирование данных для события ===
            number_of_violations = len(items_to_detail)
            detailed_violations_list = build_detailed_violations(items_to_detail, latest_insp_date)
            comments_for_event = [
                f"{item.insp_scope or 'Пункт'}: {item.task_comments.strip() if item.task_comments and item.task_comments.strip() else 'Штрафной пункт без комментария'}"
                for item in items_to_detail
                if (item.task_comments and item.task_comments.strip()) or (item.task_sum is not None and item.task_sum > 0)
            ]
            photos = [
                photo_url.strip() 
                for item_photo in items_to_detail
                if item_photo.task_photos 
                for photo_url in item_photo.task_photos.split(',') 
                if photo_url.strip()
            ]
            try:
                event_date = datetime.fromisoformat(first_item.insp_completed)
            except ValueError:
                event_date = datetime.now()
            score_data_date_iso = specific_insp_date_iso
            score_data = calculate_score(items_to_detail)
            score_percentage = score_data["score_percentage"]
            total_possible_points = score_data["max_points"]
            penalty_points_final = score_data["penalty_points"]
            total_earned_points = None
            logger.info(f"[DEBUG] event_data_dict: max_points={total_possible_points}, penalty_points={penalty_points_final}, score_percentage={score_percentage}")
            event_data_dict = {
                "description": f"Аудит RetailiQA: {first_item.insp_type} для {first_item.insp_obj}",
                "date": event_date,
                "event_type": "АТО",
                "retailiqa_insp_id": latest_insp_id,
                "retailiqa_insp_obj_id": first_item.insp_obj_id,
                "retailiqa_insp_obj_name": first_item.insp_obj,
                "retailiqa_max_points": total_possible_points,
                "retailiqa_penalty_points": penalty_points_final,
                "retailiqa_violation_count": number_of_violations,
                "retailiqa_comments": comments_for_event,
                "retailiqa_detailed_violations": detailed_violations_list,
                "retailiqa_photos": photos,
                "is_active": True,
                "retailiqa_score_percentage": score_percentage,
                "retailiqa_earned_points": total_earned_points,
                "group_type": role
            }

            # === 8. Сохранение/обновление события в БД ===
            try:
                event_obj = await sync_event_with_report(
                    db=db,
                    event_data_dict=event_data_dict,
                    latest_insp_id=latest_insp_id,
                    first_item=first_item,
                    event_date=event_date,
                    total_possible_points=total_possible_points,
                    penalty_points_final=penalty_points_final,
                    number_of_violations=number_of_violations,
                    score_percentage=score_percentage,
                    total_earned_points=total_earned_points
                )
                processed_events.append(event_obj)
                logger.info(f"Событие {event_obj.id} создано или обновлено через sync_event_with_report.")
            except Exception as e:
                logger.error("Ошибка при создании/обновлении события через sync_event_with_report: {error}".format(error=e), exc_info=True)
                await db.rollback()
                return processed_events

            # === 9. Создание уведомлений (если нужно) ===
            target_group_id = None
            try:
                from models import Group
                group_query = select(Group).where(Group.retailiqa_object_name == first_item.insp_obj)
                group_result = await db.execute(group_query)
                group = group_result.scalars().first()
                if group:
                    target_group_id = group.group_id
                else:
                    target_group_id = -100
            except Exception as e:
                target_group_id = -100
            if not target_group_id:
                return processed_events
            create_result_notification = event_data_dict.get('create_retailiqa_result_notification', False)
            create_daily_reminder = event_data_dict.get('create_retailiqa_daily_reminder', False)
            if create_result_notification:
                one_time_message = build_result_notification(
                    event_date,
                    first_item.insp_obj,
                    score_percentage,
                    total_earned_points,
                    total_possible_points,
                    penalty_points_final,
                    detailed_violations_list
                )
                one_time_notification = schemas.NotificationCreate(
                    message=one_time_message,
                    time=0,
                    chat_ids=[target_group_id],
                    requires_confirmation=False,
                )
                try:
                    await crud_event.create_event_notification(
                        db, 
                        notification_in=one_time_notification, 
                        event_id=event_obj.id
                    )
                except Exception as e:
                    pass
            if create_daily_reminder:
                daily_message = build_daily_reminder(
                    event_date,
                    first_item.insp_obj,
                    detailed_violations_list
                )
                repeat_settings = schemas.RepeatSettingsCreate(
                    type="daily",
                    weekdays=None,
                    month_day=None
                )
                daily_notification = schemas.NotificationCreate(
                    message=daily_message,
                    time=480,
                    chat_ids=[target_group_id],
                    requires_confirmation=True,
                    repeat=repeat_settings
                )
                try:
                    await crud_event.create_event_notification(
                        db, 
                        notification_in=daily_notification, 
                        event_id=event_obj.id
                    )
                except Exception as e:
                    pass
            logger.info(f"Обработка отчетов RetailiQA завершена. Обработано/создано событий: {len(processed_events)}")
            return processed_events
        except HTTPException as e:
            logger.error(f"RetailiQA Service HTTPException: {e.detail}", exc_info=True)
            raise e
        except Exception as e:
            logger.error("Непредвиденная ошибка во время обработки отчетов RetailiQA: {error_type} - {error_msg}".format(
                error_type=type(e).__name__,
                error_msg=str(e)
            ), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred in process_new_reports: {type(e).__name__} - {str(e)}"
            )
        except KeyError as e:
            logger.error(f'KeyError: {e}', exc_info=True)
            raise

    async def get_check_objects(self, name_filter: Optional[str] = None, limit: int = 100, offset: int = 0) -> list:
        """
        Получает список объектов из RetailiQA для автоопределения по названию.
        """
        api_client = RetailiQAApiClient(base_url=self.base_url, token=self.api_token)
        return await api_client.get_check_objects(name_filter=name_filter, limit=limit, offset=offset)


if __name__ == "__main__":
    import asyncio
    asyncio.run() 