import { NotificationTypes, Notification } from './notificationTypes';
import { AppDispatch } from '../../store/store';
import { addNotification, removeNotification } from './notificationSlice';

const generateUniqueNotificationId = (prefix: string = 'notification'): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const showToastNotification = (
    type: NotificationTypes = NotificationTypes.INFO,
    message: string = 'Уведомление'
) => (dispatch: AppDispatch) => {
    const notificationId = generateUniqueNotificationId('toast');
    const notification: Notification = {
        id: notificationId,
        type,
        message,
        isToast: true,
        timestamp: new Date().toISOString()
    };
    dispatch(addNotification(notification));
    setTimeout(() => {
        dispatch(removeNotification(notification.id!));
    }, 5000);
};
