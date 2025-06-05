// --- reservesApi.ts ---
// API-функции для работы с резервами (reserves)

import { axiosInstance } from '@shared/api/api';
import { ApiReserve, AddReserveApiData } from '@features/courierSchedule/types/courierScheduleTypes';
import { logger } from '@shared/utils/logger';

// Получить список резервов
export const getReserves = async (groupTelegramId: string | number, reserveDate?: string): Promise<ApiReserve[]> => {
    try {
        if (!groupTelegramId) {
            console.error('[reservesApi] ❌ Ошибка: не указан groupTelegramId для получения резервов');
            return [];
        }
        const params: Record<string, any> = {
            group_telegram_id: groupTelegramId
        };
        const response = await axiosInstance.get('/api/v1/reserves', { params });
        const reserves = Array.isArray(response.data) ? response.data : [];
        return reserves;
    } catch (error) {
        if ((error as any).isAxiosError) {
            const axiosError = error as any;
            if (axiosError.response?.status === 404) {
                return [];
            }
        }
        return [];
    }
};

// Удалить резерв по ID
export const deleteReserve = async (
    reserveId: string, 
    requesterTelegramId: number | string
): Promise<ApiReserve> => {
    logger.info(`[reservesApi] 📡 Запрос на удаление резерва ID: ${reserveId} от имени ${requesterTelegramId}`);
    try {
        const response = await axiosInstance.delete<ApiReserve>(
            `/api/v1/reserves/${reserveId}`, 
            { params: { requester_telegram_id: requesterTelegramId } }
        );
        logger.info(`[reservesApi] ✅ Резерв ID: ${reserveId} удален пользователем ${requesterTelegramId}`, response.data);
        return response.data;
    } catch (error) {
        logger.error(`[reservesApi] ❌ Ошибка при удалении резерва ID: ${reserveId} пользователем ${requesterTelegramId}`, error);
        if ((error as any).isAxiosError) {
            const axiosError = error as any;
            const status = axiosError.response?.status;
            const detail = axiosError.response?.data?.detail;
            if (status === 404) {
                throw new Error(detail || 'Запись резерва не найдена.');
            }
            if (status === 403) {
                throw new Error(detail || 'У вас нет прав старшего курьера для удаления этого резерва.');
            }
            throw new Error(detail || axiosError.message || 'Ошибка при удалении резерва.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при удалении резерва.');
    }
};

// Добавить пользователя в резерв
export const addReserve = async (data: AddReserveApiData): Promise<ApiReserve> => {
    logger.info(`[reservesApi] 📡 Создание записи в резерве:`, data);
    try {
        const response = await axiosInstance.post<ApiReserve>('/api/v1/reserves', data);
        logger.info(`[reservesApi] ✅ Запись в резерв создана:`, response.data);
        return response.data;
    } catch (error) {
        logger.error(`[reservesApi] ❌ Ошибка при создании записи в резерве:`, error);
        if ((error as any).isAxiosError) {
            const axiosError = error as any;
            const status = axiosError.response?.status;
            const detail = axiosError.response?.data?.detail;
            if (status === 409) {
                throw new Error(detail || 'Пользователь уже находится в резерве на эту дату.');
            }
            if (status === 400) {
                throw new Error(detail || 'Ошибка данных запроса для добавления в резерв.');
            }
            if (status === 403) {
                throw new Error(detail || 'Добавление в резерв сейчас недоступно.');
            }
            throw new Error(detail || axiosError.message || 'Ошибка при добавлении в резерв.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при добавлении в резерв.');
    }
};

// Здесь будут размещены все функции, связанные с резервами (getReserves, addReserve, и т.д.)
// ... (реализация будет добавлена ниже) ... 