import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppDispatch } from '../store';

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
}

interface NotificationState {
    items: Notification[];
    unreadCount: number;
}

// Константа для ключа localStorage
const PERSISTENT_NOTIFICATIONS_KEY = 'app_persistent_notifications';

// Вспомогательная функция для генерации уникальных ID для уведомлений
const generateUniqueNotificationId = (prefix: string = 'notification'): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Функция для загрузки сохраненных уведомлений из localStorage
const loadSavedNotifications = (): Notification[] => {
    try {
        const savedData = localStorage.getItem(PERSISTENT_NOTIFICATIONS_KEY);
        if (savedData) {
            return JSON.parse(savedData);
        }
    } catch (error) {
        console.error('Ошибка при загрузке сохраненных уведомлений:', error);
    }
    return [];
};

// Функция для сохранения уведомлений в localStorage
const saveNotifications = (notifications: Notification[]) => {
    try {
        // Сохраняем только системные уведомления
        let persistentNotifications = notifications.filter(
            n => n.type === NotificationTypes.SYSTEM && !n.isToast
        );
        
        if (persistentNotifications.length === 0) {
            localStorage.removeItem(PERSISTENT_NOTIFICATIONS_KEY);
            return;
        }
        
        localStorage.setItem(PERSISTENT_NOTIFICATIONS_KEY, JSON.stringify(persistentNotifications));
    } catch (error) {
        console.error('❌ Ошибка при сохранении уведомлений:', error);
    }
};

// Загружаем сохраненные уведомления при инициализации
const savedNotifications = loadSavedNotifications();

const initialState: NotificationState = {
    items: savedNotifications,
    unreadCount: savedNotifications.filter(n => !n.read).length
};

const notificationSlice = createSlice({
    name: 'notification',
    initialState,
    reducers: {
        addNotification: (state, action: PayloadAction<Notification>) => {
            const notification = { ...action.payload };
            
            // Добавляем timestamp если его нет
            if (!notification.timestamp) {
                notification.timestamp = new Date().toISOString();
            }
            
            // Генерируем ID если его нет
            if (!notification.id) {
                notification.id = generateUniqueNotificationId();
            }
            
            state.items.push(notification);
            if (!notification.read) {
                state.unreadCount++;
            }
            
            // Сохраняем уведомления
            saveNotifications(state.items);
        },
        removeNotification: (state, action: PayloadAction<string>) => {
            const index = state.items.findIndex(n => n.id === action.payload);
            if (index !== -1) {
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
            state.items = [];
            state.unreadCount = 0;
            localStorage.removeItem(PERSISTENT_NOTIFICATIONS_KEY);
        }
    }
});

export const { addNotification, removeNotification, markAsRead, clearNotifications } = notificationSlice.actions;

export const showToastNotification = (
    type: NotificationTypes = NotificationTypes.INFO,
    message: string = 'Уведомление'
) => (dispatch: AppDispatch) => {
    const notification: Notification = {
        id: generateUniqueNotificationId('toast'),
        type,
        message,
        isToast: true,
        timestamp: new Date().toISOString()
    };
    
    dispatch(addNotification(notification));
    
    // Автоматически удаляем toast через 5 секунд
    setTimeout(() => {
        dispatch(removeNotification(notification.id!));
    }, 5000);
};

// Экспортируем редьюсер
const notificationReducer = notificationSlice.reducer;
export default notificationReducer; 