// @ts-nocheck
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { socketService } from '../../services/socket';
import config from '../../config';
import { format } from 'date-fns';
import { bookShift as bookShiftApi, cancelShift as cancelShiftApi, getShiftAccessSettings as getShiftAccessSettingsApi, updateShiftAccessSettings as updateShiftAccessSettingsApi, getShifts } from '../../services/courierApi';

// Импортируем действия из резервов для удаления оттуда при записи на смену
import { removeFromReserve } from './reservesSlice';

const API_BASE_URL = config.API_URL;

// Вспомогательная функция для подписки на события
const subscribeToEvent = (event: string, callback: (data: any) => void) => {
    socketService.subscribe(event, callback);
};

export interface AccessSettings {
    // ID чата
    chat_id?: string;              // ID чата для которого применяются настройки
    
    // Общие настройки
    allowMultipleShifts?: boolean;     // Разрешить запись на несколько смен
    autoApprove?: boolean;             // Автоматическое подтверждение записи
    allowSameDay?: boolean;            // Разрешить запись на текущий день
    
    // Настройки периода регистрации
    registrationStartDay?: number;     // День недели, с которого открывается запись (0-6)
    registrationStartHour?: number;    // Час начала регистрации (0-23)
    registrationStartMinute?: number;  // Минуты начала регистрации (0-59)
    
    // Гибкие настройки периода доступа
    offsetType?: 'days' | 'weeks' | 'none';     // Тип смещения (дни или недели)
    offsetAmount?: number;             // Величина смещения (сколько дней/недель)
    periodLength?: number;             // Длительность периода доступа (в днях)
    
    // Период активности правила
    isAlwaysActive?: boolean;          // Активно ли правило постоянно
    activeStartDate?: string;          // Дата начала активности правила
    activeEndDate?: string;            // Дата окончания активности правила
    
    // Старые поля (оставлены для обратной совместимости)
    daysAhead?: number;                // Количество дней вперед, доступных для записи (устаревшее)
    
    // Список конкретных дат, на которые можно записываться
    enabledDates?: string[];           // Массив дат в формате YYYY-MM-DD
    
    // Персональные ограничения
    restrictedUsers?: (string | number)[];  // Список ID пользователей с ограниченным доступом
    
    // Метаданные
    lastUpdated?: string;             // Время последнего обновления настроек
    updatedBy?: string | number;      // ID пользователя, обновившего настройки
}

interface ShiftState {
    shifts: CourierShift[];
    loading: boolean;
    error: string | null;
    shift_days: ShiftDayType[];
    accessSettings: AccessSettings;
    isLoadingSettings: boolean;
    settingsError: string | null;
}

interface CourierShift {
    id: string;
    userId: string;
    photo_url: string | null;
    firstName: string;
    lastName: string;
    date: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier: boolean;
}

interface BookShiftThunkParams {
    date: string;
    userId: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
    existingShiftId?: string;
    isDragAction?: boolean;
}

interface ShiftBookedPayload {
    id: string;
    user_id: string;
    photo_url: string | null;
    first_name: string;
    last_name: string;
    date: string;
    shift_type: 'day' | 'night';
    slot_index: number;
    is_senior_courier?: boolean;
}

// Обновим интерфейс ShiftDayType для включения дополнительных полей
interface ShiftDayType {
    date: string;
    day_shifts: ShiftType[];
    night_shifts: ShiftType[];
    // Другие поля, если есть
}

// Обновим интерфейс для локальных данных, которые приходят из компонента
interface ShiftTypeLocal {
    id?: string;
    userId?: string | number;
    user_id?: string | number;
    photo_url?: string | null;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    isSeniorCourier?: boolean;
    is_senior_courier?: boolean;
    slotIndex?: number;
    slot_index?: number;
    date?: string;
    shift_type?: 'day' | 'night';
}

// Обновим интерфейс ShiftType для включения всех необходимых полей
interface ShiftType {
    id?: string;
    user_id: string | number;
    photo_url?: string | null;
    first_name?: string;
    last_name?: string;
    is_senior_courier?: boolean;
    slot_index: number;
    date?: string;
    shift_type?: 'day' | 'night';
    // Другие поля, если есть
}

const initialState: ShiftState = {
    shifts: [],
    loading: false,
    error: null,
    shift_days: [],
    accessSettings: {
        allowMultipleShifts: false,
        autoApprove: false,
        allowSameDay: false,
        
        // Настройки периода регистрации
        registrationStartDay: 4, // Четверг
        registrationStartHour: 12, // 12:00
        registrationStartMinute: 0,
        
        // Новые гибкие настройки периода
        offsetType: 'weeks' as 'days' | 'weeks' | 'none',
        offsetAmount: 1,
        periodLength: 7,
        isAlwaysActive: true,
        
        // Старые поля для обратной совместимости
        daysAhead: 14, // 2 недели
        
        // Персональные ограничения
        restrictedUsers: []
    },
    isLoadingSettings: false,
    settingsError: null
};

// Глобальный EventEmitter для синхронизации компонентов
export const shiftEvents = {
  listeners: new Map<string, Set<Function>>(),
  
  emit(event: string, data: any) {
    console.log(`[shiftEvents] 📣 Emitting event ${event}:`, data);
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[shiftEvents] Error in listener for ${event}:`, error);
        }
      });
    }
  },
  
  on(event: string, callback: Function) {
    console.log(`[shiftEvents] 👂 Adding listener for ${event}`);
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    // Возвращаем функцию отписки
    return () => {
      console.log(`[shiftEvents] 🚫 Removing listener for ${event}`);
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }
};

// Асинхронные thunks
export const fetchShifts = createAsyncThunk(
    'shifts/fetchShifts',
    async (_, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const chatId = state.user.user?.groups && state.user.user.groups.length > 0 
            ? state.user.user.groups[0].chat_id 
            : undefined;

        if (chatId === undefined) {
            console.warn('[shiftsSlice] No chat_id available, cannot fetch shifts');
            return rejectWithValue('Chat ID not found');
        }

        try {
            console.log('[shiftsSlice] Fetching shifts for chat_id:', chatId);
            const shiftsData = await getShifts(chatId);
            console.log('[shiftsSlice] Fetched shifts via getShifts:', shiftsData);
            return shiftsData;
        } catch (error: any) {
            console.error('Error fetching shifts:', error.message || error);
            return rejectWithValue(error.message || 'Failed to fetch shifts');
        }
    }
);

export const bookShift = createAsyncThunk<
    CourierShift, // Тип возвращаемого значения при успехе
    BookShiftThunkParams, // Тип аргумента thunk
    { state: RootState; rejectValue: string } // Тип конфига thunk
>(
    'shifts/bookShift',
    async (params, { getState, rejectWithValue, dispatch }) => {
        const { date, userId, shiftType, slotIndex, existingShiftId, isDragAction } = params;
        const state = getState();
        const chatId = state.user.user?.groups && state.user.user.groups.length > 0
            ? state.user.user.groups[0].chat_id
            : undefined;

        console.log('[shiftsSlice] Booking shift with params:', params, 'chatId:', chatId);
        
        try {
            // Подготавливаем данные для API (snake_case)
            const apiData = {
                date: date,
                user_id: userId,
                shift_type: shiftType,
                slot_index: slotIndex,
                chat_id: chatId,
                existing_shift_id: existingShiftId
            };
            // Удаляем chatId и existing_shift_id, если они undefined
            if (!apiData.chat_id) delete (apiData as Partial<typeof apiData>).chat_id;
            if (!apiData.existing_shift_id) delete (apiData as Partial<typeof apiData>).existing_shift_id;

            // Вызываем новую функцию из courierApi
            // Примечание: В старом коде использовался WebSocket, здесь мы переходим на REST API вызов
            // Логика обработки резервов и drag-n-drop остается в thunk.
            console.log('[shiftsSlice] Calling bookShiftApi with data:', apiData);
            const bookedApiShift = await bookShiftApi(apiData);
            console.log('[shiftsSlice] Received response from bookShiftApi:', bookedApiShift);

            // Старый код с fetch и WebSocket (удален/закомментирован ниже)
            /*
            // ... (старый код fetch/websocket) ...
            */
            
            // Преобразуем ответ API (snake_case) в формат стейта (camelCase и userId)
            const bookedShift: CourierShift = {
                id: bookedApiShift.id,
                userId: String(bookedApiShift.user_id),
                photo_url: bookedApiShift.photo_url,
                firstName: bookedApiShift.first_name,
                lastName: bookedApiShift.last_name,
                date: bookedApiShift.date,
                shiftType: bookedApiShift.shift_type,
                slotIndex: bookedApiShift.slot_index,
                isSeniorCourier: bookedApiShift.is_senior_courier || false
            };

            console.log('[shiftsSlice] Shift booked/updated successfully via API:', bookedShift);

            // Логика удаления из резерва остается здесь, т.к. она связана со стейтом Redux
            if (!isDragAction) {
                 const reserveDate = format(new Date(date + 'T00:00:00'), 'yyyy-MM-dd');
                 console.log(`[shiftsSlice] Checking reserve for date: ${reserveDate}, user: ${userId}`);
                 const reserveExists = state.reserves.reserves.some(reserve => 
                     reserve.date === reserveDate && String(reserve.user_id) === String(userId)
                 );
                 if (reserveExists) {
                     console.log(`[shiftsSlice] User ${userId} was in reserve for ${reserveDate}, removing...`);
                     dispatch(removeFromReserve({ date: reserveDate, userId: String(userId) }));
                     // Опционально: Перезапросить резервы после удаления
                     // dispatch(forceFetchReserves()); 
                 }
             }

            // Возвращаем успешно обработанную смену
            return bookedShift;
        } catch (error) {
            // Обрабатываем ошибку, выброшенную из bookShiftApi
            let errorMessage = 'Неизвестная ошибка при бронировании смены';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            console.error('[shiftsSlice] Failed to book shift via API:', errorMessage);
            // Передаем сообщение об ошибке для обработки в rejected case
            return rejectWithValue(errorMessage);
        }
    }
);

export const cancelShift = createAsyncThunk<
    string, // Возвращаем ID удаленной смены при успехе
    { shiftId: string }, // Тип аргумента (chatId не нужен как параметр thunk, берем из state)
    { state: RootState; rejectValue: string } // Тип конфига
>(
    'shifts/cancelShift',
    async ({ shiftId }, { getState, rejectWithValue }) => {
        const state = getState();
        const chatId = state.user.user?.groups && state.user.user.groups.length > 0
            ? state.user.user.groups[0].chat_id
            : undefined;

        if (!chatId) {
            console.error('[shiftsSlice] Cannot cancel shift without chat_id');
            // Возвращаем сообщение об ошибке через rejectWithValue
            return rejectWithValue('Не удалось определить чат для отмены смены.');
        }

        console.log(`[shiftsSlice] Canceling shift ID: ${shiftId} in chat: ${chatId}`);
        try {
            // Вызываем новую функцию из courierApi
            await cancelShiftApi(shiftId, chatId);

            // Старый код с fetch (можно удалить или закомментировать)
            /*
            const response = await fetch(`${API_BASE_URL}/couriers/shifts/${shiftId}?chat_id=${chatId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                 let errorMsg = `Failed to cancel shift`;
                 try {
                     const errorJson = await response.json();
                     errorMsg = `Failed to cancel shift: ${JSON.stringify(errorJson)}`;
                 } catch (e) {
                     const errorText = await response.text();
                     errorMsg = `Failed to cancel shift: ${errorText || response.statusText}`;
                 }
                throw new Error(errorMsg);
            }
            */

            console.log(`[shiftsSlice] Shift ID: ${shiftId} cancelled successfully via API.`);
            // Возвращаем ID отмененной смены для обработки в extraReducers
            return shiftId;
        } catch (error) {
            let errorMessage = 'Неизвестная ошибка при отмене смены';
            // Извлекаем сообщение из ошибки, выброшенной cancelShiftApi
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            console.error(`[shiftsSlice] Failed to cancel shift ${shiftId}:`, errorMessage);
            // Передаем сообщение об ошибке через rejectWithValue
            return rejectWithValue(errorMessage);
        }
    }
);

// Функция для подтверждения смены
export const confirmShift = createAsyncThunk(
    'shifts/confirmShift',
    async (data: { shiftId: string; chatId?: string }, { rejectWithValue }) => {
        try {
            const { shiftId, chatId } = data;
            
            console.log('[shiftsSlice] Confirming shift:', { 
                shiftId, 
                chatId: chatId || 'not provided' 
            });
            
            // Отправляем событие через WebSocket с chatId, если он доступен
            socketService.emit('confirm_shift', { 
                shift_id: shiftId,
                chat_id: chatId
            });
            
            // По аналогии с cancel можно добавить HTTP запрос
            const response = await fetch(`${API_BASE_URL}/shifts/${shiftId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: chatId ? JSON.stringify({ chat_id: chatId }) : undefined
            });

            if (!response.ok) {
                throw new Error('Failed to confirm shift');
            }

            return shiftId;
        } catch (error) {
            console.error('Error confirming shift:', error);
            return rejectWithValue(error instanceof Error ? error.message : 'Failed to confirm shift');
        }
    }
);

// Thunk для загрузки настроек доступа к сменам
export const fetchAccessSettings = createAsyncThunk<
    AccessSettings, // Тип возвращаемого значения
    { chatId: string }, // Тип аргумента
    { rejectValue: string } // Тип конфига
>(
    'shifts/fetchAccessSettings',
    async ({ chatId }, { rejectWithValue }) => {
        try {
            console.log(`[shiftsSlice] 🔍 Запрос настроек доступа для чата ${chatId}`);
            
            // Вызываем новую функцию
            const settings = await getShiftAccessSettingsApi(chatId);
            
            // Старый код с fetch
            /*
            const url = chatId 
                ? `${API_BASE_URL}/couriers/access/settings?chat_id=${chatId}` 
                : `${API_BASE_URL}/couriers/access/settings`; // Запрос без chatId кажется нелогичным тут
            
            const response = await fetch(url);
            if (!response.ok) {
                let errorMsg = 'Не удалось загрузить настройки доступа';
                 try {
                     const errorData = await response.json();
                     console.error('❌ Ошибка при загрузке настроек:', {
                         status: response.status,
                         error: errorData
                     });
                     switch(errorData.code) {
                         case 'TABLE_NOT_EXISTS':
                             errorMsg = 'Таблица настроек не существует. Обратитесь к администратору.'; break;
                         case 'SETTINGS_NOT_FOUND':
                             errorMsg = 'Настройки не найдены для данного чата.'; break;
                         default:
                             errorMsg = errorData.error || errorMsg;
                     }
                 } catch (e) {
                     errorMsg = `Не удалось загрузить настройки: ${response.statusText}`;
                 }
                return rejectWithValue(errorMsg);
            }
            const data = await response.json();
            */
            
            console.log('[shiftsSlice] ✅ Получены настройки доступа:', settings);
            return settings;
        } catch (error: any) {
            let errorMessage = 'Неизвестная ошибка при загрузке настроек доступа';
             if (error instanceof Error) {
                 errorMessage = error.message;
             }
            console.error('[shiftsSlice] ❌ Ошибка загрузки настроек доступа:', errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

// Thunk для обновления настроек доступа к сменам
export const updateAccessSettings = createAsyncThunk<
    AccessSettings, // Тип возвращаемого значения
    Partial<AccessSettings>, // Тип аргумента - передаем настройки
    { rejectValue: string } // Тип конфига
>(
    'shifts/updateAccessSettings',
    async (settings, { rejectWithValue }) => {
        const chatId = settings.chat_id;
        if (!chatId) {
            return rejectWithValue('Не указан ID чата для сохранения настроек.');
        }

        try {
            console.log(`[shiftsSlice] 📊 Отправка настроек доступа для чата ${chatId}:`, settings);

            // Вызываем новую функцию API
            const updatedSettings = await updateShiftAccessSettingsApi(chatId, settings);

            // Старый код с fetch
            /*
            const response = await fetch(`${API_BASE_URL}/couriers/access/settings`, {
                method: 'POST', // Был POST
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settings), // Передавали все настройки в теле
            });
            
            if (!response.ok) {
                let errorMsg = 'Не удалось обновить настройки доступа';
                 try {
                     const errorData = await response.json();
                     console.error('❌ Ошибка при обновлении настроек:', {
                         status: response.status,
                         error: errorData
                     });
                     switch(errorData.code) {
                         case 'NO_DATA':
                             errorMsg = 'Не предоставлены данные для обновления настроек.'; break;
                         case 'NO_CHAT_ID': // Эта ошибка теперь обрабатывается в начале thunk
                             errorMsg = 'Не указан ID чата для настроек.'; break;
                         case 'TABLE_NOT_EXISTS':
                             errorMsg = 'Таблица настроек не существует.'; break;
                         case 'SETTINGS_NOT_FOUND':
                             errorMsg = 'Настройки не найдены для чата.'; break;
                         default:
                             errorMsg = errorData.error || errorMsg;
                     }
                 } catch(e) {
                    errorMsg = `Ошибка обновления настроек: ${response.statusText}`;
                 }
                return rejectWithValue(errorMsg);
            }
            
            const data = await response.json();
            */

            console.log('[shiftsSlice] ✅ Настройки доступа успешно обновлены:', updatedSettings);
            return updatedSettings;
        } catch (error: any) {
            let errorMessage = 'Неизвестная ошибка при обновлении настроек доступа';
             if (error instanceof Error) {
                 errorMessage = error.message;
             }
            console.error('[shiftsSlice] ❌ Ошибка при обновлении настроек доступа:', errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

const shiftsSlice = createSlice({
    name: 'shifts',
    initialState,
    reducers: {
        shiftBooked(state, action: PayloadAction<ShiftBookedPayload>) {
            const shiftData = action.payload;
            console.info('[shiftsSlice] Processing shiftBooked action:', shiftData);
            
            // Проверяем наличие флага старшего курьера
            const isSeniorCourier = shiftData.is_senior_courier !== undefined ? 
                shiftData.is_senior_courier : false;
                
            console.info('[shiftsSlice] Статус старшего курьера из данных:', {
                hasFlag: shiftData.is_senior_courier !== undefined,
                value: isSeniorCourier,
                rawData: shiftData.is_senior_courier
            });
            
            // Преобразуем данные в формат CourierShift
            const newShift: CourierShift = {
                id: shiftData.id,
                userId: shiftData.user_id,
                photo_url: shiftData.photo_url,
                firstName: shiftData.first_name,
                lastName: shiftData.last_name,
                date: shiftData.date,
                shiftType: shiftData.shift_type,
                slotIndex: shiftData.slot_index,
                isSeniorCourier: isSeniorCourier
            };
            
            // Добавляем отладочную информацию
            console.info('[shiftsSlice] Создание объекта смены со статусом курьера:', {
                original: shiftData,
                transformed: newShift,
                isSeniorCourier: newShift.isSeniorCourier
            });

            // Сначала удаляем все существующие смены пользователя на эту дату
            // независимо от типа смены (дневная или вечерняя)
            state.shifts = state.shifts.filter(shift => 
                !(shift.date === newShift.date && String(shift.userId) === String(newShift.userId))
            );
            
            // Добавляем новую смену
            state.shifts.push(newShift);
            
            console.log('[shiftsSlice] Shift updated in state. Current shifts:', state.shifts);
        },
        shiftCanceled: (state, action: PayloadAction<{ shift_id?: string; userId?: string; date?: string }>) => {
            // Проверка на разные форматы данных события отмены
            if (action.payload.shift_id) {
                // Если есть shift_id, фильтруем по нему
                console.log('[shiftsSlice] Canceling shift by ID:', action.payload.shift_id);
                state.shifts = state.shifts.filter(shift => String(shift.id) !== String(action.payload.shift_id));
            } else if (action.payload.userId && action.payload.date) {
                // Если есть userId и date, фильтруем по ним
                console.log('[shiftsSlice] Canceling shift by userId and date:', action.payload);
                state.shifts = state.shifts.filter(
                    shift => !(String(shift.userId) === String(action.payload.userId) && 
                              shift.date === action.payload.date)
                );
            } else {
                console.log('[shiftsSlice] Warning: Incomplete data for shift cancellation:', action.payload);
            }
        },
        // Удаление курьера из дневной смены
        removeDayShift: (state, action: PayloadAction<{ userId: string, slotIndex: number }>) => {
            console.log('shiftsSlice: Removing day shift', action.payload);
            // Находим день в массиве shift_days
            const currentDate = format(new Date(), 'yyyy-MM-dd');
            const dayIndex = state.shift_days.findIndex((day: ShiftDayType) => day.date === currentDate);

            if (dayIndex !== -1) {
                const day = state.shift_days[dayIndex];
                // Фильтруем дневные смены
                day.day_shifts = day.day_shifts.filter((shift: ShiftType) => 
                    !(String(shift.user_id) === String(action.payload.userId) && 
                      shift.slot_index === action.payload.slotIndex)
                );
                state.shift_days[dayIndex] = day;
            }
        },

        // Удаление курьера из ночной смены
        removeNightShift: (state, action: PayloadAction<{ userId: string, slotIndex: number }>) => {
            console.log('shiftsSlice: Removing night shift', action.payload);
            // Находим день в массиве shift_days
            const currentDate = format(new Date(), 'yyyy-MM-dd');
            const dayIndex = state.shift_days.findIndex((day: ShiftDayType) => day.date === currentDate);

            if (dayIndex !== -1) {
                const day = state.shift_days[dayIndex];
                // Фильтруем ночные смены
                day.night_shifts = day.night_shifts.filter((shift: ShiftType) => 
                    !(String(shift.user_id) === String(action.payload.userId) && 
                      shift.slot_index === action.payload.slotIndex)
                );
                state.shift_days[dayIndex] = day;
            }
        },

        // Удаление пользователя из всех смен
        removeUserFromAllShifts: (state, action: PayloadAction<{ userId: string }>) => {
            console.log('shiftsSlice: Removing user from all shifts', action.payload);
            // Находим день в массиве shift_days
            const currentDate = format(new Date(), 'yyyy-MM-dd');
            const dayIndex = state.shift_days.findIndex((day: ShiftDayType) => day.date === currentDate);

            if (dayIndex !== -1) {
                const day = state.shift_days[dayIndex];
                // Удаляем пользователя из всех смен
                day.day_shifts = day.day_shifts.filter((shift: ShiftType) => 
                    String(shift.user_id) !== String(action.payload.userId)
                );
                day.night_shifts = day.night_shifts.filter((shift: ShiftType) => 
                    String(shift.user_id) !== String(action.payload.userId)
                );
                state.shift_days[dayIndex] = day;
            }
        },

        // Добавление смены в дневной слот
        addDayShift: (state, action: PayloadAction<ShiftTypeLocal>) => {
            console.log('shiftsSlice: Adding day shift', action.payload);
            // Находим день в массиве shift_days
            const currentDate = format(new Date(), 'yyyy-MM-dd');
            const dayIndex = state.shift_days.findIndex((day: ShiftDayType) => day.date === currentDate);

            if (dayIndex !== -1) {
                const day = state.shift_days[dayIndex];
                
                // Конвертируем формат данных из локального состояния в формат Redux
                const shiftData: ShiftType = {
                    id: action.payload.id,
                    user_id: action.payload.user_id || action.payload.userId || '',
                    photo_url: action.payload.photo_url,
                    first_name: action.payload.first_name || action.payload.firstName || '',
                    last_name: action.payload.last_name || action.payload.lastName || '',
                    is_senior_courier: action.payload.is_senior_courier || action.payload.isSeniorCourier || false,
                    slot_index: action.payload.slot_index || action.payload.slotIndex || 0,
                    date: currentDate,
                    shift_type: 'day'
                };
                
                // Проверяем наличие дубликатов
                const existingShiftIndex = day.day_shifts.findIndex((shift: ShiftType) => 
                    String(shift.user_id) === String(shiftData.user_id) && 
                    shift.slot_index === shiftData.slot_index
                );
                
                // Если такая смена уже есть, обновляем её, иначе добавляем новую
                if (existingShiftIndex !== -1) {
                    day.day_shifts[existingShiftIndex] = shiftData;
                } else {
                    day.day_shifts.push(shiftData);
                }
                
                state.shift_days[dayIndex] = day;
            }
        },

        // Добавление смены в ночной слот
        addNightShift: (state, action: PayloadAction<ShiftTypeLocal>) => {
            console.log('shiftsSlice: Adding night shift', action.payload);
            // Находим день в массиве shift_days
            const currentDate = format(new Date(), 'yyyy-MM-dd');
            const dayIndex = state.shift_days.findIndex((day: ShiftDayType) => day.date === currentDate);

            if (dayIndex !== -1) {
                const day = state.shift_days[dayIndex];
                
                // Конвертируем формат данных из локального состояния в формат Redux
                const shiftData: ShiftType = {
                    id: action.payload.id,
                    user_id: action.payload.user_id || action.payload.userId || '',
                    photo_url: action.payload.photo_url,
                    first_name: action.payload.first_name || action.payload.firstName || '',
                    last_name: action.payload.last_name || action.payload.lastName || '',
                    is_senior_courier: action.payload.is_senior_courier || action.payload.isSeniorCourier || false,
                    slot_index: action.payload.slot_index || action.payload.slotIndex || 0,
                    date: currentDate,
                    shift_type: 'night'
                };
                
                // Проверяем наличие дубликатов
                const existingShiftIndex = day.night_shifts.findIndex((shift: ShiftType) => 
                    String(shift.user_id) === String(shiftData.user_id) && 
                    shift.slot_index === shiftData.slot_index
                );
                
                // Если такая смена уже есть, обновляем её, иначе добавляем новую
                if (existingShiftIndex !== -1) {
                    day.night_shifts[existingShiftIndex] = shiftData;
                } else {
                    day.night_shifts.push(shiftData);
                }
                
                state.shift_days[dayIndex] = day;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchShifts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchShifts.fulfilled, (state, action) => {
                state.loading = false;
                console.log('[shiftsSlice] Setting shifts in state:', action.payload);
                state.shifts = action.payload;
            })
            .addCase(fetchShifts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch shifts';
            })
            .addCase(bookShift.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(bookShift.fulfilled, (state, action) => {
                state.loading = false;
            })
            .addCase(bookShift.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to book shift';
            })
            .addCase(cancelShift.fulfilled, (state, action) => {
                // При успешной отмене смены - удаляем её из Redux store по ID
                console.log('[shiftsSlice] Removing shift with ID after cancelShift.fulfilled:', action.payload);
                state.shifts = state.shifts.filter(shift => String(shift.id) !== String(action.payload));
            })
            .addCase(fetchAccessSettings.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(fetchAccessSettings.fulfilled, (state, action) => {
                state.isLoadingSettings = false;
                
                // Проверяем, действительно ли настройки изменились
                const settings = action.payload;
                const currentSettings = state.accessSettings;
                
                // Сравниваем только важные поля, которые влияют на доступность
                const hasImportantChanges = 
                    settings.allowMultipleShifts !== currentSettings.allowMultipleShifts ||
                    settings.autoApprove !== currentSettings.autoApprove ||
                    settings.allowSameDay !== currentSettings.allowSameDay ||
                    settings.registrationStartDay !== currentSettings.registrationStartDay ||
                    settings.registrationStartHour !== currentSettings.registrationStartHour ||
                    settings.registrationStartMinute !== currentSettings.registrationStartMinute ||
                    settings.offsetType !== currentSettings.offsetType ||
                    settings.offsetAmount !== currentSettings.offsetAmount ||
                    settings.periodLength !== currentSettings.periodLength ||
                    settings.isAlwaysActive !== currentSettings.isAlwaysActive ||
                    settings.activeStartDate !== currentSettings.activeStartDate ||
                    settings.activeEndDate !== currentSettings.activeEndDate ||
                    settings.daysAhead !== currentSettings.daysAhead ||
                    JSON.stringify(settings.enabledDates) !== JSON.stringify(currentSettings.enabledDates) ||
                    JSON.stringify(settings.restrictedUsers) !== JSON.stringify(currentSettings.restrictedUsers);
                
                // Обновляем настройки только если есть важные изменения
                if (hasImportantChanges) {
                    state.accessSettings = {
                        ...currentSettings,
                        ...settings,
                        lastUpdated: settings.lastUpdated || currentSettings.lastUpdated
                    };
                    console.log('✅ Настройки доступа обновлены в Redux:', state.accessSettings);
                } else {
                    console.log('ℹ️ Настройки доступа не изменились, пропускаем обновление');
                }
            })
            .addCase(fetchAccessSettings.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload as string;
            })
            .addCase(updateAccessSettings.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(updateAccessSettings.fulfilled, (state, action) => {
                state.isLoadingSettings = false;
                
                // Убедимся, что абсолютно все настройки заменяются значениями из ответа сервера,
                // чтобы не остались значения по умолчанию из initialState
                const settings = action.payload;
                
                // Полностью заменяем все настройки (не используем простое присваивание, 
                // чтобы избежать сохранения старых значений, которых нет в новом объекте)
                state.accessSettings = {
                    // Общие настройки
                    allowMultipleShifts: settings.allowMultipleShifts,
                    autoApprove: settings.autoApprove,
                    allowSameDay: settings.allowSameDay,
                    
                    // Настройки периода регистрации
                    registrationStartDay: settings.registrationStartDay,
                    registrationStartHour: settings.registrationStartHour,
                    registrationStartMinute: settings.registrationStartMinute,
                    
                    // Гибкие настройки периода доступа
                    offsetType: settings.offsetType || 'days',
                    offsetAmount: settings.offsetAmount,
                    periodLength: settings.periodLength,
                    
                    // Период активности правила
                    isAlwaysActive: settings.isAlwaysActive,
                    activeStartDate: settings.activeStartDate,
                    activeEndDate: settings.activeEndDate,
                    
                    // Старые поля
                    daysAhead: settings.daysAhead,
                    
                    // Списки
                    enabledDates: settings.enabledDates || [],
                    restrictedUsers: settings.restrictedUsers || [],
                    
                    // Метаданные
                    lastUpdated: settings.lastUpdated
                };
                
                console.log('✅ Настройки доступа обновлены в Redux:', state.accessSettings);
            })
            .addCase(updateAccessSettings.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload as string;
            });
    }
});

// Селекторы
export const selectAllShifts = (state: RootState) => state.shifts.shifts;
export const selectShiftsByDate = (state: RootState, date: string) => 
    state.shifts.shifts.filter(shift => shift.date === date);
export const selectIsLoading = (state: RootState) => state.shifts.loading;
export const selectError = (state: RootState) => state.shifts.error;
export const selectAccessSettings = (state: RootState) => state.shifts.accessSettings;
export const selectIsLoadingSettings = (state: RootState) => state.shifts.isLoadingSettings;
export const selectSettingsError = (state: RootState) => state.shifts.settingsError;

export const shiftBooked = shiftsSlice.actions.shiftBooked;
export const shiftCanceled = shiftsSlice.actions.shiftCanceled;

// WebSocket подписки
export const subscribeToShiftEvents = (
    dispatch: any, 
    handlers?: {
        onShiftUpdated?: (data: any) => void;
        onShiftBooked?: (data: any) => void;
        onShiftCanceled?: (data: any) => void;
    }
) => {
    const unsubscribers = [
        subscribeToEvent('shift_booked', (data) => {
            console.log('[shiftsSlice] Received shift_booked event:', data);
            dispatch(shiftBooked(data));
            handlers?.onShiftBooked?.(data);
        }),
        subscribeToEvent('shift_updated', (data) => {
            console.log('[shiftsSlice] Received shift_updated event:', data);
            dispatch(shiftBooked(data)); // Используем тот же редьюсер для обработки обновлений
            handlers?.onShiftUpdated?.(data);
        }),
        subscribeToEvent('shift_cancelled', (data) => {
            console.log('[shiftsSlice] Received shift_cancelled event:', data);
            dispatch(shiftCanceled(data));
            handlers?.onShiftCanceled?.(data);
        })
    ];

    // Возвращаем функцию, которая вызывает все функции отписки
    return () => {
        console.log('[shiftsSlice] Unsubscribing from all shift events');
        unsubscribers.forEach(unsubscribe => {
            if (unsubscribe) { // Проверяем, что функция отписки существует
                unsubscribe(); 
            }
        });
    };
};

export const unsubscribeFromShiftEvents = () => {
    socketService.off('shift_booked');
    socketService.off('shift_updated');
    socketService.off('shift_cancelled');
};

export default shiftsSlice.reducer; 