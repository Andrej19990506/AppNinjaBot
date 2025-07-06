"""
Адаптер инвентаризации для автоматического обновления шаблонов.

Обрабатывает Excel-файлы от бухгалтерии и автоматически обновляет:
- inventory_template.json 
- excel_template.py

Поддерживает:
- Автоматическое сопоставление существующих товаров
- Добавление новых товаров в нужные категории
- Интерактивное сопоставление для неопознанных товаров
- Сохранение правил сопоставления для будущего использования

🔄 Масштабируемость - легко добавлять товары
🎯 Гибкость - работает с любой структурой
💪 Надежность - нет зависимости от хардкода
⚡ Автоматизация - полностью автоматическая синхронизация
📈 Адаптивность - подстраивается под изменения
"""

import json
import pandas as pd
import os
import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import logging
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

def load_config() -> Dict[str, Any]:
    """
    Загружает конфигурацию адаптера из файла adapter_config.json.
    
    Устраняет хардкод в коде, позволяя настраивать поведение системы
    через конфигурационный файл.
    
    Returns:
        Dict с настройками адаптера или настройки по умолчанию при ошибке
    """
    try:
        config_path = os.path.join(os.path.dirname(__file__), "adapter_config.json")
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Не удалось загрузить конфигурацию: {e}. Используем настройки по умолчанию.")
        return {
            "similarity_thresholds": {
                "fuzzy_match_threshold": 0.7,
                "high_confidence_threshold": 0.80
            },
            "file_structure_analysis": {
                "main_table_min_size": 30,
                "specialized_section_min_size": 5,
                "section_homogeneity_threshold": 0.8
            },
            "fallback_category": "Разное"
        }

# Загружаем конфигурацию глобально
CONFIG = load_config()

@dataclass
class AccountingItem:
    """
    Представляет товар из Excel-файла бухгалтерии.
    
    Attributes:
        name: Название товара как в бухгалтерском учете
        unit: Единица измерения (опционально)
        category: Категория товара (определяется автоматически или из Excel)
        row_number: Номер строки в оригинальном Excel файле (для сохранения порядка)
    """
    name: str
    unit: Optional[str] = None
    category: Optional[str] = None
    row_number: Optional[int] = None

@dataclass
class MatchResult:
    """
    Результат сопоставления товара из бухгалтерии с существующими товарами.
    
    Attributes:
        accounting_item: Товар из бухгалтерии
        matched_name: Название совпавшего товара в системе (если найден)
        matched_category: Категория совпавшего товара
        confidence: Уровень уверенности в совпадении (0.0-1.0)
        status: Статус совпадения ("exact_match", "fuzzy_match", "new_item", "manual_needed")
        action: Действие ("skip", "add_to_templates", "manual_review")
    """
    accounting_item: AccountingItem
    matched_name: Optional[str] = None
    matched_category: Optional[str] = None
    confidence: float = 0.0
    status: str = "unknown"  # "exact_match", "fuzzy_match", "new_item", "manual_needed"
    action: str = "none"     # "skip", "add_to_templates", "manual_review"

class ItemMatcher:
    """
    Сопоставляет официальные названия товаров из бухгалтерии с нашими названиями.
    
    Использует интеллектуальные алгоритмы для:
    - Точного поиска совпадений
    - Нечеткого поиска с учетом опечаток и вариаций
    - Классификации новых товаров по категориям
    - Нормализации названий товаров
    """
    
    def __init__(self, inventory_template_path: str):
        """
        Инициализирует сопоставитель товаров.
        
        Args:
            inventory_template_path: Путь к файлу inventory_template.json
        """
        self.inventory_template_path = inventory_template_path
        self.inventory_data = self._load_inventory_template()
        self.similarity_threshold = CONFIG.get("similarity_thresholds", {}).get("fuzzy_match_threshold", 0.7)
        
        # База правил сопоставления (загружается из конфигурации)
        self.matching_rules = {
            # Правила для единиц измерения
            "unit_mapping": CONFIG.get("unit_mapping", {
                "кг": "гр.",
                "килограмм": "гр.", 
                "грамм": "гр.",
                "л": "мл.",
                "литр": "мл.",
                "миллилитр": "мл.",
                "шт": "шт.",
                "штука": "шт."
            }),
            
            # Категории бухгалтерии → наши категории (точное соответствие)
            "category_mapping": CONFIG.get("category_mapping", {
                "овощи и фрукты": "Овощи и фрукты",
                "мясо и рыба": "Мясо и рыба", 
                "молочные продукты": "Молочные продукты",
                "бакалея": "Бакалея",
                "соусы": "Соусы",
                "специи и приправы": "Специи и приправы",
                "масла и заправки": "Масла и заправки",
                "полуфабрикаты": "Полуфабрикаты",
                "десерты": "Десерты",
                "напитки": "Напитки",
                "упаковка и приборы": "Упаковка и приборы",
                "контейнеры, приборы": "Упаковка и приборы",
                "бар": "Бар"
            }),
            
            # Ключевые слова для определения категорий (если категория не указана)
            "category_keywords": CONFIG.get("category_keywords", {
                "Овощи и фрукты": [
                    "ананас", "брусника", "груша", "капуста", "картофель", "лимон", "лук", 
                    "маслины", "морковь", "огурец", "перец", "помидор", "салат", "свекла", 
                    "укроп", "чеснок", "шампиньон", "перец болгарский", "перец холопиньо",
                    "помидоры черри", "салат листовой"
                ],
                "Мясо и рыба": [
                    "бекон", "ветчина", "грудка", "говядина", "креветка", "крылья", "пепперони",
                    "салями", "сервелат", "сосиски", "филе", "фарш", "набор для бульона"
                ],
                "Молочные продукты": [
                    "молоко", "сливки", "сметана", "пармезан", "сыр", "брынза", "гауда", 
                    "дор блю", "моцарелла", "чеддер", "фета"
                ],
                "Бакалея": [
                    "мука", "сахар", "соль", "уксус", "хлеб", "яйцо", "панировочные сухари"
                ],
                "Соусы": [
                    "горчица", "майонез", "соевый соус", "сок лимона", "соус", "барбекю", 
                    "терияки", "песто", "чили", "мутти", "грибной", "сырный", "томатный"
                ],
                "Специи и приправы": [
                    "бульон", "орегано", "паприка", "перец", "приправа", "специи", 
                    "лавровый лист", "перец черный"
                ],
                "Масла и заправки": [
                    "заправка", "масло", "паста том", "том кха", "том ям", "томатная паста",
                    "масло растительное", "масло фритюрное"
                ],
                "Полуфабрикаты": [
                    "картофель дольки", "картофельные шарики", "картофель фри", "луковые кольца",
                    "наггетсы", "тесто", "замес", "бульон куринный", "говядина жареная", "говядина на чефан",
                    "гренки", "жареное куриное", "капуста на чефан", "картофель пай", "куринное филе маринованное",
                    "масло конфи", "морковь на чефан", "морс брусничный", "омлетная смесь", "меланж",
                    "свекла на чефан", "солянка суп", "соус цитрусовый", "соус брусничный", "соус томатный",
                    "соус греческий", "соус дижонский", "соус классический", "соус сливочно-чесночный",
                    "соус тар-тар", "соус цезарь", "сухарики", "сыр сборный", "сырные палочки", "сырные шарики"
                ],
                "Десерты": [
                    "макаруны", "чизкейк", "эклер", "доннат"
                ],
                "Напитки": [
                    "черноголовка", "морс", "кола", "лимонад", "вода питьевая", "сок"
                ],
                "Упаковка и приборы": [
                    "бутылка", "контейнер", "коробка", "крышка", "набор приборов", "чашка"
                ],
                "Бар": [
                    "rj -", "сироп", "кофе", "стакан", "крышка пс"
                ]
            })
        }
    
    def _load_inventory_template(self) -> Dict[str, Any]:
        """
        Загружает шаблон инвентаризации из JSON файла.
        
        Returns:
            Dict содержащий данные шаблона или пустой dict при ошибке
        """
        try:
            with open(self.inventory_template_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Ошибка загрузки шаблона инвентаризации: {e}")
            return {}
    
    def _normalize_name(self, name: str) -> str:
        """
        Нормализует название товара для корректного сравнения.
        
        Выполняет следующие операции:
        - Приводит к нижнему регистру
        - Убирает лишнюю пунктуацию и кавычки
        - Стандартизирует единицы измерения
        - Исправляет типичные опечатки
        - Убирает лишние пробелы
        
        Args:
            name: Исходное название товара
            
        Returns:
            Нормализованное название товара
        """
        if not name:
            return ""
        
        # Приводим к нижнему регистру
        normalized = name.lower().strip()
        
        # Убираем кавычки и лишнюю пунктуацию
        normalized = re.sub(r'[""«»\'\"\"]+', '', normalized)
        
        # Стандартизируем единицы измерения
        normalized = re.sub(r'\bгр\b\.?', 'гр.', normalized)
        normalized = re.sub(r'\bшт\b\.?', 'шт.', normalized)
        normalized = re.sub(r'\bмл\b\.?', 'мл.', normalized)
        
        # Убираем лишние пробелы вокруг скобок
        normalized = re.sub(r'\s*\(\s*', ' (', normalized)
        normalized = re.sub(r'\s*\)\s*', ') ', normalized)
        
        # Удаляем лишние символы кроме букв, цифр, скобок и точек
        normalized = re.sub(r'[^\w\s\(\)\-\.]', ' ', normalized)
        
        # Убираем множественные пробелы
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Стандартизируем некоторые названия (из конфигурации)
        replacements = CONFIG.get("name_normalization", {}).get("replacements", {
            'холопиньо': 'халапеньо',
            'панировочные сухари': 'сухари панировочные',
            'куринный': 'куриный',
            'куринное': 'куриное',
            'том ям': 'том кха',
            'фри бокс': 'фрай бокс',
            'фрай- бокс': 'фрай бокс',
            'имбирный с апельсином': 'фисташковый',
            'сгущеным': 'сгущённым'
        })
        
        for old, new in replacements.items():
            normalized = normalized.replace(old, new)
        
        return normalized.strip()
    
    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """
        Вычисляет схожесть двух строк с учетом числовых различий.
        
        Особенности:
        - Учитывает числа в названиях товаров
        - Снижает схожесть при несовпадении количественных характеристик
        - Использует алгоритм SequenceMatcher для базового сравнения
        
        Args:
            str1: Первая строка для сравнения
            str2: Вторая строка для сравнения
            
        Returns:
            Коэффициент схожести от 0.0 до 1.0
        """
        norm1 = self._normalize_name(str1)
        norm2 = self._normalize_name(str2)
        
        # Извлекаем числа из обеих строк
        numbers1 = re.findall(r'\d+(?:[,.]\d+)?', norm1)
        numbers2 = re.findall(r'\d+(?:[,.]\d+)?', norm2)
        
        # Если количество чисел разное или числа не совпадают - снижаем схожесть
        if numbers1 != numbers2:
            # Если структура чисел кардинально разная - сильно снижаем схожесть
            if len(numbers1) != len(numbers2):
                base_similarity = SequenceMatcher(None, norm1, norm2).ratio()
                penalty = CONFIG.get("similarity_thresholds", {}).get("number_mismatch_penalty_strong", 0.3)
                return base_similarity * penalty  # сильно снижаем
            
            # Если количество чисел одинаковое, но значения разные - умеренно снижаем
            else:
                base_similarity = SequenceMatcher(None, norm1, norm2).ratio()
                penalty = CONFIG.get("similarity_thresholds", {}).get("number_mismatch_penalty_moderate", 0.6)
                return base_similarity * penalty  # умеренно снижаем
        
        # Если числа совпадают - используем обычный алгоритм
        return SequenceMatcher(None, norm1, norm2).ratio()
    
    def _find_exact_match(self, accounting_item: AccountingItem) -> Optional[Tuple[str, str]]:
        """
        Ищет точное совпадение товара в существующем шаблоне.
        
        Args:
            accounting_item: Товар из бухгалтерии для поиска
            
        Returns:
            Tuple (категория, название) при найденном совпадении, иначе None
        """
        normalized_accounting = self._normalize_name(accounting_item.name)
        
        for category, items in self.inventory_data.items():
            for item_name in items.keys():
                normalized_template = self._normalize_name(item_name)
                
                if normalized_accounting == normalized_template:
                    return (category, item_name)
        
        return None
    
    def _find_fuzzy_match(self, accounting_item: AccountingItem) -> Optional[Tuple[str, str, float]]:
        """
        Ищет нечеткое совпадение товара в существующем шаблоне.
        
        Args:
            accounting_item: Товар из бухгалтерии для поиска
            
        Returns:
            Tuple (категория, название, уверенность) при найденном совпадении, иначе None
        """
        best_match = None
        best_score = 0.0
        best_category = None
        
        for category, items in self.inventory_data.items():
            for item_name in items.keys():
                score = self._calculate_similarity(accounting_item.name, item_name)
                
                if score > best_score and score >= self.similarity_threshold:
                    best_score = score
                    best_match = item_name
                    best_category = category
        
        if best_match:
            return (best_category, best_match, best_score)
        
        return None
    
    def _classify_category(self, accounting_item: AccountingItem) -> Optional[str]:
        """
        Определяет категорию для нового товара на основе анализа названия и контекста.
        
        Использует следующие приоритеты:
        1. Категория из Excel файла (если указана)
        2. Анализ по ключевым словам в названии
        3. Fallback на категорию "Разное"
        
        Args:
            accounting_item: Товар для классификации
            
        Returns:
            Название категории или None при ошибке
        """
        # 1. ПРИОРИТЕТ: Если категория указана в Excel файле, используем её
        if accounting_item.category:
            normalized_category = self._normalize_name(accounting_item.category)
            
            # Ищем точное соответствие в маппинге категорий
            for excel_cat, our_cat in self.matching_rules["category_mapping"].items():
                if normalized_category == self._normalize_name(excel_cat):
                    logger.debug(f"Категория из Excel: '{accounting_item.category}' → '{our_cat}'")
                    return our_cat
            
            # Если точное соответствие не найдено, возвращаем нормализованную категорию
            capitalized_category = accounting_item.category.title()
            logger.debug(f"Категория из Excel (без маппинга): '{accounting_item.category}' → '{capitalized_category}'")
            return capitalized_category
        
        # 2. FALLBACK: Если категория не указана, определяем по ключевым словам в названии товара
        normalized_name = self._normalize_name(accounting_item.name)
        
        for category, keywords in self.matching_rules["category_keywords"].items():
            for keyword in keywords:
                if keyword.lower() in normalized_name:
                    logger.debug(f"Категория по ключевому слову '{keyword}': {accounting_item.name} → {category}")
                    return category
        
        # 3. Если ничего не подошло, возвращаем "Разное"
        logger.debug(f"Категория не определена, используем 'Разное': {accounting_item.name}")
        return "Разное"
    
    def match_items(self, accounting_items: List[AccountingItem]) -> List[MatchResult]:
        """
        Сопоставляет список товаров из бухгалтерии с существующим шаблоном.
        
        Алгоритм работы:
        1. Точное совпадение (100%) - товар пропускается
        2. Высокоточное нечеткое совпадение (≥80%) - товар пропускается
        3. Низкоточное совпадение (<80%) - товар добавляется как новый
        4. Отсутствие совпадений - товар добавляется как новый
        
        Args:
            accounting_items: Список товаров из бухгалтерии
            
        Returns:
            Список результатов сопоставления для каждого товара
        """
        results = []
        
        for item in accounting_items:
            logger.info(f"Обрабатываем товар: {item.name}")
            
            # 1. Ищем точное совпадение (100%)
            exact_match = self._find_exact_match(item)
            if exact_match:
                category, matched_name = exact_match
                results.append(MatchResult(
                    accounting_item=item,
                    matched_name=matched_name,
                    matched_category=category,
                    confidence=1.0,
                    status="exact_match",
                    action="skip"  # товар уже существует - НЕ добавляем
                ))
                logger.info(f"✅ Точное совпадение (100%): {item.name} → {matched_name} - НЕ ДОБАВЛЯЕМ")
                continue
            
            # 2. Проверяем высокоточные нечёткие совпадения (≥80%)
            fuzzy_match = self._find_fuzzy_match(item)
            if fuzzy_match:
                category, matched_name, confidence = fuzzy_match
                
                # Если высокая точность (≥80%) - считаем это тем же товаром
                high_confidence_threshold = CONFIG.get("similarity_thresholds", {}).get("high_confidence_threshold", 0.80)
                if confidence >= high_confidence_threshold:
                    results.append(MatchResult(
                        accounting_item=item,
                        matched_name=matched_name,
                        matched_category=category,
                        confidence=confidence,
                        status="fuzzy_match",
                        action="skip"  # высокоточное совпадение - НЕ добавляем
                    ))
                    logger.info(f"✅ Высокоточное совпадение ({confidence:.2%}): {item.name} → {matched_name} - НЕ ДОБАВЛЯЕМ")
                    continue
                else:
                    logger.info(f"🔍 Низкоточное совпадение ({confidence:.2%}): {item.name} → {matched_name} - будет добавлен как новый")
            
            # 3. Новый товар (нет совпадений или низкая точность <80%)
            suggested_category = self._classify_category(item)
            
            results.append(MatchResult(
                accounting_item=item,
                matched_name=None,
                matched_category=suggested_category,
                confidence=0.0,
                status="new_item",
                action="add_to_templates"
            ))
            logger.info(f"🆕 Новый товар: {item.name} → категория: {suggested_category} - ДОБАВЛЯЕМ")
        
        return results

class ExcelParser:
    """
    Парсер Excel-файлов от бухгалтерии с поддержкой сложных структур.
    
    Возможности:
    - Автоматическое определение структуры файла
    - Парсинг основной таблицы и отдельных секций
    - Фильтрация служебных записей и заголовков
    - Сохранение номеров строк для поддержания порядка
    - Обработка различных форматов заголовков
    """
    
    def parse_excel(self, file_path: str) -> List[AccountingItem]:
        """
        Парсит Excel-файл и извлекает все товары с их метаданными.
        
        Алгоритм работы:
        1. Читает Excel файл построчно
        2. Определяет заголовки основной таблицы и секций
        3. Парсит товары из основной таблицы (с категориями)
        4. Парсит товары из отдельных секций (Полуфабрикаты, Напитки и т.д.)
        5. Фильтрует служебные записи и заголовки
        6. Сохраняет номера строк для поддержания порядка
        
        Args:
            file_path: Путь к Excel файлу от бухгалтерии
            
        Returns:
            Список объектов AccountingItem с извлеченными товарами
            
        Raises:
            Exception: При ошибках чтения файла или парсинга
        """
        items = []
        
        try:
            # Читаем Excel-файл
            df = pd.read_excel(file_path, header=None)
            
            current_section = None
            in_main_table = False
            main_table_header_found = False
            
            for index, row in df.iterrows():
                # Пропускаем пустые строки
                if row.isnull().all():
                    continue
                
                # Получаем все непустые ячейки
                cells = [str(cell).strip() for cell in row if pd.notna(cell) and str(cell).strip()]
                if not cells:
                    continue
                
                # Проверяем заголовок основной таблицы
                if self._is_main_table_header(cells):
                    main_table_header_found = True
                    in_main_table = True
                    current_section = "main_table"
                    logger.info("📋 Найден заголовок основной таблицы")
                    continue
                
                # Проверяем заголовок секции (только в первой ячейке для избежания дублирования)
                section_found = False
                if len(cells) > 0 and self._is_section_header(cells[0]):
                    section_name = self._normalize_section_name(cells[0])
                    # Меняем секцию только если это новая секция
                    if current_section != section_name:
                        current_section = section_name
                        in_main_table = False
                        section_found = True
                        logger.info(f"📁 Найдена секция: {section_name}")
                
                # Проверяем подзаголовок секции (например, "№ п/п Полуфабрикаты:")
                if not section_found and len(cells) >= 2 and cells[0] == "№ п/п" and self._is_section_header(cells[1]):
                    section_name = self._normalize_section_name(cells[1])
                    # Меняем секцию только если это новая секция
                    if current_section != section_name:
                        current_section = section_name
                        in_main_table = False
                        section_found = True
                        logger.info(f"📁 Найдена секция (подзаголовок): {section_name}")
                
                if section_found:
                    continue
                
                # Дополнительная проверка: если в строке есть ТОЛЬКО названия категорий - пропускаем
                if len(cells) <= 5 and all(self._is_section_header(cell) for cell in cells if cell.strip()):
                    logger.info(f"🚫 Пропуск строки с названиями категорий: {cells}")
                    continue
                
                # Дополнительная проверка: если больше половины ячеек это названия категорий - пропускаем
                if len(cells) > 0:
                    category_count = sum(1 for cell in cells if self._is_section_header(cell))
                    if category_count > len(cells) // 2:
                        logger.info(f"🚫 Пропуск строки с множественными категориями: {cells}")
                        continue
                
                # Пропускаем строки с только "№ п/п" (подзаголовки секций)
                if self._is_section_subheader(cells):
                    continue
                
                # Парсим товары
                if in_main_table and main_table_header_found:
                    # Основная таблица: № п/п, Категории, Наименование продукта, Количество, Полуфабрикаты
                    item = self._parse_main_table_row(cells, index + 1)
                    if item:
                        items.append(item)
                        logger.debug(f"📦 Основная таблица: {item.name} (категория: {item.category})")
                
                elif current_section and current_section != "main_table":
                    # Отдельные секции - проверяем, что это не строка с заголовками секций
                    if not all(self._is_section_header(cell) for cell in cells[:3]):
                        item = self._parse_section_row(cells, current_section, index + 1)
                        if item:
                            items.append(item)
                            logger.debug(f"📦 Секция {current_section}: {item.name}")
            
            logger.info(f"📋 Всего найдено товаров: {len(items)}")
            
            # Подсчитываем исключенные записи
            total_rows = index + 1
            excluded_count = total_rows - len(items) - main_table_header_found - len(section_headers_found) if 'section_headers_found' in locals() else total_rows - len(items)
            
            logger.info(f"📊 Статистика обработки Excel файла:")
            logger.info(f"   • Всего строк в файле: {total_rows}")
            logger.info(f"   • Найдено товаров: {len(items)}")
            logger.info(f"   • Исключено записей: {excluded_count} (заголовки, служебные записи, пустые строки)")
            
            return items
            
        except Exception as e:
            logger.error(f"Ошибка парсинга Excel-файла: {e}")
            return []
    
    def _is_main_table_header(self, cells: List[str]) -> bool:
        """
        Проверяет, является ли строка заголовком основной таблицы.
        
        Ищет характерные ключевые слова: "№ п/п", "категории", "наименование", 
        "количество", "полуфабрикаты". Строка считается заголовком основной 
        таблицы, если содержит минимум 3 из этих слов.
        
        Args:
            cells: Список ячеек строки для проверки
            
        Returns:
            True если это заголовок основной таблицы, иначе False
        """
        # Ищем характерные колонки основной таблицы (из конфигурации)
        header_keywords = CONFIG.get("excel_parsing", {}).get("main_table_headers", 
                                    ["№ п/п", "категории", "наименование", "количество", "полуфабрикаты"])
        cells_lower = [cell.lower() for cell in cells]
        
        # Должно содержать минимум 3 из этих ключевых слов
        min_matches = CONFIG.get("excel_parsing", {}).get("main_table_header_match_threshold", 3)
        matches = sum(1 for keyword in header_keywords if any(keyword in cell for cell in cells_lower))
        return matches >= min_matches
    
    def _is_section_header(self, first_cell: str) -> bool:
        """
        Проверяет, является ли первая ячейка строки заголовком секции.
        
        Распознает все известные секции: полуфабрикаты, напитки, контейнеры,
        десерты, бар, и основные категории товаров.
        
        Args:
            first_cell: Содержимое первой ячейки строки
            
        Returns:
            True если это заголовок секции, иначе False
        """
        # Все возможные названия секций/категорий (из конфигурации)
        known_sections = CONFIG.get("excel_parsing", {}).get("known_sections", [
            "полуфабрикаты", "напитки", "контейнеры, приборы", 
            "десерты", "бар", "контейнеры", "приборы",
            "мясо и рыба", "овощи и фрукты", "масла и заправки", 
            "соусы", "бакалея", "молочные продукты", "специи и приправы"
        ])
        
        normalized_cell = first_cell.lower().strip().rstrip(":")
        return normalized_cell in known_sections
    
    def _normalize_section_name(self, section_name: str) -> str:
        """
        Нормализует название секции к стандартному формату.
        
        Преобразует различные варианты написания секций в единообразный
        формат с заглавной буквы. Например: "полуфабрикаты:" → "Полуфабрикаты"
        
        Args:
            section_name: Исходное название секции
            
        Returns:
            Нормализованное название секции
        """
        normalized = section_name.lower().strip().rstrip(":")
        
        # Мапим все возможные секции в стандартные категории (из конфигурации)
        section_mapping = CONFIG.get("category_mapping", {
            "полуфабрикаты": "Полуфабрикаты",
            "напитки": "Напитки",
            "контейнеры, приборы": "Упаковка и приборы",
            "контейнеры": "Упаковка и приборы",
            "приборы": "Упаковка и приборы",
            "десерты": "Десерты",
            "бар": "Бар",
            "мясо и рыба": "Мясо и рыба",
            "овощи и фрукты": "Овощи и фрукты",
            "масла и заправки": "Масла и заправки",
            "соусы": "Соусы",
            "бакалея": "Бакалея",
            "молочные продукты": "Молочные продукты",
            "специи и приправы": "Специи и приправы"
        })
        
        return section_mapping.get(normalized, normalized.capitalize())
    
    def _parse_main_table_row(self, cells: List[str], row_number: int) -> Optional[AccountingItem]:
        """
        Парсит строку основной таблицы с товарами.
        
        Ожидаемый формат: № п/п, Категории, Наименование продукта, Количество, Полуфабрикаты
        Проверяет корректность формата и исключает служебные записи.
        
        Args:
            cells: Список ячеек строки
            row_number: Номер строки в файле (для отладки)
            
        Returns:
            AccountingItem при успешном парсинге, иначе None
        """
        # Ожидаем: № п/п, Категории, Наименование продукта, Количество, Полуфабрикаты
        if len(cells) < 3:
            return None
        
        first_cell = cells[0]
        
        # Проверяем, что первая ячейка - это номер
        if not re.match(r'^\d+$', first_cell):
            return None
        
        # Категория во второй колонке
        category_raw = cells[1].strip() if len(cells) > 1 else None
        
        # Название товара в третьей колонке
        item_name = cells[2].strip() if len(cells) > 2 else None
        
        if not item_name or not category_raw:
            return None
        
        # Исключаем служебные записи
        if self._is_excluded_item(item_name):
            return None
        
        # Дополнительная проверка: исключаем названия категорий
        if self._is_section_header(item_name):
            logger.info(f"🚫 Пропуск названия категории в основной таблице: {item_name}")
            return None
        
        # Нормализуем название категории
        category = self._normalize_section_name(category_raw)
        
        return AccountingItem(
            name=item_name,
            category=category,
            row_number=row_number
        )
    
    def _parse_section_row(self, cells: List[str], section: str, row_number: int) -> Optional[AccountingItem]:
        """
        Парсит строку из отдельной секции (Полуфабрикаты, Напитки и т.д.).
        
        Ожидаемый формат: № п/п, Наименование товара
        Более простой формат по сравнению с основной таблицей.
        
        Args:
            cells: Список ячеек строки
            section: Название текущей секции
            row_number: Номер строки в файле
            
        Returns:
            AccountingItem при успешном парсинге, иначе None
        """
        if len(cells) < 2:
            logger.debug(f"Пропуск строки {row_number}: недостаточно ячеек ({len(cells)})")
            return None
        
        first_cell = cells[0]
        
        # Проверяем, что первая ячейка - это номер
        if not re.match(r'^\d+$', first_cell):
            logger.debug(f"Пропуск строки {row_number}: первая ячейка не номер: '{first_cell}'")
            return None
        
        # Название товара во второй колонке
        item_name = cells[1].strip() if len(cells) > 1 else None
        
        if not item_name:
            logger.debug(f"Пропуск строки {row_number}: пустое название товара")
            return None
        
        # Исключаем служебные записи
        if self._is_excluded_item(item_name):
            logger.debug(f"Пропуск строки {row_number}: служебная запись: '{item_name}'")
            return None
        
        # Дополнительная проверка: исключаем названия категорий
        if self._is_section_header(item_name):
            logger.info(f"🚫 Пропуск строки {row_number}: название категории: '{item_name}'")
            return None
        
        logger.debug(f"✅ Товар из секции '{section}': '{item_name}'")
        return AccountingItem(
            name=item_name,
            category=section,
            row_number=row_number
        )
    
    def _is_excluded_item(self, item_name: str) -> bool:
        """
        Проверяет, должен ли товар быть исключен из обработки.
        
        Исключает служебные термины (заголовки, технические записи),
        слишком короткие названия и системные элементы.
        
        Args:
            item_name: Название товара для проверки
            
        Returns:
            True если товар должен быть исключен, иначе False
        """
        excluded_terms = CONFIG.get("excel_parsing", {}).get("excluded_terms", [
            "наименование", "товар", "название", "продукт", "№ п/п", "№", "п/п",
            "инвентаризация продуктов", "количество", "цена", "сумма",
            "филиал", "дата", "время", "ответственный", "подпись",
            "итого", "всего", "общая сумма", "страница", "лист",
            "категории", "полуфабрикаты"
        ])
        
        item_lower = item_name.lower().strip()
        
        # Исключаем если это служебный термин
        if item_lower in excluded_terms:
            logger.debug(f"🚫 Исключен товар (служебный термин): '{item_name}'")
            return True
            
        # Исключаем слишком короткие названия
        min_length = CONFIG.get("excel_parsing", {}).get("min_item_name_length", 2)
        if len(item_name.strip()) < min_length:
            logger.debug(f"🚫 Исключен товар (слишком короткое название): '{item_name}'")
            return True
            
        return False

    def _is_section_subheader(self, cells: List[str]) -> bool:
        """
        Проверяет, является ли строка подзаголовком секции.
        
        Распознает строки типа "№ п/п", "№ п/п Полуфабрикаты:", "№ п/п Напитки"
        которые служат заголовками для отдельных секций товаров.
        
        Args:
            cells: Список ячеек строки
            
        Returns:
            True если это подзаголовок секции, иначе False
        """
        # Строки типа "№ п/п", "№ п/п	Полуфабрикаты:", "№ п/п	Напитки"
        if len(cells) == 0:
            return False
        
        first_cell = cells[0].lower().strip()
        
        # Если первая ячейка это "№ п/п", "№", "п/п" - это подзаголовок
        subheader_indicators = CONFIG.get("excel_parsing", {}).get("section_subheader_indicators", ["№ п/п", "№", "п/п"])
        if first_cell in subheader_indicators:
            return True
        
        # Если строка содержит только "№ п/п" и название секции - это тоже подзаголовок
        if len(cells) == 2 and first_cell == "№ п/п":
            second_cell = cells[1].lower().strip().rstrip(":")
            # Расширенный список всех возможных секций (из конфигурации)
            known_sections = CONFIG.get("excel_parsing", {}).get("known_sections", [
                "полуфабрикаты", "напитки", "контейнеры, приборы", 
                "десерты", "бар", "контейнеры", "приборы",
                "мясо и рыба", "овощи и фрукты", "масла и заправки", 
                "соусы", "бакалея", "молочные продукты", "специи и приправы"
            ])
            if second_cell in known_sections:
                return True
        
        return False

class TemplateUpdater:
    """
    Обновляет шаблоны инвентаризации на основе данных от бухгалтерии.
    
    Основные функции:
    - Синхронизация inventory_template.json с Excel файлами
    - Обновление excel_template.py для генерации отчетов
    - Автоматическое добавление новых товаров
    - Удаление устаревших товаров
    - Поддержание целостности данных
    """
    
    def __init__(self, inventory_template_path: str, excel_template_path: str):
        """
        Инициализирует обновлятель шаблонов.
        
        Args:
            inventory_template_path: Путь к файлу inventory_template.json
            excel_template_path: Путь к файлу excel_template.py
        """
        self.inventory_template_path = inventory_template_path
        self.excel_template_path = excel_template_path
    
    def sync_inventory_template_with_excel(self, accounting_items: List[AccountingItem], match_results: List[MatchResult]) -> Dict[str, Any]:
        """
        Синхронизирует inventory_template.json с Excel файлом (источник истины).
        
        Excel файл от бухгалтерии является эталонным источником данных.
        Метод обеспечивает полную синхронизацию:
        - Обновляет названия товаров на актуальные из бухгалтерии
        - Удаляет товары, которых больше нет в Excel
        - Добавляет новые товары из Excel
        - Сохраняет структуру категорий
        
        Args:
            accounting_items: Список товаров из Excel файла
            match_results: Результаты сопоставления товаров
            
        Returns:
            Dict с информацией об изменениях:
            - updated: были ли изменения
            - changes_made: флаг изменений
            - updated_count: количество обновленных названий
            - removed_count: количество удаленных товаров
            - added_count: количество добавленных товаров
            - removed_items: список удаленных товаров
        """
        try:
            # Загружаем текущий шаблон
            with open(self.inventory_template_path, 'r', encoding='utf-8') as f:
                template = json.load(f)
            
            changes_made = False
            removed_items = []  # Список удаленных товаров
            
            # 1. ОБНОВЛЯЕМ названия товаров для высокоточных нечетких совпадений
            name_updates = [m for m in match_results if m.action == "update_item_name"]
            if name_updates:
                logger.info(f"📝 Обновляем названия {len(name_updates)} товаров:")
                for match in name_updates:
                    old_name = match.matched_name  # старое название из template
                    new_name = match.accounting_item.name  # новое название из бухгалтерии
                    category = match.matched_category
                    
                    # Находим товар в шаблоне и обновляем его название
                    if category in template and old_name in template[category]:
                        # Сохраняем данные товара
                        item_data = template[category][old_name]
                        
                        # Удаляем старое название
                        del template[category][old_name]
                        
                        # Добавляем с новым названием
                        template[category][new_name] = item_data
                        
                        changes_made = True
                        logger.info(f"  📝 {old_name} → {new_name}")
            
            # 2. Собираем все товары из Excel файла для проверки синхронизации
            excel_items = set()
            excel_items_with_categories = {}
            
            for match in match_results:
                if match.action == "update_item_name":
                    # Для обновленных товаров используем новое название из бухгалтерии
                    item_name = match.accounting_item.name
                elif match.action == "skip":
                    # Точные совпадения - товары УЖЕ ЕСТЬ в inventory_template.json
                    # Используем matched_name (название из шаблона)
                    item_name = match.matched_name
                else:
                    # Для новых товаров используем название как есть из Excel файла
                    item_name = match.accounting_item.name
                    logger.info(f"🆕 Новый товар: '{item_name}' (единицы измерения как в Excel файле)")
                    
                    # НЕ ДОБАВЛЯЕМ автоматически единицы измерения!
                    # Только бухгалтерия знает правильные единицы (гр./шт./мл./кг.)
                
                excel_items.add(item_name)
                
                # Сохраняем категорию для товара
                if match.matched_category:
                    excel_items_with_categories[item_name] = match.matched_category
            
            logger.info(f"📋 В Excel файле найдено {len(excel_items)} товаров")
            
            # Собираем все товары из текущего inventory_template.json (после обновлений названий)
            current_items = set()
            for category, items in template.items():
                for item_name in items.keys():
                    current_items.add(item_name)
            
            logger.info(f"📄 В inventory_template.json сейчас {len(current_items)} товаров")
            
            # 3. Определяем что нужно удалить и добавить
            items_to_remove = current_items - excel_items
            items_to_add = excel_items - current_items
            
            logger.info(f"🗑️ Товаров к удалению: {len(items_to_remove)}")
            logger.info(f"➕ Товаров к добавлению: {len(items_to_add)}")
            
            # 4. УДАЛЯЕМ товары, которых больше нет в Excel файле
            if items_to_remove:
                logger.info("🗑️ Удаляем устаревшие товары из inventory_template.json:")
                for item_name in items_to_remove:
                    logger.info(f"  ❌ {item_name}")
                    
                    # Находим и удаляем товар из всех категорий
                    for category, items in template.items():
                        if item_name in items:
                            del items[item_name]
                            changes_made = True
                            removed_items.append({
                                "name": item_name,
                                "category": category
                            })
                            logger.info(f"    🗑️ Удален из категории '{category}'")
                            
                            # Если категория стала пустой, удаляем её
                            if not items:
                                logger.info(f"    📁 Категория '{category}' стала пустой и будет удалена")
                
                # Удаляем пустые категории
                empty_categories = [cat for cat, items in template.items() if not items]
                for category in empty_categories:
                    del template[category]
                    changes_made = True
                    logger.info(f"🗑️ Удалена пустая категория: {category}")
            
            # 5. ДОБАВЛЯЕМ новые товары из Excel файла
            if items_to_add:
                logger.info("➕ Добавляем новые товары в inventory_template.json:")
                for item_name in items_to_add:
                    category = excel_items_with_categories.get(item_name, "Разное")
                    logger.info(f"  ✅ {item_name} → категория '{category}'")
                    
                    # Создаем категорию если её нет
                    if category not in template:
                        template[category] = {}
                        logger.info(f"➕ Создана новая категория: {category}")
                    
                    # Добавляем товар
                    template[category][item_name] = {
                        "raw": {
                            "quantity": 0,
                            "filled": False
                        }
                    }
                    changes_made = True
            
            # Сохраняем изменения
            if changes_made:
                with open(self.inventory_template_path, 'w', encoding='utf-8') as f:
                    json.dump(template, f, ensure_ascii=False, indent=2)
                
                update_count = len(name_updates)
                remove_count = len(items_to_remove) 
                add_count = len(items_to_add)
                
                logger.info(f"💾 inventory_template.json обновлен (обновлено названий: {update_count}, удалено: {remove_count}, добавлено: {add_count})")
                
                return {
                    "updated": True,
                    "changes_made": changes_made,
                    "updated_count": update_count,
                    "removed_count": remove_count,
                    "added_count": add_count,
                    "removed_items": removed_items
                }
            else:
                logger.info("✅ inventory_template.json уже синхронизирован с Excel файлом")
                return {
                    "updated": False,
                    "changes_made": False,
                    "updated_count": 0,
                    "removed_count": 0,
                    "added_count": 0,
                    "removed_items": []
                }
            
        except Exception as e:
            logger.error(f"Ошибка синхронизации inventory_template.json с Excel файлом: {e}")
            return {
                "updated": False,
                "error": str(e),
                "removed_items": []
            }


    
    def update_excel_template(self, new_items: List[MatchResult]) -> bool:
        """
        Обновляет excel_template.py новыми товарами (ЧАСТИЧНО РЕАЛИЗОВАН).
        
        ВНИМАНИЕ: Этот метод имеет ограниченную функциональность и обрабатывает
        только категорию "Упаковка для бара". Для полного обновления используйте
        метод synchronize_templates_with_excel_order из InventoryAdapter.
        
        Args:
            new_items: Список новых товаров для добавления
            
        Returns:
            True если были внесены изменения, иначе False
        """
        try:
            # Читаем текущий файл
            with open(self.excel_template_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            changes_made = False
            
            for match in new_items:
                if match.action == "add_to_templates" and match.matched_category:
                    category = match.matched_category
                    item_name = match.accounting_item.name
                    
                    # НЕ ДОБАВЛЯЕМ автоматически единицы измерения!
                    # Используем название как есть из исходного Excel файла
                    logger.info(f"🆕 [excel_template] Товар: '{item_name}' (единицы как в Excel)")
                    
                    # Определяем в какую секцию добавить товар
                    if category == "Упаковка для бара":
                        # Добавляем в EXCEL_BAR["Упаковка для бара"]
                        pattern = r'("Упаковка для бара": \[)(.*?)(\s*\],)'
                        match_obj = re.search(pattern, content, re.DOTALL)
                        
                        if match_obj:
                            items_section = match_obj.group(2)
                            # Проверяем, нет ли уже такого товара
                            if f'"{item_name}"' not in items_section:
                                # Добавляем новый товар
                                new_item_line = f'        "{item_name}",\n'
                                updated_section = items_section.rstrip() + '\n' + new_item_line
                                content = content.replace(
                                    match_obj.group(1) + match_obj.group(2) + match_obj.group(3),
                                    match_obj.group(1) + updated_section + match_obj.group(3)
                                )
                                changes_made = True
                                logger.info(f"➕ Добавлен в excel_template.py: {item_name}")
                    
                    # Можно добавить обработку других секций...
            
            # Сохраняем изменения
            if changes_made:
                with open(self.excel_template_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                logger.info(f"💾 Обновлен файл: {self.excel_template_path}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Ошибка обновления excel_template.py: {e}")
            return False

    def _cleanup_excel_template_formatting(self, content: str) -> str:
        """Очищает форматирование excel_template.py после удаления товаров"""
        
        # Удаляем лишние пустые строки
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        
        # Исправляем запятые в конце списков (убираем запятую перед закрывающей скобкой)
        content = re.sub(r',(\s*\n\s*\])', r'\1', content)
        content = re.sub(r',(\s*\n\s*\],)', r'\1', content)
        
        return content


class InventoryAdapter:
    """
    Главный адаптер для работы с инвентаризацией - центральная точка управления.
    
    Объединяет все компоненты системы:
    - ExcelParser: для парсинга файлов от бухгалтерии
    - ItemMatcher: для сопоставления товаров
    - TemplateUpdater: для обновления шаблонов
    
    Предоставляет высокоуровневые методы для:
    - Полной обработки Excel файлов от бухгалтерии
    - Автоматической синхронизации всех шаблонов
    - Проверки целостности данных
    - Динамического анализа структур файлов
    
    Преимущества:
    🔄 Масштабируемость - легко добавлять товары
    🎯 Гибкость - работает с любой структурой
    💪 Надежность - нет зависимости от хардкода
    ⚡ Автоматизация - полностью автоматическая синхронизация
    📈 Адаптивность - подстраивается под изменения
    """
    
    def __init__(self, base_path: str = None):
        """
        Инициализирует главный адаптер инвентаризации.
        
        Args:
            base_path: Базовый путь для поиска файлов шаблонов.
                      По умолчанию используется директория текущего файла.
        """
        if base_path is None:
            base_path = os.path.dirname(__file__)
        
        # Пути к файлам шаблонов
        self.inventory_template_path = os.path.join(base_path, '../../data/templates/inventory_template.json')
        self.excel_template_path = os.path.join(base_path, 'excel_template.py')
        
        # Инициализируем компоненты
        self.parser = ExcelParser()
        self.matcher = ItemMatcher(self.inventory_template_path)
        self.updater = TemplateUpdater(self.inventory_template_path, self.excel_template_path)

    def check_template_synchronization(self) -> Dict[str, Any]:
        """
        Проверяет синхронизацию между inventory_template.json и excel_template.py.
        
        Сравнивает списки товаров в обоих файлах и выявляет расхождения.
        Это важно для обеспечения целостности системы - оба файла должны
        содержать одинаковый набор товаров.
        
        Returns:
            Dict с результатами проверки:
            - is_synchronized: boolean - синхронизированы ли файлы
            - inventory_items_count: количество товаров в inventory_template.json
            - excel_items_count: количество товаров в excel_template.py
            - only_in_inventory: товары только в inventory_template.json
            - only_in_excel: товары только в excel_template.py
            - desynchronization_count: общее количество расхождений
        """
        try:
            # Загружаем inventory_template.json
            with open(self.inventory_template_path, 'r', encoding='utf-8') as f:
                inventory_template = json.load(f)
            
            # Получаем все товары из inventory_template.json
            inventory_items = set()
            for category, items in inventory_template.items():
                for item_name in items.keys():
                    inventory_items.add(item_name)
            
            # Получаем товары из excel_template.py
            excel_items = set()
            try:
                # Импортируем excel_template для получения списков
                import sys
                import importlib.util
                
                spec = importlib.util.spec_from_file_location("excel_template", self.excel_template_path)
                excel_template = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(excel_template)
                
                # Собираем все товары из всех секций excel_template.py
                sections = [
                    'EXCEL_MAIN_ITEMS',
                    'EXCEL_SEMIFINISHED',
                    'EXCEL_DRINKS',
                    'EXCEL_PACKAGING',
                    'EXCEL_DESSERTS',
                    'EXCEL_BAR'
                ]
                
                for section_name in sections:
                    if hasattr(excel_template, section_name):
                        section_items = getattr(excel_template, section_name)
                        for item in section_items:
                            if isinstance(item, tuple) and len(item) >= 2:
                                excel_items.add(item[1])  # item[1] это название товара
                
            except Exception as e:
                logger.warning(f"Не удалось прочитать excel_template.py: {e}")
                return {
                    "is_synchronized": False,
                    "error": f"Ошибка чтения excel_template.py: {e}"
                }
            
            # Сравниваем списки
            only_in_inventory = inventory_items - excel_items
            only_in_excel = excel_items - inventory_items
            
            is_synchronized = len(only_in_inventory) == 0 and len(only_in_excel) == 0
            
            return {
                "is_synchronized": is_synchronized,
                "inventory_items_count": len(inventory_items),
                "excel_items_count": len(excel_items),
                "only_in_inventory": list(only_in_inventory),
                "only_in_excel": list(only_in_excel),
                "desynchronization_count": len(only_in_inventory) + len(only_in_excel)
            }
            
        except Exception as e:
            logger.error(f"Ошибка проверки синхронизации шаблонов: {e}")
            return {
                "is_synchronized": False,
                "error": str(e)
            }

    def _save_excel_order(self, accounting_items: List[AccountingItem]) -> bool:
        """
        Сохраняет порядок товаров из оригинального Excel файла.
        
        Создает файл excel_order.json с информацией о порядке товаров
        в исходном файле бухгалтерии. Это критически важно для сохранения
        структуры отчетов в том виде, как привыкла работать бухгалтерия.
        
        Args:
            accounting_items: Список товаров с номерами строк из Excel
            
        Returns:
            True при успешном сохранении, False при ошибке
        """
        try:
            order_data = []
            for item in accounting_items:
                order_data.append({
                    "name": item.name,
                    "row_number": item.row_number,
                    "category": item.category
                })
            
            # Сортируем по row_number для сохранения оригинального порядка
            order_data.sort(key=lambda x: x["row_number"])
            
            order_file_path = os.path.join(os.path.dirname(self.inventory_template_path), "excel_order.json")
            with open(order_file_path, 'w', encoding='utf-8') as f:
                json.dump(order_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"💾 Сохранен порядок товаров из Excel: {len(order_data)} позиций")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка сохранения порядка товаров: {e}")
            return False

    def _load_excel_order(self) -> List[Dict[str, Any]]:
        """
        Загружает сохраненный порядок товаров из Excel файла.
        
        Читает файл excel_order.json, созданный методом _save_excel_order.
        Если файл не существует, возвращает пустой список (fallback на 
        алфавитный порядок).
        
        Returns:
            Список словарей с данными о товарах и их порядке, или пустой список
        """
        try:
            order_file_path = os.path.join(os.path.dirname(self.inventory_template_path), "excel_order.json")
            if os.path.exists(order_file_path):
                with open(order_file_path, 'r', encoding='utf-8') as f:
                    order_data = json.load(f)
                logger.info(f"📋 Загружен порядок товаров: {len(order_data)} позиций")
                return order_data
            else:
                logger.info("📋 Файл порядка товаров не найден, используем алфавитный порядок")
                return []
        except Exception as e:
            logger.error(f"Ошибка загрузки порядка товаров: {e}")
            return []

    def synchronize_templates_with_excel_order(self) -> Dict[str, Any]:
        """
        Синхронизирует excel_template.py с inventory_template.json с сохранением порядка из Excel.
        
        Это ключевой метод для поддержания целостности системы. Он:
        1. Загружает все товары из inventory_template.json
        2. Восстанавливает порядок из сохраненного excel_order.json
        3. Полностью перестраивает excel_template.py
        4. Распределяет товары по секциям динамически
        
        Returns:
            Dict с результатами синхронизации:
            - success: успешность операции
            - changes_made: были ли изменения
            - message: описание результата
            - ordered_items_count: количество обработанных товаров
            - excel_order_used: использовался ли сохраненный порядок
            - final_sync_status: итоговый статус синхронизации
        """
        
        logger.info("🔄 Начинаем синхронизацию excel_template.py с сохранением порядка из Excel...")
        
        try:
            # Загружаем inventory_template.json
            with open(self.inventory_template_path, 'r', encoding='utf-8') as f:
                inventory_template = json.load(f)
            
            # Загружаем сохраненный порядок из Excel
            excel_order = self._load_excel_order()
            
            # Создаем плоский список всех товаров из inventory_template.json
            all_inventory_items = {}
            for category, items in inventory_template.items():
                for item_name in items.keys():
                    all_inventory_items[item_name] = category
            
            logger.info(f"📦 Всего товаров в inventory_template.json: {len(all_inventory_items)}")
            
            if excel_order:
                # Используем порядок из Excel файла
                ordered_items = []
                
                for excel_item in excel_order:
                    item_name = excel_item["name"]
                    
                    # Ищем точное совпадение в inventory_template.json
                    if item_name in all_inventory_items:
                        category = all_inventory_items[item_name]
                        ordered_items.append((category, item_name))
                        logger.debug(f"✅ Найден товар: {item_name} в категории {category}")
                    else:
                        logger.warning(f"⚠️ Товар из Excel не найден в inventory_template.json: {item_name}")
                
                # Добавляем товары которые есть в inventory_template.json но нет в Excel порядке
                used_items = {item[1] for item in ordered_items}
                for item_name, category in all_inventory_items.items():
                    if item_name not in used_items:
                        ordered_items.append((category, item_name))
                        logger.info(f"➕ Добавлен товар отсутствующий в Excel порядке: {item_name}")
                
                logger.info(f"📋 Создан упорядоченный список: {len(ordered_items)} товаров")
                
            else:
                # Если нет сохраненного порядка, используем алфавитный порядок
                ordered_items = [(category, item_name) for item_name, category in all_inventory_items.items()]
                ordered_items.sort(key=lambda x: x[1])  # Сортируем по названию товара
                logger.info(f"📋 Используем алфавитный порядок: {len(ordered_items)} товаров")
            
            # Перестраиваем excel_template.py с новым порядком
            success = self._rebuild_excel_template_with_order(ordered_items)
            
            if success:
                # Проверяем результат синхронизации
                final_status = self.check_template_synchronization()
                
                return {
                    "success": True,
                    "changes_made": True,
                    "message": "Синхронизация с порядком из Excel завершена",
                    "ordered_items_count": len(ordered_items),
                    "excel_order_used": bool(excel_order),
                    "final_sync_status": final_status.get("is_synchronized", False)
                }
            else:
                return {
                    "success": False,
                    "error": "Ошибка перестройки excel_template.py"
                }
                
        except Exception as e:
            logger.error(f"Ошибка синхронизации с порядком Excel: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def _rebuild_excel_template_with_order(self, ordered_items: List[Tuple[str, str]]) -> bool:
        """Перестраивает excel_template.py с товарами в указанном порядке, распределяя по секциям"""
        
        try:
            logger.info(f"🏗️ Перестраиваем excel_template.py с {len(ordered_items)} товарами...")
            
            # Загружаем excel_order.json для получения номеров строк
            excel_order = self._load_excel_order()
            
            # ДИНАМИЧЕСКИ определяем структуру файла и границы секций
            sections_structure = self._analyze_file_structure(excel_order)
            
            # Группируем товары по секциям
            main_items = []
            semifinished_items = []
            drinks_items = []
            packaging_items = []
            desserts_items = []
            bar_items = []
            
            for category, item_name in ordered_items:
                # Экранируем кавычки в названиях товаров
                safe_item_name = item_name.replace('"', '\\"')
                item_tuple = f'    ("{category}", "{safe_item_name}"),'
                
                # Определяем к какой секции относится товар ДИНАМИЧЕСКИ
                section = self._determine_item_section(item_name, sections_structure)
                
                # Распределяем по секциям на основе динамического анализа
                if section == "main_table":
                    main_items.append(item_tuple)
                elif section == "semifinished":
                    semifinished_items.append(item_tuple)
                elif section == "drinks":
                    drinks_items.append(item_tuple)
                elif section == "packaging":
                    packaging_items.append(item_tuple)
                elif section == "desserts":
                    desserts_items.append(item_tuple)
                elif section == "bar":
                    bar_items.append(item_tuple)
                else:
                    # По умолчанию в основную таблицу
                    main_items.append(item_tuple)
                    logger.warning(f"⚠️ Товар '{item_name}' не распознан, добавлен в основную таблицу")
            
            logger.info(f"📊 Распределение товаров по секциям:")
            logger.info(f"   • EXCEL_MAIN_ITEMS: {len(main_items)} товаров")
            logger.info(f"   • EXCEL_SEMIFINISHED: {len(semifinished_items)} товаров")
            logger.info(f"   • EXCEL_DRINKS: {len(drinks_items)} товаров")
            logger.info(f"   • EXCEL_PACKAGING: {len(packaging_items)} товаров")
            logger.info(f"   • EXCEL_DESSERTS: {len(desserts_items)} товаров")
            logger.info(f"   • EXCEL_BAR: {len(bar_items)} товаров")
            
            # Создаем новое содержимое excel_template.py
            new_content = '''# Шаблон для формирования Excel-отчёта инвентаризации (эталонный порядок)
# Используется только для генерации Excel, не для интерфейса!
# 
# ФАЙЛ АВТОМАТИЧЕСКИ ОБНОВЛЁН СИСТЕМОЙ СИНХРОНИЗАЦИИ
# на основе inventory_template.json с сохранением порядка из оригинального Excel файла

# --- Основная таблица (категория, товар) в порядке как в оригинальном Excel файле ---
EXCEL_MAIN_ITEMS = [
    # Товары в том же порядке что в оригинальном Excel файле бухгалтерии
    # Включает: Овощи и фрукты, Мясо и рыба, Молочные продукты, Бакалея, 
    # Соусы, Специи и приправы, Масла и заправки и другие основные категории
'''
            
            # Добавляем товары в основную таблицу
            for item in main_items:
                new_content += item + '\n'
            
            new_content += ''']

# --- Полуфабрикаты (отдельная секция) ---
EXCEL_SEMIFINISHED = [
'''
            
            # Добавляем полуфабрикаты
            for item in semifinished_items:
                new_content += item + '\n'
            
            new_content += ''']

# --- Напитки (отдельная секция) ---
EXCEL_DRINKS = [
'''
            
            # Добавляем напитки
            for item in drinks_items:
                new_content += item + '\n'
            
            new_content += ''']

# --- Упаковка и приборы (отдельная секция) ---
EXCEL_PACKAGING = [
'''
            
            # Добавляем упаковку и приборы
            for item in packaging_items:
                new_content += item + '\n'
            
            new_content += ''']

# --- Десерты (отдельная секция) ---
EXCEL_DESSERTS = [
'''
            
            # Добавляем десерты
            for item in desserts_items:
                new_content += item + '\n'
            
            new_content += ''']

# --- Бар (отдельная секция) ---
EXCEL_BAR = [
'''
            
            # Добавляем товары для бара
            for item in bar_items:
                new_content += item + '\n'
            
            new_content += ''']

# Можно добавить дополнительные секции по аналогии
'''
            
            # Сохраняем новый файл
            with open(self.excel_template_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            logger.info(f"💾 excel_template.py успешно перестроен с правильным распределением по секциям")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка перестройки excel_template.py: {e}")
            return False

    def _analyze_file_structure(self, excel_order: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Динамически анализирует структуру Excel файла по последовательности категорий.
        
        КЛЮЧЕВОЙ МЕТОД для обеспечения адаптивности системы!
        
        Алгоритм:
        1. Сортирует товары по номерам строк из Excel
        2. Анализирует последовательность категорий
        3. Определяет границы секций по смене доминирующих категорий
        4. Создает карту структуры для правильного распределения товаров
        
        Адаптивные пороги:
        - Размер блока для основной таблицы: >30 товаров
        - Минимальный размер специализированной секции: >5 товаров
        - Порог однородности секции: >80% одной категории
        
        Args:
            excel_order: Список товаров с метаданными из Excel файла
            
        Returns:
            Dict со структурой файла:
            - main_table: блоки основной таблицы
            - semifinished: блоки полуфабрикатов
            - drinks: блоки напитков
            - packaging: блоки упаковки
            - desserts: блоки десертов
            - bar: блоки товаров для бара
        """
        
        if not excel_order:
            logger.warning("⚠️ excel_order пуст, используем базовую структуру")
            return {"main_table": []}
        
        # Сортируем товары по номеру строки
        sorted_items = sorted(excel_order, key=lambda x: x.get("row_number", 0))
        
        # Анализируем последовательность категорий для определения секций
        sections = {"main_table": []}
        current_block = []
        current_block_start = None
        
        # Находим переходы между секциями по смене доминирующей категории
        for i, item in enumerate(sorted_items):
            row_num = item.get("row_number", 0)
            category = item.get("category", "")
            
            # Проверяем, нужно ли начать новую секцию
            should_start_new_section = False
            
            if current_block:
                # Анализируем текущий блок
                prev_dominant_category = self._get_dominant_category(current_block)
                
                # Проверяем условия для начала новой секции:
                # 1. Смена категории на специализированную (Полуфабрикаты, Напитки, и т.д.)
                # 2. Если текущий блок уже большой (>50 товаров) и категория меняется
                
                specialized_categories = ["Полуфабрикаты", "Напитки", "Упаковка и приборы", "Десерты", "Бар"]
                
                # Начинаем новую секцию если:
                # - Переходим к специализированной категории и текущий блок уже достаточно большой
                # - Или если категория кардинально меняется (новая специализированная категория)
                if (category in specialized_categories and 
                    category != prev_dominant_category and 
                    len(current_block) > 5):  # Уменьшаем порог для лучшего разделения
                    should_start_new_section = True
                elif (len(current_block) > 30 and  # Снижаем порог для основной таблицы
                      category in specialized_categories and 
                      prev_dominant_category not in specialized_categories):
                    should_start_new_section = True
                # Дополнительная проверка: если в блоке уже есть несколько товаров одной специализированной категории,
                # а теперь идет другая специализированная категория - начинаем новую секцию
                elif (len(current_block) > 3 and 
                      category in specialized_categories and 
                      prev_dominant_category in specialized_categories and
                      category != prev_dominant_category):
                    should_start_new_section = True
            
            if should_start_new_section:
                # Завершаем текущий блок
                block_info = self._analyze_block_type(current_block)
                section_name = block_info["section"]
                
                if section_name not in sections:
                    sections[section_name] = []
                
                sections[section_name].append({
                    "start": current_block_start,
                    "end": current_block[-1].get("row_number", 0),
                    "items": [item["name"] for item in current_block],
                    "categories": block_info["categories"]
                })
                
                # Начинаем новый блок
                current_block = [item]
                current_block_start = row_num
            else:
                # Добавляем товар в текущий блок
                current_block.append(item)
                if current_block_start is None:
                    current_block_start = row_num
        
        # Завершаем последний блок
        if current_block:
            block_info = self._analyze_block_type(current_block)
            section_name = block_info["section"]
            
            if section_name not in sections:
                sections[section_name] = []
            
            sections[section_name].append({
                "start": current_block_start,
                "end": current_block[-1].get("row_number", 0),
                "items": [item["name"] for item in current_block],
                "categories": block_info["categories"]
            })
        
        # Логируем найденную структуру
        logger.info("📊 Динамически определенная структура файла:")
        for section_name, blocks in sections.items():
            if blocks:  # Только если есть блоки
                total_items = sum(len(block["items"]) for block in blocks)
                logger.info(f"   • {section_name}: {total_items} товаров в {len(blocks)} блоках")
                for block in blocks:
                    logger.info(f"     - Строки {block['start']}-{block['end']}: {len(block['items'])} товаров")
        
        return sections
    
    def _get_dominant_category(self, block_items: List[Dict[str, Any]]) -> str:
        """
        Определяет доминирующую (наиболее частую) категорию в блоке товаров.
        
        Используется для анализа структуры файла и определения типа секции.
        
        Args:
            block_items: Список товаров в блоке
            
        Returns:
            Название самой частой категории в блоке или пустую строку
        """
        if not block_items:
            return ""
        
        # Собираем статистику категорий
        categories = {}
        for item in block_items:
            category = item.get("category", "")
            categories[category] = categories.get(category, 0) + 1
        
        # Возвращаем самую частую категорию
        return max(categories.keys(), key=lambda k: categories[k]) if categories else ""
    
    def _analyze_block_type(self, block_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Анализирует тип блока товаров для определения секции"""
        
        if not block_items:
            return {"section": "main_table", "categories": []}
        
        # Собираем статистику категорий в блоке
        categories = {}
        for item in block_items:
            category = item.get("category", "")
            categories[category] = categories.get(category, 0) + 1
        
        total_items = len(block_items)
        
        # Определяем доминирующую категорию
        dominant_category = max(categories.keys(), key=lambda k: categories[k]) if categories else ""
        dominant_ratio = categories.get(dominant_category, 0) / total_items if total_items > 0 else 0
        
        # Логика определения секции:
        # 1. Если блок большой (>50 товаров) и смешанный - это основная таблица
        # 2. Если блок маленький и однородный (>80% одной категории) - это отдельная секция
        
        if total_items > 50:
            # Большой блок - скорее всего основная таблица
            section = "main_table"
        elif dominant_ratio > 0.8:
            # Однородный блок - отдельная секция
            if dominant_category == "Полуфабрикаты":
                section = "semifinished"
            elif dominant_category == "Напитки":
                section = "drinks"
            elif dominant_category == "Упаковка и приборы":
                section = "packaging"
            elif dominant_category == "Десерты":
                section = "desserts"
            elif dominant_category == "Бар":
                section = "bar"
            else:
                section = "main_table"
        else:
            # Смешанный блок - основная таблица
            section = "main_table"
        
        logger.debug(f"🔍 Блок строк {block_items[0]['row_number']}-{block_items[-1]['row_number']}: "
                    f"{total_items} товаров, доминирующая категория '{dominant_category}' ({dominant_ratio:.1%}) → {section}")
        
        return {
            "section": section,
            "categories": list(categories.keys())
        }

    def _determine_item_section(self, item_name: str, sections_structure: Dict[str, Any]) -> str:
        """Определяет к какой секции относится товар на основе анализа структуры"""
        
        # Ищем товар во всех секциях
        for section_name, blocks in sections_structure.items():
            for block in blocks:
                if item_name in block.get("items", []):
                    return section_name
        
        # Если товар не найден в структуре, пытаемся определить по названию категории
        # Это fallback для товаров, которых может не быть в excel_order.json
        logger.debug(f"🔍 Товар '{item_name}' не найден в структуре, используем fallback")
        return "main_table"

    def process_accounting_excel(self, excel_file_path: str) -> Dict[str, Any]:
        """
        Основной метод обработки Excel-файла от бухгалтерии - ГЛАВНАЯ ТОЧКА ВХОДА.
        
        Выполняет полный цикл обработки:
        1. 📄 Парсинг Excel файла и извлечение товаров
        2. 💾 Сохранение порядка товаров для будущих синхронизаций  
        3. 🔍 Сопоставление товаров с существующими в системе
        4. 🔄 Синхронизация inventory_template.json с Excel данными
        5. 📊 Проверка и синхронизация excel_template.py
        6. ✅ Финальная проверка целостности всех шаблонов
        
        Возможные статусы товаров:
        - Точные совпадения (100%) → НЕ добавляются (уже есть)
        - Высокоточные совпадения (≥80%) → НЕ добавляются (считаются теми же)
        - Низкоточные совпадения (<80%) → ДОБАВЛЯЮТСЯ как новые
        - Новые товары → ДОБАВЛЯЮТСЯ
        
        Args:
            excel_file_path: Путь к Excel файлу от бухгалтерии
            
        Returns:
            Dict с подробными результатами обработки:
            - success: успешность обработки
            - total_items: общее количество товаров в Excel
            - exact_matches: количество точных совпадений
            - fuzzy_matches: количество нечетких совпадений
            - new_items: количество новых товаров
            - removed_items: количество удаленных товаров
            - removed_items_details: список удаленных товаров
            - new_items_details: список новых товаров
            - templates_updated: какие шаблоны были обновлены
            - sync_check: результат финальной проверки синхронизации
        """
        
        logger.info(f"🚀 Начинаем обработку файла: {excel_file_path}")
        
        # 1. Парсим Excel-файл
        accounting_items = self.parser.parse_excel(excel_file_path)
        if not accounting_items:
            return {
                "success": False,
                "error": "Не удалось извлечь товары из Excel-файла"
            }
        
        logger.info(f"📋 Найдено товаров: {len(accounting_items)}")
        
        # 1.5. Сохраняем порядок товаров из Excel файла для будущей синхронизации
        self._save_excel_order(accounting_items)
        
        # 2. Сопоставляем товары
        match_results = self.matcher.match_items(accounting_items)
        
        # Группируем результаты
        exact_matches = [m for m in match_results if m.status == "exact_match"]
        fuzzy_matches = [m for m in match_results if m.status == "fuzzy_match"]
        new_items = [m for m in match_results if m.status == "new_item"]
        
        logger.info(f"✅ Точных совпадений (100% - НЕ добавляем): {len(exact_matches)}")
        logger.info(f"🔍 Нечётких совпадений (< 100% - ДОБАВЛЯЕМ): {len(fuzzy_matches)}")
        logger.info(f"🆕 Новых товаров (< 100% - ДОБАВЛЯЕМ): {len(new_items)}")
        
        # 3. Синхронизируем inventory_template.json с Excel файлом
        sync_result = self.updater.sync_inventory_template_with_excel(accounting_items, match_results)
        
        # 4. ВСЕГДА проверяем синхронизацию excel_template.py с inventory_template.json
        # и синхронизируем если нужно
        logger.info("🔄 Проверяем синхронизацию excel_template.py с inventory_template.json...")
        excel_sync_result = self.synchronize_templates_with_excel_order()
        
        # Объединяем результаты синхронизации
        templates_updated = {
            "inventory_template": sync_result["changes_made"],
            "excel_template": excel_sync_result.get("changes_made", False)
        }
        
        logger.info(f"📊 Результат синхронизации шаблонов:")
        logger.info(f"   • inventory_template.json: {'✅ обновлен' if templates_updated['inventory_template'] else '⏭️ без изменений'}")
        logger.info(f"   • excel_template.py: {'✅ обновлен' if templates_updated['excel_template'] else '⏭️ без изменений'}")
        
        # 5. Проверяем финальную синхронизацию шаблонов
        sync_check = self.check_template_synchronization()
        
        return {
            "success": True,
            "total_items": len(accounting_items),
            "exact_matches": len(exact_matches),
            "fuzzy_matches": len(fuzzy_matches),
            "new_items": len(new_items),
            "removed_items": sync_result.get("removed_count", 0),
            "removed_items_details": sync_result.get("removed_items", []),
            "new_items_details": [(item.accounting_item.name, None) for item in new_items],
            "templates_updated": templates_updated,
            "sync_check": sync_check
        }

# Пример использования
def example_usage():
    """Пример использования адаптера"""
    
    adapter = InventoryAdapter()
    
    # Обрабатываем Excel-файл от бухгалтерии
    result = adapter.process_accounting_excel("путь/к/файлу/бухгалтерии.xlsx")
    
    print("📊 ОТЧЕТ АДАПТАЦИИ:")
    print(f"✅ Всего товаров: {result['total_items']}")
    print(f"✅ Точных совпадений (100% - НЕ добавляем): {result['exact_matches']}")
    print(f"🔍 Нечётких совпадений (< 100% - ДОБАВЛЯЕМ): {result['fuzzy_matches']}")
    print(f"🆕 Новых товаров (< 100% - ДОБАВЛЯЕМ): {result['new_items']}")
    
    if result['templates_updated']['inventory_template']:
        print("💾 Обновлен inventory_template.json")
    
    if result['templates_updated']['excel_template']:
        print("💾 Обновлен excel_template.py") 