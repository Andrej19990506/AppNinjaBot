import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { socketService } from '../../services/socket';
import { AppDispatch } from '../store';
import { ReserveShift, IncomingReserveData } from '../../types/shifts';
import { 
    getReserves as getReservesApi, 
    deleteReserve as deleteReserveApi // Импортируем
} from '../../services/courierApi';

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

// const API_BASE_URL = config.API_URL || '';

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
    async (_, { rejectWithValue }) => {
        try {
            console.log('[reservesSlice] Загрузка резервов...');
            
            // Вызываем новую функцию
            const apiReserves = await getReservesApi();
            
            // Преобразуем данные с сервера в формат ReserveShift
            const formattedReserves = apiReserves.map((reserve: any) => ({
                id: reserve.id || '',
                userId: String(reserve.user_id || ''),
                date: reserve.date || '',
                photo_url: reserve.photo_url || null,
                firstName: reserve.first_name || '',
                lastName: reserve.last_name || '',
                created_at: reserve.created_at || new Date().toISOString(),
                isSeniorCourier: reserve.is_senior_courier || false
            }));

            console.log('[reservesSlice] Резервы получены и отформатированы:', formattedReserves);
            return formattedReserves;

        } catch (error) {
            let errorMessage = 'Неизвестная ошибка при загрузке резервов';
             if (error instanceof Error) {
                 errorMessage = error.message;
             }
            console.error('[reservesSlice] Ошибка при загрузке резервов:', errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

// Добавим функцию для принудительного обновления резервов (вызывается после добавления нового резерва)
export const forceFetchReserves = createAsyncThunk(
    'reserves/forceFetchReserves',
    async (_, { rejectWithValue }) => {
        try {
            console.log('[reservesSlice] Принудительное обновление резервов...');
            
             // Вызываем новую функцию
             const apiReserves = await getReservesApi();

             // Преобразуем данные с сервера в формат ReserveShift
             const formattedReserves = apiReserves.map((reserve: any) => ({
                 id: reserve.id || '',
                 userId: String(reserve.user_id || ''),
                 date: reserve.date || '',
                 photo_url: reserve.photo_url || null,
                 firstName: reserve.first_name || '',
                 lastName: reserve.last_name || '',
                 created_at: reserve.created_at || new Date().toISOString(),
                 isSeniorCourier: reserve.is_senior_courier || false
             }));

             console.log('[reservesSlice] Резервы принудительно обновлены и отформатированы:', formattedReserves);
            return formattedReserves;
        } catch (error) {
             let errorMessage = 'Неизвестная ошибка при принудительном обновлении резервов';
             if (error instanceof Error) {
                 errorMessage = error.message;
             }
            console.error('[reservesSlice] Ошибка при принудительном обновлении резервов:', errorMessage);
             return rejectWithValue(errorMessage);
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
export const removeFromReserve = createAsyncThunk<
    { success: boolean; reserveId: string; userId: string; chatId?: string }, // Тип возвращаемого значения
    { reserveId: string; userId: string; chatId?: string }, // Тип аргумента
    { rejectValue: string } // Тип конфига
>(
    'reserves/removeFromReserve',
    async ({ reserveId, userId, chatId }, { rejectWithValue }) => {
        try {
            console.log('[reservesSlice] Удаление из резерва (API): ', { reserveId, userId, chatId });
            
            // Отправляем WebSocket событие (оставляем пока?)
            // socketService.emit('remove_from_reserve', {
            //     reserve_id: reserveId,
            //     user_id: userId,
            //     chat_id: chatId
            // });
            
            // Вызываем API для удаления
            await deleteReserveApi(reserveId);

            // Старый код с fetch
            /*
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
            */

            console.log(`[reservesSlice] Резерв ID: ${reserveId} успешно удален через API.`);
            // Возвращаем данные для возможной обработки в extraReducers или компонентах
            return {
                success: true,
                reserveId,
                userId,
                chatId
            };
        } catch (error) {
            let errorMessage = 'Неизвестная ошибка при удалении резерва';
             if (error instanceof Error) {
                 errorMessage = error.message;
             }
            console.error('[reservesSlice] Ошибка при удалении из резерва:', errorMessage);
            return rejectWithValue(errorMessage);
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
let reserveUnsubscribeFunctions: (() => void)[] = [];

// Функция подписки на события резервов (вызывается ПОСЛЕ connect из ListenerMiddleware)
export const subscribeToReserveEvents = (dispatch: AppDispatch): (() => void) => {
    console.log('🔄 [reservesSlice] Настройка подписок на события резервов (вызвана после connect)');
    // Очищаем старые подписки, если есть
    // Не нужно очищать здесь, т.к. мы возвращаем функцию очистки
    // unsubscribeFromReserveEvents(); 

    const handleReserveAdded = (data: IncomingReserveData) => {
        console.log('🟢 [reservesSlice] Получено событие: reserve_added', data);
        dispatch(reserveAdded(data)); 
    };

    const handleReserveRemoved = (data: { id: string; userId: string; }) => {
        console.log('🔴 [reservesSlice] Получено событие: reserve_removed', data);
        dispatch(reserveDeleted(data)); 
    };

    const handleBulkReserveRemoved = (data: { reserveIds: string[]; userId: string; }) => {
        console.log('🟠 [reservesSlice] Получено событие: bulk_reserve_removed', data);
        data.reserveIds.forEach(rid => 
            dispatch(reserveDeleted({ id: rid, userId: data.userId }))
        );
    };

    const handleReserveTransferred = (data: { 
        id: string; // Сервер должен присылать id резерва, который удаляется
        userId: string; 
        // ... остальные поля не обязательны для удаления
    }) => {
        console.log('🔵 [reservesSlice] Получено событие: reserve_transferred_to_shift', data);
        dispatch(reserveDeleted({ id: data.id, userId: data.userId })); 
    };

    // Временный массив для хранения функций отписки этой конкретной сессии подписки
    const currentUnsubscribeFunctions: (() => void)[] = [];

    // Подписываемся на события и сохраняем функции отписки
    currentUnsubscribeFunctions.push(socketService.subscribe('reserve_added', handleReserveAdded));
    currentUnsubscribeFunctions.push(socketService.subscribe('reserve_removed', handleReserveRemoved));
    currentUnsubscribeFunctions.push(socketService.subscribe('bulk_reserve_removed', handleBulkReserveRemoved));
    currentUnsubscribeFunctions.push(socketService.subscribe('reserve_transferred_to_shift', handleReserveTransferred));
    
    console.log('✅ [reservesSlice] Подписки на события резервов установлены.');

    // Возвращаем функцию, которая отпишется от всех событий, созданных в этом вызове
    return () => {
        console.log(`🧹 [reservesSlice] Отписка от ${currentUnsubscribeFunctions.length} событий резервов (из конкретного useEffect)...`);
        currentUnsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
};

// Функция для отписки от ВСЕХ событий резервов (может быть не нужна теперь?)
// Оставим пока на всякий случай, если где-то используется напрямую
export const unsubscribeFromReserveEvents = () => {
    if (reserveUnsubscribeFunctions.length > 0) {
        console.warn(`🧹 [reservesSlice] ВНИМАНИЕ: Вызвана глобальная отписка unsubscribeFromReserveEvents. Убедитесь, что это необходимо.`);
        // console.log(`🧹 [reservesSlice] Отписка от ${reserveUnsubscribeFunctions.length} событий резервов...`);
        reserveUnsubscribeFunctions.forEach(unsubscribe => unsubscribe());
        reserveUnsubscribeFunctions = [];
    }
};

export const { 
    reserveAdded, 
    reserveDeleted,
    reserveUpdated,
    reservesUpdated,
} = reservesSlice.actions;
export default reservesSlice.reducer; 