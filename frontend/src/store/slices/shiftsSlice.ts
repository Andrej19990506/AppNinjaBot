import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { socketService } from '../../services/socket';
import config from '../../config';
import { format } from 'date-fns';

// Импортируем действия из резервов для удаления оттуда при записи на смену
import { removeFromReserve, forceFetchReserves } from './reservesSlice';

const API_BASE_URL = config.API_URL;

// Вспомогательная функция для подписки на события
const subscribeToEvent = (event: string, callback: (data: any) => void) => {
    socketService.subscribe(event, callback);
};

interface ShiftState {
    shifts: CourierShift[];
    loading: boolean;
    error: string | null;
    shift_days: ShiftDayType[];
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

interface BookShiftParams {
    date: string;
    userId: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
    existingShiftId?: string;
    chatId?: string;
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
    shift_days: []
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
    async (_, { getState }) => {
        try {
            // Получаем chat_id из state
            const state = getState() as RootState;
            const chatId = state.user.user?.groups && state.user.user.groups.length > 0 
                ? state.user.user.groups[0].chat_id 
                : undefined;

            if (!chatId) {
                console.warn('[shiftsSlice] No chat_id available, cannot fetch shifts');
                return [];
            }

            console.log('[shiftsSlice] Fetching shifts for chat_id:', chatId);
            const response = await fetch(`${API_BASE_URL}/shifts?chat_id=${chatId}`);
            const contentType = response.headers.get('content-type');
            
            if (!response.ok) {
                throw new Error('Failed to fetch shifts');
            }

            let shifts = [];
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                // Преобразуем данные в правильный формат
                shifts = data.map((shift: any) => ({
                    id: shift.id,
                    userId: typeof shift.user_id === 'string' ? parseInt(shift.user_id) : shift.user_id,
                    photo_url: shift.photo_url,
                    firstName: shift.first_name,
                    lastName: shift.last_name,
                    date: shift.date,
                    shiftType: shift.shift_type,
                    slotIndex: shift.slot_index,
                    isSeniorCourier: shift.is_senior_courier || false  // Получаем флаг статуса старшего курьера
                }));
                
                // Добавим более подробное логирование для проверки статуса курьера
                if (data.length > 0 && shifts.length > 0) {
                    console.log('[shiftsSlice] Пример смены:', {
                        original: data[0],
                        formatted: shifts[0],
                        isSeniorCourier: shifts[0].isSeniorCourier
                    });
                }
            }
            
            console.log('[shiftsSlice] Fetched and formatted shifts:', shifts);
            return shifts;
        } catch (error) {
            console.error('Error fetching shifts:', error);
            return [];
        }
    }
);

export const bookShift = createAsyncThunk(
    'shifts/bookShift',
    async (bookingData: BookShiftParams, { dispatch, getState }) => {
        try {
            console.log('[shiftsSlice] Booking shift:', bookingData);
            
            // Проверяем, есть ли пользователь в резерве на эту дату
            const state = getState() as RootState;
            const reserves = state.reserves.reserves;
            const userReserve = reserves.find(
                reserve => String(reserve.userId) === String(bookingData.userId) && 
                           reserve.date === bookingData.date
            );
            
            // Проверяем, является ли пользователь старшим курьером
            const user = state.user.user;
            const isCurrentUserSenior = user?.isSeniorCourier || false;
            
            console.log(`[shiftsSlice] isDragAction: ${bookingData.isDragAction}, isCurrentUserSenior: ${isCurrentUserSenior}`);
            
            // Если это drag action и пользователь старший, пропускаем проверки резерва
            if (bookingData.isDragAction && isCurrentUserSenior) {
                console.log('[shiftsSlice] Senior user drag action - bypassing reserve checks');
            }
            // Для обычных действий проверяем резерв
            else if (userReserve && userReserve.id) {
                console.log('[shiftsSlice] User is in reserve, removing from reserve first:', userReserve.id);
                
                try {
                    // Удаляем пользователя из резерва, используя chatId из параметров если доступен
                    await dispatch(removeFromReserve({
                        reserveId: String(userReserve.id),
                        userId: String(bookingData.userId),
                        chatId: bookingData.chatId
                    }));
                    
                    // Обновляем список резервов
                    dispatch(forceFetchReserves());
                    
                    // Эмитируем событие о переходе из резерва в смену для синхронизации компонентов
                    shiftEvents.emit('userMovedFromReserveToShift', {
                        userId: bookingData.userId,
                        date: bookingData.date,
                        chatId: bookingData.chatId,
                        shiftType: bookingData.shiftType,
                        slotIndex: bookingData.slotIndex
                    });
                    
                    console.log('[shiftsSlice] User successfully removed from reserve');
                } catch (reserveError) {
                    console.error('[shiftsSlice] Error removing from reserve:', reserveError);
                    // Продолжаем выполнение, даже если удаление из резерва не удалось
                }
            }
            
            // Получаем текущего пользователя
            if (!user) {
                throw new Error('User not found in state');
            }

            // Подготавливаем данные для WebSocket
            const socketData = {
                date: bookingData.date,
                shift_type: bookingData.shiftType,
                slot_index: bookingData.slotIndex,
                user_id: bookingData.userId,
                photo_url: user.photo_url || null,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                chat_id: bookingData.chatId,
                is_senior_courier: user.isSeniorCourier || false
            };

            // Добавляем подробное логирование статуса старшего курьера
            console.info('[shiftsSlice] Подготовка данных для WebSocket:', {
                userData: user,
                isSeniorCourier: user.isSeniorCourier,
                socketData: socketData
            });

            // Получаем существующие АКТИВНЫЕ смены пользователя на эту дату
            // Важно использовать именно те смены, которые есть в Redux store на данный момент
            const existingShifts = (state.shifts.shifts as CourierShift[]).filter(
                shift => shift.date === bookingData.date && 
                String(shift.userId) === String(bookingData.userId)
            );
            
            console.log('[shiftsSlice] Active shifts for user on this date:', existingShifts);
            
            // Если это операция перетаскивания (drag-and-drop)
            if (bookingData.isDragAction) {
                console.log('[shiftsSlice] Processing drag-and-drop operation with existingShiftId:', bookingData.existingShiftId);
                
                if (bookingData.existingShiftId) {
                    // Для drag-and-drop мы должны сохранить оригинальные данные курьера
                    // Находим оригинальную смену в store
                    const originalShift = (state.shifts.shifts as CourierShift[]).find(
                        shift => shift.id === bookingData.existingShiftId
                    );
                    
                    if (originalShift) {
                        console.log('[shiftsSlice] Found original shift data for drag-and-drop:', originalShift);
                        // Сохраняем оригинальные данные курьера
                        const dragData = {
                            date: bookingData.date,
                            shift_type: bookingData.shiftType,
                            slot_index: bookingData.slotIndex,
                            // Сохраняем оригинальные данные пользователя
                            user_id: originalShift.userId,
                            photo_url: originalShift.photo_url,
                            first_name: originalShift.firstName,
                            last_name: originalShift.lastName,
                            chat_id: bookingData.chatId,
                            is_senior_courier: originalShift.isSeniorCourier,
                            // Флаги для старшего курьера
                            is_senior_update: isCurrentUserSenior,
                            is_drag_action: true,
                            shift_id: bookingData.existingShiftId,
                        };
                        
                        console.log('[shiftsSlice] Updating shift via drag-and-drop with preserved user data:', dragData);
                        socketService.emit('update_shift', dragData);
                        return {
                            ...dragData,
                            userId: dragData.user_id,
                            firstName: dragData.first_name,
                            lastName: dragData.last_name,
                            shiftType: dragData.shift_type,
                            slotIndex: dragData.slot_index,
                            id: dragData.shift_id,
                            isSeniorCourier: dragData.is_senior_courier,
                        };
                    } else {
                        console.log('[shiftsSlice] Original shift not found in store, using available data');
                        // Если не нашли оригинальную смену, используем стандартную логику
                        socketService.emit('update_shift', {
                            ...socketData,
                            shift_id: bookingData.existingShiftId,
                            is_senior_update: isCurrentUserSenior,
                            is_drag_action: true
                        });
                        return socketData;
                    }
                } else if (existingShifts.length > 0) {
                    // Если id не передан, но есть смена пользователя на эту дату
                    const existingShift = existingShifts[0];
                    console.log('[shiftsSlice] Found existing shift to update via drag-and-drop:', existingShift.id);
                    socketService.emit('update_shift', {
                        ...socketData,
                        shift_id: existingShift.id,
                        is_senior_update: isCurrentUserSenior,
                        is_drag_action: true
                    });
                    return socketData;
                }
            }
            
            // Далее стандартная логика для обычных (не drag-and-drop) операций
            // Если передан конкретный ID существующей смены
            if (bookingData.existingShiftId) {
                // Проверяем, действительно ли такая смена существует в Redux store
                const shiftExists = existingShifts.some(shift => shift.id === bookingData.existingShiftId);
                
                if (shiftExists) {
                    console.log('[shiftsSlice] Updating existing shift:', bookingData.existingShiftId);
                    socketService.emit('update_shift', {
                        ...socketData,
                        shift_id: bookingData.existingShiftId,
                        is_senior_update: isCurrentUserSenior && bookingData.isDragAction, // Флаг для разрешения старшим курьерам перемещать чужие смены
                        is_drag_action: bookingData.isDragAction // Явно указываем, что это drag-and-drop операция
                    });
                } else {
                    // Если такой смены нет, значит она была отменена
                    // Создаем новую смену вместо обновления несуществующей
                    console.log('[shiftsSlice] Shift with ID', bookingData.existingShiftId, 'not found. Creating new shift instead.');
                    socketService.emit('book_shift', socketData);
                }
                
                return socketData;
            }

            // Если пользователь имеет активную смену на эту дату
            if (existingShifts.length > 0) {
                // Используем ID первой найденной смены
                const existingShift = existingShifts[0];
                console.log('[shiftsSlice] Found existing shift to update:', existingShift.id);
                socketService.emit('update_shift', {
                    ...socketData,
                    shift_id: existingShift.id,
                    is_senior_update: isCurrentUserSenior && bookingData.isDragAction, // Флаг для разрешения старшим курьерам перемещать чужие смены
                    is_drag_action: bookingData.isDragAction // Явно указываем, что это drag-and-drop операция
                });
            } else {
                // Если нет существующей смены, создаем новую
                console.log('[shiftsSlice] No existing shift found, creating new shift');
                socketService.emit('book_shift', socketData);
            }

            return socketData;
        } catch (error) {
            console.log('[shiftsSlice] Failed to book shift:', error);
            throw error;
        }
    }
);

export const cancelShift = createAsyncThunk(
    'shifts/cancelShift',
    async (shiftId: string | { shiftId: string, chatId?: string }, { rejectWithValue }) => {
        try {
            // Извлекаем shiftId и chatId из параметров
            let actualShiftId: string;
            let chatId: string | undefined;
            
            if (typeof shiftId === 'object') {
                actualShiftId = shiftId.shiftId;
                chatId = shiftId.chatId;
            } else {
                actualShiftId = shiftId;
            }
            
            console.log('[shiftsSlice] Canceling shift:', { 
                shiftId: actualShiftId, 
                chatId: chatId || 'not provided' 
            });
            
            // Отправляем событие через WebSocket с chatId, если он доступен
            socketService.emit('cancel_shift', { 
                shift_id: actualShiftId,
                chat_id: chatId
            });
            
            // Также отправляем HTTP запрос для надежности
            const response = await fetch(`${API_BASE_URL}/shifts/${actualShiftId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: chatId ? JSON.stringify({ chat_id: chatId }) : undefined
            });

            if (!response.ok) {
                throw new Error('Failed to cancel shift');
            }

            return actualShiftId;
        } catch (error) {
            console.error('Error canceling shift:', error);
            return rejectWithValue(error instanceof Error ? error.message : 'Failed to cancel shift');
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
            });
    }
});

// Селекторы
export const selectAllShifts = (state: RootState) => state.shifts.shifts;
export const selectShiftsByDate = (state: RootState, date: string) => 
    state.shifts.shifts.filter(shift => shift.date === date);
export const selectIsLoading = (state: RootState) => state.shifts.loading;
export const selectError = (state: RootState) => state.shifts.error;

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
    subscribeToEvent('shift_booked', (data) => {
        console.log('[shiftsSlice] Received shift_booked event:', data);
        dispatch(shiftBooked(data));
        handlers?.onShiftBooked?.(data);
    });
    subscribeToEvent('shift_updated', (data) => {
        console.log('[shiftsSlice] Received shift_updated event:', data);
        dispatch(shiftBooked(data)); // Используем тот же редьюсер для обработки обновлений
        handlers?.onShiftUpdated?.(data);
    });
    subscribeToEvent('shift_cancelled', (data) => {
        console.log('[shiftsSlice] Received shift_cancelled event:', data);
        dispatch(shiftCanceled(data));
        handlers?.onShiftCanceled?.(data);
    });
};

export const unsubscribeFromShiftEvents = () => {
    socketService.off('shift_booked');
    socketService.off('shift_updated');
    socketService.off('shift_cancelled');
};

export default shiftsSlice.reducer; 