import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { socketService } from '../../services/socket';
import config from '../../config';

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

const initialState: ShiftState = {
    shifts: [],
    loading: false,
    error: null
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
            
            // Если пользователь в резерве, удаляем его оттуда перед записью на смену
            if (userReserve && userReserve.id) {
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
                    
                    console.log('[shiftsSlice] User successfully removed from reserve');
                } catch (reserveError) {
                    console.error('[shiftsSlice] Error removing from reserve:', reserveError);
                    // Продолжаем выполнение, даже если удаление из резерва не удалось
                }
            }
            
            // Получаем текущего пользователя
            const user = state.user.user;

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
            
            // Если передан конкретный ID существующей смены
            if (bookingData.existingShiftId) {
                // Проверяем, действительно ли такая смена существует в Redux store
                const shiftExists = existingShifts.some(shift => shift.id === bookingData.existingShiftId);
                
                if (shiftExists) {
                    console.log('[shiftsSlice] Updating existing shift:', bookingData.existingShiftId);
                    socketService.emit('update_shift', {
                        ...socketData,
                        shift_id: bookingData.existingShiftId
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
                    shift_id: existingShift.id
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
        }
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