import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db_session
from models.company_role import CompanyRole
from models.company_bot import CompanyBot
from models.admin_user import AdminRole
from schemas.company_role import CompanyRoleCreate, CompanyRoleUpdate, CompanyRoleResponse
from api.dependencies.admin_auth import get_current_admin, require_super_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/company-roles", tags=["Company Roles"])


@router.get("/company/{company_bot_id}", response_model=List[CompanyRoleResponse])
async def list_company_roles(
    company_bot_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Получает список ролей для указанной компании.
    Суперадмин видит все компании, админ компании - только свою.
    """
    # Проверяем существование компании
    stmt = select(CompanyBot).where(CompanyBot.id == company_bot_id)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company bot with ID {company_bot_id} not found",
        )
    
    # Проверяем права доступа: админ компании может видеть только свою компанию
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this company",
            )
    
    # Получаем роли компании
    stmt = select(CompanyRole).where(CompanyRole.company_bot_id == company_bot_id)
    stmt = stmt.order_by(CompanyRole.display_order, CompanyRole.role_name)
    result = await db.execute(stmt)
    roles = result.scalars().all()
    
    return [
        CompanyRoleResponse(
            id=role.id,
            company_bot_id=role.company_bot_id,
            role_name=role.role_name,
            role_code=role.role_code,
            description=role.description,
            icon=role.icon,
            color=role.color,
            display_order=role.display_order,
            is_active=role.is_active,
            permissions=role.permissions,
            created_at=role.created_at.isoformat() if role.created_at else "",
            updated_at=role.updated_at.isoformat() if role.updated_at else "",
        )
        for role in roles
    ]


@router.get("/{role_id}", response_model=CompanyRoleResponse)
async def get_company_role(
    role_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Получает информацию о конкретной роли"""
    stmt = select(CompanyRole).where(CompanyRole.id == role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company role with ID {role_id} not found",
        )
    
    # Проверяем права доступа
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this role",
            )
    
    return CompanyRoleResponse(
        id=role.id,
        company_bot_id=role.company_bot_id,
        role_name=role.role_name,
        role_code=role.role_code,
        description=role.description,
        icon=role.icon,
        color=role.color,
        display_order=role.display_order,
        is_active=role.is_active,
        permissions=role.permissions,
        created_at=role.created_at.isoformat() if role.created_at else "",
        updated_at=role.updated_at.isoformat() if role.updated_at else "",
    )


@router.post("", response_model=CompanyRoleResponse, status_code=status.HTTP_201_CREATED)
async def create_company_role(
    role_data: CompanyRoleCreate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Создает новую роль для компании"""
    # Проверяем существование компании
    stmt = select(CompanyBot).where(CompanyBot.id == role_data.company_bot_id)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company bot with ID {role_data.company_bot_id} not found",
        )
    
    # Проверяем права доступа
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != role_data.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this company",
            )
    
    # Проверяем уникальность role_code для компании
    stmt = select(CompanyRole).where(
        CompanyRole.company_bot_id == role_data.company_bot_id,
        CompanyRole.role_code == role_data.role_code
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with code '{role_data.role_code}' already exists for this company",
        )
    
    # Создаем роль
    role = CompanyRole(
        company_bot_id=role_data.company_bot_id,
        role_name=role_data.role_name,
        role_code=role_data.role_code,
        description=role_data.description,
        icon=role_data.icon,
        color=role_data.color,
        display_order=role_data.display_order,
        is_active=role_data.is_active,
        permissions=role_data.permissions,
    )
    
    db.add(role)
    await db.commit()
    await db.refresh(role)
    
    logger.info(f"[CompanyRole] Создана роль: ID={role.id}, company_bot_id={role.company_bot_id}, role_code={role.role_code}")
    
    return CompanyRoleResponse(
        id=role.id,
        company_bot_id=role.company_bot_id,
        role_name=role.role_name,
        role_code=role.role_code,
        description=role.description,
        icon=role.icon,
        color=role.color,
        display_order=role.display_order,
        is_active=role.is_active,
        permissions=role.permissions,
        created_at=role.created_at.isoformat() if role.created_at else "",
        updated_at=role.updated_at.isoformat() if role.updated_at else "",
    )


@router.put("/{role_id}", response_model=CompanyRoleResponse)
async def update_company_role(
    role_id: int,
    role_data: CompanyRoleUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Обновляет информацию о роли"""
    stmt = select(CompanyRole).where(CompanyRole.id == role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company role with ID {role_id} not found",
        )
    
    # Проверяем права доступа
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this role",
            )
    
    # Если обновляется role_code, проверяем уникальность
    if role_data.role_code and role_data.role_code != role.role_code:
        stmt = select(CompanyRole).where(
            CompanyRole.company_bot_id == role.company_bot_id,
            CompanyRole.role_code == role_data.role_code,
            CompanyRole.id != role_id
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with code '{role_data.role_code}' already exists for this company",
            )
    
    # Обновляем только переданные поля
    update_data = role_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)
    
    await db.commit()
    await db.refresh(role)
    
    logger.info(f"[CompanyRole] Обновлена роль: ID={role.id}, role_code={role.role_code}")
    
    return CompanyRoleResponse(
        id=role.id,
        company_bot_id=role.company_bot_id,
        role_name=role.role_name,
        role_code=role.role_code,
        description=role.description,
        icon=role.icon,
        color=role.color,
        display_order=role.display_order,
        is_active=role.is_active,
        permissions=role.permissions,
        created_at=role.created_at.isoformat() if role.created_at else "",
        updated_at=role.updated_at.isoformat() if role.updated_at else "",
    )


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company_role(
    role_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Удаляет роль компании"""
    from models.group_role_mapping import GroupRoleMapping
    from models.role_feature_mapping import RoleFeatureMapping
    
    stmt = select(CompanyRole).where(CompanyRole.id == role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company role with ID {role_id} not found",
        )
    
    # Проверяем права доступа
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this role",
            )
    
    # Проверяем, используется ли роль (опционально - для информативности)
    # Каскадное удаление настроено, так что это не блокирует удаление
    group_mappings_stmt = select(GroupRoleMapping).where(GroupRoleMapping.company_role_id == role_id)
    group_mappings_result = await db.execute(group_mappings_stmt)
    group_mappings = group_mappings_result.scalars().all()
    
    feature_mappings_stmt = select(RoleFeatureMapping).where(RoleFeatureMapping.company_role_id == role_id)
    feature_mappings_result = await db.execute(feature_mappings_stmt)
    feature_mappings = feature_mappings_result.scalars().all()
    
    if group_mappings or feature_mappings:
        logger.info(
            f"[CompanyRole] Удаление роли ID={role_id}: "
            f"найдено {len(group_mappings)} привязок групп, "
            f"{len(feature_mappings)} привязок функций. "
            f"Будут удалены каскадно."
        )
    
    # Удаляем роль (каскадно удалятся все связанные записи)
    await db.delete(role)
    await db.commit()
    
    logger.info(f"[CompanyRole] Удалена роль: ID={role_id}, role_code={role.role_code}")

