// --- shiftsThunks.ts ---
// Thunks для работы со сменами: загрузка, бронирование, отмена, доступ, слоты, назначение.

import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getShifts,
  bookShift as bookShiftApi,
  deleteShiftAsSenior as cancelShiftApi,
  getShiftAccessSettings as getShiftAccessSettingsApi,
  updateShiftAccessSettings as updateShiftAccessSettingsApi,
  getSlotConfig as getSlotConfigApi,
  assignCourierToShift,
} from '@features/courierSchedule/services/courierApi/shiftsApi';
import { RootState } from '@shared/types/store';
import { ApiShift, CourierShift, CourierInfo  } from '@features/courierSchedule/types/courierScheduleTypes';
import { fetchReservesForGroup } from '@features/courierSchedule/store/reservesSlice/reservesThunks';



// --- Маппинг ApiShift -> CourierShift с приоритетом member и camelCase ---
function mapApiShiftToCourierShift(apiShift: ApiShift): CourierShift {
    const member = apiShift.member;
    return {
        id: apiShift.id,
        userId: member?.user_id ? String(member.user_id) : String(apiShift.user_id || 'unknown'),
        photoUrl: member?.photo_url || apiShift.photo_url || null,
        firstName: member?.first_name || apiShift.first_name || '',
        lastName: member?.last_name || apiShift.last_name || '',
        date: apiShift.date,
        shiftType: apiShift.shift_type,
        slotIndex: apiShift.slot_index,
        isSeniorCourier: member ? (member.is_senior_courier || false) : (apiShift.is_senior_courier || false),
    };
}

// --- Thunk: загрузка смен ---
export const fetchShifts = createAsyncThunk(
    'shifts/fetchShifts',
    async (_, { getState, rejectWithValue, dispatch }) => {
        const state = getState() as RootState;
        const chatId = state.user.user?.groups?.find((g: any) => g.group_type === 'courier')?.chat_id;
        if (!chatId) {
            return rejectWithValue('Не найден chat_id для загрузки смен');
        }
        try {
            // 1. Получаем смены
            const shiftsData = await getShifts(chatId);
            // 2. Возвращаем смены
            return shiftsData.map(mapApiShiftToCourierShift);
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось загрузить смены');
        }
    }
);

// --- Thunk: бронирование смены ---
export const bookShift = createAsyncThunk<
  CourierShift,
  { date: string; userId: string; shiftType: 'day' | 'night'; slotIndex: number; chatId: string },
  { rejectValue: string }
>(
  'shifts/bookShift',
  async ({ date, userId, shiftType, slotIndex, chatId }, { rejectWithValue }) => {
    try {
      const apiData = {
        date,
        user_telegram_id: parseInt(userId, 10),
        group_telegram_id: parseInt(chatId, 10),
        shift_type: shiftType,
        slot_index: slotIndex,
      };
      const bookedApiShift = await bookShiftApi(apiData);
      return mapApiShiftToCourierShift(bookedApiShift);
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось забронировать смену');
    }
  }
);

// --- Thunk: отмена смены ---
export const cancelShift = createAsyncThunk<
  string,
  { shiftId: string; userId: string },
  { rejectValue: string }
>(
  'shifts/cancelShift',
  async ({ shiftId, userId }, { rejectWithValue }) => {
    try {
      await cancelShiftApi(shiftId, userId);
      return shiftId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось отменить смену');
    }
  }
);

// --- Thunk: загрузка настроек доступа ---
export const fetchAccessSettings = createAsyncThunk<
  any,
  { chatId: string },
  { rejectValue: string }
>(
  'shifts/fetchAccessSettings',
  async ({ chatId }, { rejectWithValue }) => {
    try {
      const settings = await getShiftAccessSettingsApi(chatId);
      return settings;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось загрузить настройки доступа');
    }
  }
);

// --- Thunk: обновление настроек доступа ---
export const updateAccessSettings = createAsyncThunk<
  any,
  { chatId: string; settings: any },
  { rejectValue: string }
>(
  'shifts/updateAccessSettings',
  async ({ chatId, settings }, { rejectWithValue }) => {
    try {
      const updated = await updateShiftAccessSettingsApi(chatId, settings);
      return updated;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось обновить настройки доступа');
    }
  }
);

// --- Thunk: загрузка конфигурации слотов ---
export const fetchSlotConfig = createAsyncThunk<
  any,
  { chatId: number },
  { rejectValue: string }
>(
  'shifts/fetchSlotConfig',
  async ({ chatId }, { rejectWithValue }) => {
    try {
      const config = await getSlotConfigApi(chatId);
      return config;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось загрузить конфиг слотов');
    }
  }
);

// --- Thunk: назначение курьера на слот ---
export const assignCourierToShiftThunk = createAsyncThunk<
  CourierShift,
  { assignerId: string; courier: CourierInfo; groupTelegramId: string; date: string; shiftType: 'day' | 'night'; slotIndex: number },
  { rejectValue: string }
>(
  'shifts/assignCourier',
  async ({ assignerId, courier, groupTelegramId, date, shiftType, slotIndex }, { rejectWithValue, dispatch }) => {
    try {
      console.log('[DEBUG][assignCourierToShiftThunk] START', { assignerId, courier, groupTelegramId, date, shiftType, slotIndex });
      const assignedShift = await assignCourierToShift({
        assigner_telegram_id: assignerId,
        target_user_telegram_id: courier.user_id,
        group_telegram_id: groupTelegramId,
        date,
        shift_type: shiftType,
        slot_index: slotIndex,
      });
      console.log('[DEBUG][assignCourierToShiftThunk] assignedShift', assignedShift);
      const groupIdNum = Number(groupTelegramId);
      console.log('[DEBUG][assignCourierToShiftThunk] dispatch fetchReservesForGroup with groupId:', groupIdNum);
      await dispatch(fetchReservesForGroup({ groupId: groupIdNum }));
      return mapApiShiftToCourierShift(assignedShift);
    } catch (error: any) {
      console.log('[DEBUG][assignCourierToShiftThunk] ERROR', error);
      return rejectWithValue(error.message || 'Не удалось назначить курьера');
    }
  }
);