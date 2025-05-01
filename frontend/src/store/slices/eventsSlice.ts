// frontend/src/store/slices/eventsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
    getEvents as apiGetEvents, 
    createEvent as apiCreateEvent,
    deleteEvent as apiDeleteEvent,
    createNotification as apiCreateNotification,
    updateNotification as apiUpdateNotification
} from '../../services/eventsApi'; 
import { EventRead, EventCreate, NotificationCreate, EventNotification, NotificationUpdate } from '../../types/event'; 
import { RootState } from '../store';

// Определяем тип для состояния среза
interface EventsState {
  items: EventRead[];
  loading: 'idle' | 'pending' | 'succeeded' | 'failed';
  createLoading: 'idle' | 'pending' | 'succeeded' | 'failed';
  deleteLoading: { [id: number]: 'pending' | 'succeeded' | 'failed' };
  notificationLoading: { [eventId: number]: 'pending' | 'succeeded' | 'failed' };
  error: string | null;
  createError: string | null;
  deleteError: { [id: number]: string | null };
  notificationError: { [eventId: number]: string | null };
  notificationUpdateLoading: { [notificationId: string]: 'pending' | 'succeeded' | 'failed' };
  notificationUpdateError: { [notificationId: string]: string | null };
}

// Начальное состояние
const initialState: EventsState = {
  items: [],
  loading: 'idle', 
  createLoading: 'idle',
  deleteLoading: {},
  notificationLoading: {},
  error: null,
  createError: null,
  deleteError: {},
  notificationError: {},
  notificationUpdateLoading: {},
  notificationUpdateError: {},
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

// <<< ДОБАВЛЕНО: Thunk для создания события >>>
export const createEventThunk = createAsyncThunk<
  EventRead,             // Возвращаем созданное событие
  EventCreate,           // Принимаем данные для создания
  { rejectValue: string }
>(
  'events/createEvent',
  async (eventData, { rejectWithValue }) => {
    try {
      const createdEvent = await apiCreateEvent(eventData);
      return createdEvent;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create event');
    }
  }
);

// <<< ДОБАВЛЕНО: Thunk для удаления события >>>
export const deleteEventThunk = createAsyncThunk<
  number,                // Возвращаем ID удаленного события
  number,                // Принимаем ID события для удаления
  { rejectValue: string; state: RootState } // Добавляем state для optimistic update
>(
  'events/deleteEvent',
  async (eventId, { rejectWithValue, getState }) => {
    // Optional: Optimistic update (удаляем сразу)
    // const previousEvents = getState().events.items;
    try {
      await apiDeleteEvent(eventId);
      return eventId; // Возвращаем ID при успехе
    } catch (error: any) {
      // Optional: Rollback optimistic update
      return rejectWithValue(error.message || 'Failed to delete event');
    }
  }
);

// <<< ДОБАВЛЕНО: Thunk для создания уведомления >>>
export const createNotificationThunk = createAsyncThunk<
  { eventId: number; notification: EventNotification }, // Возвращаем ID события и созданное уведомление
  { eventId: number; notificationData: NotificationCreate }, // Принимаем ID и данные
  { rejectValue: string }
>(
  'events/createNotification',
  async ({ eventId, notificationData }, { rejectWithValue }) => {
    try {
      const createdNotification = await apiCreateNotification(eventId, notificationData);
      // Возвращаем ID события и ПОЛНОЕ уведомление (с ID), полученное от API
      return { eventId, notification: createdNotification }; 
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create notification');
    }
  }
);

// <<< ДОБАВЛЕНО: Thunk для обновления уведомления >>>
export const updateNotificationThunk = createAsyncThunk<
  { eventId: number; notification: EventNotification }, // Возвращаем ID события и обновленное уведомление
  { eventId: number; notificationId: string; notificationData: NotificationUpdate }, // Принимаем ID события, ID уведомления и данные
  { rejectValue: string }
>(
  'events/updateNotification',
  async ({ eventId, notificationId, notificationData }, { rejectWithValue }) => {
    try {
      const updatedNotification = await apiUpdateNotification(eventId, notificationId, notificationData);
      // Возвращаем ID события и ПОЛНОЕ обновленное уведомление
      return { eventId, notification: updatedNotification }; 
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update notification');
    }
  }
);

// Создаем срез (slice)
const eventsSlice = createSlice({
  name: 'events', 
  initialState,
  reducers: {
    // Редьюсеры addEvent, updateEvent, removeEvent, addNotification
    // остаются как есть, но будут вызываться из extraReducers
    addEvent: (state, action: PayloadAction<EventRead>) => {
      state.items.unshift(action.payload);
    },
    updateEvent: (state, action: PayloadAction<{ id: number; changes: Partial<EventRead> }>) => {
      const { id, changes } = action.payload;
      const existingEvent = state.items.find(event => event.id === id);
      if (existingEvent) {
        Object.assign(existingEvent, changes);
      }
    },
    removeEvent: (state, action: PayloadAction<number>) => {
      const idToRemove = action.payload;
      state.items = state.items.filter(event => event.id !== idToRemove);
    },
    // addNotification теперь обновляет/добавляет уведомление, полученное от API
    addNotification: (state, action: PayloadAction<{ eventId: number; notification: EventNotification }>) => {
      const { eventId, notification } = action.payload;
      const event = state.items.find(e => e.id === eventId);
      if (event) {
        if (!event.notifications) {
          event.notifications = [];
        }
        // Проверяем, есть ли уже уведомление с таким ID (на случай редактирования)
        const existingIndex = event.notifications.findIndex(n => n.id === notification.id);
        if (existingIndex > -1) {
          event.notifications[existingIndex] = notification; // Обновляем
        } else {
          event.notifications.push(notification); // Добавляем новое
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // --- Fetch Events --- 
      .addCase(fetchEvents.pending, (state) => {
        state.loading = 'pending';
        state.error = null; 
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload ?? 'Unknown error occurred';
      })
      // --- Create Event --- 
      .addCase(createEventThunk.pending, (state) => {
        state.createLoading = 'pending';
        state.createError = null;
      })
      .addCase(createEventThunk.fulfilled, (state, action) => {
        state.createLoading = 'succeeded';
        // Используем редьюсер addEvent для добавления
        eventsSlice.caseReducers.addEvent(state, action);
      })
      .addCase(createEventThunk.rejected, (state, action) => {
        state.createLoading = 'failed';
        state.createError = action.payload ?? 'Unknown error occurred';
      })
      // --- Delete Event --- 
      .addCase(deleteEventThunk.pending, (state, action) => {
        const eventId = action.meta.arg;
        state.deleteLoading[eventId] = 'pending';
        state.deleteError[eventId] = null;
        // Optional: Optimistic update
        // eventsSlice.caseReducers.removeEvent(state, { type: 'events/removeEvent', payload: eventId });
      })
      .addCase(deleteEventThunk.fulfilled, (state, action) => {
        const eventId = action.payload;
        state.deleteLoading[eventId] = 'succeeded';
        // Если не было optimistic update, удаляем здесь
        eventsSlice.caseReducers.removeEvent(state, action);
        // Очищаем состояние загрузки/ошибки после успеха
        delete state.deleteLoading[eventId]; 
        delete state.deleteError[eventId];
      })
      .addCase(deleteEventThunk.rejected, (state, action) => {
        const eventId = action.meta.arg;
        state.deleteLoading[eventId] = 'failed';
        state.deleteError[eventId] = action.payload ?? 'Unknown error occurred';
        // Optional: Rollback optimistic update (нужно будет сохранить previousEvents)
      })
      // --- Create Notification --- 
      .addCase(createNotificationThunk.pending, (state, action) => {
        const { eventId } = action.meta.arg;
        state.notificationLoading[eventId] = 'pending';
        state.notificationError[eventId] = null;
      })
      .addCase(createNotificationThunk.fulfilled, (state, action) => {
        const { eventId } = action.payload;
        state.notificationLoading[eventId] = 'succeeded';
        // Используем редьюсер addNotification для добавления/обновления
        eventsSlice.caseReducers.addNotification(state, action);
        delete state.notificationLoading[eventId];
        delete state.notificationError[eventId];
      })
      .addCase(createNotificationThunk.rejected, (state, action) => {
        const { eventId } = action.meta.arg;
        state.notificationLoading[eventId] = 'failed';
        state.notificationError[eventId] = action.payload ?? 'Unknown error occurred';
      })
      // --- Update Notification --- 
      .addCase(updateNotificationThunk.pending, (state, action) => {
        const { notificationId } = action.meta.arg;
        state.notificationUpdateLoading[notificationId] = 'pending';
        state.notificationUpdateError[notificationId] = null;
      })
      .addCase(updateNotificationThunk.fulfilled, (state, action) => {
        const { notification } = action.payload;
        state.notificationUpdateLoading[notification.id] = 'succeeded';
        // Используем существующий редьюсер addNotification для обновления данных в стейте
        eventsSlice.caseReducers.addNotification(state, action);
        // Очищаем состояние загрузки/ошибки после успеха
        delete state.notificationUpdateLoading[notification.id]; 
        delete state.notificationUpdateError[notification.id];
      })
      .addCase(updateNotificationThunk.rejected, (state, action) => {
        const { notificationId } = action.meta.arg;
        state.notificationUpdateLoading[notificationId] = 'failed';
        state.notificationUpdateError[notificationId] = action.payload ?? 'Unknown error occurred';
      });
  },
});

// <<< ЭКСПОРТИРУЕМ РЕДЬЮСЕРЫ и THUNKS >>>
// Экспортируем actions, так как они используются для оптимистичных обновлений и заглушек
export const { addEvent, updateEvent, removeEvent, addNotification } = eventsSlice.actions;

// Экспортируем редьюсер по умолчанию
export default eventsSlice.reducer;

// --- Селекторы для доступа к данным ---
export const selectAllEvents = (state: RootState): EventRead[] => state.events.items;
// <<< ОБНОВЛЕНО: Селекторы для новых состояний загрузки/ошибки >>>
export const selectEventsLoading = (state: RootState): 'idle' | 'pending' | 'succeeded' | 'failed' => state.events.loading;
export const selectEventsError = (state: RootState): string | null => state.events.error;
export const selectEventCreateLoading = (state: RootState): 'idle' | 'pending' | 'succeeded' | 'failed' => state.events.createLoading;
export const selectEventCreateError = (state: RootState): string | null => state.events.createError;
export const selectEventDeleteLoading = (state: RootState, eventId: number): boolean => state.events.deleteLoading[eventId] === 'pending';
export const selectEventDeleteError = (state: RootState, eventId: number): string | null => state.events.deleteError[eventId] ?? null;
export const selectNotificationCreateLoading = (state: RootState, eventId: number): boolean => state.events.notificationLoading[eventId] === 'pending';
export const selectNotificationCreateError = (state: RootState, eventId: number): string | null => state.events.notificationError[eventId] ?? null;
// <<< ДОБАВЛЕНО: Селекторы для состояния обновления уведомлений >>>
export const selectNotificationUpdateLoading = (state: RootState, notificationId: string): boolean => state.events.notificationUpdateLoading[notificationId] === 'pending';
export const selectNotificationUpdateError = (state: RootState, notificationId: string): string | null => state.events.notificationUpdateError[notificationId] ?? null; 