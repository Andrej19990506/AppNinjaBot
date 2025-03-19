import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { socketService } from '../../services/socket';
import { ReserveShift } from '../../types/shifts';
import { PayloadAction } from '@reduxjs/toolkit';
import config from '../../config';

const API_BASE_URL = config.API_URL;

// Вспомогательная функция для подписки на события
const subscribeToEvent = (event: string, callback: (data: any) => void) => {
    socketService.subscribe(event, callback);
};

interface ShiftState {
    shifts: CourierShift[];
    reserves: ReserveShift[];
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
}

interface BookShiftParams {
    date: string;
    userId: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
    existingShiftId?: string;
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
}

const initialState: ShiftState = {
    shifts: [],
    reserves: [],
    loading: false,
    error: null
};

// Асинхронные thunks
export const fetchShifts = createAsyncThunk(
    'shifts/fetchShifts',
    async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/shifts`);
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
                    slotIndex: shift.slot_index
                }));
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
    async (bookingData: BookShiftParams, { getState }) => {
        try {
            console.log('[shiftsSlice] Booking shift:', bookingData);
            const state = getState() as RootState;
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
                last_name: user.last_name || ''
            };

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
    async (shiftId: string, { rejectWithValue }) => {
        try {
            // Отправляем событие через WebSocket
            socketService.emit('cancel_shift', { shift_id: shiftId });
            
            // Также отправляем HTTP запрос для надежности
            const response = await fetch(`${API_BASE_URL}/api/shifts/${shiftId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to cancel shift');
            }

            return shiftId;
        } catch (error) {
            console.error('Error canceling shift:', error);
            return rejectWithValue(error instanceof Error ? error.message : 'Failed to cancel shift');
        }
    }
);

export const removeFromReserve = createAsyncThunk(
    'shifts/removeFromReserve',
    async (params: { reserveId: string; userId: string }) => {
        try {
            console.log('[shiftsSlice] Removing from reserve:', params);
            
            // Отправляем событие через WebSocket
            socketService.emit('remove_from_reserve', {
                reserve_id: params.reserveId,
                user_id: params.userId
            });
            
            return params.reserveId;
        } catch (error) {
            console.error('[shiftsSlice] Failed to remove from reserve:', error);
            throw error;
        }
    }
);

const shiftsSlice = createSlice({
    name: 'shifts',
    initialState,
    reducers: {
        shiftBooked(state, action: PayloadAction<ShiftBookedPayload>) {
            const shiftData = action.payload;
            console.log('[shiftsSlice] Processing shiftBooked action:', shiftData);
            
            // Преобразуем данные в формат CourierShift
            const newShift: CourierShift = {
                id: shiftData.id,
                userId: shiftData.user_id,
                photo_url: shiftData.photo_url,
                firstName: shiftData.first_name,
                lastName: shiftData.last_name,
                date: shiftData.date,
                shiftType: shiftData.shift_type,
                slotIndex: shiftData.slot_index
            };

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
        reserveAdded: (state, action: PayloadAction<any>) => {
            const reserve = action.payload;
            console.log('[shiftsSlice] Processing reserveAdded action:', reserve);
            
            // Убедимся, что все поля сохранены корректно
            const formattedReserve: ReserveShift = {
                id: reserve.id,
                userId: reserve.userId || reserve.user_id || '', // Поддержка обоих форматов
                date: reserve.date,
                photo_url: reserve.photo_url || null,
                firstName: reserve.firstName || reserve.first_name || '',
                lastName: reserve.lastName || reserve.last_name || '',
                created_at: reserve.created_at || new Date().toISOString()
            };
            
            const existingReserve = state.reserves.find(r => r.id === formattedReserve.id);
            if (existingReserve) {
                Object.assign(existingReserve, formattedReserve);
            } else {
                state.reserves.push(formattedReserve);
            }
            
            console.log('[shiftsSlice] Reserve added/updated in state:', formattedReserve);
        },
        reserveDeleted: (state, action: PayloadAction<string>) => {
            const reserveId = action.payload;
            console.log('[shiftsSlice] Deleting reserve with ID:', reserveId);
            
            // Удаляем резерв из состояния по ID
            state.reserves = state.reserves.filter(reserve => String(reserve.id) !== String(reserveId));
            
            console.log('[shiftsSlice] Reserves after deletion:', state.reserves);
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
            })
            .addCase(removeFromReserve.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(removeFromReserve.fulfilled, (state, action) => {
                // Преобразуем к числу, если передается строковый ID
                const reserveIdToRemove = typeof action.payload === 'string' ? 
                    parseInt(action.payload, 10) : action.payload;
                
                // Фильтруем резервы, удаляя тот, у которого совпадает ID
                state.reserves = state.reserves.filter(reserve => reserve.id !== reserveIdToRemove);
                state.loading = false;
            })
            .addCase(removeFromReserve.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to remove from reserve';
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
export const reserveAdded = shiftsSlice.actions.reserveAdded;
export const reserveDeleted = shiftsSlice.actions.reserveDeleted;

// WebSocket подписки
export const subscribeToShiftEvents = (dispatch: any) => {
    subscribeToEvent('shift_booked', (data) => {
        console.log('[shiftsSlice] Received shift_booked event:', data);
        dispatch(shiftBooked(data));
    });
    subscribeToEvent('shift_updated', (data) => {
        console.log('[shiftsSlice] Received shift_updated event:', data);
        dispatch(shiftBooked(data)); // Используем тот же редьюсер для обработки обновлений
    });
    subscribeToEvent('shift_cancelled', (data) => {
        console.log('[shiftsSlice] Received shift_cancelled event:', data);
        dispatch(shiftCanceled(data));
    });
    
    // Сохраняем обработку reserve_added для обновления состояния смен
    socketService.on('reserve_added', (reserve: ReserveShift) => {
        console.log('[shiftsSlice] Received reserve_added event:', reserve);
        dispatch(reserveAdded(reserve));
    });
    
    // Добавляем обработчик для reserve_deleted чтобы удалять резервы из состояния
    socketService.on('reserve_deleted', (data: { reserve_id: string }) => {
        console.log('[shiftsSlice] Received reserve_deleted event:', data);
        
        // Удаляем резерв из состояния
        dispatch(reserveDeleted(data.reserve_id));
    });
};

export const unsubscribeFromShiftEvents = () => {
    socketService.off('shift_booked');
    socketService.off('shift_updated');
    socketService.off('shift_cancelled');
    socketService.off('reserve_added');
    socketService.off('reserve_deleted');
};

export default shiftsSlice.reducer; 