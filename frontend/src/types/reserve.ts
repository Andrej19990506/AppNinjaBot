export interface ReserveShift {
    id: string;
    userId: string;
    user_id?: string;
    date: string;
    chat_id: string;
    photo_url: string | null;
    firstName: string;
    lastName: string;
    first_name?: string;
    last_name?: string;
    isSeniorCourier: boolean;
    is_senior_courier?: boolean;
    created_at: string;
    createdAt?: string;
}

export interface IncomingReserveData {
    id: string;
    userId?: string;
    user_id?: string;
    date: string;
    chat_id: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
    isSeniorCourier?: boolean;
    is_senior_courier?: boolean;
    created_at?: string;
    createdAt?: string;
} 