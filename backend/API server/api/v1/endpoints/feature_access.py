import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db_session
from models.feature_access_delegate import FeatureAccessDelegate
from models.feature_user_access import FeatureUserAccess
from models.role_feature_mapping import RoleFeatureMapping
from models.group_role_mapping import GroupRoleMapping
from models.company_role import CompanyRole
from models.admin_user import AdminRole
from models.group_member import GroupMember
from schemas.feature_access_delegate import (
    FeatureAccessDelegateCreate,
    FeatureAccessDelegateResponse
)
from schemas.feature_user_access import (
    FeatureUserAccessCreate,
    FeatureUserAccessResponse
)
from api.dependencies.admin_auth import get_current_admin
from api.dependencies.auth import get_current_member

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feature-access", tags=["Feature Access"])


# ========== DELEGATES (для админ-панели) ==========

@router.get("/delegates/mapping/{mapping_id}/group/{group_id}", response_model=List[FeatureAccessDelegateResponse])
async def list_delegates(
    mapping_id: int,
    group_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Получает список делегатов для конкретной привязки роли и функционала в группе.
    Доступно только для админов.
    """
    # Проверяем существование привязки
    stmt = select(RoleFeatureMapping).where(RoleFeatureMapping.id == mapping_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role feature mapping with ID {mapping_id} not found",
        )
    
    # Проверяем права доступа
    role_stmt = select(CompanyRole).where(CompanyRole.id == mapping.company_role_id)
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one_or_none()
    
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if not role or current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
    
    # Получаем делегатов
    stmt = select(FeatureAccessDelegate).where(
        and_(
            FeatureAccessDelegate.role_feature_mapping_id == mapping_id,
            FeatureAccessDelegate.group_id == group_id
        )
    )
    result = await db.execute(stmt)
    delegates = result.scalars().all()
    
    return [
        FeatureAccessDelegateResponse(
            id=delegate.id,
            role_feature_mapping_id=delegate.role_feature_mapping_id,
            group_id=delegate.group_id,
            delegate_user_id=delegate.delegate_user_id,
            created_by_user_id=delegate.created_by_user_id,
            created_at=delegate.created_at,
            updated_at=delegate.updated_at,
        )
        for delegate in delegates
    ]


@router.post("/delegates", response_model=FeatureAccessDelegateResponse, status_code=status.HTTP_201_CREATED)
async def create_delegate(
    delegate_data: FeatureAccessDelegateCreate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Назначает делегата для раздачи доступа к функционалу.
    Доступно только для админов.
    """
    # Проверяем существование привязки
    stmt = select(RoleFeatureMapping).where(RoleFeatureMapping.id == delegate_data.role_feature_mapping_id)
    result = await db.execute(stmt)
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role feature mapping with ID {delegate_data.role_feature_mapping_id} not found",
        )
    
    # Проверяем, что access_type = 'restricted'
    if mapping.access_type != 'restricted':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delegates can only be assigned for restricted access features",
        )
    
    # Проверяем права доступа
    role_stmt = select(CompanyRole).where(CompanyRole.id == mapping.company_role_id)
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one_or_none()
    
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if not role or current_admin.company_bot_id != role.company_bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
    
    # Проверяем, не существует ли уже такой делегат
    stmt = select(FeatureAccessDelegate).where(
        and_(
            FeatureAccessDelegate.role_feature_mapping_id == delegate_data.role_feature_mapping_id,
            FeatureAccessDelegate.group_id == delegate_data.group_id,
            FeatureAccessDelegate.delegate_user_id == delegate_data.delegate_user_id
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This delegate already exists",
        )
    
    # Создаем делегата
    delegate = FeatureAccessDelegate(
        role_feature_mapping_id=delegate_data.role_feature_mapping_id,
        group_id=delegate_data.group_id,
        delegate_user_id=delegate_data.delegate_user_id,
        created_by_user_id=delegate_data.created_by_user_id,
    )
    
    db.add(delegate)
    await db.commit()
    await db.refresh(delegate)
    
    logger.info(f"[FeatureAccessDelegate] Создан делегат: mapping_id={delegate.role_feature_mapping_id}, group_id={delegate.group_id}, delegate_user_id={delegate.delegate_user_id}")
    
    return FeatureAccessDelegateResponse(
        id=delegate.id,
        role_feature_mapping_id=delegate.role_feature_mapping_id,
        group_id=delegate.group_id,
        delegate_user_id=delegate.delegate_user_id,
        created_by_user_id=delegate.created_by_user_id,
        created_at=delegate.created_at,
        updated_at=delegate.updated_at,
    )


@router.delete("/delegates/{delegate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_delegate(
    delegate_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Удаляет делегата.
    Доступно только для админов.
    """
    stmt = select(FeatureAccessDelegate).where(FeatureAccessDelegate.id == delegate_id)
    result = await db.execute(stmt)
    delegate = result.scalar_one_or_none()
    
    if not delegate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delegate with ID {delegate_id} not found",
        )
    
    # Проверяем права доступа через привязку
    mapping_stmt = select(RoleFeatureMapping).where(RoleFeatureMapping.id == delegate.role_feature_mapping_id)
    mapping_result = await db.execute(mapping_stmt)
    mapping = mapping_result.scalar_one_or_none()
    
    if mapping:
        role_stmt = select(CompanyRole).where(CompanyRole.id == mapping.company_role_id)
        role_result = await db.execute(role_stmt)
        role = role_result.scalar_one_or_none()
        
        if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
            if not role or current_admin.company_bot_id != role.company_bot_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied",
                )
    
    await db.delete(delegate)
    await db.commit()
    
    logger.info(f"[FeatureAccessDelegate] Удален делегат: ID={delegate_id}")


# ========== USER ACCESSES (для приложения) ==========

@router.get("/user-accesses/group/{group_id}/feature/{feature_code}", response_model=List[FeatureUserAccessResponse])
async def list_user_accesses_for_feature(
    group_id: int,
    feature_code: str,
    current_member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Получает список пользователей, которым выдан доступ к функционалу в группе.
    Доступно делегатам и админам группы.
    """
    # TODO: Проверка прав делегата
    # Пока проверяем только, что пользователь является участником группы
    
    # Получаем привязку группы к роли
    group_mapping_stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == group_id)
    group_mapping_result = await db.execute(group_mapping_stmt)
    group_mapping = group_mapping_result.scalar_one_or_none()
    
    if not group_mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group role mapping not found",
        )
    
    # Получаем feature
    from models.bot_feature import BotFeature
    feature_stmt = select(BotFeature).where(BotFeature.feature_code == feature_code)
    feature_result = await db.execute(feature_stmt)
    feature = feature_result.scalar_one_or_none()
    
    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feature with code {feature_code} not found",
        )
    
    # Получаем привязку роли и функционала
    mapping_stmt = select(RoleFeatureMapping).where(
        and_(
            RoleFeatureMapping.company_role_id == group_mapping.company_role_id,
            RoleFeatureMapping.bot_feature_id == feature.id,
            RoleFeatureMapping.is_enabled == True
        )
    )
    mapping_result = await db.execute(mapping_stmt)
    mapping = mapping_result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role feature mapping not found",
        )
    
    # Получаем доступы
    stmt = select(FeatureUserAccess).where(
        and_(
            FeatureUserAccess.role_feature_mapping_id == mapping.id,
            FeatureUserAccess.group_id == group_id
        )
    )
    result = await db.execute(stmt)
    accesses = result.scalars().all()
    
    return [
        FeatureUserAccessResponse(
            id=access.id,
            role_feature_mapping_id=access.role_feature_mapping_id,
            group_id=access.group_id,
            user_id=access.user_id,
            granted_by_user_id=access.granted_by_user_id,
            created_at=access.created_at,
            updated_at=access.updated_at,
            expires_at=access.expires_at,
        )
        for access in accesses
    ]


@router.post("/user-accesses", response_model=FeatureUserAccessResponse, status_code=status.HTTP_201_CREATED)
async def grant_user_access(
    access_data: FeatureUserAccessCreate,
    current_member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Выдает доступ пользователю к функционалу.
    Доступно только делегатам.
    """
    # Проверяем, является ли текущий пользователь делегатом
    delegate_stmt = select(FeatureAccessDelegate).where(
        and_(
            FeatureAccessDelegate.role_feature_mapping_id == access_data.role_feature_mapping_id,
            FeatureAccessDelegate.group_id == access_data.group_id,
            FeatureAccessDelegate.delegate_user_id == current_member.user_id
        )
    )
    delegate_result = await db.execute(delegate_stmt)
    delegate = delegate_result.scalar_one_or_none()
    
    if not delegate:
        # Проверяем, является ли пользователь админом/создателем группы
        from models.group import Group
        group_member_stmt = (
            select(GroupMember)
            .join(Group, GroupMember.group_id == Group.id)
            .where(
                and_(
                    Group.group_id == access_data.group_id,
                    GroupMember.member_id == current_member.id,
                    GroupMember.role.in_(['administrator', 'creator'])
                )
            )
        )
        group_member_result = await db.execute(group_member_stmt)
        group_member = group_member_result.scalar_one_or_none()
        
        if not group_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only delegates or group admins can grant access",
            )
    
    # Проверяем, не существует ли уже такой доступ
    stmt = select(FeatureUserAccess).where(
        and_(
            FeatureUserAccess.role_feature_mapping_id == access_data.role_feature_mapping_id,
            FeatureUserAccess.group_id == access_data.group_id,
            FeatureUserAccess.user_id == access_data.user_id
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access already granted to this user",
        )
    
    # Создаем доступ
    access = FeatureUserAccess(
        role_feature_mapping_id=access_data.role_feature_mapping_id,
        group_id=access_data.group_id,
        user_id=access_data.user_id,
        granted_by_user_id=current_member.user_id,
        expires_at=access_data.expires_at,
    )
    
    db.add(access)
    await db.commit()
    await db.refresh(access)
    
    logger.info(f"[FeatureUserAccess] Выдан доступ: mapping_id={access.role_feature_mapping_id}, group_id={access.group_id}, user_id={access.user_id}, granted_by={access.granted_by_user_id}")
    
    return FeatureUserAccessResponse(
        id=access.id,
        role_feature_mapping_id=access.role_feature_mapping_id,
        group_id=access.group_id,
        user_id=access.user_id,
        granted_by_user_id=access.granted_by_user_id,
        created_at=access.created_at,
        updated_at=access.updated_at,
        expires_at=access.expires_at,
    )


@router.delete("/user-accesses/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_user_access(
    access_id: int,
    current_member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Отзывает доступ пользователя к функционалу.
    Доступно делегатам и админам группы.
    """
    stmt = select(FeatureUserAccess).where(FeatureUserAccess.id == access_id)
    result = await db.execute(stmt)
    access = result.scalar_one_or_none()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Access with ID {access_id} not found",
        )
    
    # Проверяем права: делегат или админ группы
    delegate_stmt = select(FeatureAccessDelegate).where(
        and_(
            FeatureAccessDelegate.role_feature_mapping_id == access.role_feature_mapping_id,
            FeatureAccessDelegate.group_id == access.group_id,
            FeatureAccessDelegate.delegate_user_id == current_member.user_id
        )
    )
    delegate_result = await db.execute(delegate_stmt)
    delegate = delegate_result.scalar_one_or_none()
    
    if not delegate:
        # Проверяем, является ли пользователь админом/создателем группы
        from models.group import Group
        group_member_stmt = (
            select(GroupMember)
            .join(Group, GroupMember.group_id == Group.id)
            .where(
                and_(
                    Group.group_id == access.group_id,
                    GroupMember.member_id == current_member.id,
                    GroupMember.role.in_(['administrator', 'creator'])
                )
            )
        )
        group_member_result = await db.execute(group_member_stmt)
        group_member = group_member_result.scalar_one_or_none()
        
        if not group_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only delegates or group admins can revoke access",
            )
    
    await db.delete(access)
    await db.commit()
    
    logger.info(f"[FeatureUserAccess] Отозван доступ: ID={access_id}")

