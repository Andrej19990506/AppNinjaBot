import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@shared/store/store';
import { 
    fetchShifts, 
    fetchSlotConfig,
    fetchAccessSettings
} from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { formatDateForAPI } from '../courier-calendar/utils/dateUtils';
import { selectAllShifts, selectError, selectIsLoading } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { selectUser } from '@/shared/store/userSlice/userSelectors';

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
            dispatch(fetchShifts());
            dispatch(fetchSlotConfig({ chatId }));
            dispatch(fetchAccessSettings({ chatId: String(chatId) }));
        } else {
        }
    }, [dispatch, userGroups]);

    const refetchData = useCallback(() => {
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