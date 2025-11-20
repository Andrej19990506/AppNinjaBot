import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db_session
from models.group_role_mapping import GroupRoleMapping
from models.group import Group
from models.company_role import CompanyRole
from models.company_bot import CompanyBot
from models.admin_user import AdminRole
from models.role_feature_mapping import RoleFeatureMapping
from models.bot_feature import BotFeature
from schemas.bot_feature import BotFeatureResponse
from schemas.group_role_mapping import (
    GroupRoleMappingCreate,
    GroupRoleMappingUpdate,
    GroupRoleMappingResponse
)
from api.dependencies.admin_auth import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/group-role-mappings", tags=["Group Role Mappings"])


@router.get("/company/{company_bot_id}", response_model=List[GroupRoleMappingResponse])
async def list_company_group_mappings(
    company_bot_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Получает список привязок групп к ролям для указанной компании.
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
    
    # Проверяем права доступа
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this company",
            )
    
    # Получаем все роли компании
    stmt = select(CompanyRole.id).where(CompanyRole.company_bot_id == company_bot_id)
    result = await db.execute(stmt)
    role_ids = [row[0] for row in result.fetchall()]
    
    if not role_ids:
        return []
    
    # Получаем привязки групп к ролям компании
    stmt = select(GroupRoleMapping).where(
        GroupRoleMapping.company_role_id.in_(role_ids)
    )
    result = await db.execute(stmt)
    mappings = result.scalars().all()
    
    return [
        GroupRoleMappingResponse(
            id=mapping.id,
            group_id=mapping.group_id,
            company_role_id=mapping.company_role_id,
            is_working_group=mapping.is_working_group,
        )
        for mapping in mappings
    ]


@router.get("/group/{group_id}", response_model=Optional[GroupRoleMappingResponse])
async def get_group_role_mapping(
    group_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Получает привязку роли для указанной группы"""
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == group_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        return None
    
    # Проверяем права доступа через роль
    stmt = select(CompanyRole).where(CompanyRole.id == mapping.company_role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this mapping",
            )
    
    return GroupRoleMappingResponse(
        id=mapping.id,
        group_id=mapping.group_id,
        company_role_id=mapping.company_role_id,
        is_working_group=mapping.is_working_group,
    )


@router.get("/group/{group_id}/features", response_model=List[BotFeatureResponse])
async def get_group_features(
    group_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Получает список доступных функций для указанной группы (только для админов).
    Функции определяются через: Group → GroupRoleMapping → CompanyRole → RoleFeatureMapping → BotFeature
    """
    # Проверяем существование группы
    stmt = select(Group).where(Group.group_id == group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID {group_id} not found",
        )
    
    # Получаем привязку группы к роли
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == group_id)
    result = await db.execute(stmt)
    group_mapping = result.scalar_one_or_none()
    
    if not group_mapping:
        # Группа не привязана к роли - возвращаем пустой список
        return []
    
    # Проверяем права доступа через роль
    stmt = select(CompanyRole).where(CompanyRole.id == group_mapping.company_role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this group",
            )
    
    # Получаем функции роли (только включенные)
    stmt = (
        select(BotFeature)
        .join(RoleFeatureMapping, RoleFeatureMapping.bot_feature_id == BotFeature.id)
        .where(
            RoleFeatureMapping.company_role_id == role.id,
            RoleFeatureMapping.is_enabled == True,
            BotFeature.is_active == True
        )
    )
    result = await db.execute(stmt)
    features = result.scalars().all()
    
    return [
        BotFeatureResponse(
            id=feature.id,
            feature_code=feature.feature_code,
            feature_name=feature.feature_name,
            description=feature.description,
            icon=feature.icon,
            is_active=feature.is_active,
            created_at=feature.created_at.isoformat() if feature.created_at else "",
            updated_at=feature.updated_at.isoformat() if feature.updated_at else "",
        )
        for feature in features
    ]


@router.post("", response_model=GroupRoleMappingResponse, status_code=status.HTTP_201_CREATED)
async def create_group_role_mapping(
    mapping_data: GroupRoleMappingCreate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Привязывает группу к роли компании"""
    # Проверяем существование группы
    stmt = select(Group).where(Group.group_id == mapping_data.group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID {mapping_data.group_id} not found",
        )
    
    # Проверяем существование роли
    stmt = select(CompanyRole).where(CompanyRole.id == mapping_data.company_role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company role with ID {mapping_data.company_role_id} not found",
        )
    
    # Проверяем права доступа
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this role",
            )
    
    # Проверяем, не существует ли уже привязка для этой группы
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == mapping_data.group_id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This group already has a role mapping. Update existing mapping instead.",
        )
    
    # Создаем привязку
    mapping = GroupRoleMapping(
        group_id=mapping_data.group_id,
        company_role_id=mapping_data.company_role_id,
        is_working_group=mapping_data.is_working_group,
    )
    
    db.add(mapping)
    await db.commit()
    await db.refresh(mapping)
    
    logger.info(f"[GroupRoleMapping] Создана привязка: group_id={mapping.group_id}, role_id={mapping.company_role_id}")
    
    return GroupRoleMappingResponse(
        id=mapping.id,
        group_id=mapping.group_id,
        company_role_id=mapping.company_role_id,
        is_working_group=mapping.is_working_group,
    )


@router.put("/{mapping_id}", response_model=GroupRoleMappingResponse)
async def update_group_role_mapping(
    mapping_id: int,
    mapping_data: GroupRoleMappingUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Обновляет привязку группы к роли"""
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.id == mapping_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group role mapping with ID {mapping_id} not found",
        )
    
    # Проверяем права доступа через роль
    stmt = select(CompanyRole).where(CompanyRole.id == mapping.company_role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this mapping",
            )
    
    # Если обновляется company_role_id, проверяем новую роль
    if mapping_data.company_role_id is not None:
        stmt = select(CompanyRole).where(CompanyRole.id == mapping_data.company_role_id)
        result = await db.execute(stmt)
        new_role = result.scalar_one_or_none()
        
        if not new_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company role with ID {mapping_data.company_role_id} not found",
            )
        
        if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
            if current_admin.company_bot_id != new_role.company_bot_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this role",
                )
    
    # Обновляем только переданные поля
    update_data = mapping_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(mapping, field, value)
    
    await db.commit()
    await db.refresh(mapping)
    
    logger.info(f"[GroupRoleMapping] Обновлена привязка: ID={mapping.id}")
    
    return GroupRoleMappingResponse(
        id=mapping.id,
        group_id=mapping.group_id,
        company_role_id=mapping.company_role_id,
        is_working_group=mapping.is_working_group,
    )


@router.delete("/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_role_mapping(
    mapping_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Удаляет привязку группы к роли"""
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.id == mapping_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group role mapping with ID {mapping_id} not found",
        )
    
    # Проверяем права доступа через роль
    stmt = select(CompanyRole).where(CompanyRole.id == mapping.company_role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if not role or current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this mapping",
            )
    
    await db.delete(mapping)
    await db.commit()
    
    logger.info(f"[GroupRoleMapping] Удалена привязка: ID={mapping_id}")


@router.get("", response_model=List[GroupRoleMappingResponse])
async def list_all_group_mappings(
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Получает список всех привязок групп к ролям.
    Доступно только для суперадмина.
    Должен быть в конце файла, чтобы не конфликтовать с другими маршрутами.
    """
    if current_admin.role_enum != AdminRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can view all group mappings",
        )
    
    stmt = select(GroupRoleMapping)
    result = await db.execute(stmt)
    mappings = result.scalars().all()
    
    return [
        GroupRoleMappingResponse(
            id=mapping.id,
            group_id=mapping.group_id,
            company_role_id=mapping.company_role_id,
            is_working_group=mapping.is_working_group,
        )
        for mapping in mappings
    ]

