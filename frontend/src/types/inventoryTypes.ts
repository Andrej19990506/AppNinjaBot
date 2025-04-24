// frontend/src/types/inventoryTypes.ts

// Типы, используемые как в inventorySlice.ts, так и в inventoryApi.ts

// Основной тип для данных инвентаря чата
export interface InventoryData {
    inventory: Inventory; // Тип Inventory должен быть определен (см. ниже)
    metadata: InventoryMetadata;
    chat_title: string;
    admins: Admin[]; // Тип Admin должен быть определен (см. ниже)
}

// Полезная нагрузка для обновления инвентаря
export interface InventoryUpdatePayload {
    inventory?: Inventory; // Обновленный инвентарь (может быть частичным или полным)
    metadata?: InventoryMetadata; // Обновленные метаданные
    history?: InventoryHistoryItem; // Информация об изменении для записи в историю
}

// Тип для элемента чата в списке (используется в getChefChats)
export interface ChatItem {
    id: number;
    chat_id: string;
    title: string;
    group_type: string;
    created_at: string;
    admins: Admin[];
    metadata: InventoryMetadata | null; // Метаданные могут быть null
    slot_config?: any; // Добавить, если используется
    access_settings?: any; // Добавить, если используется
}

// Тип для элемента истории инвентаря
export interface InventoryHistoryItem {
    id: number;
    group_id: number;
    category: string;
    item_name: string;
    action: string;
    type: 'raw' | 'semifinished';
    old_quantity: number | null;
    new_quantity: number | null;
    timestamp: string; // ISO string
    author: {
        user_id: number;
        first_name: string | null;
        photo_url: string | null;
    } | null;
}

// --- Вспомогательные типы (нужно убедиться, что они тоже здесь или импортируются) ---

// Пример: Определение типа Inventory (если он не импортируется откуда-то еще)
export interface InventoryItemDetails {
    quantity: number;
    filled: boolean;
    isOutOfStock?: boolean;
    // могут быть другие поля
}

export interface InventoryItem {
    name: string;
    unit?: string; // Единица измерения
    itemType: 'raw' | 'semifinished' | 'both'; // Тип для бэка
    raw?: InventoryItemDetails;
    semifinished?: InventoryItemDetails;
    has_semifinished?: boolean; // Флаг наличия полуфабриката
    // могут быть другие поля
}

export type Inventory = Record<string, Record<string, InventoryItem>>;

// Пример: Определение типа Admin (если он не импортируется)
export interface Admin {
    id: number;
    user_id: number;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
}

// Пример: Определение типа InventoryMetadata (если он не импортируется)
export interface InventoryMetadata {
    lastUpdated: string;
    progress: number;
    chat_id: string;
} 