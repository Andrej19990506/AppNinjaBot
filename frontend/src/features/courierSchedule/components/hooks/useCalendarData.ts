import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@shared/store/store';
import { 
    fetchShifts, 
    fetchAccessSettings
} from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { fetchAllShiftTemplatesThunk } from '@features/courierSchedule/store/shiftsSlice/shiftTemplatesThunks';
import { formatDateForAPI } from '../courier-calendar/utils/dateUtils';
import { selectAllShifts, selectError, selectIsLoading } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { selectUser } from '@/shared/store/userSlice/userSelectors';

export const useCalendarData = (currentUserId: string, chatId: number | string | undefined) => {
    const dispatch = useDispatch<AppDispatch>();
    const shifts = useSelector(selectAllShifts);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);
    const user = useSelector(selectUser);
    const userGroups = user?.groups;
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const loadCalendarData = useCallback(async () => {
        if (chatId !== undefined) {
            dispatch(fetchShifts({ chatId }));
            // Сначала загружаем настройки доступа, затем шаблоны (чтобы использовать дату периода)
            try {
                await dispatch(fetchAccessSettings({ chatId: String(chatId) })).unwrap();
                // После загрузки настроек загружаем шаблоны с правильной датой
                dispatch(fetchAllShiftTemplatesThunk(Number(chatId)));
            } catch (error) {
                // Если не удалось загрузить настройки, все равно загружаем шаблоны (с текущей датой)
                console.warn('Failed to load access settings, loading templates with current date:', error);
                dispatch(fetchAllShiftTemplatesThunk(Number(chatId)));
            }
        }
    }, [dispatch, chatId]);

    const refetchData = useCallback(() => {
        loadCalendarData();
    }, [loadCalendarData]);

    // useCallback обязателен: эта функция уходит пропом в MonthSection, обёрнутый в
    // React.memo. Обычное объявление меняло идентичность на каждый рендер, мемо
    // промахивалось всегда, и любое событие вебсокета перерисовывало все 12 месяцев.
    const getShiftsForDate = useCallback((date: Date) => {
        const dateStr = formatDateForAPI(date);
        return shifts.filter(shift => shift.date === dateStr);
    }, [shifts]);

    // Убрали getDayShifts и getNightShifts - теперь группируем только по шаблонам
    // Для обратной совместимости оставляем функции, но они возвращают пустые массивы
    // TODO: Удалить после полного перехода на шаблоны
    const getDayShifts = (date: Date) => {
        // Deprecated: используйте getShiftsForDate и группируйте по template_id
        return [];
    };

    const getNightShifts = (date: Date) => {
        // Deprecated: используйте getShiftsForDate и группируйте по template_id
        return [];
    };

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
        getDayShifts, // Deprecated - оставлено для обратной совместимости
        getNightShifts, // Deprecated - оставлено для обратной совместимости
        hasUserShift,
        refetchData
    };
}; 