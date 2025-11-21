// --- useCourierWebSocketSync ---
// Хук для подписки на WebSocket-события, связанные с курьерскими сменами и резервами.
// Используется только внутри CourierSchedule (смены, резервы, доступ).

import { useEffect, useMemo, useRef } from 'react';
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
    
    // Стабилизируем chatId, чтобы избежать лишних перезапусков useEffect
    const chatId = useMemo(() => {
        const id = selectedChatId || chatIdFromSelector;
        // Нормализуем к строке для стабильности
        return id ? String(id) : undefined;
    }, [selectedChatId, chatIdFromSelector]);
    
    // Используем ref для отслеживания предыдущего chatId, чтобы избежать лишних переподписок
    const prevChatIdRef = useRef<string | undefined>(undefined);
    // Используем ref для хранения текущего chatId в обработчиках, чтобы они не пересоздавались
    const currentChatIdRef = useRef<string | undefined>(chatId);
    // Флаг для отслеживания, была ли подписка установлена
    const isSubscribedRef = useRef<boolean>(false);

    useEffect(() => {
        // Обновляем currentChatIdRef всегда
        currentChatIdRef.current = chatId;
        
        // Если chatId не изменился и подписка уже установлена, не перезапускаем
        if (prevChatIdRef.current === chatId && isSubscribedRef.current) {
            return;
        }
        
        console.log('[WS][useCourierWebSocketSync] useEffect вызван, chatId:', chatId, 'selectedChatId:', selectedChatId, 'prevChatId:', prevChatIdRef.current, 'isSubscribed:', isSubscribedRef.current);
        
        // Если chatId изменился, отписываемся от предыдущего
        if (prevChatIdRef.current !== undefined && prevChatIdRef.current !== chatId && isSubscribedRef.current) {
            console.log('[WS][useCourierWebSocketSync] 🔄 chatId изменился, отписываемся от предыдущего:', prevChatIdRef.current);
            // Отписка произойдет в cleanup функции предыдущего useEffect
        }
        
        // Обновляем ref
        prevChatIdRef.current = chatId;
        
        if (!chatId) {
            console.log('[WS][useCourierWebSocketSync] ❌ chatId пустой, пропускаем подписку');
            isSubscribedRef.current = false;
            return () => {};
        }

        console.log('[WS][useCourierWebSocketSync] ✅ Подписываемся на события для chatId:', chatId);
        isSubscribedRef.current = true;

        // --- Обработчики событий ---
        const handleShiftsUpdated = (data: ShiftsUpdatedWsPayload | any) => {
            const currentChatId = currentChatIdRef.current;
            if (!currentChatId) return;
            
            console.log('[WS][handleShiftsUpdated] payload:', data);
            console.log('[WS][handleShiftsUpdated] current chatId:', currentChatId, 'event chat_id:', data.chat_id);
            console.log('[WS][handleShiftsUpdated] comparison:', String(data.chat_id) === currentChatId, 'has shift_data:', !!data.shift_data);
            
            if (data.source === 'shift_deletion') {
                if (!data.chat_id || String(data.chat_id) === currentChatId) {
                    if (data.shift_id) {
                        dispatch(shiftCancelledWs({ shift_id: data.shift_id }));
                        console.log('[WS][handleShiftsUpdated] dispatch shiftCancelledWs:', data.shift_id);
                    }
                }
            } else {
                if (String(data.chat_id) === currentChatId && data.shift_data) {
                    console.log('[WS][handleShiftsUpdated] ✅ Условие выполнено, обновляем смены...');
                    // Передаем chatId в fetchShifts
                    dispatch(fetchShifts({ chatId: currentChatId }));
                    dispatch(fetchReservesForGroup({ groupId: parseInt(currentChatId, 10) }));
                    console.log('[WS][handleShiftsUpdated] dispatch fetchShifts({ chatId }) + fetchReservesForGroup()');
                } else {
                    console.log('[WS][handleShiftsUpdated] ❌ Условие НЕ выполнено:', {
                        chatIdMatch: String(data.chat_id) === currentChatId,
                        hasShiftData: !!data.shift_data,
                        dataChatId: data.chat_id,
                        currentChatId: currentChatId
                    });
                }
            }
        };

        const handleShiftCancelled = (data: { shift_id: string, chat_id?: string }) => {
            const currentChatId = currentChatIdRef.current;
            if (!currentChatId) return;
            
            console.log('[WS][handleShiftCancelled] payload:', data);
            if (!data.chat_id || String(data.chat_id) === currentChatId) {
                dispatch(shiftCancelledWs({ shift_id: data.shift_id }));
                console.log('[WS][handleShiftCancelled] dispatch shiftCancelledWs:', data.shift_id);
            }
        };

        const handleReserveAdded = (eventData: { chat_id: string; data: ApiReserve }) => {
            const currentChatId = currentChatIdRef.current;
            if (!currentChatId) return;
            
            console.log('[WS][handleReserveAdded] payload:', eventData);
            if (String(eventData.chat_id) === currentChatId) {
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
            const currentChatId = currentChatIdRef.current;
            if (!currentChatId) return;
            
            console.log('[WS][handleReserveRemoved] payload:', eventData);
            if (!eventData.chat_id || String(eventData.chat_id) === currentChatId) {
                if (eventData.data && eventData.data.id) {
                    dispatch(reserveRemovedWs({ id: eventData.data.id }));
                    console.log('[WS][handleReserveRemoved] dispatch reserveRemovedWs:', eventData.data.id);
                }
            }
        };

        const handleBulkReserveRemoved = (data: { reserveIds: string[], chat_id?: string }) => {
            const currentChatId = currentChatIdRef.current;
            if (!currentChatId) return;
            
            console.log('[WS][handleBulkReserveRemoved] payload:', data);
            dispatch(fetchReservesForGroup({ groupId: parseInt(currentChatId, 10) }));
            console.log('[WS][handleBulkReserveRemoved] dispatch fetchReservesForGroup:', currentChatId);
        };

        const handleReserveTransferred = (data: { id: string, chat_id?: string }) => {
            const currentChatId = currentChatIdRef.current;
            if (!currentChatId) return;
            
            console.log('[WS][handleReserveTransferred] payload:', data);
            dispatch(fetchReservesForGroup({ groupId: parseInt(currentChatId, 10) }));
            console.log('[WS][handleReserveTransferred] dispatch fetchReservesForGroup:', currentChatId);
        };

        const handleShiftAccessSent = (data: { chat_id: string }) => {
            const currentChatId = currentChatIdRef.current;
            if (!currentChatId) return;
            
            console.log('[WS][handleShiftAccessSent] payload:', data);
            if (String(data.chat_id) === currentChatId) {
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
        console.log('[WS][useCourierWebSocketSync] Подписываемся на shifts_updated для chatId:', chatId);
        const unsubscribeShiftUpdated = socketService.subscribe('shifts_updated', handleShiftsUpdated);
        const unsubscribeShiftCancelled = socketService.subscribe('shift_cancelled', handleShiftCancelled);
        const unsubscribeReserveAdded = socketService.subscribe('reserve_added', handleReserveAdded);
        const unsubscribeReserveRemoved = socketService.subscribe('reserve_removed', handleReserveRemoved);
        const unsubscribeBulkRemoved = socketService.subscribe('bulk_reserve_removed', handleBulkReserveRemoved);
        const unsubscribeTransferred = socketService.subscribe('reserve_transferred_to_shift', handleReserveTransferred);
        const unsubscribeShiftAccessSent = socketService.subscribe('shift_access_sent', handleShiftAccessSent);
        console.log('[WS][useCourierWebSocketSync] ✅ Подписки установлены для chatId:', chatId);

        return () => {
            console.log('[WS][useCourierWebSocketSync] Отписка от событий для chatId:', chatId);
            unsubscribeShiftUpdated();
            unsubscribeShiftCancelled();
            unsubscribeReserveAdded();
            unsubscribeReserveRemoved();
            unsubscribeBulkRemoved();
            unsubscribeTransferred();
            unsubscribeShiftAccessSent();
            // Сбрасываем флаг подписки
            isSubscribedRef.current = false;
        };
    }, [dispatch, chatId]); // Убрали selectedChatId из зависимостей, так как он уже учтен в chatId через useMemo
}; 