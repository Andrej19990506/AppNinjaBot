from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import json
import logging

from db.session import get_db_session
from models.user_permission import UserPermission
from models.member import Member
from models.group import Group
from models.group_member import GroupMember
from schemas.user_permission import (
    UserPermissionCreate, 
    UserPermissionRevoke,
    UserPermissionResponse,
    UserPermissionList,
    UserPermissionCheck,
    UserPermissionCheckResponse
)
from utils.scheduler_client import schedule_permissions_cleanup

router = APIRouter()
logger = logging.getLogger(__name__)

async def send_permissions_notification(db: AsyncSession, user_id: int, group_id: int, notification_type: str, message: str):
    """Отправляет WebSocket уведомление о изменении прав пользователя"""
    try:
        notify_payload = {
            "type": "user_permissions_changed",
            "user_id": user_id,
            "group_id": group_id,
            "notification_type": notification_type,  # "revoked_by_admin" или "expired_automatically"
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        notification_json = json.dumps(notify_payload)
        await db.execute(text("SELECT pg_notify('websocket_channel', :payload)"), {"payload": notification_json})
        
        logger.info(f"WebSocket уведомление отправлено для пользователя {user_id} в группе {group_id}: {notification_type}")
        
    except Exception as e:
        logger.error(f"Ошибка при отправке WebSocket уведомления: {e}")

@router.post("/grant", response_model=UserPermissionResponse)
async def grant_permission(
    permission_data: UserPermissionCreate,
    requester_telegram_id: int = Query(..., description="Telegram ID of the user granting the permission"),
    db: AsyncSession = Depends(get_db_session)
):
    """Выдать временное разрешение пользователю. Требует прав администратора или создателя группы."""
    
    # Проверяем, что пользователь существует
    user_query = select(Member).where(Member.user_id == permission_data.user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Проверяем, что группа существует
    group_query = select(Group).where(Group.group_id == permission_data.group_id)
    group_result = await db.execute(group_query)
    group = group_result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Группа не найдена"
        )
    
    # Проверяем права requester_telegram_id (должен быть администратором или создателем)
    requester_member_result = await db.execute(
        select(Member).where(Member.user_id == requester_telegram_id)
    )
    requester_member: Member | None = requester_member_result.scalar_one_or_none()
    
    if requester_member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь, выдающий права, не найден"
        )
    
    # Находим запись GroupMember для проверки прав в конкретной группе
    requester_gm_result = await db.execute(
        select(GroupMember).where(
            (GroupMember.member_id == requester_member.id) &
            (GroupMember.group_id == group.id)
        )
    )
    requester_gm: GroupMember | None = requester_gm_result.scalar_one_or_none()
    
    # Проверяем, является ли пользователь администратором или создателем группы
    is_authorized = (
        requester_gm and 
        requester_gm.role in ['administrator', 'creator']
    )
    
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Действие требует прав администратора или создателя группы"
        )
    
    # Проверяем, нет ли уже активного разрешения этого типа
    existing_permission_query = select(UserPermission).where(
        and_(
            UserPermission.user_id == permission_data.user_id,
            UserPermission.group_id == permission_data.group_id,
            UserPermission.permission_type == permission_data.permission_type,
            UserPermission.expires_at > datetime.now(timezone.utc)
        )
    )
    existing_permission_result = await db.execute(existing_permission_query)
    existing_permission = existing_permission_result.scalar_one_or_none()
    
    if existing_permission:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Пользователь уже имеет активное разрешение типа {permission_data.permission_type}"
        )
    
    # Создаем новое разрешение
    new_permission = UserPermission(
        user_id=permission_data.user_id,
        group_id=permission_data.group_id,
        permission_type=permission_data.permission_type,
        granted_by=requester_telegram_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=permission_data.duration_hours),
        is_active=True
    )
    
    db.add(new_permission)
    await db.commit()
    await db.refresh(new_permission)
    
    # Планируем задачу очистки истекших прав в шедулере
    try:
        await schedule_permissions_cleanup(
            user_id=new_permission.user_id,
            group_id=new_permission.group_id,
            permission_type=new_permission.permission_type,
            expires_at=new_permission.expires_at
        )
    except Exception as scheduler_error:
        # Логируем ошибку планирования, но не прерываем выдачу прав
        logger.error(f"Ошибка при планировании задачи очистки прав: {scheduler_error}")
    
    return UserPermissionResponse(
        id=new_permission.id,
        user_id=new_permission.user_id,
        group_id=new_permission.group_id,
        permission_type=new_permission.permission_type,
        granted_by=new_permission.granted_by,
        granted_at=new_permission.granted_at,
        expires_at=new_permission.expires_at,
        is_active=new_permission.is_active,
        revoked_at=new_permission.revoked_at,
        revoked_by=new_permission.revoked_by
    )

@router.post("/revoke")
async def revoke_permission(
    permission_data: UserPermissionRevoke,
    requester_telegram_id: int = Query(..., description="Telegram ID of the user revoking the permission"),
    db: AsyncSession = Depends(get_db_session)
):
    """Отозвать временное разрешение. Требует прав администратора или создателя группы."""
    
    # Проверяем, что группа существует
    group_query = select(Group).where(Group.group_id == permission_data.group_id)
    group_result = await db.execute(group_query)
    group = group_result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Группа не найдена"
        )
    
    # Проверяем права requester_telegram_id (должен быть администратором или создателем)
    requester_member_result = await db.execute(
        select(Member).where(Member.user_id == requester_telegram_id)
    )
    requester_member: Member | None = requester_member_result.scalar_one_or_none()
    
    if requester_member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь, отзывающий права, не найден"
        )
    
    # Находим запись GroupMember для проверки прав в конкретной группе
    requester_gm_result = await db.execute(
        select(GroupMember).where(
            (GroupMember.member_id == requester_member.id) &
            (GroupMember.group_id == group.id)
        )
    )
    requester_gm: GroupMember | None = requester_gm_result.scalar_one_or_none()
    
    # Проверяем, является ли пользователь администратором или создателем группы
    is_authorized = (
        requester_gm and 
        requester_gm.role in ['administrator', 'creator']
    )
    
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Действие требует прав администратора или создателя группы"
        )
    
    # Находим разрешение для отзыва
    query = select(UserPermission).where(
        and_(
            UserPermission.user_id == permission_data.user_id,
            UserPermission.group_id == permission_data.group_id,
            UserPermission.permission_type == permission_data.permission_type
        )
    )
    result = await db.execute(query)
    permission = result.scalar_one_or_none()
    
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Активное разрешение не найдено"
        )
    
    # Отправляем WebSocket уведомление перед удалением
    await send_permissions_notification(
        db=db,
        user_id=permission.user_id,
        group_id=permission.group_id,
        notification_type="revoked_by_admin",
        message="Ваши права были отозваны Администратором. Обратитесь к Администратору своей группы"
    )
    
    # Полностью удаляем разрешение из БД
    await db.delete(permission)
    await db.commit()
    
    return {"success": True, "message": "Разрешение отозвано"}

@router.get("/check", response_model=UserPermissionCheckResponse)
async def check_permission(
    user_id: int,
    group_id: int,
    permission_type: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Проверить, есть ли у пользователя разрешение"""
    
    # Сначала проверяем, является ли пользователь администратором или создателем группы
    user_query = select(Member).where(Member.user_id == user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    if user:
        # Проверяем роль пользователя в группе
        group_query = select(Group).where(Group.group_id == group_id)
        group_result = await db.execute(group_query)
        group = group_result.scalar_one_or_none()
        
        if group:
            user_gm_result = await db.execute(
                select(GroupMember).where(
                    (GroupMember.member_id == user.id) &
                    (GroupMember.group_id == group.id)
                )
            )
            user_gm: GroupMember | None = user_gm_result.scalar_one_or_none()
            
            # Если пользователь - администратор или создатель, он имеет все права
            if user_gm and user_gm.role in ['administrator', 'creator']:
                return UserPermissionCheckResponse(
                    has_permission=True,
                    is_admin=True,
                    permission_source='administrator'
                )
    
    # Проверяем временные разрешения
    now = datetime.now(timezone.utc)
    query = select(UserPermission).where(
        and_(
            UserPermission.user_id == user_id,
            UserPermission.group_id == group_id,
            UserPermission.permission_type == permission_type,
            UserPermission.expires_at > now
        )
    )
    result = await db.execute(query)
    permission = result.scalar_one_or_none()
    
    if permission:
        remaining_time = permission.expires_at - now
        remaining_hours = int(remaining_time.total_seconds() / 3600)
        
        return UserPermissionCheckResponse(
            has_permission=True,
            is_admin=False,
            permission_source='temporary',
            expires_at=permission.expires_at,
            remaining_hours=remaining_hours
        )
    
    return UserPermissionCheckResponse(
        has_permission=False,
        is_admin=False,
        permission_source='none'
    )

@router.get("/list/{group_id}", response_model=UserPermissionList)
async def list_permissions(
    group_id: int,
    requester_telegram_id: int = Query(..., description="Telegram ID of the user requesting the list"),
    active_only: bool = False,
    db: AsyncSession = Depends(get_db_session)
):
    """Получить список всех разрешений для группы. Требует прав администратора или создателя группы."""
    
    # Проверяем, что группа существует
    group_query = select(Group).where(Group.group_id == group_id)
    group_result = await db.execute(group_query)
    group = group_result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Группа не найдена"
        )
    
    # Проверяем права requester_telegram_id (должен быть администратором или создателем)
    requester_member_result = await db.execute(
        select(Member).where(Member.user_id == requester_telegram_id)
    )
    requester_member: Member | None = requester_member_result.scalar_one_or_none()
    
    if requester_member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь не найден"
        )
    
    # Находим запись GroupMember для проверки прав в конкретной группе
    requester_gm_result = await db.execute(
        select(GroupMember).where(
            (GroupMember.member_id == requester_member.id) &
            (GroupMember.group_id == group.id)
        )
    )
    requester_gm: GroupMember | None = requester_gm_result.scalar_one_or_none()
    
    # Проверяем, является ли пользователь администратором или создателем группы
    is_authorized = (
        requester_gm and 
        requester_gm.role in ['administrator', 'creator']
    )
    
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Действие требует прав администратора или создателя группы"
        )
    
    query = select(UserPermission).where(UserPermission.group_id == group_id)
    
    if active_only:
        now = datetime.now(timezone.utc)
        query = query.where(UserPermission.expires_at > now)
    
    result = await db.execute(query)
    permissions = result.scalars().all()
    
    # Подсчитываем статистику
    total = len(permissions)
    now = datetime.now(timezone.utc)
    active_count = sum(1 for p in permissions if p.expires_at > now)
    expired_count = sum(1 for p in permissions if p.expires_at <= now)
    
    permission_responses = []
    for permission in permissions:
        permission_responses.append(
            UserPermissionResponse(
                id=permission.id,
                user_id=permission.user_id,
                group_id=permission.group_id,
                permission_type=permission.permission_type,
                granted_by=permission.granted_by,
                granted_at=permission.granted_at,
                expires_at=permission.expires_at,
                is_active=permission.is_active,
                revoked_at=permission.revoked_at,
                revoked_by=permission.revoked_by
            )
        )
    
    return UserPermissionList(
        permissions=permission_responses,
        total=total,
        active_count=active_count,
        expired_count=expired_count
    )

@router.delete("/cleanup")
async def cleanup_expired_permissions(
    db: AsyncSession = Depends(get_db_session)
):
    """Очистить истекшие разрешения (деактивировать)"""
    
    now = datetime.now(timezone.utc)
    
    # Добавляем подробное логирование для отладки
    logger.info(f"[cleanup] Текущее время UTC: {now}")
    
    # Сначала получаем ВСЕ права для логирования
    all_query = select(UserPermission)
    all_result = await db.execute(all_query)
    all_permissions = all_result.scalars().all()
    
    logger.info(f"[cleanup] Всего прав в БД: {len(all_permissions)}")
    for perm in all_permissions:
        logger.info(f"[cleanup] Право: user_id={perm.user_id}, group_id={perm.group_id}, type={perm.permission_type}, expires_at={perm.expires_at}")
    
    # Теперь ищем истекшие
    query = select(UserPermission).where(UserPermission.expires_at <= now)
    result = await db.execute(query)
    expired_permissions = result.scalars().all()
    
    logger.info(f"[cleanup] Найдено истекших прав: {len(expired_permissions)}")
    
    count = 0
    for permission in expired_permissions:
        logger.info(f"[cleanup] Удаляю право: user_id={permission.user_id}, group_id={permission.group_id}, type={permission.permission_type}, expires_at={permission.expires_at}")
        
        # Отправляем WebSocket уведомление об истечении прав
        await send_permissions_notification(
            db=db,
            user_id=permission.user_id,
            group_id=permission.group_id,
            notification_type="expired_automatically",
            message="Ваш доступ истек. Обратитесь к Администратору вашей группы"
        )
        
        await db.delete(permission)
        count += 1
    
    await db.commit()
    
    logger.info(f"[cleanup] Удалено {count} истекших разрешений")
    return {"message": f"Удалено {count} истекших разрешений"} 