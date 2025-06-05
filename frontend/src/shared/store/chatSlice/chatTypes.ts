import { Chat } from "@/types/chat";


export type ChatContext = 'inventory' | 'writeoff' | 'events';

export interface InventoryContextData {
    inventory_progress?: number;
    last_inventory_date?: string;
}

export interface WriteoffContextData {
    pending_writeoffs?: number;
    last_writeoff_date?: string;
}

export interface EventsContextData {
    last_event_date?: string;
    events_count?: number;
}

export type ContextData = InventoryContextData | WriteoffContextData | EventsContextData;

export interface ChatMetadata {
    lastViewed?: string;
    currentContext?: ChatContext;
    contextData?: ContextData;
}

export interface ChatWithContext extends Chat {
    id: string;
    contextData?: ContextData;
}

export interface ChatState {
    items: ChatWithContext[];
    isLoading: boolean;
    error: string | null;
    selectedChatId: string | null;
    currentContext: ChatContext | null;
    metadata: {
        [chatId: string]: ChatMetadata;
    };
}
