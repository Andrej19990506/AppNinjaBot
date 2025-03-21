export interface Group {
    chat_id: string;
    chat_title: string;
    group_type: string;
}

export interface User {
    id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    groups?: Group[];
    isAdmin: boolean;
    adminRights: any | null;
    isSeniorCourier?: boolean;
}

export interface UserState {
    user: User | null;
    isInitialized: boolean;
    error: string | null;
} 