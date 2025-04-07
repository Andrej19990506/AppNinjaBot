// @ts-nocheck
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { socketService } from '../services/socket';
import { 
    reserveAdded, 
    reserveDeleted,
    forceFetchReserves 
} from '../store/slices/reservesSlice';
import { ReserveShift } from '../types/shifts';
import { logger } from '../utils/logger';

// Импортируем селектор для даты
import { selectSelectedDate } from '../store/slices/shiftsSlice'; 

/**
 * Хук для синхронизации данных о резервах через WebSocket
 * @param chatId ID чата для которого нужно получать обновления
 * @returns объект с состоянием синхронизации и методами управления
 */
export const useReservesSync = (chatId: string | undefined) => {
    const dispatch = useDispatch<AppDispatch>();
    const isLoadingRef = useRef(false);
    const user = useSelector((state: RootState) => state.user.user);
    // Получаем выбранную дату из shiftsSlice
    const selectedDate = useSelector(selectSelectedDate);
    
    // Загрузка данных
    const loadReserves = useCallback(() => {
        // Проверяем наличие chatId и selectedDate перед загрузкой
        if (!chatId || !selectedDate || isLoadingRef.current) return;
        
        // Преобразуем chatId в number
        const groupId = parseInt(chatId, 10);
        if (isNaN(groupId)) {
            logger.error('[useReservesSync] Invalid chatId provided:', chatId);
            return;
        }
        
        isLoadingRef.current = true;
        logger.log(`[useReservesSync] Загрузка резервов для группы ${groupId} на дату ${selectedDate}...`);
        // Передаем groupId и selectedDate
        dispatch(forceFetchReserves({ groupId, date: selectedDate }))
            .finally(() => {
                isLoadingRef.current = false;
            });
    }, [dispatch, chatId, selectedDate]);
    
    useEffect(() => {
        // Загружаем резервы при монтировании или изменении chatId/selectedDate/user
        if (chatId && selectedDate && user) {
            loadReserves();
        }
        
        // Настройка подписок WebSocket
        if (!chatId || !user) return; // Не подписываемся без chatId или user

        const handleReserveAdded = (data: ReserveShift) => {
            console.log('➕ Резерв добавлен (WS):', data);
            // Проверяем, относится ли событие к текущему чату (если бэкенд не фильтрует)
            // if (String(data.chatId) === chatId) { 
                 dispatch(reserveAdded(data));
            // }
        };
        
        const handleReserveDeleted = (data: { id?: string; userId?: string; date?: string }) => {
            console.log('🗑️ Резерв удален (WS):', data);
            // Проверяем принадлежность к чату, если необходимо
            dispatch(reserveDeleted(data)); 
        };
        
        // Подписываемся
        const unsubscribeAdded = socketService.subscribe('reserve_added', handleReserveAdded);
        const unsubscribeDeleted = socketService.subscribe('reserve_removed', handleReserveDeleted);
        // Добавить подписку на reserve_updated, если бэкенд будет ее слать

        return () => {
            // Отписываемся при размонтировании или смене chatId/user
            unsubscribeAdded();
            unsubscribeDeleted();
        };
    }, [dispatch, chatId, user, selectedDate, loadReserves]);
    
    // API для добавления в резерв
    const addToReserve = useCallback(async (date: string): Promise<ReserveShift> => {
        return new Promise((resolve, reject) => {
            if (!user || !chatId) {
                const errorMsg = 'Невозможно добавить в резерв: нет пользователя или ID чата.';
                logger.error(`[useReservesSync:addToReserve] ${errorMsg}`);
                reject(new Error(errorMsg));
                return;
            }

            const groupId = parseInt(chatId, 10);
             if (isNaN(groupId)) {
                 const errorMsg = 'Невозможно добавить в резерв: неверный ID чата.';
                 logger.error(`[useReservesSync:addToReserve] ${errorMsg}`);
                 reject(new Error(errorMsg));
                 return;
            }

            const reserveData = {
                user_telegram_id: user.telegram_id, 
                group_telegram_id: groupId,
                date: date, // YYYY-MM-DD
            };

            logger.info(`[useReservesSync:addToReserve] 📊 Отправка данных для добавления в резерв:`, reserveData);

            // Эмитим событие через сокет
            socketService.emit("add_to_reserve", reserveData);
            
            // Оптимистичное обновление не делаем, ждем ответа от WS (reserve_added)
            // Можно добавить обработку ошибок emit, если socketService ее предоставляет
            
            // TODO: Как получить результат (успех/ошибку) от операции через сокет?
            // Возможно, нужен механизм ack или отдельное событие с результатом.
            // Пока просто резолвим через время (плохо)
             setTimeout(() => {
                 console.warn('[useReservesSync:addToReserve] Assuming success after timeout (needs proper ack handling)');
                 // Возвращаем примерные данные, т.к. реальных нет
                 resolve({
                     id: `temp-${Date.now()}`,
                     userId: String(user.id),
                     date,
                     photo_url: user.photo_url,
                     firstName: user.first_name || '',
                     lastName: user.last_name || '',
                     created_at: new Date().toISOString(),
                     isSeniorCourier: user.is_senior_courier || false
                 });
             }, 1500); 
        });
    }, [user, chatId]);
    
    // API для удаления из резерва
    const removeFromReserve = useCallback((reserveId: string) => {
        if (!chatId) {
            logger.error('[useReservesSync:removeFromReserve] Нет ID чата для удаления из резерва');
            return;
        }
        
        logger.info(`🗑️ Запрос на удаление резерва ID ${reserveId} из чата ${chatId}`);
        
        socketService.emit('remove_from_reserve', {
            id: reserveId, 
            chat_id: chatId
        });
    }, [chatId]);
    
    // API для удаления из резерва по пользователю и дате
    const removeUserFromReserve = useCallback((userIdToRemove: string, date: string) => {
        if (!chatId || !user) {
            logger.error('[useReservesSync:removeUserFromReserve] Нет ID чата или пользователя для удаления из резерва');
            return;
        }
        
        logger.info(`🗑️ Запрос на удаление резерва для user ${userIdToRemove} на дату ${date} из чата ${chatId}`);
        
        socketService.emit('remove_from_reserve', {
            user_id: userIdToRemove,
            date: date,
            chat_id: chatId
        });
    }, [chatId, user]);
    
    return {
        loadReserves,
        addToReserve,
        removeFromReserve,
        removeUserFromReserve,
        isLoading: isLoadingRef.current
    };
}; 