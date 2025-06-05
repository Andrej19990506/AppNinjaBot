// --- useWebSocketSync ---
// Глобальный хук для отслеживания статуса WebSocket-соединения.
// Вся бизнес-логика по сменам/резервам вынесена в useCourierWebSocketSync (CourierSchedule).

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { socketService, SocketState } from '../services/socketService';
import { logger } from '../utils/logger';
import { userProfileUpdatedWs } from '@shared/store/userSlice/userSlice';
import { User } from '@/types/user';


export const useWebSocketSync = () => {
    const dispatch = useDispatch<AppDispatch>();
    const [socketConnectionState, setSocketConnectionState] = useState<SocketState>(socketService.getState());
    const isConnected = socketConnectionState.isConnected;

    // Подписка на изменения состояния сокета (connected/disconnected)
    useEffect(() => {
        const handleStateChange = (newState: SocketState) => {
            logger.debug(`[useWebSocketSync] Socket state changed: isConnected=${newState.isConnected}`);
            setSocketConnectionState(newState);
        };
        logger.debug('[useWebSocketSync] Subscribing to socket state changes...');
        const unsubscribe = socketService.onStateChange(handleStateChange);
        setSocketConnectionState(socketService.getState());
        return () => {
            logger.debug('[useWebSocketSync] Unsubscribing from socket state changes.');
            unsubscribe();
        };
    }, []);

    // Подписка на глобальные события (например, обновление профиля)
    useEffect(() => {
        if (!isConnected) return () => {};

        // Обновление профиля пользователя через WS
        interface ProfileUpdatedPayload {
            type: 'profile_updated';
            user_id: number;
            data: User;
        }
        const handleProfileUpdated = (payload: ProfileUpdatedPayload) => {
            dispatch(userProfileUpdatedWs({ user_id: payload.user_id, profile: payload.data }));
        };
        const unsubscribeProfileUpdated = socketService.subscribe('profile_updated', handleProfileUpdated);
        return () => {
            unsubscribeProfileUpdated();
        };
    }, [dispatch, isConnected]);

    // Хук ничего не возвращает — просто side-effect
}; 