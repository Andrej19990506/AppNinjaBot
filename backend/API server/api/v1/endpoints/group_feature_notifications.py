import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db_session
from models.group_feature_notification import GroupFeatureNotification
from models.group import Group
from models.bot_feature import BotFeature
from models.group_role_mapping import GroupRoleMapping
from models.company_role import CompanyRole
from models.admin_user import AdminRole
from schemas.group_feature_notification import (
    GroupFeatureNotificationCreate,
    GroupFeatureNotificationUpdate,
    GroupFeatureNotificationResponse
)
from api.dependencies.admin_auth import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/group-feature-notifications", tags=["Group Feature Notifications"])


@router.get("/working-group/{working_group_id}", response_model=List[GroupFeatureNotificationResponse])
async def list_working_group_notifications(
    working_group_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """
    Получает список настроек уведомлений для рабочей группы.
    """
    # Проверяем существование группы
    stmt = select(Group).where(Group.group_id == working_group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID {working_group_id} not found",
        )
    
    # Проверяем права доступа через привязку группы к роли
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == working_group_id)
    result = await db.execute(stmt)
    group_mapping = result.scalar_one_or_none()
    
    if group_mapping:
        stmt = select(CompanyRole).where(CompanyRole.id == group_mapping.company_role_id)
        result = await db.execute(stmt)
        role = result.scalar_one_or_none()
        
        if role and current_admin.role_enum == AdminRole.COMPANY_ADMIN:
            if current_admin.company_bot_id != role.company_bot_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this group",
                )
    
    # Получаем настройки уведомлений
    stmt = select(GroupFeatureNotification).where(
        GroupFeatureNotification.working_group_id == working_group_id
    )
    result = await db.execute(stmt)
    notifications = result.scalars().all()
    
    return [
        GroupFeatureNotificationResponse(
            id=notif.id,
            bot_feature_id=notif.bot_feature_id,
            working_group_id=notif.working_group_id,
            notification_group_id=notif.notification_group_id,
            notification_type=notif.notification_type or "excel",
        )
        for notif in notifications
    ]


@router.post("", response_model=GroupFeatureNotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_group_feature_notification(
    notification_data: GroupFeatureNotificationCreate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Создает настройку уведомлений для функции"""
    # Проверяем существование функции
    stmt = select(BotFeature).where(BotFeature.id == notification_data.bot_feature_id)
    result = await db.execute(stmt)
    feature = result.scalar_one_or_none()
    
    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bot feature with ID {notification_data.bot_feature_id} not found",
        )
    
    # Проверяем существование рабочей группы
    stmt = select(Group).where(Group.group_id == notification_data.working_group_id)
    result = await db.execute(stmt)
    working_group = result.scalar_one_or_none()
    
    if not working_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Working group with ID {notification_data.working_group_id} not found",
        )
    
    # Проверяем существование группы для уведомлений
    stmt = select(Group).where(Group.group_id == notification_data.notification_group_id)
    result = await db.execute(stmt)
    notification_group = result.scalar_one_or_none()
    
    if not notification_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification group with ID {notification_data.notification_group_id} not found",
        )
    
    # Проверяем права доступа через рабочую группу
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == notification_data.working_group_id)
    result = await db.execute(stmt)
    group_mapping = result.scalar_one_or_none()
    
    if group_mapping:
        stmt = select(CompanyRole).where(CompanyRole.id == group_mapping.company_role_id)
        result = await db.execute(stmt)
        role = result.scalar_one_or_none()
        
        if role and current_admin.role_enum == AdminRole.COMPANY_ADMIN:
            if current_admin.company_bot_id != role.company_bot_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this group",
                )
    
    # Проверяем, не существует ли уже такая настройка
    stmt = select(GroupFeatureNotification).where(
        GroupFeatureNotification.bot_feature_id == notification_data.bot_feature_id,
        GroupFeatureNotification.working_group_id == notification_data.working_group_id,
        GroupFeatureNotification.notification_group_id == notification_data.notification_group_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This notification setting already exists",
        )
    
    # Создаем настройку уведомлений
    notification = GroupFeatureNotification(
        bot_feature_id=notification_data.bot_feature_id,
        working_group_id=notification_data.working_group_id,
        notification_group_id=notification_data.notification_group_id,
        notification_type=notification_data.notification_type,
    )
    
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    
    logger.info(f"[GroupFeatureNotification] Создана настройка: feature_id={notification.bot_feature_id}, working_group_id={notification.working_group_id}")
    
    return GroupFeatureNotificationResponse(
        id=notification.id,
        bot_feature_id=notification.bot_feature_id,
        working_group_id=notification.working_group_id,
        notification_group_id=notification.notification_group_id,
        notification_type=notification.notification_type or "excel",
    )


@router.put("/{notification_id}", response_model=GroupFeatureNotificationResponse)
async def update_group_feature_notification(
    notification_id: int,
    notification_data: GroupFeatureNotificationUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Обновляет настройку уведомлений"""
    stmt = select(GroupFeatureNotification).where(GroupFeatureNotification.id == notification_id)
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group feature notification with ID {notification_id} not found",
        )
    
    # Проверяем права доступа через рабочую группу
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == notification.working_group_id)
    result = await db.execute(stmt)
    group_mapping = result.scalar_one_or_none()
    
    if group_mapping:
        stmt = select(CompanyRole).where(CompanyRole.id == group_mapping.company_role_id)
        result = await db.execute(stmt)
        role = result.scalar_one_or_none()
        
        if role and current_admin.role_enum == AdminRole.COMPANY_ADMIN:
            if current_admin.company_bot_id != role.company_bot_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this notification",
                )
    
    # Если обновляется notification_group_id, проверяем существование группы
    if notification_data.notification_group_id is not None:
        stmt = select(Group).where(Group.group_id == notification_data.notification_group_id)
        result = await db.execute(stmt)
        notification_group = result.scalar_one_or_none()
        
        if not notification_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Notification group with ID {notification_data.notification_group_id} not found",
            )
    
    # Обновляем только переданные поля
    update_data = notification_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(notification, field, value)
    
    await db.commit()
    await db.refresh(notification)
    
    logger.info(f"[GroupFeatureNotification] Обновлена настройка: ID={notification.id}")
    
    return GroupFeatureNotificationResponse(
        id=notification.id,
        bot_feature_id=notification.bot_feature_id,
        working_group_id=notification.working_group_id,
        notification_group_id=notification.notification_group_id,
        notification_type=notification.notification_type or "excel",
    )


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_feature_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
):
    """Удаляет настройку уведомлений"""
    stmt = select(GroupFeatureNotification).where(GroupFeatureNotification.id == notification_id)
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group feature notification with ID {notification_id} not found",
        )
    
    # Проверяем права доступа через рабочую группу
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == notification.working_group_id)
    result = await db.execute(stmt)
    group_mapping = result.scalar_one_or_none()
    
    if group_mapping:
        stmt = select(CompanyRole).where(CompanyRole.id == group_mapping.company_role_id)
        result = await db.execute(stmt)
        role = result.scalar_one_or_none()
        
        if role and current_admin.role_enum == AdminRole.COMPANY_ADMIN:
            if current_admin.company_bot_id != role.company_bot_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this notification",
                )
    
    await db.delete(notification)
    await db.commit()
    
    logger.info(f"[GroupFeatureNotification] Удалена настройка: ID={notification_id}")

