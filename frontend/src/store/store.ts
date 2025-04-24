import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import type { ListenerEffectAPI, PayloadAction } from '@reduxjs/toolkit';
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
import { Socket } from 'socket.io-client';
import chatReducer from './slices/chatSlice';
import availableCouriersReducer from './slices/availableCouriersSlice';
// import inventoryItemsReducer from './slices/inventoryItemSlice';
// import inventoryCategoriesReducer from './slices/inventoryCategorySlice';

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
    return state.user.user?.groups?.find(g => g.group_type === 'courier')?.chat_id?.toString();
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
    pendingJoinRoomId = null;
};

const leaveRoom = () => {
    if (joinedRoomId) {
        const leavingRoomId = joinedRoomId;
        joinedRoomId = null;
        pendingJoinRoomId = null;
        logger.log(`[Store:RoomLogic] 🚪 Выход из комнаты: ${leavingRoomId}`);
        if (socketService.isInitialized() && socketService.isConnected()) {
            socketService.leaveRoom(leavingRoomId);
        }
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
        const currentJoinedRoomId = joinedRoomId;
        joinedRoomId = null;
        if (currentPathname) {
            const state = store?.getState();
            const chatId = findCourierChatId(state);
            if (chatId === currentJoinedRoomId) {
                 logger.log(`[Store:handleSocketDisconnect] ...но мы все еще на курьерском роуте (${currentPathname}). Ставим комнату ${chatId} в ожидание.`);
                 pendingJoinRoomId = chatId;
            } else {
                 logger.warn(`[Store:handleSocketDisconnect] ...но текущий chatId (${chatId}) не совпадает с тем, из которого вышли (${currentJoinedRoomId}). Ожидание не ставим.`);
                 pendingJoinRoomId = null;
            }
        } else {
             pendingJoinRoomId = null;
        }
    } else {
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
        // Инициализируем и подключаем сокет
        logger.log(`[Store:UserInitListener] Initializing socket...`);
        socketService.init(`ws://${window.location.hostname}:8001`, userId);
        logger.log('[Store:startSocketStateListener] Starting socket state listener...');
        startSocketStateListener(); // Запускаем прослушивание состояния сокета
        logger.log('[Store:UserInitListener] Attempting to connect socket...');
        socketService.connect();
        
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
        
        // Подписываемся на основные события сокета (не доменные)
        // setupSubscriptions здесь, чтобы гарантировать подписку после *каждого* успешного коннекта
        setupSubscriptions(listenerApi.dispatch as AppDispatch, listenerApi.getState as () => RootState);
        
        // Проверяем, есть ли комната в ожидании
        if (pendingJoinRoomId) {
            logger.log(`[Store:SocketConnect] Found pending room: ${pendingJoinRoomId}. Joining...`);
            joinRoom(pendingJoinRoomId); // pendingJoinRoomId будет сброшен внутри joinRoom
        } else {
            logger.log("[Store:SocketConnect] No pending room to join.");
        }
    }
});

// 3. Слушатель отключения сокета -> отписки и обновление состояния комнаты
listenerMiddleware.startListening({
    actionCreator: socketDisconnected,
    effect: (action, listenerApi) => {
        logger.warn("[Store:SocketDisconnect] Listener triggered");
        // Отписываемся от событий домена при разрыве соединения
        unsubscribeDomainEvents();
        // Основные подписки (типа pong) не отменяем здесь, они должны управляться в setup/teardown
        // или при полном логауте

        const state = listenerApi.getState() as RootState;

        if (joinedRoomId) {
            logger.log(`[Store:SocketDisconnect] Was in room: ${joinedRoomId}. Checking if still on target route...`);
            const currentJoinedRoomId = joinedRoomId; // Сохраняем ID комнаты, в которой были
            joinedRoomId = null; // Считаем, что вышли из комнаты

            // Проверяем, нужно ли снова войти в эту комнату при переподключении
            let targetRoomForCurrentRoute: string | null = null;
            if (currentPathname === COURIER_ROUTE) {
                targetRoomForCurrentRoute = findCourierChatId(state) ?? null;
            } else {
                const inventoryMatch = currentPathname?.match(/^\/inventory\/([^/]+)$/);
                if (inventoryMatch && inventoryMatch[1]) {
                    targetRoomForCurrentRoute = inventoryMatch[1];
                }
            }
            logger.log(`[Store:SocketDisconnect] Current route: ${currentPathname}, Target room for this route: ${targetRoomForCurrentRoute}`);

            if (targetRoomForCurrentRoute === currentJoinedRoomId) {
                logger.log(`[Store:SocketDisconnect] Still on the route for room ${currentJoinedRoomId}. Setting as pending.`);
                pendingJoinRoomId = currentJoinedRoomId; // Ставим в ожидание
            } else {
                logger.log(`[Store:SocketDisconnect] Not on the route for room ${currentJoinedRoomId} anymore (or target is null). Clearing pending.`);
                pendingJoinRoomId = null; // Сбрасываем ожидание
            }
        } else {
            logger.log("[Store:SocketDisconnect] Was not in any room. Clearing pending.");
            pendingJoinRoomId = null; // На всякий случай сбрасываем ожидание
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

        let targetRoomId: string | null = null;

        // Определяем целевую комнату
        if (newPath === COURIER_ROUTE) {
            targetRoomId = findCourierChatId(state) ?? null;
            logger.log(`[Store:RouteChange] Target is Courier Route. Found Chat ID: ${targetRoomId}`);
        } else {
            const inventoryMatch = newPath.match(/^\/inventory\/([^/]+)$/); // Ищем /inventory/:chatId
            if (inventoryMatch && inventoryMatch[1]) {
                targetRoomId = inventoryMatch[1]; // chatId из пути
                 // Добавим проверку, что это действительно чат повара?
                 // const group = state.inventory.items.find(item => item.chat_id === targetRoomId);
                 // if (group?.group_type !== 'chef') { targetRoomId = null; }
                logger.log(`[Store:RouteChange] Target is Chef Inventory Route. Found Chat ID: ${targetRoomId}`);
            } else {
                logger.log(`[Store:RouteChange] Target is not a special room route.`);
            }
        }

        // Логика входа/выхода
        if (targetRoomId !== joinedRoomId) {
            logger.log(`[Store:RouteChange] Room change needed. Current: ${joinedRoomId}, Target: ${targetRoomId}`);
            // 1. Если были в комнате, выходим
            if (joinedRoomId) {
                logger.log(`[Store:RouteChange] Leaving current room: ${joinedRoomId}`);
                leaveRoom(); // leaveRoom сама сбрасывает joinedRoomId и pendingJoinRoomId
            }

            // 2. Если новая комната есть, входим или ставим в ожидание
            if (targetRoomId) {
                // <<< ИСПРАВЛЕНИЕ: Формируем ПРАВИЛЬНОЕ имя комнаты >>>
                let roomNameToJoin: string;
                if (newPath === COURIER_ROUTE) {
                    // Для курьеров targetRoomId - это и есть ID чата (имя комнаты)
                    roomNameToJoin = targetRoomId;
                } else {
                    // Для инвентаря добавляем префикс
                    roomNameToJoin = `inventory_${targetRoomId}`;
                }
                // <<< КОНЕЦ ИСПРАВЛЕНИЯ >>>

                if (isConnected) {
                    // Используем roomNameToJoin
                    logger.log(`[Store:RouteChange] Joining new room: ${roomNameToJoin}`); 
                    joinRoom(roomNameToJoin); 
                } else {
                    // Используем roomNameToJoin
                    logger.log(`[Store:RouteChange] Socket not connected. Setting pending room: ${roomNameToJoin}`); 
                    pendingJoinRoomId = roomNameToJoin; 
                }
            }
             // Если targetRoomId = null, мы уже вышли на шаге 1, делать больше нечего.
        } else {
            logger.log(`[Store:RouteChange] No room change needed. Staying in room: ${joinedRoomId}`);
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