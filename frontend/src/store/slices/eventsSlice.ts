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

// Определяем тип для состояния среза (ID везде number)
interface EventsState {
  items: EventRead[];
  loading: 'idle' | 'pending' | 'succeeded' | 'failed';
  createLoading: 'idle' | 'pending' | 'succeeded' | 'failed';
  deleteLoading: { [id: number]: 'pending' | 'succeeded' | 'failed' }; // id: number
  notificationLoading: { [eventId: number]: 'pending' | 'succeeded' | 'failed' }; // eventId: number
  error: string | null;
  createError: string | null;
  deleteError: { [id: number]: string | null }; // id: number
  notificationError: { [eventId: number]: string | null }; // eventId: number
  notificationUpdateLoading: { [notificationId: string]: 'pending' | 'succeeded' | 'failed' }; // notificationId: string (UUID)
  notificationUpdateError: { [notificationId: string]: string | null }; // notificationId: string (UUID)
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

// Thunk для загрузки событий (без изменений)
export const fetchEvents = createAsyncThunk<
  EventRead[], 
  void, 
  { rejectValue: string }
>(
  'events/fetchEvents',
  async (_, { rejectWithValue }) => {
    try {
      const events = await apiGetEvents();
      return events;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch events');
    }
  }
);

// Thunk для создания события (без изменений, возвращает EventRead с id: number)
export const createEventThunk = createAsyncThunk<
  EventRead,            
  EventCreate,          
  { rejectValue: string }
>(
  'events/createEvent',
  async (eventData, { rejectWithValue }) => {
    try {
      const createdEvent = await apiCreateEvent(eventData);
      return createdEvent; // Ожидаем, что ID здесь number
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create event');
    }
  }
);

// Thunk для удаления события (принимает и возвращает number)
export const deleteEventThunk = createAsyncThunk<
  number,               
  number,               
  { rejectValue: string }
>(
  'events/deleteEvent',
  async (eventId, { rejectWithValue }) => {
    try {
      await apiDeleteEvent(eventId);
      return eventId; 
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete event');
    }
  }
);

// Thunk для создания уведомления (принимает eventId: number)
export const createNotificationThunk = createAsyncThunk<
  { eventId: number; notification: EventNotification }, 
  { eventId: number; notificationData: NotificationCreate }, 
  { rejectValue: string }
>(
  'events/createNotification',
  async ({ eventId, notificationData }, { rejectWithValue }) => {
    try {
      const createdNotification = await apiCreateNotification(eventId, notificationData);
      return { eventId, notification: createdNotification }; 
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create notification');
    }
  }
);

// Thunk для обновления уведомления (принимает eventId: number, notificationId: string)
export const updateNotificationThunk = createAsyncThunk<
  { eventId: number; notification: EventNotification }, 
  { eventId: number; notificationId: string; notificationData: NotificationUpdate },
  { rejectValue: string }
>(
  'events/updateNotification',
  async ({ eventId, notificationId, notificationData }, { rejectWithValue }) => {
    try {
      const updatedNotification = await apiUpdateNotification(eventId, notificationId, notificationData);
      return { eventId, notification: updatedNotification }; 
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update notification');
    }
  }
);

// Создаем срез
const eventsSlice = createSlice({
  name: 'events', 
  initialState,
  // Только базовые редьюсеры для управления состоянием ПОСЛЕ ответа API
  reducers: {
    // Добавляет событие, полученное от API (после createEventThunk)
    addEvent: (state, action: PayloadAction<EventRead>) => {
      // Проверяем, нет ли уже такого ID (на всякий случай)
      if (!state.items.some(item => item.id === action.payload.id)) {
         state.items.unshift(action.payload);
      }
    },
    // Удаляет событие по ID (после deleteEventThunk)
    removeEvent: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter(event => event.id !== action.payload);
    },
    // Обновляет/добавляет уведомление (после create/update NotificationThunk)
    updateEventNotification: (state, action: PayloadAction<{ eventId: number; notification: EventNotification }>) => {
      const { eventId, notification } = action.payload;
      const event = state.items.find(e => e.id === eventId);
      if (event) {
        if (!event.notifications) {
          event.notifications = [];
        }
        const existingIndex = event.notifications.findIndex(n => n.id === notification.id);
        if (existingIndex > -1) {
          event.notifications[existingIndex] = notification;
        } else {
          event.notifications.push(notification);
        }
      }
    },
    // Редьюсер для обновления полей самого события (если понадобится thunk для updateEvent)
    // updateEventFields: (state, action: PayloadAction<{ id: number; changes: Partial<EventRead> }>) => {
    //   const { id, changes } = action.payload;
    //   const existingEvent = state.items.find(event => event.id === id);
    //   if (existingEvent) {
    //     Object.assign(existingEvent, changes);
    //   }
    // },
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
        // Используем редьюсер addEvent для добавления СОХРАНЕННОГО события
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
      })
      .addCase(deleteEventThunk.fulfilled, (state, action) => {
        const eventId = action.payload;
        state.deleteLoading[eventId] = 'succeeded';
        // Используем редьюсер removeEvent для удаления СОХРАНЕННОГО события
        eventsSlice.caseReducers.removeEvent(state, action);
        delete state.deleteLoading[eventId]; 
        delete state.deleteError[eventId];
      })
      .addCase(deleteEventThunk.rejected, (state, action) => {
        const eventId = action.meta.arg;
        state.deleteLoading[eventId] = 'failed';
        state.deleteError[eventId] = action.payload ?? 'Unknown error occurred';
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
        // Используем редьюсер updateEventNotification для добавления уведомления
        eventsSlice.caseReducers.updateEventNotification(state, action);
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
        const { notificationId } = action.meta.arg;
        state.notificationUpdateLoading[notificationId] = 'succeeded';
         // Используем редьюсер updateEventNotification для обновления уведомления
        eventsSlice.caseReducers.updateEventNotification(state, action);
        delete state.notificationUpdateLoading[notificationId];
        delete state.notificationUpdateError[notificationId];
      })
      .addCase(updateNotificationThunk.rejected, (state, action) => {
        const { notificationId } = action.meta.arg;
        state.notificationUpdateLoading[notificationId] = 'failed';
        state.notificationUpdateError[notificationId] = action.payload ?? 'Unknown error occurred';
      });
  },
});

// Экспортируем только редьюсеры, которые могут быть нужны извне (если такие есть)
// Обычно для slice нужны только thunks и selectors
// export const { addEvent, removeEvent, updateEventNotification } = eventsSlice.actions;

// Селекторы (используем number для eventId)
export const selectAllEvents = (state: RootState): EventRead[] => state.events.items;
// Селектор по ID (принимает number)
export const selectEventById = (id: number) => (state: RootState): EventRead | undefined => state.events.items.find(event => event.id === id);
export const selectEventsLoading = (state: RootState): 'idle' | 'pending' | 'succeeded' | 'failed' => state.events.loading;
export const selectEventsError = (state: RootState): string | null => state.events.error;
export const selectEventCreateLoading = (state: RootState): 'idle' | 'pending' | 'succeeded' | 'failed' => state.events.createLoading;
export const selectEventCreateError = (state: RootState): string | null => state.events.createError;
export const selectEventDeleteLoading = (state: RootState, eventId: number): boolean => state.events.deleteLoading[eventId] === 'pending';
export const selectEventDeleteError = (state: RootState, eventId: number): string | null => state.events.deleteError[eventId] ?? null;
export const selectNotificationCreateLoading = (state: RootState, eventId: number): boolean => state.events.notificationLoading[eventId] === 'pending';
export const selectNotificationCreateError = (state: RootState, eventId: number): string | null => state.events.notificationError[eventId] ?? null;
export const selectNotificationUpdateLoading = (state: RootState, notificationId: string): boolean => state.events.notificationUpdateLoading[notificationId] === 'pending';
export const selectNotificationUpdateError = (state: RootState, notificationId: string): string | null => state.events.notificationUpdateError[notificationId] ?? null; 

export default eventsSlice.reducer; 