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

const MAX_VISIBLE_TOASTS = 2; // Максимальное количество видимых ТОСТОВ

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
            
            // --- НАЧАЛО: Логика ограничения количества видимых ТОСТОВ ---
            if (notification.isToast) { // Применяем логику только для ТОСТОВЫХ уведомлений
                // Фильтруем текущие видимые (тостовые) уведомления
                const visibleToasts = state.items.filter(item => item.isToast === true);
                
                // Если лимит достигнут или превышен
                if (visibleToasts.length >= MAX_VISIBLE_TOASTS) {
                    // Находим ID самого старого видимого тоста
                    const oldestVisibleToastId = visibleToasts[0]?.id;
                    
                    // Если ID найден, ищем его индекс в общем массиве и удаляем
                    if (oldestVisibleToastId) {
                        const indexToRemove = state.items.findIndex(item => item.id === oldestVisibleToastId);
                        if (indexToRemove !== -1) {
                            // Для тостов счетчик непрочитанных не трогаем
                            // Удаляем элемент из общего массива
                            state.items.splice(indexToRemove, 1);
                            console.log(`[NotificationSlice] Removed oldest toast ${oldestVisibleToastId} due to limit.`);
                        }
                    }
                }
            }
            // --- КОНЕЦ: Логика ограничения ТОСТОВ ---
            
            // Добавляем новое уведомление в конец массива
            state.items.push(notification);
            
            // Обновляем счетчик непрочитанных, если новое - непрочитанное (только для НЕ тостов)
            if (!notification.read && !notification.isToast) { 
                state.unreadCount++;
            }
            
            // Сохраняем системные уведомления (логика saveNotifications остается)
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

// Добавляем селектор для получения всех уведомлений
export const selectAllNotifications = (state: { notification: NotificationState }): Notification[] => state.notification.items;

// Селектор для получения количества непрочитанных уведомлений
export const selectUnreadNotificationCount = (state: { notification: NotificationState }): number => state.notification.unreadCount;

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