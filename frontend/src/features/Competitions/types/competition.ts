export type CompetitionStatus = 'draft' | 'announcement' | 'active' | 'completed' | 'cancelled';

export interface Winner {
    id: number;
    user_id: number;
    place: number;
    prize: string;
    user_name: string;
    user_position: string;
    user_department: string;
    winner_data: any;
    long_term_status: boolean;
    status_expires_at: string | null;
    announced_at: string;
}

export interface Competition {
    id: number;
    title: string;
    status: CompetitionStatus;
    description: string;
    full_description: string;
    victory_description?: string;
    start_date: string;
    end_date: string;
    registration_deadline: string | null;
    prize: string;
    dynamic_prize_config: any;
    max_participants: number | null;
    current_participants: number;
    competition_data: any;
    rules: string[];
    evaluation_criteria: any;
    target_groups: string[];
    target_chat_ids: number[];
    images: any;
    attachments: any;
    created_by: number;
    created_at: string;
    updated_at: string;
    published_at: string | null;
    winners?: Winner[];
} 