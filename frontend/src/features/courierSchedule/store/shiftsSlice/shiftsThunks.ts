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
import { ApiShift, CourierShift, CourierInfo, BookShiftApiData  } from '@features/courierSchedule/types/courierScheduleTypes';
import { fetchReservesForGroup } from '@features/courierSchedule/store/reservesSlice/reservesThunks';
import { CALENDAR_MONTHS_AHEAD } from '@features/courierSchedule/constants';



// --- Маппинг ApiShift -> CourierShift с приоритетом member и camelCase ---
function mapApiShiftToCourierShift(apiShift: ApiShift): CourierShift {
    const member = apiShift.member;
    const template = apiShift.template;
    
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
        template_id: apiShift.template_id || null,
        template: template ? {
            id: template.id,
            name: template.name,
            startTime: template.start_time,
            endTime: template.end_time,
            maxSlots: template.max_slots,
            hasSeniorSlot: template.has_senior_slot,
        } : null,
    };
}

// --- Thunk: загрузка смен ---
// Период загрузки смен: с начала текущего месяца и на CALENDAR_MONTHS_AHEAD вперёд,
// то есть ровно то, что рисует календарь. Раньше период не передавался вовсе, и
// клиент тянул всю историю группы: у Словцова 3783 смены с апреля 2025 при 186
// нужных, и так на каждое открытие календаря и каждое событие вебсокета.
// Прошлое календарю не нужно — за историей есть табель со своим фильтром по месяцу.
const calendarPeriod = (): { from: string; to: string } => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    // Последний день последнего показываемого месяца: нулевой день следующего.
    const end = new Date(now.getFullYear(), now.getMonth() + CALENDAR_MONTHS_AHEAD, 0);
    const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: iso(start), to: iso(end) };
};

// Сервер отдаёт смены в стабильном порядке, поэтому для ответа на вопрос «изменилось
// ли что-нибудь» хватает длины и полей, влияющих на отрисовку ячейки календаря.
const sameShifts = (a: CourierShift[] | undefined, b: CourierShift[]): boolean => {
    if (!a || a.length !== b.length) return false;
    for (let i = 0; i < b.length; i++) {
        const x = a[i];
        const y = b[i];
        if (
            x.id !== y.id ||
            x.date !== y.date ||
            String(x.userId) !== String(y.userId) ||
            x.slotIndex !== y.slotIndex ||
            x.template_id !== y.template_id ||
            x.photoUrl !== y.photoUrl ||
            x.isSeniorCourier !== y.isSeniorCourier
        ) {
            return false;
        }
    }
    return true;
};

export const fetchShifts = createAsyncThunk<
    CourierShift[],
    { chatId: number | string },
    { state: RootState; rejectValue: string }
>(
    'shifts/fetchShifts',
    async ({ chatId }, { getState, rejectWithValue }) => {
        if (!chatId) {
            return rejectWithValue('Не найден chat_id для загрузки смен');
        }
        try {
            // 1. Получаем смены за период, который календарь реально рисует
            const { from, to } = calendarPeriod();
            const shiftsData = await getShifts(chatId, from, to);
            const mapped = shiftsData.map(mapApiShiftToCourierShift);

            // 2. Если список не изменился — отдаём ПРЕЖНЮЮ ссылку. Календарь
            // перезапрашивает смены на каждое событие вебсокета, и почти всегда
            // приходит то же самое. Новый массив менял идентичность в сторе и
            // перерисовывал все 12 месяцев (~360 ячеек с тултипами) — на слабых
            // телефонах именно это и делало ячейки «прыгающими» и ненажимаемыми.
            // Сравниваем здесь, а не в редьюсере: там стор — черновик immer, и
            // и снятие с него копии стоило бы дороже самой перерисовки.
            const previous = getState().shifts.shifts;
            return sameShifts(previous, mapped) ? previous : mapped;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось загрузить смены');
        }
    }
);

// --- Thunk: бронирование смены ---
export const bookShift = createAsyncThunk<
  CourierShift,
  { date: string; userId: string; slotIndex: number; chatId: string; templateId: string },
  { rejectValue: string }
>(
  'shifts/bookShift',
  async ({ date, userId, slotIndex, chatId, templateId }, { rejectWithValue }) => {
    try {
      const apiData: BookShiftApiData = {
        date,
        user_telegram_id: parseInt(userId, 10),
        group_telegram_id: parseInt(chatId, 10),
        slot_index: slotIndex,
        template_id: templateId, // template_id обязателен для новых смен
        // shift_type не передаем, так как используем template_id
      };
      console.log('[bookShift] Sending to API:', apiData);
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
  { state: RootState; rejectValue: string }
>(
  'shifts/fetchAccessSettings',
  async ({ chatId }, { getState, rejectWithValue }) => {
    try {
      const settings = await getShiftAccessSettingsApi(chatId);
      // Та же причина, что и в fetchShifts: настройки тянутся вместе со сменами и
      // почти всегда приходят неизменными, а новый объект дёргал весь календарь.
      const previous = getState().shifts.accessSettings;
      return JSON.stringify(previous) === JSON.stringify(settings) ? previous : settings;
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
  { assignerId: string; courier: CourierInfo; groupTelegramId: string; date: string; shiftType?: 'day' | 'night' | null; templateId?: string | null; slotIndex: number },
  { rejectValue: string }
>(
  'shifts/assignCourier',
  async ({ assignerId, courier, groupTelegramId, date, shiftType, templateId, slotIndex }, { rejectWithValue, dispatch }) => {
    try {
      console.log('[DEBUG][assignCourierToShiftThunk] START', { assignerId, courier, groupTelegramId, date, shiftType, templateId, slotIndex });
      const assignedShift = await assignCourierToShift({
        assigner_telegram_id: assignerId,
        target_user_telegram_id: courier.user_id,
        group_telegram_id: groupTelegramId,
        date,
        shift_type: shiftType || null, // Для обратной совместимости
        template_id: templateId || null, // Приоритетный параметр
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