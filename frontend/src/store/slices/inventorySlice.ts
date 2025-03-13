import { createSlice, createAsyncThunk, PayloadAction, ActionCreatorWithPayload } from '@reduxjs/toolkit';
import axios from 'axios';
import { 
    InventoryState, 
    ChatInventory, 
    Admin,
    InventoryItem,
    Inventory,
    HistoryRecord
} from '../../types/inventory';
import { WebApp } from '../../types/telegram';
import config from '../../config';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { createAction } from '@reduxjs/toolkit';
import { store } from '../../store';

// Константа для ID глобальной комнаты
const GLOBAL_ROOM_ID = 'global';

// Action Types
export const InventoryActionTypes = {
    FETCH_INVENTORY: 'inventory/fetchInventory',
    UPDATE_INVENTORY: 'inventory/updateItem',
    SELECT_CHAT: 'inventory/selectChat',
    CLEAR_SELECTED_CHAT: 'inventory/clearSelectedChat',
    SET_CURRENT_USER: 'inventory/setCurrentUser',
    CHECK_ADMIN_RIGHTS: 'inventory/checkAdminRights',
    SET_SELECTED_ITEM: 'inventory/setSelectedItem',
    REMOVE_INVENTORY_ITEM: 'inventory/removeItem',
    ADD_INVENTORY_ITEM: 'inventory/addItem',
    FETCH_ITEM_HISTORY: 'inventory/fetchItemHistory',
    FETCH_ITEM_HISTORY_SUCCESS: 'inventory/fetchItemHistorySuccess',
    FETCH_ITEM_HISTORY_ERROR: 'inventory/fetchItemHistoryError'
} as const;

const initialState: InventoryState = {
    items: [],
    isLoading: false,
    error: null,
    selectedChatId: null,
    selectedChat: null,
    selectedItem: null,
    currentUser: {
        id: null,
        isAdmin: false,
        adminRights: null,
        photo_url: null,
        first_name: null
    },
    history: {
        records: {},
        isLoading: false,
        error: null,
        lastUpdate: null
    }
};

export const fetchInventory = createAsyncThunk(
    InventoryActionTypes.FETCH_INVENTORY,
    async () => {
        console.log('🔄 Начало загрузки списка чатов');
        const response = await axios.get<ChatInventory[]>(`${config.API_URL}/chats`);
        console.log('✅ Получены данные:', response.data);
        return response.data;
    }
);

export const fetchChatInventory = createAsyncThunk(
    'inventory/fetchChatInventory',
    async (chatId: string) => {
        console.log('=== FETCH CHAT INVENTORY ===');
        console.log('Chat ID:', chatId);
        console.log('API URL:', `${config.API_URL}/inventory/${chatId}`);
        console.log('Config:', config);

        try {
            console.log('Making API request...');
            const response = await axios.get(`${config.API_URL}/inventory/${chatId}`);
            
            console.log('Server Response:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data,
                rawData: JSON.stringify(response.data, null, 2)
            });

            // Проверяем структуру данных
            if (!response.data) {
                console.error('No data in response');
                throw new Error('Нет данных в ответе');
            }

            // Проверяем, есть ли шаблон в ответе
            if (!response.data.inventory && typeof response.data === 'object') {
                console.log('Using response data as inventory template');
                // Если нет inventory в ответе, но есть данные, используем их как шаблон
                const result = { 
                    chatId, 
                    data: {
                        inventory: response.data,
                        metadata: {
                            lastUpdated: new Date().toISOString(),
                            progress: 0
                        }
                    }
                };
                console.log('Formatted Result (from template):', result);
                return result;
            }

            // Если есть поле inventory, используем его
            const result = { 
                chatId, 
                data: {
                    inventory: response.data.inventory || {},
                    metadata: response.data.metadata || {
                        lastUpdated: new Date().toISOString(),
                        progress: 0
                    }
                }
            };

            console.log('Formatted Result (from inventory):', result);
            console.log('========================');

            return result;
        } catch (error: any) {
            console.error('=== FETCH CHAT INVENTORY ERROR ===');
            console.error('Error:', error.message);
            console.error('Response:', error.response?.data);
            console.error('Status:', error.response?.status);
            console.error('Config:', error.config);
            console.error('========================');
            throw error;
        }
    }
);

interface UpdateInventoryPayload {
    chatId: string;
    category: string;
    itemId: string;
    item: InventoryItem;
}

interface UpdateInventoryResult {
    chatId: string;
    inventory: Inventory;
}

export const updateInventoryItem = createAsyncThunk<UpdateInventoryResult, UpdateInventoryPayload>(
    InventoryActionTypes.UPDATE_INVENTORY,
    async (payload, { getState }) => {
        // Получаем текущий инвентарь из состояния
        const state = getState() as { inventory: InventoryState };
        const currentInventory = state.inventory.selectedChat?.inventory || {};
        const currentItem = currentInventory[payload.category]?.[payload.itemId];
        
        // Определяем тип изменения для логирования
        let actionType = '';
        let oldQuantity = 0;
        let newQuantity = 0;
        let itemType = 'raw';

        // Создаем обновленный item с автоматической установкой filled
        const updatedItem = { ...payload.item };
        
        // Автоматически устанавливаем filled в true если quantity > 0
        // или если filled уже установлен в true (для случаев, когда товара нет в наличии)
        if (updatedItem.raw) {
            updatedItem.raw = {
                ...updatedItem.raw,
                filled: updatedItem.raw.quantity > 0 || updatedItem.raw.filled === true || updatedItem.raw.isOutOfStock === true
            };
        }
        
        if (updatedItem.semifinished) {
            updatedItem.semifinished = {
                ...updatedItem.semifinished,
                filled: updatedItem.semifinished.quantity > 0 || updatedItem.semifinished.filled === true
            };
        }

        if (!currentItem?.semifinished && updatedItem.semifinished) {
            actionType = 'добавлен полуфабрикат';
            itemType = 'semifinished';
            oldQuantity = 0;
            newQuantity = updatedItem.semifinished.quantity;
        } else if (currentItem?.semifinished && !updatedItem.semifinished) {
            actionType = 'удален полуфабрикат';
            itemType = 'semifinished';
            oldQuantity = currentItem.semifinished.quantity;
            newQuantity = 0;
        } else if (currentItem?.raw.quantity !== updatedItem.raw.quantity) {
            actionType = 'изменено количество сырья';
            itemType = 'raw';
            oldQuantity = currentItem?.raw.quantity || 0;
            newQuantity = updatedItem.raw.quantity;
        } else if (currentItem?.semifinished?.quantity !== updatedItem?.semifinished?.quantity) {
            actionType = 'изменено количество полуфабриката';
            itemType = 'semifinished';
            oldQuantity = currentItem?.semifinished?.quantity || 0;
            newQuantity = updatedItem.semifinished?.quantity || 0;
        }

        console.log('📊 Данные для истории:', {
            actionType,
            itemType,
            oldQuantity,
            newQuantity,
            category: payload.category,
            itemId: payload.itemId
        });

        // Создаем обновленный инвентарь
        const updatedInventory = {
            ...currentInventory,
            [payload.category]: {
                ...currentInventory[payload.category],
                [payload.itemId]: updatedItem
            }
        };
        
        // Формируем данные для отправки
        const inventoryData = {
            inventory: updatedInventory,
            metadata: {
                lastUpdated: new Date().toISOString(),
                progress: 0,
                chat_id: payload.chatId,
                currentUser: state.inventory.currentUser
            },
            // Добавляем информацию для истории
            history: {
                action: actionType === 'добавлен полуфабрикат' ? 'add_option' :
                        actionType === 'удален полуфабрикат' ? 'remove_option' :
                        newQuantity > oldQuantity ? 'add' : 'remove',
                type: itemType,
                oldQuantity,
                newQuantity,
                category: payload.category,
                itemName: payload.itemId
            }
        };

        console.log('📤 Отправка данных на сервер:', inventoryData);

        const response = await axios.post(`${config.API_URL}/inventory/${payload.chatId}`, inventoryData);
        console.log(`✅ ${actionType} успешно сохранен:`, response.data);
        
        return { 
            chatId: payload.chatId, 
            inventory: updatedInventory 
        };
    }
);

export const checkAdminRights = createAsyncThunk(
    InventoryActionTypes.CHECK_ADMIN_RIGHTS,
    async ({ userId, chatId }: { userId: number; chatId: string }, { getState }) => {
        const state = getState() as { inventory: InventoryState };
        const chat = state.inventory.items.find(item => item.chat_id === chatId);
        
        if (!chat) {
            throw new Error('Chat not found');
        }

        const admin = chat.admins.find(admin => admin.user_id === userId);
        return admin || null;
    }
);

export const initializeFromTelegram = createAsyncThunk(
    'inventory/initializeFromTelegram',
    async () => {
        const webApp = window.Telegram?.WebApp as WebApp | undefined;
        if (!webApp?.initDataUnsafe?.user?.id) {
            throw new Error('Telegram WebApp user data not available');
        }
        
        return webApp.initDataUnsafe.user;
    }
);

export const fetchItemHistory = createAsyncThunk(
    InventoryActionTypes.FETCH_ITEM_HISTORY,
    async ({ chatId, itemId, category, itemName }: {
        chatId: string;
        itemId: string;
        category: string;
        itemName: string;
    }) => {
        console.log('📚 Начало загрузки истории:', {
            chatId,
            itemId,
            category,
            itemName,
            timestamp: new Date().toISOString()
        });

        try {
            const response = await api.history.getItemHistory(chatId, itemId, category, itemName);
            console.log('✅ История успешно загружена:', {
                recordsCount: response.data.length,
                firstRecord: response.data[0],
                lastRecord: response.data[response.data.length - 1],
                allRecords: response.data
            });
            
            // Проверяем структуру данных
            if (!Array.isArray(response.data)) {
                console.error('❌ Неверный формат данных:', response.data);
                throw new Error('История должна быть массивом');
            }

            return {
                itemId,
                history: response.data as HistoryRecord[],
                category,
                itemName
            };
        } catch (error: any) {
            console.error('❌ Ошибка при загрузке истории:', {
                error: error.message,
                details: error.response?.data,
                status: error.response?.status,
                url: error.config?.url
            });
            throw error;
        }
    }
);

// Функция для вычисления прогресса инвентаризации
const calculateInventoryProgress = (inventory: Inventory): number => {
    console.log('=== 📊 Вычисление прогресса инвентаризации ===');
    let totalItems = 0;
    let filledItems = 0;

    Object.entries(inventory).forEach(([category, items]) => {
        console.log(`\n📑 Категория: ${category}`);
        Object.entries(items).forEach(([itemName, item]) => {
            console.log(`\n📦 Товар: ${itemName}`);
            
            // Проверяем сырье
            if (item.raw) {
                totalItems++;
                const isRawFilled = item.raw.filled === true || (item.raw.quantity ?? 0) > 0 || item.raw.isOutOfStock === true;
                console.log('🥩 Сырье:');
                console.log(`   - Количество: ${item.raw.quantity}`);
                console.log(`   - Флаг filled: ${item.raw.filled}`);
                console.log(`   - Флаг isOutOfStock: ${item.raw.isOutOfStock}`);
                console.log(`   - Итоговый статус: ${isRawFilled ? 'заполнено' : 'не заполнено'}`);
                
                if (isRawFilled) {
                    filledItems++;
                }
            }

            // Проверяем полуфабрикат, если есть
            if (item.semifinished) {
                totalItems++;
                const isSemifinishedFilled = item.semifinished.filled === true || (item.semifinished.quantity ?? 0) > 0;
                console.log('🥪 Полуфабрикат:');
                console.log(`   - Количество: ${item.semifinished.quantity}`);
                console.log(`   - Флаг filled: ${item.semifinished.filled}`);
                console.log(`   - Итоговый статус: ${isSemifinishedFilled ? 'заполнено' : 'не заполнено'}`);
                
                if (isSemifinishedFilled) {
                    filledItems++;
                }
            }
        });
    });

    const progress = totalItems > 0 ? Math.round((filledItems / totalItems) * 100) : 0;
    
    console.log('\n=== Итоги подсчета ===');
    console.log(`📊 Всего позиций: ${totalItems}`);
    console.log(`✅ Заполнено: ${filledItems}`);
    console.log(`📈 Прогресс: ${progress}%`);
    
    return progress;
};

// Добавляем типы для результатов async thunks
interface RemoveInventoryItemResult {
    chatId: string;
    category: string;
    itemId: string;
}

interface AddInventoryItemResult {
    chatId: string;
    category: string;
    itemId: string;
}

export const removeInventoryItem = createAsyncThunk<RemoveInventoryItemResult, { chatId: string; category: string; itemId: string }>(
    'inventory/removeInventoryItem',
    async ({ chatId, category, itemId }) => {
        try {
            console.log('Отправка запроса на удаление товара:', {
                url: `${config.API_URL}/delete_item`,
                data: {
                    category,
                    item: itemId,
                    chat_id: chatId,
                    updateAllInventories: false // Не обновлять все инвентари, только текущий
                }
            });

            // Отправляем запрос на удаление товара через специальный эндпоинт
            const response = await axios.post(`${config.API_URL}/delete_item`, {
                category,
                item: itemId,
                chat_id: chatId,
                updateAllInventories: false // Не обновлять все инвентари, только текущий
            });

            console.log('Ответ сервера:', response.data);

            return { chatId, category, itemId };
        } catch (error: any) {
            console.error('Ошибка при удалении товара:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: error.config
            });
            throw error;
        }
    }
);

// Функция для глобального удаления товара (для администраторов)
export const removeInventoryItemGlobally = createAsyncThunk<RemoveInventoryItemResult, { chatId: string; category: string; itemId: string }>(
    'inventory/removeInventoryItemGlobally',
    async ({ chatId, category, itemId }) => {
        try {
            console.log('Отправка запроса на ГЛОБАЛЬНОЕ удаление товара:', {
                url: `${config.API_URL}/delete_item`,
                data: {
                    category,
                    item: itemId,
                    chat_id: chatId,
                    updateAllInventories: true // Обновлять все инвентари и шаблон
                }
            });

            // Отправляем запрос на удаление товара через специальный эндпоинт
            const response = await axios.post(`${config.API_URL}/delete_item`, {
                category,
                item: itemId,
                chat_id: chatId,
                updateAllInventories: true // Обновлять все инвентари и шаблон
            });

            console.log('Ответ сервера:', response.data);

            return { chatId, category, itemId };
        } catch (error: any) {
            console.error('Ошибка при глобальном удалении товара:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: error.config
            });
            throw error;
        }
    }
);

export const addInventoryItem = createAsyncThunk<AddInventoryItemResult, { chatId: string; category: string; itemId: string }>(
    'inventory/addInventoryItem',
    async ({ chatId, category, itemId }, { getState }) => {
        try {
            // Получаем текущего пользователя и информацию о чате
            const state = getState() as { inventory: InventoryState };
            const currentUser = state.inventory.currentUser;
            const currentChat = state.inventory.items.find(chat => chat.chat_id === chatId);
            
            // Добавляем в шаблон
            await axios.put(`${config.API_URL}/templates/inventory_template`, {
                category,
                item: itemId,
                has_semifinished: false
            });

            // Получаем текущий инвентарь чата
            const response = await axios.get(`${config.API_URL}/inventory/${chatId}`);
            const currentInventory = response.data;

            // Добавляем новый товар к существующему инвентарю
            const updatedInventory = {
                ...currentInventory,
                inventory: {
                    ...currentInventory.inventory,
                    [category]: {
                        ...currentInventory.inventory[category],
                        [itemId]: {
                            raw: {
                                quantity: 0,
                                filled: false,
                                isOutOfStock: false
                            }
                        }
                    }
                },
                metadata: {
                    ...currentInventory.metadata,
                    lastUpdated: new Date().toISOString()
                }
            };

            // Отправляем обновленный инвентарь
            await axios.post(`${config.API_URL}/inventory/${chatId}`, updatedInventory);
            
            // Проверяем другие чаты с активной инвентаризацией
            const otherActiveChats = state.inventory.items.filter(chat => 
                chat.chat_id !== chatId && // не текущий чат
                chat.metadata && // есть метаданные
                chat.metadata.progress !== undefined && // процесс инвентаризации начат
                chat.metadata.progress < 100 // инвентаризация не завершена
            );
            
            console.log(`Найдено ${otherActiveChats.length} активных чатов для предложения добавления товара`);
            
            // Если есть активные чаты, отправляем им уведомления
            if (otherActiveChats.length > 0) {
                // Готовим данные для уведомления
                const notificationData = {
                    type: 'item_suggestion',
                    source: {
                        userId: currentUser.id,
                        userName: currentUser.first_name,
                        chatId: chatId,
                        chatTitle: currentChat?.chat_title || 'Неизвестный чат'
                    },
                    item: {
                        category,
                        itemId,
                        has_semifinished: false
                    },
                    timestamp: new Date().toISOString()
                };
                
                // Сохраняем данные последнего отправленного предложения
                // Это будет использоваться в уведомлениях о статусе
                store.dispatch(setLastSentItemSuggestion(notificationData));
                
                console.log("=== 📢 Подготовка уведомлений о добавлении товара ===");
                console.log("🧾 Данные уведомления:", JSON.stringify(notificationData, null, 2));
                console.log("👤 Текущий пользователь:", currentUser);
                console.log("🔄 Список чатов для отправки:", otherActiveChats.map(c => c.chat_title));
                
                // Отправляем уведомления через вебсокет всем активным чатам
                for (const chat of otherActiveChats) {
                    console.log(`📤 Отправка предложения добавить товар в чат: ${chat.chat_title} (${chat.chat_id})`);
                    
                    const payload = {
                        targetChatId: chat.chat_id,
                        data: notificationData
                    };
                    
                    console.log("📦 Отправляемые данные:", JSON.stringify(payload, null, 2));
                    
                    // Используем новый асинхронный API
                    try {
                        const sent = await socketService.emit('inventory_notification', payload);
                        if (sent) {
                            console.log(`✅ Уведомление для ${chat.chat_title} отправлено`);
                        } else {
                            console.warn(`⚠️ Уведомление для ${chat.chat_title} добавлено в очередь`);
                        }
                    } catch (error) {
                        console.error(`❌ Ошибка при отправке уведомления для ${chat.chat_title}:`, error);
                    }
                }
            } else {
                console.log("ℹ️ Нет активных чатов для отправки уведомлений о добавлении товара");
            }

            return { chatId, category, itemId };
        } catch (error) {
            throw error;
        }
    }
);

export const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        selectChat: (state, action) => {
            const chatId = action.payload;
            const selectedChat = state.items.find(chat => chat.chat_id === chatId);
            
            console.log('🎯 Выбран чат:', chatId);
            console.log('👤 Текущий пользователь:', state.currentUser);
            console.log('💬 Данные выбранного чата:', selectedChat);
            
            // Обновляем выбранный чат
            state.selectedChatId = chatId;
            state.selectedChat = selectedChat || null;

            // Сбрасываем права пользователя для нового чата
            state.currentUser.isAdmin = false;
            state.currentUser.adminRights = null;

            // Проверяем права только если есть ID пользователя и выбранный чат
            if (selectedChat && state.currentUser.id) {
                console.log('🔍 Проверка прав администратора для чата:', selectedChat.chat_title);
                
                // Проверяем, является ли пользователь администратором этого чата
                const adminData = selectedChat.admins.find(
                    admin => {
                        console.log('🔄 Сравнение ID админа:', admin.user_id, 'тип:', typeof admin.user_id);
                        console.log('🔄 С ID пользователя:', state.currentUser.id, 'тип:', typeof state.currentUser.id);
                        return Number(admin.user_id) === Number(state.currentUser.id);
                    }
                );

                if (adminData) {
                    state.currentUser.isAdmin = true;
                    state.currentUser.adminRights = adminData;
                    state.currentUser.photo_url = adminData.photo_url || null;
                    state.currentUser.first_name = adminData.first_name;
                    console.log('✅ Пользователь является администратором этого чата:', state.currentUser);
                } else {
                    console.log('ℹ️ Пользователь не является администратором этого чата');
                    const memberData = selectedChat.members.find(
                        member => Number(member.user_id) === Number(state.currentUser.id)
                    );

                    if (memberData) {
                        state.currentUser.photo_url = memberData.photo_url || null;
                        state.currentUser.first_name = memberData.first_name;
                        console.log('👥 Пользователь является участником этого чата');
                    } else {
                        console.log('❌ Пользователь не является участником этого чата');
                    }
                }
            }
        },
        clearSelectedChat: (state) => {
            state.selectedChatId = null;
            state.selectedChat = null;
            state.currentUser.isAdmin = false;
            state.currentUser.adminRights = null;
            state.currentUser.photo_url = null;
            state.currentUser.first_name = null;
        },
        updateChatData: (state, action) => {
            const { chatId, data } = action.payload;
            
            if (process.env.NODE_ENV === 'development') {
                console.debug('📡 Обновление данных чата в Redux:', {
                    chatId,
                    dataType: data.type || 'full',
                    updateType: data.type === 'item_update' ? 'partial' : 'full',
                    hasAdmins: !!data.admins,
                    selectedChatId: state.selectedChatId
                });
            }

            const chatIndex = state.items.findIndex(chat => chat.chat_id === chatId);
            if (chatIndex !== -1) {
                const oldData = state.items[chatIndex];
                
                if (data.type === 'item_update' && data.category && data.itemId && data.item) {
                    const updatedInventory = JSON.parse(JSON.stringify(oldData.inventory || {}));
                    
                    if (!updatedInventory[data.category]) {
                        updatedInventory[data.category] = {};
                    }
                    
                    // Применяем ту же логику обработки filled статуса
                    const updatedItem = { ...data.item };
                    if (updatedItem.raw) {
                        updatedItem.raw = {
                            ...updatedItem.raw,
                            filled: updatedItem.raw.quantity > 0 || updatedItem.raw.filled === true || updatedItem.raw.isOutOfStock === true
                        };
                    }
                    if (updatedItem.semifinished) {
                        updatedItem.semifinished = {
                            ...updatedItem.semifinished,
                            filled: updatedItem.semifinished.quantity > 0 || updatedItem.semifinished.filled === true
                        };
                    }
                    
                    updatedInventory[data.category][data.itemId] = updatedItem;

                    // Рассчитываем новый прогресс
                    const progress = calculateInventoryProgress(updatedInventory);
                    
                    // Обновляем метаданные с новым прогрессом
                    const updatedMetadata = {
                        ...oldData.metadata,
                        progress,
                        lastUpdated: new Date().toISOString()
                    };

                    if (process.env.NODE_ENV === 'development') {
                        console.debug('✏️ Обновление товара в Redux:', {
                            category: data.category,
                            itemId: data.itemId,
                            oldValue: oldData.inventory?.[data.category]?.[data.itemId],
                            newValue: data.item,
                            notification: data.notification,
                            progress
                        });
                    }
                    
                    state.items[chatIndex] = {
                        ...oldData,
                        inventory: updatedInventory,
                        metadata: updatedMetadata
                    };
                    
                    if (state.selectedChatId === chatId) {
                        state.selectedChat = state.items[chatIndex];
                    }
                } else if (data.inventory) {
                    const progress = calculateInventoryProgress(data.inventory);
                    
                    const updatedMetadata = {
                        ...oldData.metadata,
                        ...data.metadata,
                        progress,
                        lastUpdated: new Date().toISOString()
                    };
                    
                    state.items[chatIndex] = {
                        ...oldData,
                        inventory: data.inventory,
                        metadata: updatedMetadata
                    };
                    
                    if (process.env.NODE_ENV === 'development') {
                        console.debug('📦 Полное обновление инвентаря:', {
                            chatId,
                            categoriesCount: Object.keys(data.inventory).length,
                            progress
                        });
                    }

                    if (state.selectedChatId === chatId) {
                        state.selectedChat = state.items[chatIndex];
                    }
                }

                // Перепроверяем права пользователя если есть обновление админов
                if (data.admins && state.currentUser.id) {
                    const wasAdmin = state.currentUser.isAdmin;
                    const adminData = state.items[chatIndex].admins.find(
                        admin => Number(admin.user_id) === Number(state.currentUser.id)
                    );

                    state.currentUser.isAdmin = !!adminData;

                    if (adminData) {
                        state.currentUser.adminRights = adminData;
                        state.currentUser.photo_url = adminData.photo_url || null;
                        state.currentUser.first_name = adminData.first_name;
                    } else {
                        state.currentUser.adminRights = null;
                        const memberData = state.items[chatIndex].members.find(
                            member => Number(member.user_id) === Number(state.currentUser.id)
                        );
                        if (memberData) {
                            state.currentUser.photo_url = memberData.photo_url || null;
                            state.currentUser.first_name = memberData.first_name;
                        }
                    }

                    if (wasAdmin !== state.currentUser.isAdmin && process.env.NODE_ENV === 'development') {
                        console.debug('Изменение прав пользователя:', {
                            wasAdmin,
                            isAdmin: state.currentUser.isAdmin,
                            userId: state.currentUser.id
                        });
                    }
                }
            }
        },
        setSelectedItem: (state, action: PayloadAction<InventoryItem | null>) => {
            state.selectedItem = action.payload;
        },
        setHistoryLoading: (state, action) => {
            state.history.isLoading = action.payload;
        },
        clearItemHistory: (state) => {
            state.history.records = {};
            state.history.lastUpdate = null;
        },
        receiveHistoryUpdate: (state, action) => {
            const { itemId, record } = action.payload;
            console.log('=== 📝 Обработка обновления истории в Redux ===');
            console.log('📦 Товар:', itemId);
            console.log('📊 Запись:', record);
            
            if (!state.history.records[itemId]) {
                state.history.records[itemId] = [];
            }
            
            // Проверяем, нет ли уже такой записи
            const existingIndex = state.history.records[itemId].findIndex(
                (r) => r.timestamp === record.timestamp && r.action === record.action
            );
            
            if (existingIndex === -1) {
                // Добавляем новую запись в начало массива
                state.history.records[itemId].unshift(record);
                console.log('✅ Новая запись добавлена в историю');
            } else {
                console.log('ℹ️ Запись уже существует в истории');
            }
            
            state.history.lastUpdate = new Date().toISOString();
        },
        updateProgress: (state) => {
            if (state.selectedChat?.inventory) {
                console.log('=== 🔄 Обновление прогресса ===');
                console.log(`🏠 Чат: ${state.selectedChat.chat_id}`);
                
                const progress = calculateInventoryProgress(state.selectedChat.inventory);
                if (state.selectedChat.metadata) {
                    state.selectedChat.metadata.progress = progress;
                } else {
                    state.selectedChat.metadata = {
                        progress,
                        lastUpdated: new Date().toISOString(),
                        chat_id: state.selectedChat.chat_id
                    };
                }
                
                console.log('✅ Прогресс обновлен:', progress);
                
                // Обновляем прогресс также в общем списке чатов
                const chatIndex = state.items.findIndex(chat => chat.chat_id === state.selectedChat?.chat_id);
                if (chatIndex !== -1) {
                    if (state.items[chatIndex].metadata) {
                        state.items[chatIndex].metadata.progress = progress;
                    } else {
                        state.items[chatIndex].metadata = {
                            progress,
                            lastUpdated: new Date().toISOString(),
                            chat_id: state.selectedChat.chat_id
                        };
                    }
                    console.log('✅ Прогресс обновлен в списке чатов');
                }
            } else {
                console.warn('⚠️ Нет выбранного чата или инвентаря для обновления прогресса');
            }
        },
        // Редьюсер для ручного обновления инвентаря после изменений на сервере
        manualInventoryUpdate: (state, action) => {
            const { chatId, data } = action.payload;
            console.log('=== 🔄 Ручное обновление инвентаря ===');
            console.log(`🏠 Чат: ${chatId}`);
            console.log('📦 Данные:', data);
            
            // Рассчитываем прогресс для обновленного инвентаря
            const progress = calculateInventoryProgress(data.inventory);
            
            // Обновляем инвентарь в выбранном чате, если это он
            if (state.selectedChat && state.selectedChat.chat_id === chatId) {
                console.log('✅ Обновляем выбранный чат');
                state.selectedChat.inventory = data.inventory;
                state.selectedChat.metadata = {
                    ...data.metadata,
                    progress,
                    lastUpdated: new Date().toISOString()
                };
            }
            
            // Обновляем инвентарь в общем списке чатов
            const chatIndex = state.items.findIndex(chat => chat.chat_id === chatId);
            if (chatIndex !== -1) {
                console.log('✅ Обновляем чат в общем списке');
                state.items[chatIndex].inventory = data.inventory;
                state.items[chatIndex].metadata = {
                    ...data.metadata,
                    progress,
                    lastUpdated: new Date().toISOString()
                };
            } else {
                console.warn('⚠️ Чат не найден в общем списке для обновления');
            }
        },
        // Добавляем новый редьюсер для сохранения последнего отправленного предложения товара
        setLastSentItemSuggestion: (state, action: PayloadAction<any>) => {
            state.lastSentItemSuggestion = action.payload;
            console.log('🔄 Сохранено последнее отправленное предложение товара:', action.payload);
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchInventory.pending, (state) => {
                if (process.env.NODE_ENV === 'development') {
                    console.debug('⏳ Загрузка списка чатов...');
                }
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchInventory.fulfilled, (state, action) => {
                if (process.env.NODE_ENV === 'development') {
                    console.debug('✅ Список чатов загружен:', {
                        chatsCount: action.payload.length,
                        selectedChatId: state.selectedChatId
                    });
                }
                state.isLoading = false;
                
                // Рассчитываем прогресс для каждого чата
                const chatsWithProgress = action.payload.map(chat => {
                    if (chat.inventory) {
                        const progress = calculateInventoryProgress(chat.inventory);
                        return {
                            ...chat,
                            metadata: {
                                ...chat.metadata,
                                progress,
                                lastUpdated: new Date().toISOString()
                            }
                        };
                    }
                    return chat;
                });
                
                state.items = chatsWithProgress;
                
                // При получении данных о чатах, проверяем права только для выбранного чата
                if (state.selectedChatId && state.currentUser.id) {
                    const selectedChat = chatsWithProgress.find(
                        chat => chat.chat_id === state.selectedChatId
                    );
                    
                    if (selectedChat) {
                        // Сбрасываем текущие права
                        state.currentUser.isAdmin = false;
                        state.currentUser.adminRights = null;
                        state.currentUser.photo_url = null;
                        state.currentUser.first_name = null;

                        // Проверяем права администратора
                        const adminData = selectedChat.admins.find(
                            admin => Number(admin.user_id) === Number(state.currentUser.id)
                        );

                        if (adminData) {
                            state.currentUser.isAdmin = true;
                            state.currentUser.adminRights = adminData;
                            state.currentUser.photo_url = adminData.photo_url || null;
                            state.currentUser.first_name = adminData.first_name;
                            
                            if (process.env.NODE_ENV === 'development') {
                                console.debug('👤 Обновлены права администратора:', {
                                    userId: state.currentUser.id,
                                    isAdmin: true,
                                    rights: adminData
                                });
                            }
                            return;
                        }

                        // Если пользователь не админ, проверяем членство в чате
                        const memberData = selectedChat.members.find(
                            member => Number(member.user_id) === Number(state.currentUser.id)
                        );

                        if (memberData) {
                            state.currentUser.photo_url = memberData.photo_url || null;
                            state.currentUser.first_name = memberData.first_name;
                            
                            if (process.env.NODE_ENV === 'development') {
                                console.debug('👤 Обновлены данные участника:', {
                                    userId: state.currentUser.id,
                                    isAdmin: false
                                });
                            }
                        }
                    }
                }

                // Обновляем выбранный чат если он есть
                if (state.selectedChatId) {
                    state.selectedChat = chatsWithProgress.find(
                        chat => chat.chat_id === state.selectedChatId
                    ) || null;
                    
                    if (process.env.NODE_ENV === 'development') {
                        console.debug('✅ Обновлен выбранный чат:', {
                            chatId: state.selectedChatId,
                            found: !!state.selectedChat
                        });
                    }
                }
            })
            .addCase(fetchInventory.rejected, (state, action) => {
                if (process.env.NODE_ENV === 'development') {
                    console.error('❌ Ошибка загрузки списка чатов:', action.error);
                }
                state.isLoading = false;
                state.error = action.error.message || 'Failed to fetch inventory';
            })
            .addCase(fetchChatInventory.pending, (state) => {
                console.debug('⏳ Загрузка инвентаря чата...');
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchChatInventory.fulfilled, (state, action) => {
                console.debug('🔍 Redux Debug - Обработка успешного ответа fetchChatInventory:', {
                    timestamp: new Date().toISOString(),
                    chatId: action.payload.chatId,
                    dataSize: JSON.stringify(action.payload.data).length,
                    hasInventory: !!action.payload.data?.inventory,
                    inventoryKeys: Object.keys(action.payload.data?.inventory || {}),
                    metadata: action.payload.data?.metadata,
                    currentState: {
                        selectedChatId: state.selectedChatId,
                        hasSelectedChat: !!state.selectedChat,
                        selectedChatInventorySize: state.selectedChat ? Object.keys(state.selectedChat.inventory || {}).length : 0
                    }
                });

                state.isLoading = false;
                
                // Рассчитываем прогресс для загруженного инвентаря
                const progress = calculateInventoryProgress(action.payload.data.inventory);
                
                // Обновляем данные инвентаря в выбранном чате
                if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                    const oldInventory = state.selectedChat.inventory;
                    state.selectedChat.inventory = action.payload.data.inventory;
                    state.selectedChat.metadata = {
                        ...action.payload.data.metadata,
                        progress,
                        lastUpdated: new Date().toISOString()
                    };
                    
                    console.debug('🔍 Redux Debug - Обновление инвентаря в выбранном чате:', {
                        chatId: action.payload.chatId,
                        oldInventoryKeys: Object.keys(oldInventory || {}),
                        newInventoryKeys: Object.keys(action.payload.data.inventory || {}),
                        changed: JSON.stringify(oldInventory) !== JSON.stringify(action.payload.data.inventory),
                        newInventoryData: action.payload.data.inventory,
                        progress
                    });
                }

                // Также обновляем данные в общем списке чатов
                const chatIndex = state.items.findIndex(chat => chat.chat_id === action.payload.chatId);
                if (chatIndex !== -1) {
                    const oldInventory = state.items[chatIndex].inventory;
                    state.items[chatIndex].inventory = action.payload.data.inventory;
                    state.items[chatIndex].metadata = {
                        ...action.payload.data.metadata,
                        progress,
                        lastUpdated: new Date().toISOString()
                    };
                    
                    console.debug('🔍 Redux Debug - Обновление инвентаря в списке чатов:', {
                        chatId: action.payload.chatId,
                        chatIndex,
                        oldInventoryKeys: Object.keys(oldInventory || {}),
                        newInventoryKeys: Object.keys(action.payload.data.inventory || {}),
                        changed: JSON.stringify(oldInventory) !== JSON.stringify(action.payload.data.inventory),
                        newInventoryData: action.payload.data.inventory,
                        progress
                    });
                }
            })
            .addCase(fetchChatInventory.rejected, (state, action) => {
                console.error('❌ Ошибка загрузки инвентаря чата:', {
                    timestamp: new Date().toISOString(),
                    error: action.error
                });
                state.isLoading = false;
                state.error = action.error.message || 'Failed to fetch chat inventory';
            })
            .addCase(updateInventoryItem.fulfilled, (state, action) => {
                const { chatId, inventory } = action.payload;
                const chat = state.items.find(item => item.chat_id === chatId);
                if (chat) {
                    chat.inventory = inventory;
                    if (state.selectedChat?.chat_id === chatId) {
                        state.selectedChat = chat;
                    }
                    // Обновляем прогресс после обновления инвентаря
                    const progress = calculateInventoryProgress(inventory);
                    if (chat.metadata) {
                        chat.metadata.progress = progress;
                    } else {
                        chat.metadata = {
                            progress,
                            lastUpdated: new Date().toISOString(),
                            chat_id: chatId
                        };
                    }
                }
            })
            .addCase(initializeFromTelegram.fulfilled, (state, action) => {
                const user = action.payload;
                
                // Устанавливаем базовую информацию о пользователе
                state.currentUser.id = user.id;
                state.currentUser.photo_url = user.photo_url || null;
                state.currentUser.first_name = user.first_name;
                
                // Сбрасываем права администратора
                state.currentUser.isAdmin = false;
                state.currentUser.adminRights = null;

                // Если есть выбранный чат, проверяем права в нем
                if (state.selectedChat) {
                    const adminData = state.selectedChat.admins.find(
                        admin => {
                            console.log('Сравниваем ID админа:', admin.user_id, 'тип:', typeof admin.user_id);
                            console.log('С ID пользователя:', user.id, 'тип:', typeof user.id);
                            return Number(admin.user_id) === Number(user.id);
                        }
                    );

                    if (adminData) {
                        state.currentUser.isAdmin = true;
                        state.currentUser.adminRights = adminData;
                        state.currentUser.photo_url = adminData.photo_url || null;
                        state.currentUser.first_name = adminData.first_name;
                        console.log('Права администратора установлены при инициализации:', state.currentUser);
                    }
                }
            })
            .addCase(initializeFromTelegram.rejected, (state, action) => {
                state.error = 'Failed to initialize user from Telegram';
            })
            .addCase(fetchItemHistory.pending, (state) => {
                console.log('⏳ Начало загрузки истории...');
                state.history.isLoading = true;
                state.history.error = null;
            })
            .addCase(fetchItemHistory.fulfilled, (state, action) => {
                const { itemId, history } = action.payload;
                console.log('✅ История успешно сохранена в store:', {
                    itemId,
                    recordsCount: history.length,
                    timestamp: new Date().toISOString()
                });
                state.history.records[itemId] = history;
                state.history.isLoading = false;
                state.history.lastUpdate = new Date().toISOString();
            })
            .addCase(fetchItemHistory.rejected, (state, action) => {
                console.error('❌ Ошибка при сохранении истории:', {
                    error: action.error.message,
                    timestamp: new Date().toISOString()
                });
                state.history.isLoading = false;
                state.history.error = action.error.message || 'Failed to fetch history';
            })
            .addCase(removeInventoryItem.fulfilled, (state, action) => {
                const { chatId, category, itemId } = action.payload;
                const chat = state.items.find(item => item.chat_id === chatId);
                if (chat?.inventory?.[category]?.[itemId]) {
                    delete chat.inventory[category][itemId];
                    if (Object.keys(chat.inventory[category]).length === 0) {
                        delete chat.inventory[category];
                    }
                    if (state.selectedChat?.chat_id === chatId) {
                        state.selectedChat = chat;
                    }
                }
            })
            .addCase(addInventoryItem.fulfilled, (state, action) => {
                const { chatId, category, itemId } = action.payload;
                const chat = state.items.find(item => item.chat_id === chatId);
                if (chat) {
                    if (!chat.inventory) chat.inventory = {};
                    if (!chat.inventory[category]) chat.inventory[category] = {};
                    chat.inventory[category][itemId] = {
                        raw: { 
                            quantity: 0, 
                            filled: false,
                            isOutOfStock: false
                        }
                    };
                    if (state.selectedChat?.chat_id === chatId) {
                        state.selectedChat = chat;
                    }
                }
            });
    }
});

export const { 
    selectChat, 
    clearSelectedChat, 
    updateChatData,
    setSelectedItem,
    setHistoryLoading,
    clearItemHistory,
    receiveHistoryUpdate,
    updateProgress,
    manualInventoryUpdate,
    setLastSentItemSuggestion
} = inventorySlice.actions;
export default inventorySlice.reducer;

// Middleware для WebSocket
export const setupHistoryWebSocket = (store: any) => {
    socketService.subscribe('history_update', (data) => {
        console.log('📡 Получено обновление истории через WebSocket:', {
            itemId: data.itemId,
            record: data.record,
            timestamp: new Date().toISOString()
        });
        store.dispatch(receiveHistoryUpdate({ itemId: data.itemId, record: data.record }));
    });
}; 