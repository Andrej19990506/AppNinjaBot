import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../../store/store';
import { 
    fetchShifts, 
    selectAllShifts,
    selectIsLoading,
    selectError,
    fetchSlotConfig,
    fetchAccessSettings
} from '../../../../store/slices/shiftsSlice';
import { formatDateForAPI } from '../utils/dateUtils';
import { selectUser } from '../../../../store/slices/userSlice';
import { logger } from '../../../../utils/logger';

export const useCalendarData = (currentUserId: string) => {
    const dispatch = useDispatch<AppDispatch>();
    const shifts = useSelector(selectAllShifts);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);
    const user = useSelector(selectUser);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const getChatId = useCallback((): number | undefined => {
        const courierGroup = user?.groups?.find(g => g.group_type === 'courier');
        return courierGroup?.chat_id;
    }, [user?.groups]);

    const loadCalendarData = useCallback(() => {
        const chatId = getChatId();
        if (chatId !== undefined) {
            logger.info(`[useCalendarData] Загрузка данных для chatId: ${chatId}`);
            dispatch(fetchShifts());
            dispatch(fetchSlotConfig({ chatId }));
            dispatch(fetchAccessSettings({ chatId: String(chatId) }));
        } else {
            logger.warn('[useCalendarData] chatId не определен, данные не загружены.');
        }
    }, [dispatch, getChatId]);

    const refetchData = useCallback(() => {
        logger.info('[useCalendarData] Refetching calendar data...');
        loadCalendarData();
    }, [loadCalendarData]);

    const getShiftsForDate = useCallback((date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.filter(shift => shift.date === dateStr);
    }, [shifts]);

    const getDayShifts = useCallback((date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.filter(shift => 
            shift.date === dateStr && 
            shift.shiftType === 'day'
        );
    }, [shifts]);

    const getNightShifts = useCallback((date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.filter(shift => 
            shift.date === dateStr && 
            shift.shiftType === 'night'
        );
    }, [shifts]);

    const hasUserShift = useCallback((date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.some(shift => 
            shift.date === dateStr && 
            String(shift.userId) === String(currentUserId)
        );
    }, [shifts, currentUserId]);

    useEffect(() => {
        loadCalendarData();
    }, [loadCalendarData]);

    return {
        shifts,
        isLoading,
        error,
        currentMonth,
        setCurrentMonth,
        getShiftsForDate,
        getDayShifts,
        getNightShifts,
        hasUserShift,
        refetchData
    };
}; 