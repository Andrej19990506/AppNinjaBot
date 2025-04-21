import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getGroupCouriers, CourierInfo, ApiShift } from '../../services/courierApi'; // Импортируем API и тип
import { logger } from '../../utils/logger';
import { assignCourierToShiftThunk } from './shiftsSlice'; // Импорт thunk для назначения курьера
import { format } from 'date-fns'; // Для форматирования даты

// Определяем состояние для slice
interface AvailableCouriersState {
    couriers: CourierInfo[];
    isLoading: boolean;
    error: string | null;
    lastFetchedChatId: string | null; // Чтобы не перезапрашивать для того же чата
    // Состояние для отслеживания назначенных курьеров по датам
    // Ключ - дата в формате 'yyyy-MM-dd', значение - объект { userId: boolean }
    assignedCouriersByDate: Record<string, Record<string, boolean>>;
}

// Начальное состояние
const initialState: AvailableCouriersState = {
    couriers: [],
    isLoading: false,
    error: null,
    lastFetchedChatId: null,
    assignedCouriersByDate: {}, // Инициализируем пустым объектом
};

// Асинхронный thunk для загрузки курьеров
export const fetchAvailableCouriers = createAsyncThunk<
    CourierInfo[], // Тип возвращаемого значения при успехе
    { groupTelegramId: string; requesterId: string }, // Тип аргументов thunk
    { rejectValue: string } // Тип возвращаемого значения при ошибке
>(
    'availableCouriers/fetchCouriers',
    async ({ groupTelegramId, requesterId }, { rejectWithValue }) => {
        logger.info(`[Thunk fetchAvailableCouriers] Запрос курьеров для группы ${groupTelegramId} от ${requesterId}`);
        try {
            // Вызываем функцию API
            const couriers = await getGroupCouriers(groupTelegramId, requesterId);
            logger.info(`[Thunk fetchAvailableCouriers] Получено курьеров: ${couriers.length}`);
            return couriers;
        } catch (error: any) {
            logger.error('[Thunk fetchAvailableCouriers] Ошибка при загрузке курьеров:', error);
            const message = error.message || 'Не удалось загрузить список курьеров.';
            return rejectWithValue(message);
        }
    }
);

// Создаем slice
const availableCouriersSlice = createSlice({
    name: 'availableCouriers',
    initialState,
    reducers: {
        // Редьюсер для очистки состояния при закрытии панели или смене контекста
        clearAvailableCouriers: (state) => {
            state.couriers = [];
            state.isLoading = false;
            state.error = null;
            state.lastFetchedChatId = null;
            // Очищаем и состояние назначенных курьеров
            state.assignedCouriersByDate = {};
            logger.debug('[availableCouriersSlice] Состояние очищено');
        },
        // TODO: Добавить редьюсер для отмены назначения курьера, если понадобится
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAvailableCouriers.pending, (state, action) => {
                logger.debug('[availableCouriersSlice] Загрузка курьеров...');
                state.isLoading = true;
                state.error = null;
                // Сохраняем chatId, для которого идет запрос
                state.lastFetchedChatId = action.meta.arg.groupTelegramId;
            })
            .addCase(fetchAvailableCouriers.fulfilled, (state, action: PayloadAction<CourierInfo[]>) => {
                logger.debug('[availableCouriersSlice] Курьеры успешно загружены');
                state.isLoading = false;
                state.couriers = action.payload;
                state.error = null;
            })
            .addCase(fetchAvailableCouriers.rejected, (state, action) => {
                logger.debug('[availableCouriersSlice] Ошибка загрузки курьеров');
                state.isLoading = false;
                state.error = action.payload ?? 'Неизвестная ошибка'; // Используем rejectValue
                state.couriers = []; // Очищаем список при ошибке
                // Не сбрасываем lastFetchedChatId, чтобы показать ошибку для этого чата
            })
            // Обработка успешного назначения курьера
            .addCase(assignCourierToShiftThunk.fulfilled, (state, action: PayloadAction<ApiShift>) => {
                const assignedShift = action.payload;
                const userId = assignedShift.user_id;
                const date = assignedShift.date;

                if (!userId || !date) {
                    logger.warn('[availableCouriersSlice] assignCourierToShiftThunk.fulfilled: userId (user_id) или date отсутствуют в payload.', assignedShift);
                    return;
                }
                const dateKey = format(new Date(date), 'yyyy-MM-dd');

                logger.debug(`[availableCouriersSlice] Курьер ${userId} назначен на дату ${dateKey}`);

                // Инициализируем объект для даты, если его нет
                if (!state.assignedCouriersByDate[dateKey]) {
                    state.assignedCouriersByDate[dateKey] = {};
                }
                // Помечаем курьера как назначенного на эту дату
                state.assignedCouriersByDate[dateKey][userId] = true;
            });
            // TODO: Обработать assignCourierToShiftThunk.rejected или отмену?
            // Возможно, при ошибке или отмене нужно сбрасывать assignedCouriersByDate? Зависит от логики.
    },
});

// Экспортируем редьюсер и actions
export const { clearAvailableCouriers } = availableCouriersSlice.actions;
export default availableCouriersSlice.reducer;

// Селекторы (если нужны)
export const selectAvailableCouriers = (state: { availableCouriers: AvailableCouriersState }) => state.availableCouriers.couriers;
export const selectAvailableCouriersLoading = (state: { availableCouriers: AvailableCouriersState }) => state.availableCouriers.isLoading;
export const selectAvailableCouriersError = (state: { availableCouriers: AvailableCouriersState }) => state.availableCouriers.error;
export const selectLastFetchedChatIdForCouriers = (state: { availableCouriers: AvailableCouriersState }) => state.availableCouriers.lastFetchedChatId;

// Селектор для проверки, назначен ли курьер на конкретную дату
export const selectIsCourierAssignedOnDate = (
    state: { availableCouriers: AvailableCouriersState },
    userId: string,
    date: Date | string // Принимаем Date или строку 'yyyy-MM-dd'
): boolean => {
    const dateKey = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    return state.availableCouriers.assignedCouriersByDate[dateKey]?.[userId] ?? false;
}; 