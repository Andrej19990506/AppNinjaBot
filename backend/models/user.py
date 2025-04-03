from datetime import datetime
from typing import Optional, Dict, Any
from models.database import db

class User:
    """Класс для работы с пользователями в базе данных"""
    
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
                        WHERE table_name = 'users'
                    );
                """)
                table_exists = cursor.fetchone()[0]
                
                if not table_exists:
                    # SQL запрос для создания таблицы
                    create_table_sql = """
                    CREATE TABLE users (
                        id SERIAL PRIMARY KEY,
                        telegram_id INTEGER UNIQUE NOT NULL,
                        username VARCHAR(255),
                        first_name VARCHAR(255),
                        last_name VARCHAR(255),
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                    
                    cursor.execute(create_table_sql)
                    conn.commit()
                    return True
                return True
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def create_or_update(
        telegram_id: int,
        username: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Создает или обновляет пользователя в базе данных"""
        User.ensure_table_exists()
        
        conn = db.get_db()
        try:
            with conn.cursor() as cursor:
                # Проверяем существование пользователя
                cursor.execute("""
                    SELECT * FROM users WHERE telegram_id = %s
                """, (telegram_id,))
                
                user = cursor.fetchone()
                current_time = datetime.now()
                
                if user:
                    # Обновляем существующего пользователя
                    cursor.execute("""
                        UPDATE users SET
                            username = %s,
                            first_name = %s,
                            last_name = %s,
                            updated_at = %s
                        WHERE telegram_id = %s
                        RETURNING *
                    """, (username, first_name, last_name, current_time, telegram_id))
                else:
                    # Создаем нового пользователя
                    cursor.execute("""
                        INSERT INTO users (
                            telegram_id, username, first_name, last_name,
                            created_at, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING *
                    """, (telegram_id, username, first_name, last_name, current_time, current_time))
                
                conn.commit()
                result = cursor.fetchone()
                
                # Преобразуем результат в словарь
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, result))
                
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def get_by_telegram_id(telegram_id: int) -> Optional[Dict[str, Any]]:
        """Получает пользователя по его Telegram ID"""
        User.ensure_table_exists()
        
        conn = db.get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT * FROM users WHERE telegram_id = %s
                """, (telegram_id,))
                
                result = cursor.fetchone()
                if not result:
                    return None
                
                # Преобразуем результат в словарь
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, result))
                
        except Exception as e:
            raise e

    @staticmethod
    def deactivate(telegram_id: int) -> bool:
        """Деактивирует пользователя"""
        User.ensure_table_exists()
        
        conn = db.get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE users SET
                        is_active = FALSE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE telegram_id = %s
                """, (telegram_id,))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def activate(telegram_id: int) -> bool:
        """Активирует пользователя"""
        User.ensure_table_exists()
        
        conn = db.get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE users SET
                        is_active = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE telegram_id = %s
                """, (telegram_id,))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            conn.rollback()
            raise e 