// @ts-nocheck
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { socketService } from '../services/socket';
import { 
    reserveAdded, 
    reserveDeleted,
    forceFetchReserves 
} from '../store/slices/reservesSlice';
import { User } from '../types/user';
import { ReserveShift } from '../types/shifts';
import { logger } from '../utils/logger';

/**
 * Хук для синхронизации данных о резервах через WebSocket
 * @param chatId ID чата для которого нужно получать обновления
 * @returns объект с состоянием синхронизации и методами управления
 */
export const useReservesSync = (chatId: string) => {
    const dispatch = useDispatch<AppDispatch>();
    const isLoadingRef = useRef(false);
    const user = useSelector((state: RootState) => state.user.user);
    
    // Загрузка данных
    const loadReserves = () => {
        if (isLoadingRef.current) return;
        
        isLoadingRef.current = true;
        dispatch(forceFetchReserves())
            .finally(() => {
                isLoadingRef.current = false;
            });
    };
    
    useEffect(() => {
        if (!chatId || !user) return;
        
        loadReserves();
        
        const subscribeToEvents = () => {
            // Подписываемся на 'reserve_added', 'reserve_updated', 'reserve_deleted'
            // Важно: Убедиться, что бэкенд шлет эти события в общую комнату `couriers_{chatId}`
            socketService.subscribe('reserve_added', (data: ReserveShift) => {
                console.log('➕ Резерв добавлен:', data);
                dispatch(reserveAdded(data));
            });

            socketService.subscribe('reserve_updated', (data: ReserveShift) => {
                console.log('🔄 Резерв обновлен:', data);
                // Пока просто перезагружаем все резервы при обновлении
                loadReserves(); 
            });

            socketService.subscribe('reserve_deleted', (data: { id?: string; userId?: string; date?: string }) => {
                console.log('🗑️ Резерв удален:', data);
                if (data.id) {
                    dispatch(reserveDeleted({ id: data.id }));
                } else if (data.userId && data.date) {
                    dispatch(reserveDeleted({ userId: data.userId, date: data.date }));
                } else {
                    // Если нет ID или пары userId/date, перезагружаем все
                    loadReserves();
                }
            });
        };
        
        const unsubscribeFromEvents = () => {
            socketService.unsubscribe('reserve_added');
            socketService.unsubscribe('reserve_updated');
            socketService.unsubscribe('reserve_deleted');
        };
        
        // Просто подписываемся на события, если сокет уже подключен (предполагается)
        // TODO: Возможно, нужна проверка socketService.isConnected() перед подпиской?
        // Или хук useWebSocketConnection должен гарантировать подписку только при активном соединении.
        subscribeToEvents();
        
        return () => {
            unsubscribeFromEvents();
        };
    }, [dispatch, chatId, user]);
    
    // API для добавления в резерв
    const addToReserve = (
        date: string,
        user: User | undefined,
        chatId: string | number
    ): Promise<ReserveShift> => {
        return new Promise((resolve, reject) => {
            if (!user) {
                logger.error(`❌ Cannot add to reserve: user is undefined`);
                reject(new Error("User is undefined"));
                return;
            }

            // Логируем подробную информацию о пользователе для диагностики
            logger.info(`📊 Adding user to reserve: ${user.first_name} ${user.last_name} (${user.id})`);
            logger.info(`⭐ User details:`, {
                id: user.id,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                isSeniorCourier: user.is_senior_courier,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                type: typeof user.is_senior_courier,
                isAdmin: user.isAdmin,
                photoUrl: !!user.photo_url
            });

            const reserveData = {
                user_id: user.id,
                date,
                photo_url: user.photo_url,
                first_name: user.first_name,
                last_name: user.last_name,
                chat_id: chatId,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                is_senior_courier: user.is_senior_courier === true
            };

            logger.info(`📊 Sending reserve data to server:`, {
                ...reserveData,
                is_senior_courier_type: typeof reserveData.is_senior_courier,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                user_isSeniorCourier_original: user.is_senior_courier,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                user_isSeniorCourier_type: typeof user.is_senior_courier
            });

            socketService.emit("add_to_reserve", reserveData);
            
            // Принудительно обновляем состояние через некоторое время
            setTimeout(() => {
                dispatch(forceFetchReserves());
            }, 1000);
            
            // Поскольку мы не используем emitWithAck, возвращаем временный объект
            setTimeout(() => {
                resolve({
                    id: 'temp-id',
                    userId: String(user.id),
                    date,
                    photo_url: user.photo_url,
                    firstName: user.first_name || '',
                    lastName: user.last_name || '',
                    created_at: new Date().toISOString(),
                    isSeniorCourier: reserveData.is_senior_courier
                });
            }, 500);
        });
    };
    
    // API для удаления из резерва
    const removeFromReserve = (reserveId: string) => {
        if (!chatId) {
            console.error('Нет ID чата для удаления из резерва');
            return;
        }
        
        logger.info(`🗑️ Removing reserve with ID ${reserveId} from chat ${chatId}`);
        
        // Используем remove_from_reserve для совместимости с бэкендом
        socketService.emit('remove_from_reserve', {
            chat_id: chatId,
            id: reserveId
        });
    };
    
    // API для удаления из резерва по пользователю и дате
    const removeUserFromReserve = (userId: string, date: string) => {
        if (!chatId) {
            console.error('Нет ID чата для удаления из резерва');
            return;
        }
        
        logger.info(`🗑️ Removing reserve for user ${userId} on date ${date} from chat ${chatId}`);
        
        // Используем remove_from_reserve для совместимости с бэкендом
        socketService.emit('remove_from_reserve', {
            chat_id: chatId,
            user_id: userId,
            date: date
        });
    };
    
    return {
        loadReserves,
        addToReserve,
        removeFromReserve,
        removeUserFromReserve,
        isLoading: isLoadingRef.current
    };
}; 