from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

# Проверь и скорректируй эти пути, если необходимо:
from db.session import get_db_session
from models import Member, Group, GroupMember
# Импортируем Pydantic и схемы
from pydantic import BaseModel
from schemas import GroupRead, UserProfileResponse, UserGroupsContextResponse

# --- НОВАЯ СХЕМА ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ --- 
class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

router = APIRouter()

@router.get(
    "/{user_id}/context",
    response_model=List[GroupRead], # Ожидаем список групп на выходе
    summary="Get User's Groups Context",
    description="Retrieves a list of groups that the specified user (member) belongs to, including the user's role in each group.",
    tags=["Users", "Groups"] # Теги для документации Swagger
)
async def get_user_groups_context(
    user_id: int, # Получаем user_id (Telegram ID) из пути
    db: AsyncSession = Depends(get_db_session) # Получаем сессию БД
):
    """
    Fetches the groups associated with a given user_id (Telegram ID), 
    including the user's role and senior status in each group.
    """
    # 1. Найти пользователя (Member) по user_id
    member_query = select(Member).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member = member_result.scalars().first()

    if not member:
        # Возвращаем более информативную ошибку 404
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Э, братан! Пользователя с ID {user_id} в базе данных не найдено!",
        )

    # 2. Получить связанные GroupMember и Group, используя жадную загрузку
    member_with_associations_query = (
        select(Member)
        .options(selectinload(Member.groups_association)
                 .selectinload(GroupMember.group))
        .where(Member.id == member.id)
    )
    member_with_associations_result = await db.execute(member_with_associations_query)
    member_with_associations = member_with_associations_result.scalars().first()

    # 3. Подготовить список для ответа
    groups_context = []
    if member_with_associations and member_with_associations.groups_association:
        for assoc in member_with_associations.groups_association:
            if assoc.group:
                group_data = assoc.group.__dict__
                group_data['role'] = assoc.role
                group_data['is_senior_courier'] = assoc.is_senior_courier
                groups_context.append(group_data)

    # 4. Вернуть список
    return groups_context

@router.get(
    "/{user_id}/profile",
    response_model=UserProfileResponse, # Используем новую схему ответа
    summary="Get User Profile",
    description="Retrieves the full profile information for the specified user (member).",
    tags=["Users"]
)
async def get_user_profile(
    user_id: int, # Получаем user_id (Telegram ID) из пути
    db: AsyncSession = Depends(get_db_session)
):
    """
    Fetches the profile data for a given user_id (Telegram ID).
    """
    # --- НАЧАЛО РЕАЛЬНОЙ ЛОГИКИ (замените или дополните) ---
    # 1. Найти пользователя (Member) по user_id (Telegram ID)
    member_query = select(Member).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member = member_result.scalars().first()

    # 2. Если пользователь не найден, вернуть 404
    if not member:
        # Возвращаем более информативную ошибку 404
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Слышь! Профиль для пользователя с ID {user_id} в базе не обнаружен!",
        )

    # 3. Вернуть найденного пользователя.
    #    Pydantic автоматически преобразует объект Member в UserProfileResponse,
    #    если поля совпадают (или настроен orm_mode=True в схеме).
    #    Убедитесь, что ваша модель Member содержит поля: id, user_id, first_name,
    #    last_name, username, photo_url, is_senior_courier
    return member
    # --- КОНЕЦ РЕАЛЬНОЙ ЛОГИКИ --- 

# --- ОБНОВЛЕННЫЙ ЭНДПОИНТ ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ --- 
@router.put(
    "/{user_id}/profile",
    response_model=UserProfileResponse, 
    summary="Update User Profile",
    description="Updates the profile information (first_name, last_name) for the specified user.",
    tags=["Users"]
)
async def update_user_profile(
    user_id: int, 
    profile_data: UserProfileUpdate, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Updates the profile data (first_name, last_name) for a given user_id.
    Senior status is updated via a different endpoint.
    """
    member_query = select(Member).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member = member_result.scalars().first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден для обновления профиля.",
        )

    update_data = profile_data.model_dump(exclude_unset=True) 
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет данных для обновления."
        )

    # Обновляем поля first_name и last_name
    updated = False
    if 'first_name' in update_data:
        member.first_name = update_data['first_name']
        updated = True
    if 'last_name' in update_data:
        member.last_name = update_data['last_name']
        updated = True

    if not updated:
         # Если пришли какие-то другие поля, но не имя/фамилия
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="Можно обновлять только first_name и last_name через этот эндпоинт."
         )

    try:
        await db.commit()
        await db.refresh(member)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при сохранении профиля: {e}"
        )

    return member

