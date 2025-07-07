// --- inventoryTypes.ts ---
// Типы для работы с инвентарём: используются в inventorySlice, inventoryApi и связанных сервисах/компонентах.

// Основной тип данных инвентаря чата
export interface InventoryData {
    inventory: Inventory; // Инвентарь (структура ниже)
    metadata: InventoryMetadata; // Метаданные инвентаря
    chat_title: string; // Название чата
    admins: Admin[]; // Список админов (тип ниже)
}

// Пэйлоад для обновления инвентаря (частичный или полный)
export interface InventoryUpdatePayload {
    inventory?: Inventory; // Обновлённый инвентарь
    metadata?: InventoryMetadata; // Обновлённые метаданные
    history?: InventoryHistoryItem; // Запись для истории изменений
}

export interface ChatItem {
    id: number;
    chat_id: string;
    title: string;
    group_type: string;
    created_at: string;
    admins: Admin[];
    metadata: InventoryMetadata | null;
    slot_config?: any;
    access_settings?: any;
}

export interface InventoryHistoryItem {
    id: number;
    group_id: number;
    category: string;
    item_name: string;
    action: string;
    type: 'raw' | 'semifinished';
    old_quantity: number | null;
    new_quantity: number | null;
    timestamp: string;
    author: {
        user_id: number;
        first_name: string | null;
        photo_url: string | null;
    } | null;
}

export interface InventoryItemDetails {
    quantity: number;
    filled: boolean;
    isOutOfStock?: boolean;
}

export interface InventoryItem {
    name: string;
    unit?: string;
    itemType: 'raw' | 'semifinished' | 'both';
    raw?: InventoryItemDetails;
    semifinished?: InventoryItemDetails;
    has_semifinished?: boolean;
}

export type Inventory = Record<string, Record<string, InventoryItem>>;

export interface Admin {
    id: number;
    user_id: number;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
}

export interface InventoryMetadata {
    lastUpdated: string;
    progress: number;
    chat_id: string;
    lastTemplateUpdate?: {
        timestamp: string;
        changes: {
            added: string[];
            removed: string[];
            added_count: number;
            removed_count: number;
        };
        viewed: boolean;
        viewedAt?: string;
    };
} 