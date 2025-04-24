import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { socketService, SocketState } from '../services/socket';
import { logger } from '../utils/logger';
import { /* ApiShift, */ ApiReserve } from '../services/courierApi';

// Импортируем actions из слайсов
import {
    shiftBookedWs,
    shiftCancelledWs,
    // ApiShift // <<< Удаляем неправильный импорт
    // Добавляем импорт Thunk для настроек доступа
    fetchAccessSettings,
    ShiftsUpdatedWsPayload // <<< Импортируем тип
} from '../store/slices/shiftsSlice';
// Удаляем старые импорты резервов
// import {
//     reserveAdded,
//     reserveRemoved,
//     bulkReserveRemoved,
//     reserveTransferred,
//     mapApiReserveToReserveEntry, 
//     ApiReserve 
// } from '../store/slices/reservesSlice';
// Импортируем Thunk для перезагрузки резервов
import { fetchReservesForGroup } from '../store/slices/reservesSlice';
// Импортируем actions и Thunk для резервов
import {
    reserveAdded,          // <<< Добавляем синхронный action
    reserveRemovedWs,      // <<< Добавляем синхронный action для WS
    mapApiReserveToReserveEntry // <<< Добавляем маппер
} from '../store/slices/reservesSlice';
// Импортируем экшен для уведомлений
import { addNotification, NotificationTypes } from '../store/slices/notificationSlice';
// <<< ИМПОРТ ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ >>>
import { userProfileUpdatedWs } from '../store/slices/userSlice'; // Оставляем только action 
import { User } from '../types/user'; // <<< ИМПОРТИРУЕМ ТИП ОТДЕЛЬНО >>>
// Импортируем Thunk для перезагрузки инвентаря
import { fetchChatInventory } from '../store/slices/inventorySlice';

// Селектор для получения ID курьерского чата из стейта пользователя
const selectCurrentCourierChatId = (state: RootState): string | undefined => {
    return state.user.user?.groups?.find(g => g.group_type === 'courier')?.chat_id?.toString();
};

/**
 * Хук для централизованной подписки на WebSocket события,
 * связанные со сменами и резервами.
 */
export const useWebSocketSync = () => {
    const dispatch = useDispatch<AppDispatch>();
    const chatId = useSelector(selectCurrentCourierChatId);

    // <<< Используем локальное состояние для isConnected >>>
    const [socketConnectionState, setSocketConnectionState] = useState<SocketState>(socketService.getState());
    const isConnected = socketConnectionState.isConnected;

    // <<< Подписываемся на ИЗМЕНЕНИЯ состояния сокета >>>
    useEffect(() => {
        const handleStateChange = (newState: SocketState) => {
            logger.debug(`[useWebSocketSync] Socket state changed: isConnected=${newState.isConnected}`);
            setSocketConnectionState(newState);
        };
        
        logger.debug('[useWebSocketSync] Subscribing to socket state changes...');
        const unsubscribe = socketService.onStateChange(handleStateChange);
        
        // Устанавливаем начальное состояние еще раз на всякий случай
        setSocketConnectionState(socketService.getState());
        
        return () => {
            logger.debug('[useWebSocketSync] Unsubscribing from socket state changes.');
            unsubscribe(); // Используем возвращенную функцию отписки
        };
    }, []); // Пустой массив зависимостей, подписываемся один раз

    // <<< Основной useEffect теперь зависит от isConnected (из локального стейта) и chatId >>>
    useEffect(() => {
        // !!! НОВЫЙ ЛОГ: Вход в useEffect !!!
        logger.log(`[useWebSocketSync] useEffect ENTERED. isConnected: ${isConnected}, chatId: ${chatId}`);

        logger.info(`[useWebSocketSync] Попытка подписки. isConnected: ${isConnected}, chatId: ${chatId}`);

        if (!isConnected || !chatId) {
            logger.info('[useWebSocketSync] WebSocket не подключен или нет chatId, подписка не выполнена.');
            // Очищаем старые подписки, если они были (на случай отключения сокета)
            // Возвращаем пустую функцию, т.к. подписок не было
            return () => {}; 
        }

        const currentGroupId = parseInt(chatId, 10);
        if (isNaN(currentGroupId)) {
             logger.error(`[useWebSocketSync] Невалидный chatId (${chatId}), подписка невозможна.`);
             return () => {};
        }

        logger.info(`[useWebSocketSync] Настройка WebSocket подписок для группы ${currentGroupId}...`);

        // === НОВЫЙ ОБРАБОТЧИК ПРОФИЛЯ ===
        interface ProfileUpdatedPayload {
            type: 'profile_updated';
            user_id: number;
            data: User; // <<< ИСПОЛЬЗУЕМ User >>>
        }

        const handleProfileUpdated = (payload: ProfileUpdatedPayload) => {
            logger.debug('[WS] Received event: profile_updated', payload);
            // Опционально: проверить, относится ли обновление к текущему пользователю
            // const currentUserId = useSelector((state: RootState) => state.user.user?.id);
            // if (currentUserId && payload.user_id === currentUserId) {
                logger.info(`[useWebSocketSync] User profile updated via WS for user ${payload.user_id}. Dispatching update.`);
                // Диспатчим action для обновления профиля пользователя
                dispatch(userProfileUpdatedWs({ user_id: payload.user_id, profile: payload.data }));
            // } else {
            //     logger.log(`[useWebSocketSync] Profile update for different user (${payload.user_id}), ignoring.`);
            // }
        };

        // --- Обработчики событий --- 
        // Переименовываем обработчик для ясности
        const handleShiftsUpdated = (data: ShiftsUpdatedWsPayload | any) => { // Используем any временно для type guard
            // Логируем ПОЛУЧЕННЫЕ данные
            logger.debug('[WS] Получено событие: shifts_updated', data);

            // Проверяем источник события
            if (data.source === 'shift_deletion') {
                // Это удаление смены
                logger.info(`[useWebSocketSync] Событие shifts_updated (source=shift_deletion) для нашего чата ${chatId}. Диспатчим shiftCancelledWs.`);
                // Проверяем, что chat_id совпадает (если он есть в данных)
                if (!data.chat_id || String(data.chat_id) === chatId) {
                    // Диспатчим action для удаления смены по ID
                    if (data.shift_id) {
                         dispatch(shiftCancelledWs({ shift_id: data.shift_id }));
                    } else {
                         logger.error('[useWebSocketSync] Ошибка: shift_id отсутствует в payload события shift_deletion!', data);
                    }
                } else {
                     logger.log(`[useWebSocketSync] Событие shift_deletion для другого чата (${data.chat_id}), игнорируем.`);
                }
            } else {
                // Это создание или обновление смены
                logger.info(`[useWebSocketSync] Событие shifts_updated (source=${data.source || 'unknown'}) для нашего чата ${chatId}. Диспатчим shiftBookedWs.`);
                // Проверяем, что chat_id совпадает
                 if (String(data.chat_id) === chatId) {
                     // Проверяем наличие shift_data
                     if (data.shift_data) {
                        dispatch(shiftBookedWs(data as ShiftsUpdatedWsPayload)); // Используем исходный action
                     } else {
                          logger.error('[useWebSocketSync] Ошибка: shift_data отсутствует в payload события shift creation/update!', data);
                     }
                 } else {
                     logger.log(`[useWebSocketSync] Событие shift creation/update для другого чата (${data.chat_id}), игнорируем.`);
                 }
            }
        };

        const handleShiftCancelled = (data: { shift_id: string, chat_id?: string }) => {
             // Этот обработчик, вероятно, больше не нужен, если бэк шлет shifts_updated
             // Но оставим его пока для совместимости или других сценариев
             logger.debug('[WS] Получено событие: shift_cancelled (отдельное)', data);
             if (!data.chat_id || String(data.chat_id) === chatId) {
                 dispatch(shiftCancelledWs({ shift_id: data.shift_id }));
             } else {
                 logger.log('[WS] shift_cancelled для другого чата, игнорируем диспатч');
             }
        };
        
        // === ИЗМЕНЕННЫЙ ОБРАБОТЧИК ===
        const handleReserveAdded = (eventData: { chat_id: string; data: ApiReserve }) => {
             logger.debug('[WS] Получено событие: reserve_added', eventData);
            // Проверяем, относится ли событие к текущему чату
            if (String(eventData.chat_id) === chatId) {
                 logger.info(`[useWebSocketSync] Событие reserve_added для нашего чата ${chatId}. Диспатчим reserveAdded.`);
                try {
                    // Маппим данные из WS в формат ReserveEntry
                    const reserveEntry = mapApiReserveToReserveEntry(eventData.data);
                    // Диспатчим синхронный action
                    dispatch(reserveAdded(reserveEntry)); 
                } catch (error) {
                     logger.error('[useWebSocketSync] Ошибка маппинга или диспатча для reserve_added:', error);
                     // В случае ошибки можно откатиться к перезагрузке
                     // refetchGroupReserves('reserve_added', eventData.chat_id);
                }
            } else {
                 logger.log(`[useWebSocketSync] Событие reserve_added для другого чата (${eventData.chat_id}), игнорируем.`);
            }
        };

        // === ИЗМЕНЕННЫЙ ОБРАБОТЧИК ===
        const handleReserveRemoved = (eventData: { type: string, chat_id?: string, data: { id: string } }) => {
             logger.debug('[WS] Получено событие: reserve_removed', eventData);
            // Проверяем chat_id, если он есть
            if (!eventData.chat_id || String(eventData.chat_id) === chatId) {
                 logger.info(`[useWebSocketSync] Событие reserve_removed для нашего чата ${chatId} (или chat_id не указан). Диспатчим reserveRemovedWs.`);
                // Диспатчим синхронный action, передавая ID из eventData.data.id
                if (eventData.data && eventData.data.id) { // Добавляем проверку на существование data и data.id
                    dispatch(reserveRemovedWs({ id: eventData.data.id }));
                } else {
                    logger.error('[useWebSocketSync] Ошибка: Не найден ID в данных события reserve_removed', eventData);
                }
            } else {
                 logger.log(`[useWebSocketSync] Событие reserve_removed для другого чата (${eventData.chat_id}), игнорируем.`);
            }
            // Убираем безусловную перезагрузку
            // dispatch(fetchReservesForGroup({ groupId: currentGroupId })); 
        };

        // Оставляем перезагрузку для bulk и transferred пока что
        const handleBulkReserveRemoved = (data: { reserveIds: string[], chat_id?: string }) => {
            logger.info(`[useWebSocketSync] Получено событие bulk_reserve_removed. Перезагружаем резервы.`);
            dispatch(fetchReservesForGroup({ groupId: currentGroupId })); 
        };

        const handleReserveTransferred = (data: { id: string, chat_id?: string }) => {
            logger.info(`[useWebSocketSync] Получено событие reserve_transferred_to_shift. Перезагружаем резервы.`);
            dispatch(fetchReservesForGroup({ groupId: currentGroupId })); 
        };
        
        // === НОВЫЙ ОБРАБОТЧИК ===
        const handleShiftAccessSent = (data: { chat_id: string }) => {
            // <<< ЛОГ 2: Проверяем полученные данные и chatId из стейта перед сравнением >>>
            logger.info(`[WS] Получено событие: shift_access_sent. Data Chat ID: ${data.chat_id} (тип: ${typeof data.chat_id}). State Chat ID: ${chatId} (тип: ${typeof chatId})`);
            
            // Проверяем, относится ли событие к текущему чату пользователя
            if (String(data.chat_id) === chatId) {
                logger.info(`[useWebSocketSync] Доступ к сменам открыт для нашего чата ${chatId}! Показываем уведомление и обновляем настройки.`);
                // Показываем уведомление
                dispatch(addNotification({
                    message: 'Доступ к записи на смены открыт!',
                    type: NotificationTypes.SUCCESS, // Используем тип SUCCESS
                    isToast: true // <<< Добавляем флаг, что это тост-уведомление
                }));
                // Запускаем обновление настроек доступа для этого чата
                dispatch(fetchAccessSettings({ chatId: data.chat_id }));
            } else {
                 logger.debug(`[useWebSocketSync] Событие shift_access_sent для другого чата (${data.chat_id}), игнорируем.`);
            }
        };
        // === КОНЕЦ ИЗМЕНЕНИЙ ===
        
        // Подписки
        // Убираем старую подписку на 'shift_booked'
        // const unsubscribeShiftBooked = socketService.subscribe('shift_booked', handleShiftBooked);
        // Подписываемся на 'shifts_updated' новым обработчиком
        const unsubscribeShiftUpdated = socketService.subscribe('shifts_updated', handleShiftsUpdated);
        const unsubscribeShiftCancelled = socketService.subscribe('shift_cancelled', handleShiftCancelled); // Оставляем пока
        const unsubscribeReserveAdded = socketService.subscribe('reserve_added', handleReserveAdded);
        const unsubscribeReserveRemoved = socketService.subscribe('reserve_removed', handleReserveRemoved);
        const unsubscribeBulkRemoved = socketService.subscribe('bulk_reserve_removed', handleBulkReserveRemoved);
        // Возвращаем подписку на reserve_transferred_to_shift
        const unsubscribeTransferred = socketService.subscribe('reserve_transferred_to_shift', handleReserveTransferred);
        // === НОВАЯ ПОДПИСКА ===
        const unsubscribeShiftAccessSent = socketService.subscribe('shift_access_sent', handleShiftAccessSent);
        // === НОВАЯ ПОДПИСКА НА ПРОФИЛЬ ===
        const unsubscribeProfileUpdated = socketService.subscribe('profile_updated', handleProfileUpdated);

        logger.info('[useWebSocketSync] WebSocket подписки успешно установлены.');

        return () => {
            // !!! НОВЫЙ ЛОГ: Вызов функции отписки !!!
            logger.log(`[useWebSocketSync] Cleanup function CALLED. isConnected: ${isConnected}, chatId: ${chatId}`);
            logger.info('[useWebSocketSync] Отписка от WebSocket событий...');
            // unsubscribeShiftBooked(); // Удаляем отписку
            unsubscribeShiftUpdated();
            unsubscribeShiftCancelled();
            unsubscribeReserveAdded();
            unsubscribeReserveRemoved();
            unsubscribeBulkRemoved();
            // Возвращаем отписку
            unsubscribeTransferred();
            // === НОВАЯ ОТПИСКА ===
            unsubscribeShiftAccessSent(); 
            // === НОВАЯ ОТПИСКА ПРОФИЛЯ ===
            unsubscribeProfileUpdated();
            logger.info('[useWebSocketSync] WebSocket отписки выполнены.');
        };

    // <<< Зависимости основного useEffect >>>
    }, [dispatch, isConnected, chatId]);

    // Хук не возвращает ничего
}; 