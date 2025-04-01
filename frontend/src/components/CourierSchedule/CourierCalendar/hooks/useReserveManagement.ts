import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { 
    // Неиспользуемые функции закомментированы
    // addToReserve, 
    // removeFromReserve, 
    selectAllReserves,
    // forceFetchReserves,
    // reserveDeleted
} from '../../../../store/slices/reservesSlice';
import { format } from 'date-fns';
import { socketService } from '../../../../services/socket';
import { logger } from '../../../../utils/logger';

export const useReserveManagement = (currentUserId: string, chatId: string) => {
    // Неиспользуемый dispatch удалён
    const reserves = useSelector(selectAllReserves);
    // Получаем данные пользователя из Redux
    const userInfo = useSelector((state: any) => state.user.user);

    const getReservesForDate = useCallback((targetDate: Date) => {
        const formattedDate = format(targetDate, "yyyy-MM-dd'T'17:00:00.000'Z'");
        
        const dateReserves = reserves.filter(reserve => {
            // Сравниваем только даты без времени
            const reserveDate = reserve.date.split('T')[0];
            const formattedDateOnly = formattedDate.split('T')[0];
            return reserveDate === formattedDateOnly;
        });
        
        // Логируем только если есть резервы для даты
        if (dateReserves.length > 0) {
            console.log('[useReserveManagement] Found reserves for date:', {
                date: formattedDate,
                reserves: dateReserves
            });
        }
        
        return dateReserves;
    }, [reserves]);

    const userIsInReserve = useCallback((date: Date) => {
        const dateReserves = getReservesForDate(date);
        return dateReserves.some(reserve => 
            String(reserve.userId) === String(currentUserId)
        );
    }, [currentUserId, getReservesForDate]);

    const handleAddToReserve = useCallback(async (date: Date) => {
        try {
            // Создаем объект с данными резерва, включая все данные пользователя
            const reserveData = {
                date: format(date, "yyyy-MM-dd'T'17:00:00.000'Z'"),
                user_id: currentUserId,
                userId: currentUserId, // Для совместимости
                chat_id: chatId,
                // Добавляем все данные пользователя
                firstName: userInfo?.first_name || '',
                lastName: userInfo?.last_name || '',
                photo_url: userInfo?.photo_url || null,
                isSeniorCourier: userInfo?.is_senior_courier || false,
                // Добавляем snake_case версии для совместимости
                first_name: userInfo?.first_name || '',
                last_name: userInfo?.last_name || '',
                is_senior_courier: userInfo?.is_senior_courier || false
            };

            console.log('[useReserveManagement] Отправка данных резерва на сервер:', reserveData);
            socketService.emit('add_to_reserve', reserveData);
            return true;
        } catch (error) {
            logger.error('❌ Ошибка при добавлении в резерв:', error);
            return false;
        }
    }, [currentUserId, chatId, userInfo]);

    const handleCancelReserve = useCallback(async (reserveId: string): Promise<void> => {
        try {
            const reserveData = {
                reserve_id: reserveId,
                user_id: currentUserId,
                chat_id: chatId
            };

            socketService.emit('cancel_reserve', reserveData);
        } catch (error) {
            logger.error('❌ Ошибка при отмене резерва:', error);
        }
    }, [currentUserId, chatId]);

    return {
        reserves,
        getReservesForDate,
        userIsInReserve,
        handleAddToReserve,
        handleCancelReserve
    };
}; 