import { NotificationState, Notification } from './notificationTypes';

export const selectAllNotifications = (state: { notification: NotificationState }): Notification[] => {
    return state.notification.items.filter(item => !item._isRemoved);
};

export const selectUnreadNotificationCount = (state: { notification: NotificationState }): number => state.notification.unreadCount;
