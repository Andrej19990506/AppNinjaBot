import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
import logging

# Настраиваем логирование
logger = logging.getLogger(__name__)

# Директория для хранения настроек доступа
ACCESS_SETTINGS_DIR = os.path.join('data', 'access_settings')
# Старый путь к файлу, для обратной совместимости
OLD_ACCESS_SETTINGS_FILE = os.path.join('data', 'shift_access_settings.json')

class AccessSettingsService:
    """Сервис для работы с настройками доступа к сменам"""
    
    @staticmethod
    def get_current_time() -> str:
        """Получение текущего времени в ISO формате"""
        return datetime.now().isoformat()
    
    @staticmethod
    def get_settings_file_path(chat_id=None):
        """Возвращает путь к файлу настроек для конкретного чата или общего файла"""
        # Если chat_id не указан, используем старый путь для обратной совместимости
        if not chat_id:
            return OLD_ACCESS_SETTINGS_FILE
        
        # Создаем директорию, если она не существует
        os.makedirs(ACCESS_SETTINGS_DIR, exist_ok=True)
        
        # Возвращаем путь к файлу настроек для конкретного чата
        return os.path.join(ACCESS_SETTINGS_DIR, f"settings_{chat_id}.json")
    
    @staticmethod
    def load_settings(chat_id=None) -> Dict[str, Any]:
        """Загрузка настроек доступа из JSON файла"""
        try:
            # Получаем путь к файлу настроек
            settings_file = AccessSettingsService.get_settings_file_path(chat_id)
            
            # Если файла нет, проверяем общий файл для обратной совместимости
            if not os.path.exists(settings_file) and chat_id:
                if os.path.exists(OLD_ACCESS_SETTINGS_FILE):
                    logger.info(f"Файл настроек для чата {chat_id} не найден, используем общие настройки")
                    with open(OLD_ACCESS_SETTINGS_FILE, 'r', encoding='utf-8') as file:
                        settings = json.load(file)
                    # Сохраняем копию для конкретного чата
                    settings["chat_id"] = chat_id
                    AccessSettingsService.save_settings(settings, chat_id)
                    return settings
            
            if os.path.exists(settings_file):
                with open(settings_file, 'r', encoding='utf-8') as file:
                    return json.load(file)
            else:
                # Возвращаем настройки по умолчанию, если файл не существует
                default_settings = {
                    # ID чата
                    "chat_id": chat_id,
                    
                    # Общие настройки
                    "allowMultipleShifts": False,
                    "autoApprove": False,
                    "allowSameDay": False,
                    
                    # Настройки периода регистрации
                    "registrationStartDay": 4,  # Четверг
                    "registrationStartHour": 12,  # 12:00
                    "registrationStartMinute": 0,
                    
                    # Новые гибкие настройки периода доступа
                    "offsetType": "weeks",  # Тип смещения (дни или недели)
                    "offsetAmount": 1,      # Величина смещения (1 неделя)
                    "periodLength": 7,      # Длительность периода доступа (7 дней)
                    "isAlwaysActive": True, # Активно ли правило постоянно
                    "activeStartDate": "",  # Дата начала активности правила
                    "activeEndDate": "",    # Дата окончания активности правила
                    
                    # Старые поля (сохранены для обратной совместимости)
                    "daysAhead": 14,        # 2 недели
                    "enabledDates": [],     # Список дат, на которые можно записываться
                    
                    # Персональные ограничения
                    "restrictedUsers": [],
                    
                    # Метаданные
                    "lastUpdated": AccessSettingsService.get_current_time()
                }
                # Создаем файл с настройками по умолчанию
                AccessSettingsService.save_settings(default_settings, chat_id)
                return default_settings
        except Exception as e:
            logger.error(f"Error loading access settings for chat {chat_id}: {str(e)}")
            return {}
    
    @staticmethod
    def save_settings(settings: Dict[str, Any], chat_id=None) -> bool:
        """Сохранение настроек доступа в JSON файл"""
        try:
            # Получаем путь к файлу
            settings_file = AccessSettingsService.get_settings_file_path(chat_id or settings.get('chat_id'))
            
            # Создаем директорию, если она не существует
            os.makedirs(os.path.dirname(settings_file), exist_ok=True)
            
            # Обновляем дату последнего обновления
            settings["lastUpdated"] = AccessSettingsService.get_current_time()
            
            with open(settings_file, 'w', encoding='utf-8') as file:
                json.dump(settings, file, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error saving access settings for chat {chat_id}: {str(e)}")
            return False
    
    @staticmethod
    def update_settings(updates: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        """Обновление настроек доступа"""
        try:
            logger.info(f"📝 AccessSettingsService.update_settings: Начало обновления настроек доступа")
            logger.info(f"🔑 Ключи в запросе: {list(updates.keys())}")
            logger.info(f"📊 Количество полей: {len(updates)}")
            
            # Получаем chat_id из обновлений
            chat_id = updates.get('chat_id')
            
            # Загружаем текущие настройки
            current_settings = AccessSettingsService.load_settings(chat_id)
            logger.info(f"🔄 Текущие настройки содержат {len(current_settings)} полей: {list(current_settings.keys())}")
            
            # Обновляем настройки
            for key, value in updates.items():
                if value is not None:  # Обновляем только непустые значения
                    current_settings[key] = value
            
            # Обновляем метаданные
            current_settings["lastUpdated"] = AccessSettingsService.get_current_time()
            if user_id:
                current_settings["updatedBy"] = user_id
            
            logger.info(f"📊 После объединения настройки содержат {len(current_settings)} полей")
            
            # Сохраняем обновленные настройки
            if AccessSettingsService.save_settings(current_settings, chat_id):
                logger.info(f"✅ Настройки успешно сохранены в файл")
                return current_settings
            else:
                logger.error(f"❌ Не удалось сохранить настройки в файл")
                raise Exception("Failed to save updated settings")
        except Exception as e:
            logger.error(f"❌ Ошибка при обновлении настроек доступа: {str(e)}")
            raise
    
    @staticmethod
    def get_all_chat_settings():
        """Получает настройки для всех чатов"""
        try:
            # Создаем директорию, если она не существует
            os.makedirs(ACCESS_SETTINGS_DIR, exist_ok=True)
            
            # Получаем список всех файлов настроек
            all_settings = {}
            
            # Проверяем старый файл для обратной совместимости
            if os.path.exists(OLD_ACCESS_SETTINGS_FILE):
                with open(OLD_ACCESS_SETTINGS_FILE, 'r', encoding='utf-8') as file:
                    all_settings['default'] = json.load(file)
            
            # Получаем все файлы настроек из директории
            for filename in os.listdir(ACCESS_SETTINGS_DIR):
                if filename.startswith('settings_') and filename.endswith('.json'):
                    chat_id = filename[9:-5]  # Извлекаем chat_id из имени файла
                    settings_file = os.path.join(ACCESS_SETTINGS_DIR, filename)
                    with open(settings_file, 'r', encoding='utf-8') as file:
                        all_settings[chat_id] = json.load(file)
            
            return all_settings
            
        except Exception as e:
            logger.error(f"Error getting all chat settings: {str(e)}")
            return {}
    
    @staticmethod
    def calculate_available_dates(user_id: Optional[str] = None, chat_id: Optional[str] = None) -> List[str]:
        """
        Расчет доступных дат для записи на смену
        
        Args:
            user_id: ID пользователя для проверки персональных ограничений
            chat_id: ID чата для получения настроек
            
        Returns:
            List[str]: Список доступных дат в формате YYYY-MM-DD
        """
        from datetime import datetime, timedelta
        import time
        
        # Получаем настройки
        settings = AccessSettingsService.load_settings(chat_id)
        
        # Проверяем, ограничен ли пользователь
        if user_id and str(user_id) in [str(uid) for uid in settings.get("restrictedUsers", [])]:
            logger.info(f"User {user_id} is restricted from booking shifts")
            return []
        
        # Проверяем, активно ли правило
        if not settings.get("isAlwaysActive", True):
            # Если правило не всегда активно, проверяем, находимся ли мы в указанном диапазоне дат
            current_date = datetime.now().date()
            start_date = datetime.strptime(settings.get("activeStartDate", ""), "%Y-%m-%d").date() if settings.get("activeStartDate") else None
            end_date = datetime.strptime(settings.get("activeEndDate", ""), "%Y-%m-%d").date() if settings.get("activeEndDate") else None
            
            if (start_date and current_date < start_date) or (end_date and current_date > end_date):
                # Мы находимся вне указанного диапазона
                logger.info(f"Current date is outside the active period: {start_date} - {end_date}")
                return []
        
        # Текущая дата и время
        now = datetime.now()
        
        # День недели и время открытия регистрации
        registration_day = settings.get("registrationStartDay", 4)  # Четверг по умолчанию
        registration_hour = settings.get("registrationStartHour", 12)  # 12:00 по умолчанию
        registration_minute = settings.get("registrationStartMinute", 0)
        
        # Находим ближайший день недели для открытия регистрации
        def next_weekday(d, weekday):
            days_ahead = weekday - d.weekday()
            if days_ahead <= 0:  # если сегодня этот день или он был раньше на этой неделе
                days_ahead += 7
            return d + timedelta(days=days_ahead)
        
        # Преобразуем день из формата 0-6 (воскресенье-суббота) в 0-6 (понедельник-воскресенье)
        # Python использует 0 для понедельника, 6 для воскресенья
        python_weekday = registration_day % 7
        if python_weekday == 0:
            python_weekday = 6  # Воскресенье
        else:
            python_weekday -= 1  # Остальные дни
        
        # Находим следующий день регистрации
        next_opening_day = next_weekday(now.replace(hour=0, minute=0, second=0, microsecond=0), python_weekday)
        
        # Устанавливаем время открытия регистрации
        registration_datetime = next_opening_day.replace(
            hour=registration_hour,
            minute=registration_minute,
            second=0,
            microsecond=0
        )
        
        # Проверяем, открыта ли уже регистрация
        is_registration_open = now >= registration_datetime
        
        if not is_registration_open:
            logger.info(f"Registration is not open yet. Opens at {registration_datetime}")
            return []
        
        # Рассчитываем начальную дату периода доступа
        offset_type = settings.get("offsetType", "weeks")
        offset_amount = settings.get("offsetAmount", 1)
        
        # Начальная дата доступного периода
        if offset_type == "weeks":
            # Смещение в неделях
            access_start_date = registration_datetime + timedelta(weeks=offset_amount)
        elif offset_type == "days":
            # Смещение в днях
            access_start_date = registration_datetime + timedelta(days=offset_amount)
        else:
            # Если тип смещения не указан или равен 'none', используем текущую дату
            access_start_date = now
        
        # Длительность периода в днях
        period_length = settings.get("periodLength", 7)
        
        # Рассчитываем все доступные даты
        available_dates = []
        for i in range(period_length):
            date = (access_start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            available_dates.append(date)
        
        # Добавляем специальные даты из настроек, если они есть
        enabled_dates = settings.get("enabledDates", [])
        for date in enabled_dates:
            if date not in available_dates:
                available_dates.append(date)
        
        # Разрешаем запись на текущий день, если это включено в настройках
        if settings.get("allowSameDay", False):
            today_str = now.strftime("%Y-%m-%d")
            if today_str not in available_dates:
                available_dates.append(today_str)
        
        logger.info(f"Calculated {len(available_dates)} available dates for chat {chat_id}")
        return available_dates
    
    @staticmethod
    def is_date_available(date_str: str, user_id: Optional[str] = None, chat_id: Optional[str] = None) -> bool:
        """
        Проверка доступности конкретной даты для записи
        
        Args:
            date_str: Дата в формате YYYY-MM-DD
            user_id: ID пользователя для проверки персональных ограничений
            chat_id: ID чата для получения настроек
            
        Returns:
            bool: True если дата доступна для записи, иначе False
        """
        available_dates = AccessSettingsService.calculate_available_dates(user_id, chat_id)
        return date_str in available_dates 