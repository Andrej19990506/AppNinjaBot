import { axiosInstance } from './api';

export interface UserPermissionCreate {
    user_id: number;
    group_id: number;
    permission_type: 'inventory' | 'writeoff' | 'events';
    duration_hours: number;
}

export interface UserPermissionRevoke {
    user_id: number;
    group_id: number;
    permission_type: 'inventory' | 'writeoff' | 'events';
}

export interface UserPermissionResponse {
    id: number;
    user_id: number;
    group_id: number;
    permission_type: string;
    granted_by: number;
    granted_at: string;
    expires_at: string;
    is_active: boolean;
    revoked_at?: string;
    revoked_by?: number;
    user_name?: string;
    granted_by_name?: string;
    revoked_by_name?: string;
}

export interface UserPermissionList {
    permissions: UserPermissionResponse[];
    total: number;
    active_count: number;
    expired_count: number;
}

export interface UserPermissionCheckResponse {
    has_permission: boolean;
    is_admin: boolean;
    permission_source: 'administrator' | 'temporary' | 'none';
    expires_at?: string;
    remaining_hours?: number;
}

// API методы
export const userPermissionsApi = {
    // Выдать временные права
    async grantPermission(
        permissionData: UserPermissionCreate,
        grantedByUserId: number
    ): Promise<UserPermissionResponse> {
        const response = await axiosInstance.post('/v1/user-permissions/grant', permissionData, {
            params: {
                requester_telegram_id: grantedByUserId
            }
        });
        return response.data;
    },

    // Отозвать временные права
    async revokePermission(
        permissionData: UserPermissionRevoke,
        revokedByUserId: number
    ): Promise<{ message: string }> {
        const response = await axiosInstance.post('/v1/user-permissions/revoke', permissionData, {
            params: {
                requester_telegram_id: revokedByUserId
            }
        });
        return response.data;
    },

    // Проверить права пользователя
    async checkPermission(
        userId: number,
        groupId: number,
        permissionType: 'inventory' | 'writeoff' | 'events'
    ): Promise<UserPermissionCheckResponse> {
        const response = await axiosInstance.get('/v1/user-permissions/check', {
            params: {
                user_id: userId,
                group_id: groupId,
                permission_type: permissionType
            }
        });
        return response.data;
    },

    // Получить список прав для группы
    async listPermissions(
        groupId: number,
        activeOnly: boolean = false,
        requesterTelegramId?: number
    ): Promise<UserPermissionList> {
        const params: any = { active_only: activeOnly };
        if (requesterTelegramId) {
            params.requester_telegram_id = requesterTelegramId;
        }
        
        const response = await axiosInstance.get(`/v1/user-permissions/list/${groupId}`, {
            params
        });
        return response.data;
    },

    // Очистить истекшие права
    async cleanupExpiredPermissions(): Promise<{ message: string }> {
        const response = await axiosInstance.delete('/v1/user-permissions/cleanup');
        return response.data;
    }
};

// Вспомогательные функции
export const userPermissionsHelpers = {
    // Проверить, действительно ли разрешение
    isPermissionActive(permission: UserPermissionResponse): boolean {
        if (!permission.is_active) return false;
        
        const now = new Date();
        const expiresAt = new Date(permission.expires_at);
        return expiresAt > now;
    },

    // Получить оставшееся время в часах
    getRemainingHours(permission: UserPermissionResponse): number {
        if (!permission.is_active) return 0;
        
        const now = new Date();
        const expiresAt = new Date(permission.expires_at);
        const diff = expiresAt.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
    },

    // Получить человеко-читаемое время истечения
    getExpiryText(permission: UserPermissionResponse): string {
        const remaining = this.getRemainingHours(permission);
        if (remaining === 0) return 'Истекло';
        if (remaining === 1) return '1 час';
        if (remaining < 24) return `${remaining} ч`;
        const days = Math.floor(remaining / 24);
        const hours = remaining % 24;
        return hours > 0 ? `${days}д ${hours}ч` : `${days}д`;
    },

    // Получить цвет для индикатора времени
    getExpiryColor(permission: UserPermissionResponse): string {
        const remaining = this.getRemainingHours(permission);
        if (remaining === 0) return '#ef4444'; // red
        if (remaining <= 6) return '#f59e0b'; // amber
        if (remaining <= 24) return '#10b981'; // emerald
        return '#6b7280'; // gray
    }
}; 