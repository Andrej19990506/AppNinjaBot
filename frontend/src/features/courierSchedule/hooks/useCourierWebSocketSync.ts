// --- useCourierWebSocketSync ---
// Хук для подписки на WebSocket-события, связанные с курьерскими сменами и резервами.
// Используется только внутри CourierSchedule (смены, резервы, доступ).

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@shared/store/store';
import { socketService } from '@shared/services/socketService';
import {
    shiftBookedWs,
    shiftCancelledWs
} from '@features/courierSchedule/store/shiftsSlice/shiftsSlice';
import {
    reserveAdded,
    reserveRemovedWs,
} from '@features/courierSchedule/store/reservesSlice/reservesSlice';
import { addNotification} from '@shared/store/notificationSlice/notificationSlice';
import { NotificationTypes } from '@shared/store/notificationSlice/notificationTypes';
import { fetchReservesForGroup, mapApiReserveToReserveEntry } from '@features/courierSchedule/store/reservesSlice/reservesThunks';
import { fetchAccessSettings, fetchShifts } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { ApiReserve, ShiftsUpdatedWsPayload } from '@features/courierSchedule/types/courierScheduleTypes';

// Селектор: получить chatId курьерской группы пользователя
const selectCurrentCourierChatId = (state: RootState): string | undefined => {
    const groups = Array.isArray(state.user.user?.groups) ? state.user.user.groups : [];
    return groups.find(g => g.group_type === 'courier')?.chat_id?.toString();
};

export const useCourierWebSocketSync = (selectedChatId?: string | null) => {
    const dispatch = useDispatch<AppDispatch>();
    // Используем переданный selectedChatId, если он есть, иначе берем из селектора (для обратной совместимости)
    const chatIdFromSelector = useSelector(selectCurrentCourierChatId);
    const chatId = selectedChatId || chatIdFromSelector;

    useEffect(() => {
        if (!chatId) return () => {};

        // --- Обработчики событий ---
        const handleShiftsUpdated = (data: ShiftsUpdatedWsPayload | any) => {
            console.log('[WS][handleShiftsUpdated] payload:', data);
            console.log('[WS][handleShiftsUpdated] current chatId:', chatId, 'event chat_id:', data.chat_id);
            console.log('[WS][handleShiftsUpdated] comparison:', String(data.chat_id) === chatId, 'has shift_data:', !!data.shift_data);
            
            if (data.source === 'shift_deletion') {
                if (!data.chat_id || String(data.chat_id) === chatId) {
                    if (data.shift_id) {
                        dispatch(shiftCancelledWs({ shift_id: data.shift_id }));
                        console.log('[WS][handleShiftsUpdated] dispatch shiftCancelledWs:', data.shift_id);
                    }
                }
            } else {
                if (String(data.chat_id) === chatId && data.shift_data) {
                    console.log('[WS][handleShiftsUpdated] ✅ Условие выполнено, обновляем смены...');
                    // Передаем chatId в fetchShifts
                    dispatch(fetchShifts({ chatId }));
                    dispatch(fetchReservesForGroup({ groupId: parseInt(chatId, 10) }));
                    console.log('[WS][handleShiftsUpdated] dispatch fetchShifts({ chatId }) + fetchReservesForGroup()');
                } else {
                    console.log('[WS][handleShiftsUpdated] ❌ Условие НЕ выполнено:', {
                        chatIdMatch: String(data.chat_id) === chatId,
                        hasShiftData: !!data.shift_data,
                        dataChatId: data.chat_id,
                        currentChatId: chatId
                    });
                }
            }
        };

        const handleShiftCancelled = (data: { shift_id: string, chat_id?: string }) => {
            console.log('[WS][handleShiftCancelled] payload:', data);
            if (!data.chat_id || String(data.chat_id) === chatId) {
                dispatch(shiftCancelledWs({ shift_id: data.shift_id }));
                console.log('[WS][handleShiftCancelled] dispatch shiftCancelledWs:', data.shift_id);
            }
        };

        const handleReserveAdded = (eventData: { chat_id: string; data: ApiReserve }) => {
            console.log('[WS][handleReserveAdded] payload:', eventData);
            if (String(eventData.chat_id) === chatId) {
                try {
                    const reserveEntry = mapApiReserveToReserveEntry(eventData.data);
                    dispatch(reserveAdded(reserveEntry));
                    console.log('[WS][handleReserveAdded] dispatch reserveAdded:', reserveEntry);
                } catch (error) {
                    console.error('[WS][handleReserveAdded] error:', error);
                }
            }
        };

        const handleReserveRemoved = (eventData: { type: string, chat_id?: string, data: { id: string } }) => {
            console.log('[WS][handleReserveRemoved] payload:', eventData);
            if (!eventData.chat_id || String(eventData.chat_id) === chatId) {
                if (eventData.data && eventData.data.id) {
                    dispatch(reserveRemovedWs({ id: eventData.data.id }));
                    console.log('[WS][handleReserveRemoved] dispatch reserveRemovedWs:', eventData.data.id);
                }
            }
        };

        const handleBulkReserveRemoved = (data: { reserveIds: string[], chat_id?: string }) => {
            console.log('[WS][handleBulkReserveRemoved] payload:', data);
            dispatch(fetchReservesForGroup({ groupId: parseInt(chatId, 10) }));
            console.log('[WS][handleBulkReserveRemoved] dispatch fetchReservesForGroup:', chatId);
        };

        const handleReserveTransferred = (data: { id: string, chat_id?: string }) => {
            console.log('[WS][handleReserveTransferred] payload:', data);
            dispatch(fetchReservesForGroup({ groupId: parseInt(chatId, 10) }));
            console.log('[WS][handleReserveTransferred] dispatch fetchReservesForGroup:', chatId);
        };

        const handleShiftAccessSent = (data: { chat_id: string }) => {
            console.log('[WS][handleShiftAccessSent] payload:', data);
            if (String(data.chat_id) === chatId) {
                dispatch(addNotification({
                    message: 'Доступ к записи на смены открыт!',
                    type: NotificationTypes.SUCCESS,
                    isToast: true
                }));
                dispatch(fetchAccessSettings({ chatId: data.chat_id }));
                console.log('[WS][handleShiftAccessSent] dispatch fetchAccessSettings:', data.chat_id);
            }
        };

        // --- Подписки на события ---
        const unsubscribeShiftUpdated = socketService.subscribe('shifts_updated', handleShiftsUpdated);
        const unsubscribeShiftCancelled = socketService.subscribe('shift_cancelled', handleShiftCancelled);
        const unsubscribeReserveAdded = socketService.subscribe('reserve_added', handleReserveAdded);
        const unsubscribeReserveRemoved = socketService.subscribe('reserve_removed', handleReserveRemoved);
        const unsubscribeBulkRemoved = socketService.subscribe('bulk_reserve_removed', handleBulkReserveRemoved);
        const unsubscribeTransferred = socketService.subscribe('reserve_transferred_to_shift', handleReserveTransferred);
        const unsubscribeShiftAccessSent = socketService.subscribe('shift_access_sent', handleShiftAccessSent);

        return () => {
            unsubscribeShiftUpdated();
            unsubscribeShiftCancelled();
            unsubscribeReserveAdded();
            unsubscribeReserveRemoved();
            unsubscribeBulkRemoved();
            unsubscribeTransferred();
            unsubscribeShiftAccessSent();
        };
    }, [dispatch, chatId]);
}; 