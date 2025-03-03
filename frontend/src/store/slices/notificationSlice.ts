import React from 'react';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import config from '../../config';
import { AppDispatch } from '../store';
import { createAction } from '@reduxjs/toolkit';
import { socketService } from '../../services/socket';

export enum NotificationTypes {
    SUCCESS = 'success',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    SYSTEM = 'system',
    SUGGESTION_STATUS = 'suggestion_status',
}

export interface Notification {
    id?: string;
    type: NotificationTypes;
    message: string;
    duration?: number;
    autoHideDuration?: number; // Время в миллисекундах, через которое уведомление автоматически скроется
    title?: string;
    payload?: any; // Дополнительные данные для уведомления
    read?: boolean; // Прочитано ли уведомление
    timestamp?: string; // Время создания уведомления
    isToast?: boolean; // Флаг, указывающий что это всплывающее уведомление для показа вне списка
}

interface NotificationState {
    items: Notification[]; // Изменили notifications -> items для согласованности
    unreadCount: number; // Счетчик непрочитанных уведомлений
}

// Константа для ключа localStorage
const PERSISTENT_NOTIFICATIONS_KEY = 'app_persistent_notifications';

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
        // Перед сохранением логируем все ID и типы уведомлений для отладки
        const notificationSummary = notifications.map(n => ({
            id: n.id,
            type: n.type,
            payload_type: n.payload?.type,
            isToast: n.isToast,
            isPersistent: n.payload?.isPersistent
        }));
        
        console.log('📊 Перед сохранением, уведомления:', notificationSummary);
        
        // Сохраняем только важные уведомления (предложения товаров)
        // НЕ сохраняем уведомления о статусе предложений и те, у которых isPersistent: false
        let persistentNotifications = notifications.filter(
            n => (n.payload?.type === 'item_suggestion' && !n.payload?.status && n.payload?.isPersistent !== false) && !n.isToast
        );
        
        console.log(`🔍 Отфильтровано ${persistentNotifications.length} постоянных уведомлений для сохранения`);
        
        // Если нет уведомлений для сохранения, очищаем хранилище
        if (persistentNotifications.length === 0) {
            localStorage.removeItem(PERSISTENT_NOTIFICATIONS_KEY);
            console.log('🧹 Хранилище уведомлений очищено, так как нет уведомлений для сохранения');
            return;
        }
        
        // Проверяем на дубликаты перед сохранением
        const notificationMap = new Map();
        
        // Группируем уведомления по категории+товар и сохраняем только самые новые
        persistentNotifications.forEach(notification => {
            // Для уведомлений с item данными используем категорию и itemId
            if (notification.payload?.item) {
                const { category, itemId } = notification.payload.item;
                const key = `${category}:${itemId}`;
                
                // Если такое уведомление уже есть, проверяем какое из них новее
                if (notificationMap.has(key)) {
                    const existing = notificationMap.get(key);
                    if (notification.timestamp && existing.timestamp) {
                        // Сохраняем более новое уведомление
                        if (new Date(notification.timestamp) > new Date(existing.timestamp)) {
                            notificationMap.set(key, notification);
                        }
                    } else {
                        // Если у одного из них нет timestamp, сохраняем текущее
                        notificationMap.set(key, notification);
                    }
                } else {
                    // Если такого уведомления еще нет, добавляем его
                    notificationMap.set(key, notification);
                }
            } 
            // Для уведомлений статуса используем suggestionId и targetChatId
            else if (notification.payload?.type === 'suggestion_status') {
                const { suggestionId, targetChatId } = notification.payload;
                // Если есть suggestionId и targetChatId, используем их как ключ
                // иначе используем id уведомления
                const key = (suggestionId && targetChatId) 
                    ? `status:${suggestionId}:${targetChatId}`
                    : `status:${notification.id}`;
                
                // Обрабатываем так же, как и предыдущие уведомления
                if (notificationMap.has(key)) {
                    const existing = notificationMap.get(key);
                    if (notification.timestamp && existing.timestamp) {
                        if (new Date(notification.timestamp) > new Date(existing.timestamp)) {
                            notificationMap.set(key, notification);
                        }
                    } else {
                        notificationMap.set(key, notification);
                    }
                } else {
                    notificationMap.set(key, notification);
                }
            }
            // Если ни одно условие не подходит, но есть id - используем его
            else if (notification.id) {
                notificationMap.set(notification.id, notification);
            }
        });
        
        // Преобразуем Map обратно в массив, исключая дубликаты
        persistentNotifications = Array.from(notificationMap.values());
        
        console.log(`✅ После удаления дубликатов: ${persistentNotifications.length} уведомлений для сохранения`);
        
        // Сохраняем только если есть что сохранять
        if (persistentNotifications.length > 0) {
            // Проверяем, какие уведомления уже сохранены, чтобы не дублировать
            try {
                const savedData = localStorage.getItem(PERSISTENT_NOTIFICATIONS_KEY);
                if (savedData) {
                    const savedNotifications = JSON.parse(savedData);
                    
                    // Объединяем новые и существующие уведомления без дубликатов
                    const combinedSet = new Map();
                    
                    // Сначала добавляем старые
                    savedNotifications.forEach((notification: Notification) => {
                        if (notification.payload?.item) {
                            const { category, itemId } = notification.payload.item;
                            const key = `${category}:${itemId}`;
                            combinedSet.set(key, notification);
                        } 
                        // Для уведомлений о статусе предложения
                        else if (notification.payload?.type === 'suggestion_status') {
                            const { suggestionId, targetChatId } = notification.payload;
                            const key = (suggestionId && targetChatId) 
                                ? `status:${suggestionId}:${targetChatId}`
                                : `status:${notification.id}`;
                            combinedSet.set(key, notification);
                        }
                        else if (notification.id) {
                            combinedSet.set(notification.id, notification);
                        }
                    });
                    
                    // Затем добавляем новые (они перезапишут старые с тем же ключом)
                    persistentNotifications.forEach(notification => {
                        if (notification.payload?.item) {
                            const { category, itemId } = notification.payload.item;
                            const key = `${category}:${itemId}`;
                            combinedSet.set(key, notification);
                        } 
                        // Для уведомлений о статусе предложения
                        else if (notification.payload?.type === 'suggestion_status') {
                            const { suggestionId, targetChatId } = notification.payload;
                            const key = (suggestionId && targetChatId) 
                                ? `status:${suggestionId}:${targetChatId}`
                                : `status:${notification.id}`;
                            combinedSet.set(key, notification);
                        }
                        else if (notification.id) {
                            combinedSet.set(notification.id, notification);
                        }
                    });
                    
                    // Преобразуем в массив для сохранения
                    persistentNotifications = Array.from(combinedSet.values());
                }
            } catch (error) {
                console.error('Ошибка при объединении уведомлений:', error);
            }
            
            localStorage.setItem(PERSISTENT_NOTIFICATIONS_KEY, JSON.stringify(persistentNotifications));
            console.log(`💾 Сохранено ${persistentNotifications.length} уведомлений в localStorage`);
        } else {
            // Если нет уведомлений для сохранения, очищаем хранилище
            localStorage.removeItem(PERSISTENT_NOTIFICATIONS_KEY);
            console.log('🧹 Хранилище уведомлений очищено, так как нет уведомлений для сохранения');
        }
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
            let payload = { ...action.payload };
            
            // Улучшаем формат уведомлений о сообщениях, если они в старом формате
            if (
                payload.message && 
                typeof payload.message === 'string' && 
                payload.message.startsWith('Отправлено') && 
                !payload.title
            ) {
                // Получаем информацию о чате, если она есть
                let chatInfo = '';
                if (payload.payload?.chatTitle) {
                    chatInfo = payload.payload.chatTitle;
                } else if (payload.payload?.chat_name) {
                    chatInfo = payload.payload.chat_name;
                } else if (payload.payload?.chat_title) {
                    chatInfo = payload.payload.chat_title;
                }
                
                // Устанавливаем заголовок и сообщение в улучшенном формате
                payload.title = 'Сообщение отправлено';
                
                if (chatInfo) {
                    payload.message = `Сообщение успешно отправлено в чат "${chatInfo}"`;
                }
                
                // Устанавливаем время показа
                if (!payload.autoHideDuration) {
                    payload.autoHideDuration = 5000; // 5 секунд
                }
            }
            
            const notification = {
                ...payload,
                id: payload.id || Date.now().toString(),
                read: false,
                timestamp: payload.timestamp || new Date().toISOString()
            };
            state.items.push(notification);
            state.unreadCount += 1;
            
            // Сохраняем обновленный список уведомлений
            saveNotifications(state.items);
        },
        removeNotification: (state, action: PayloadAction<string>) => {
            const notificationId = action.payload;
            console.log(`🔄 Редьюсер: Удаление уведомления с ID ${notificationId}`);
            
            const notification = state.items.find(n => n.id === notificationId);
            if (notification) {
                console.log(`✅ Редьюсер: Уведомление найдено, тип: ${notification.type}, payload type: ${notification.payload?.type}`);
                
                // Если это уведомление о статусе предложения, помечаем его как обработанное
                if (notification.payload?.type === 'suggestion_status') {
                    notification.payload.isPersistent = false;
                    console.log('🏷️ Уведомление о статусе помечено как не персистентное');
                }
                
                if (!notification.read) {
                    state.unreadCount = Math.max(0, state.unreadCount - 1);
                }
            } else {
                console.warn(`⚠️ Редьюсер: Уведомление с ID ${notificationId} не найдено для удаления`);
            }
            
            const beforeCount = state.items.length;
            state.items = state.items.filter(notification => notification.id !== notificationId);
            const afterCount = state.items.length;
            
            if (beforeCount === afterCount) {
                console.warn(`⚠️ Редьюсер: Количество уведомлений не изменилось после удаления (было ${beforeCount}, стало ${afterCount})`);
            } else {
                console.log(`✅ Редьюсер: Уведомление успешно удалено (было ${beforeCount}, стало ${afterCount})`);
            }
            
            // Сохраняем обновленный список уведомлений
            saveNotifications(state.items);
        },
        clearNotifications: (state) => {
            // Находим предложения товаров, их не удаляем
            const itemSuggestions = state.items.filter(n => n.payload?.type === 'item_suggestion');
            state.items = itemSuggestions;
            state.unreadCount = itemSuggestions.filter(n => !n.read).length;
            
            // Сохраняем обновленный список уведомлений
            saveNotifications(state.items);
        },
        markAsRead: (state, action: PayloadAction<string>) => {
            const notification = state.items.find(n => n.id === action.payload);
            if (notification && !notification.read) {
                notification.read = true;
                state.unreadCount = Math.max(0, state.unreadCount - 1);
                
                // Сохраняем обновленный список уведомлений
                saveNotifications(state.items);
            }
        },
        markAllAsRead: (state) => {
            state.items.forEach(item => {
                item.read = true;
            });
            state.unreadCount = 0;
            
            // Сохраняем обновленный список уведомлений
            saveNotifications(state.items);
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(updateSuggestionStatus, (state, action) => {
                const { suggestionId, status } = action.payload;
                const notificationId = `suggestion-${suggestionId}`;
                
                // Find the notification with this ID
                const notificationIndex = state.items.findIndex(n => n.id === notificationId);
                
                if (notificationIndex !== -1) {
                    // Update the notification status
                    state.items[notificationIndex] = {
                        ...state.items[notificationIndex],
                        payload: {
                            ...state.items[notificationIndex].payload,
                            status
                        }
                    };
                }
            });
    }
});

// Экспортируем actions
export const { 
    addNotification, 
    removeNotification, 
    clearNotifications,
    markAsRead,
    markAllAsRead
} = notificationSlice.actions;

// Вспомогательная функция для генерации уникальных ID для уведомлений
const generateUniqueNotificationId = (prefix: string = 'notification'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Функция для загрузки уведомлений с сервера
export const fetchNotificationsFromServer = () => async (dispatch: AppDispatch) => {
    try {
        console.log('🔄 Загрузка уведомлений с сервера...');
        // Запрашиваем уведомления с сервера
        const response = await axios.get(`${config.API_URL}/notifications`);
        const serverNotifications = response.data || [];
        
        console.log('📥 Получены уведомления с сервера:', serverNotifications);
        
        // Загружаем также локальные уведомления
        const localNotifications = loadSavedNotifications();
        
        // Объединяем уведомления без дубликатов (предпочитаем серверные версии)
        const uniqueNotifications: Notification[] = [];
        const processedKeys = new Set<string>();
        
        // Сначала добавляем все серверные уведомления
        serverNotifications.forEach((notification: Notification) => {
            if (notification.payload?.item) {
                const { category, itemId } = notification.payload.item;
                const key = `${category}:${itemId}`;
                processedKeys.add(key);
            }
            uniqueNotifications.push(notification);
        });
        
        // Добавляем локальные уведомления, которых нет среди серверных
        localNotifications.forEach(notification => {
            if (notification.payload?.item) {
                const { category, itemId } = notification.payload.item;
                const key = `${category}:${itemId}`;
                
                // Если такого ключа еще нет, добавляем уведомление
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    uniqueNotifications.push(notification);
                }
            } else {
                // Для не-товарных уведомлений проверяем по ID
                if (!uniqueNotifications.some(n => n.id === notification.id)) {
                    uniqueNotifications.push(notification);
                }
            }
        });
        
        console.log('🔄 Объединенные уведомления:', uniqueNotifications);
        
        // Обновляем состояние Redux
        uniqueNotifications.forEach(notification => {
            dispatch(addNotification(notification));
        });
        
        return uniqueNotifications;
    } catch (error) {
        console.error('❌ Ошибка при загрузке уведомлений с сервера:', error);
        
        // В случае ошибки загружаем локальные уведомления
        const localNotifications = loadSavedNotifications();
        localNotifications.forEach(notification => {
            dispatch(addNotification(notification));
        });
        
        return localNotifications;
    }
};

// Удаляем уведомление на сервере
const deleteNotificationOnServer = async (notificationId: string, payload: any) => {
    if (!notificationId) {
        console.error('❌ Невозможно удалить уведомление: отсутствует ID');
        return false;
    }
    
    try {
        console.log(`🗑️ Отправляем запрос на удаление уведомления на сервере: ${notificationId}`);
        // Удаляем уведомление на сервере
        await axios.delete(`${config.API_URL}/notifications/${notificationId}`);
        console.log('✅ Уведомление успешно удалено на сервере', notificationId);
        return true;
    } catch (error) {
        console.error('❌ Ошибка при удалении уведомления на сервере:', error);
        // Даже если не удалось удалить на сервере, продолжаем удаление локально
        console.log('⚠️ Продолжаем удаление уведомления из локального хранилища');
        return false;
    }
};

// Функция для обработки предложения о добавлении товара
export const acceptItemSuggestion = (payload: any) => async (dispatch: AppDispatch, getState: any) => {
    try {
        console.log('🚀 Начинаем обработку предложения добавления товара:', payload);
        
        // Сначала проверим, есть ли ID уведомления
        const notificationId = payload.notificationId || payload.id;
        if (!notificationId) {
            console.error('❌ Отсутствует ID уведомления');
            return false;
        }
        
        console.log(`🔍 Используется ID уведомления: ${notificationId}`);
        
        const { category, itemId, has_semifinished } = payload.item;
        
        // Получаем ID текущего выбранного чата из Redux store
        const state = getState();
        const currentChatId = state.inventory.selectedChatId;
        
        // Если нет выбранного чата, используем какой-то чат из списка или выводим ошибку
        if (!currentChatId) {
            console.error('❌ Нет выбранного чата для добавления товара');
            dispatch(addNotification({
                id: generateUniqueNotificationId('error-no-chat'),
                type: NotificationTypes.ERROR,
                message: 'Не удалось добавить товар: не выбран чат',
                duration: 5000,
                isToast: true
            }));
            return false;
        }
        
        console.log(`📊 Параметры: категория=${category}, товар=${itemId}, текущий чат=${currentChatId}, has_semifinished=${has_semifinished}`);
        
        // Получаем текущий инвентарь ТЕКУЩЕГО чата, а не отправителя
        const response = await axios.get(`${config.API_URL}/inventory/${currentChatId}`);
        console.log('📥 Получен текущий инвентарь:', response.data);
        const currentInventory = response.data;
        
        // Проверяем, существует ли категория и товар в инвентаре
        let updatedInventory = { ...currentInventory };
        
        // Создаем категорию, если ее нет
        if (!updatedInventory.inventory[category]) {
            console.log(`➕ Создаем новую категорию: ${category}`);
            updatedInventory.inventory[category] = {};
        }
        
        // Добавляем товар, если его нет
        if (!updatedInventory.inventory[category][itemId]) {
            console.log(`➕ Добавляем новый товар: ${itemId}`);
            updatedInventory.inventory[category][itemId] = {
                raw: {
                    quantity: 0,
                    filled: false,
                    isOutOfStock: false
                }
            };
            
            // Если товар имеет полуфабрикаты, добавляем их тоже
            if (has_semifinished) {
                console.log(`➕ Товар имеет полуфабрикаты, добавляем их`);
                updatedInventory.inventory[category][itemId].semifinished = {
                    quantity: 0,
                    filled: false,
                    isOutOfStock: false
                };
            }
        } else {
            console.log(`ℹ️ Товар ${itemId} уже существует в категории ${category}`);
        }
        
        // Обновляем метаданные
        updatedInventory.metadata = {
            ...updatedInventory.metadata,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('📤 Отправляем обновленный инвентарь:', updatedInventory);
        
        // Отправляем обновленный инвентарь - исправляем URL чтобы избежать дублирования /api
        try {
            const updateResponse = await axios.post(`${config.API_URL}/inventory/${currentChatId}`, updatedInventory);
            console.log('✅ Инвентарь успешно обновлен:', updateResponse.data);
            
            // После успешного обновления на сервере, обновляем данные в Redux store
            // Это гарантирует, что UI обновится сразу же после успешного запроса
            dispatch({
                type: 'inventory/manualInventoryUpdate',
                payload: {
                    chatId: currentChatId,
                    data: {
                        inventory: updatedInventory.inventory,
                        metadata: updatedInventory.metadata
                    }
                }
            });
            
            // Удаляем уведомление на сервере
            await deleteNotificationOnServer(notificationId, payload);
            
            // Отправляем уведомление инициатору о принятии предложения
            if (payload.source && payload.source.userId && payload.source.chatId) {
                console.log('📤 Отправляем уведомление инициатору о принятии предложения:', {
                    sourceUserId: payload.source.userId,
                    sourceChatId: payload.source.chatId,
                    sourceChatTitle: payload.source.chatTitle,
                    currentChatTitle: state.inventory.selectedChat?.chat_title
                });
                
                try {
                    // Создаем данные для уведомления инициатору
                    const responseData = {
                        type: 'suggestion_response',
                        status: 'accepted',
                        item: payload.item,
                        source: {
                            userId: state.inventory.currentUser.id,
                            userName: state.inventory.currentUser.first_name,
                            chatId: currentChatId,
                            chatTitle: state.inventory.selectedChat?.chat_title || 'Неизвестный чат'
                        },
                        originalSource: payload.source,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Отправляем уведомление через websocket
                    const socketResponse = await socketService.emit('inventory_notification', {
                        targetChatId: payload.source.chatId,
                        targetUserId: payload.source.userId,
                        data: responseData
                    });
                    
                    console.log('✅ Ответ инициатору отправлен:', socketResponse);
                } catch (responseError) {
                    console.error('❌ Ошибка при отправке ответа инициатору:', responseError);
                    // Продолжаем выполнение даже при ошибке ответа
                }
            } else {
                console.warn('⚠️ Невозможно отправить уведомление инициатору: недостаточно данных', payload.source);
            }
            
            // Дополнительно загружаем свежие данные с сервера для синхронизации
            console.log('🔄 Запрашиваем обновление инвентаря с сервера для обновления UI...');
            try {
                dispatch({
                    type: 'inventory/fetchChatInventory/pending',
                    payload: null,
                    meta: { arg: { chatId: currentChatId } }
                });
                
                const refreshResponse = await axios.get(`${config.API_URL}/inventory/${currentChatId}`);
                
                dispatch({
                    type: 'inventory/fetchChatInventory/fulfilled',
                    payload: {
                        chatId: currentChatId,
                        data: refreshResponse.data
                    },
                    meta: { arg: { chatId: currentChatId } }
                });
                
                console.log('✅ Обновление инвентаря с сервера выполнено успешно');
            } catch (refreshError) {
                console.error('❌ Ошибка при обновлении данных с сервера:', refreshError);
                // Ошибка обновления не критична, продолжаем выполнение
            }
        } catch (updateError: any) {
            console.error('❌ Ошибка при обновлении инвентаря:', updateError.response?.data || updateError.message);
            throw updateError;
        }
        
        // Отмечаем уведомление как прочитанное и удаляем его из локального хранилища
        console.log(`🗑️ Удаляем уведомление с ID: ${notificationId}`);
        dispatch(removeNotification(notificationId));
        
        // Отправляем ответное уведомление в исходный чат с подтверждением
        dispatch(addNotification({
            id: generateUniqueNotificationId('item-added'),
            type: NotificationTypes.SUCCESS,
            message: `Товар "${itemId}" успешно добавлен в ваш инвентарь`,
            duration: 5000,
            isToast: true
        }));
        
        return true;
    } catch (error: any) {
        console.error('❌ Ошибка при принятии предложения товара:', error.response?.data || error.message);
        
        // Добавляем уведомление об ошибке
        dispatch(addNotification({
            id: generateUniqueNotificationId('item-error'),
            type: NotificationTypes.ERROR,
            message: `Ошибка при добавлении товара: ${error.response?.data?.message || error.message || 'Неизвестная ошибка'}`,
            duration: 5000,
            isToast: true
        }));
        
        throw error;
    }
};

export const rejectItemSuggestion = (notificationId: string) => (dispatch: AppDispatch, getState: any) => {
    try {
        console.log(`🔄 Отклонение предложения товара с ID: ${notificationId}`);
        
        if (!notificationId) {
            console.error('❌ Нельзя отклонить предложение без ID');
            return false;
        }
        
        // Получаем данные уведомления из хранилища
        const state = getState();
        const notification = state.notifications.items.find((n: Notification) => n.id === notificationId);
        
        if (!notification || !notification.payload) {
            console.error('❌ Не найдено уведомление для отклонения:', notificationId);
            return false;
        }
        
        console.log('📦 Данные уведомления для отклонения:', notification);
        
        // Отправляем уведомление инициатору об отклонении предложения
        if (notification.payload.source && notification.payload.source.userId && notification.payload.source.chatId) {
            console.log('📤 Отправляем уведомление инициатору об отклонении предложения:', {
                sourceUserId: notification.payload.source.userId,
                sourceChatId: notification.payload.source.chatId,
                sourceChatTitle: notification.payload.source.chatTitle,
                currentChatTitle: state.inventory.selectedChat?.chat_title
            });
            
            try {
                // Создаем данные для уведомления инициатору
                const responseData = {
                    type: 'suggestion_response',
                    status: 'rejected',
                    item: notification.payload.item,
                    source: {
                        userId: state.inventory.currentUser.id,
                        userName: state.inventory.currentUser.first_name,
                        chatId: state.inventory.selectedChatId,
                        chatTitle: state.inventory.selectedChat?.chat_title || 'Неизвестный чат'
                    },
                    originalSource: notification.payload.source,
                    timestamp: new Date().toISOString()
                };
                
                // Отправляем уведомление через websocket
                socketService.emit('inventory_notification', {
                    targetChatId: notification.payload.source.chatId,
                    targetUserId: notification.payload.source.userId,
                    data: responseData
                }).then((result: any) => {
                    console.log('✅ Ответ инициатору об отклонении отправлен:', result);
                }).catch((error: any) => {
                    console.error('❌ Ошибка при отправке ответа инициатору об отклонении:', error);
                });
            } catch (responseError) {
                console.error('❌ Ошибка при подготовке ответа инициатору:', responseError);
            }
        } else {
            console.warn('⚠️ Невозможно отправить уведомление инициатору: недостаточно данных', notification.payload);
        }
        
        // Только отмечаем уведомление как прочитанное, НЕ удаляем его
        dispatch(markAsRead(notificationId));
        console.log(`✅ Уведомление ${notificationId} отмечено как прочитанное`);
        
        // Отправляем уведомление с информацией, которое будет автоматически удалено через 5 секунд
        const toastId = generateUniqueNotificationId('suggestion-postponed');
        console.log(`🆔 ID toast-уведомления: ${toastId}`);
        
        dispatch(addNotification({
            id: toastId,
            type: NotificationTypes.INFO,
            message: `Предложение о добавлении товара отклонено`,
            duration: 3000,
            isToast: true
        }));
        
        console.log('✅ Создано toast-уведомление об отклоненном предложении');
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка при отклонении предложения:', error);
        return false;
    }
};

// Функция для создания тестового всплывающего уведомления
export const showToastNotification = (
    type: NotificationTypes = NotificationTypes.INFO,
    message: string = 'Тестовое уведомление'
) => (dispatch: AppDispatch) => {
    // Создаем уникальный ID для уведомления
    const notificationId = generateUniqueNotificationId('toast');
    
    // Добавляем уведомление в хранилище с флагом isToast
    dispatch(addNotification({
        id: notificationId,
        type,
        message,
        isToast: true,
        timestamp: new Date().toISOString()
    }));
    
    // Возвращаем ID уведомления для возможного использования
    return notificationId;
};

// Action for updating a suggestion status
export const updateSuggestionStatus = createAction<{
  suggestionId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'error';
}>('notifications/updateSuggestionStatus');

export default notificationSlice.reducer; 