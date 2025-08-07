// --- notificationTypes.ts ---

export enum NotificationTypes {
    SUCCESS = 'success',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    SYSTEM = 'system',
    SUGGESTION_STATUS = 'suggestion_status'
}

export interface Notification {
    id?: string;
    type: NotificationTypes;
    message: string;
    duration?: number;
    autoHideDuration?: number;
    title?: string;
    read?: boolean;
    timestamp?: string;
    isToast?: boolean;
    payload?: any;
    _isRemoved?: boolean;
    photoUrl?: string; // URL фотографии пользователя для уведомлений активности
}

export interface NotificationState {
    items: Notification[];
    unreadCount: number;
    removedIds: string[];
}
