import { useCallback, useEffect } from 'react'; // Убрал useMemo, он был не нужен
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import { useAppDispatch } from '@shared/store/hooks'; // Используем типизированный dispatch
import { ReserveEntry } from '@features/courierSchedule/types/courierScheduleTypes';
import { selectAllReserves, selectReservesError, selectReservesLoading } from '@features/courierSchedule/store/reservesSlice/reservesSelectors';
import { addCurrentUserToReserveThunk, fetchReservesForGroup, removeReserveByIdThunk } from '@features/courierSchedule/store/reservesSlice/reservesThunks';

// --- Новый рефакторенный хук ---
export const useReserveManagement = (currentUserId: string | undefined, chatId: string | undefined) => { // Сделаем ID опциональными
    console.log('[DEBUG] useReserveManagement вызван', { currentUserId, chatId });
    const dispatch = useAppDispatch();
    const allReserves = useSelector(selectAllReserves);
    const isLoading = useSelector(selectReservesLoading);
    const error = useSelector(selectReservesError);

    // 1. Автоматическая загрузка резервов при монтировании/смене chatId
    useEffect(() => {
        // Загружаем только если есть chatId
        if (chatId) {
            const groupId = parseInt(chatId, 10);
            if (!isNaN(groupId)) {
                dispatch(fetchReservesForGroup({ groupId }));
            }
        }
        // Очистка состояния при размонтировании или смене chatId/userId? Пока не делаем.
        // return () => { dispatch(clearReservesState()); }
    }, [chatId, dispatch]);

    // 2. Функция для фильтрации резервов на КОНКРЕТНУЮ дату (для отображения)
    // <<< Оборачиваем в useCallback >>>
    const getDisplayReservesForDate = useCallback((targetDate: Date | null): ReserveEntry[] => {
        if (!targetDate) return []; // Возвращаем пусто, если даты нет
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');
        const filtered = allReserves.filter(reserve => {
            const reserveDateStr = reserve.date.substring(0, 10);
            return reserveDateStr === targetDateStr;
        });
        return filtered;
    }, [allReserves]); // <<< Зависимость: allReserves

    // --- ВРЕМЕННЫЙ ЛОГ ДЛЯ ДИАГНОСТИКИ ---
    useEffect(() => {
        if (allReserves.length) {
            const today = new Date();
            console.log('[DEBUG] Все резервы:', allReserves);
            console.log('[DEBUG] getDisplayReservesForDate(today):', getDisplayReservesForDate(today));
        }
    }, [allReserves, getDisplayReservesForDate]);

    // 3. Функция для проверки, есть ли ТЕКУЩИЙ пользователь в резерве на дату
    // <<< Оборачиваем в useCallback >>>
    const isCurrentUserInReserveForDate = useCallback((targetDate: Date | null): boolean => {
        if (!currentUserId || !targetDate) return false; // Не можем проверить без ID или даты
        // <<< Вызываем getDisplayReservesForDate внутри useCallback >>>
        const reservesOnDate = getDisplayReservesForDate(targetDate);
        return reservesOnDate.some(
            reserve => String(reserve.userId) === String(currentUserId)
        );
    }, [currentUserId, getDisplayReservesForDate]); // <<< Зависимости: currentUserId и мемоизированная getDisplayReservesForDate

    // 4. Функция для ДОБАВЛЕНИЯ ТЕКУЩЕГО пользователя в резерв на дату
    const addCurrentUserToReserve = useCallback(async (targetDate: Date): Promise<void> => {
        if (!chatId || !currentUserId) {
            const errorMsg = 'Недостаточно данных для добавления в резерв (chatId или currentUserId отсутствуют)';
            throw new Error(errorMsg);
        }

        const userTelegramId = parseInt(currentUserId, 10);
        const groupTelegramId = parseInt(chatId, 10);

        if (isNaN(userTelegramId) || isNaN(groupTelegramId)) {
             const errorMsg = 'Не удалось преобразовать ID пользователя или группы в число';
            throw new Error(errorMsg);
        }

        // Диспатчим Thunk addCurrentUserToReserveThunk
        // Ошибки будут обработаны в extraReducers и проброшены через unwrap
        await dispatch(addCurrentUserToReserveThunk({
            userTelegramId,
            groupTelegramId,
            date: targetDate
        })).unwrap(); // unwrap пробросит ошибку, если thunk был rejected

    }, [dispatch, currentUserId, chatId]); // Зависимости useCallback

    // 5. Функция для ОТМЕНЫ резерва по ID
    const cancelReserveById = useCallback(async (reserveId: string): Promise<void> => {
        if (!reserveId) {
             const errorMsg = 'Попытка отменить резерв с пустым ID';
             throw new Error(errorMsg);
        }
        if (!chatId) {
            throw new Error('Нет chatId для удаления резерва');
        }
        const groupTelegramId = parseInt(chatId, 10);
        if (isNaN(groupTelegramId)) {
            throw new Error('Некорректный chatId для удаления резерва');
        }
        // Используем thunk removeReserveByIdThunk
        await dispatch(removeReserveByIdThunk({
             reserveId, 
             requesterTelegramId: String(currentUserId ?? ''),
             groupTelegramId
        })).unwrap();

    }, [dispatch, currentUserId, chatId]); // Зависимость: chatId добавлена

    // 6. Возвращаем новый набор функций и данных
    return {
        isLoading,
        error,
        getDisplayReservesForDate,    // <<< Теперь мемоизирована
        isCurrentUserInReserveForDate,// <<< Теперь мемоизирована
        addCurrentUserToReserve,      // Функция для добавления текущего юзера
        cancelReserveById             // Функция для отмены по ID
    };
};