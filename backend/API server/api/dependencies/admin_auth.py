from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import TokenType, decode_token
from db.session import get_db_session
from models.admin_user import AdminUser, AdminRole

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> AdminUser:
    """Получает текущего администратора из токена"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials, TokenType.ACCESS)
    
    # Проверяем, что это токен администратора
    # payload - это TokenPayload объект, но дополнительные поля (user_type) находятся в _decoded_dict
    # Получаем полный словарь с дополнительными полями
    decoded_dict = getattr(payload, '_decoded_dict', payload.model_dump())
    user_type = decoded_dict.get("user_type")
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[Admin Auth] Token payload keys: {list(decoded_dict.keys())}, user_type: {user_type}")
    
    if user_type != "admin":
        logger.warning(f"[Admin Auth] Invalid user_type: {user_type}, expected 'admin'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        admin_id = int(payload.sub)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token subject",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    stmt = select(AdminUser).where(AdminUser.id == admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is inactive",
        )
    
    return admin


async def require_super_admin(
    current_admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    """Требует права суперадминистратора"""
    if current_admin.role_enum != AdminRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_admin


async def require_company_admin(
    current_admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    """Требует права администратора компании"""
    if current_admin.role_enum != AdminRole.COMPANY_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company admin access required",
        )
    return current_admin

