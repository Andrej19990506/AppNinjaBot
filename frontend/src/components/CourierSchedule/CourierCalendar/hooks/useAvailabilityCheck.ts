import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch } from '../../../../store/hooks';
import { socketService } from '../../../../services/socket';
import { fetchAccessSettings, fetchShifts } from '../../../../store/slices/shiftsSlice';
import { logger } from '../../../../utils/logger';

interface AvailabilityUpdate {
    user_id: string;
    is_available: boolean;
}

export const useAvailabilityCheck = (chatId?: string, refreshCalendar?: () => void) => {
    const dispatch = useAppDispatch();
    const isSocketInitialized = socketService.isInitialized();

    const unsubscribeRefs = useRef<(() => void)[]>([]);

    const handleRefreshCalendar = useCallback(() => {
        if (refreshCalendar) {
            refreshCalendar();
        } else if (chatId) {
            dispatch(fetchShifts());
            dispatch(fetchAccessSettings({ chatId }));
        }
    }, [refreshCalendar, chatId, dispatch]);

    useEffect(() => {
        if (!chatId || !isSocketInitialized) {
            logger.log(`useAvailabilityCheck: Пропускаем. chatId=${chatId}, isSocketInitialized=${isSocketInitialized}`);
            unsubscribeRefs.current.forEach(unsub => unsub());
            unsubscribeRefs.current = [];
            return;
        }
        
        const currentIsConnected = socketService.isConnected();
        if (currentIsConnected) { 
            logger.info(`✅ useAvailabilityCheck: Сокет ПОДКЛЮЧЕН (state: ${currentIsConnected}), пытаемся войти в комнату...`);
            try {
                const roomName = `couriers_${chatId}`; 
                logger.info(`🔄 useAvailabilityCheck: Отправка join_room в комнату ${roomName}`);
                socketService.emit('join_room', { room: roomName });
            } catch (error) {
                logger.error('❌ Ошибка при отправке join_room:', error);
            }
        } else {
            logger.warn(`⚠️ useAvailabilityCheck: Вход в комнату отложен. State isConnected=${currentIsConnected}`);
        }

        logger.log(`[useAvailabilityCheck] Хук активен, chatId=${chatId}, isConnected=${currentIsConnected}, подписки настроены.`);
        
        const handleAvailabilityUpdate = (data: AvailabilityUpdate) => {
            logger.log('🔄 [AvailabilityUpdate] Получено обновление доступности:', data);
            handleRefreshCalendar();
        };

        const handleRefreshCommand = () => {
            logger.log('🔄 [RefreshCommand] Получена команда на обновление календаря');
            handleRefreshCalendar();
        };

        const handleGlobalRefresh = () => {
            logger.log('🔄 [GlobalRefresh] Получена команда на глобальное обновление');
            handleRefreshCalendar();
        };

        const handleError = (error: any) => {
            logger.error('❌ [WebSocket Error] Получена ошибка:', error);
        };

        const handleShiftsUpdate = (data: { type: string; chat_id: string; [key: string]: any }) => {
            if (data.chat_id === chatId) {
                logger.info(`🔄 [ShiftsUpdate] Получено обновление смен для нашего чата ${chatId}:`, data);
                handleRefreshCalendar();
            } else {
                logger.log(`[ShiftsUpdate] Получено обновление смен для другого чата (${data.chat_id}), игнорируем.`);
            }
        };

        const unsubs: (() => void)[] = [];
        unsubs.push(socketService.subscribe<AvailabilityUpdate>('availability_update', handleAvailabilityUpdate));
        unsubs.push(socketService.subscribe('refresh_calendar', handleRefreshCommand));
        unsubs.push(socketService.subscribe('global_refresh', handleGlobalRefresh));
        unsubs.push(socketService.subscribe<any>('error', handleError));
        unsubs.push(socketService.subscribe('shifts_updated', handleShiftsUpdate));
        unsubscribeRefs.current = unsubs;

        return () => {
            try {
                logger.log('🧹 Отписка от WebSocket событий при размонтировании (useAvailabilityCheck)...');
                unsubscribeRefs.current.forEach(unsub => unsub());
                unsubscribeRefs.current = [];
                logger.log('🧹 Отписка от WebSocket событий выполнена (useAvailabilityCheck)');
            } catch (cleanupError) {
                logger.error('❌ Ошибка при отписке от WebSocket событий (useAvailabilityCheck):', cleanupError);
            }
        };
    }, [chatId, isSocketInitialized, handleRefreshCalendar]);
    
    return { refreshCalendar: handleRefreshCalendar };
}; 