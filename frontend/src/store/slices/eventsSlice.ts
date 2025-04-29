// frontend/src/store/slices/eventsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getEvents as apiGetEvents } from '../../services/eventsApi'; // Импортируем API функцию
import { EventRead } from '../../types/event'; // Импортируем тип события
import { RootState } from '../store'; // Импортируем тип RootState

// Определяем тип для состояния среза
interface EventsState {
  items: EventRead[];
  loading: 'idle' | 'pending' | 'succeeded' | 'failed';
  error: string | null;
}

// Начальное состояние
const initialState: EventsState = {
  items: [],
  loading: 'idle', // Статус загрузки: idle, pending, succeeded, failed
  error: null,
};

// Создаем асинхронный thunk для загрузки событий
export const fetchEvents = createAsyncThunk<
  EventRead[], // Тип возвращаемого значения при успехе
  void,        // Тип аргумента thunk (void - нет аргументов)
  { rejectValue: string } // Тип значения при ошибке (для обработки ошибок)
>(
  'events/fetchEvents', // Уникальное имя для thunk
  async (_, { rejectWithValue }) => {
    try {
      const events = await apiGetEvents(); // Вызываем нашу API функцию
      return events;
    } catch (error: any) {
      // Возвращаем сообщение об ошибке через rejectWithValue
      return rejectWithValue(error.message || 'Failed to fetch events');
    }
  }
);

// Создаем срез (slice)
const eventsSlice = createSlice({
  name: 'events', // Имя среза
  initialState,
  reducers: {
    // Здесь можно добавить синхронные редьюсеры, если понадобятся
    // Например, для локального добавления/удаления до обновления с сервера
  },
  extraReducers: (builder) => {
    builder
      // Обработка состояния "в процессе загрузки"
      .addCase(fetchEvents.pending, (state) => {
        state.loading = 'pending';
        state.error = null; // Сбрасываем ошибку при новой загрузке
      })
      // Обработка успешной загрузки
      .addCase(fetchEvents.fulfilled, (state, action: PayloadAction<EventRead[]>) => {
        state.loading = 'succeeded';
        state.items = action.payload; // Записываем полученные события
      })
      // Обработка ошибки загрузки
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload || 'Unknown error occurred'; // Записываем ошибку
      });
  },
});

// Экспортируем редьюсер
export default eventsSlice.reducer;

// --- Селекторы для доступа к данным ---
export const selectAllEvents = (state: RootState): EventRead[] => state.events.items;
export const selectEventsLoading = (state: RootState): 'idle' | 'pending' | 'succeeded' | 'failed' => state.events.loading;
export const selectEventsError = (state: RootState): string | null => state.events.error; 