export interface Chat {
    id: string;
    name: string;
    type: 'group' | 'supergroup' | 'private';
    username?: string;
    title?: string;
    description?: string;
    invite_link?: string;
    photo?: {
        small_file_id: string;
        big_file_id: string;
    };
    permissions?: {
        can_send_messages: boolean;
        can_send_media_messages: boolean;
        can_send_polls: boolean;
        can_send_other_messages: boolean;
        can_add_web_page_previews: boolean;
        can_change_info: boolean;
        can_invite_users: boolean;
        can_pin_messages: boolean;
    };
    last_message?: {
        message_id: number;
        from?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
        };
        date: number;
        text?: string;
    };
    pinned_message?: {
        message_id: number;
        text?: string;
    };
    members_count?: number;
    created_at: string;
    updated_at: string;
} 