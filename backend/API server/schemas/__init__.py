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
    NotificationUpdate,
    NotificationRead,
    SchedulingStatus
)
# Добавляем импорт схем для списаний
from .write_off import WriteOffBase, WriteOffCreate, WriteOffResponse
# Добавляем импорт схем для временных прав
from .user_permission import (
    UserPermissionCreate,
    UserPermissionRevoke,
    UserPermissionResponse,
    UserPermissionList,
    UserPermissionCheck,
    UserPermissionCheckResponse
)
# Добавляем импорт схем для комментариев и реакций
from .material_comment import (
    MaterialCommentBase,
    MaterialCommentCreate,
    MaterialCommentUpdate,
    MaterialCommentRead,
    MaterialCommentsResponse,
    CommentAuthor
)
from .material_reaction import (
    MaterialReactionBase,
    MaterialReactionCreate,
    MaterialReactionRead,
    MaterialReactionsResponse,
    GroupedReaction,
    ReactionAuthor
)
# Добавляем импорт схем для поставок
from .delivery import (
    DeliveryBase,
    DeliveryCreate,
    DeliveryUpdate,
    DeliveryRead,
    DeliveryItemBase,
    DeliveryItemCreate,
    DeliveryItemRead,
    DeliveryStats,
    DeliveryListResponse,
    DeliveryFilters,
    DeliveryAcceptRequest,
    DeliveryAcceptResponse,
    UserInfo
)
# Добавляем импорт схем для конфигурации поставок
from .supplies_config import (
    SuppliesConfig,
    SuppliesConfigCreate,
    SuppliesConfigUpdate
)
# Добавляем импорт схем для шаблонов смен
from .shift_template import (
    ShiftTemplateBase,
    ShiftTemplateCreate,
    ShiftTemplateUpdate,
    ShiftTemplateRead,
    ShiftTemplateListResponse,
    ShiftTemplateApplyPayload,
    ShiftTemplateDayBase,
    ShiftTemplateDayCreate,
    ShiftTemplateDayRead,
    ShiftTemplatesByDayResponse,
    BulkApplyTemplatesPayload,
    RemoveTemplatesFromDaysPayload,
    CloneTemplatePayload
)

# Можно добавить __all__, чтобы явно указать экспортируемые имена
__all__ = [
    "MemberBase", "MemberCreate", "MemberRead",
    "GroupBase", "GroupCreate", "GroupRead",
    "UserProfileResponse", "UserGroupsContextResponse", # Добавляем новые схемы
    "ReserveBase", "ReserveCreate", "ReserveRead", "ReserveMember", "ReserveGroup",
    "EventBase",
    "EventCreate",
    "EventUpdate",
    "EventRead",
    "RepeatSettingsCreate",
    "RepeatSettingsRead",
    "NotificationCreate",
    "NotificationUpdate",
    "NotificationRead",
    "SchedulingStatus",
    "WriteOffBase", "WriteOffCreate", "WriteOffResponse",
    "UserPermissionCreate", "UserPermissionRevoke", "UserPermissionResponse",
    "UserPermissionList", "UserPermissionCheck", "UserPermissionCheckResponse",
    "MaterialCommentBase", "MaterialCommentCreate", "MaterialCommentUpdate", 
    "MaterialCommentRead", "MaterialCommentsResponse", "CommentAuthor",
    "MaterialReactionBase", "MaterialReactionCreate", "MaterialReactionRead",
    "MaterialReactionsResponse", "GroupedReaction", "ReactionAuthor",
    "DeliveryBase", "DeliveryCreate", "DeliveryUpdate", "DeliveryRead",
    "DeliveryItemBase", "DeliveryItemCreate", "DeliveryItemRead",
    "DeliveryStats", "DeliveryListResponse", "DeliveryFilters",
    "DeliveryAcceptRequest", "DeliveryAcceptResponse", "UserInfo",
    "SuppliesConfig", "SuppliesConfigCreate", "SuppliesConfigUpdate",
    "ShiftTemplateBase", "ShiftTemplateCreate", "ShiftTemplateUpdate", "ShiftTemplateRead",
    "ShiftTemplateListResponse", "ShiftTemplateApplyPayload", "ShiftTemplateDayBase",
    "ShiftTemplateDayCreate", "ShiftTemplateDayRead", "ShiftTemplatesByDayResponse",
    "BulkApplyTemplatesPayload", "RemoveTemplatesFromDaysPayload", "CloneTemplatePayload",
] 