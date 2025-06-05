// frontend/src/store/slices/eventsSlice.ts
// Redux slice для управления событиями (мероприятия, уведомления, отчёты RetailiQA и др.).

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
    getEvents as apiGetEvents, 
    createEvent as apiCreateEvent,
    deleteEvent as apiDeleteEvent,
    createNotification as apiCreateNotification,
    updateNotification as apiUpdateNotification,
    processRetailiQAReportsForGroup as apiProcessRetailiQAReports
} from '../../features/Events/services/eventsApi'; 
import { EventRead, EventCreate, NotificationCreate, EventNotification, NotificationUpdate } from '../../types/event'; 
import { RootState } from '../../shared/store/store';

// --- Тип состояния ---
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
  processRetailiQALoading: 'idle' | 'pending' | 'succeeded' | 'failed';
  processRetailiQAError: string | null;
}

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
  processRetailiQALoading: 'idle',
  processRetailiQAError: null,
};

// --- Thunks: загрузка, создание, удаление событий и уведомлений, обработка RetailiQA ---
export const fetchEvents = createAsyncThunk<
  EventRead[], 
  string | undefined, 
  { rejectValue: string }
>(
  'events/fetchEvents',
  async (groupType, { rejectWithValue }) => {
    try {
      const events = await apiGetEvents(groupType);
      return events;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось загрузить события');
    }
  }
);

export const createEventThunk = createAsyncThunk<
  EventRead | EventRead[],
  EventCreate & { event_type?: string, chat_ids?: number[], group_telegram_id?: number, date_from?: string, date_to?: string, max_pages?: number },
  { rejectValue: string }
>(
  'events/createEvent',
  async (eventData, { rejectWithValue }) => {
    try {
      const createdEventOrEvents = await apiCreateEvent(eventData);
      return createdEventOrEvents; 
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось создать событие');
    }
  }
);

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
      return rejectWithValue(error.message || 'Не удалось удалить событие');
    }
  }
);

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
      return rejectWithValue(error.message || 'Не удалось создать уведомление');
    }
  }
);

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
      return rejectWithValue(error.message || 'Не удалось обновить уведомление');
    }
  }
);

export const processRetailiQAReportsThunk = createAsyncThunk<
  EventRead[],
  { groupTelegramId: number; dateFrom?: string; dateTo?: string; maxPages?: number },
  { rejectValue: string }
>(
  'events/processRetailiQAReports',
  async ({ groupTelegramId, dateFrom, dateTo, maxPages }, { dispatch, rejectWithValue }) => {
    try {
      const processedEvents = await apiProcessRetailiQAReports(groupTelegramId, dateFrom, dateTo, maxPages);
      return processedEvents;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Не удалось обработать отчёты RetailiQA');
    }
  }
);

// --- Основной slice событий ---
const eventsSlice = createSlice({
  name: 'events', 
  initialState,
  reducers: {
    addEvent: (state, action: PayloadAction<EventRead>) => {
      if (!state.items.some(item => item.id === action.payload.id)) {
         state.items.unshift(action.payload);
      }
    },
    removeEvent: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter(event => event.id !== action.payload);
    },
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
    mergeProcessedEvents: (state, action: PayloadAction<EventRead[]>) => {
      const newEvents = action.payload;
      newEvents.forEach(newEvent => {
        const existingEventIndex = state.items.findIndex(item => item.id === newEvent.id);
        if (existingEventIndex !== -1) {
          state.items[existingEventIndex] = newEvent;
        } else {
          state.items.unshift(newEvent);
        }
      });
      state.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    clearEvents: (state) => {
      state.items = [];
      state.loading = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
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
        state.error = action.payload ?? 'Неизвестная ошибка';
      })
      .addCase(createEventThunk.pending, (state) => {
        state.createLoading = 'pending';
        state.createError = null;
      })
      .addCase(createEventThunk.fulfilled, (state, action: PayloadAction<EventRead | EventRead[]>) => {
        state.createLoading = 'succeeded';
        if (Array.isArray(action.payload)) {
          eventsSlice.caseReducers.mergeProcessedEvents(state, action as PayloadAction<EventRead[]>);
        } else {
          eventsSlice.caseReducers.addEvent(state, action as PayloadAction<EventRead>);
        }
      })
      .addCase(createEventThunk.rejected, (state, action) => {
        state.createLoading = 'failed';
        state.createError = action.payload ?? 'Неизвестная ошибка';
      })
      .addCase(deleteEventThunk.pending, (state, action) => {
        const eventId = action.meta.arg;
        state.deleteLoading[eventId] = 'pending';
        state.deleteError[eventId] = null;
      })
      .addCase(deleteEventThunk.fulfilled, (state, action) => {
        const eventId = action.payload;
        state.deleteLoading[eventId] = 'succeeded';
        eventsSlice.caseReducers.removeEvent(state, action);
        delete state.deleteLoading[eventId]; 
        delete state.deleteError[eventId];
      })
      .addCase(deleteEventThunk.rejected, (state, action) => {
        const eventId = action.meta.arg;
        state.deleteLoading[eventId] = 'failed';
        state.deleteError[eventId] = action.payload ?? 'Неизвестная ошибка';
      })
      .addCase(createNotificationThunk.pending, (state, action) => {
        const { eventId } = action.meta.arg;
        state.notificationLoading[eventId] = 'pending';
        state.notificationError[eventId] = null;
      })
      .addCase(createNotificationThunk.fulfilled, (state, action) => {
        const { eventId } = action.payload;
        state.notificationLoading[eventId] = 'succeeded';
        eventsSlice.caseReducers.updateEventNotification(state, action);
        delete state.notificationLoading[eventId];
        delete state.notificationError[eventId];
      })
      .addCase(createNotificationThunk.rejected, (state, action) => {
        const { eventId } = action.meta.arg;
        state.notificationLoading[eventId] = 'failed';
        state.notificationError[eventId] = action.payload ?? 'Неизвестная ошибка';
      })
      .addCase(updateNotificationThunk.pending, (state, action) => {
        const { notificationId } = action.meta.arg;
        state.notificationUpdateLoading[notificationId] = 'pending';
        state.notificationUpdateError[notificationId] = null;
      })
      .addCase(updateNotificationThunk.fulfilled, (state, action) => {
        const { notificationId } = action.meta.arg;
        state.notificationUpdateLoading[notificationId] = 'succeeded';
        eventsSlice.caseReducers.updateEventNotification(state, action);
        delete state.notificationUpdateLoading[notificationId];
        delete state.notificationUpdateError[notificationId];
      })
      .addCase(updateNotificationThunk.rejected, (state, action) => {
        const { notificationId } = action.meta.arg;
        state.notificationUpdateLoading[notificationId] = 'failed';
        state.notificationUpdateError[notificationId] = action.payload ?? 'Неизвестная ошибка';
      })
      .addCase(processRetailiQAReportsThunk.pending, (state) => {
        state.processRetailiQALoading = 'pending';
        state.processRetailiQAError = null;
      })
      .addCase(processRetailiQAReportsThunk.fulfilled, (state, action: PayloadAction<EventRead[]>) => {
        state.processRetailiQALoading = 'succeeded';
        eventsSlice.caseReducers.mergeProcessedEvents(state, action);
      })
      .addCase(processRetailiQAReportsThunk.rejected, (state, action) => {
        state.processRetailiQALoading = 'failed';
        state.processRetailiQAError = action.payload ?? 'Неизвестная ошибка';
      });
  },
});

// --- Селекторы ---
export const selectAllEvents = (state: RootState): EventRead[] => state.events.items;
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
export const selectProcessRetailiQALoading = (state: RootState): 'idle' | 'pending' | 'succeeded' | 'failed' => state.events.processRetailiQALoading;
export const selectProcessRetailiQAError = (state: RootState): string | null => state.events.processRetailiQAError;

export const { addEvent, removeEvent, updateEventNotification, mergeProcessedEvents, clearEvents } = eventsSlice.actions;

export default eventsSlice.reducer; 