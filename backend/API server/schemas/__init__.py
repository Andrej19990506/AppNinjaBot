from .member import MemberBase, MemberCreate, MemberRead
from .group import GroupBase, GroupCreate, GroupRead
# Добавляем импорт схем пользователя
from .user import UserProfileResponse, UserGroupsContextResponse

# Можно добавить __all__, чтобы явно указать экспортируемые имена
__all__ = [
    "MemberBase", "MemberCreate", "MemberRead",
    "GroupBase", "GroupCreate", "GroupRead",
    "UserProfileResponse", "UserGroupsContextResponse", # Добавляем новые схемы
] 