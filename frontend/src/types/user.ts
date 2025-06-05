export interface Group {
    chat_id: string;
    chat_title: string;
    group_type: string;
    title: string;
}

export interface User {
    id: number;
    first_name: string;
    last_name: string;
    username?: string;
    photo_url?: string;
    is_bot?: boolean;
    language_code?: string;
    is_premium?: boolean;
    added_to_attachment_menu?: boolean;
    allows_write_to_pm?: boolean;
    groups?: any[];
    isAdmin: boolean;
    adminRights: AdminRights | null;
    isSeniorCourier?: boolean;
}

export interface UserState {
    user: User | null;
    isInitialized: boolean;
    loading: boolean;
    error: string | null;
}

export interface UserInfo {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    socket_id?: string;
}

export interface UserProfile extends User {
    settings?: {
        notifications_enabled?: boolean;
        theme?: string;
        language?: string;
        [key: string]: any;
    };
    preferences?: {
        [key: string]: any;
    };
}

export interface AdminRights {
    canManageInventory?: boolean;
    canManageUsers?: boolean;
}