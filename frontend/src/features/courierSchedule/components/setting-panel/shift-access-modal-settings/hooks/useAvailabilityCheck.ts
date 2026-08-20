import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch } from '@shared/store/hooks';
import { socketService } from '@shared/services/socketService';
import { fetchAccessSettings, fetchShifts } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';

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
            dispatch(fetchShifts({ chatId }));
            dispatch(fetchAccessSettings({ chatId }));
        }
    }, [refreshCalendar, chatId, dispatch]);

    useEffect(() => {
        if (!chatId || !isSocketInitialized) {
            unsubscribeRefs.current.forEach(unsub => unsub());
            unsubscribeRefs.current = [];
            return;
        }
        
        
        const handleAvailabilityUpdate = (data: AvailabilityUpdate) => {
            handleRefreshCalendar();
        };

        const handleRefreshCommand = () => {
            handleRefreshCalendar();
        };

        const handleGlobalRefresh = () => {
            handleRefreshCalendar();
        };

        const handleError = (error: any) => {
        };

        const unsubs: (() => void)[] = [];
        unsubs.push(socketService.subscribe<AvailabilityUpdate>('availability_update', handleAvailabilityUpdate));
        unsubs.push(socketService.subscribe('refresh_calendar', handleRefreshCommand));
        unsubs.push(socketService.subscribe('global_refresh', handleGlobalRefresh));
        unsubs.push(socketService.subscribe<any>('error', handleError));
        unsubscribeRefs.current = unsubs;

        return () => {
            try {
                unsubscribeRefs.current.forEach(unsub => unsub());
                unsubscribeRefs.current = [];
            } catch (cleanupError) {
            }
        };
    }, [chatId, isSocketInitialized, handleRefreshCalendar]);
    
    return { refreshCalendar: handleRefreshCalendar };
}; 