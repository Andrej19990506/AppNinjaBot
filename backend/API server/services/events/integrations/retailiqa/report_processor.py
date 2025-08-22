from typing import List, Dict, Optional
from datetime import datetime
import re
from schemas.retailiqa_schema import RetailiQAReportItem
import logging


def filter_violations(report_items: List[RetailiQAReportItem]) -> List[RetailiQAReportItem]:
    """Фильтрует только нарушения и важные замечания."""
    return [
        item for item in report_items
        if (item.task_answer and isinstance(item.task_answer, str) and item.task_answer.lower() == "нет")
        or (item.task_sum is not None and item.task_sum > 0)
        or (item.task_comments and len(item.task_comments.strip()) > 0)
    ]


def group_by_insp_id(report_items: List[RetailiQAReportItem]) -> Dict[str, List[RetailiQAReportItem]]:
    """Группирует пункты отчётов по insp_id."""
    grouped = {}
    for item in report_items:
        grouped.setdefault(item.insp_id, []).append(item)
    return grouped


def filter_comments_by_month(item: RetailiQAReportItem, target_month: int, target_year: int) -> str:
    """Оставляет только комментарии за нужный месяц и год."""
    if not item.task_comments:
        return ""
    try:
        comment_pattern = re.compile(r"\[(.*?) (\d{2}\.\d{2}\.\d{4}) \d{2}:\d{2}\]\s*(.*?)(?=\n\[|$)", re.DOTALL)
    except re.error as e:
        logging.error(f"[filter_comments_by_month] Ошибка компиляции паттерна: {e}")
        raise
    # Логируем task_comments перед использованием паттерна
    try:
        logging.info(f"[filter_comments_by_month] task_comments для insp_id={getattr(item, 'insp_id', None)}: {repr(item.task_comments)}")
    except Exception as log_exc:
        logging.warning(f"[filter_comments_by_month] Не удалось залогировать task_comments: {log_exc}")
    filtered = []
    try:
        for match in comment_pattern.finditer(item.task_comments):
            comment_date_str = match.group(2)
            try:
                day, month, year = map(int, comment_date_str.split('.'))
                if year == target_year and month == target_month:
                    filtered.append(match.group(0).strip())
            except ValueError:
                filtered.append(match.group(0).strip())
    except re.error as e:
        logging.error(f"[filter_comments_by_month] Ошибка поиска по паттерну: {e}\ntask_comments: {repr(item.task_comments)}")
        raise
    return "\n".join(filtered)


def build_detailed_violations(items: List[RetailiQAReportItem], latest_insp_date: Optional[datetime]) -> List[dict]:
    """Формирует detailed_violations_list для события."""
    detailed_violations = []
    for item in items:
        # Фильтруем комментарии по месяцу инспекции
        if latest_insp_date:
            item.task_comments = filter_comments_by_month(item, latest_insp_date.month, latest_insp_date.year)
        comment_text = item.task_comments.strip() if item.task_comments and item.task_comments.strip() else "Штрафной пункт без комментария"
        # Парсим фотографии
        item_photos_list = []
        if item.task_photos:
            raw_urls = re.split(r'[,;]', item.task_photos)
            item_photos_list = [url.strip() for url in raw_urls if url.strip()]
        violation_type = "нарушение" if item.task_sum is not None and item.task_sum > 0 else "замечание"
        detailed_violations.append({
            "title": item.insp_scope or "Без названия пункта",
            "text": comment_text,
            "penalty": item.task_sum if item.task_sum is not None else 0.0,
            "type": violation_type,
            "photos": item_photos_list
        })
    return detailed_violations


def calculate_score(items: list, total_check_items: int = None) -> dict:
    """
    Считает процент выполнения, штрафные баллы и максимум баллов по списку RetailiQAReportItem.
    
    Логика расчета:
    1. Максимум баллов = 100 (стандарт RetailiQA)
    2. Штрафные баллы = сумма task_sum всех нарушений
    3. Процент = ((максимум - штраф) / максимум) * 100
    
    Параметры:
        items: список нарушений
        total_check_items: общее количество пунктов в проверке (для логирования)
    """
    if not items:
        return {
            "max_points": 100,
            "penalty_points": 0,
            "score_percentage": 100
        }
    
    # Считаем штрафные баллы
    total_penalty_points = sum(
        item.task_sum for item in items 
        if hasattr(item, 'task_sum') and item.task_sum is not None and item.task_sum > 0
    )
    
    # Для RetailiQA ВСЕГДА используется фиксированный максимум 100 баллов
    # Это стандарт системы, независимо от количества пунктов в проверке
    total_possible_points = 100
    
    # Считаем процент выполнения
    score_percentage = max(0, ((total_possible_points - total_penalty_points) / total_possible_points) * 100)
    
    # Логируем для отладки
    logging.info(f"[calculate_score] Всего нарушений: {len(items)}")
    logging.info(f"[calculate_score] Штрафные баллы: {total_penalty_points}")
    logging.info(f"[calculate_score] Максимум баллов: {total_possible_points} (стандарт RetailiQA)")
    logging.info(f"[calculate_score] Процент выполнения (до округления): {score_percentage}")
    logging.info(f"[calculate_score] Процент выполнения (после округления): {int(score_percentage)}")
    logging.info(f"[calculate_score] Общее количество пунктов в проверке: {total_check_items}")
    
    return {
        "max_points": total_possible_points,
        "penalty_points": total_penalty_points,
        "score_percentage": int(score_percentage)  # Округляем вниз до целых, как в RetailiQA
    }


def get_periods_for_fallback():
    """
    Возвращает список периодов (кортежей дат) для fallback-поиска отчётов:
    сначала текущий месяц (с 1 числа по сегодня), затем предыдущий месяц (с 1 по последний день).
    Используется для последовательного поиска отчётов сначала в текущем, потом в предыдущем месяце.
    """
    now = datetime.now()
    # Текущий месяц
    current_month_start = datetime(now.year, now.month, 1)
    today = now.date()
    # Предыдущий месяц
    previous_month = now.month - 1 if now.month > 1 else 12
    previous_month_year = now.year if now.month > 1 else now.year - 1
    previous_month_start = datetime(previous_month_year, previous_month, 1)
    from calendar import monthrange
    previous_month_end = datetime(previous_month_year, previous_month, monthrange(previous_month_year, previous_month)[1])
    return [
        (current_month_start.date(), today),
        (previous_month_start.date(), previous_month_end.date())
    ]


def find_latest_inspection(reports_by_insp_id: Dict[str, List[RetailiQAReportItem]]) -> Optional[tuple]:
    """
    Возвращает (insp_id, insp_date) последней проверки за текущий месяц,
    если нет — за предыдущий месяц. Если нет вообще — None.
    """
    now = datetime.now()
    current_month_start = datetime(now.year, now.month, 1)
    previous_month = now.month - 1 if now.month > 1 else 12
    previous_month_year = now.year if now.month > 1 else now.year - 1
    previous_month_start = datetime(previous_month_year, previous_month, 1)
    from calendar import monthrange
    previous_month_end = datetime(previous_month_year, previous_month, monthrange(previous_month_year, previous_month)[1])
    # 1. Ищем последнюю проверку в текущем месяце
    latest_insp_id = None
    latest_insp_date = None
    for insp_id, items in reports_by_insp_id.items():
        if not items:
            continue
        first_item = items[0]
        try:
            day, month, year = map(int, first_item.insp_date.split('.'))
            insp_date = datetime(year, month, day)
            if insp_date >= current_month_start and (latest_insp_date is None or insp_date > latest_insp_date):
                latest_insp_id = insp_id
                latest_insp_date = insp_date
        except Exception:
            continue
    if latest_insp_id is not None:
        return latest_insp_id, latest_insp_date
    # 2. Если не нашли — ищем последнюю в предыдущем месяце
    prev_month_latest_id = None
    prev_month_latest_date = None
    for insp_id, items in reports_by_insp_id.items():
        if not items:
            continue
        first_item = items[0]
        try:
            day, month, year = map(int, first_item.insp_date.split('.'))
            insp_date = datetime(year, month, day)
            if previous_month_start <= insp_date <= previous_month_end and (prev_month_latest_date is None or insp_date > prev_month_latest_date):
                prev_month_latest_id = insp_id
                prev_month_latest_date = insp_date
        except Exception:
            continue
    if prev_month_latest_id is not None:
        logging.info(f"Проверок не было в текущем месяце. Используем последнюю проверку предыдущего месяца: insp_id={prev_month_latest_id}, дата={prev_month_latest_date}")
        return prev_month_latest_id, prev_month_latest_date
    return None


def is_acceptable_status(state_message: str) -> bool:
    """
    Проверяет, является ли статус отчёта допустимым для обработки.
    Возвращает True, если статус допустим, иначе False.
    """
    ACCEPTABLE_STATUSES = ["Закрыта", "Работа над ошибками", "Подписание"]
    return state_message in ACCEPTABLE_STATUSES 