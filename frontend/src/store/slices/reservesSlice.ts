import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { socketService } from '../../services/socket';
import { subscribeToEvent, unsubscribeFromEvent } from '../../services/websocketHelper';

// Обновляем интерфейс ReserveShift
interface ReserveShift {
    id: string;
    userId: string;
    date: string;
    photo_url: string | null;
    firstName: string;
    lastName: string;
    created_at: string;
}

interface ReserveState {
    reserves: ReserveShift[];
    loading: boolean;
    error: string | null;
}

const initialState: ReserveState = {
    reserves: [],
    loading: false,
    error: null
};

// Async thunks
export const addToReserve = createAsyncThunk(
    'reserves/addToReserve',
    async (params: { date: string; userId: string }, { getState }) => {
        try {
            console.log('[reservesSlice] addToReserve начинает выполнение с параметрами:', params);
            const state = getState() as RootState;
            const user = state.user.user;

            if (!user) {
                console.error('[reservesSlice] Ошибка: пользователь не найден в состоянии Redux');
                throw new Error('User not found in state');
            }

            // Подготавливаем данные для WebSocket
            const reserveData = {
                date: params.date,
                user_id: params.userId,
                photo_url: user.photo_url || null,
                first_name: user.first_name || '',
                last_name: user.last_name || ''
            };
            
            console.log('[reservesSlice] Отправка данных через WebSocket:', reserveData);

            // Отправляем событие через WebSocket с подтверждением
            return new Promise<ReserveShift>((resolve, reject) => {
                socketService.emitWithAck('add_to_reserve', reserveData, (response: any) => {
                    console.log('[reservesSlice] Получен ответ от сервера:', response);
                    if (response && response.error) {
                        console.error('[reservesSlice] Ошибка от сервера:', response.error);
                        reject(response.error);
                    } else if (response && response.data) {
                        console.log('[reservesSlice] Успешно добавлено в резерв:', response.data);
                        
                        // Убедимся, что все поля заполнены
                        const reserve: ReserveShift = {
                            id: response.data.id,
                            userId: response.data.user_id || params.userId,
                            date: response.data.date || params.date,
                            photo_url: response.data.photo_url || user.photo_url || null,
                            firstName: response.data.first_name || user.first_name || '',
                            lastName: response.data.last_name || user.last_name || '',
                            created_at: response.data.created_at || new Date().toISOString()
                        };
                        
                        resolve(reserve);
                    } else {
                        console.log('[reservesSlice] Успешно, но нет данных в ответе');
                        // Если нет данных в ответе, создаем "временный" объект резерва
                        const tempReserve: ReserveShift = {
                            id: Date.now().toString(), // временный ID
                            userId: params.userId,
                            date: params.date,
                            photo_url: user.photo_url || null,
                            firstName: user.first_name || '',
                            lastName: user.last_name || '',
                            created_at: new Date().toISOString()
                        };
                        resolve(tempReserve);
                    }
                });
            });
        } catch (error) {
            console.error('[reservesSlice] Ошибка при добавлении в резерв:', error);
            throw error;
        }
    }
);

export const removeFromReserve = createAsyncThunk(
    'reserves/removeFromReserve',
    async (params: { reserveId: string; userId: string }) => {
        try {
            console.log('[reservesSlice] removeFromReserve с параметрами:', params);
            
            // Отправляем событие через WebSocket
            return new Promise<string>((resolve, reject) => {
                socketService.emitWithAck('remove_from_reserve', {
                    reserve_id: params.reserveId,
                    user_id: params.userId
                }, (response: any) => {
                    console.log('[reservesSlice] Ответ на remove_from_reserve:', response);
                    if (response && response.error) {
                        reject(response.error);
                    } else {
                        resolve(params.reserveId);
                    }
                });
            });
        } catch (error) {
            console.error('[reservesSlice] Failed to remove from reserve:', error);
            throw error;
        }
    }
);

const reservesSlice = createSlice({
    name: 'reserves',
    initialState,
    reducers: {
        reserveAdded(state, action) {
            const reserveData = action.payload;
            console.log('[reservesSlice] Processing reserveAdded action:', reserveData);
            
            // Преобразуем данные в формат ReserveShift
            const newReserve: ReserveShift = {
                id: reserveData.id,
                userId: reserveData.user_id || reserveData.userId,
                date: reserveData.date,
                photo_url: reserveData.photo_url || null,
                firstName: reserveData.first_name || reserveData.firstName || '',
                lastName: reserveData.last_name || reserveData.lastName || '',
                created_at: reserveData.created_at || reserveData.createdAt || new Date().toISOString()
            };

            // Проверяем, существует ли уже резерв с таким ID
            const existingReserveIndex = state.reserves.findIndex(reserve => 
                reserve.id === newReserve.id
            );

            if (existingReserveIndex !== -1) {
                // Обновляем существующий резерв
                state.reserves[existingReserveIndex] = newReserve;
            } else {
                // Добавляем новый резерв
                state.reserves.push(newReserve);
            }
            
            console.log('[reservesSlice] Reserve successfully added/updated in state');
        },
        reserveDeleted(state, action) {
            const reserveId = action.payload.reserve_id;
            state.reserves = state.reserves.filter(reserve => reserve.id !== reserveId);
            console.log('[reservesSlice] Reserve removed from state');
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(addToReserve.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addToReserve.fulfilled, (state, action) => {
                state.loading = false;
                // Обработка успешного добавления в резерв происходит через WebSocket событие
            })
            .addCase(addToReserve.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to add to reserve';
            })
            .addCase(removeFromReserve.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(removeFromReserve.fulfilled, (state, action) => {
                state.loading = false;
                // Обработка успешного удаления из резерва происходит через WebSocket событие
            })
            .addCase(removeFromReserve.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to remove from reserve';
            });
    }
});

// Selectors
export const selectAllReserves = (state: RootState) => state.reserves.reserves;
export const selectReservesByDate = (state: RootState, date: string) => 
    state.reserves.reserves.filter(reserve => reserve.date === date);
export const selectIsLoading = (state: RootState) => state.reserves.loading;
export const selectError = (state: RootState) => state.reserves.error;

// WebSocket event subscriptions
export const subscribeToReserveEvents = (dispatch: any) => {
    console.log('🔌 Подписка на события резервов...');
    
    subscribeToEvent('reserve_added', (reserve: ReserveShift) => {
        console.log('📡 Получено событие reserve_added:', reserve);
        dispatch(reservesSlice.actions.reserveAdded(reserve));
    });

    subscribeToEvent('reserve_deleted', (data: { reserve_id: string }) => {
        console.log('📡 Получено событие reserve_deleted:', data);
        console.log('📡 Удаляем резерв с ID:', data.reserve_id);
        dispatch(reservesSlice.actions.reserveDeleted(data));
    });
};

export const unsubscribeFromReserveEvents = () => {
    console.log('🔌 Отписка от событий резервов...');
    socketService.unsubscribe('reserve_added');
    socketService.unsubscribe('reserve_deleted');
};

export const { reserveAdded, reserveDeleted } = reservesSlice.actions;
export default reservesSlice.reducer; 