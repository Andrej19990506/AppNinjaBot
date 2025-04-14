import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store'; // Импортируем типы стора
import { ReserveEntry } from '../../types/shifts'; // Наш внутренний тип резерва
import {
    getReserves,
    addReserve,
    deleteReserve,
    ApiReserve // Тип резерва, который приходит от API
} from '../../services/courierApi'; // Функции для общения с API
import { logger } from '../../utils/logger';
import { format } from 'date-fns';
// Импортируем необходимое из shiftsSlice
import { cancelShift, selectAllShifts } from './shiftsSlice';

// Функция для преобразования данных от API в наш внутренний формат
// Убедись, что поля соответствуют твоей модели ApiReserve
export const mapApiReserveToReserveEntry = (apiReserve: ApiReserve): ReserveEntry => {
    // Проверка на null/undefined для связанных данных
    const member = apiReserve.member;
    const group = apiReserve.group;

    // Базовое преобразование
    const entry: ReserveEntry = {
        id: apiReserve.id, 
        userId: String(member?.user_id || 'unknown'), // Преобразуем в строку, обрабатываем null
        chatId: String(group?.group_id || 'unknown'), // Преобразуем в строку, обрабатываем null
        date: apiReserve.date, 
        createdAt: apiReserve.created_at,
        // Данные пользователя (могут отсутствовать, если member=null)
        photoUrl: member?.photo_url || null,
        firstName: member?.first_name || 'Unknown',
        lastName: member?.last_name || 'User',
        // Статус старшего (может отсутствовать)
        // ВНИМАНИЕ: apiReserve НЕ содержит is_senior_courier напрямую.
        // Этот статус должен приходить внутри member или group_member.
        // Пока оставляем false, нужно будет уточнить структуру данных от API
        isSeniorCourier: member?.is_senior_courier ?? false, // TODO: Проверить, где этот флаг в API
        // Добавляем полные данные пользователя для отображения
        // user: member ? {
        //     id: String(member.id), // или member.user_id?
        //     user_id: member.user_id,
        //     first_name: member.first_name,
        //     last_name: member.last_name,
        //     username: member.username,
        //     photo_url: member.photo_url,
        //     is_senior_courier: member.is_senior_courier ?? false
        // } : undefined
    };
    return entry;
};

// --- Интерфейс состояния ---
interface ReservesState {
    reserves: ReserveEntry[]; // Храним все резервы здесь
    loading: boolean;
    error: string | null;
}

// --- Начальное состояние ---
const initialState: ReservesState = {
    reserves: [],
    loading: false,
    error: null,
};

// --- Асинхронные Thunks ---

// 1. Thunk для загрузки ВСЕХ резервов для группы
export const fetchReservesForGroup = createAsyncThunk<
    ReserveEntry[],           // Что возвращает при успехе
    { groupId: number },      // Входные аргументы
    { rejectValue: string }    // Тип ошибки
>(
    'reserves/fetchByGroup',
    async ({ groupId }, { rejectWithValue }) => {
        try {
            logger.info(`[reservesSlice] Загрузка ВСЕХ резервов для группы ${groupId}...`);
            const apiReserves: ApiReserve[] = await getReserves(groupId); 
            logger.info(`[reservesSlice] Получено ${apiReserves.length} резервов с API для группы ${groupId}.`);
            return apiReserves.map(mapApiReserveToReserveEntry); // Маппим в наш формат
        } catch (error: any) {
            const errorMsg = error.message || 'Unknown error fetching reserves';
            logger.error(`[reservesSlice] Ошибка загрузки резервов для группы ${groupId}:`, errorMsg);
            return rejectWithValue(errorMsg);
        }
    }
);

// 2. Thunk для добавления текущего пользователя в резерв
export const addCurrentUserToReserveThunk = createAsyncThunk<
    ReserveEntry,
    { userTelegramId: number; groupTelegramId: number; date: Date },
    { rejectValue: string; state: RootState } // Добавляем state для getState
>(
    'reserves/addToReserve',
    // Добавляем dispatch и getState в параметры
    async ({ userTelegramId, groupTelegramId, date }, { rejectWithValue, dispatch, getState }) => {
        const formattedDate = format(date, 'yyyy-MM-dd');
        logger.info(`[reservesSlice] Попытка добавить user ${userTelegramId} в резерв группы ${groupTelegramId} на ${formattedDate}`);
        try {
            const apiResponse = await addReserve({
                user_telegram_id: userTelegramId,
                group_telegram_id: groupTelegramId,
                reserve_date: formattedDate
            });
            logger.info('[reservesSlice] Резерв успешно добавлен через API:', apiResponse);

            // === НАЧАЛО: Логика удаления смен при добавлении в резерв ===
            try {
                const state = getState();
                const allShifts = selectAllShifts(state); // Получаем все смены
                const userShiftsOnDate = allShifts.filter(shift =>
                    String(shift.userId) === String(userTelegramId) &&
                    shift.date === formattedDate
                );

                if (userShiftsOnDate.length > 0) {
                    logger.info(`[reservesSlice] Найдены смены (${userShiftsOnDate.length} шт.) для пользователя ${userTelegramId} на дату ${formattedDate}. Запуск отмены...`);
                    for (const shiftToCancel of userShiftsOnDate) {
                        logger.debug(`[reservesSlice] Отмена смены ID: ${shiftToCancel.id}`);
                        try {
                            await dispatch(cancelShift({
                                shiftId: shiftToCancel.id,
                                chatId: String(groupTelegramId),
                                userId: String(userTelegramId),
                                date: formattedDate
                            })).unwrap(); // unwrap пробросит ошибку, если cancelShift был rejected
                            logger.info(`[reservesSlice] Смена ID ${shiftToCancel.id} успешно отменена.`);
                        } catch (cancelError: any) {
                            // Логируем ошибку отмены, но не прерываем процесс
                            logger.error(`[reservesSlice] Ошибка при отмене смены ID ${shiftToCancel.id} после добавления в резерв:`, cancelError?.message || cancelError);
                        }
                    }
                }
            } catch (errorGettingShifts: any) {
                logger.error('[reservesSlice] Ошибка при получении или обработке смен для удаления после добавления в резерв:', errorGettingShifts?.message || errorGettingShifts);
                // Не прерываем основной процесс
            }
            // === КОНЕЦ: Логика удаления смен ===

            return mapApiReserveToReserveEntry(apiResponse); // Маппим и возвращаем успешный резерв

        } catch (error: any) {
            const errorMsg = error.message || 'Unknown error adding reserve';
            logger.error(`[reservesSlice] Ошибка добавления в резерв user ${userTelegramId}:`, errorMsg);
            return rejectWithValue(errorMsg);
        }
    }
);

// 3. Thunk для удаления резерва по ID
export const removeReserveByIdThunk = createAsyncThunk<
    { id: string }, 
    { reserveId: string },
    { rejectValue: string }
>(
    'reserves/removeById',
    async ({ reserveId }, { rejectWithValue }) => {
        try {
            logger.debug(`[reservesSlice] Попытка удалить резерв ID: ${reserveId}`);
            // Используем импортированную deleteReserve
            await deleteReserve(reserveId); 
            logger.debug('[reservesSlice] Резерв успешно удален через API');
            return { id: reserveId };
        } catch (error: any) {
            const errorMsg = error.response?.data?.detail || error.message || 'Unknown error';
            logger.error(`[reservesSlice] Ошибка удаления резерва ID ${reserveId}:`, errorMsg);
            return rejectWithValue(errorMsg);
        }
    }
);

// --- Создание Slice ---
const reservesSlice = createSlice({
    name: 'reserves',
    initialState,
    reducers: {
        // Синхронные редьюсеры, если понадобятся (например, для очистки)
        clearReservesState: (state) => {
            state.reserves = [];
            state.loading = false;
            state.error = null;
            logger.info('[reservesSlice] Состояние резервов очищено.');
        },
        // Можно добавить обработчики WebSocket событий здесь, если нужно
        // reserveAddedFromWebSocket: (state, action: PayloadAction<ApiReserve>) => { ... }
        // --- РЕДЬЮСЕРЫ ДЛЯ WEBSOCKET --- 
        reserveAdded: (state, action: PayloadAction<ReserveEntry>) => {
            logger.debug('[reservesSlice] Редьюсер reserveAdded вызван с:', action.payload);
            // Проверяем, нет ли уже такого резерва (по ID)
            const existingIndex = state.reserves.findIndex(r => r.id === action.payload.id);
            if (existingIndex === -1) {
                state.reserves.push(action.payload);
                 logger.info(`[reservesSlice] WS: Резерв ID ${action.payload.id} добавлен в стейт.`);
            } else {
                 // Можно обновить существующий, если данные могли измениться
                 // state.reserves[existingIndex] = action.payload;
                 logger.warn(`[reservesSlice] WS: Попытка добавить существующий резерв ID ${action.payload.id}. Игнорируем.`);
            }
            // Сбрасываем ошибку, если она была
            state.error = null;
        },
        reserveRemovedWs: (state, action: PayloadAction<{ id: string }>) => {
            logger.debug('[reservesSlice] Редьюсер reserveRemovedWs вызван с ID:', action.payload.id);
            const initialLength = state.reserves.length;
            state.reserves = state.reserves.filter(reserve => reserve.id !== action.payload.id);
            if (state.reserves.length < initialLength) {
                 logger.info(`[reservesSlice] WS: Резерв ID ${action.payload.id} удален из стейта.`);
            } else {
                 logger.warn(`[reservesSlice] WS: Попытка удалить несуществующий резерв ID ${action.payload.id}.`);
            }
            // Сбрасываем ошибку
            state.error = null;
        },
        // TODO: Добавить обработчики для bulkReserveRemoved и reserveTransferred, если нужно
    },
    extraReducers: (builder) => {
        // Обработка Thunk для загрузки
        builder
            .addCase(fetchReservesForGroup.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchReservesForGroup.fulfilled, (state, action: PayloadAction<ReserveEntry[]>) => {
                state.loading = false;
                // Просто перезаписываем все резервы новыми данными
                state.reserves = action.payload;
                logger.info(`[reservesSlice] Резервы успешно загружены и сохранены (${action.payload.length} шт).`);
            })
            .addCase(fetchReservesForGroup.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
                logger.error('[reservesSlice] Ошибка загрузки резервов:', action.payload);
            });

        // Обработка Thunk для добавления
        builder
            .addCase(addCurrentUserToReserveThunk.pending, (state) => {
                // Можно установить флаг загрузки для конкретного действия, если нужно
                state.loading = true; // Общий флаг
                state.error = null;
            })
            .addCase(addCurrentUserToReserveThunk.fulfilled, (state, action: PayloadAction<ReserveEntry>) => {
                state.loading = false;
                // Добавляем новый резерв в список, если его там еще нет
                const exists = state.reserves.some(r => r.id === action.payload.id);
                if (!exists) {
                    state.reserves.push(action.payload);
                    logger.info(`[reservesSlice] Новый резерв ID ${action.payload.id} добавлен в стейт.`);
                } else {
                     logger.warn(`[reservesSlice] Резерв ID ${action.payload.id} уже существует в стейте.`);
                }
            })
            .addCase(addCurrentUserToReserveThunk.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
                // Ошибка будет показана в компоненте
            });

        // Обработка Thunk для удаления
        builder
            .addCase(removeReserveByIdThunk.pending, (state) => {
                state.loading = true; 
                state.error = null;
            })
            .addCase(removeReserveByIdThunk.fulfilled, (state, action: PayloadAction<{ id: string }>) => { 
                state.loading = false;
                const initialLength = state.reserves.length;
                state.reserves = state.reserves.filter(reserve => reserve.id !== action.payload.id);
                if (state.reserves.length < initialLength) {
                     logger.info(`[reservesSlice] Резерв ID ${action.payload.id} удален из стейта (через Thunk).`);
                }
            })
            .addCase(removeReserveByIdThunk.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

// --- Экспорт редьюсера и actions ---
export const { clearReservesState, reserveAdded, reserveRemovedWs } = reservesSlice.actions;
export default reservesSlice.reducer;

// --- Селекторы ---
export const selectAllReserves = (state: RootState): ReserveEntry[] => state.reserves.reserves;
export const selectReservesLoading = (state: RootState): boolean => state.reserves.loading;
export const selectReservesError = (state: RootState): string | null => state.reserves.error;

// Можно добавить более специфичные селекторы, если нужно, но лучше делать это в хуке или компоненте
// export const selectReservesForDate = (state: RootState, date: string): ReserveEntry[] => ...
