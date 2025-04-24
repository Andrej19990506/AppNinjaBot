import { createSlice, createAsyncThunk, PayloadAction, 
  createSelector
} from '@reduxjs/toolkit';
import axios from 'axios';
import type { 
    ChatInventory, 
    InventoryState,
} from '../../types/inventory';
import { WebApp } from '../../types/telegram';
import config from '../../config';
import { api, axiosInstance } from '../../services/api';
import { socketService } from '../../services/socket';
import { RootState, AppDispatch } from '../store';
import type {
    Inventory,
    InventoryItem,
    Admin,
    InventoryMetadata,
    InventoryHistoryItem,
    InventoryUpdatePayload as ApiUpdatePayload,
    InventoryData
} from '../../types/inventoryTypes';
import { 
    addCustomInventoryItem as apiAddCustomItem,
    deleteInventoryItem as apiDeleteItem
} from '../../services/inventoryApi';

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
    [key: string]: InventoryHistoryItem[];
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

// Определяем интерфейс для данных из WebSocket
interface ItemUpdatePayload {
    chatId: string;
    metadata: InventoryMetadata;
    // Опциональные поля для конкретного товара
    item_id?: string;
    category?: string;
    item?: InventoryItem; 
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
    lastSentItemSuggestion: null,
    isUpdatingItemId: null
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
            const response = await axiosInstance.get<ChatInventory[]>('/api/v1/groups/chats', {
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

export const fetchChatInventory = createAsyncThunk<
    InventoryData & { chatId: string },
    string,
    {
      state: RootState;
      rejectValue: string;
    }
>(
    'inventory/fetchChatInventory',
    async (chatId: string, { getState, rejectWithValue }) => {
        console.log(`[fetchChatInventory] Запрос инвентаря для чата ${chatId}`);
        const state = getState();
        try {
            const inventoryResponse = await axiosInstance.get<InventoryData>(`/api/v1/inventory/${chatId}`);
            const inventoryData = inventoryResponse.data;
            if (!inventoryData) {
                return rejectWithValue('Не получены данные инвентаря от API');
            }
            console.log(`[fetchChatInventory] Ответ от бэка для чата ${chatId}:`, inventoryData);

            return {
                chatId,
                inventory: inventoryData.inventory || {},
                metadata: {
                    lastUpdated: inventoryData.metadata?.lastUpdated || new Date().toISOString(),
                    progress: inventoryData.metadata?.progress || 0,
                    chat_id: chatId
                },
                chat_title: inventoryData.chat_title || chatId,
                admins: inventoryData.admins || []
            };
        } catch (error: any) {
            console.error(`[fetchChatInventory] Ошибка при загрузке инвентаря для чата ${chatId}:`, error);
            const message = error.response?.data?.detail || error.message || 'Неизвестная ошибка загрузки инвентаря';
            return rejectWithValue(message);
        }
    }
);

export const applyInventoryTemplate = createAsyncThunk<
    { chatId: string; inventory: Inventory; metadata: InventoryMetadata },
    { chatId: string; currentUserId?: number | null },
    {
      state: RootState;
      rejectValue: string;
      dispatch: AppDispatch;
    }
>(
    'inventory/applyInventoryTemplate',
    async ({ chatId, currentUserId }, { rejectWithValue, getState }) => {
        console.log(`[applyInventoryTemplate] Попытка применить шаблон для чата ${chatId}`);
        const state = getState();
        const user = state.user.user;

        const userIdToUse = currentUserId ?? user?.id;
        if (!userIdToUse) {
             console.error('[applyInventoryTemplate] Нет ID пользователя для добавления в метаданные.');
             return rejectWithValue('Не удалось определить пользователя для применения шаблона.');
        }
        const userNameToUse = user?.first_name ?? 'Система';

        try {
            console.log('[applyInventoryTemplate] Загрузка шаблона с GET /api/v1/groups/inventory/template...');
            const templateResponse = await axiosInstance.get<Inventory>('/api/v1/groups/inventory/template');
            const templateData = templateResponse.data;

            if (!templateData || typeof templateData !== 'object' || Object.keys(templateData).length === 0) {
                console.error('[applyInventoryTemplate] Получен пустой или неверный шаблон:', templateData);
                throw new Error('Пустой или неверный шаблон получен с сервера.');
            }
            console.log('[applyInventoryTemplate] Шаблон успешно загружен:', templateData);

            const metadata: InventoryMetadata = {
                lastUpdated: new Date().toISOString(),
                progress: 0,
                chat_id: chatId,
            };
            const payloadToSend: ApiUpdatePayload = {
                inventory: templateData,
                metadata: metadata
            };

            console.log(`[applyInventoryTemplate] Отправка шаблона на POST /api/v1/groups/inventory/${chatId}...`);
            await axiosInstance.post<{ success: boolean; message?: string }>(`/api/v1/groups/inventory/${chatId}`, payloadToSend);
            console.log(`[applyInventoryTemplate] Шаблон успешно отправлен на бэк для чата ${chatId}`);

            return { chatId, inventory: templateData, metadata };
        } catch (error: any) {
            const message = error.response?.data?.detail || error.message || 'Не удалось применить шаблон';
            console.error(`[applyInventoryTemplate] Ошибка при применении шаблона для чата ${chatId}:`, error);
            return rejectWithValue(message);
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

export const updateInventoryItem = createAsyncThunk<
    UpdateInventoryResult,
    UpdateInventoryPayload,
     {
      state: RootState;
      rejectValue: string;
    }
>(
    InventoryActionTypes.UPDATE_INVENTORY,
    async (payload, { getState, rejectWithValue }) => {
        const { chatId, category, itemId, item } = payload; 
        
        if (!itemId) {
            console.error('❌ updateInventoryItem: itemId is missing or invalid!', payload);
            return rejectWithValue('Internal error: Item ID is missing');
        }

        const state = getState();
        const currentUser = state.user.user;
        const selectedChat = state.inventory.selectedChat;
        const currentInventory = state.inventory.selectedChat?.inventory || {};
        const currentItem = currentInventory[category]?.[itemId];
        
        // Логика запроса к API
        try {
            // Create updated inventory with proper typing
            const updatedInventory: Inventory = {
                ...currentInventory,
                [category]: {
                    ...currentInventory[category],
                    [itemId]: item
                }
            };

            // Determine change type for logging
            let actionType = '';
            let oldQuantity = 0;
            let newQuantity = 0;
            let itemType = 'raw';

            if (!currentItem?.semifinished && item?.semifinished) {
                actionType = 'добавлен полуфабрикат';
                itemType = 'semifinished';
                oldQuantity = 0;
                newQuantity = item.semifinished.quantity || 0;
            } else if (currentItem?.semifinished && !item?.semifinished) {
                actionType = 'удален полуфабрикат';
                itemType = 'semifinished';
                oldQuantity = currentItem.semifinished?.quantity || 0;
                newQuantity = 0;
            } else if (currentItem?.raw?.quantity !== item?.raw?.quantity) {
                actionType = 'изменено количество сырья';
                itemType = 'raw';
                oldQuantity = currentItem?.raw?.quantity || 0;
                newQuantity = item?.raw?.quantity || 0;
            } else if (currentItem?.semifinished?.quantity !== item?.semifinished?.quantity) {
                actionType = 'изменено количество полуфабриката';
                itemType = 'semifinished';
                oldQuantity = currentItem?.semifinished?.quantity || 0;
                newQuantity = item?.semifinished?.quantity || 0;
            }

            // Log the change
            console.log(`Inventory change: ${actionType}`, {
                chatId,
                category,
                itemId,
                itemType,
                oldQuantity,
                newQuantity
            });

            // Prepare data for API
            const inventoryData = {
                inventory: updatedInventory,
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    progress: 0, // TODO: Рассчитать и передать актуальный прогресс?
                    chat_id: chatId,
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
                    category: category,
                    itemName: itemId, // Убедимся, что имя товара передается
                    userId: currentUser?.id // Добавляем ID пользователя в историю
                }
            };

            console.log('📤 Sending data to server via axiosInstance:', inventoryData);

            const response = await axiosInstance.post(`/api/v1/inventory/${chatId}`, inventoryData);
            console.log(`✅ ${actionType} successfully saved:`, response.data);
            
            return {
                chatId,
                inventory: updatedInventory
            };
        } catch (error: any) {
            console.error('❌ Ошибка при обновлении инвентаря:', error);
            return rejectWithValue('Failed to update inventory');
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
    async ({ chatId, itemId, category, itemName, background }: {
        chatId: string;
        itemId: string;
        category: string;
        itemName: string;
        background?: boolean;
    }) => {
        console.log(`📚 Начало ${background ? 'фоновой' : 'активной'} загрузки истории:`, {
            chatId,
            itemId,
            category,
            itemName,
            timestamp: new Date().toISOString()
        });

        try {
            const response = await api.history.getItemHistory(chatId, category, itemName);
            console.log('✅ История успешно загружена:', {
                recordsCount: response.length,
                firstRecord: response[0],
                lastRecord: response[response.length - 1],
                allRecords: response
            });
            
            if (!Array.isArray(response)) {
                console.error('❌ Неверный формат данных:', response);
                throw new Error('История должна быть массивом');
            }

            return {
                itemId,
                history: response as InventoryHistoryItem[],
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

export const removeInventoryItem = createAsyncThunk<
    { chatId: string; category: string; itemId: string; success: boolean },
    { chatId: string; category: string; itemId: string },
    { rejectValue: string }
>(
    InventoryActionTypes.REMOVE_INVENTORY_ITEM,
    async ({ chatId, category, itemId }, { rejectWithValue }) => {
        console.log(`[removeInventoryItem] Deleting item ${itemId} from category ${category} for chat ${chatId}`);
        try {
            // Вызываем новую функцию API
            await apiDeleteItem(chatId, category, itemId);
            console.log(`[removeInventoryItem] API call successful for deleting ${itemId}`);
            // Возвращаем данные для возможной обработки (хотя обновление UI придет через WS)
            return { chatId, category, itemId, success: true };
        } catch (error: any) {
            console.error(`[removeInventoryItem] Error calling API to delete item ${itemId}:`, error);
            const message = error.response?.data?.detail || error.message || 'Failed to delete item';
            return rejectWithValue(message);
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

export const addInventoryItem = createAsyncThunk<
    { chatId: string; category: string; itemId: string; success: boolean },
    { chatId: string; category: string; itemId: string; hasSemifinshed: boolean },
    { rejectValue: string }
>(
    InventoryActionTypes.ADD_INVENTORY_ITEM,
    async ({ chatId, category, itemId, hasSemifinshed }, { rejectWithValue }) => {
        console.log(`[addInventoryItem] Adding item definition ${itemId} (semifinished: ${hasSemifinshed}) to category ${category} for chat ${chatId}`);
        try {
            // Вызываем новую функцию API
            await apiAddCustomItem(chatId, category, itemId, hasSemifinshed);
            console.log(`[addInventoryItem] API call successful for adding ${itemId}`);
            // Возвращаем данные для возможной обработки (хотя обновление UI придет через WS)
            return { chatId, category, itemId, success: true };
        } catch (error: any) {
            console.error(`[addInventoryItem] Error calling API to add item ${itemId}:`, error);
            const message = error.response?.data?.detail || error.message || 'Failed to add item definition';
            return rejectWithValue(message);
        }
    }
);

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        selectChat(state, action: PayloadAction<string>) {
            const chatId = action.payload;
            state.selectedChatId = chatId;
            const foundChat = state.items.find(chat => chat.chat_id === chatId) || null;
            state.selectedChat = foundChat;
            // Сбрасываем выбранный товар при смене чата
            state.selectedItem = null; 
            // Сбрасываем историю при смене чата
            state.history = initialState.history; 
            console.log(`🎯 [Reducer] Выбран чат: ${chatId}`);
            if (foundChat) {
                 console.log('💬 [Reducer] Данные выбранного чата установлены.');
            } else {
                 console.warn('⚠️ [Reducer] Выбранный чат не найден в списке items!');
            }
        },
        clearSelectedChat: (state) => {
            state.selectedChatId = null;
            state.selectedChat = null;
            state.selectedItem = null; 
            state.history = initialState.history; 
            console.log('🧹 Выбранный чат очищен');
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
            record: InventoryHistoryItem;
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
                const newRecord: InventoryHistoryItem = {
                    ...record,
                    author: record.author 
                };
                
                // Добавляем новую запись в начало массива
                state.history.records[itemId].unshift(newRecord);
                console.log('✅ Новая запись добавлена в историю:', newRecord);
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
        },
        // Новый редьюсер для установки/сброса ID обновляемого товара
        setUpdatingItemId: (state, action: PayloadAction<string | null>) => {
            state.isUpdatingItemId = action.payload;
        },
        // --- НОВЫЙ РЕДЬЮСЕР для частичного обновления из WebSocket ---
        receiveItemUpdate(state, action: PayloadAction<ItemUpdatePayload>) {
            const { chatId, metadata, item_id, category, item } = action.payload;
            console.log(`[Reducer] Получено обновление из WebSocket для чата ${chatId}`, 
                item_id ? `(Товар: ${category}/${item_id})` : '(Только метаданные)');

            const chatIndex = state.items.findIndex((chat: ChatInventory) => chat.chat_id === chatId); 

            if (chatIndex !== -1) {
                let chatState = state.items[chatIndex];
                
                // 1. Обновляем метаданные
                chatState.metadata = {
                    ...chatState.metadata,
                    ...metadata,
                    chat_id: chatId // Гарантируем chat_id
                };
                // Пересчитываем прогресс на основе метаданных, если нужно
                if (metadata.progress !== undefined) {
                     chatState.metadata.progress = metadata.progress;
                 } else if (chatState.inventory) { // Или пересчитываем по инвентарю
                     chatState.metadata.progress = calculateInventoryProgress(chatState.inventory);
                 }

                // 2. Если пришел обновленный товар, обновляем его
                if (item_id && category && item) {
                    if (!chatState.inventory) {
                         chatState.inventory = {}; // Инициализируем, если нужно
                    }
                    if (!chatState.inventory[category]) {
                        chatState.inventory[category] = {}; // Инициализируем категорию
                    }
                    chatState.inventory[category][item_id] = item; // Обновляем товар
                    console.log(`[Reducer] Товар ${category}/${item_id} обновлен в стейте.`);
                }

                // 3. Обновляем выбранный чат, если он совпадает
                if (state.selectedChatId === chatId) {
                    state.selectedChat = { ...chatState }; // Обновляем копию
                    // Обновляем категории, если инвентарь мог измениться
                    if (item_id && category && item) {
                        state.categories = chatState.inventory ? Object.keys(chatState.inventory) : [];
                        // Обновляем selectedItem, если обновлялся именно он
                        if (state.selectedItem?.name === item_id) { 
                            state.selectedItem = item;
                        }
                    }
                }
                console.log(`[Reducer] Стейт для чата ${chatId} обновлен.`);
            } else {
                console.warn(`[Reducer] Чат ${chatId} не найден для обновления из WebSocket.`);
            }
        },
        // --- КОНЕЦ НОВОГО РЕДЬЮСЕРА ---
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
                    // Log the first chat details from API response for inspection
                    if (action.payload.length > 0) {
                        console.log('🔍 Детали первого чата из ответа /chats API:', JSON.stringify(action.payload[0], null, 2));
                    }
                }
                state.isLoading = false;
                
                // Просто сохраняем данные как есть от API
                // Убедимся, что chat_id есть в metadata у каждого чата
                state.items = action.payload.map(chat => ({
                    ...chat,
                    metadata: {
                        ...(chat.metadata || {}),
                        chat_id: chat.chat_id // Гарантируем наличие chat_id
                    }
                }));
            })
            .addCase(fetchInventory.rejected, (state, action) => {
                if (process.env.NODE_ENV === 'development') {
                    console.error('❌ Ошибка загрузки списка чатов:', action.error);
                }
                state.isLoading = false;
                state.error = action.error.message || 'Failed to fetch inventory';
            })
            .addCase(fetchChatInventory.pending, (state) => {
                state.isLoading = true; // Возможно, лучше отдельный флаг для загрузки конкретного чата?
                state.error = null;
                console.log('⏳ Загрузка инвентаря чата...');
            })
            .addCase(fetchChatInventory.fulfilled, (state, action: PayloadAction<InventoryData & { chatId: string }>) => {
                const { chatId, inventory, metadata, chat_title, admins } = action.payload;
                console.log(`🔍 Redux Debug - Обработка успешного ответа fetchChatInventory:`, {
                    timestamp: new Date().toISOString(),
                    chatId,
                    inventoryKeys: inventory ? Object.keys(inventory) : [],
                    metadata,
                    adminsCount: admins?.length ?? 0,
                });

                // Recalculate progress based on the received inventory data
                const calculatedProgress = calculateInventoryProgress(inventory);
                console.log(`📊 Progress recalculated on fetch: ${calculatedProgress}%`);

                const chatIndex = state.items.findIndex(chat => chat.chat_id === chatId);

                // Prepare the metadata object, ensuring progress is the recalculated one
                const finalMetadata: InventoryMetadata = { 
                    ...metadata, // Take other metadata from response (like lastUpdated)
                    progress: calculatedProgress, // Use the recalculated progress
                    chat_id: chatId // Ensure chat_id is present
                };

                if (chatIndex !== -1) {
                    // Chat found, update it
                    const existingChat = state.items[chatIndex];
                    console.log(`🔍 Redux Debug - Обновление инвентаря в списке чатов:`, {
                        chatId,
                        chatIndex,
                        oldInventoryKeys: existingChat.inventory ? Object.keys(existingChat.inventory) : [],
                        newInventoryKeys: inventory ? Object.keys(inventory) : [],
                        changed: JSON.stringify(existingChat.inventory) !== JSON.stringify(inventory)
                              || JSON.stringify(existingChat.metadata) !== JSON.stringify(metadata)
                              || JSON.stringify(existingChat.admins) !== JSON.stringify(admins),
                        oldMetadata: existingChat.metadata,
                        newMetadata: metadata,
                    });

                    state.items[chatIndex] = {
                        ...existingChat, 
                        chat_id: chatId,
                        chat_title: chat_title || existingChat.chat_title, 
                        inventory: inventory,
                        metadata: finalMetadata, // Use finalMetadata with calculated progress
                        admins: admins,
                        members: existingChat.members
                    };
                     state.selectedChat = state.items[chatIndex];
                } else {
                    // Chat NOT found, add it to the list
                    console.warn(`[fetchChatInventory.fulfilled] Чат ${chatId} не найден в списке items. Добавляем...`);
                    const newChat: ChatInventory = {
                        chat_id: chatId,
                        chat_title: chat_title || `Чат ${chatId}`, 
                        inventory: inventory,
                        metadata: finalMetadata, // Use finalMetadata with calculated progress
                        admins: admins,
                        members: [], 
                    };
                    state.items.push(newChat);
                    state.selectedChat = state.items[state.items.length - 1]; 
                }

                state.selectedChatId = chatId; 
                state.isLoading = false;
                state.error = null;
                 console.log(`[fetchChatInventory.fulfilled] Обновлен state.selectedChat и selectedChatId для chatId: ${chatId}`);
            })
            .addCase(fetchChatInventory.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload || 'Failed to fetch chat inventory';
                console.error('[fetchChatInventory.rejected] Ошибка:', state.error);
                // Clear selected chat if loading failed?
                // state.selectedChat = null;
                // state.selectedChatId = null;
            })
            .addCase(updateInventoryItem.pending, (state, action) => {
                if (action.meta.arg.itemId) { 
                    state.isUpdatingItemId = action.meta.arg.itemId;
                }
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
                state.isUpdatingItemId = null;
            })
            .addCase(updateInventoryItem.rejected, (state, action) => {
                state.isUpdatingItemId = null;
                console.error('Update item failed:', action.error);
            })
            .addCase(initializeFromTelegram.fulfilled, (state, action) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const user = action.payload;
                // Remove all currentUser references as they are now handled in userSlice
            })
            .addCase(initializeFromTelegram.rejected, (state, action) => {
                state.error = 'Failed to initialize user from Telegram';
            })
            .addCase(fetchItemHistory.pending, (state, action) => {
                // Проверяем флаг background
                if (!action.meta.arg.background) {
                    // Только если это НЕ фоновая загрузка, ставим isLoading
                    console.log('⏳ Начало АКТИВНОЙ загрузки истории...');
                    state.history.isLoading = true;
                } else {
                    // Если фоновая, просто логируем, isLoading не трогаем
                    console.log('⏳ Начало ФОНОВОЙ загрузки истории...');
                }
                state.history.error = null; // Ошибку сбрасываем в любом случае
            })
            .addCase(fetchItemHistory.fulfilled, (state, action) => {
                const { itemId, history } = action.payload;
                // Не важно, фоновая или активная, результат сохраняем одинаково
                console.log('✅ История успешно сохранена в store:', {
                    itemId,
                    recordsCount: history.length,
                    timestamp: new Date().toISOString()
                });
                state.history.records[itemId] = history;
                state.history.isLoading = false; // Сбрасываем isLoading в любом случае
                state.history.lastUpdate = new Date().toISOString();
                state.history.error = null; // Сбрасываем ошибку
            })
            .addCase(fetchItemHistory.rejected, (state, action) => {
                // Не важно, фоновая или активная, ошибку обрабатываем одинаково
                console.error('❌ Ошибка при сохранении истории:', {
                    error: action.error.message,
                    timestamp: new Date().toISOString()
                });
                state.history.isLoading = false; // Сбрасываем isLoading в любом случае
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
                        raw: { 
                            quantity: 0, 
                            filled: false,
                            isOutOfStock: false
                        },
                        itemType: 'raw'
                    };
                    if (state.selectedChat?.chat_id === chatId) {
                        state.selectedChat = chat;
                    }
                }
            })
            .addCase(applyInventoryTemplate.pending, (state, action) => {
                // ... существующий код обработчика pending ...
            })
            .addCase(applyInventoryTemplate.fulfilled, (state, action) => {
                const { chatId, inventory, metadata } = action.payload;
                const chatIndex = state.items.findIndex(chat => chat.chat_id === chatId);
                console.log(`[applyInventoryTemplate.fulfilled] Шаблон успешно применен для чата ${chatId}`);

                if (chatIndex !== -1) {
                    state.items[chatIndex].inventory = inventory;
                    // УБЕДИМСЯ, что chat_id есть в metadata
                    state.items[chatIndex].metadata = { ...metadata, chat_id: chatId }; 
                    // state.items[chatIndex].isApplyingTemplate = false; // Сбрасываем флаг
                    // Обновляем selectedChat, если он совпадает
                    if (state.selectedChatId === chatId) {
                        state.selectedChat = state.items[chatIndex];
                        // Если был выбран item, сбрасываем его, т.к. инвентарь обновился
                        state.selectedItem = null; 
                    }
                } else {
                    console.warn(`[applyInventoryTemplate.fulfilled] Чат ${chatId} не найден в списке items после применения шаблона.`);
                }
            })
            .addCase(applyInventoryTemplate.rejected, (state, action) => {
                // ... существующий код обработчика rejected ...
            })
            .addCase(addInventoryItem.rejected, (state, action) => {
                // Добавим обработку ошибки для addInventoryItem
                console.error("Add inventory item failed:", action.error);
                state.error = action.error.message || "Failed to add inventory item";
            });
    }
});

export const { 
    selectChat, 
    clearSelectedChat, 
    updateInventoryData,
    setSelectedItem,
    setHistoryLoading,
    setHistoryError,
    clearItemHistory,
    receiveHistoryUpdate,
    updateProgress,
    setLastSentItemSuggestion,
    setUpdatingItemId,
    receiveItemUpdate
} = inventorySlice.actions;

// <<<--- РАСКОММЕНТИРОВЫВАЕМ ЭКСПОРТ СЕЛЕКТОРОВ --->>>

export const selectInventoryState = (state: RootState) => state.inventory;
export const selectInventoryChats = (state: RootState): ChatInventory[] => state.inventory?.items || [];
const selectSelectedChat = (state: RootState): ChatInventory | null => state.inventory?.selectedChat || null;
export const selectSelectedChatId = (state: RootState): string | null => state.inventory?.selectedChatId || null;
export const selectInventoryLoading = (state: RootState): boolean => state.inventory?.isLoading || false;
export const selectInventoryError = (state: RootState): string | null => state.inventory?.error || null;
export const selectSelectedItemData = (state: RootState): InventoryItem | null => state.inventory?.selectedItem || null;
export const selectCategoriesForSelectedChat = createSelector(
    [selectSelectedChat],
    (selectedChat): string[] => {
        const inventory = selectedChat?.inventory;
        if (inventory && typeof inventory === 'object') {
            const keys = Object.keys(inventory);
            return keys;
        }
        return [];
    }
);
export const selectHistoryState = (state: RootState) => state.inventory?.history || { records: {}, lastUpdate: null, isLoading: false, error: null };
export const selectHistoryRecordsForItem = (itemId: string) => (state: RootState): InventoryHistoryItem[] => state.inventory?.history?.records?.[itemId] || [];
export const selectHistoryLoading = (state: RootState): boolean => state.inventory?.history?.isLoading || false;
export const selectHistoryError = (state: RootState): string | null => state.inventory?.history?.error || null;
// @ts-ignore
export const selectLastSentItemSuggestion = (state: RootState): ItemSuggestion | null => state.inventory?.lastSentItemSuggestion || null;

// Добавляем новый селектор
export const selectIsUpdatingItemId = (state: RootState): string | null => state.inventory.isUpdatingItemId;

// ... остальной код ...

export default inventorySlice.reducer; 