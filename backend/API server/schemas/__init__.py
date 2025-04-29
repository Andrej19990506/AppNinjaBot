from .member import MemberBase, MemberCreate, MemberRead
from .group import GroupBase, GroupCreate, GroupRead
# Добавляем импорт схем пользователя
from .user import UserProfileResponse, UserGroupsContextResponse
# Добавляем импорт схем резерва
from .reserve import ReserveBase, ReserveCreate, ReserveRead, ReserveMember, ReserveGroup
# NEW: Импорт схем событий
from .event import (
    EventBase,
    EventCreate,
    EventUpdate,
    EventRead,
    RepeatSettingsCreate,
    RepeatSettingsRead,
    NotificationCreate,
    NotificationRead,
    SchedulingStatus
)

# Можно добавить __all__, чтобы явно указать экспортируемые имена
__all__ = [
    "MemberBase", "MemberCreate", "MemberRead",
    "GroupBase", "GroupCreate", "GroupRead",
    "UserProfileResponse", "UserGroupsContextResponse", # Добавляем новые схемы
    "ReserveBase", "ReserveCreate", "ReserveRead", "ReserveMember", "ReserveGroup", # Обновлено на ReserveMember и добавлен ReserveGroup
    # Убираем несуществующие экспорты
    # "Member",
    # "MemberUpdate",
    # "MemberStatus",
    # NEW: Экспорт схем событий
    "EventBase",
    "EventCreate",
    "EventUpdate",
    "EventRead",
    "RepeatSettingsCreate",
    "RepeatSettingsRead",
    "NotificationCreate",
    "NotificationRead",
    "SchedulingStatus",
] 