"""
Модуль для генерации Excel-файлов инвентаризации.

- Используется для формирования отчётов по инвентаризации (склад, кухня и т.д.)
- Поддерживает красивое форматирование, группировку категорий, сортировку, автоподбор ширины столбцов и пояснения.
- Можно использовать как для сохранения на диск, так и для отдачи через StreamingResponse.

Аргументы:
    inventory_data: dict — структура инвентаря (категории -> товары)
    metadata: dict — метаданные (например, автор, дата, филиал)
    group_title: str — название группы/филиала

Возвращает:
    BytesIO — поток с Excel-файлом
"""
import pandas as pd
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from io import BytesIO
from datetime import datetime
from typing import Dict, Any
import logging
from .excel_template import (
    EXCEL_MAIN_ITEMS, EXCEL_SEMIFINISHED, EXCEL_DRINKS, EXCEL_PACKAGING, EXCEL_DESSERTS, EXCEL_BAR
)

logger = logging.getLogger(__name__)

HEADER_FILL = PatternFill(start_color='FF5F1F', end_color='FF5F1F', fill_type='solid')
SECTION_FILL = PatternFill(start_color='F2F2F2', end_color='F2F2F2', fill_type='solid')
HEADER_FONT = Font(bold=True, color="FFFFFF")
SECTION_FONT = Font(bold=True)
BORDER_THIN = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

COLUMNS = ['№ п/п', 'Секция', 'Наименование', 'Сырье (шт.)', 'Полуфабрикаты (шт.)']


def set_auto_width(worksheet):
    for col in worksheet.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except Exception:
                pass
        adjusted_width = max(10, min(max_length + 2, 40))
        worksheet.column_dimensions[column].width = adjusted_width


def style_table(worksheet, start_row, end_row, start_col, end_col, header_row=None):
    for row in worksheet.iter_rows(min_row=start_row, max_row=end_row, min_col=start_col, max_col=end_col):
        for cell in row:
            cell.border = BORDER_THIN
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    if header_row:
        for cell in worksheet[header_row]:
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)


def style_section_header(worksheet, row_idx, col_count):
    for col in range(1, col_count + 1):
        cell = worksheet.cell(row=row_idx, column=col)
        cell.font = SECTION_FONT
        cell.fill = SECTION_FILL
        cell.alignment = Alignment(horizontal='left', vertical='center')
        cell.border = BORDER_THIN


def generate_inventory_excel(
    inventory_data: Dict[str, Any],
    metadata: Dict[str, Any],
    group_title: str
) -> BytesIO:
    """
    Генерирует Excel-файл инвентаризации по единому шаблону для всех секций.
    """
    output = BytesIO()
    try:
        rows = []
        # --- 1. Основная таблица ---
        for idx, (category, item_name) in enumerate(EXCEL_MAIN_ITEMS, 1):
            item_data = inventory_data.get(category, {}).get(item_name, {})
            raw = item_data.get('raw', {})
            semifinished = item_data.get('semifinished', {})
            raw_qty = raw.get('quantity') if isinstance(raw, dict) else None
            semifin_qty = semifinished.get('quantity') if isinstance(semifinished, dict) else None
            raw_display = "Нет в наличии" if isinstance(raw, dict) and raw.get('isOutOfStock') else raw_qty
            semifin_display = semifin_qty
            rows.append({
                '№ п/п': idx,
                'Секция': category,
                'Наименование': item_name,
                'Сырье (шт.)': raw_display if raw_display is not None else '',
                'Полуфабрикаты (шт.)': semifin_display if semifin_display is not None else ''
            })
        # --- 2. Полуфабрикаты ---
        rows.append({'№ п/п': '', 'Секция': 'Полуфабрикаты', 'Наименование': '', 'Сырье (шт.)': '', 'Полуфабрикаты (шт.)': ''})
        for idx, item_name in enumerate(EXCEL_SEMIFINISHED, 1):
            found = None
            for cat, items in inventory_data.items():
                if item_name in items:
                    found = items[item_name]
                    break
            raw = found.get('raw', {}) if found else {}
            semifinished = found.get('semifinished', {}) if found else {}
            raw_qty = raw.get('quantity') if isinstance(raw, dict) else None
            semifin_qty = semifinished.get('quantity') if isinstance(semifinished, dict) else None
            rows.append({
                '№ п/п': idx,
                'Секция': '',
                'Наименование': item_name,
                'Сырье (шт.)': raw_qty if raw_qty is not None else '',
                'Полуфабрикаты (шт.)': semifin_qty if semifin_qty is not None else ''
            })
        # --- 3. Напитки ---
        rows.append({'№ п/п': '', 'Секция': 'Напитки', 'Наименование': '', 'Сырье (шт.)': '', 'Полуфабрикаты (шт.)': ''})
        for idx, item_name in enumerate(EXCEL_DRINKS, 1):
            found = None
            for cat, items in inventory_data.items():
                if item_name in items:
                    found = items[item_name]
                    break
            raw = found.get('raw', {}) if found else {}
            raw_qty = raw.get('quantity') if isinstance(raw, dict) else None
            rows.append({
                '№ п/п': idx,
                'Секция': '',
                'Наименование': item_name,
                'Сырье (шт.)': raw_qty if raw_qty is not None else '',
                'Полуфабрикаты (шт.)': ''
            })
        # --- 4. Упаковка и приборы ---
        rows.append({'№ п/п': '', 'Секция': 'Упаковка и приборы', 'Наименование': '', 'Сырье (шт.)': '', 'Полуфабрикаты (шт.)': ''})
        for idx, item_name in enumerate(EXCEL_PACKAGING, 1):
            found = None
            for cat, items in inventory_data.items():
                if item_name in items:
                    found = items[item_name]
                    break
            raw = found.get('raw', {}) if found else {}
            raw_qty = raw.get('quantity') if isinstance(raw, dict) else None
            rows.append({
                '№ п/п': idx,
                'Секция': '',
                'Наименование': item_name,
                'Сырье (шт.)': raw_qty if raw_qty is not None else '',
                'Полуфабрикаты (шт.)': ''
            })
        # --- 5. Десерты ---
        rows.append({'№ п/п': '', 'Секция': 'Десерты', 'Наименование': '', 'Сырье (шт.)': '', 'Полуфабрикаты (шт.)': ''})
        for idx, item_name in enumerate(EXCEL_DESSERTS, 1):
            found = None
            for cat, items in inventory_data.items():
                if item_name in items:
                    found = items[item_name]
                    break
            raw = found.get('raw', {}) if found else {}
            raw_qty = raw.get('quantity') if isinstance(raw, dict) else None
            rows.append({
                '№ п/п': idx,
                'Секция': '',
                'Наименование': item_name,
                'Сырье (шт.)': raw_qty if raw_qty is not None else '',
                'Полуфабрикаты (шт.)': ''
            })
        # --- 6. Бар (по подгруппам) ---
        rows.append({'№ п/п': '', 'Секция': 'Бар', 'Наименование': '', 'Сырье (шт.)': '', 'Полуфабрикаты (шт.)': ''})
        for subgroup, items in EXCEL_BAR.items():
            rows.append({'№ п/п': '', 'Секция': subgroup, 'Наименование': '', 'Сырье (шт.)': '', 'Полуфабрикаты (шт.)': ''})
            for idx, item_name in enumerate(items, 1):
                found = None
                for cat, cat_items in inventory_data.items():
                    if item_name in cat_items:
                        found = cat_items[item_name]
                        break
                raw = found.get('raw', {}) if found else {}
                raw_qty = raw.get('quantity') if isinstance(raw, dict) else None
                rows.append({
                    '№ п/п': idx,
                    'Секция': '',
                    'Наименование': item_name,
                    'Сырье (шт.)': raw_qty if raw_qty is not None else '',
                    'Полуфабрикаты (шт.)': ''
                })
        # --- Excel запись и оформление ---
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            author_first_name = metadata.get('currentUser', {}).get('first_name', '')
            author_last_name = metadata.get('currentUser', {}).get('last_name', '')
            author_full_name = f"{author_first_name} {author_last_name}".strip()
            meta_info = {
                'Поле': ['Дата:', 'Филиал:', 'Автор:'],
                'Значение': [
                    datetime.now().strftime('%d.%m.%Y %H:%M'),
                    group_title,
                    author_full_name if author_full_name else 'Не указан'
                ]
            }
            metadata_df = pd.DataFrame(meta_info)
            metadata_df.to_excel(writer, sheet_name='Инвентаризация', index=False, header=False, startrow=0)
            worksheet = writer.sheets['Инвентаризация']
            df = pd.DataFrame(rows, columns=COLUMNS)
            df.to_excel(writer, sheet_name='Инвентаризация', index=False, startrow=5)
            header_row = 6
            end_row = header_row + len(df)
            style_table(worksheet, header_row, end_row, 1, len(COLUMNS), header_row=header_row)
            set_auto_width(worksheet)
            # Оформление секций (заливка и жирный для строк, где есть только название секции)
            for row_idx in range(header_row, end_row + 1):
                секция = worksheet.cell(row=row_idx, column=2).value
                if секция and секция.strip() and all(worksheet.cell(row=row_idx, column=col).value in (None, '', секция) for col in range(3, len(COLUMNS)+1)):
                    style_section_header(worksheet, row_idx, len(COLUMNS))
        output.seek(0)
        logger.info("Excel generation finished successfully (unified template)")
        return output
    except Exception as e:
        logger.exception(f"Error generating Excel content: {e}")
        return BytesIO()  # Возвращаем пустой поток при ошибке 