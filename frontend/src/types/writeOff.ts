import { ChatInventory } from './inventory';
import { Admin, InventoryItem } from './inventoryTypes';
import { User } from './user';

export interface WriteOffMetadata {
    lastUpdated: string;
    progress: number;
    chat_id: string;
    totalWriteOffs: number;
    pendingWriteOffs: number;
}

export interface WriteOffReason {
    id: string;
    title: string;
    description: string;
}

export interface WriteOffItem {
    id: string;
    name: string;
    reason: WriteOffReason;
    quantity: number;
    description?: string;
    chat_id: string;
    user_id: string;
    created_at: string;
    status: string;
    unitType?: 'шт' | 'гр';
}

export interface ChatAdmin {
    user_id: string;
    status: 'creator' | 'administrator';
    first_name: string;
    last_name?: string;
    username?: string;
}

export interface WriteOffChat extends Omit<ChatInventory, 'metadata'> {
    chat_id: string;
    chat_title: string;
    members_count: number;
    members: any[];
    admins: Admin[];
    inventory: Record<string, Record<string, InventoryItem>>;
    writeOffs: WriteOffItem[];
    metadata: WriteOffMetadata;
}

export interface WriteOffModalState {
    name: string;
    reason: WriteOffReason | null;
    quantity: number;
    description: string;
    isSubmitting: boolean;
    isSuccess: boolean;
    unitType: 'шт' | 'гр';
}

export interface WriteOffState {
    chats: WriteOffChat[];
    selectedChatId: string | null;
    selectedChat: WriteOffChat | null;
    isLoading: boolean;
    error: string | null;
    modal: WriteOffModalState;
}

export interface CreateWriteOffData {
    name: string;
    reason: WriteOffReason;
    quantity: number;
    description?: string;
    unitType: 'шт' | 'гр';
    user_id: string;
    chat_id: string;
}

// Action Types
export enum WriteOffActionTypes {
    FETCH_WRITE_OFFS = 'writeOff/fetchWriteOffs',
    SELECT_CHAT = 'writeOff/selectChat',
    CREATE_WRITE_OFF = 'writeOff/createWriteOff',
    UPDATE_WRITE_OFF = 'writeOff/updateWriteOff',
    DELETE_WRITE_OFF = 'writeOff/deleteWriteOff'
} 