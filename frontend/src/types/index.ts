// Импортируем объявления типов
import './date-fns.d';

export interface Chat {
    chat_id: string;
    chat_title: string;
    type: 'group' | 'supergroup' | 'private';
    inventory?: {
        metadata?: {
            progress?: number;
            lastUpdated?: string;
        };
        categories?: {
            [category: string]: {
                [itemId: string]: InventoryItem;
            };
        };
    };
    writeOffHistory?: WriteOffRecord[];
    events?: ChatEvent[];
    metadata?: ChatMetadata;
}

export interface User {
    id: string;
    name: string;
    role: string;
}

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: string;
    duration?: number;
    payload?: any;
}

export interface WebSocketMessage {
    type: string;
    payload: any;
    chatId?: string;
}

// Типы для уведомлений
export type NotificationType = 'item_suggestion' | 'inventory_reminder' | 'system_message';

export interface BaseNotification {
    id?: string;
    type: NotificationType;
    timestamp: string;
    read?: boolean;
}

export interface ItemSuggestionNotification extends BaseNotification {
    type: 'item_suggestion';
    source: {
        userId: string;
        userName: string;
        chatId: string;
        chatTitle: string;
    };
    item: {
        category: string;
        itemId: string;
        has_semifinished: boolean;
    };
}

export type AppNotification = ItemSuggestionNotification;

// Типы для инвентаризации
export interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: string;
    description?: string;
    lastUpdated?: string;
    updatedBy?: string;
}

// Типы для списания
export interface WriteOffRecord {
    id: string;
    chatId: string;
    items: {
        [itemId: string]: {
            quantity: number;
            reason: string;
            date?: string;
        };
    };
    createdAt: string;
    createdBy: string;
}

// Типы для событий
export interface ChatEvent {
    id: string;
    chatId: string;
    type: 'inventory' | 'writeoff' | 'system';
    action: string;
    data: any;
    timestamp: string;
    userId: string;
}

// Метаданные чата
export interface ChatMetadata {
    lastUpdated?: string;
    lastAction?: string;
    mode?: 'inventory' | 'writeoff' | 'events';
    progress?: number;
    status?: 'active' | 'completed' | 'pending';
}


export * from '../shared/types/store';
