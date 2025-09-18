import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@shared/store/store';
import { getSupplies, getCalendarData, type SuppliesQuery } from '../services/requestsApi';

// Типы для календарных данных
export type CalendarDeliveryData = {
  date: string;
  count: number;
  suppliers: string[];
};

export type CalendarData = {
  month: string;
  deliveries: CalendarDeliveryData[];
  total_deliveries: number;
};

export type RequestsState = {
  params: SuppliesQuery;
  loading: boolean;
  error: string | null;
  data: any | null;
  
  // 🚀 НОВОЕ: Календарные данные
  calendarData: Map<string, CalendarData>; // Ключ: "chatId-month", значение: CalendarData
  calendarLoading: boolean;
  calendarError: string | null;
};

const initialState: RequestsState = {
  params: {
    spreadsheet_id: '',
    range: '',
    mode: 'table',
    exclude_zero: true,
    subtract_withdrawn: false,
  },
  loading: false,
  error: null,
  data: null,
  
  // 🚀 НОВОЕ: Календарные данные
  calendarData: new Map(),
  calendarLoading: false,
  calendarError: null,
};

export const fetchSupplies = createAsyncThunk(
  'requests/fetchSupplies',
  async (params: SuppliesQuery, { rejectWithValue }) => {
    try {
      console.log('🚀 [fetchSupplies] Начинаем запрос с параметрами:', params);
      const result = await getSupplies(params);
      console.log('✅ [fetchSupplies] Запрос успешно завершен:', result);
      return result;
    } catch (e: any) {
      // 🚀 ОПТИМИЗАЦИЯ: Не показываем ошибку для отмененных запросов
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.message === 'canceled') {
        console.log('⚡ [fetchSupplies] Запрос отменен - это нормально:', e.message);
        // Возвращаем специальный код для отмены, но не как ошибку
        return rejectWithValue('REQUEST_CANCELED');
      }
      
      console.error('❌ [fetchSupplies] Ошибка запроса:', e);
      return rejectWithValue(e?.message || 'Ошибка загрузки заявок');
    }
  }
);

// 🚀 НОВЫЙ THUNK: Загрузка данных календаря
export const fetchCalendarData = createAsyncThunk(
  'requests/fetchCalendarData',
  async (params: {
    chat_id: string;
    month: string;
    supply_type?: 'raw_materials' | 'household' | 'stationery';
  }, { rejectWithValue }) => {
    try {
      const result = await getCalendarData(params);
      return {
        key: `${params.chat_id}-${params.month}`,
        data: result
      };
    } catch (e: any) {
      // 🚀 ОПТИМИЗАЦИЯ: Не показываем ошибку для отмененных запросов
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.message === 'canceled') {
        return rejectWithValue('REQUEST_CANCELED');
      }
      
      return rejectWithValue(e?.message || 'Ошибка загрузки данных календаря');
    }
  }
);

const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    setParams(state, action: PayloadAction<Partial<SuppliesQuery>>) {
      state.params = { ...state.params, ...action.payload } as SuppliesQuery;
    },
    reset(state) {
      state.loading = false;
      state.error = null;
      state.data = null;
      // Сбрасываем параметры к начальному состоянию
      state.params = {
        spreadsheet_id: '',
        range: '',
        mode: 'table',
        exclude_zero: true,
        subtract_withdrawn: false,
      };
    },
    
    // 🚀 НОВЫЕ REDUCERS: Для календарных данных
    setCalendarData(state, action: PayloadAction<{ key: string; data: CalendarData }>) {
      state.calendarData.set(action.payload.key, action.payload.data);
    },
    
    clearCalendarData(state, action: PayloadAction<string>) {
      state.calendarData.delete(action.payload);
    },
    
    clearAllCalendarData(state) {
      state.calendarData.clear();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSupplies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSupplies.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchSupplies.rejected, (state, action) => {
        state.loading = false;
        // 🚀 ОПТИМИЗАЦИЯ: Не показываем ошибку для отмененных запросов
        if (action.payload === 'REQUEST_CANCELED') {
          console.log('⚡ [requestsSlice] Запрос отменен - не показываем ошибку');
          state.error = null; // Не показываем ошибку для отмененных запросов
        } else {
          state.error = (action.payload as string) || 'Ошибка загрузки заявок';
        }
      })
      
      // 🚀 НОВЫЕ CASES: Для календарных данных
      .addCase(fetchCalendarData.pending, (state) => {
        state.calendarLoading = true;
        state.calendarError = null;
      })
      .addCase(fetchCalendarData.fulfilled, (state, action) => {
        state.calendarLoading = false;
        
        
        state.calendarData.set(action.payload.key, action.payload.data);
      })
      .addCase(fetchCalendarData.rejected, (state, action) => {
        state.calendarLoading = false;
        // 🚀 ОПТИМИЗАЦИЯ: Не показываем ошибку для отмененных запросов
        if (action.payload === 'REQUEST_CANCELED') {
          state.calendarError = null;
        } else {
          state.calendarError = (action.payload as string) || 'Ошибка загрузки данных календаря';
        }
      });
  }
});

export const { setParams, reset, setCalendarData, clearCalendarData, clearAllCalendarData } = requestsSlice.actions;
export const selectRequests = (state: RootState) => state.requests as RequestsState;

// 🚀 НОВЫЕ SELECTORS: Для календарных данных
export const selectCalendarData = (state: RootState) => state.requests.calendarData;
export const selectCalendarLoading = (state: RootState) => state.requests.calendarLoading;
export const selectCalendarError = (state: RootState) => state.requests.calendarError;

// Селектор для получения данных конкретного месяца
export const selectCalendarDataForMonth = (chatId: string, month: string) => (state: RootState) => {
  const key = `${chatId}-${month}`;
  return state.requests.calendarData.get(key) || null;
};

export default requestsSlice.reducer;
