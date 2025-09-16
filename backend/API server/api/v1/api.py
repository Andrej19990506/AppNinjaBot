# backend/API server/api/v1/api.py
from fastapi import APIRouter


from .endpoints.users import router as users_router

from .endpoints.groups import router as groups_router 

from .endpoints.shifts import router as shifts_router

from .endpoints.reserve import router as reserve_router 

from .endpoints import inventory

from .endpoints.events import router as events_router

from .endpoints.write_offs import router as write_offs_router

from .endpoints.user_permissions import router as user_permissions_router

from .endpoints.materials import router as materials_router

from .endpoints.competitions import router as competitions_router

from .endpoints.chats import router as chats_router
from .endpoints.supplies import router as supplies_router

api_router = APIRouter()

api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])


api_router.include_router(users_router, prefix="/users", tags=["Users"])

api_router.include_router(groups_router, prefix="/groups", tags=["Groups"]) 

api_router.include_router(shifts_router, prefix="/shifts", tags=["Shifts"])

api_router.include_router(reserve_router, prefix="/reserves", tags=["Reserves"])

api_router.include_router(events_router, prefix="/events", tags=["Events"])

api_router.include_router(write_offs_router, prefix="/write-offs", tags=["Write-offs"])

api_router.include_router(user_permissions_router, prefix="/user-permissions", tags=["User Permissions"])

api_router.include_router(materials_router, tags=["Materials"])

api_router.include_router(competitions_router, prefix="/competitions", tags=["Competitions"])

api_router.include_router(chats_router, prefix="/chats", tags=["Chats"])
api_router.include_router(supplies_router, tags=["Supplies"])
