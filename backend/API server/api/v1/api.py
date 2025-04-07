# backend/API server/api/v1/api.py
from fastapi import APIRouter

# Импортируем роутеры из эндпоинтов
from .endpoints.users import router as users_router
# Импортируем НОВЫЙ роутер для групп
from .endpoints.groups import router as groups_router 
# from .endpoints.group_settings import router as group_settings_router # УДАЛЕНО
from .endpoints.shifts import router as shifts_router

# Сюда же можно импортировать другие роутеры из endpoints, если они там есть/будут
# from .endpoints import couriers # Например

api_router = APIRouter()

# Подключаем роутеры с префиксами и тегами
api_router.include_router(users_router, prefix="/users", tags=["Users"])
# Подключаем НОВЫЙ роутер (раскомментируем и используем правильный префикс)
api_router.include_router(groups_router, prefix="/groups", tags=["Groups"]) 
# api_router.include_router(group_settings_router, prefix="/groups", tags=["Group Settings"]) # УДАЛЕНО
api_router.include_router(shifts_router, prefix="/shifts", tags=["Shifts"])

# Подключаем другие роутеры, если они есть
# api_router.include_router(couriers.router, prefix="/couriers", tags=["Couriers"]) 