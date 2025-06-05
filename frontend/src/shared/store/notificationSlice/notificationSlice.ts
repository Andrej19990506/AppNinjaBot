import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Notification, NotificationTypes, NotificationState } from './notificationTypes';

const PERSISTENT_NOTIFICATIONS_KEY = 'app_persistent_notifications';

const generateUniqueNotificationId = (prefix: string = 'notification'): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const loadSavedNotifications = (): Notification[] => {
    try {
        const savedData = localStorage.getItem(PERSISTENT_NOTIFICATIONS_KEY);
        if (savedData) {
            return JSON.parse(savedData);
        }
    } catch (error) {}
    return [];
};

const saveNotifications = (notifications: Notification[]) => {
    try {
        let persistentNotifications = notifications.filter(
            n => n.type === NotificationTypes.SYSTEM && !n.isToast && !n._isRemoved
        );
        if (persistentNotifications.length === 0) {
            localStorage.removeItem(PERSISTENT_NOTIFICATIONS_KEY);
            return;
        }
        localStorage.setItem(PERSISTENT_NOTIFICATIONS_KEY, JSON.stringify(persistentNotifications));
    } catch (error) {}
};

const savedNotifications = loadSavedNotifications();

const initialState: NotificationState = {
    items: savedNotifications,
    unreadCount: savedNotifications.filter(n => !n.read).length,
    removedIds: []
};

const MAX_VISIBLE_TOASTS = 2;

const notificationSlice = createSlice({
    name: 'notification',
    initialState,
    reducers: {
        addNotification: (state, action: PayloadAction<Notification>) => {
            const notification = { ...action.payload };
            if (!notification.timestamp) {
                notification.timestamp = new Date().toISOString();
            }
            if (!notification.id) {
                notification.id = generateUniqueNotificationId();
            }
            if (notification.id && state.removedIds.includes(notification.id)) {
                return;
            }
            if (notification.isToast) {
                const visibleToasts = state.items.filter(item => item.isToast === true);
                if (visibleToasts.length >= MAX_VISIBLE_TOASTS) {
                    const oldestVisibleToastId = visibleToasts[0]?.id;
                    if (oldestVisibleToastId) {
                        const indexToRemove = state.items.findIndex(item => item.id === oldestVisibleToastId);
                        if (indexToRemove !== -1) {
                            if (oldestVisibleToastId) {
                                state.removedIds.push(oldestVisibleToastId);
                            }
                            state.items.splice(indexToRemove, 1);
                        }
                    }
                }
            }
            state.items.push(notification);
            if (!notification.read && !notification.isToast) { 
                state.unreadCount++;
            }
            saveNotifications(state.items);
        },
        removeNotification: (state, action: PayloadAction<string>) => {
            const idToRemove = action.payload;
            if (!state.removedIds.includes(idToRemove)) {
                state.removedIds.push(idToRemove);
                if (state.removedIds.length > 100) {
                    state.removedIds.shift();
                }
            }
            const index = state.items.findIndex(n => n.id === idToRemove);
            if (index !== -1) {
                state.items[index]._isRemoved = true;
                if (!state.items[index].read) {
                    state.unreadCount--;
                }
                state.items.splice(index, 1);
                saveNotifications(state.items);
            }
        },
        markAsRead: (state, action: PayloadAction<string>) => {
            const notification = state.items.find(n => n.id === action.payload);
            if (notification && !notification.read) {
                notification.read = true;
                state.unreadCount--;
                saveNotifications(state.items);
            }
        },
        clearNotifications: (state) => {
            state.items.forEach(item => {
                if (item.id && !state.removedIds.includes(item.id)) {
                    state.removedIds.push(item.id);
                }
            });
            if (state.removedIds.length > 100) {
                state.removedIds = state.removedIds.slice(-100);
            }
            state.items = [];
            state.unreadCount = 0;
            localStorage.removeItem(PERSISTENT_NOTIFICATIONS_KEY);
        }
    }
});

export const { addNotification, removeNotification, markAsRead, clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
