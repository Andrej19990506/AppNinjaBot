import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import type { /* ListenerEffectAPI, PayloadAction */ } from '@reduxjs/toolkit';
import inventoryReducer from './slices/inventorySlice';
import writeOffReducer from './slices/writeOffSlice';
import notificationReducer from './slices/notificationSlice';
// import authReducer from './slices/authSlice'; // Закомментировано
import userReducer, { initializeFromTelegram, userSlice } from './slices/userSlice';
import adminReducer from './slices/adminSlice';
import courierReducer from './slices/courierSlice';
import shiftsReducer /*, {
} */ from './slices/shiftsSlice';
import reservesReducer /* , {
    // subscribeToReserveEvents,
} */ from './slices/reservesSlice';
import socketReducer, { socketConnected, socketDisconnected } from './slices/socketSlice';
import { socketService, SocketState as ServiceSocketState } from '../services/socket';
// import { loadState, saveState } from './localStorage'; // Закомментировано
// import throttle from 'lodash.throttle'; // Закомментировано
import { logger } from '../utils/logger';
import { routeChanged } from './actions';
// Удаляем Socket из импорта
import { /* Socket */ } from 'socket.io-client';
import chatReducer from './slices/chatSlice';
import availableCouriersReducer from './slices/availableCouriersSlice';
// import inventoryItemsReducer from './slices/inventoryItemSlice';
// import inventoryCategoriesReducer from './slices/inventoryCategorySlice';

// NEW: Импорт редьюсера событий
import eventsReducer from './slices/eventsSlice';

// Создаем listener middleware instance
export const listenerMiddleware = createListenerMiddleware();

// --- Переменные состояния для комнаты --- 
let joinedRoomId: string | null = null; // ID комнаты, в которой сейчас пользователь
let pendingJoinRoomId: string | null = null; // Комната для входа при коннекте
let currentPathname: string | null = null;

// --- Хелперы для комнаты --- 
const COURIER_ROUTE = '/courier-schedule';

// Защита от прямого вызова до инициализации store
const findCourierChatId = (state: RootState | null): string | undefined => {
    if (!state) {
        logger.error('[Store:findCourierChatId] Попытка вызова до инициализации state!');
        return undefined;
    }
    // Убедимся, что user и groups существуют
    return state.user?.user?.groups?.find(g => g.group_type === 'courier')?.chat_id?.toString();
};

const joinRoom = (roomId: string) => {
    const state = store?.getState(); // Получаем state только когда функция вызвана
    if (!state) {
        logger.error('[Store:RoomLogic] Попытка войти в комнату без инициализированного store!');
        return;
    }
    const user = state.user.user;
    if (!user) {
        logger.error('[Store:RoomLogic] Попытка войти в комнату без данных пользователя!');
        return;
    }
    if (joinedRoomId === roomId) {
        logger.log(`[Store:RoomLogic] Уже в комнате ${roomId}, повторный вход не требуется.`);
        return;
    }
    if (joinedRoomId) {
        logger.warn(`[Store:RoomLogic] Пытаемся войти в ${roomId}, но уже находимся в ${joinedRoomId}. Сначала выходим...`);
        leaveRoom();
    }
    
    logger.log(`[Store:RoomLogic] 🚪 Вход в комнату: ${roomId}`);
    socketService.joinRoom(roomId, {
        userId: user.id,
        first_name: user.first_name,
        last_name: user.last_name
    });
    joinedRoomId = roomId;
    pendingJoinRoomId = null; // Сбрасываем ожидание после успешной попытки входа
};

const leaveRoom = () => {
    if (joinedRoomId) {
        const leavingRoomId = joinedRoomId;
        // Сбрасываем joinedRoomId сразу, чтобы избежать гонок состояний
        joinedRoomId = null;
        // pendingJoinRoomId здесь не должен сбрасываться, он управляется логикой переподключения
        logger.log(`[Store:RoomLogic] 🚪 Выход из комнаты: ${leavingRoomId}`);
        if (socketService.isInitialized() && socketService.isConnected()) {
            socketService.leaveRoom(leavingRoomId);
        } else {
            logger.warn(`[Store:RoomLogic] Сокет не подключен, выход из комнаты ${leavingRoomId} только на клиенте.`);
        }
    } else {
        logger.log('[Store:RoomLogic] Попытка выхода, но не в комнате.');
    }
};

// --- Конфигурация Store --- 
const store = configureStore({
    reducer: {
        inventory: inventoryReducer,
        writeOff: writeOffReducer,
        notification: notificationReducer,
        // auth: authReducer, // Закомментировано
        user: userReducer,
        admin: adminReducer,
        courier: courierReducer,
        shifts: shiftsReducer,
        chat: chatReducer,
        reserves: reservesReducer,
        socket: socketReducer,
        availableCouriers: availableCouriersReducer,
        // NEW: Добавляем редьюсер событий
        events: eventsReducer,
    },
    // preloadedState, // Закомментировано
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        }).prepend(listenerMiddleware.middleware)
});

// --- Определения типов (оставляем здесь) --- 
// Заменяем ReturnType на явное определение для возможного решения проблемы циклической зависимости
// export type RootState = ReturnType<typeof store.getState>;
export type RootState = {
    inventory: ReturnType<typeof inventoryReducer>;
    writeOff: ReturnType<typeof writeOffReducer>;
    notification: ReturnType<typeof notificationReducer>;
    // auth: ReturnType<typeof authReducer>; // Закомментировано
    user: ReturnType<typeof userReducer>;
    admin: ReturnType<typeof adminReducer>;
    courier: ReturnType<typeof courierReducer>;
    shifts: ReturnType<typeof shiftsReducer>;
    chat: ReturnType<typeof chatReducer>;
    reserves: ReturnType<typeof reservesReducer>;
    socket: ReturnType<typeof socketReducer>;
    availableCouriers: ReturnType<typeof availableCouriersReducer>;
    // NEW: Добавляем тип для среза событий
    events: ReturnType<typeof eventsReducer>;
};

export type AppDispatch = typeof store.dispatch;


let unsubscribeSocketConnect: (() => void) | null = null;

// --- Переменные для хранения функций отписки от доменных событий ---
let domainUnsubscribeFunctions: (() => void)[] = [];

// Функция подписки на доменные события
const setupSubscriptions = (dispatch: AppDispatch, getState: () => RootState) => {
    logger.log('[Store:setupSubscriptions] Subscribing to domain events...');
    
    unsubscribeDomainEvents(); 
    domainUnsubscribeFunctions = [];

    try {
        // Удаляем вызовы удаленных функций
        // domainUnsubscribeFunctions.push(subscribeToShiftEvents(dispatch));
        // domainUnsubscribeFunctions.push(subscribeToReserveEvents(dispatch));
        
        // Остаются ли другие подписки? Если нет, можно этот блок и флаг isSubscribedToDomainEvents удалить.
        // Пока просто закомментируем вызовы.
        
        // Если других подписок нет, можно сразу установить флаг в false или удалить
        // isSubscribedToDomainEvents = true; 
        logger.log('[Store:setupSubscriptions] Successfully subscribed to domain events (или нет, т.к. вызовы удалены).');
    } catch (error) {
        logger.error('[Store:setupSubscriptions] Error during domain event subscription:', error);
        unsubscribeDomainEvents(); 
    }
};

// Функция ОТПИСКИ от доменных событий
const unsubscribeDomainEvents = () => {
    logger.log('[Store:unsubscribeDomainEvents] Unsubscribing from domain events...');
    
    // Вызываем все сохраненные функции отписки
    domainUnsubscribeFunctions.forEach(unsubscribe => {
        try {
            unsubscribe();
        } catch (error) {
            logger.error('[Store:unsubscribeDomainEvents] Error during unsubscribe call:', error);
        }
    });
    
    // Сбрасываем флаг и массив
    domainUnsubscribeFunctions = [];
    logger.log('[Store:unsubscribeDomainEvents] Successfully unsubscribed from domain events.');
};

// Глобальный обработчик Connect
const handleSocketConnect = () => {
    logger.log('[Store:handleSocketConnect] Socket connected!');
    const dispatch = store.dispatch;
    // const getState = store.getState; // getState больше не нужен здесь
    dispatch(socketConnected());

    // 1. Настраиваем доменные подписки -> Перенесено в socketConnected листенер
    // setupSubscriptions(dispatch, getState);

    // 2. Логика комнаты курьеров при коннекте -> Перенесено в socketConnected листенер
    // if (pendingJoinRoomId) { ... }
    // else if (currentPathname && !joinedRoomId) { ... }
};

// Глобальный обработчик Disconnect
const handleSocketDisconnect = (reason: string): void => {
    logger.warn(`[Store:handleSocketDisconnect] Socket disconnected! Reason: ${reason}`);
    store.dispatch(socketDisconnected());

    // 1. Отписываемся от доменных событий
    unsubscribeDomainEvents();

    // 2. Логика комнаты курьеров при дисконнекте
    if (joinedRoomId) {
        logger.log(`[Store:handleSocketDisconnect] Мы были в комнате ${joinedRoomId}.`);
        const previousJoinedRoomId = joinedRoomId; // Сохраняем ID комнаты, из которой вышли (или считаем, что вышли)
        joinedRoomId = null; // Считаем, что вышли из комнаты на клиенте
        
        // Определяем, нужно ли ставить эту комнату в ожидание для переподключения
        // Это делается на основе currentPathname, который должен быть актуальным
        let targetRoomForCurrentRoute: string | null = null;
        if (currentPathname) {
            const state = store?.getState(); // Получаем актуальный стейт
            if (currentPathname === COURIER_ROUTE) {
                targetRoomForCurrentRoute = findCourierChatId(state) ?? null;
            } else {
                const inventoryMatch = currentPathname.match(/^\/inventory\/([^/]+)$/);
                if (inventoryMatch && inventoryMatch[1]) {
                    targetRoomForCurrentRoute = `inventory_${inventoryMatch[1]}`;
                }
            }
        }

        if (targetRoomForCurrentRoute === previousJoinedRoomId) {
             logger.log(`[Store:handleSocketDisconnect] ...и мы все еще на роуте (${currentPathname}), соответствующем этой комнате. Ставим комнату ${previousJoinedRoomId} в ожидание.`);
             pendingJoinRoomId = previousJoinedRoomId;
        } else {
             logger.warn(`[Store:handleSocketDisconnect] ...но текущий роут (${currentPathname}) не соответствует комнате ${previousJoinedRoomId} (или targetRoomForCurrentRoute is ${targetRoomForCurrentRoute}). Ожидание не ставим.`);
             pendingJoinRoomId = null; // Очищаем, если роут изменился или комната неактуальна
        }
    } else {
         logger.log('[Store:handleSocketDisconnect] Не были в комнате, очищаем pendingJoinRoomId.');
         pendingJoinRoomId = null;
    }
};

// --- Функции обратного вызова для сокета --- 
// Убираем socketCallbacks, т.к. будем вызывать обработчики напрямую из листенера
// const socketCallbacks = {
//     connect: handleSocketConnect,
//     disconnect: handleSocketDisconnect
// };

// Функция для запуска/перезапуска листенеров состояния сокета
const startSocketStateListener = () => {
    logger.log('[Store:startSocketStateListener] Запуск функции...');
    // Отписываемся от предыдущего, если он был
    if (unsubscribeSocketConnect) {
        logger.log('[Store:startSocketStateListener] Отписка от предыдущего слушателя...');
        unsubscribeSocketConnect();
        unsubscribeSocketConnect = null;
        logger.log('[Store:startSocketStateListener] Отписка завершена.');
    }
    
    logger.log('[Store:startSocketStateListener] Вызов socketService.onStateChange для подписки...');
    // Подписываемся на событие изменения состояния сокета
    unsubscribeSocketConnect = socketService.onStateChange((newState: ServiceSocketState) => {
        // !!! САМЫЙ ПЕРВЫЙ ЛОГ ВНУТРИ КОЛЛБЭКА !!!
        logger.log(`[Store:onStateChangeCallback] !!! КОЛЛБЭК ВЫЗВАН !!! Новое состояние:`, newState);
        
        const currentIsConnected = store.getState().socket.isConnected;
        logger.log(`[Store:onStateChangeCallback] Текущее состояние в Redux: ${currentIsConnected}`);

        if (newState.isConnected && !currentIsConnected) {
            logger.log('[Store:onStateChangeCallback] Условие (newState.isConnected && !currentIsConnected) === TRUE. Вызов handleSocketConnect...');
            handleSocketConnect();
        } else if (!newState.isConnected && currentIsConnected) {
            logger.log('[Store:onStateChangeCallback] Условие (!newState.isConnected && currentIsConnected) === TRUE. Вызов handleSocketDisconnect...');
            handleSocketDisconnect(newState.error || 'State changed to disconnected');
        } else {
             logger.log('[Store:onStateChangeCallback] Ни одно из условий не выполнено. Состояние Redux уже соответствует новому состоянию или состояние не изменилось значимо.');
        }
    });
    logger.log('[Store:startSocketStateListener] Подписка через socketService.onStateChange ВЫПОЛНЕНА. Функция завершена.');
};

// --- Слушатели Middleware --- 

// 1. Инициализация пользователя -> Инициализация сокета + Запуск слушателя состояния сокета + Первая попытка connect
listenerMiddleware.startListening({
    actionCreator: initializeFromTelegram.fulfilled,
    effect: (action, listenerApi) => {
        const userId = action.payload.id;
        logger.log(`[Store:UserInitListener] User initialized. UserID: ${userId}`);
        // Инициализируем сокет
        logger.log(`[Store:UserInitListener] Initializing socket...`);
        const wsUrl = window.APP_CONFIG?.WS_URL || process.env.REACT_APP_WS_URL || 'ws://localhost:8001'; // Fallback на случай отсутствия
        socketService.init(wsUrl, userId); 
        logger.log('[Store:startSocketStateListener] Starting socket state listener...');
        startSocketStateListener(); // Запускаем прослушивание состояния сокета
        logger.log('[Store:UserInitListener] Attempting to connect socket...');
        // <<< ДОБАВЛЯЕМ ОТЛАДКУ >>>
        try {
            logger.log('[Store:UserInitListener] >>> BEFORE socketService.connect()');
            socketService.connect(); 
            logger.log('[Store:UserInitListener] >>> AFTER socketService.connect() (no error thrown)');
        } catch (error) {
            logger.error('[Store:UserInitListener] >>> IMMEDIATE ERROR calling socketService.connect():', error);
        }
        // <<< КОНЕЦ ОТЛАДКИ >>>
        
        // !!! setupSubscriptions вызывается здесь, при инициализации пользователя, а не при подключении сокета
        // Вызываем setupSubscriptions при инициализации пользователя
        // setupSubscriptions(listenerApi.dispatch as AppDispatch, listenerApi.getState as () => RootState);
    }
});

// 2. Слушатель подключения сокета -> подписки на события и вход в комнату
listenerMiddleware.startListening({
    actionCreator: socketConnected,
    effect: (action, listenerApi) => {
        logger.log("[Store:SocketConnect] Listener triggered");
        
        setupSubscriptions(listenerApi.dispatch as AppDispatch, listenerApi.getState as () => RootState);
        
        if (pendingJoinRoomId) {
            logger.log(`[Store:SocketConnect] Found pending room: ${pendingJoinRoomId}. Joining...`);
            joinRoom(pendingJoinRoomId);
        } else if (currentPathname) { // Если нет pending room, но есть currentPathname
            logger.log(`[Store:SocketConnect] No pending room. Checking current path: ${currentPathname} for potential room join.`);
            const state = listenerApi.getState() as RootState;
            
            let determinedRoomName: string | null = null;
            if (currentPathname === COURIER_ROUTE) {
                const courierChatId = findCourierChatId(state);
                if (courierChatId) {
                    determinedRoomName = courierChatId;
                } else {
                     logger.log(`[Store:SocketConnect] User or courier group chat ID not found for currentPathname: ${currentPathname} after connect.`);
                }
            } else {
                const inventoryMatch = currentPathname.match(/^\/inventory\/([^/]+)$/);
                if (inventoryMatch && inventoryMatch[1]) {
                    determinedRoomName = `inventory_${inventoryMatch[1]}`;
                }
            }

            if (determinedRoomName && determinedRoomName !== joinedRoomId) {
                logger.log(`[Store:SocketConnect] Current path suggests room ${determinedRoomName}. Current joined: ${joinedRoomId}. Attempting join.`);
                if (joinedRoomId) { // Это условие может сработать, если joinedRoomId не был сброшен корректно
                   logger.warn(`[Store:SocketConnect] Was already in room ${joinedRoomId} unexpectedly. Leaving before joining ${determinedRoomName}.`);
                   leaveRoom();
                }
                joinRoom(determinedRoomName);
            } else if (determinedRoomName && determinedRoomName === joinedRoomId) {
                logger.log(`[Store:SocketConnect] Already in suggested room ${determinedRoomName}. No action needed.`);
            } else {
                logger.log(`[Store:SocketConnect] Current path ${currentPathname} does not map to a new room, user data not ready, or no change needed. No room join initiated.`);
            }
        } else {
            logger.log("[Store:SocketConnect] No pending room and no current pathname. No room action.");
        }
    }
});

// 3. Слушатель отключения сокета -> отписки и обновление состояния комнаты
listenerMiddleware.startListening({
    actionCreator: socketDisconnected,
    effect: (action, listenerApi) => {
        logger.warn("[Store:SocketDisconnect] Listener triggered");
        unsubscribeDomainEvents();

        const state = listenerApi.getState() as RootState;

        if (joinedRoomId) {
            logger.log(`[Store:SocketDisconnect] Was in room: ${joinedRoomId}. Checking if still on target route...`);
            const previousJoinedRoomId = joinedRoomId; 
            joinedRoomId = null; 

            let targetRoomForCurrentRoute: string | null = null;
            if (currentPathname) {
                 if (currentPathname === COURIER_ROUTE) {
                    targetRoomForCurrentRoute = findCourierChatId(state) ?? null;
                } else {
                    const inventoryMatch = currentPathname.match(/^\/inventory\/([^/]+)$/);
                    if (inventoryMatch && inventoryMatch[1]) {
                        targetRoomForCurrentRoute = `inventory_${inventoryMatch[1]}`;
                    }
                }
            }
            logger.log(`[Store:SocketDisconnect] Current route: ${currentPathname}, Target room for this route: ${targetRoomForCurrentRoute}, Prev joined: ${previousJoinedRoomId}`);

            if (targetRoomForCurrentRoute && targetRoomForCurrentRoute === previousJoinedRoomId) {
                logger.log(`[Store:SocketDisconnect] Still on the route for room ${previousJoinedRoomId}. Setting as pending.`);
                pendingJoinRoomId = previousJoinedRoomId; 
            } else {
                logger.log(`[Store:SocketDisconnect] Not on the route for room ${previousJoinedRoomId} anymore (or target is ${targetRoomForCurrentRoute}). Clearing pending.`);
                pendingJoinRoomId = null; 
            }
        } else {
            logger.log("[Store:SocketDisconnect] Was not in any room. Clearing pending.");
            pendingJoinRoomId = null; 
        }
    }
});

// 4. Реакция на изменение маршрута
listenerMiddleware.startListening({
    actionCreator: routeChanged,
    effect: (action, listenerApi) => {
        const newPath = action.payload;
        const state = listenerApi.getState() as RootState;
        const previousPath = currentPathname;
        currentPathname = newPath;
        const isConnected = state.socket.isConnected;

        logger.log(`[Store:RouteChange] Listener triggered. Path: ${newPath}, Prev: ${previousPath}, Socket: ${isConnected}, CurrentRoom: ${joinedRoomId}`);

        let newTargetRoomName: string | null = null;
        if (newPath === COURIER_ROUTE) {
            const courierChatId = findCourierChatId(state);
            if (courierChatId) {
                newTargetRoomName = courierChatId;
            } else {
                logger.log(`[Store:RouteChange] Courier chat ID not (yet) available for ${newPath}`);
            }
        } else {
            const inventoryMatch = newPath.match(/^\/inventory\/([^/]+)$/);
            if (inventoryMatch && inventoryMatch[1]) {
                newTargetRoomName = `inventory_${inventoryMatch[1]}`;
            } else {
                // logger.log(`[Store:RouteChange] Path ${newPath} is not a special room route.`);
            }
        }
        logger.log(`[Store:RouteChange] Path: ${newPath}, Determined new target room name: ${newTargetRoomName}`);

        if (newTargetRoomName !== joinedRoomId) {
            logger.log(`[Store:RouteChange] Room change needed. Current: ${joinedRoomId}, New Target: ${newTargetRoomName}`);
            if (joinedRoomId) {
                logger.log(`[Store:RouteChange] Leaving current room: ${joinedRoomId}`);
                leaveRoom(); 
            }

            if (newTargetRoomName) { // Только если есть валидное имя новой комнаты
                if (isConnected) {
                    logger.log(`[Store:RouteChange] Joining new room: ${newTargetRoomName}`); 
                    joinRoom(newTargetRoomName); 
                } else {
                    logger.log(`[Store:RouteChange] Socket not connected. Setting pending room: ${newTargetRoomName}`); 
                    pendingJoinRoomId = newTargetRoomName; 
                }
            } else {
                logger.log(`[Store:RouteChange] No valid new target room, or already left previous room. No further join/pending action.`);
                // Если мы уходим с маршрута комнаты на маршрут без комнаты, и был pendingJoinRoomId, его нужно очистить
                if (pendingJoinRoomId) { // Не важно, какой был pending, если новая цель - не комната, очищаем
                    logger.log(`[Store:RouteChange] Clearing pendingJoinRoomId as new target is not a room or room name is unavailable.`);
                    pendingJoinRoomId = null;
                }
            }
        } else {
            logger.log(`[Store:RouteChange] No room change needed. Staying in room: ${joinedRoomId} (or new target is also ${newTargetRoomName}, possibly null).`);
        }
    }
});

// 5. Слушатель логаута -> полный дисконнект и очистка
listenerMiddleware.startListening({
    matcher: isAnyOf(
        userSlice.actions.clearUserData,
        userSlice.actions.resetUserState
    ),
    effect: (action, listenerApi: any) => {
        logger.warn(`[Store:LogoutListener] Disconnecting socket due to action: ${action.type}`);
        // listenerApi.dispatch(socketDisconnected()); // Не вызываем диспатч, т.к. это приведет к рекурсии и лишним действиям
        unsubscribeDomainEvents(); // Отписываемся от доменных событий
        leaveRoom(); // Выходим из текущей комнаты (если были)
        unsubscribeSocketConnect?.(); // Отписываемся от слушателя состояния сокета
        // Сбрасываем новые переменные
        joinedRoomId = null;
        pendingJoinRoomId = null;
        currentPathname = null;
        // Полностью отключаем сокет
        if (socketService.isInitialized()) {
             socketService.disconnect();
        }
    }
});



export default store; 