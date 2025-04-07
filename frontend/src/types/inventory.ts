export interface InventoryMetadata {
    lastUpdated: string;
    progress: number;
    chat_id: string;
}

export interface InventoryItemData {
    quantity: number;
    filled: boolean;
    isOutOfStock?: boolean;
    name?: string;
    description?: string;
}

export interface InventoryItem {
    name: string;
    quantity: number;
    unit?: string;
    lowStockThreshold?: number;
    raw?: {
        quantity: number;
        filled: boolean;
        isOutOfStock: boolean;
    };
    semifinished?: {
        quantity: number;
        filled: boolean;
    };
}

export interface InventoryCategory {
    [itemName: string]: InventoryItem;
}

export interface Inventory {
    [category: string]: {
        [itemId: string]: InventoryItem;
    };
}

export interface Admin {
    user_id: number;
    first_name: string;
    photo_url?: string;
    status?: 'creator' | 'administrator' | 'member' | string;
    is_bot?: boolean;
    can_manage_chat?: boolean;
    can_delete_messages?: boolean;
    can_manage_voice_chats?: boolean;
    can_restrict_members?: boolean;
    can_promote_members?: boolean;
    can_change_info?: boolean;
    can_invite_users?: boolean;
    can_pin_messages?: boolean;
}

export interface ChatInventory {
    chat_id: string;
    chat_title: string;
    admins: Admin[];
    members: Array<{
        user_id: number;
        first_name: string;
        photo_url?: string;
    }>;
    inventory: {
        [category: string]: {
            [itemId: string]: InventoryItem;
        };
    };
    metadata: {
        lastUpdated: string;
        progress: number;
        chat_id: string;
    };
}

export interface CurrentUser {
    id: number | null;
    isAdmin: boolean;
    adminRights: Admin | null;
    photo_url: string | null;
    first_name: string | null;
}

export interface InventoryAuthor {
    id: number;
    first_name: string;
    photo_url?: string;
}

export interface Author {
    photo_url?: string | null;
    first_name: string;
}

export interface HistoryRecord {
    id: string;
    type: string;
    action: string;
    timestamp: string;
    data: any;
    author?: Author | null;
    newQuantity?: number;
    oldQuantity?: number;
}

export interface HistoryState {
    records: { [itemId: string]: HistoryRecord[] };
    isLoading: boolean;
    error: string | null;
    lastUpdate: string | null;
}

export interface Item {
    id: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    created_at: string;
    updated_at: string;
}

export interface Category {
    id: string;
    name: string;
    items: InventoryItem[];
}

export interface Chat {
    chat_id: string;
    chat_title: string;
    admins: Array<{
        user_id: number;
        first_name: string;
        last_name?: string;
        username?: string;
        photo_url?: string;
        status?: string;
    }>;
    members: Array<{
        user_id: number;
        first_name: string;
        photo_url?: string;
    }>;
    inventory: {
        items: Item[];
        categories: Category[];
    };
}

export interface InventoryState {
    items: ChatInventory[];
    categories: any[];
    selectedChatId: string | null;
    selectedChat: ChatInventory | null;
    selectedItem: any | null;
    isLoading: boolean;
    error: string | null;
    history: {
        records: { [key: string]: HistoryRecord[] };
        lastUpdate: string | null;
        isLoading: boolean;
        error: string | null;
    };
    lastSentItemSuggestion: any | null;
}

export interface ItemHistoryEntry {
    date: string;
    action: 'add' | 'update' | 'delete' | 'order' | 'restock' | 'writeoff';
    quantity?: number;
    previousQuantity?: number;
    newQuantity?: number;
    userId?: string;
    userName?: string;
    note?: string;
    actionDetails?: Record<string, any>;
}

export interface UpdateInventoryPayload {
    chatId: string;
    category: string;
    itemId: string;
    item: InventoryItem;
}

export interface UpdateInventoryResult {
    chatId: string;
    inventory: Inventory;
}

export interface ChatData {
    inventory: Record<string, Record<string, InventoryItem>>;
    metadata: {
        lastUpdated: string;
        progress: number;
    };
    chat_title: string;
    admins: Admin[];
}

export interface ChatResponse {
    chatId: string;
    data: ChatData;
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