// Импортируем объявления типов
import './date-fns.d';

export interface Chat {
    chat_id: string;
    title: string;
    inventory?: {
        metadata?: {
            progress?: number;
            lastUpdated?: string;
        };
        items?: any[];
    };
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