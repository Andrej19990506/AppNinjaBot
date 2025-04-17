import { createSlice, createAsyncThunk, PayloadAction, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ActionCreatorWithPayload, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type { 
    ChatInventory, 
    Admin,
    InventoryItem,
    Inventory,
    HistoryRecord,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Item,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Category,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Chat,
    InventoryState,
    ChatResponse
} from '../../types/inventory';
import { WebApp } from '../../types/telegram';
import config from '../../config';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { RootState } from '../store';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { checkAdminRights } from './adminSlice';
import { User } from '../../types/user';

// Константа для ID глобальной комнаты
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// Определяем интерфейс для данных обновления
interface UpdateInventoryDataPayload {
    chatId: string;
    data: {
        inventory?: Inventory;
        type?: string;
        category?: string;
        itemId?: string;
        item?: any;
        metadata?: any;
        notification?: any;
        admins?: Admin[];
    };
}

// Обновляем тип для history.records
interface HistoryRecords {
    [key: string]: HistoryRecord[];
}

interface ItemSuggestionSource {
    userId: number | null | undefined;
    userName: string | null | undefined;
    chatId: string;
    chatTitle: string;
}

interface ItemSuggestionData {
    category: string;
    itemId: string;
    has_semifinished: boolean;
}

interface ItemSuggestion {
    type: string;
    source: ItemSuggestionSource;
    item: ItemSuggestionData;
    timestamp: string;
}

const initialState: InventoryState = {
    items: [],
    categories: [],
    selectedChatId: null,
    selectedChat: null,
    isLoading: false,
    error: null,
    selectedItem: null,
    history: {
        records: {} as HistoryRecords,
        lastUpdate: null,
        isLoading: false,
        error: null
    },
    lastSentItemSuggestion: null
};

export const fetchInventory = createAsyncThunk<
    ChatInventory[],
    { userId: number, role: string | null },
    { rejectValue: string }
>(
    InventoryActionTypes.FETCH_INVENTORY,
    async (arg, { rejectWithValue }) => {
        const { userId, role } = arg;
        console.log(`🔄 Начало загрузки списка чатов для пользователя ${userId} ${role ? `(роль: ${role})` : ''}`);
        try {
            const params: Record<string, any> = { user_id: userId };
            if (role && role !== 'none') {
                params.group_type = role;
            }
            console.log(`🔍 Параметры запроса к /chats:`, params);
            const response = await axios.get<ChatInventory[]>(`${config.API_URL}/api/v1/groups/chats`, {
                params: params
            });
            console.log(`✅ Получены данные чатов для пользователя ${userId} ${role ? `(роль: ${role})` : ''}:`, response.data);
            return response.data;
        } catch (error: any) {
            console.error(`❌ Ошибка при загрузке списка чатов для пользователя ${userId} ${role ? `(роль: ${role})` : ''}:`, error);
            const message = error.response?.data?.detail || error.message || 'Failed to fetch chats';
            return rejectWithValue(message);
        }
    }
);

export const fetchChatInventory = createAsyncThunk<ChatResponse, string>(
    'inventory/fetchChatInventory',
    async (chatId: string) => {
        try {
            // Получаем данные инвентаря
            const inventoryResponse = await axios.get(`${config.API_URL}/api/v1/groups/inventory/${chatId}`);
            const inventoryData = inventoryResponse.data;

            if (!inventoryData) {
                throw new Error('No data returned from inventory API');
            }

            // Формируем ответ в нужном формате, используя данные только из inventory
            const response: ChatResponse = {
                chatId,
                data: {
                    inventory: inventoryData.inventory || {},
                    metadata: {
                        lastUpdated: inventoryData.lastUpdated || new Date().toISOString(),
                        progress: inventoryData.progress || 0,
                    },
                    chat_title: inventoryData.chat_title || chatId,
                    admins: inventoryData.admins || []
                }
            };

            return response;
        } catch (error) {
            console.error('Error fetching chat inventory:', error);
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
    async (payload, { getState, rejectWithValue }) => {
        try {
            const state = getState() as RootState;
            const currentUser: User | null = state.user.user;
            const currentInventory = state.inventory.selectedChat?.inventory || {};
            const currentItem = currentInventory[payload.category]?.[payload.itemId];
            
            // Create updated inventory with proper typing
            const updatedInventory: Inventory = {
                ...currentInventory,
                [payload.category]: {
                    ...currentInventory[payload.category],
                    [payload.itemId]: payload.item
                }
            };

            // Determine change type for logging
            let actionType = '';
            let oldQuantity = 0;
            let newQuantity = 0;
            let itemType = 'raw';

            if (!currentItem?.semifinished && payload.item?.semifinished) {
                actionType = 'добавлен полуфабрикат';
                itemType = 'semifinished';
                oldQuantity = 0;
                newQuantity = payload.item.semifinished.quantity || 0;
            } else if (currentItem?.semifinished && !payload.item?.semifinished) {
                actionType = 'удален полуфабрикат';
                itemType = 'semifinished';
                oldQuantity = currentItem.semifinished?.quantity || 0;
                newQuantity = 0;
            } else if (currentItem?.raw?.quantity !== payload.item?.raw?.quantity) {
                actionType = 'изменено количество сырья';
                itemType = 'raw';
                oldQuantity = currentItem?.raw?.quantity || 0;
                newQuantity = payload.item?.raw?.quantity || 0;
            } else if (currentItem?.semifinished?.quantity !== payload.item?.semifinished?.quantity) {
                actionType = 'изменено количество полуфабриката';
                itemType = 'semifinished';
                oldQuantity = currentItem?.semifinished?.quantity || 0;
                newQuantity = payload.item?.semifinished?.quantity || 0;
            }

            // Log the change
            console.log(`Inventory change: ${actionType}`, {
                chatId: payload.chatId,
                category: payload.category,
                itemId: payload.itemId,
                itemType,
                oldQuantity,
                newQuantity
            });

            // Prepare data for API
            const inventoryData = {
                inventory: updatedInventory,
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    progress: 0,
                    chat_id: payload.chatId,
                    currentUser: {
                        id: currentUser?.id,
                        first_name: currentUser?.first_name,
                        photo_url: currentUser?.photo_url
                    }
                },
                history: {
                    action: actionType === 'добавлен полуфабрикат' ? 'add_option' :
                            actionType === 'удален полуфабрикат' ? 'remove_option' :
                            newQuantity > oldQuantity ? 'add' : 'remove',
                    itemType: itemType,
                    oldQuantity,
                    newQuantity,
                    category: payload.category,
                    itemName: payload.itemId
                }
            };

            console.log('📤 Sending data to server:', inventoryData);

            const response = await axios.post(`${config.API_URL}/api/v1/groups/inventory/${payload.chatId}`, inventoryData);
            console.log(`✅ ${actionType} successfully saved:`, response.data);

            return {
                chatId: payload.chatId,
                inventory: updatedInventory
            };
        } catch (error) {
            return rejectWithValue(error);
        }
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
    let totalItems = 0;
    let filledItems = 0;

    Object.entries(inventory).forEach(([_, items]) => {
        Object.values(items).forEach((item) => {
            // Проверяем наличие свойства raw перед обращением к нему
            if (item && item.raw) {
                totalItems++;
                if (item.raw.filled || item.raw.quantity > 0 || item.raw.isOutOfStock) {
                    filledItems++;
                }
            }
            // Проверяем наличие свойства semifinished перед обращением к нему
            if (item && item.semifinished) {
                totalItems++;
                if (item.semifinished.filled || item.semifinished.quantity > 0) {
                    filledItems++;
                }
            }
        });
    });

    return totalItems > 0 ? Math.round((filledItems / totalItems) * 100) : 0;
};

// Добавляем типы для результатов async thunks
interface RemoveInventoryItemResult {
    chatId: string;
    category: string;
    itemId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export const addInventoryItem = createAsyncThunk(
    'inventory/addInventoryItem',
    async ({ chatId, category, itemId }: { chatId: string; category: string; itemId: string }, { getState }) => {
        try {
            const state = getState() as RootState;
            const currentUser = state.user.user;
            const currentChat = state.inventory.items.find((chat: ChatInventory) => chat.chat_id === chatId);
            
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
                            name: itemId,
                            quantity: 0,
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
            const otherActiveChats = state.inventory.items.filter((chat: ChatInventory) => 
                chat.chat_id !== chatId && 
                chat.metadata && 
                chat.metadata.progress !== undefined && 
                chat.metadata.progress < 100
            );
            
            console.log(`Найдено ${otherActiveChats.length} активных чатов для предложения добавления товара`);
            
            if (otherActiveChats.length > 0) {
                const notificationData = {
                    type: 'item_suggestion',
                    source: {
                        userId: currentUser?.id,
                        userName: currentUser?.first_name,
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
                // @ts-ignore - Временно игнорируем несоответствие типов между ItemSuggestion и InventoryState.lastSentItemSuggestion
                store.dispatch(setLastSentItemSuggestion(notificationData));
                
                console.log("=== 📢 Подготовка уведомлений о добавлении товара ===");
                console.log("🧾 Данные уведомления:", JSON.stringify(notificationData, null, 2));
                console.log("👤 Текущий пользователь:", currentUser);
                console.log("🔄 Список чатов для отправки:", otherActiveChats.map((c: ChatInventory) => c.chat_title));
                
                for (const chat of otherActiveChats) { 
                    console.log(`📤 Отправка предложения добавить товар в чат: ${chat.chat_title} (${chat.chat_id})`);
                    
                    const payload = {
                        targetChatId: chat.chat_id,
                        data: notificationData
                    };
                    
                    console.log("📦 Отправляемые данные:", JSON.stringify(payload, null, 2));
                    
                    // Используем новый асинхронный API
                    try {
                        socketService.emit('inventory_notification', payload);
                        console.log(`✅ Уведомление для ${chat.chat_title} отправлено`);
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

export const selectChat = createAsyncThunk(
    InventoryActionTypes.SELECT_CHAT,
    async (chatId: string, { dispatch, getState }) => {
        console.log('🎯 Выбран чат:', chatId);
        
        try {
            // Получаем текущее состояние
            const state = getState() as RootState;
            const chat = state.inventory.items.find((c: ChatInventory) => c.chat_id === chatId);
            
            if (!chat) {
                throw new Error('Чат не найден');
            }
            
            console.log('💬 Данные выбранного чата:', chat);
            
            // Возвращаем данные чата
            await dispatch(fetchChatInventory(chatId));
            return chat;
        } catch (error) {
            console.error('Ошибка при выборе чата:', error);
            throw error;
        }
    }
);

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        clearSelectedChat: (state) => {
            state.selectedChatId = null;
            state.selectedChat = null;
        },
        updateInventoryData(state, action: PayloadAction<UpdateInventoryDataPayload>) {
            const { chatId, data } = action.payload;
            
            if (process.env.NODE_ENV === 'development') {
                console.log('📡 Обновление данных чата в Redux:', {
                    chatId,
                    dataType: data.type || 'full',
                    updateType: data.type === 'item_update' ? 'partial' : 'full',
                    hasInventory: !!data.inventory,
                    metadata: data.metadata,
                    timestamp: new Date().toISOString()
                });
            }

            const chatIndex = state.items.findIndex((chat: ChatInventory) => chat.chat_id === chatId); 
            if (chatIndex !== -1) {
                const oldData = state.items[chatIndex];
                
                if (data.type === 'item_update' && data.category && data.itemId && data.item) {
                    // Обработка частичного обновления (один товар)
                    const updatedInventory = JSON.parse(JSON.stringify(oldData.inventory || {}));
                    
                    if (!updatedInventory[data.category]) {
                        updatedInventory[data.category] = {};
                    }
                    
                    // Применяем логику обработки filled статуса
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
                    
                    // Обновляем состояние с новыми метаданными
                    const updatedChat = {
                        ...oldData,
                        inventory: updatedInventory,
                        metadata: {
                            ...oldData.metadata,
                            lastUpdated: new Date().toISOString(),
                            progress: calculateInventoryProgress(updatedInventory)
                        }
                    };
                    
                    // Обновляем чат в списке
                    state.items[chatIndex] = updatedChat;
                    
                    // ----> ИСПРАВЛЕНИЕ: Обновляем selectedChat и при полном обновлении <----
                    if (state.selectedChatId === chatId) {
                        state.selectedChat = updatedChat;
                    }
                    
                    console.log('✅ Обновлен товар в инвентаре:', {
                        chatId,
                        category: data.category,
                        itemId: data.itemId,
                        newQuantity: updatedItem.raw?.quantity || updatedItem.semifinished?.quantity,
                        progress: updatedChat.metadata.progress
                    });
                } else if (data.inventory) {
                    // Обработка полного обновления инвентаря
                    console.log('📦 Обработка полного обновления инвентаря:', {
                        chatId,
                        inventorySize: Object.keys(data.inventory).length,
                        metadata: data.metadata
                    });
                    
                    // Обновляем состояние с новыми данными
                    const updatedChat = {
                        ...oldData,
                        inventory: data.inventory,
                        metadata: {
                            ...oldData.metadata,
                            ...data.metadata,
                            lastUpdated: data.metadata?.lastUpdated || new Date().toISOString(),
                            progress: calculateInventoryProgress(data.inventory)
                        }
                    };
                    
                    console.log('📊 Обновленные данные чата:', {
                        chatId,
                        inventorySize: Object.keys(updatedChat.inventory).length,
                        metadata: updatedChat.metadata
                    });
                    
                    // Обновляем чат в списке
                    state.items[chatIndex] = updatedChat;
                    
                    // ----> ИСПРАВЛЕНИЕ: Обновляем selectedChat и при полном обновлении <----
                    if (state.selectedChatId === chatId) {
                        state.selectedChat = updatedChat;
                    }
                    
                    console.log('✅ Обновлен весь инвентарь:', {
                        chatId,
                        itemsCount: Object.keys(data.inventory).length,
                        progress: updatedChat.metadata.progress
                    });
                }
            } else {
                console.warn('⚠️ Чат не найден в списке:', chatId);
            }
        },
        setSelectedItem: (state, action: PayloadAction<InventoryItem | null>) => {
            state.selectedItem = action.payload;
        },
        setHistoryLoading: (state, action: PayloadAction<boolean>) => {
            state.history.isLoading = action.payload;
        },
        setHistoryError: (state, action: PayloadAction<string | null>) => {
            state.history.error = action.payload;
        },
        clearItemHistory: (state) => {
            state.history.records = {} as HistoryRecords;
            state.history.lastUpdate = null;
        },
        receiveHistoryUpdate: (state, action: PayloadAction<{
            itemId: string;
            record: HistoryRecord;
        }>) => {
            const { itemId, record } = action.payload;
            console.log('=== 📝 Обработка обновления истории в Redux ===');
            console.log('📦 Товар:', itemId);
            console.log('📊 Запись:', record);
            console.log('👤 Данные автора:', record.author);
            
            if (!state.history.records[itemId]) {
                state.history.records[itemId] = [];
            }
            
            // Проверяем, нет ли уже такой записи
            const existingIndex = state.history.records[itemId].findIndex(
                (r) => r.timestamp === record.timestamp && r.action === record.action
            );
            
            if (existingIndex === -1) {
                // Проверяем наличие данных автора и создаем новую запись
                const newRecord: HistoryRecord = {
                    ...record,
                    author: record.author ? {
                        photo_url: record.author.photo_url,  // Сохраняем photo_url как есть, даже если null
                        first_name: record.author.first_name
                    } : undefined
                };
                
                // Добавляем новую запись в начало массива
                state.history.records[itemId].unshift(newRecord);
                console.log('✅ Новая запись добавлена в историю:', newRecord);
                console.log('👤 Сохраненные данные автора:', newRecord.author);
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
        // @ts-ignore - Временно игнорируем несоответствие типов между ItemSuggestion и InventoryState.lastSentItemSuggestion
        setLastSentItemSuggestion: (state, action: PayloadAction<ItemSuggestion | null>) => {
            // @ts-ignore - Игнорируем ошибку несоответствия типов
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
                
                // Также обновляем данные в общем списке чатов
                const chatIndex = state.items.findIndex(chat => chat.chat_id === action.payload.chatId);
                if (chatIndex !== -1) {
                    const oldInventory = state.items[chatIndex].inventory;
                    // Создаем обновленный объект чата для списка
                    const updatedChatDataForList = {
                        ...state.items[chatIndex], // Берем старые данные из списка
                        inventory: action.payload.data.inventory,
                        metadata: {
                            ...action.payload.data.metadata,
                            chat_id: action.payload.chatId,
                            progress,
                            lastUpdated: new Date().toISOString()
                        }
                    };
                    // Обновляем чат в списке
                    state.items[chatIndex] = updatedChatDataForList;

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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const user = action.payload;
                // Remove all currentUser references as they are now handled in userSlice
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
                    if (!chat.inventory) {
                        chat.inventory = {};
                    }
                    if (!chat.inventory[category]) {
                        chat.inventory[category] = {};
                    }
                    chat.inventory[category][itemId] = {
                        name: itemId,
                        quantity: 0,
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
            })
            .addCase(selectChat.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(selectChat.fulfilled, (state, action: PayloadAction<ChatInventory>) => {
                state.isLoading = false;
                state.selectedChat = action.payload;
                state.selectedChatId = action.payload.chat_id;
            })
            .addCase(selectChat.rejected, (state) => {
                state.selectedChatId = null;
                state.selectedChat = null;
            });
    }
});

export const { 
    clearSelectedChat, 
    updateInventoryData,
    setSelectedItem,
    setHistoryLoading,
    setHistoryError,
    clearItemHistory,
    receiveHistoryUpdate,
    updateProgress,
    setLastSentItemSuggestion
} = inventorySlice.actions;
export default inventorySlice.reducer;

// <<<--- ДОБАВЛЯЕМ ЭКСПОРТ СЕЛЕКТОРОВ --->>>

// Основные селекторы состояния инвентаря
export const selectInventoryState = (state: RootState) => state.inventory;
export const selectInventoryChats = (state: RootState): ChatInventory[] => state.inventory.items;
export const selectSelectedChatData = (state: RootState): ChatInventory | null => state.inventory.selectedChat;
export const selectSelectedChatId = (state: RootState): string | null => state.inventory.selectedChatId;
export const selectInventoryLoading = (state: RootState): boolean => state.inventory.isLoading;
export const selectInventoryError = (state: RootState): string | null => state.inventory.error;

// Селектор для выбранного товара (если он используется где-то еще)
export const selectSelectedItemData = (state: RootState): InventoryItem | null => state.inventory.selectedItem;

// Селекторы для истории
export const selectHistoryState = (state: RootState) => state.inventory.history;
export const selectHistoryRecordsForItem = (itemId: string) => (state: RootState): HistoryRecord[] => state.inventory.history.records[itemId] || [];
export const selectHistoryLoading = (state: RootState): boolean => state.inventory.history.isLoading;
export const selectHistoryError = (state: RootState): string | null => state.inventory.history.error;

// Селектор для последнего отправленного предложения
// @ts-ignore
export const selectLastSentItemSuggestion = (state: RootState): ItemSuggestion | null => state.inventory.lastSentItemSuggestion;

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

// Пример использования в thunk:
export const someThunk = createAsyncThunk(
    'inventory/someThunk',
    async (_, { getState }) => {
        const state = getState() as RootState;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const user = state.user;
        // Используем user.id, user.isAdmin и т.д.
    }
); 