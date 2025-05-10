import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../../store/store';
import { 
    addToReserve, 
    removeFromReserve, 
    selectAllReserves,
    forceFetchReserves,
    reserveDeleted
} from '../../../../store/slices/reservesSlice';
import { formatDateForAPI } from '../utils/dateUtils';

export const useReserveManagement = (currentUserId: string, chatId?: string) => {
    const dispatch = useDispatch<AppDispatch>();
    const reserves = useSelector(selectAllReserves);

    const getReservesForDate = useCallback((date: Date) => {
        const dateStr = formatDateForAPI(date);
        return reserves.filter(reserve => reserve.date === dateStr);
    }, [reserves]);

    const userIsInReserve = useCallback((date: Date) => {
        const dateReserves = getReservesForDate(date);
        return dateReserves.some(reserve => 
            String(reserve.userId) === String(currentUserId)
        );
    }, [currentUserId, getReservesForDate]);

    const handleAddToReserve = useCallback(async (date: Date) => {
        if (!chatId) {
            throw new Error('Не удалось определить ID чата. Отсутствует идентификатор чата.');
        }

        try {
            const result = await dispatch(addToReserve({
                date: formatDateForAPI(date),
                userId: currentUserId,
                chatId: chatId
            })).unwrap();

            await dispatch(forceFetchReserves());
            return result;
        } catch (error) {
            console.error('[Calendar] Error adding to reserve:', error);
            throw error;
        }
    }, [dispatch, currentUserId, chatId]);

    const handleCancelReserve = useCallback(async (reserveId: string) => {
        if (!chatId) {
            throw new Error('Не удалось определить ID чата. Отсутствует идентификатор чата.');
        }

        try {
            await dispatch(removeFromReserve({
                reserveId,
                userId: currentUserId,
                chatId: chatId
            }));

            dispatch(reserveDeleted({ id: reserveId }));
            await dispatch(forceFetchReserves());
        } catch (error) {
            console.error('[Calendar] Error canceling reserve:', error);
            throw error;
        }
    }, [dispatch, currentUserId, chatId]);

    return {
        reserves,
        getReservesForDate,
        userIsInReserve,
        handleAddToReserve,
        handleCancelReserve
    };
}; 