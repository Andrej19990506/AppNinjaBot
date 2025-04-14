export interface CourierShift {
    id: string;
    userId: string;
    photoUrl: string | null;
    firstName: string;
    lastName: string;
    date: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
}

export interface ReserveEntry {
    id: string;
    userId: string;
    date: string;
    photoUrl: string | null;
    firstName: string;
    lastName: string;
    isSeniorCourier: boolean;
    createdAt: string;
    chatId: string;
}

export interface ShiftState {
    shifts: CourierShift[];
    loading: boolean;
    error: string | null;
}

export interface ReserveState {
    reserves: ReserveEntry[];
    loading: boolean;
    error: string | null;
}

export interface BookShiftParams {
    date: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
    userId: string;
}

export interface AddToReserveParams {
    date: string;
    userId: string;
}

export interface RemoveFromReserveParams {
    reserveId: string;
    userId: string;
}

export interface ShiftSlot {
    id?: string;
    userId?: string;
    photoUrl?: string | null;
    firstName?: string;
    lastName?: string;
    slotIndex: number;
    isSeniorCourier?: boolean;
} 