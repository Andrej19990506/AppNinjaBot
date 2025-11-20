import bcrypt
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.admin_user import AdminUser, AdminRole
from core.security import create_access_token, create_refresh_token, TokenType


def hash_password(password: str) -> str:
    """Хеширует пароль с помощью bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


async def authenticate_admin(
    email: str,
    password: str,
    db: AsyncSession
) -> AdminUser | None:
    """Аутентифицирует администратора по email и паролю"""
    import logging
    logger = logging.getLogger(__name__)
    
    stmt = select(AdminUser).where(AdminUser.email == email)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    
    if not admin:
        logger.warning(f"[Admin Auth] Пользователь не найден: email={email}")
        return None
    
    if not admin.is_active:
        logger.warning(f"[Admin Auth] Аккаунт неактивен: email={email}")
        return None
    
    password_valid = verify_password(password, admin.password_hash)
    if not password_valid:
        logger.warning(f"[Admin Auth] Неверный пароль: email={email}")
        return None
    
    logger.info(f"[Admin Auth] Успешная аутентификация: email={email}, role={admin.role_enum}")
    
    # Обновляем время последнего входа
    admin.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(admin)
    
    return admin


def create_admin_token(admin: AdminUser) -> str:
    """Создает JWT access токен для администратора"""
    claims = {
        "email": admin.email,
        "role": admin.role_enum.value,
        "company_bot_id": admin.company_bot_id,
        "user_type": "admin"  # Используем user_type вместо type, чтобы не конфликтовать с типом токена
    }
    return create_access_token(str(admin.id), claims)


def create_admin_refresh_token(admin: AdminUser) -> str:
    """Создает JWT refresh токен для администратора"""
    claims = {
        "email": admin.email,
        "role": admin.role_enum.value,
        "company_bot_id": admin.company_bot_id,
        "user_type": "admin"  # Используем user_type вместо type, чтобы не конфликтовать с типом токена
    }
    return create_refresh_token(str(admin.id), claims)

