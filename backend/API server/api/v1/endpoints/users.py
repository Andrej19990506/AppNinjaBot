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
    # Добавляем поле для обновления статуса старшего курьера
    is_senior_courier: Optional[bool] = None 

router = APIRouter()

@router.get(
    "/{user_id}/context",
    response_model=List[GroupRead], # Ожидаем список групп на выходе
    summary="Get User's Groups Context",
    description="Retrieves a list of groups that the specified user (member) belongs to.",
    tags=["Users", "Groups"] # Теги для документации Swagger
)
async def get_user_groups_context(
    user_id: int, # Получаем user_id (Telegram ID) из пути
    db: AsyncSession = Depends(get_db_session) # Получаем сессию БД
):
    """
    Fetches the groups associated with a given user_id (Telegram ID).
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

    # 2. Получить связанные группы, используя жадную загрузку (selectinload)
    #    для эффективности (избегаем N+1 запросов)
    member_with_groups_query = (
        select(Member)
        .options(selectinload(Member.groups_association).selectinload(GroupMember.group))
        .where(Member.id == member.id) # Ищем по первичному ключу Member
    )
    member_with_groups_result = await db.execute(member_with_groups_query)
    member_with_groups = member_with_groups_result.scalars().first()

    # 3. Извлечь объекты Group из ассоциаций
    groups = []
    if member_with_groups and member_with_groups.groups_association:
        groups = [assoc.group for assoc in member_with_groups.groups_association if assoc.group]

    # 4. Вернуть список групп (Pydantic автоматически сконвертирует)
    return groups 

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
    description="Updates the profile information (including senior status) for the specified user.",
    tags=["Users"]
)
async def update_user_profile(
    user_id: int, 
    profile_data: UserProfileUpdate, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Updates the profile data (first_name, last_name, is_senior_courier) for a given user_id.
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

    # Обновляем поля динамически
    for key, value in update_data.items():
        # Проверяем, существует ли такое поле в модели Member
        if hasattr(member, key):
            setattr(member, key, value)
        else:
            # Можно логировать или игнорировать неизвестные поля
            print(f"Предупреждение: Попытка обновить несуществующее поле '{key}' для Member")

    try:
        await db.commit()
        await db.refresh(member)
    except Exception as e:
        await db.rollback()
        # TODO: Добавить логирование ошибки
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при сохранении профиля: {e}"
        )

    return member

