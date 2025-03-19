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
    shiftType: 'day' | 'night';
    slotIndex: number;
    userId: string;
    existingShiftId?: string;
}

interface AddToReserveParams {
    date: string;
    userId: string;
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

            // Если передан ID существующей смены, используем его для обновления
            if (bookingData.existingShiftId) {
                console.log('[shiftsSlice] Updating existing shift with ID:', bookingData.existingShiftId);
                socketService.emit('update_shift', {
                    ...socketData,
                    shift_id: bookingData.existingShiftId
                });
                return socketData;
            }

            // Проверяем, есть ли у пользователя уже смена на эту дату
            const existingShift = (state.shifts.shifts as CourierShift[]).find(
                shift => shift.date === bookingData.date && 
                String(shift.userId) === String(bookingData.userId)
            );

            if (existingShift) {
                // Если есть существующая смена, отправляем событие обновления
                console.log('[shiftsSlice] Updating existing shift:', existingShift.id);
                socketService.emit('update_shift', {
                    ...socketData,
                    shift_id: existingShift.id
                });
            } else {
                // Если нет существующей смены, создаем новую
                console.log('[shiftsSlice] Creating new shift');
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

export const addToReserve = createAsyncThunk(
    'shifts/addToReserve',
    async (params: AddToReserveParams) => {
        console.log('[shiftsSlice] addToReserve вызван с параметрами:', params);
        socketService.emit('add_to_reserve', params);
        return params;
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
        shiftCanceled: (state, action: PayloadAction<{ userId: string; date: string }>) => {
            state.shifts = state.shifts.filter(
                shift => !(shift.userId === action.payload.userId && 
                          shift.date === action.payload.date)
            );
        },
        reserveAdded: (state, action: PayloadAction<ReserveShift>) => {
            const reserve = action.payload;
            const existingReserve = state.reserves.find(r => r.id === reserve.id);
            if (existingReserve) {
                Object.assign(existingReserve, reserve);
            } else {
                state.reserves.push(reserve);
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
                state.shifts = state.shifts.filter(shift => String(shift.id) !== String(action.payload));
            })
            .addCase(addToReserve.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addToReserve.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(addToReserve.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to add to reserve';
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
    socketService.on('reserve_added', (reserve: ReserveShift) => {
        console.log('[shiftsSlice] Received reserve_added event:', reserve);
        dispatch(reserveAdded(reserve));
    });
};

export const unsubscribeFromShiftEvents = () => {
    socketService.off('shift_booked');
    socketService.off('shift_updated');
    socketService.off('shift_cancelled');
    socketService.off('reserve_added');
};

export default shiftsSlice.reducer; 