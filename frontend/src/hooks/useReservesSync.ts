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
    const isConnectedRef = useRef(false);
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
        // Проверка необходимых условий
        if (!chatId || !user) return;
        
        // Загружаем начальные данные
        loadReserves();
        
        // Проверяем, нужно ли подключаться, если мы уже подключены
        if (isConnectedRef.current) return;
        
        // Подписка на события резервов
        const subscribeToEvents = () => {
            // Новый резерв добавлен
            socketService.subscribe('reserve_added', (data) => {
                console.log('📋 Новый резерв добавлен:', data);
                dispatch(reserveAdded(data));
            });
            
            // Резерв обновлен
            socketService.subscribe('reserve_updated', (data) => {
                console.log('🔄 Резерв обновлен:', data);
                loadReserves();
            });
            
            // Резерв удален
            socketService.subscribe('reserve_deleted', (data) => {
                console.log('❌ Резерв удален:', data);
                dispatch(reserveDeleted(data));
            });
        };
        
        // Отписка от событий
        const unsubscribeFromEvents = () => {
            socketService.unsubscribe('reserve_added');
            socketService.unsubscribe('reserve_updated');
            socketService.unsubscribe('reserve_deleted');
        };
        
        // Инициализация подключения и подписок
        socketService.connect().then(() => {
            // Мы используем ту же комнату, что и для смен
            socketService.emit('join_shifts_room', { chatId });
            isConnectedRef.current = true;
            subscribeToEvents();
        });
        
        // Очистка при размонтировании
        return () => {
            unsubscribeFromEvents();
            if (isConnectedRef.current) {
                socketService.emit('leave_shifts_room', { chatId });
                isConnectedRef.current = false;
            }
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
                isSeniorCourier: user.isSeniorCourier,
                type: typeof user.isSeniorCourier,
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
                is_senior_courier: user.isSeniorCourier === true
            };

            logger.info(`📊 Sending reserve data to server:`, {
                ...reserveData,
                is_senior_courier_type: typeof reserveData.is_senior_courier,
                user_isSeniorCourier_original: user.isSeniorCourier,
                user_isSeniorCourier_type: typeof user.isSeniorCourier
            });

            socketService.emit("add_to_reserve", reserveData);
            
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
        
        socketService.emit('reserve_update', {
            action: 'delete',
            chatId,
            reserveId
        });
    };
    
    // API для удаления из резерва по пользователю и дате
    const removeUserFromReserve = (userId: string, date: string) => {
        if (!chatId) {
            console.error('Нет ID чата для удаления из резерва');
            return;
        }
        
        socketService.emit('reserve_update', {
            action: 'delete',
            chatId,
            reserveData: {
                user_id: userId,
                date: date
            }
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