"""
Скрипт для создания первого суперадмина.
Использование: 
    python scripts/create_superadmin.py
    python scripts/create_superadmin.py --email admin@example.com --password secret123 --name "Admin Name"
"""
import asyncio
import sys
import argparse
from pathlib import Path

# Добавляем корневую директорию в путь
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

from core.config import settings
from core.admin_auth import hash_password
from models.admin_user import AdminUser
from models.admin_user import AdminRole


async def create_superadmin(email: str = None, password: str = None, name: str = None):
    """Создает первого суперадмина"""
    
    # Создаем подключение к БД
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )
    
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        # Запрашиваем данные, если не переданы через аргументы
        print("\n=== Создание суперадмина ===")
        
        if not email:
            email = input("Email: ").strip()
        
        if not email:
            print("❌ Email не может быть пустым!")
            return
        
        # Проверяем, существует ли пользователь с таким email
        try:
            result = await session.execute(
                select(AdminUser).where(AdminUser.email == email)
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"❌ Пользователь с email {email} уже существует!")
                return
        except Exception as e:
            # Игнорируем ошибки при проверке (если таблица пустая)
            print(f"⚠️  Предупреждение при проверке существующих пользователей: {e}")
        
        if not password:
            password = input("Пароль: ").strip()
        
        if not password or len(password) < 6:
            print("❌ Пароль должен содержать минимум 6 символов!")
            return
        
        if not name:
            name_input = input("Имя (необязательно): ").strip()
            name = name_input if name_input else None
        
        # Хешируем пароль
        password_hash = hash_password(password)
        
        # Используем raw SQL для вставки, так как SQLAlchemy неправильно обрабатывает enum
        name_value = name if name else None
        
        result = await session.execute(
            text("""
                INSERT INTO admin_users (email, password_hash, role, company_bot_id, name, is_active, created_at, updated_at)
                VALUES (:email, :password_hash, 'super_admin'::adminrole, NULL, :name, true, now(), now())
                RETURNING id, email, name, role
            """),
            {
                "email": email,
                "password_hash": password_hash,
                "name": name_value
            }
        )
        
        row = result.fetchone()
        await session.commit()
        
        print(f"\n✅ Суперадмин успешно создан!")
        print(f"   ID: {row[0]}")
        print(f"   Email: {row[1]}")
        print(f"   Имя: {row[2] or 'Не указано'}")
        print(f"   Роль: {row[3]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Создание суперадмина")
    parser.add_argument("--email", type=str, help="Email суперадмина")
    parser.add_argument("--password", type=str, help="Пароль суперадмина")
    parser.add_argument("--name", type=str, help="Имя суперадмина (необязательно)")
    
    args = parser.parse_args()
    
    asyncio.run(create_superadmin(
        email=args.email,
        password=args.password,
        name=args.name
    ))

