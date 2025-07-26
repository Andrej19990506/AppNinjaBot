// --- courierThunks.ts ---
// Thunks для работы с курьером: регистрация на смену, загрузка списка курьеров и доступных курьеров.

import { createAsyncThunk } from '@reduxjs/toolkit';
import { CourierInfo } from '@features/courierSchedule/types/courierScheduleTypes';
import { getGroupCouriers } from '@features/courierSchedule/services/courierApi/couriersApi';
import { usersReceived } from '@shared/store/userSlice/userSlice';
import { axiosInstance } from '@shared/api/api';

// Интерфейс для курьерских чатов (полученных через /groups/chats)
export interface CourierChat {
    id: number;
    chat_id: string;
    title: string;
    group_type: string;
    created_at: string;
    admins: Array<{
        id: number;
        user_id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
        photo_url?: string;
        is_senior_courier?: boolean; // НОВОЕ: добавляем поле для старшего курьера
    }>;
    members: Array<{
        id: number;
        user_id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
        photo_url?: string;
        is_senior_courier?: boolean; // НОВОЕ: добавляем поле для старшего курьера
    }>;
    metadata?: any;
    slot_config?: any;
    access_settings?: any;
}

// --- Thunk: регистрация на смену ---
export const registerForShift = createAsyncThunk<
    { startTime: string; endTime: string },
    void,
    { rejectValue: string }
>(
    'courier/registerForShift',
    async (_, { rejectWithValue }) => {
        try {
            return {
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
            };
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Ошибка при регистрации на смену');
        }
    }
);

// --- Thunk: загрузка списка курьеров группы ---
export const fetchCouriers = createAsyncThunk<
    CourierInfo[],
    { groupId: number | string; requesterId: number | string },
    { rejectValue: string }
>(
    'courier/fetchCouriers',
    async ({ groupId, requesterId }, { rejectWithValue }) => {
        try {
            const couriers = await getGroupCouriers(groupId, requesterId);
            return couriers;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось получить список курьеров');
        }
    }
);

// --- Thunk: загрузка доступных курьеров группы ---
export const fetchAvailableCouriers = createAsyncThunk<
    CourierInfo[],
    { groupTelegramId: string; requesterId: string },
    { rejectValue: string }
>(
    'courier/fetchAvailableCouriers',
    async ({ groupTelegramId, requesterId }, { rejectWithValue }) => {
        try {
            const couriers = await getGroupCouriers(groupTelegramId, requesterId);
            return couriers;
        } catch (error: any) {
            const message = error.message || 'Не удалось загрузить список курьеров.';
            return rejectWithValue(message);
        }
    }
);

// --- Thunk: загрузка курьерских чатов ---
export const fetchCourierChats = createAsyncThunk<
    CourierChat[],
    { userId: number },
    { rejectValue: string }
>(
    'courier/fetchCourierChats',
    async ({ userId }, { rejectWithValue }) => {
        try {
            console.log('🚚 [fetchCourierChats] Загружаем курьерские чаты для пользователя:', userId);
            
            const response = await axiosInstance.get<CourierChat[]>('/v1/groups/chats', {
                params: {
                    user_id: userId,
                    group_type: 'courier'
                }
            });
            
            console.log('✅ [fetchCourierChats] Получены курьерские чаты:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('❌ [fetchCourierChats] Ошибка загрузки курьерских чатов:', error);
            const message = error.response?.data?.detail || error.message || 'Не удалось загрузить курьерские чаты';
            return rejectWithValue(message);
        }
    }
);


export const fetchCouriersIfAllowed = createAsyncThunk(
  'courier/fetchCouriersIfAllowed',
  async (
    { chatId, userId, isSeniorOrAdmin }: { chatId: string, userId: number, isSeniorOrAdmin: boolean },
    { dispatch, rejectWithValue }
  ) => {
    if (!isSeniorOrAdmin) {
      // Не делаем запрос, если нет прав
      return [];
    }
    try {
      const couriers = await getGroupCouriers(chatId, userId);
      const usersById: { [key: number]: any } = {};
      couriers.forEach(courier => {
        usersById[courier.user_id] = {
          id: courier.user_id,
          first_name: courier.first_name || '',
          last_name: courier.last_name || '',
          photo_url: courier.photo_url || '',
          isSeniorCourier: courier.is_senior_courier ?? false,
          username: courier.username || '',
        };
      });
      dispatch(usersReceived(usersById));
      return couriers;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось загрузить курьеров');
    }
  }
); 