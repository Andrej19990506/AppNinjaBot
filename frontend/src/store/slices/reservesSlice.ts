import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { socketService } from '../../services/socket';
import { subscribeToEvent, unsubscribeFromEvent } from '../../services/websocketHelper';
import config from '../../config';
import { AppDispatch } from '../store';

const API_BASE_URL = config.API_URL || '';

// Обновляем интерфейс ReserveShift
export interface ReserveShift {
    id: string;
    userId: string;
    date: string;
    photo_url: string | null;
    firstName: string;
    lastName: string;
    created_at: string;
    isSeniorCourier: boolean;
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

const reservesSlice = createSlice({
    name: 'reserves',
    initialState,
    reducers: {
        reserveAdded(state, action) {
            const reserveData = action.payload;
            console.log('[reservesSlice] Processing reserveAdded action:', reserveData);
            
            // Логируем детали для отладки полей is_senior_courier/isSeniorCourier
            console.log('[reservesSlice] Senior courier details:', {
                is_senior_courier: reserveData.is_senior_courier,
                is_senior_courier_type: typeof reserveData.is_senior_courier,
                isSeniorCourier: reserveData.isSeniorCourier,
                isSeniorCourier_type: typeof reserveData.isSeniorCourier
            });
            
            // Преобразуем данные в формат ReserveShift
            const newReserve: ReserveShift = {
                id: reserveData.id || String(Date.now()),
                userId: reserveData.userId || reserveData.user_id || '',
                date: reserveData.date,
                photo_url: reserveData.photo_url || null,
                firstName: reserveData.firstName || reserveData.first_name || '',
                lastName: reserveData.lastName || reserveData.last_name || '',
                created_at: reserveData.created_at || reserveData.createdAt || new Date().toISOString(),
                isSeniorCourier: reserveData.isSeniorCourier === true || reserveData.is_senior_courier === true
            };
            
            console.log('[reservesSlice] Processed reserve with isSeniorCourier:', newReserve.isSeniorCourier);

            // Проверяем, существует ли уже резерв с таким ID
            const existingReserveIndex = state.reserves.findIndex(reserve => 
                reserve.id === newReserve.id
            );

            if (existingReserveIndex !== -1) {
                // Обновляем существующий резерв
                state.reserves[existingReserveIndex] = newReserve;
            } else {
                // Проверяем, существует ли уже резерв для этого пользователя на эту дату
                const duplicateIndex = state.reserves.findIndex(reserve => 
                    reserve.userId === newReserve.userId && 
                    reserve.date === newReserve.date
                );
                
                if (duplicateIndex !== -1) {
                    // Заменяем дублирующийся резерв новым (с обновленным ID)
                    console.log('[reservesSlice] Replacing duplicate reserve for user and date');
                    state.reserves[duplicateIndex] = newReserve;
                } else {
                    // Добавляем новый резерв
                    state.reserves.push(newReserve);
                    console.log('[reservesSlice] Added new reserve, total count:', state.reserves.length);
                }
            }
        },
        reserveDeleted(state, action) {
            const deleteData = action.payload;
            console.log('[reservesSlice] Processing reserveDeleted action:', deleteData);
            
            if (deleteData.id) {
                // Удаляем резерв по ID
                console.log(`[reservesSlice] Deleting reserve by ID: ${deleteData.id}`);
                state.reserves = state.reserves.filter(reserve => reserve.id !== deleteData.id);
            } else if (deleteData.userId && deleteData.date) {
                // Удаляем резерв по userId и date
                console.log(`[reservesSlice] Deleting reserve by userId: ${deleteData.userId} and date: ${deleteData.date}`);
                state.reserves = state.reserves.filter(reserve => 
                    !(reserve.userId === deleteData.userId && reserve.date === deleteData.date)
                );
            } else {
                console.error('[reservesSlice] Incomplete data for reserve deletion:', deleteData);
            }
            
            console.log('[reservesSlice] Reserves after deletion:', state.reserves.length);
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
    console.log('[reservesSlice] 🔄 Subscribing to reserve events');
    
    const processReserveAddedData = (data: any) => {
        console.log('[reservesSlice] 📊 Processing reserve data:', data);
        
        // Для событий reserve_update и reserve_update_all данные находятся в поле data
        if (data.data && data.action === 'add') {
            console.log('[reservesSlice] 🔍 Found nested data in reserve_update event');
            return processReserveAddedData(data.data);
        }
        
        // Подробное логирование для отладки
        console.log('[reservesSlice] 🔍 Reserve data details:', { 
            data_type: typeof data,
            data_keys: Object.keys(data),
            user_id: data.user_id || data.userId,
            id: data.id,
            date: data.date
        });
        
        // Добавляем проверку на формат данных и создаем корректный объект для Redux
        const processedData = {
            id: data.id || String(Date.now()),
            user_id: data.user_id || data.userId,
            userId: data.user_id || data.userId,
            date: data.date,
            photo_url: data.photo_url,
            first_name: data.first_name || data.firstName,
            firstName: data.first_name || data.firstName,
            last_name: data.last_name || data.lastName,
            lastName: data.last_name || data.lastName,
            created_at: data.created_at || data.createdAt || new Date().toISOString(),
            is_senior_courier: data.is_senior_courier === true || data.isSeniorCourier === true,
            isSeniorCourier: data.is_senior_courier === true || data.isSeniorCourier === true
        };
        
        console.log('[reservesSlice] 📊 Processed reserve data:', processedData);
        
        // Обновляем Redux store
        dispatch(reserveAdded(processedData));
        return processedData;
    };
    
    const processReserveDeletedData = (data: any) => {
        console.log('[reservesSlice] 🔍 Processing reserve deletion data:', data);
        
        // Для событий reserve_update и reserve_update_all данные находятся в поле data
        if (data.data && data.action === 'remove') {
            console.log('[reservesSlice] 🔍 Found nested data in reserve_update event');
            return processReserveDeletedData(data.data);
        }
        
        // Обрабатываем разные форматы данных при удалении резерва
        if (data.id || data.reserve_id) {
            // Если есть ID резерва, удаляем по нему
            const reserveId = data.id || data.reserve_id;
            console.log(`[reservesSlice] ❌ Удаление резерва по ID: ${reserveId}`);
            dispatch(reserveDeleted({ id: reserveId }));
            return { id: reserveId };
        } else if ((data.user_id || data.userId) && data.date) {
            // Если нет ID, но есть ID пользователя и дата, удаляем по ним
            const userId = data.user_id || data.userId;
            console.log(`[reservesSlice] ❌ Удаление резерва по user_id: ${userId} и date: ${data.date}`);
            dispatch(reserveDeleted({ userId, date: data.date }));
            return { userId, date: data.date };
        } else {
            console.warn('[reservesSlice] ⚠️ Received incomplete data for reserve deletion:', data);
            return null;
        }
    };
    
    const onReserveAdded = (data: any) => {
        console.log('[reservesSlice] 🟢 WS event received: reserve_added', data);
        return processReserveAddedData(data);
    };
    
    const onReserveDeleted = (data: any) => {
        console.log('[reservesSlice] 🔴 WS event received: reserve_deleted', data);
        return processReserveDeletedData(data);
    };
    
    const onReserveUpdate = (data: any) => {
        console.log('[reservesSlice] 🔄 WS event received: reserve_update', data);
        
        if (data.action === 'add') {
            return processReserveAddedData(data);
        } else if (data.action === 'remove') {
            return processReserveDeletedData(data);
        } else {
            console.log('[reservesSlice] ⚠️ Unknown action in reserve_update:', data.action);
            // В случае неизвестного действия обновляем все резервы
            dispatch(forceFetchReserves());
            return null;
        }
    };
    
    const onReserveUpdateAll = (data: any) => {
        console.log('[reservesSlice] 📢 WS broadcast event received: reserve_update_all', data);
        
        // Обрабатываем broadcast-событие так же как и обычное reserve_update
        return onReserveUpdate(data);
    };
    
    // Подписываемся на WebSocket-события
    console.log('[reservesSlice] 📡 Setting up subscriptions for reserve events');
    socketService.on('reserve_added', onReserveAdded);
    socketService.on('reserve_deleted', onReserveDeleted);
    socketService.on('reserve_update', onReserveUpdate);
    socketService.on('reserve_update_all', onReserveUpdateAll);
    
    // Также подписываемся на совместимые события через socketService.subscribe
    socketService.subscribe('reserve_added', onReserveAdded);
    socketService.subscribe('reserve_deleted', onReserveDeleted);
    socketService.subscribe('reserve_update', onReserveUpdate);
    socketService.subscribe('reserve_update_all', onReserveUpdateAll);
    
    // Также подписываемся на события смен, чтобы удалять из резерва
    // когда пользователь записывается в смену
    socketService.on('shift_booked', (data: any) => {
        console.log('[reservesSlice] WS event received: shift_booked, checking if user is in reserve', data);
        
        // Если получено событие бронирования смены, нужно проверить,
        // есть ли текущий пользователь в резерве на эту дату и удалить его
        if (data.user_id && data.date) {
            // Вызываем глобальное обновление резервов, чтобы синхронизировать UI
            dispatch(forceFetchReserves());
        }
    });
    
    // Логирование состояния подписки
    console.log('[reservesSlice] ✅ Successfully subscribed to all reserve events');
    
    return () => {
        console.log('[reservesSlice] 🔌 Unsubscribing from reserve events');
        socketService.off('reserve_added', onReserveAdded);
        socketService.off('reserve_deleted', onReserveDeleted);
        socketService.off('reserve_update', onReserveUpdate);
        socketService.off('reserve_update_all', onReserveUpdateAll);
        socketService.off('shift_booked');
        
        // Отписываемся от событий через socketService.unsubscribe
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

export const { reserveAdded, reserveDeleted } = reservesSlice.actions;
export default reservesSlice.reducer; 