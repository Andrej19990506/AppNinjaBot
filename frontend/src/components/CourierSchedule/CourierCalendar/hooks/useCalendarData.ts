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
    const userGroups = user?.groups;
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const loadCalendarData = useCallback(() => {
        const courierGroup = userGroups?.find(g => g.group_type === 'courier');
        const chatId = courierGroup?.chat_id;

        if (chatId !== undefined) {
            logger.info(`[useCalendarData] Загрузка данных для chatId: ${chatId}`);
            dispatch(fetchShifts());
            dispatch(fetchSlotConfig({ chatId }));
            dispatch(fetchAccessSettings({ chatId: String(chatId) }));
        } else {
            logger.warn('[useCalendarData] chatId не определен, данные не загружены.');
        }
    }, [dispatch, userGroups]);

    const refetchData = useCallback(() => {
        logger.info('[useCalendarData] Refetching calendar data...');
        loadCalendarData();
    }, [loadCalendarData]);

    const getShiftsForDate = (date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.filter(shift => shift.date === dateStr);
    };

    const getDayShifts = (date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.filter(shift => 
            shift.date === dateStr && 
            shift.shiftType === 'day'
        );
    };

    const getNightShifts = (date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.filter(shift => 
            shift.date === dateStr && 
            shift.shiftType === 'night'
        );
    };

    const hasUserShift = (date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.some(shift => 
            shift.date === dateStr && 
            String(shift.userId) === String(currentUserId)
        );
    };

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