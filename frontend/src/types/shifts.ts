export interface CourierShift {
    id: string;
    userId: string;
    photo_url: string | null;
    firstName: string;
    lastName: string;
    date: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
}

export interface ReserveShift {
    id: number;
    userId: string;
    date: string;
    photo_url: string | null;
    firstName: string;
    lastName: string;
    created_at: string;
}

export interface ShiftState {
    shifts: CourierShift[];
    reserves: ReserveShift[];
    loading: boolean;
    error: string | null;
}

export interface ReserveState {
    reserves: ReserveShift[];
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
    reserveId: number;
    userId: string;
} 