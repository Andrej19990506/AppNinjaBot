from typing import List, Dict, Optional
from datetime import datetime

def build_result_notification(event_date: datetime, object_name: str, score_percentage: Optional[float], total_earned_points: int, total_possible_points: int, penalty_points: float, detailed_violations: List[Dict]) -> str:
    """Генерирует текст одноразового уведомления с результатами проверки."""
    message = f"<b>🔵 Результаты проверки АТО от {event_date.strftime('%d.%m.%Y')}</b>\n\n"
    message += f"<b>Объект:</b> {object_name}\n"
    if score_percentage is not None:
        emoji = '🔵✓' if score_percentage >= 85 else '⚠️' if score_percentage >= 70 else '❌'
        message += f"<b>Результат:</b> {emoji} {score_percentage:.1f}% выполнения\n"
        message += f"<b>Баллы:</b> {total_earned_points} из {total_possible_points}\n"
    message += f"<b>Штрафные баллы:</b> {penalty_points}\n\n"
    if detailed_violations:
        message += "<b>⚠️ Замечания:</b>\n"
        message += "<pre>┌───────────────────┬─────────────┬──────────┐\n"
        message += "│       ПУНКТ       │ КОММЕНТАРИЙ │  ШТРАФ   │\n"
        message += "├───────────────────┼─────────────┼──────────┤\n"
        for viol in detailed_violations:
            point_name = viol['title']
            point_comment = viol['text'] if viol['text'] else "-"
            penalty_val = viol['penalty']
            if len(point_name) > 17: point_name = point_name[:15] + ".."
            if len(point_comment) > 11: point_comment = point_comment[:9] + ".."
            message += f"│ {point_name.ljust(17)} │ {point_comment.ljust(11)} │ {str(penalty_val).rjust(8)} │\n"
        message += "└───────────────────┴─────────────┴──────────┘</pre>\n\n"
        message += "<b>Детали замечаний:</b>\n"
        for i, viol in enumerate(detailed_violations, 1):
            message += f"{i}. {viol['title']}"
            if viol['text']:
                message += f": {viol['text']}"
            message += f" (Штраф: {viol['penalty']})\n\n"
    else:
        message += "<b>✅ Замечаний нет</b>\n"
    return message

def build_daily_reminder(event_date: datetime, object_name: str, detailed_violations: List[Dict]) -> str:
    """Генерирует текст ежедневного напоминания о проблемных пунктах."""
    message = f"<b>⚠️ Внимание! Обратите внимание на эти пункты АТО</b>\n\n"
    message += f"<b>Объект:</b> {object_name}\n\n"
    message += "<b>По этим пунктам были проблемы на прошлой проверке:</b>\n"
    for i, viol in enumerate(detailed_violations, 1):
        message += f"{i}. {viol['title']} (Штраф: {viol['penalty']})\n"
    return message 