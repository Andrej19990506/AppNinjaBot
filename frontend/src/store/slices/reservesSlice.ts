import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
// TODO: Импорт socketService временно закомментирован, используется только для типов
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import { socketService } from '../../services/socket';
// TODO: Импорт websocketHelper временно закомментирован, используются локальные заглушки
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import { subscribeToEvent, unsubscribeFromEvent } from '../../services/websocketHelper';
import config from '../../config';
import { AppDispatch } from '../store';
import { ReserveShift, IncomingReserveData } from '../../types/shifts';

// TODO: Временная заглушка для socketService
const socketService = {
    isConnected: () => false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    subscribe: (event: string, callback: Function) => {
        console.log('🔄 [socketService] Подписка временно недоступна');
        return () => console.log('🧹 [socketService] Отписка временно недоступна');
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    unsubscribe: (event: string) => {
        console.log(`🔄 [socketService] Отписка от события ${event} временно недоступна`);
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emit: (event: string, data?: any) => {
        console.log(`🔄 [socketService] Отправка события ${event} временно недоступна`);
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    off: (event: string, callback?: Function) => {
        console.log(`🔄 [socketService] Отписка от события ${event} временно недоступна`);
    }
};

// TODO: Временные заглушки для функций websocketHelper
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const subscribeToEvent = (event: string, callback: Function) => {
    console.log(`🔄 [websocketHelper] Подписка на событие ${event} временно недоступна`);
    return () => console.log(`🧹 [websocketHelper] Отписка от события ${event} временно недоступна`);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unsubscribeFromEvent = (event: string, callback: Function) => {
    console.log(`🔄 [websocketHelper] Отписка от события ${event} временно недоступна`);
};

const API_BASE_URL = config.API_URL || '';

// Интерфейс состояния
interface ReservesState {
    reserves: ReserveShift[];
    loading: boolean;
    error: string | null;
}

// Начальное состояние
const initialState: ReservesState = {
    reserves: [],
    loading: false,
    error: null
};

// Функция для загрузки резервов с сервера
export const fetchReserves = createAsyncThunk(
    'reserves/fetchReserves',
    async () => {
        try {
            console.log('[reservesSlice] Загрузка резервов с сервера...');
            const response = await fetch(`${API_BASE_URL}/reserves`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch reserves');
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const reservesData = await response.json();
                
                console.log('[reservesSlice] Получены резервы:', reservesData);
                
                // Преобразуем данные с сервера в формат ReserveShift
                const formattedReserves = reservesData.map((reserve: any) => ({
                    id: reserve.id || '',
                    userId: reserve.user_id || '',
                    date: reserve.date || '',
                    photo_url: reserve.photo_url || null,
                    firstName: reserve.first_name || '',
                    lastName: reserve.last_name || '',
                    created_at: reserve.created_at || new Date().toISOString(),
                    isSeniorCourier: reserve.is_senior_courier || false
                }));
                
                // Добавим более подробное логирование для проверки статуса курьера
                if (reservesData.length > 0 && formattedReserves.length > 0) {
                    console.log('[reservesSlice] Пример резерва:', {
                        original: reservesData[0],
                        formatted: formattedReserves[0],
                        isSeniorCourier: formattedReserves[0].isSeniorCourier
                    });
                }
                
                return formattedReserves;
            }
            
            return [];
        } catch (error) {
            console.error('[reservesSlice] Ошибка при загрузке резервов:', error);
            return [];
        }
    }
);

// Добавим функцию для принудительного обновления резервов (вызывается после добавления нового резерва)
export const forceFetchReserves = createAsyncThunk(
    'reserves/forceFetchReserves',
    async () => {
        try {
            console.log('[reservesSlice] Принудительное обновление резервов с сервера...');
            const response = await fetch(`${API_BASE_URL}/reserves`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch reserves');
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const reservesData = await response.json();
                
                console.log('[reservesSlice] Получены обновленные резервы:', reservesData);
                
                // Преобразуем данные с сервера в формат ReserveShift
                const formattedReserves = reservesData.map((reserve: any) => ({
                    id: reserve.id || '',
                    userId: reserve.user_id || '',
                    date: reserve.date || '',
                    photo_url: reserve.photo_url || null,
                    firstName: reserve.first_name || '',
                    lastName: reserve.last_name || '',
                    created_at: reserve.created_at || new Date().toISOString(),
                    isSeniorCourier: reserve.is_senior_courier || false
                }));
                
                return formattedReserves;
            }
            
            return [];
        } catch (error) {
            console.error('[reservesSlice] Ошибка при обновлении резервов:', error);
            return [];
        }
    }
);

// Функция для добавления в резерв
export const addToReserve = createAsyncThunk(
    'reserves/addToReserve',
    async ({ userId, date, chatId }: { userId: string; date: string; chatId: string }, { rejectWithValue, getState }) => {
        try {
            console.log('[reservesSlice] Добавление в резерв:', { userId, date, chatId });
            
            // Получаем информацию о пользователе из хранилища
            const state = getState() as RootState;
            const user = state.user.user;
            
            if (!user) {
                console.warn('[reservesSlice] Информация о пользователе недоступна при добавлении в резерв');
            }
            
            // Отправляем событие WebSocket с данными пользователя
            socketService.emit('add_to_reserve', {
                user_id: userId,
                date: date,
                chat_id: chatId,
                // Добавляем информацию о пользователе
                photo_url: user?.photo_url || null,
                first_name: user?.first_name || '',
                last_name: user?.last_name || ''
            });
            
            // Возвращаем оптимистический ответ с информацией о пользователе
            return {
                success: true,
                userId,
                date,
                chatId,
                photo_url: user?.photo_url || null,
                firstName: user?.first_name || '',
                lastName: user?.last_name || ''
            };
        } catch (error) {
            console.error('[reservesSlice] Ошибка при добавлении в резерв:', error);
            return rejectWithValue('Failed to add to reserve');
        }
    }
);

// Функция для удаления из резерва
export const removeFromReserve = createAsyncThunk(
    'reserves/removeFromReserve',
    async ({ reserveId, userId, chatId }: { reserveId: string; userId: string; chatId?: string }, { rejectWithValue }) => {
        try {
            console.log('[reservesSlice] Удаление из резерва:', { reserveId, userId, chatId });
            
            // Отправляем событие WebSocket
            socketService.emit('remove_from_reserve', {
                reserve_id: reserveId,
                user_id: userId,
                chat_id: chatId // Добавляем chat_id в запрос, если он есть
            });
            
            // Также отправляем HTTP запрос для надежности
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const response = await fetch(`${API_BASE_URL}/reserves/${reserveId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            // Таймаут для сброса состояния загрузки даже если событие WebSocket не пришло
            setTimeout(() => {
                return {
                    success: true,
                    reserveId,
                    userId,
                    chatId
                };
            }, 300);
            
            return {
                success: true,
                reserveId,
                userId,
                chatId
            };
        } catch (error) {
            console.error('[reservesSlice] Ошибка при удалении из резерва:', error);
            return rejectWithValue('Failed to remove from reserve');
        }
    }
);

export const reservesSlice = createSlice({
    name: 'reserves',
    initialState,
    reducers: {
        reserveAdded: (state, action: PayloadAction<IncomingReserveData>) => {
            const reserve = action.payload;
            console.log('[reservesSlice] Processing reserveAdded action:', reserve);
            
            // Проверяем, является ли резерв временным
            const isTemporary = reserve.id.startsWith('temp-');
            
            // Нормализуем данные резерва
            const normalizedReserve: ReserveShift = {
                ...reserve as any,
                id: reserve.id,
                userId: String(reserve.userId || reserve.user_id || ''),
                date: reserve.date,
                firstName: reserve.firstName || reserve.first_name || '',
                lastName: reserve.lastName || reserve.last_name || '',
                photo_url: reserve.photo_url || null,
                created_at: reserve.created_at || reserve.createdAt || new Date().toISOString(),
                isSeniorCourier: reserve.isSeniorCourier || reserve.is_senior_courier || false
            };
            
            // Если это временный резерв, добавляем его в список
            if (isTemporary) {
                state.reserves.push(normalizedReserve);
                console.log('[reservesSlice] Added temporary reserve:', normalizedReserve);
                return;
            }
            
            // Для постоянных резервов проверяем, существует ли уже резерв с таким ID
            const existingIndex = state.reserves.findIndex(r => r.id === reserve.id);
            
            if (existingIndex !== -1) {
                // Если резерв существует, обновляем его, сохраняя существующие данные пользователя
                const existingReserve = state.reserves[existingIndex];
                state.reserves[existingIndex] = {
                    ...normalizedReserve,
                    photo_url: normalizedReserve.photo_url || existingReserve.photo_url,
                    firstName: normalizedReserve.firstName || existingReserve.firstName,
                    lastName: normalizedReserve.lastName || existingReserve.lastName,
                    isSeniorCourier: normalizedReserve.isSeniorCourier || existingReserve.isSeniorCourier
                };
                console.log('[reservesSlice] Updated existing reserve:', state.reserves[existingIndex]);
            } else {
                // Если это новый резерв, добавляем его
                state.reserves.push(normalizedReserve);
                console.log('[reservesSlice] Added new reserve:', normalizedReserve);
            }
        },
        
        reserveDeleted: (state, action: PayloadAction<{ id?: string; userId?: string; date?: string }>) => {
            const deleteData = action.payload;
            console.log('[reservesSlice] Processing reserveDeleted action:', deleteData);
            
            if (deleteData.id) {
                state.reserves = state.reserves.filter(r => r.id !== deleteData.id);
            } else if (deleteData.userId && deleteData.date) {
                state.reserves = state.reserves.filter(
                    r => !(r.userId === deleteData.userId && r.date === deleteData.date)
                );
            }
        },
        
        reserveUpdated: (state, action: PayloadAction<IncomingReserveData>) => {
            const updatedReserve = action.payload;
            const index = state.reserves.findIndex(reserve => reserve.id === updatedReserve.id);
            if (index !== -1) {
                // Нормализуем данные перед обновлением
                state.reserves[index] = {
                    ...state.reserves[index],
                    userId: updatedReserve.userId || updatedReserve.user_id || state.reserves[index].userId,
                    firstName: updatedReserve.firstName || updatedReserve.first_name || state.reserves[index].firstName,
                    lastName: updatedReserve.lastName || updatedReserve.last_name || state.reserves[index].lastName,
                    created_at: updatedReserve.created_at || updatedReserve.createdAt || state.reserves[index].created_at,
                    isSeniorCourier: updatedReserve.isSeniorCourier || updatedReserve.is_senior_courier || state.reserves[index].isSeniorCourier
                };
            }
        },
        
        reservesUpdated: (state, action: PayloadAction<IncomingReserveData[]>) => {
            console.log('[reservesSlice] Получены обновленные резервы:', action.payload);
            
            // Нормализуем все резервы перед обновлением
            state.reserves = action.payload.map(reserve => {
                // Находим существующий резерв с тем же ID
                const existingReserve = state.reserves.find(r => r.id === reserve.id);
                
                // Создаем новый резерв, сохраняя существующие данные пользователя
                return {
                    id: reserve.id,
                    userId: String(reserve.userId || reserve.user_id || existingReserve?.userId || ''),
                    date: reserve.date,
                    photo_url: reserve.photo_url || existingReserve?.photo_url || null,
                    firstName: reserve.firstName || reserve.first_name || existingReserve?.firstName || '',
                    lastName: reserve.lastName || reserve.last_name || existingReserve?.lastName || '',
                    created_at: reserve.created_at || reserve.createdAt || existingReserve?.created_at || new Date().toISOString(),
                    isSeniorCourier: reserve.isSeniorCourier || reserve.is_senior_courier || existingReserve?.isSeniorCourier || false
                };
            });
        }
    },
    extraReducers: (builder) => {
        builder
            // Обработка fetchReserves
            .addCase(fetchReserves.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchReserves.fulfilled, (state, action) => {
                state.loading = false;
                state.reserves = action.payload;
            })
            .addCase(fetchReserves.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch reserves';
                console.error('[reservesSlice] Ошибка при загрузке резервов:', action.error);
            })
            
            // Обработка forceFetchReserves
            .addCase(forceFetchReserves.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(forceFetchReserves.fulfilled, (state, action) => {
                state.loading = false;
                state.reserves = action.payload;
            })
            .addCase(forceFetchReserves.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to force fetch reserves';
                console.error('[reservesSlice] Ошибка при принудительной загрузке резервов:', action.error);
            })
            
            // Обработка addToReserve
            .addCase(addToReserve.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addToReserve.fulfilled, (state) => {
                state.loading = false;
                // Фактическое обновление состояния произойдет через WebSocket событие
            })
            .addCase(addToReserve.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to add to reserve';
                console.error('[reservesSlice] Ошибка при добавлении в резерв:', action.error);
            })
            
            // Обработка removeFromReserve
            .addCase(removeFromReserve.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(removeFromReserve.fulfilled, (state) => {
                state.loading = false;
                // Фактическое обновление состояния произойдет через WebSocket событие
            })
            .addCase(removeFromReserve.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to remove from reserve';
                console.error('[reservesSlice] Ошибка при удалении из резерва:', action.error);
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
export const subscribeToReserveEvents = (dispatch: AppDispatch) => {
    console.log('[reservesSlice] 🎧 Setting up reserve event subscriptions...');
    
    socketService.subscribe('reserve_added', (data: IncomingReserveData) => {
        console.log('[reservesSlice] 🟢 reserve_added event received:', {
            data,
            timestamp: new Date().toISOString()
        });

        // Проверяем, является ли id строкой или числом
        const reserveId = String(data.id);
        
        // Нормализуем данные резерва
        const normalizedData: IncomingReserveData = {
            ...data,
            id: reserveId,
            userId: String(data.userId || data.user_id || ''),
            date: data.date,
            photo_url: data.photo_url || null,
            firstName: data.firstName || data.first_name || '',
            lastName: data.lastName || data.last_name || '',
            created_at: data.created_at || data.createdAt || new Date().toISOString(),
            isSeniorCourier: data.isSeniorCourier || data.is_senior_courier || false
        };
        
        // Проверяем, является ли это временным резервом
        if (reserveId.startsWith('temp-')) {
            console.log('[reservesSlice] 🔄 Updating temporary reserve:', reserveId);
            dispatch(reserveAdded(normalizedData));
        } else {
            console.log('[reservesSlice] ➕ Adding new reserve:', reserveId);
            dispatch(reserveAdded(normalizedData));
        }
    });

    socketService.subscribe('reserve_deleted', (data: { id?: string; userId?: string; date?: string }) => {
        console.log('[reservesSlice] 🔴 reserve_deleted event received:', {
            data,
            timestamp: new Date().toISOString()
        });
        dispatch(reserveDeleted(data));
    });

    socketService.subscribe('reserve_update', (data: IncomingReserveData) => {
        console.log('[reservesSlice] 🔄 reserve_update event received:', {
            data,
            timestamp: new Date().toISOString()
        });
        
        // Проверяем, является ли это обновлением временного резерва
        if (data.id && data.id.startsWith('temp-')) {
            console.log('[reservesSlice] 🔄 Processing temporary reserve update');
            dispatch(reserveUpdated(data));
        } else {
            dispatch(reserveUpdated(data));
        }
    });

    socketService.subscribe('reserve_update_all', (data: { reserves: IncomingReserveData[] }) => {
        console.log('[reservesSlice] 📣 reserve_update_all broadcast received:', {
            data,
            timestamp: new Date().toISOString()
        });
        
        // При получении полного обновления, обновляем все резервы
        if (data.reserves) {
            dispatch(reservesUpdated(data.reserves));
        }
    });

    return () => {
        console.log('[reservesSlice] 🔌 Unsubscribing from reserve events');
        socketService.unsubscribe('reserve_added');
        socketService.unsubscribe('reserve_deleted');
        socketService.unsubscribe('reserve_update');
        socketService.unsubscribe('reserve_update_all');
    };
};

export const unsubscribeFromReserveEvents = () => {
    console.log('[reservesSlice] 🔌 Отписка от событий резервов...');
    socketService.unsubscribe('reserve_added');
    socketService.unsubscribe('reserve_deleted');
    socketService.unsubscribe('reserve_update');
    socketService.unsubscribe('reserve_update_all');
    
    socketService.off('reserve_added');
    socketService.off('reserve_deleted');
    socketService.off('reserve_update');
    socketService.off('reserve_update_all');
};

export const { 
    reserveAdded, 
    reserveDeleted,
    reserveUpdated,
    reservesUpdated,
} = reservesSlice.actions;
export default reservesSlice.reducer; 