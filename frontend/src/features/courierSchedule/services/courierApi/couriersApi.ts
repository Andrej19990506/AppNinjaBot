// --- couriersApi.ts ---
// API-функции для работы с курьерами (couriers)

import axios from 'axios';
import { axiosInstance } from '@shared/api/api';
import { logger } from '@shared/utils/logger';
import { CourierStatusResponse, UpdateSeniorityResponse, UpdateProfileData, BackendDataKeys, CourierInfo } from '@features/courierSchedule/types/courierScheduleTypes';

// --- API-функции ---

// Получить статус курьера
export const getCourierStatus = async (userId: number | string, chatId: string): Promise<CourierStatusResponse> => {
    try {
        const response = await axiosInstance.get<CourierStatusResponse>(`/couriers/${userId}/status`, {
            params: { chat_id: chatId }
        });
        return response.data;
    } catch (error) {
        const err = error as any;
        if (axios.isAxiosError(err)) {
            const detail = err.response?.data?.detail || err.message;
            throw new Error(detail || 'Ошибка при получении статуса курьера.');
        } else if (err instanceof Error) {
            throw err;
        }
        throw new Error('Неизвестная ошибка при получении статуса курьера.');
    }
};

// Обновить профиль курьера
export const updateCourierProfile = async (userId: number | string, data: UpdateProfileData): Promise<any> => {
    try {
        const backendData: Partial<Record<BackendDataKeys, any>> = {
            first_name: data.firstName,
            last_name: data.lastName,
            is_senior_courier: data.isSeniorCourier,
            senior_password: data.seniorPassword,
            chat_id: data.chatId
        };
        (Object.keys(backendData) as BackendDataKeys[]).forEach(key => {
            if (backendData[key] === undefined) {
                delete backendData[key];
            }
        });
        const response = await axiosInstance.put(`/v1/users/${userId}/profile`, backendData);
        console.log(`[couriersApi] ✅ Профиль курьера ID: ${userId} обновлен:`, response.data);
        return response.data;
    } catch (error) {
        const err = error as any;
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const responseData = err.response?.data;
            const detail = responseData?.detail;
            if (err.code === 'ERR_NETWORK') {
                throw new Error('Ошибка сети. Пожалуйста, проверьте подключение к интернету.');
            }
            if (status === 403) {
                throw new Error(detail || 'Доступ запрещен. У вас нет прав.');
            }
            if (status === 404) {
                throw new Error(detail || 'Пользователь не найден.');
            }
            if (status === 401) {
                throw new Error(detail || 'Неверный пароль старшего курьера или ошибка авторизации.');
            }
            if (status === 400) {
                throw new Error(detail || 'Неверные данные запроса.');
            }
            throw new Error(detail || err.message || 'Ошибка при обновлении профиля.');
        } else if (err instanceof Error) {
            throw err;
        }
        throw new Error('Произошла неизвестная ошибка при обновлении профиля.');
    }
};

// Обновить статус старшего курьера
interface UpdateSeniorityData {
    is_senior_courier: boolean;
}

export const updateMemberSeniority = async (
    groupTelegramId: number | string,
    userTelegramId: number | string,
    isSeniorCourier: boolean
): Promise<UpdateSeniorityResponse> => {
    logger.info(`[couriersApi] 📡 Обновление статуса старшего для user ${userTelegramId} в группе ${groupTelegramId} на ${isSeniorCourier}`);
    try {
        const data: UpdateSeniorityData = { is_senior_courier: isSeniorCourier };
        const response = await axiosInstance.put<UpdateSeniorityResponse>(
            `/v1/groups/${groupTelegramId}/members/${userTelegramId}/seniority`,
            data
        );
        logger.info('[couriersApi] ✅ Статус старшего курьера обновлен:', response.data);
        return response.data;
    } catch (error) {
        const err = error as any;
        logger.error('[couriersApi] ❌ Ошибка при обновлении статуса старшего курьера:', err);
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const detail = err.response?.data?.detail;
            if (status === 404) {
                throw new Error(detail || 'Группа или участник не найдены.');
            }
            if (status === 403) {
                throw new Error(detail || 'Доступ запрещен (возможно, нет прав администратора).');
            }
            if (status === 400) {
                throw new Error(detail || 'Неверные данные запроса для обновления статуса.');
            }
            throw new Error(detail || err.message || 'Ошибка при обновлении статуса старшего курьера.');
        } else if (err instanceof Error) {
            throw err;
        }
        throw new Error('Неизвестная ошибка при обновлении статуса старшего курьера.');
    }
};

// Обновить профиль курьера из Telegram
export const refreshCourierProfileFromTelegram = async (userId: number | string): Promise<any> => {
    const telegramId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(telegramId)) {
        logger.error('[couriersApi] ❌ Invalid userId provided for refreshCourierProfileFromTelegram', { userId });
        throw new Error('Invalid User ID');
    }
    logger.info(`[couriersApi] 📡 Запрос обновления профиля курьера ID: ${telegramId} из Telegram`);
    try {
        const response = await axiosInstance.post(`/v1/users/${telegramId}/refresh`);
        logger.info(`[couriersApi] ✅ Профиль курьера ID: ${telegramId} обновлен из Telegram:`, response.data);
        return response.data;
    } catch (error) {
        const err = error as any;
        logger.error(`[couriersApi] ❌ Ошибка при обновлении профиля курьера ID: ${telegramId} из Telegram`, err);
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const responseData = err.response?.data;
            const detail = responseData?.detail;
            if (err.code === 'ERR_NETWORK') {
                throw new Error('Ошибка сети. Пожалуйста, проверьте подключение к интернету.');
            }
            if (status === 404) {
                throw new Error(detail || 'Пользователь не найден в Telegram или базе данных.');
            }
            if (status === 502 || status === 503) {
                throw new Error(detail || 'Сервис бота недоступен. Попробуйте позже.');
            }
            throw new Error(detail || err.message || 'Ошибка при обновлении профиля из Telegram.');
        } else if (err instanceof Error) {
            throw err;
        }
        throw new Error('Произошла неизвестная ошибка при обновлении профиля из Telegram.');
    }
};

// Получить список курьеров группы
export const getGroupCouriers = async (
  groupId: number | string,
  requesterId: number | string
): Promise<CourierInfo[]> => {
  try {
    const response = await axiosInstance.get<CourierInfo[]>(
      `/v1/groups/${groupId}/couriers`,
      { params: { requester_id: requesterId } }
    );
    return response.data;
  } catch (error) {
    const err = error as any;
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 404) {
        return [];
      }
      throw new Error(detail || err.message || 'Ошибка при получении списка курьеров');
    } else if (err instanceof Error) {
      throw err;
    }
    throw new Error('Неизвестная ошибка при получении списка курьеров');
  }
};
