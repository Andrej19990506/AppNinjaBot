from fastapi import APIRouter, Depends, HTTPException, status, Path
from typing import List

# Импортируем Pydantic модели
from schemas.user import UserGroupsContextResponse, GroupBase, UserDataBase

# TODO: Импортировать зависимости (БД, сервисы), когда они будут готовы
# from ..dependencies import get_db_session
# from ..services.user_service import UserService

# Создаем роутер для пользователей
router = APIRouter(
    prefix="/users",
    tags=["Users"],
    responses={404: {"description": "User not found"}},
)

@router.get("/{user_id}/context", response_model=UserGroupsContextResponse)
async def get_user_context(
    user_id: int = Path(..., description="The Telegram ID of the user", example=123456789)
    # db: AsyncSession = Depends(get_db_session) # Пример зависимости БД
):
    """
    Получает контекст пользователя: его основные данные и список групп, в которых он состоит.
    Используется фронтендом для инициализации.
    """
    print(f"Received request for user context: {user_id}") # Логирование для отладки

    # --- ЗАГЛУШКА ---
    # В реальной реализации здесь будет логика получения данных из БД по user_id (telegram_id)
    # и сбор информации о группах и статусе
    
    # Используем тестовые данные, похожие на DEV_MODE_USER_DATA из userSlice.ts
    if user_id == 1682142222: # ID тестового пользователя
        user_data = UserDataBase(
            first_name="Андрей (FastAPI)",
            last_name="Николаевич",
            photo_url="https://via.placeholder.com/150",
            is_senior_courier=True
        )
        groups = [
            GroupBase(id=1, chat_id="-1004755640016", chat_title="Повара Словцова", group_type="chef"),
            GroupBase(id=2, chat_id="-1004611898635", chat_title="Курьеры Высотная", group_type="courier"),
            GroupBase(id=3, chat_id="-1004721237800", chat_title="Курьеры Баумана", group_type="courier")
        ]
        return UserGroupsContextResponse(groups=groups)
    else:
        # Для других ID возвращаем условного "неизвестного" пользователя без групп
         user_data = UserDataBase(
            first_name="Неизвестный",
            last_name="Пользователь",
            is_senior_courier=False
        )
         return UserGroupsContextResponse(groups=[])

    # --- КОНЕЦ ЗАГЛУШКИ ---

    # Пример реальной логики (раскомментировать и адаптировать при подключении БД):
    # user_info = await UserService.get_user_context_data(db, telegram_id=user_id)
    # if not user_info:
    #     raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User context not found")
    #
    # # Формируем ответ на основе данных из сервиса
    # user_data_resp = UserDataBase(**user_info['user_data'])
    # groups_resp = [GroupBase(**group) for group in user_info['groups']]
    # return UserGroupsContextResponse(groups=groups_resp) 