import { createSlice, createAsyncThunk, PayloadAction, 
  createSelector
} from '@reduxjs/toolkit';
import axios from 'axios';
import type { 
    ChatInventory, 
    InventoryState,
} from '@/types/inventory';
import { WebApp } from '@/types/telegram';
import config from '@/config';
import { api, axiosInstance } from '@/shared/api/api';
import { RootState, AppDispatch } from '@/shared/store/store';
import type {
    Inventory,
    InventoryItem,
    Admin,
    InventoryMetadata,
    InventoryHistoryItem,
    InventoryUpdatePayload as ApiUpdatePayload,
    InventoryData
} from '@/types/inventoryTypes';
import { 
    addCustomInventoryItem as apiAddCustomItem,
    deleteInventoryItem as apiDeleteItem
} from '@/features/Inventory/services/inventoryApi';


const GLOBAL_ROOM_ID = 'global';

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
    type?: string;
    timestamp?: string; // Добавляем timestamp для предотвращения race conditions
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
        try {
            const params: Record<string, any> = { user_id: userId };
            if (role && role !== 'none') {
                params.group_type = role;
            }
            const response = await axiosInstance.get<ChatInventory[]>('/v1/groups/chats', {
                params: params
            });
            return response.data;
        } catch (error: any) {
            const message = error.response?.data?.detail || error.message || 'Не удалось загрузить список чатов';
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
    async (chatId: string, { rejectWithValue }) => {
        try {
            const inventoryResponse = await axiosInstance.get<InventoryData>(`/v1/inventory/${chatId}`);
            const inventoryData = inventoryResponse.data;
            if (!inventoryData) {
                return rejectWithValue('Не получены данные инвентаря от API');
            }
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
            const message = error.response?.data?.detail || error.message || 'Не удалось загрузить инвентарь';
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
        const state = getState();
        const user = state.user.user;
        const userIdToUse = currentUserId ?? user?.id;
        if (!userIdToUse) {
             return rejectWithValue('Не удалось определить пользователя для применения шаблона.');
        }
        try {
            const templateResponse = await axiosInstance.get<Inventory>('/v1/groups/inventory/template');
            const templateData = templateResponse.data;
            if (!templateData || typeof templateData !== 'object' || Object.keys(templateData).length === 0) {
                throw new Error('Пустой или неверный шаблон получен с сервера.');
            }
            const metadata: InventoryMetadata = {
                lastUpdated: new Date().toISOString(),
                progress: 0,
                chat_id: chatId,
            };
            const payloadToSend: ApiUpdatePayload = {
                inventory: templateData,
                metadata: metadata
            };
            await axiosInstance.post<{ success: boolean; message?: string }>(`/v1/groups/inventory/${chatId}`, payloadToSend);
            return { chatId, inventory: templateData, metadata };
        } catch (error: any) {
            const message = error.response?.data?.detail || error.message || 'Не удалось применить шаблон';
            return rejectWithValue(message);
        }
    }
);

interface UpdateInventoryPayload {
    chatId: string;
    category: string;
    itemId: string;
    item: InventoryItem;
    customAction?: string; // Опциональное поле для специальных действий
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
        const { chatId, category, itemId, item, customAction } = payload; 
        if (!itemId) {
            return rejectWithValue('Внутренняя ошибка: не указан ID товара');
        }
        const state = getState();
        const currentUser = state.user.user;
        const currentInventory = state.inventory.selectedChat?.inventory || {};
        const currentItem = currentInventory[category]?.[itemId];
        try {
            // --- Формируем данные для точечного API ---
            const historyPayload = {
                action: (() => {
                    if (customAction) return customAction;
                    const oldQuantity = currentItem?.raw?.quantity || currentItem?.semifinished?.quantity || 0;
                    const newQuantity = item?.raw?.quantity || item?.semifinished?.quantity || 0;
                    if (oldQuantity === 0 && newQuantity > 0) return 'add';
                    if (oldQuantity > 0 && newQuantity === 0) return 'remove';
                    return 'update';
                })(),
                itemType: (() => {
                    const rawChanged = currentItem?.raw?.quantity !== item?.raw?.quantity;
                    const semifinishedChanged = currentItem?.semifinished?.quantity !== item?.semifinished?.quantity;
                    if (rawChanged && !semifinishedChanged) return 'raw';
                    if (semifinishedChanged && !rawChanged) return 'semifinished';
                    if (rawChanged && semifinishedChanged) return 'raw';
                    return item?.raw ? 'raw' : 'semifinished';
                })(),
                oldQuantity: (() => {
                    const rawChanged = currentItem?.raw?.quantity !== item?.raw?.quantity;
                    const semifinishedChanged = currentItem?.semifinished?.quantity !== item?.semifinished?.quantity;
                    if (rawChanged && !semifinishedChanged) return currentItem?.raw?.quantity || 0;
                    if (semifinishedChanged && !rawChanged) return currentItem?.semifinished?.quantity || 0;
                    return currentItem?.raw?.quantity || currentItem?.semifinished?.quantity || 0;
                })(),
                category: category,
                itemName: itemId,
                authorMemberId: currentUser?.id
            };

            const payloadToSend = {
                item: item,
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    progress: 0,
                    chat_id: chatId,
                    currentUser: {
                        id: currentUser?.id,
                        first_name: currentUser?.first_name,
                        photo_url: currentUser?.photo_url
                    }
                },
                history: historyPayload
            };
            // Декодируем параметры чтобы избежать двойного кодирования
            const decodedCategory = decodeURIComponent(category);
            const decodedItemId = decodeURIComponent(itemId);
            const response = await axiosInstance.put(`/v1/inventory/${chatId}/items/${decodedCategory}/${decodedItemId}`, payloadToSend);
            // Ожидаем, что бэкенд вернёт { inventory, metadata, item?, category?, item_id? }
            const data = response.data as any;
            const serverInventory: Inventory = data?.inventory || {
                ...currentInventory,
                [category]: {
                    ...currentInventory[category],
                    [itemId]: item
                }
            };
            return { chatId, inventory: serverInventory };
        } catch (error: any) {
            return rejectWithValue('Не удалось обновить инвентарь');
        }
    }
);

// Новая функция для структурных изменений (без записи в историю)
export const updateInventoryStructure = createAsyncThunk<
    UpdateInventoryResult,
    UpdateInventoryPayload,
     {
      state: RootState;
      rejectValue: string;
    }
>(
    'inventory/updateStructure',
    async (payload, { getState, rejectWithValue }) => {
        const { chatId, category, itemId, item } = payload; 
        if (!itemId) {
            return rejectWithValue('Внутренняя ошибка: не указан ID товара');
        }
        const state = getState();
        const currentUser = state.user.user;
        const currentInventory = state.inventory.selectedChat?.inventory || {};
        try {
            // --- Точечный PUT без истории ---
            const payloadToSend = {
                item: item,
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    progress: 0,
                    chat_id: chatId,
                    currentUser: {
                        id: currentUser?.id,
                        first_name: currentUser?.first_name,
                        photo_url: currentUser?.photo_url
                    }
                }
            };
            // Декодируем параметры чтобы избежать двойного кодирования
            const decodedCategory = decodeURIComponent(category);
            const decodedItemId = decodeURIComponent(itemId);
            await axiosInstance.put(`/v1/inventory/${chatId}/items/${decodedCategory}/${decodedItemId}`, payloadToSend);
            const updatedInventory: Inventory = {
                ...currentInventory,
                [category]: {
                    ...currentInventory[category],
                    [itemId]: item
                }
            };
            return { chatId, inventory: updatedInventory };
        } catch (error: any) {
            return rejectWithValue('Не удалось обновить структуру инвентаря');
        }
    }
);

export const initializeFromTelegram = createAsyncThunk(
    'inventory/initializeFromTelegram',
    async () => {
        const webApp = window.Telegram?.WebApp as WebApp | undefined;
        if (!webApp?.initDataUnsafe?.user?.id) {
            throw new Error('Данные пользователя Telegram недоступны');
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
        try {
            const response = await api.history.getItemHistory(chatId, category, itemName);
            if (!Array.isArray(response)) {
                throw new Error('История должна быть массивом');
            }
            return {
                itemId,
                history: response as InventoryHistoryItem[],
            };
        } catch (error: any) {
            throw new Error('Не удалось загрузить историю товара');
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
                const semiFilled = Boolean(item.semifinished.filled) || (item.semifinished.quantity > 0);
                // Важно: учитываем полуфабрикат в прогрессе только когда он «активен» (есть количество или явно filled)
                if (semiFilled) {
                    totalItems++;
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
        try {
            await apiDeleteItem(chatId, category, itemId);
            return { chatId, category, itemId, success: true };
        } catch (error: any) {
            const message = error.response?.data?.detail || error.message || 'Не удалось удалить товар';
            return rejectWithValue(message);
        }
    }
);

// Функция для глобального удаления товара (для администраторов)
export const removeInventoryItemGlobally = createAsyncThunk<RemoveInventoryItemResult, { chatId: string; category: string; itemId: string }>(
    'inventory/removeInventoryItemGlobally',
    async ({ chatId, category, itemId }) => {
        try {
            await axios.post(`${config.API_URL}/delete_item`, {
                category,
                item: itemId,
                chat_id: chatId,
                updateAllInventories: true
            });
            return { chatId, category, itemId };
        } catch (error: any) {
            throw new Error('Не удалось глобально удалить товар');
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
        try {
            await apiAddCustomItem(chatId, category, itemId, hasSemifinshed);
            return { chatId, category, itemId, success: true };
        } catch (error: any) {
            const message = error.response?.data?.detail || error.message || 'Не удалось добавить товар';
            return rejectWithValue(message);
        }
    }
);

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        // --- Выбор чата ---
        selectChat(state, action: PayloadAction<string>) {
            const chatId = action.payload;
            state.selectedChatId = chatId;
            const foundChat = state.items.find(chat => chat.chat_id === chatId) || null;
            state.selectedChat = foundChat;
            state.selectedItem = null; 
            state.history = initialState.history; 
        },
        // --- Очистка выбранного чата ---
        clearSelectedChat: (state) => {
            state.selectedChatId = null;
            state.selectedChat = null;
            state.selectedItem = null; 
            state.history = initialState.history; 
        },
        // --- Обновление данных инвентаря (частичное/полное) ---
        updateInventoryData(state, action: PayloadAction<UpdateInventoryDataPayload>) {
            const { chatId, data } = action.payload;
            const chatIndex = state.items.findIndex((chat: ChatInventory) => chat.chat_id === chatId); 
            if (chatIndex !== -1) {
                const oldData = state.items[chatIndex];
                if (data.type === 'item_update' && data.category && data.itemId && data.item) {
                    const updatedInventory = JSON.parse(JSON.stringify(oldData.inventory || {}));
                    if (!updatedInventory[data.category]) {
                        updatedInventory[data.category] = {};
                    }
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
                    const updatedChat = {
                        ...oldData,
                        inventory: updatedInventory,
                        metadata: {
                            ...oldData.metadata,
                            lastUpdated: new Date().toISOString(),
                            progress: calculateInventoryProgress(updatedInventory)
                        }
                    };
                    state.items[chatIndex] = updatedChat;
                    if (state.selectedChatId === chatId) {
                        state.selectedChat = updatedChat;
                    }
                } else if (data.inventory) {
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
                    state.items[chatIndex] = updatedChat;
                    if (state.selectedChatId === chatId) {
                        state.selectedChat = updatedChat;
                    }
                }
            }
        },
        // --- Выбор товара ---
        setSelectedItem: (state, action: PayloadAction<InventoryItem | null>) => {
            state.selectedItem = action.payload;
        },
        // --- Флаги загрузки/ошибки истории ---
        setHistoryLoading: (state, action: PayloadAction<boolean>) => {
            state.history.isLoading = action.payload;
        },
        setHistoryError: (state, action: PayloadAction<string | null>) => {
            state.history.error = action.payload;
        },
        // --- Очистка истории ---
        clearItemHistory: (state) => {
            state.history.records = {} as HistoryRecords;
            state.history.lastUpdate = null;
        },
        // --- Обработка обновления истории (WebSocket) ---
        receiveHistoryUpdate: (state, action: PayloadAction<{
            itemId: string;
            record: InventoryHistoryItem;
        }>) => {
            const { itemId, record } = action.payload;
            if (!state.history.records[itemId]) {
                state.history.records[itemId] = [];
            }
            const existingIndex = state.history.records[itemId].findIndex(
                (r) => r.timestamp === record.timestamp && r.action === record.action
            );
            if (existingIndex === -1) {
                const newRecord: InventoryHistoryItem = {
                    ...record,
                    author: record.author 
                };
                state.history.records[itemId].unshift(newRecord);
            }
            state.history.lastUpdate = new Date().toISOString();
        },
        // --- Обновление прогресса ---
        updateProgress: (state) => {
            if (state.selectedChat?.inventory) {
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
                }
            }
        },
        // --- Сохранение последнего предложения товара ---
        setLastSentItemSuggestion: (state, action: PayloadAction<ItemSuggestion | null>) => {
            state.lastSentItemSuggestion = action.payload;
        },
        // --- ID обновляемого товара ---
        setUpdatingItemId: (state, action: PayloadAction<string | null>) => {
            state.isUpdatingItemId = action.payload;
        },
        // --- Частичное обновление из WebSocket ---
        receiveItemUpdate(state, action: PayloadAction<ItemUpdatePayload>) {
            const { chatId, metadata, item_id, category, item, timestamp } = action.payload;
            const messageType = action.payload.type || 'inventory_updated';
            const chatIndex = state.items.findIndex((chat: ChatInventory) => chat.chat_id === chatId); 
            
            if (chatIndex !== -1) {
                let chatState = state.items[chatIndex];
                
                // 🚨 Приоритет сравнения: сначала по версии, потом по времени
                const incomingTimestamp = timestamp || metadata.lastUpdated;
                const currentTimestamp = chatState.metadata?.lastUpdated;
                const incomingVersion = (metadata as any)?.version as number | undefined;
                const currentVersion = (chatState.metadata as any)?.version as number | undefined;

                if (typeof incomingVersion === 'number' && typeof currentVersion === 'number') {
                    if (incomingVersion < currentVersion) {
                        console.warn(`⚠️ [Race Condition] Отклонено устаревшее событие по версии для чата ${chatId}:`, {
                            incomingVersion,
                            currentVersion
                        });
                        return;
                    }
                    console.log(`✅ [WS Update] Принято событие по версии для чата ${chatId}:`, { incomingVersion, currentVersion });
                } else if (currentTimestamp && incomingTimestamp) {
                    // Fallback по времени
                    const incomingTime = new Date(incomingTimestamp).getTime();
                    const currentTime = new Date(currentTimestamp).getTime();
                    if (incomingTime < currentTime) {
                        console.warn(`⚠️ [Race Condition] Отклонено устаревшее обновление для чата ${chatId}:`, {
                            incoming: incomingTimestamp,
                            current: currentTimestamp,
                            diffMs: currentTime - incomingTime
                        });
                        return;
                    }
                    console.log(`✅ [WS Update] Принято новое/равное по времени обновление для чата ${chatId}:`, {
                        incoming: incomingTimestamp,
                        current: currentTimestamp,
                        diffMs: incomingTime - currentTime
                    });
                }
                if (currentTimestamp && incomingTimestamp) {
                    const incomingTime = new Date(incomingTimestamp).getTime();
                    const currentTime = new Date(currentTimestamp).getTime();
                    if (incomingTime < currentTime) {
                        console.warn(`⚠️ [Race Condition] Отклонено устаревшее обновление для чата ${chatId}:`, {
                            incoming: incomingTimestamp,
                            current: currentTimestamp,
                            diffMs: currentTime - incomingTime
                        });
                        return;
                    }
                    console.log(`✅ [WS Update] Принято новое/равное по времени обновление для чата ${chatId}:`, {
                        incoming: incomingTimestamp,
                        current: currentTimestamp,
                        diffMs: incomingTime - currentTime
                    });
                }
                
                // Атомарное обновление метаданных
                chatState.metadata = {
                    ...chatState.metadata,
                    ...metadata,
                    chat_id: chatId,
                    lastUpdated: incomingTimestamp || chatState.metadata.lastUpdated
                };
                
                if (metadata.progress !== undefined) {
                     chatState.metadata.progress = metadata.progress;
                 } else if (chatState.inventory) {
                     chatState.metadata.progress = calculateInventoryProgress(chatState.inventory);
                 }
                 
                if (item_id && category && item) {
                    if (!chatState.inventory) {
                         chatState.inventory = {};
                    }
                    if (!chatState.inventory[category]) {
                        chatState.inventory[category] = {};
                    }
                    
                    // 🚨 УЛУЧШЕННОЕ CONFLICT RESOLUTION для одновременного редактирования
                    const existingItem = chatState.inventory[category][item_id];
                    const itemTimestamp = item.lastUpdated || incomingTimestamp;
                    const existingItemTimestamp = existingItem?.lastUpdated;
                    
                    if (existingItemTimestamp && itemTimestamp) {
                        const itemTime = new Date(itemTimestamp).getTime();
                        const existingTime = new Date(existingItemTimestamp).getTime();
                        // Отклоняем только явно старое обновление
                        if (itemTime < existingTime) {
                            console.info(`🔄 [Concurrent Update] Пропущено устаревшее обновление товара ${category}/${item_id}:`, {
                                incoming: itemTimestamp,
                                existing: existingItemTimestamp,
                                diffMs: existingTime - itemTime
                            });
                            return;
                        }
                        console.info(`🔄 [Concurrent Update] Принято новое/равное обновление товара ${category}/${item_id}:`, {
                            incoming: itemTimestamp,
                            existing: existingItemTimestamp,
                            diffMs: itemTime - existingTime
                        });
                    }
                    
                    // Добавляем timestamp к товару если его нет
                    chatState.inventory[category][item_id] = {
                        ...item,
                        lastUpdated: itemTimestamp
                    };
                    chatState.metadata.progress = calculateInventoryProgress(chatState.inventory);
                }
                else if (messageType === 'inventory_reset') {
                    if (chatState.inventory) {
                        Object.values(chatState.inventory).forEach(categoryItems => {
                            if (typeof categoryItems === 'object' && categoryItems !== null) {
                                Object.values(categoryItems).forEach(itemData => {
                                    if (typeof itemData === 'object' && itemData !== null) {
                                        if (itemData.raw && typeof itemData.raw === 'object') {
                                            itemData.raw.quantity = 0;
                                            itemData.raw.filled = false;
                                            itemData.raw.isOutOfStock = false;
                                        }
                                        if (itemData.semifinished && typeof itemData.semifinished === 'object') {
                                            itemData.semifinished.quantity = 0;
                                            itemData.semifinished.filled = false;
                                        }
                                    }
                                });
                            }
                        });
                    }
                }
                else {
                    // 🔧 ИСПРАВЛЕНИЕ: Если нет данных конкретного товара, но есть метаданные,
                    // это означает, что нужно перезагрузить весь инвентарь
                    console.log(`🔄 [WS Update] Получены только метаданные для чата ${chatId}, требуется перезагрузка инвентаря`);
                    // Не обновляем inventory здесь - это сделает компонент через useEffect
                }
                
                // Обновляем selectedChat если это текущий чат
                if (state.selectedChatId === chatId) {
                    state.selectedChat = { ...chatState };
                    if (item_id && category && item) {
                        const itemTimestamp = item.lastUpdated || incomingTimestamp;
                        console.log(`✅ [WS Update] Обновлен товар в UI: ${category}/${item_id}`, {
                            quantity: item.raw?.quantity || item.semifinished?.quantity,
                            timestamp: itemTimestamp
                        });
                    } else {
                        console.log(`🔄 [WS Update] Обновлены только метаданные для чата ${chatId}, требуется перезагрузка`);
                    }
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchInventory.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchInventory.fulfilled, (state, action) => {
                state.isLoading = false;
                state.items = action.payload.map(chat => ({
                    ...chat,
                    chat_title: chat.chat_title || chat.title || 'Без названия',
                    metadata: {
                        ...(chat.metadata || {}),
                        chat_id: chat.chat_id
                    }
                }));
            })
            .addCase(fetchInventory.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Не удалось загрузить инвентарь';
            })
            .addCase(fetchChatInventory.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchChatInventory.fulfilled, (state, action: PayloadAction<InventoryData & { chatId: string }>) => {
                const { chatId, inventory, metadata, chat_title, admins } = action.payload;
                const calculatedProgress = calculateInventoryProgress(inventory);
                const chatIndex = state.items.findIndex(chat => chat.chat_id === chatId);
                const finalMetadata: InventoryMetadata = { 
                    ...metadata,
                    progress: calculatedProgress,
                    chat_id: chatId
                };
                if (chatIndex !== -1) {
                    const existingChat = state.items[chatIndex];
                    state.items[chatIndex] = {
                        ...existingChat, 
                        chat_id: chatId,
                        chat_title: chat_title || existingChat.chat_title, 
                        inventory: inventory,
                        metadata: finalMetadata,
                        admins: admins,
                        members: existingChat.members
                    };
                     state.selectedChat = state.items[chatIndex];
                } else {
                    const newChat: ChatInventory = {
                        chat_id: chatId,
                        chat_title: chat_title || `Чат ${chatId}`, 
                        inventory: inventory,
                        metadata: finalMetadata,
                        admins: admins,
                        members: [], 
                    };
                    state.items.push(newChat);
                    state.selectedChat = state.items[state.items.length - 1]; 
                }
                state.selectedChatId = chatId; 
                state.isLoading = false;
                state.error = null;
            })
            .addCase(fetchChatInventory.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload || 'Не удалось загрузить инвентарь чата';
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
            })
            .addCase(updateInventoryStructure.pending, (state, action) => {
                if (action.meta.arg.itemId) { 
                    state.isUpdatingItemId = action.meta.arg.itemId;
                }
            })
            .addCase(updateInventoryStructure.fulfilled, (state, action) => {
                const { chatId, inventory } = action.payload;
                const chat = state.items.find(item => item.chat_id === chatId);
                if (chat) {
                    chat.inventory = inventory;
                    if (state.selectedChat?.chat_id === chatId) {
                        state.selectedChat = chat;
                    }
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
            .addCase(updateInventoryStructure.rejected, (state, action) => {
                state.isUpdatingItemId = null;
            })
            .addCase(initializeFromTelegram.fulfilled, (state, action) => {
                // ...
            })
            .addCase(initializeFromTelegram.rejected, (state, action) => {
                state.error = 'Не удалось инициализировать пользователя из Telegram';
            })
            .addCase(fetchItemHistory.pending, (state, action) => {
                if (!action.meta.arg.background) {
                    state.history.isLoading = true;
                }
                state.history.error = null;
            })
            .addCase(fetchItemHistory.fulfilled, (state, action) => {
                const { itemId, history } = action.payload;
                state.history.records[itemId] = history;
                state.history.isLoading = false;
                state.history.lastUpdate = new Date().toISOString();
                state.history.error = null;
            })
            .addCase(fetchItemHistory.rejected, (state, action) => {
                state.history.isLoading = false;
                state.history.error = 'Не удалось загрузить историю товара';
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
                // ...
            })
            .addCase(applyInventoryTemplate.fulfilled, (state, action) => {
                const { chatId, inventory, metadata } = action.payload;
                const chatIndex = state.items.findIndex(chat => chat.chat_id === chatId);
                if (chatIndex !== -1) {
                    state.items[chatIndex].inventory = inventory;
                    state.items[chatIndex].metadata = { ...metadata, chat_id: chatId }; 
                    if (state.selectedChatId === chatId) {
                        state.selectedChat = state.items[chatIndex];
                        state.selectedItem = null; 
                    }
                }
            })
            .addCase(applyInventoryTemplate.rejected, (state, action) => {
                // ...
            })
            .addCase(addInventoryItem.rejected, (state, action) => {
                state.error = action.error.message || "Не удалось добавить товар";
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

export const selectInventoryState = (state: RootState) => state.inventory;
export const selectInventoryChats = (state: RootState): ChatInventory[] => state.inventory?.items || [];
export const selectSelectedChat = createSelector(
    [selectInventoryState],
    (inventory): ChatInventory | null => inventory?.selectedChat || null
);
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
export const selectLastSentItemSuggestion = (state: RootState): ItemSuggestion | null => state.inventory?.lastSentItemSuggestion || null;
export const selectIsUpdatingItemId = (state: RootState): string | null => state.inventory.isUpdatingItemId;

export default inventorySlice.reducer; 