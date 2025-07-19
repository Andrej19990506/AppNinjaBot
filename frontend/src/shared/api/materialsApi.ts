import { axiosInstance } from './api';
import store from '@shared/store/store';

// Функция для получения заголовков с user_id
const getAuthHeaders = () => {
    const state = store.getState();
    const userId = state.user?.user?.id;
    
    if (!userId) {
        throw new Error('User not authenticated');
    }
    
    return {
        'X-User-ID': userId.toString()
    };
};

// Типы для API
export interface Comment {
    id: string;
    material_id: number;
    user_id: number;
    message: string;
    reply_to?: string;
    edited: boolean;
    created_at: string;
    updated_at: string;
    author: {
        user_id: number;
        first_name?: string;
        username?: string;
        photo_url?: string;
    };
    replies?: Comment[];
}

export interface Reaction {
    emoji: string;
    count: number;
    users: Array<{
        user_id: number;
        first_name?: string;
        username?: string;
        photo_url?: string;
    }>;
}

export interface CommentsResponse {
    comments: Comment[];
    total: number;
}

export interface ReactionsResponse {
    reactions: Reaction[];
    user_reaction?: string;
    total: number;
}

export interface CreateCommentRequest {
    material_id: number;
    message: string;
    reply_to?: string;
}

export interface UpdateCommentRequest {
    message: string;
}

export interface CreateReactionRequest {
    material_id: number;
    emoji: string;
}

// API методы
export const materialsApi = {
    // Комментарии
    getComments: async (materialId: number): Promise<CommentsResponse> => {
        const response = await axiosInstance.get(`/v1/materials/${materialId}/comments`);
        return response.data;
    },

    createComment: async (materialId: number, data: CreateCommentRequest): Promise<Comment> => {
        const response = await axiosInstance.post(`/v1/materials/${materialId}/comments`, data, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    updateComment: async (commentId: string, data: UpdateCommentRequest): Promise<Comment> => {
        const response = await axiosInstance.put(`/v1/comments/${commentId}`, data, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    deleteComment: async (commentId: string): Promise<void> => {
        await axiosInstance.delete(`/v1/comments/${commentId}`, {
            headers: getAuthHeaders()
        });
    },

    // Реакции
    getReactions: async (materialId: number): Promise<ReactionsResponse> => {
        const response = await axiosInstance.get(`/v1/materials/${materialId}/reactions`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    toggleReaction: async (materialId: number, data: CreateReactionRequest): Promise<{ message: string; reaction?: string }> => {
        const response = await axiosInstance.post(`/v1/materials/${materialId}/reactions`, data, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    removeReaction: async (materialId: number): Promise<void> => {
        await axiosInstance.delete(`/v1/materials/${materialId}/reactions`, {
            headers: getAuthHeaders()
        });
    },
}; 