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
    raw: InventoryItemData;
    semifinished?: InventoryItemData | null;
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
    username: string | null;
    first_name: string;
    last_name: string | null;
    status: 'creator' | 'administrator';
    is_bot: boolean;
    can_manage_chat: boolean;
    can_delete_messages: boolean;
    can_manage_voice_chats: boolean;
    can_restrict_members: boolean;
    can_promote_members: boolean;
    can_change_info: boolean;
    can_invite_users: boolean;
    can_pin_messages: boolean;
    photo_url?: string;
}

export interface ChatInventory {
    chat_id: string;
    chat_title: string;
    members_count: number;
    members: any[];
    admins: Admin[];
    inventory: Inventory;
    metadata: InventoryMetadata;
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

export interface HistoryRecord {
    id: string;
    timestamp: string;
    action: 'add' | 'remove' | 'update' | 'add_option' | 'remove_option' | 'out_of_stock' | 'in_stock';
    type: 'raw' | 'semifinished';
    quantity?: number;
    oldQuantity?: number;
    newQuantity?: number;
    author: InventoryAuthor;
    item_id: string;
    category: string;
    item_name: string;
}

export interface HistoryState {
    records: { [itemId: string]: HistoryRecord[] };
    isLoading: boolean;
    error: string | null;
    lastUpdate: string | null;
}

export interface InventoryState {
    items: ChatInventory[];
    isLoading: boolean;
    error: string | null;
    selectedChatId: string | null;
    selectedChat: ChatInventory | null;
    selectedItem: InventoryItem | null;
    currentUser: {
        id: number | null;
        isAdmin: boolean;
        adminRights: any | null;
        photo_url: string | null;
        first_name: string | null;
    };
    history: {
        records: { [key: string]: HistoryRecord[] };
        isLoading: boolean;
        error: string | null;
        lastUpdate: string | null;
    };
    lastSentItemSuggestion?: {
        item?: {
            category?: string;
            itemId?: string;
            has_semifinished?: boolean;
        };
        source?: {
            userId?: number;
            userName?: string;
            chatId?: string;
            chatTitle?: string;
        };
        timestamp?: string;
        type?: string;
    };
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