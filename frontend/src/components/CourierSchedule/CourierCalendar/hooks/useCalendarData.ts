import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../../store/store';
import { 
    fetchShifts, 
    selectAllShifts,
    selectIsLoading,
    selectError,
    subscribeToShiftEvents,
    unsubscribeFromShiftEvents
} from '../../../../store/slices/shiftsSlice';
import { formatDateForAPI } from '../utils/dateUtils';

export const useCalendarData = (currentUserId: string) => {
    const dispatch = useDispatch<AppDispatch>();
    const shifts = useSelector(selectAllShifts);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

    // Функция для перезагрузки данных
    const refetchData = useCallback(() => {
        console.log('[Calendar] Refetching shifts data');
        dispatch(fetchShifts());
        setLastUpdateTime(Date.now());
    }, [dispatch]);

    // Обработчики WebSocket событий
    const handleShiftUpdated = useCallback((data: any) => {
        console.log('[Calendar] WebSocket shift_updated:', data.id);
        setLastUpdateTime(Date.now());
    }, []);

    const handleShiftBooked = useCallback((data: any) => {
        console.log('[Calendar] WebSocket shift_booked:', data.id);
        setLastUpdateTime(Date.now());
    }, []);

    const handleShiftCanceled = useCallback((data: any) => {
        console.log('[Calendar] WebSocket shift_canceled:', data.id);
        setLastUpdateTime(Date.now());
    }, []);

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
        
        // Подписываемся на WebSocket события
        subscribeToShiftEvents(dispatch, {
            onShiftUpdated: handleShiftUpdated,
            onShiftBooked: handleShiftBooked,
            onShiftCanceled: handleShiftCanceled
        });
        
        return () => {
            unsubscribeFromShiftEvents();
        };
    }, [dispatch, handleShiftUpdated, handleShiftBooked, handleShiftCanceled]);

    return {
        shifts,
        isLoading,
        error,
        currentMonth,
        setCurrentMonth,
        lastUpdateTime,
        getShiftsForDate,
        getDayShifts,
        getNightShifts,
        hasUserShift,
        refetchData
    };
}; 