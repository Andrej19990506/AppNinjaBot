// --- courierThunks.ts ---
// Thunks для работы с курьером: регистрация на смену, загрузка списка курьеров и доступных курьеров.

import { createAsyncThunk } from '@reduxjs/toolkit';
import { CourierInfo } from '@features/courierSchedule/types/courierScheduleTypes';
import { getGroupCouriers } from '@features/courierSchedule/services/courierApi/couriersApi';
import { usersReceived } from '@shared/store/userSlice/userSlice';

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