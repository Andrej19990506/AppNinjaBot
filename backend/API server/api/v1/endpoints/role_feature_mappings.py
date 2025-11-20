import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db_session
from models.role_feature_mapping import RoleFeatureMapping
from models.company_role import CompanyRole
from models.admin_user import AdminRole
from schemas.role_feature_mapping import (
    RoleFeatureMappingCreate,
    RoleFeatureMappingUpdate,
    RoleFeatureMappingResponse
)
from api.dependencies.admin_auth import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/role-feature-mappings", tags=["Role Feature Mappings"])


@router.get("/role/{role_id}", response_model=List[RoleFeatureMappingResponse])
async def list_role_features(
    role_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Получает список функций для указанной роли.
    """
    # Проверяем существование роли
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
    
    # Получаем привязки функций к роли
    stmt = select(RoleFeatureMapping).where(RoleFeatureMapping.company_role_id == role_id)
    result = await db.execute(stmt)
    mappings = result.scalars().all()
    
    return [
        RoleFeatureMappingResponse(
            id=mapping.id,
            company_role_id=mapping.company_role_id,
            bot_feature_id=mapping.bot_feature_id,
            is_enabled=mapping.is_enabled,
            access_type=mapping.access_type,
        )
        for mapping in mappings
    ]


@router.post("", response_model=RoleFeatureMappingResponse, status_code=status.HTTP_201_CREATED)
async def create_role_feature_mapping(
    mapping_data: RoleFeatureMappingCreate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Привязывает функцию к роли"""
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
    
    # Проверяем, не существует ли уже такая привязка
    stmt = select(RoleFeatureMapping).where(
        RoleFeatureMapping.company_role_id == mapping_data.company_role_id,
        RoleFeatureMapping.bot_feature_id == mapping_data.bot_feature_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This feature is already mapped to this role",
        )
    
    # Создаем привязку
    mapping = RoleFeatureMapping(
        company_role_id=mapping_data.company_role_id,
        bot_feature_id=mapping_data.bot_feature_id,
        is_enabled=mapping_data.is_enabled,
        access_type=mapping_data.access_type.value if hasattr(mapping_data.access_type, 'value') else mapping_data.access_type,
    )
    
    db.add(mapping)
    await db.commit()
    await db.refresh(mapping)
    
    logger.info(f"[RoleFeatureMapping] Создана привязка: role_id={mapping.company_role_id}, feature_id={mapping.bot_feature_id}, access_type={mapping.access_type}")
    
    return RoleFeatureMappingResponse(
        id=mapping.id,
        company_role_id=mapping.company_role_id,
        bot_feature_id=mapping.bot_feature_id,
        is_enabled=mapping.is_enabled,
        access_type=mapping.access_type,
    )


@router.put("/{mapping_id}", response_model=RoleFeatureMappingResponse)
async def update_role_feature_mapping(
    mapping_id: int,
    mapping_data: RoleFeatureMappingUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Обновляет привязку функции к роли"""
    stmt = select(RoleFeatureMapping).where(RoleFeatureMapping.id == mapping_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role feature mapping with ID {mapping_id} not found",
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
    
    # Обновляем только переданные поля
    update_data = mapping_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Если это access_type и это enum, преобразуем в строку
        if field == 'access_type' and hasattr(value, 'value'):
            setattr(mapping, field, value.value)
        else:
            setattr(mapping, field, value)
    
    await db.commit()
    await db.refresh(mapping)
    
    logger.info(f"[RoleFeatureMapping] Обновлена привязка: ID={mapping.id}, access_type={mapping.access_type}")
    
    return RoleFeatureMappingResponse(
        id=mapping.id,
        company_role_id=mapping.company_role_id,
        bot_feature_id=mapping.bot_feature_id,
        is_enabled=mapping.is_enabled,
        access_type=mapping.access_type,
    )


@router.delete("/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_feature_mapping(
    mapping_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Удаляет привязку функции к роли"""
    stmt = select(RoleFeatureMapping).where(RoleFeatureMapping.id == mapping_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role feature mapping with ID {mapping_id} not found",
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
    
    logger.info(f"[RoleFeatureMapping] Удалена привязка: ID={mapping_id}")

