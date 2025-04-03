import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
import logging
from models.database import db

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
    def ensure_table_exists():
        """Проверяет существование таблицы и создает её при необходимости"""
        conn = db.get_db()
        try:
            with conn.cursor() as cursor:
                # Проверяем существование таблицы
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'access_settings'
                    );
                """)
                table_exists = cursor.fetchone()[0]
                
                if not table_exists:
                    logger.info("Таблица access_settings не существует. Создаем...")
                    
                    # SQL запрос для создания таблицы
                    create_table_sql = """
                    CREATE TABLE access_settings (
                        id SERIAL PRIMARY KEY,
                        chat_id VARCHAR NOT NULL UNIQUE,
                        allow_multiple_shifts BOOLEAN DEFAULT FALSE,
                        auto_approve BOOLEAN DEFAULT FALSE,
                        allow_same_day BOOLEAN DEFAULT FALSE,
                        registration_start_day INTEGER DEFAULT 4,
                        registration_start_hour INTEGER DEFAULT 12,
                        registration_start_minute INTEGER DEFAULT 0,
                        offset_type VARCHAR DEFAULT 'weeks',
                        offset_amount INTEGER DEFAULT 1,
                        period_length INTEGER DEFAULT 7,
                        is_always_active BOOLEAN DEFAULT TRUE,
                        active_start_date VARCHAR,
                        active_end_date VARCHAR,
                        days_ahead INTEGER DEFAULT 14,
                        enabled_dates JSONB DEFAULT '[]'::jsonb,
                        restricted_users JSONB DEFAULT '[]'::jsonb,
                        additional_settings JSONB DEFAULT '{}'::jsonb,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_by VARCHAR
                    );
                    CREATE INDEX ix_access_settings_chat_id ON access_settings(chat_id);
                    """
                    
                    cursor.execute(create_table_sql)
                    conn.commit()
                    logger.info("✅ Таблица access_settings успешно создана")
                    return True
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при проверке/создании таблицы: {str(e)}")
            conn.rollback()
            return False

    @staticmethod
    def table_exists() -> bool:
        """Проверяет существование таблицы"""
        conn = db.get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'access_settings'
                    );
                """)
                return cursor.fetchone()[0]
        except Exception as e:
            logger.error(f"❌ Ошибка при проверке существования таблицы: {str(e)}")
            return False

    @staticmethod
    def load_settings(chat_id=None) -> Dict[str, Any]:
        """Загрузка настроек доступа из БД"""
        try:
            # Проверяем существование таблицы
            if not AccessSettingsService.ensure_table_exists():
                logger.error("❌ Не удалось создать таблицу access_settings")
                return {}

            conn = db.get_db()
            try:
                with conn.cursor() as cursor:
                    # Ищем настройки в БД
                    cursor.execute("""
                        SELECT * FROM access_settings 
                        WHERE chat_id = %s
                    """, (chat_id or 'default',))
                    
                    result = cursor.fetchone()
                    
                    if result:
                        # Преобразуем результат в словарь
                        columns = [desc[0] for desc in cursor.description]
                        settings = dict(zip(columns, result))
                        
                        # Проверяем наличие колонки updated_by
                        result_dict = {
                            "chat_id": settings['chat_id'],
                            "allowMultipleShifts": settings['allow_multiple_shifts'],
                            "autoApprove": settings['auto_approve'],
                            "allowSameDay": settings['allow_same_day'],
                            "registrationStartDay": settings['registration_start_day'],
                            "registrationStartHour": settings['registration_start_hour'],
                            "registrationStartMinute": settings['registration_start_minute'],
                            "offsetType": settings['offset_type'],
                            "offsetAmount": settings['offset_amount'],
                            "periodLength": settings['period_length'],
                            "isAlwaysActive": settings['is_always_active'],
                            "activeStartDate": settings['active_start_date'],
                            "activeEndDate": settings['active_end_date'],
                            "daysAhead": settings['days_ahead'],
                            "enabledDates": settings['enabled_dates'],
                            "restrictedUsers": settings['restricted_users'],
                            "lastUpdated": settings['last_updated'].isoformat() if settings['last_updated'] else None
                        }
                        
                        # Добавляем updated_by только если оно есть в базе
                        if 'updated_by' in settings:
                            result_dict["updatedBy"] = settings['updated_by']
                            
                        return result_dict

                    # Если настройки не найдены, создаем новые
                    default_settings = {
                        "chat_id": chat_id or 'default',
                        "allowMultipleShifts": False,
                        "autoApprove": False,
                        "allowSameDay": False,
                        "registrationStartDay": 4,
                        "registrationStartHour": 12,
                        "registrationStartMinute": 0,
                        "offsetType": "weeks",
                        "offsetAmount": 1,
                        "periodLength": 7,
                        "isAlwaysActive": True,
                        "activeStartDate": "",
                        "activeEndDate": "",
                        "daysAhead": 14,
                        "enabledDates": [],
                        "restrictedUsers": [],
                        "lastUpdated": AccessSettingsService.get_current_time()
                    }
                    
                    # Сохраняем настройки по умолчанию в БД
                    AccessSettingsService.save_settings(default_settings, chat_id)
                    return default_settings

            except Exception as e:
                logger.error(f"Error loading access settings for chat {chat_id}: {str(e)}")
                return {}

        except Exception as e:
            logger.error(f"Error loading access settings for chat {chat_id}: {str(e)}")
            return {}
    
    @staticmethod
    def save_settings(settings: Dict[str, Any], chat_id=None) -> bool:
        """Сохранение настроек доступа в БД"""
        if not chat_id and 'chat_id' in settings:
            chat_id = settings['chat_id']
        
        if not chat_id:
            logger.error("❌ chat_id не указан для сохранения настроек")
            return False
            
        # Проверяем, что таблица существует
        if not AccessSettingsService.table_exists():
            logger.error("❌ Таблица настроек не существует")
            return False
            
        # Устанавливаем текущее время
        current_time = datetime.now()
        
        try:
            conn = db.get_db()
            try:
                with conn.cursor() as cursor:
                    # Проверяем существование записи для этого чата
                    cursor.execute("SELECT 1 FROM access_settings WHERE chat_id = %s", (chat_id,))
                    exists = cursor.fetchone() is not None
                    
                    # Проверяем, существует ли колонка updated_by
                    cursor.execute("""
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'access_settings'
                        AND column_name = 'updated_by'
                    """)
                    has_updated_by = cursor.fetchone() is not None
                    
                    if exists:
                        # Обновляем существующую запись
                        query = """
                            UPDATE access_settings SET
                                allow_multiple_shifts = %s,
                                auto_approve = %s,
                                allow_same_day = %s,
                                registration_start_day = %s,
                                registration_start_hour = %s,
                                registration_start_minute = %s,
                                offset_type = %s,
                                offset_amount = %s,
                                period_length = %s,
                                is_always_active = %s,
                                active_start_date = %s,
                                active_end_date = %s,
                                days_ahead = %s,
                                enabled_dates = %s,
                                restricted_users = %s,
                                last_updated = %s
                        """
                        
                        params = [
                            settings.get('allowMultipleShifts', False),
                            settings.get('autoApprove', False),
                            settings.get('allowSameDay', False),
                            settings.get('registrationStartDay', 4),
                            settings.get('registrationStartHour', 12),
                            settings.get('registrationStartMinute', 0),
                            settings.get('offsetType', 'weeks'),
                            settings.get('offsetAmount', 1),
                            settings.get('periodLength', 7),
                            settings.get('isAlwaysActive', True),
                            settings.get('activeStartDate', ''),
                            settings.get('activeEndDate', ''),
                            settings.get('daysAhead', 14),
                            json.dumps(settings.get('enabledDates', [])),
                            json.dumps(settings.get('restrictedUsers', [])),
                            current_time
                        ]
                        
                        # Добавляем updated_by, если колонка существует
                        if has_updated_by:
                            query += ", updated_by = %s"
                            params.append(settings.get('updatedBy'))
                            
                        query += " WHERE chat_id = %s"
                        params.append(chat_id)
                        
                        cursor.execute(query, params)
                    else:
                        # Создаем новую запись
                        query = """
                            INSERT INTO access_settings (
                                chat_id,
                                allow_multiple_shifts,
                                auto_approve,
                                allow_same_day,
                                registration_start_day,
                                registration_start_hour,
                                registration_start_minute,
                                offset_type,
                                offset_amount,
                                period_length,
                                is_always_active,
                                active_start_date,
                                active_end_date,
                                days_ahead,
                                enabled_dates,
                                restricted_users,
                                last_updated
                        """
                        
                        params = [
                            chat_id,
                            settings.get('allowMultipleShifts', False),
                            settings.get('autoApprove', False),
                            settings.get('allowSameDay', False),
                            settings.get('registrationStartDay', 4),
                            settings.get('registrationStartHour', 12),
                            settings.get('registrationStartMinute', 0),
                            settings.get('offsetType', 'weeks'),
                            settings.get('offsetAmount', 1),
                            settings.get('periodLength', 7),
                            settings.get('isAlwaysActive', True),
                            settings.get('activeStartDate', ''),
                            settings.get('activeEndDate', ''),
                            settings.get('daysAhead', 14),
                            json.dumps(settings.get('enabledDates', [])),
                            json.dumps(settings.get('restrictedUsers', [])),
                            current_time
                        ]
                        
                        # Добавляем updated_by, если колонка существует
                        if has_updated_by:
                            query += ", updated_by"
                            params.append(settings.get('updatedBy'))
                            
                        query += ") VALUES (" + "%s, " * (len(params) - 1) + "%s)"
                        
                        cursor.execute(query, params)

                conn.commit()
                return True

            except Exception as e:
                logger.error(f"Error saving access settings: {str(e)}")
                conn.rollback()
                return False

        except Exception as e:
            logger.error(f"Error saving access settings: {str(e)}")
            return False

    @staticmethod
    def update_settings(updates: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        """Обновление настроек доступа"""
        chat_id = updates.get('chat_id')
        if not chat_id:
            logger.error("❌ chat_id не указан в обновлениях")
            return {}

        # Загружаем текущие настройки
        current_settings = AccessSettingsService.load_settings(chat_id)
        if not current_settings:
            logger.error(f"❌ Не удалось загрузить текущие настройки для чата {chat_id}")
            return {}

        # Обновляем настройки
        updated_settings = {**current_settings, **updates}
        if user_id:
            updated_settings['updatedBy'] = user_id

        # Сохраняем обновленные настройки
        if AccessSettingsService.save_settings(updated_settings, chat_id):
            return updated_settings
        return {}

    @staticmethod
    def get_all_chat_settings():
        """Получение настроек для всех чатов"""
        conn = db.get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM access_settings")
                results = cursor.fetchall()
                
                # Преобразуем результаты в список словарей
                columns = [desc[0] for desc in cursor.description]
                settings_list = []
                
                for row in results:
                    settings = dict(zip(columns, row))
                    settings_list.append({
                        "chat_id": settings['chat_id'],
                        "allowMultipleShifts": settings['allow_multiple_shifts'],
                        "autoApprove": settings['auto_approve'],
                        "allowSameDay": settings['allow_same_day'],
                        "registrationStartDay": settings['registration_start_day'],
                        "registrationStartHour": settings['registration_start_hour'],
                        "registrationStartMinute": settings['registration_start_minute'],
                        "offsetType": settings['offset_type'],
                        "offsetAmount": settings['offset_amount'],
                        "periodLength": settings['period_length'],
                        "isAlwaysActive": settings['is_always_active'],
                        "activeStartDate": settings['active_start_date'],
                        "activeEndDate": settings['active_end_date'],
                        "daysAhead": settings['days_ahead'],
                        "enabledDates": settings['enabled_dates'],
                        "restrictedUsers": settings['restricted_users'],
                        "lastUpdated": settings['last_updated'].isoformat() if settings['last_updated'] else None,
                        "updatedBy": settings['updated_by']
                    })
                
                return settings_list
        except Exception as e:
            logger.error(f"Error getting all chat settings: {str(e)}")
            return []

    @staticmethod
    def calculate_available_dates(user_id: Optional[str] = None, chat_id: Optional[str] = None) -> List[str]:
        """Расчет доступных дат для регистрации"""
        settings = AccessSettingsService.load_settings(chat_id)
        if not settings:
            return []

        try:
            # Получаем текущую дату
            now = datetime.now()
            available_dates = []

            # Если пользователь в списке ограниченных, возвращаем пустой список
            if user_id and settings.get('restrictedUsers') and str(user_id) in settings.get('restrictedUsers', []):
                return []

            # Если указаны конкретные даты
            if settings.get('enabledDates'):
                return settings['enabledDates']

            # Если установлен период активности
            if not settings.get('isAlwaysActive', True):
                start_date = datetime.fromisoformat(settings['activeStartDate']) if settings.get('activeStartDate') else None
                end_date = datetime.fromisoformat(settings['activeEndDate']) if settings.get('activeEndDate') else None

                if start_date and now < start_date:
                    return []
                if end_date and now > end_date:
                    return []

            def next_weekday(d, weekday):
                """Получение следующей даты для указанного дня недели"""
                days_ahead = weekday - d.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return d + timedelta(days=days_ahead)

            # Расчет дат на основе настроек
            registration_day = settings.get('registrationStartDay', 4)
            days_ahead = settings.get('daysAhead', 14)
            period_length = settings.get('periodLength', 7)

            # Получаем следующую дату регистрации
            next_reg_date = next_weekday(now, registration_day)
            
            # Добавляем даты в список
            current_date = next_reg_date
            while len(available_dates) < days_ahead:
                date_str = current_date.strftime('%Y-%m-%d')
                available_dates.append(date_str)
                current_date += timedelta(days=period_length)

            return available_dates

        except Exception as e:
            logger.error(f"Error calculating available dates: {str(e)}")
            return []

    @staticmethod
    def is_date_available(date_str: str, user_id: Optional[str] = None, chat_id: Optional[str] = None) -> bool:
        """Проверка доступности даты для регистрации"""
        try:
            available_dates = AccessSettingsService.calculate_available_dates(user_id, chat_id)
            return date_str in available_dates
        except Exception as e:
            logger.error(f"Error checking date availability: {str(e)}")
            return False 