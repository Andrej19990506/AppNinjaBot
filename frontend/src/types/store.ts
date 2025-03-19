import { CourierShift } from './shifts';
import { InventoryItem } from './inventory';
import { WriteOffItem } from './writeOff';
import { Notification, User } from './index';

// Определяем типы состояний
export interface InventoryState {
    items: { [key: string]: InventoryItem };
    loading: boolean;
    error: string | null;
}

export interface WriteOffState {
    records: WriteOffItem[];
    loading: boolean;
    error: string | null;
}

export interface NotificationState {
    notifications: Notification[];
    loading: boolean;
    error: string | null;
}

export interface UserState {
    user: User | null;
    loading: boolean;
    error: string | null;
}

export interface AdminState {
    loading: boolean;
    error: string | null;
}

export interface CourierState {
    loading: boolean;
    error: string | null;
}

export interface ShiftsState {
    shifts: CourierShift[];
    loading: boolean;
    error: string | null;
}

export interface RootState {
    inventory: InventoryState;
    writeOff: WriteOffState;
    notification: NotificationState;
    user: UserState;
    admin: AdminState;
    courier: CourierState;
    shifts: ShiftsState;
} 