# backend/API server/api/v1/api.py
from fastapi import APIRouter


from .endpoints.users import router as users_router
from .endpoints.auth import router as auth_router

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
from .endpoints.shift_templates import router as shift_templates_router
from .endpoints.contact import router as contact_router
from .endpoints.company_bots import router as company_bots_router
from .endpoints.company_roles import router as company_roles_router
from .endpoints.bot_features import router as bot_features_router
from .endpoints.role_feature_mappings import router as role_feature_mappings_router
from .endpoints.group_role_mappings import router as group_role_mappings_router
from .endpoints.group_feature_notifications import router as group_feature_notifications_router
from .endpoints.feature_access import router as feature_access_router
from .endpoints.admin import router as admin_router

api_router = APIRouter()

api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])

api_router.include_router(auth_router, tags=["Auth"])

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
api_router.include_router(shift_templates_router, prefix="/shift-templates", tags=["Shift Templates"])
api_router.include_router(contact_router, prefix="/contact", tags=["Contact"])
api_router.include_router(company_bots_router, tags=["Company Bots"])
api_router.include_router(company_roles_router, tags=["Company Roles"])
api_router.include_router(bot_features_router, tags=["Bot Features"])
api_router.include_router(role_feature_mappings_router, tags=["Role Feature Mappings"])
api_router.include_router(group_role_mappings_router, tags=["Group Role Mappings"])
api_router.include_router(group_feature_notifications_router, tags=["Group Feature Notifications"])
api_router.include_router(feature_access_router, tags=["Feature Access"])
api_router.include_router(admin_router, tags=["Admin"])
