import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../../store/store';
import { 
    fetchShifts, 
    selectAllShifts,
    selectIsLoading,
    selectError,
} from '../../../../store/slices/shiftsSlice';
import { formatDateForAPI } from '../utils/dateUtils';

export const useCalendarData = (currentUserId: string) => {
    const dispatch = useDispatch<AppDispatch>();
    const shifts = useSelector(selectAllShifts);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Функция для перезагрузки данных
    const refetchData = useCallback(() => {
        console.log('[Calendar] Refetching shifts data');
        dispatch(fetchShifts());
    }, [dispatch]);

    // Получение смен для конкретной даты
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

    // Проверка наличия смены у пользователя
    const hasUserShift = useCallback((date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.some(shift => 
            shift.date === dateStr && 
            String(shift.userId) === String(currentUserId)
        );
    }, [shifts, currentUserId]);

    useEffect(() => {
        // Загружаем смены при монтировании
        dispatch(fetchShifts());
    }, [dispatch]);

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