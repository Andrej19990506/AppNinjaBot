import { useCallback, useEffect } from 'react'; // Убрал useMemo, он был не нужен
import { useSelector } from 'react-redux';
import {
    selectAllReserves,
    fetchReservesForGroup, // Используем новый thunk для загрузки
    addCurrentUserToReserveThunk, // Новый thunk для добавления
    removeReserveByIdThunk, // Новый thunk для удаления
    selectReservesLoading,
    selectReservesError
} from '../../../../store/slices/reservesSlice';
import { format } from 'date-fns';
import { logger } from '../../../../utils/logger';
import { useAppDispatch } from '../../../../store/hooks'; // Используем типизированный dispatch
import { ReserveEntry } from '../../../../types/shifts';

// --- Новый рефакторенный хук ---
export const useReserveManagement = (currentUserId: string | undefined, chatId: string | undefined) => { // Сделаем ID опциональными
    const dispatch = useAppDispatch();
    const allReserves = useSelector(selectAllReserves);
    const isLoading = useSelector(selectReservesLoading);
    const error = useSelector(selectReservesError);

    // Логируем состояние резервов из Redux при каждом рендере хука
    console.log('[useReserveManagement] Hook rendered. All reserves from Redux:', allReserves);

    // 1. Автоматическая загрузка резервов при монтировании/смене chatId
    useEffect(() => {
        // Загружаем только если есть chatId
        if (chatId) {
            const groupId = parseInt(chatId, 10);
            if (!isNaN(groupId)) {
                logger.info(`[useReserveManagement] 🔄 Загрузка/Обновление ВСЕХ резервов для группы ${groupId} (useEffect)`);
                dispatch(fetchReservesForGroup({ groupId }));
            } else {
                 logger.error('[useReserveManagement] Неверный формат chatId для загрузки:', chatId);
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
        // Логируем результат фильтрации
        const filtered = allReserves.filter(reserve => {
            const reserveDateStr = reserve.date.substring(0, 10);
            return reserveDateStr === targetDateStr;
        });
        return filtered;
    }, [allReserves]); // <<< Зависимость: allReserves

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
            logger.error(`[useReserveManagement] ${errorMsg}`, { chatId, currentUserId });
            throw new Error(errorMsg);
        }

        const userTelegramId = parseInt(currentUserId, 10);
        const groupTelegramId = parseInt(chatId, 10);

        if (isNaN(userTelegramId) || isNaN(groupTelegramId)) {
             const errorMsg = 'Не удалось преобразовать ID пользователя или группы в число';
            logger.error(`[useReserveManagement] ${errorMsg}`, { currentUserId, chatId });
            throw new Error(errorMsg);
        }

        logger.info(`[useReserveManagement] Попытка добавить user ${userTelegramId} в резерв группы ${groupTelegramId} на ${format(targetDate, 'yyyy-MM-dd')}`);

        // Диспатчим Thunk addCurrentUserToReserveThunk
        // Ошибки будут обработаны в extraReducers и проброшены через unwrap
        await dispatch(addCurrentUserToReserveThunk({
            userTelegramId,
            groupTelegramId,
            date: targetDate
        })).unwrap(); // unwrap пробросит ошибку, если thunk был rejected

        // Успешное выполнение (без ошибок)
        logger.info('[useReserveManagement] Thunk добавления в резерв успешно выполнен.');

    }, [dispatch, currentUserId, chatId]); // Зависимости useCallback

    // 5. Функция для ОТМЕНЫ резерва по ID
    const cancelReserveById = useCallback(async (reserveId: string): Promise<void> => {
        if (!reserveId) {
             const errorMsg = 'Попытка отменить резерв с пустым ID';
             logger.warn(`[useReserveManagement] ${errorMsg}`);
             throw new Error(errorMsg);
        }
        logger.info(`[useReserveManagement] Попытка отменить резерв ID: ${reserveId}`);

        // Используем thunk removeReserveByIdThunk
        await dispatch(removeReserveByIdThunk({
             reserveId, 
             requesterTelegramId: String(currentUserId ?? '')
        })).unwrap();

        logger.info(`[useReserveManagement] Thunk отмены резерва ID ${reserveId} успешно выполнен.`);

    }, [dispatch, currentUserId]); // Зависимость только от dispatch

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