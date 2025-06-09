import {
    Inventory,
    InventoryItem,
    Admin,
    InventoryMetadata,
    InventoryHistoryItem
} from './inventoryTypes';

// Интерфейс для элемента чата в стейте inventorySlice
export interface ChatInventory {
    chat_id: string;
    chat_title: string;
    title?: string;
    admins: Admin[];
    members: Array<{
        user_id: number;
        first_name: string;
        photo_url?: string;
    }>;
    inventory: Inventory;
    metadata: InventoryMetadata;
}

// Обновляем HistoryState для использования InventoryHistoryItem
export interface HistoryState {
    records: { [itemId: string]: InventoryHistoryItem[] };
    isLoading: boolean;
    error: string | null;
    lastUpdate: string | null;
}

// Обновляем InventoryState
export interface InventoryState {
    items: ChatInventory[];
    categories: any[];
    selectedChatId: string | null;
    selectedChat: ChatInventory | null;
    selectedItem: InventoryItem | null;
    isLoading: boolean;
    error: string | null;
    history: HistoryState;
    lastSentItemSuggestion: any | null;
    isUpdatingItemId: string | null;
}

// Action Types
export enum InventoryActionTypes {
    FETCH_INVENTORY = 'inventory/fetchInventory',
    UPDATE_INVENTORY = 'inventory/updateItem',
    SELECT_CHAT = 'inventory/selectChat',
    CLEAR_SELECTED_CHAT = 'inventory/clearSelectedChat',
    SET_CURRENT_USER = 'inventory/setCurrentUser',
    CHECK_ADMIN_RIGHTS = 'inventory/checkAdminRights',
    FETCH_ITEM_HISTORY = 'inventory/fetchItemHistory',
    FETCH_ITEM_HISTORY_SUCCESS = 'inventory/fetchItemHistorySuccess',
    FETCH_ITEM_HISTORY_ERROR = 'inventory/fetchItemHistoryError',
    UPDATE_ITEM_HISTORY = 'inventory/updateItemHistory',
    CLEAR_ITEM_HISTORY = 'inventory/clearItemHistory',
    SET_HISTORY_LOADING = 'inventory/setHistoryLoading',
    RECEIVE_HISTORY_UPDATE = 'inventory/receiveHistoryUpdate'
}