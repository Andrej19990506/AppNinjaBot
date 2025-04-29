from .base import Base
from .member import Member
from .group import Group
from .group_member import GroupMember
# from models.user import User # Удаляем импорт User
# Удаляем импорт несуществующих ShiftMember, ShiftTemplate, ShiftTemplateMember
# from .shift import Shift, ShiftMember, ShiftTemplate, ShiftTemplateMember
# Оставляем только импорт Shift
from .shift import Shift
# Убираем импорт несуществующего ReserveMember
# from .reserve import Reserve, ReserveMember
# Оставляем только импорт Reserve
from .reserve import Reserve

# NEW: Импорт модели Event
from .event import Event

# Можно добавить __all__ для контроля импорта звездочкой, если нужно
__all__ = [
    "Base",
    "Member",
    "Group",
    "GroupMember",
    # "User", # Удаляем User из __all__
    "Shift",
    # Удаляем несуществующие классы из __all__
    # "ShiftMember",
    # "ShiftTemplate",
    # "ShiftTemplateMember",
    "Reserve",
    # Убираем несуществующий ReserveMember из __all__
    # "ReserveMember",
    # NEW: Экспорт модели Event
    "Event",
] 