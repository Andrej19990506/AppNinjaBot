import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db_session
from models.admin_user import AdminUser, AdminRole
from schemas.admin import AdminLoginRequest, AdminTokenResponse, AdminUserResponse, AdminUserCreate, AdminUserUpdate, AdminRefreshRequest
from core.admin_auth import authenticate_admin, create_admin_token, create_admin_refresh_token, hash_password
from core.security import decode_token, TokenType
from api.dependencies.admin_auth import get_current_admin, require_super_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/auth/login", response_model=AdminTokenResponse)
async def admin_login(
    login_data: AdminLoginRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Вход администратора"""
    logger.info(f"[Admin Login] Попытка входа: email={login_data.email}")
    
    admin = await authenticate_admin(login_data.email, login_data.password, db)
    
    if not admin:
        logger.warning(f"[Admin Login] Неудачная попытка входа: email={login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    logger.info(f"[Admin Login] Успешный вход: email={admin.email}, role={admin.role_enum}")
    
    access_token = create_admin_token(admin)
    refresh_token = create_admin_refresh_token(admin)
    
    return AdminTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        admin=AdminUserResponse(
            id=admin.id,
            email=admin.email,
            name=admin.name,
            role=admin.role_enum,
            company_bot_id=admin.company_bot_id,
            is_active=admin.is_active,
            created_at=admin.created_at.isoformat() if admin.created_at else "",
            last_login=admin.last_login.isoformat() if admin.last_login else None,
        )
    )


@router.post("/auth/refresh", response_model=AdminTokenResponse)
async def admin_refresh(
    refresh_data: AdminRefreshRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Обновляет access token используя refresh token"""
    try:
        payload = decode_token(refresh_data.refresh_token, TokenType.REFRESH)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    # Проверяем, что это токен администратора
    # payload - это TokenPayload объект, но дополнительные поля (user_type) находятся в _decoded_dict
    # Получаем полный словарь с дополнительными полями
    decoded_dict = getattr(payload, '_decoded_dict', payload.model_dump())
    user_type = decoded_dict.get("user_type")
    
    logger.info(f"[Admin Refresh] Token payload keys: {list(decoded_dict.keys())}, user_type: {user_type}")
    
    if user_type != "admin":
        logger.warning(f"[Admin Refresh] Invalid user_type: {user_type}, expected 'admin'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    
    try:
        admin_id = int(payload.sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token subject",
        )
    
    # Получаем администратора из БД
    stmt = select(AdminUser).where(AdminUser.id == admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    
    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin not found or inactive",
        )
    
    # Создаем новые токены
    access_token = create_admin_token(admin)
    refresh_token = create_admin_refresh_token(admin)
    
    return AdminTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        admin=AdminUserResponse(
            id=admin.id,
            email=admin.email,
            name=admin.name,
            role=admin.role_enum,
            company_bot_id=admin.company_bot_id,
            is_active=admin.is_active,
            created_at=admin.created_at.isoformat() if admin.created_at else "",
            last_login=admin.last_login.isoformat() if admin.last_login else None,
        )
    )


@router.get("/auth/me", response_model=AdminUserResponse)
async def get_current_admin_info(
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Получает информацию о текущем администраторе"""
    return AdminUserResponse(
        id=current_admin.id,
        email=current_admin.email,
        name=current_admin.name,
        role=current_admin.role_enum,
        company_bot_id=current_admin.company_bot_id,
        is_active=current_admin.is_active,
        created_at=current_admin.created_at.isoformat() if current_admin.created_at else "",
        last_login=current_admin.last_login.isoformat() if current_admin.last_login else None,
    )


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    user_data: AdminUserCreate,
    db: AsyncSession = Depends(get_db_session),
    current_admin: AdminUser = Depends(require_super_admin),  # Только суперадмин может создавать админов
):
    """Создает нового администратора (только для суперадмина)"""
    # Проверяем, что email уникален
    stmt = select(AdminUser).where(AdminUser.email == user_data.email)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin with this email already exists",
        )
    
    # Если создается COMPANY_ADMIN, проверяем наличие company_bot_id
    if user_data.role == AdminRole.COMPANY_ADMIN and not user_data.company_bot_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="company_bot_id is required for COMPANY_ADMIN role",
        )
    
    # Хешируем пароль
    password_hash = hash_password(user_data.password)
    
    # Создаем администратора
    admin = AdminUser(
        email=user_data.email,
        password_hash=password_hash,
        name=user_data.name,
        role=user_data.role.value,  # Сохраняем значение enum как строку
        company_bot_id=user_data.company_bot_id if user_data.role == AdminRole.COMPANY_ADMIN else None,
        is_active=True,
    )
    
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    
    logger.info(f"[Admin] Создан администратор: ID={admin.id}, email={admin.email}, role={admin.role.value}")
    
    return AdminUserResponse(
        id=admin.id,
        email=admin.email,
        name=admin.name,
        role=admin.role_enum,
        company_bot_id=admin.company_bot_id,
        is_active=admin.is_active,
        created_at=admin.created_at.isoformat() if admin.created_at else "",
        last_login=admin.last_login.isoformat() if admin.last_login else None,
    )


@router.get("/users", response_model=list[AdminUserResponse])
async def list_admin_users(
    db: AsyncSession = Depends(get_db_session),
    current_admin: AdminUser = Depends(require_super_admin),  # Только суперадмин может видеть всех админов
    company_bot_id: Optional[int] = None,  # Опциональный фильтр по компании
):
    """Получает список всех администраторов (только для суперадмина)"""
    stmt = select(AdminUser)
    
    # Если указан company_bot_id, фильтруем по компании
    if company_bot_id is not None:
        stmt = stmt.where(AdminUser.company_bot_id == company_bot_id)
    
    result = await db.execute(stmt)
    admins = result.scalars().all()
    
    return [
        AdminUserResponse(
            id=admin.id,
            email=admin.email,
            name=admin.name,
            role=admin.role_enum,
            company_bot_id=admin.company_bot_id,
            is_active=admin.is_active,
            created_at=admin.created_at.isoformat() if admin.created_at else "",
            last_login=admin.last_login.isoformat() if admin.last_login else None,
        )
        for admin in admins
    ]


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_admin_user(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin: AdminUser = Depends(require_super_admin),  # Только суперадмин может видеть админов
):
    """Получает информацию об администраторе по ID"""
    stmt = select(AdminUser).where(AdminUser.id == user_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Admin user with ID {user_id} not found",
        )
    
    return AdminUserResponse(
        id=admin.id,
        email=admin.email,
        name=admin.name,
        role=admin.role_enum,
        company_bot_id=admin.company_bot_id,
        is_active=admin.is_active,
        created_at=admin.created_at.isoformat() if admin.created_at else "",
        last_login=admin.last_login.isoformat() if admin.last_login else None,
    )


@router.put("/users/{user_id}", response_model=AdminUserResponse)
async def update_admin_user(
    user_id: int,
    user_data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_admin: AdminUser = Depends(require_super_admin),  # Только суперадмин может обновлять админов
):
    """Обновляет информацию об администраторе"""
    stmt = select(AdminUser).where(AdminUser.id == user_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Admin user with ID {user_id} not found",
        )
    
    # Обновляем только переданные поля
    update_data = user_data.model_dump(exclude_unset=True)
    
    # Если обновляется email, проверяем уникальность
    if "email" in update_data and update_data["email"] != admin.email:
        stmt = select(AdminUser).where(AdminUser.email == update_data["email"])
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin with this email already exists",
            )
        admin.email = update_data["email"]
    
    # Если обновляется пароль, хешируем его
    if "password" in update_data:
        admin.password_hash = hash_password(update_data["password"])
    
    # Если обновляется роль на COMPANY_ADMIN, проверяем наличие company_bot_id
    if "role" in update_data:
        new_role = update_data["role"]
        if new_role == AdminRole.COMPANY_ADMIN:
            company_bot_id = update_data.get("company_bot_id") or admin.company_bot_id
            if not company_bot_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="company_bot_id is required for COMPANY_ADMIN role",
                )
            admin.company_bot_id = company_bot_id
        else:
            admin.company_bot_id = None
        admin.role = new_role.value
    
    # Обновляем остальные поля
    if "name" in update_data:
        admin.name = update_data["name"]
    if "company_bot_id" in update_data and admin.role_enum == AdminRole.COMPANY_ADMIN:
        admin.company_bot_id = update_data["company_bot_id"]
    if "is_active" in update_data:
        admin.is_active = update_data["is_active"]
    
    await db.commit()
    await db.refresh(admin)
    
    logger.info(f"[Admin] Обновлен администратор: ID={admin.id}, email={admin.email}")
    
    return AdminUserResponse(
        id=admin.id,
        email=admin.email,
        name=admin.name,
        role=admin.role_enum,
        company_bot_id=admin.company_bot_id,
        is_active=admin.is_active,
        created_at=admin.created_at.isoformat() if admin.created_at else "",
        last_login=admin.last_login.isoformat() if admin.last_login else None,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin: AdminUser = Depends(require_super_admin),  # Только суперадмин может удалять админов
):
    """Удаляет администратора"""
    stmt = select(AdminUser).where(AdminUser.id == user_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Admin user with ID {user_id} not found",
        )
    
    # Нельзя удалить самого себя
    if admin.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    
    await db.delete(admin)
    await db.commit()
    
    logger.info(f"[Admin] Удален администратор: ID={admin.id}, email={admin.email}")
    
    return None

