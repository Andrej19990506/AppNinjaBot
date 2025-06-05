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

// Элемент чата в списке (например, для getChefChats)
export interface ChatItem {
    id: number;
    chat_id: string;
    title: string;
    group_type: string;
    created_at: string;
    admins: Admin[];
    metadata: InventoryMetadata | null; // Метаданные могут отсутствовать
    slot_config?: any; // Конфиг слотов (если используется)
    access_settings?: any; // Настройки доступа (если используются)
}

// Элемент истории изменений инвентаря
export interface InventoryHistoryItem {
    id: number;
    group_id: number;
    category: string;
    item_name: string;
    action: string;
    type: 'raw' | 'semifinished';
    old_quantity: number | null;
    new_quantity: number | null;
    timestamp: string; // ISO-строка времени
    author: {
        user_id: number;
        first_name: string | null;
        photo_url: string | null;
    } | null;
}

// Детализация по конкретному товару (остатки, наличие)
export interface InventoryItemDetails {
    quantity: number; // Количество
    filled: boolean; // Заполнено ли
    isOutOfStock?: boolean; // Нет в наличии (опционально)
}

// Описание товара в инвентаре
export interface InventoryItem {
    name: string; // Название
    unit?: string; // Единица измерения
    itemType: 'raw' | 'semifinished' | 'both'; // Тип для бэка
    raw?: InventoryItemDetails; // Остатки сырья
    semifinished?: InventoryItemDetails; // Остатки полуфабриката
    has_semifinished?: boolean; // Есть ли полуфабрикат
    // могут быть другие поля
}

// Весь инвентарь: категория → товар → объект товара
export type Inventory = Record<string, Record<string, InventoryItem>>;

// Тип администратора (если не импортируется)
export interface Admin {
    id: number;
    user_id: number;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
}

// Метаданные инвентаря (если не импортируется)
export interface InventoryMetadata {
    lastUpdated: string; // Дата последнего обновления
    progress: number; // Прогресс заполнения
    chat_id: string; // ID чата
} 