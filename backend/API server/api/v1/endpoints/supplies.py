from fastapi import APIRouter, Query, HTTPException, status, Depends
from typing import Optional, Dict, Any, Tuple, List
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from loguru import logger
import os
from pathlib import Path
from datetime import datetime, date
from sqlalchemy.orm import Session
import httpx
from pydantic import BaseModel
import time

# Импорты для работы с БД и схемами
from db.session import get_db
from schemas.delivery import (
    DeliveryAcceptRequest, DeliveryAcceptResponse, DeliveryRead, 
    DeliveryListResponse, DeliveryFilters, DeliveryStats
)
from services.delivery_service import DeliveryService


router = APIRouter()


def _load_service_account_credentials() -> service_account.Credentials:
    """
    Загружает креды сервисного аккаунта из файла.
    Поиск пути:
    1) env GOOGLE_APPLICATION_CREDENTIALS
    2) файл appninjabotcontent-330206f13743.json в корне репозитория
    """
    logger.info("🔑 Начинаем загрузку креденшиалов Google Sheets...")
    start_time = time.time()
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    candidate_paths = []

    if credentials_path:
        candidate_paths.append(Path(credentials_path))

    # 1) Текущая рабочая директория (корень проекта), файл в корне
    candidate_paths.append(Path(os.getcwd()) / "appninjabotcontent-330206f13743.json")

    # 2) Поиск вверх от текущего файла до 6 уровней
    current_dir = Path(__file__).resolve().parent
    for _ in range(6):
        candidate_paths.append(current_dir / "appninjabotcontent-330206f13743.json")
        current_dir = current_dir.parent

    # 3) Новое стандартное место: общий шаред каталога приложения
    candidate_paths.append(Path("/app/shared/appninjabotcontent-330206f13743.json"))

    # Выбор первого существующего пути
    found_path: Optional[Path] = next((p for p in candidate_paths if p and p.is_file()), None)
    if not found_path:
        raise FileNotFoundError("Не найден файл сервисного аккаунта. Установите переменную окружения GOOGLE_APPLICATION_CREDENTIALS или поместите JSON в корень проекта.")

    credentials_path = str(found_path)
    logger.info(f"📁 Используется файл сервисного аккаунта: {credentials_path}")
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    
    creds_start = time.time()
    creds = service_account.Credentials.from_service_account_file(credentials_path, scopes=scopes)
    creds_time = time.time() - creds_start
    
    total_time = time.time() - start_time
    logger.info(f"✅ Креденшиалы загружены за {creds_time:.3f}с (общее время: {total_time:.3f}с)")
    
    return creds


@router.get("/supplies", summary="Чтение данных поставок из Google Sheets", tags=["Supplies"])
def read_supplies(
    spreadsheet_id: str = Query(..., description="ID таблицы Google Sheets"),
    range_: str = Query(..., alias="range", description="A1-диапазон. Можно без имени листа: 'A1:E100'"),
    sheet_gid: Optional[int] = Query(None, description="Необязательно: gid листа из URL"),
    value_render_option: Optional[str] = Query("UNFORMATTED_VALUE", description="RAW|UNFORMATTED_VALUE|FORMATTED_VALUE"),
    normalize: bool = Query(True, description="Преобразовать в записи с датами и количеством"),
    dates_only: bool = Query(False, description="Вернуть только список датовых колонок"),
    date: Optional[str] = Query(None, description="Фильтр по дате в формате YYYY-MM-DD"),
    exclude_zero: bool = Query(True, description="Исключать позиции с количеством 0/пусто"),
    mode: str = Query("row", description="row|table|hybrid: источник цены (row — из строки; table — из листа Инфо по категории и дате; hybrid — Инфо, но если в строке своя цена — она)"),
    info_sheet_name: str = Query("Инфо", description="Название листа с историей цен"),
    debug: Optional[bool] = Query(None, description="Вернуть построчную отладку расчёта по формуле листа"),
) -> Dict[str, Any]:
    """
    Возвращает значения из указанного диапазона Google Sheets. Предназначено для первичного теста через Postman.
    Пример запроса:
    GET /v1/supplies?spreadsheet_id=...&range=Лист1!A1:E100
    """
    logger.info(f"📊 Начинаем чтение данных из Google Sheets: {spreadsheet_id}")
    total_start = time.time()
    
    try:
        creds = _load_service_account_credentials()
    except FileNotFoundError as e:
        logger.error(str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.exception("Ошибка загрузки кредов сервисного аккаунта")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ошибка аутентификации Google API")

    def _ensure_sheet_title_and_range(svc, ssid: str, rng: str, gid: Optional[int]) -> str:
        # Если уже указано имя листа (есть '!'), обернём имя в кавычки при необходимости
        if "!" in rng:
            sheet_part, cell_part = rng.split("!", 1)
            sheet_part = sheet_part.strip()
            # Если не в одинарных кавычках — добавим, т.к. могут быть пробелы/кириллица/точки
            if not (sheet_part.startswith("'") and sheet_part.endswith("'")):
                sheet_part = f"'{sheet_part}'"
            return f"{sheet_part}!{cell_part}"

        # Иначе: если есть gid — получим title по gid
        title: Optional[str] = None
        if gid is not None:
            meta = svc.spreadsheets().get(spreadsheetId=ssid, fields="sheets.properties").execute()
            for s in meta.get("sheets", []):
                props = s.get("properties", {})
                if props.get("sheetId") == gid:
                    title = props.get("title")
                    break
        # Если не нашли по gid — используем первый лист
        if title is None:
            meta = svc.spreadsheets().get(spreadsheetId=ssid, fields="sheets(properties(sheetId,title))").execute()
            sheets = meta.get("sheets", [])
            if not sheets:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="В таблице нет листов")
            title = sheets[0].get("properties", {}).get("title", "Sheet1")

        return f"'{title}'!{rng}"

    try:
        # Этап 1: Создание сервиса
        service_start = time.time()
        service = build("sheets", "v4", credentials=creds, cache_discovery=False)
        service_time = time.time() - service_start
        logger.info(f"🔧 Google Sheets сервис создан за {service_time:.3f}с")
        
        # Этап 2: Нормализация диапазона
        range_start = time.time()
        normalized_range = _ensure_sheet_title_and_range(service, spreadsheet_id, range_, sheet_gid)
        range_time = time.time() - range_start
        logger.info(f"📋 Диапазон нормализован за {range_time:.3f}с: {normalized_range}")
        
        # Этап 3: Выполнение запроса к API
        api_start = time.time()
        sheet = service.spreadsheets()
        request = sheet.values().get(
            spreadsheetId=spreadsheet_id,
            range=normalized_range,
            valueRenderOption=value_render_option,
        )
        result = request.execute()
        api_time = time.time() - api_start
        logger.info(f"🌐 API запрос выполнен за {api_time:.3f}с")
        
        values: List[List[Any]] = result.get("values", [])
        total_time = time.time() - total_start
        logger.info(f"✅ Данные получены: {len(values)} строк за {total_time:.3f}с")

        # Определяем, включён ли debug по умолчанию (dev-среда)
        env_lower = os.getenv("APP_ENV", "").lower()
        is_dev_env = env_lower in ("dev", "development") or os.getenv("DEBUG", "0").lower() in ("1", "true", "yes")
        debug_enabled = debug if debug is not None else is_dev_env

        if not normalize:
            return {
                "spreadsheetId": result.get("spreadsheetId", spreadsheet_id),
                "range": result.get("range", normalized_range),
                "majorDimension": result.get("majorDimension", "ROWS"),
                "values": values,
                "rows": len(values),
                "cols": max((len(r) for r in values), default=0),
            }

        def as_text(x: Any) -> str:
            return "" if x is None else str(x).strip()

        def parse_number(x: Any) -> Optional[float]:
            s = as_text(x)
            if not s:
                return None
            # Удаляем всё кроме цифр, точки и запятой
            import re
            s = re.sub(r"[^0-9,\.]+", "", s)
            if not s:
                return None
            s = s.replace(",", ".")
            try:
                return float(s)
            except ValueError:
                return None

        # Конвертация Google serial number -> ISO (1899-12-30 base)
        from datetime import datetime, timedelta
        def parse_date_cell(cell: Any) -> Optional[str]:
            # Число -> serial
            try:
                num = float(cell)
                if num > 20000:  # грубая эвристика
                    base = datetime(1899, 12, 30)
                    dt = base + timedelta(days=int(num))
                    return dt.strftime("%Y-%m-%d")
            except Exception:
                pass
            # Текстовые даты на русском
            import re
            txt = as_text(cell).lower()
            if not txt:
                return None
            month_map = {
                "янв": 1, "фев": 2, "мар": 3, "апр": 4, "май": 5, "мая": 5,
                "июн": 6, "июл": 7, "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12,
            }
            m = re.match(r"^(\d{1,2})[\./](\d{1,2})([\./](\d{2,4}))?$", txt)
            if m:
                d, mm = int(m.group(1)), int(m.group(2))
                yy = m.group(4)
                yyyy = int(yy) + 2000 if yy and len(yy) == 2 else (int(yy) if yy else 2025)
                return f"{yyyy:04d}-{mm:02d}-{d:02d}"
            m = re.match(r"^(\d{1,2})\s*(янв|фев|мар|апр|ма[йй]|июн|июл|авг|сен|окт|ноя|дек)\.?$", txt)
            if m:
                d = int(m.group(1))
                mon = m.group(2)[:3]
                mm = month_map.get(mon)
                if mm:
                    return f"2025-{mm:02d}-{d:02d}"
            return None

        # --- Поиск строк заголовков ---
        header_row_idx = None
        for i, row in enumerate(values[:10]):  # ищем в первых 10 строках
            if any(as_text(c).lower() == "наименование" for c in row):
                header_row_idx = i
                break
        if header_row_idx is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не найден заголовок 'Наименование'")

        header_row = values[header_row_idx]

        # Определяем индексы колонок по подписям
        def find_col(label: str, search_rows: List[List[Any]]) -> Optional[int]:
            label_l = label.lower()
            for r in search_rows:
                for j, c in enumerate(r):
                    if as_text(c).lower() == label_l:
                        return j
            return None

        name_col = find_col("Наименование", [header_row])
        unit_col = find_col("Ед.изм", [header_row])
        # Цена/Поставщик иногда выше строкой — ищем в паре верхних строк
        price_col = find_col("Цена", values[max(0, header_row_idx-2):header_row_idx+1])
        supplier_col = find_col("Поставщик", values[max(0, header_row_idx-2):header_row_idx+1])
        status_col = find_col("Статус", values[max(0, header_row_idx-2):header_row_idx+1])

        # Дата-колонки часто находятся на строку выше/ниже. Сканируем окно ±3 строки.
        import re
        date_cols: List[Tuple[int, str]] = []
        start_i = max(0, header_row_idx - 3)
        end_i = min(len(values), header_row_idx + 4)
        for r_idx in range(start_i, end_i):
            row_scan = values[r_idx]
            for j, cell in enumerate(row_scan):
                iso = parse_date_cell(cell)
                if iso:
                    date_cols.append((j, iso))
        # Уникализируем по индексу колонки, оставляя первое встреченное название
        seen = set()
        uniq_date_cols: List[Tuple[int, str]] = []
        for j, lbl in date_cols:
            if j not in seen:
                seen.add(j)
                uniq_date_cols.append((j, lbl))
        date_cols = uniq_date_cols

        # Отфильтруем явные ложные ранние колонки (левый блок до дат), обычно даты начинаются с колонки H (индекс 7)
        date_cols = [(j, d) for (j, d) in date_cols if j >= 7]

        # Если явно не нашли дат — fallback: после колонки 'Итого за мес' (обычно G), берём H..конец и пытаемся распарсить верхние 3 строки
        if not date_cols:
            # найти индекс колонки с текстом 'Итого за мес'
            marker_col = None
            for r in values[:5]:
                for j, c in enumerate(r):
                    if as_text(c).lower().startswith("итого за мес"):
                        marker_col = j
                        break
                if marker_col is not None:
                    break
            start_col = (marker_col + 1) if marker_col is not None else 7  # по умолчанию H
            for j in range(start_col, max(len(r) for r in values[:8])):
                # смотрим в верхних строках окно для даты
                iso = None
                for r_idx in range(start_i, end_i):
                    row_scan = values[r_idx]
                    if j < len(row_scan):
                        iso = parse_date_cell(row_scan[j]) or iso
                if iso:
                    date_cols.append((j, iso))

        if dates_only:
            return {
                "spreadsheetId": result.get("spreadsheetId", spreadsheet_id),
                "range": result.get("range", normalized_range),
                "date_columns": [
                    {"col_index": j, "date": iso}
                    for j, iso in date_cols
                ],
                "count": len(date_cols),
            }

        # Линия с лимитами (фиксированный лимит): строка, где в колонке Наименование указано 'Лимит'
        fixed_limit_row_idx = None
        scan_rows_top = min(len(values), max(header_row_idx + 6, 12))
        for i in range(scan_rows_top):
            row = values[i]
            if name_col is not None and name_col < len(row):
                if as_text(row[name_col]).lower() == "лимит":
                    fixed_limit_row_idx = i
                    break
        fixed_limit_row = values[fixed_limit_row_idx] if fixed_limit_row_idx is not None else []

        # Линия с фактическим заказом (опционально): строка с текстом 'Ваш заказ' в любой колонке
        order_row_idx = None
        for i, row in enumerate(values[:header_row_idx+6]):
            if any(as_text(c).lower().startswith("ваш заказ") for c in row):
                order_row_idx = i
                break
        order_row = values[order_row_idx] if order_row_idx is not None else []

        # Маппинг русских месяцев
        month_map = {
            "янв": 1, "фев": 2, "мар": 3, "апр": 4, "май": 5, "мая": 5,
            "июн": 6, "июл": 7, "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12,
        }

        def parse_date_label(label: str) -> Optional[str]:
            label = label.strip().lower()
            # варианты: "1 авг.", "01.08", "4 авг"
            m = re.match(r"^(\d{1,2})[\./](\d{1,2})$", label)
            if m:
                d, mm = int(m.group(1)), int(m.group(2))
                return f"2025-{mm:02d}-{d:02d}"
            m = re.match(r"^(\d{1,2})\s*(янв|фев|мар|апр|ма[йй]|июн|июл|авг|сен|окт|ноя|дек)\.?$", label)
            if m:
                d = int(m.group(1))
                mon = m.group(2)[:3]
                mm = month_map.get(mon)
                if mm:
                    return f"2025-{mm:02d}-{d:02d}"
            return None

        # Если запрошена конкретная дата — оставим только её колонку(и)
        if date:
            date_cols = [(j, d) for (j, d) in date_cols if d == date]

        # Этап 5: Обработка данных
        processing_start = time.time()
        records: List[Dict[str, Any]] = []
        logger.info(f"🔄 Начинаем обработку {len(values)} строк данных...")
        
        # --- Прайс из листа Инфо ---
        # Формула листа использует cat = INDEX($B7:$B; idx) — это Наименование в текущем листе.
        # В листе 'Инфо' колонка D содержит то же поле (Наименование), H — цена, I — дата.
        # Значит матчим по Наименованию и берём цену с максимальной датой <= дате колонки.
        info_prices_by_name: Dict[str, List[Tuple[str, float]]] = {}
        if mode in ("table", "hybrid"):
            logger.info(f"📊 Загружаем данные из листа '{info_sheet_name}' для получения цен...")
            info_start = time.time()
            try:
                info_range = f"'{info_sheet_name}'!D:I"
                info_req = sheet.values().get(
                    spreadsheetId=spreadsheet_id,
                    range=info_range,
                    valueRenderOption="UNFORMATTED_VALUE",
                )
                info_res = info_req.execute()
                info_vals: List[List[Any]] = info_res.get("values", [])
                for r in info_vals:
                    # ожидается: D=Наименование (индекс 0), H=цена (индекс 4), I=дата (индекс 5)
                    if len(r) < 6:
                        continue
                    item_name_key = "" if r[0] is None else str(r[0]).strip()
                    price_val = None
                    try:
                        price_val = parse_number(r[4])
                    except Exception:
                        price_val = None
                    date_iso_val = parse_date_cell(r[5])
                    if not item_name_key or price_val is None or not date_iso_val:
                        continue
                    info_prices_by_name.setdefault(item_name_key, []).append((date_iso_val, float(price_val)))
                # сортировка по дате возрастания
                for n_key in list(info_prices_by_name.keys()):
                    info_prices_by_name[n_key].sort(key=lambda t: t[0])
                
                info_time = time.time() - info_start
                logger.info(f"📊 Данные из листа '{info_sheet_name}' загружены за {info_time:.3f}с: {len(info_prices_by_name)} товаров")
            except Exception:
                info_prices_by_name = {}
                info_time = time.time() - info_start
                logger.warning(f"⚠️ Не удалось загрузить данные из листа '{info_sheet_name}' за {info_time:.3f}с")
        total_quantity: float = 0.0
        total_cost: float = 0.0
        withdrawn_quantity: float = 0.0
        withdrawn_cost: float = 0.0
        sheet_total: float = 0.0
        # агрегаты лимитов по выбранной дате
        limit_value: Optional[float] = None  # фиксированный лимит из строки 'Лимит'
        filled_limit_value: Optional[float] = None  # опционально, из 'Ваш заказ'

        # Проходим по строкам с товарами
        current_category: Optional[str] = None
        logger.info(f"🔄 Обрабатываем строки с {header_row_idx + 1} по {len(values)}...")
        rows_start = time.time()
        for i in range(header_row_idx + 1, len(values)):
            row = values[i]
            name = as_text(row[name_col]) if name_col is not None and name_col < len(row) else ""
            if not name:
                continue
            # пропускаем строки разделов и пометок
            if name.lower().startswith("раздел."):
                # сохраняем текущую категорию и пропускаем строку-раздел
                current_category = name.replace("Раздел.", "").strip()
                continue
            if name.lower() in ("сумма заявки", "черноголовка", "лимит"):
                continue

            unit = as_text(row[unit_col]) if unit_col is not None and unit_col < len(row) else ""
            row_price = parse_number(row[price_col]) if price_col is not None and price_col < len(row) else None
            supplier = as_text(row[supplier_col]) if supplier_col is not None and supplier_col < len(row) else ""
            status_val = as_text(row[status_col]) if status_col is not None and status_col < len(row) else ""
            is_withdrawn = status_val.lower().startswith("выведено")

            for j, date_label in date_cols:
                if j >= len(row):
                    qty = None
                else:
                    qty = parse_number(row[j])
                limit_val = parse_number(fixed_limit_row[j]) if j < len(fixed_limit_row) else None
                order_val = parse_number(order_row[j]) if j < len(order_row) else None
                date_iso = date_label if date else parse_date_label(date_label)
                if date_iso is None and qty is None and limit_val is None:
                    continue
                if exclude_zero and (qty is None or qty == 0):
                    continue
                # Определяем дату
                item_date_iso = date_iso
                # Резолвим цену согласно режиму (по Наименованию из листа Инфо)
                resolved_price = row_price
                price_from_info = False
                if mode in ("table", "hybrid") and name and item_date_iso:
                    hist = info_prices_by_name.get(name)
                    if hist:
                        candidates = [(d, p) for (d, p) in hist if d <= item_date_iso]
                        if candidates:
                            _, info_price_val = candidates[-1]
                            if mode == "table" or row_price is None:
                                resolved_price = info_price_val
                                price_from_info = True
                        else:
                            # В режиме table, если нет цены в Инфо на дату — считаем как 0 (как формула)
                            if mode == "table":
                                resolved_price = None
                    else:
                        if mode == "table":
                            resolved_price = None
                item_total = (resolved_price or 0) * (qty or 0)
                total_quantity += (qty or 0)
                total_cost += item_total
                # сохраняем пометку, но не вычитаем из итогов
                if is_withdrawn:
                    withdrawn_quantity += (qty or 0)
                    withdrawn_cost += item_total
                # Запоминаем лимиты для текущей даты (берём одно значение на дату)
                if limit_value is None and limit_val is not None:
                    limit_value = limit_val
                if filled_limit_value is None and order_val is not None:
                    filled_limit_value = order_val

                # sheet_total «как формула листа»: qty * цена из Инфо по Наименованию и макс(I) <= date
                # Формула также исключает строки, если qty пусто/0, name пусто, date пусто
                sheet_included = True
                sheet_reason = None
                matched_price = None
                matched_price_date = None
                if qty is None or (isinstance(qty, (int, float)) and qty == 0):
                    sheet_included = False
                    sheet_reason = "qty_empty_or_zero"
                elif not name:
                    sheet_included = False
                    sheet_reason = "empty_name"
                elif not item_date_iso:
                    sheet_included = False
                    sheet_reason = "empty_date"
                else:
                    hist2 = info_prices_by_name.get(name)
                    if not hist2:
                        sheet_included = False
                        sheet_reason = "no_info_prices_for_name"
                    else:
                        candidates2 = [(d, p) for (d, p) in hist2 if d <= item_date_iso]
                        if not candidates2:
                            sheet_included = False
                            sheet_reason = "no_price_before_or_on_date"
                        else:
                            matched_price_date, matched_price = candidates2[-1]
                            sheet_total += (matched_price or 0) * (qty or 0)
                records.append({
                    "name": f"{name} (Выведено)" if is_withdrawn else name,
                    "category": current_category,
                    "unit": unit,
                    "supplier": supplier,
                    "price": resolved_price,
                    "price_source": ("info" if price_from_info else "row"),
                    "date": item_date_iso,
                    "limit_for_date": limit_val,
                    "quantity_for_date": qty,
                    "item_total": item_total,
                    "status": status_val or None,
                    "is_withdrawn": is_withdrawn,
                    **({
                        "debug": {
                            "included_by_formula": sheet_included,
                            "exclude_reason": sheet_reason,
                            "info_price_date": matched_price_date,
                            "info_price_value": matched_price,
                        }
                    } if debug_enabled else {}),
                })

        rows_time = time.time() - rows_start
        logger.info(f"🔄 Обработка строк завершена за {rows_time:.3f}с")
        
        processing_time = time.time() - processing_start
        logger.info(f"✅ Обработка данных завершена за {processing_time:.3f}с: {len(records)} записей")

        # Этап 4: Формирование ответа
        response_start = time.time()
        resp = {
            "spreadsheetId": result.get("spreadsheetId", spreadsheet_id),
            "range": result.get("range", normalized_range),
            "items": records,
            "count": len(records),
            **({"date": date} if date else {}),
            "summary": {
                "total_quantity": total_quantity,
                "total_cost": total_cost,
                "limit": limit_value,
            },
        }
        if mode in ("table", "hybrid") or debug_enabled:
            resp["sheet_total"] = sheet_total
        
        response_time = time.time() - response_start
        total_time = time.time() - total_start
        logger.info(f"📋 Ответ сформирован за {response_time:.3f}с")
        logger.info(f"🎯 Общее время выполнения: {total_time:.3f}с")
        
        # Нет вычитания «выведено» — возвращаем только total и limit
        return resp
    except HttpError as e:
        # Обработка ошибок Google Sheets API
        error_status = e.resp.status
        error_message = str(e)
        
        logger.error(f"Google Sheets API ошибка {error_status}: {error_message}")
        
        if error_status == 403:
            # Ошибка прав доступа - передаем как 403 Forbidden
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"У бота нет прав доступа к Google Sheets. Обратитесь в техническую поддержку. Детали: {error_message}"
            )
        elif error_status == 404:
            # Таблица не найдена
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Google Sheets таблица или лист не найдены. Детали: {error_message}"
            )
        elif error_status == 400:
            # Неверный запрос (например, неправильный диапазон)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Неверный формат запроса к Google Sheets. Детали: {error_message}"
            )
        else:
            # Другие ошибки Google API
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Ошибка Google Sheets API ({error_status}): {error_message}"
            )
    except Exception as e:
        # Другие неожиданные ошибки
        logger.exception("Неожиданная ошибка при запросе к Google Sheets API")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Внутренняя ошибка сервера: {e}")


@router.post("/deliveries/accept", summary="Принятие поставки", tags=["Deliveries"])
def accept_delivery(
    delivery_request: DeliveryAcceptRequest,
    db: Session = Depends(get_db)
) -> DeliveryAcceptResponse:
    """
    Принятие поставки - создание записи о принятой поставке в БД.
    
    Пример запроса:
    ```json
    {
        "supplier": "ООО Шеф Арсенал",
        "branch": "Филиал №1",
        "delivery_date": "2025-01-16",
        "items": [
            {
                "name": "Масло сливочное",
                "category": "Молочные продукты",
                "unit": "кг",
                "quantity": 5.0,
                "price": 350.0,
                "is_checked": true
            }
        ],
        "accepted_by": {
            "name": "Иван Петров",
            "initials": "ИП",
            "user_id": 123,
            "telegram_id": 456789
        },
        "notes": "Поставка принята полностью"
    }
    ```
    """
    try:
        service = DeliveryService(db)
        
        # Преобразуем строку даты в datetime
        try:
            delivery_date = datetime.strptime(delivery_request.delivery_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат даты. Используйте YYYY-MM-DD"
            )
        
        # Создаем объект для создания поставки
        from schemas.delivery import DeliveryCreate
        delivery_create = DeliveryCreate(
            supplier=delivery_request.supplier,
            branch=delivery_request.branch,
            delivery_date=delivery_date,
            notes=delivery_request.notes,
            accepted_by=delivery_request.accepted_by,
            items=delivery_request.items
        )
        
        # Создаем поставку
        delivery = service.create_delivery(delivery_create)
        
        # Преобразуем в схему ответа
        delivery_read = DeliveryRead.from_orm(delivery)
        
        return DeliveryAcceptResponse(
            delivery_id=delivery.id,
            message=f"Поставка от {delivery.supplier} успешно принята",
            delivery=delivery_read
        )
        
    except Exception as e:
        logger.exception("Ошибка при принятии поставки")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        )


@router.get("/deliveries", summary="Список поставок", tags=["Deliveries"])
def get_deliveries(
    page: int = Query(1, ge=1, description="Номер страницы"),
    size: int = Query(20, ge=1, le=100, description="Размер страницы"),
    supplier: Optional[str] = Query(None, description="Фильтр по поставщику"),
    branch: Optional[str] = Query(None, description="Фильтр по филиалу"),
    status: Optional[str] = Query(None, description="Фильтр по статусу"),
    date_from: Optional[str] = Query(None, description="Дата с (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата по (YYYY-MM-DD)"),
    accepted_by: Optional[str] = Query(None, description="Кто принял"),
    include_stats: bool = Query(False, description="Включить статистику"),
    db: Session = Depends(get_db)
) -> DeliveryListResponse:
    """
    Получение списка поставок с фильтрами и пагинацией.
    
    Пример запроса:
    GET /v1/deliveries?page=1&size=10&supplier=Шеф&date_from=2025-01-01
    """
    try:
        service = DeliveryService(db)
        
        # Создаем фильтры
        filters = DeliveryFilters()
        if supplier:
            filters.supplier = supplier
        if branch:
            filters.branch = branch
        if status:
            filters.status = status
        if accepted_by:
            filters.accepted_by = accepted_by
        
        # Парсим даты
        if date_from:
            try:
                filters.date_from = datetime.strptime(date_from, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат date_from. Используйте YYYY-MM-DD"
                )
        
        if date_to:
            try:
                filters.date_to = datetime.strptime(date_to, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат date_to. Используйте YYYY-MM-DD"
                )
        
        # Вычисляем skip для пагинации
        skip = (page - 1) * size
        
        # Получаем поставки
        deliveries, total = service.get_deliveries(filters, skip, size)
        
        # Преобразуем в схемы ответа
        delivery_reads = [DeliveryRead.from_orm(d) for d in deliveries]
        
        # Вычисляем количество страниц
        pages = (total + size - 1) // size
        
        # Получаем статистику если нужно
        stats = None
        if include_stats:
            stats = service.get_delivery_stats(filters)
        
        return DeliveryListResponse(
            deliveries=delivery_reads,
            total=total,
            page=page,
            size=size,
            pages=pages,
            stats=stats
        )
        
    except Exception as e:
        logger.exception("Ошибка при получении списка поставок")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        )


@router.get("/deliveries/{delivery_id}", summary="Детали поставки", tags=["Deliveries"])
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db)
) -> DeliveryRead:
    """
    Получение деталей конкретной поставки по ID.
    
    Пример запроса:
    GET /v1/deliveries/123
    """
    try:
        service = DeliveryService(db)
        delivery = service.get_delivery(delivery_id)
        
        if not delivery:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Поставка с ID {delivery_id} не найдена"
            )
        
        return DeliveryRead.from_orm(delivery)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при получении поставки {delivery_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        )


@router.get("/deliveries/stats", summary="Статистика поставок", tags=["Deliveries"])
def get_delivery_stats(
    date_from: Optional[str] = Query(None, description="Дата с (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата по (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Фильтр по филиалу"),
    db: Session = Depends(get_db)
) -> DeliveryStats:
    """
    Получение статистики по поставкам.
    
    Пример запроса:
    GET /v1/deliveries/stats?date_from=2025-01-01&date_to=2025-01-31
    """
    try:
        service = DeliveryService(db)
        
        # Создаем фильтры для статистики
        filters = DeliveryFilters()
        if branch:
            filters.branch = branch
        
        if date_from:
            try:
                filters.date_from = datetime.strptime(date_from, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат date_from. Используйте YYYY-MM-DD"
                )
        
        if date_to:
            try:
                filters.date_to = datetime.strptime(date_to, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат date_to. Используйте YYYY-MM-DD"
                )
        
        return service.get_delivery_stats(filters)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ошибка при получении статистики поставок")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        )


@router.get("/deliveries/by-date/{target_date}", summary="Поставки за дату", tags=["Deliveries"])
def get_deliveries_by_date(
    target_date: str,
    db: Session = Depends(get_db)
) -> List[DeliveryRead]:
    """
    Получение всех поставок за определенную дату.
    
    Пример запроса:
    GET /v1/deliveries/by-date/2025-01-16
    """
    logger.info(f"🔍 [GET_DELIVERIES_BY_DATE] Запрос поставок за дату: {target_date}")
    
    try:
        # Парсим дату
        try:
            parsed_date = datetime.strptime(target_date, "%Y-%m-%d").date()
            logger.info(f"✅ [GET_DELIVERIES_BY_DATE] Дата успешно спарсена: {parsed_date}")
        except ValueError:
            logger.error(f"❌ [GET_DELIVERIES_BY_DATE] Неверный формат даты: {target_date}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат даты. Используйте YYYY-MM-DD"
            )
        
        logger.info(f"🔄 [GET_DELIVERIES_BY_DATE] Создаем DeliveryService...")
        service = DeliveryService(db)
        
        logger.info(f"📡 [GET_DELIVERIES_BY_DATE] Вызываем service.get_deliveries_by_date({parsed_date})...")
        deliveries = service.get_deliveries_by_date(parsed_date)
        
        logger.info(f"📊 [GET_DELIVERIES_BY_DATE] Найдено поставок в БД: {len(deliveries)}")
        
        for i, delivery in enumerate(deliveries):
            logger.info(f"📦 [DELIVERY {i+1}] ID: {delivery.id}, Supplier: {delivery.supplier}, Branch: {delivery.branch}, Status: {delivery.status}")
        
        result = [DeliveryRead.from_orm(d) for d in deliveries]
        logger.info(f"✅ [GET_DELIVERIES_BY_DATE] Возвращаем {len(result)} поставок в JSON формате")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при получении поставок за дату {target_date}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        )


@router.get("/deliveries/by-supplier/{supplier}", summary="Поставки по поставщику", tags=["Deliveries"])
def get_deliveries_by_supplier(
    supplier: str,
    db: Session = Depends(get_db)
) -> List[DeliveryRead]:
    """
    Получение всех поставок по поставщику.
    
    Пример запроса:
    GET /v1/deliveries/by-supplier/ООО%20Шеф%20Арсенал
    """
    try:
        service = DeliveryService(db)
        deliveries = service.get_deliveries_by_supplier(supplier)
        
        return [DeliveryRead.from_orm(d) for d in deliveries]
        
    except Exception as e:
        logger.exception(f"Ошибка при получении поставок по поставщику {supplier}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        )


# Схема для отправки уведомления о принятии поставки
class DeliveryNotificationRequest(BaseModel):
    chat_id: str
    supplier: str
    items: List[Dict[str, Any]]  # [{"name": "Товар", "quantity": 10, "unit": "кг", "notes": "Заметка"}]
    accepted_by: Dict[str, str]  # {"name": "Имя", "initials": "ИИ"}
    delivery_date: str
    branch: str


@router.post("/deliveries/send-notification", summary="Отправка уведомления о принятии поставки", tags=["Deliveries"])
async def send_delivery_notification(
    request: DeliveryNotificationRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Отправляет уведомление в Telegram чат о принятии поставки.
    
    Формирует красивое сообщение с информацией о:
    - Поставщике
    - Принятых товарах и их количестве
    - Кто принял поставку
    - Дате поставки
    - Филиале
    """
    logger.info(f"📢 [SEND_NOTIFICATION] Отправка уведомления о принятии поставки от {request.supplier}")
    
    try:
        # Формируем красивое сообщение
        message_lines = [
            f"📦 <b>Поставка принята!</b>",
            "",
            f"🏢 <b>Поставщик:</b> {request.supplier}",
            f"📍 <b>Филиал:</b> {request.branch}",
            f"📅 <b>Дата поставки:</b> {request.delivery_date}",
            "",
            f"📋 <b>Детали поставки:</b>"
        ]
        
        # Добавляем список товаров
        for item in request.items:
            item_line = f"• <b>{item['name']}</b> - {item['quantity']} {item['unit']}"
            
            # Если есть заметка к товару, добавляем её
            if item.get('notes') and item['notes'].strip():
                item_line += f"\n  ⚠️ <i>Проблема:</i> {item['notes']}"
            else:
                # Если заметки нет, добавляем стандартное сообщение
                item_line += f"\n  ✅ Позиция соответствует накладной"
            
            message_lines.append(item_line)
        
        message_lines.extend([
            "",
            f"👤 <b>Принял:</b> {request.accepted_by['name']} ({request.accepted_by['initials']})",
            f"⏰ <b>Время:</b> {datetime.now().strftime('%d.%m.%Y, %H:%M')}"
        ])
        
        message_text = "\n".join(message_lines)
        
        # Отправляем сообщение через Telegram бот API
        bot_api_url = os.getenv("BOT_API_URL", "http://bot:8003")
        if not bot_api_url:
            logger.error("❌ [SEND_NOTIFICATION] BOT_API_URL не задан в переменных окружения")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Конфигурация бота не найдена"
            )
        
        # Подготавливаем данные для отправки
        payload = {
            "chat_id": request.chat_id,
            "text": message_text,
            "parse_mode": "HTML"
        }
        
        logger.info(f"📡 [SEND_NOTIFICATION] Отправляем запрос в бот API: {bot_api_url}/send_message")
        logger.info(f"📋 [SEND_NOTIFICATION] Payload: {payload}")
        
        # Отправляем запрос к боту
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{bot_api_url}/send_message",
                json=payload
            )
            
            if response.status_code == 200:
                logger.info(f"✅ [SEND_NOTIFICATION] Уведомление успешно отправлено в чат {request.chat_id}")
                return {
                    "success": True,
                    "message": "Уведомление успешно отправлено в чат"
                }
            else:
                logger.error(f"❌ [SEND_NOTIFICATION] Ошибка отправки: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка отправки уведомления: {response.text}"
                )
        
    except httpx.TimeoutException:
        logger.error("❌ [SEND_NOTIFICATION] Таймаут при отправке уведомления")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Таймаут при отправке уведомления"
        )
    except Exception as e:
        logger.exception(f"❌ [SEND_NOTIFICATION] Неожиданная ошибка при отправке уведомления")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        )
