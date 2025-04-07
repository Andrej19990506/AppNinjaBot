import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import inventoryReducer /* , {
    subscribeToInventoryEvents,
    unsubscribeFromInventoryEvents
} */ from './slices/inventorySlice'; // Закомментированы импорты событий
import writeOffReducer from './slices/writeOffSlice';
import notificationReducer from './slices/notificationSlice';
// import authReducer from './slices/authSlice'; // Закомментировано
import userReducer, { initializeFromTelegram, userSlice } from './slices/userSlice';
import adminReducer from './slices/adminSlice';
import courierReducer from './slices/courierSlice';
import shiftsReducer, {
    subscribeToShiftEvents,
    unsubscribeFromShiftEvents,
    // subscribeToRegistrationEvents, // Закомментировано
    // unsubscribeFromRegistrationEvents // Закомментировано, т.к. такой нет, а unsubscribeFromShiftEvents уже есть
} from './slices/shiftsSlice';
import reservesReducer, {
    fetchReserves,
    subscribeToReserveEvents,
    unsubscribeFromReserveEvents
} from './slices/reservesSlice';
import socketReducer, { socketConnected, socketDisconnected } from './slices/socketSlice';
import { socketService } from '../services/socket';
// import { loadState, saveState } from './localStorage'; // Закомментировано
// import throttle from 'lodash.throttle'; // Закомментировано
import { logger } from '../utils/logger';
import { routeChanged } from './actions';
import { Socket } from 'socket.io-client';

// Создаем listener middleware instance
export const listenerMiddleware = createListenerMiddleware();

// --- Переменные состояния для комнаты курьеров --- 
let joinedCourierChatId: string | null = null;
let pendingJoinChatId: string | null = null;
let isOnCourierRoute: boolean = false;
let currentPathname: string | null = null;

// --- Хелперы для комнаты курьеров --- 
const COURIER_ROUTE = '/courier-schedule';
const isCourierRoute = (pathname?: string | null): boolean => pathname === COURIER_ROUTE;

// Защита от прямого вызова до инициализации store
const findCourierChatId = (state: RootState | null): string | undefined => {
    if (!state) {
        logger.error('[Store:findCourierChatId] Попытка вызова до инициализации state!');
        return undefined;
    }
    return state.user.user?.groups?.find(g => g.group_type === 'courier')?.chat_id?.toString();
};

const joinCourierRoom = (chatId: string) => {
    const state = store?.getState(); // Получаем state только когда функция вызвана
    if (!state) {
        logger.error('[Store:CourierRoom] Попытка войти в комнату без инициализированного store!');
        return;
    }
    const user = state.user.user;
    if (!user) {
        logger.error('[Store:CourierRoom] Попытка войти в комнату без данных пользователя!');
        return;
    }
    if (joinedCourierChatId === chatId) {
        logger.log(`[Store:CourierRoom] Уже в комнате ${chatId}, повторный вход не требуется.`);
        return;
    }
    logger.log(`[Store:CourierRoom] 🚪 Вход в комнату курьеров: ${chatId}`);
    socketService.joinRoom(chatId, {
        userId: user.id,
        firstName: user.first_name,
        lastName: user.last_name
    });
    joinedCourierChatId = chatId;
    pendingJoinChatId = null; // Вошли, ожидать больше не надо
};

const leaveCourierRoom = () => {
    if (joinedCourierChatId) {
        const leavingChatId = joinedCourierChatId;
        joinedCourierChatId = null; // Сначала сбрасываем флаг
        pendingJoinChatId = null; // И ожидание тоже
        logger.log(`[Store:CourierRoom] 🚪 Выход из комнаты курьеров: ${leavingChatId}`);
        if (socketService.isInitialized() && socketService.isConnected()) { // Проверяем и инициализацию, и коннект
            socketService.leaveRoom(leavingChatId);
        }
    }
    // Сбрасываем и ожидание на всякий случай
    pendingJoinChatId = null;
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
        reserves: reservesReducer,
        socket: socketReducer,
    },
    // preloadedState, // Закомментировано
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        }).prepend(listenerMiddleware.middleware),
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
    reserves: ReturnType<typeof reservesReducer>;
    socket: ReturnType<typeof socketReducer>;
};

export type AppDispatch = typeof store.dispatch;

// --- Логика Listener Middleware --- 

// Закомментируем связанные с localStorage части
/*
const actionsToPersist = [
    authReducer.actions.setAuthData,
    userReducer.actions.setUser,
    inventoryReducer.actions.selectChat,
    inventoryReducer.actions.clearSelectedChat
];

listenerMiddleware.startListening({
    matcher: isAnyOf(...actionsToPersist),
    effect: (action, listenerApi) => {
        const state = listenerApi.getState() as RootState;
        const stateToSave = {
            auth: state.auth,
            user: state.user,
            inventory: {
                selectedChatId: state.inventory.selectedChatId
            }
        };
        saveState(stateToSave);
    }
});
*/

let unsubscribeSocketConnect: (() => void) | null = null;
let unsubscribeSocketDisconnect: (() => void) | null = null;
let isSubscribedToDomainEvents = false; // Флаг для доменных подписок

// --- Переменные для хранения функций отписки от доменных событий ---
let domainUnsubscribeFunctions: (() => void)[] = [];

// Функция подписки на доменные события
const setupSubscriptions = (dispatch: AppDispatch, getState: () => RootState) => {
    if (isSubscribedToDomainEvents) {
        logger.log('[Store:setupSubscriptions] Domain events already subscribed.');
        return; // Уже подписаны
    }
    logger.log('[Store:setupSubscriptions] Subscribing to domain events...');
    
    // Очищаем старые функции отписки перед новыми подписками
    unsubscribeDomainEvents(); 
    domainUnsubscribeFunctions = []; // Сбрасываем массив

    try {
        // Подписываемся и сохраняем функции отписки
        domainUnsubscribeFunctions.push(subscribeToShiftEvents(dispatch));
        domainUnsubscribeFunctions.push(subscribeToReserveEvents(dispatch));
        // domainUnsubscribeFunctions.push(subscribeToInventoryEvents(dispatch)); // Закомментировано
        // domainUnsubscribeFunctions.push(subscribeToRegistrationEvents(dispatch, getState)); // Закомментировано
        
        isSubscribedToDomainEvents = true;
        logger.log('[Store:setupSubscriptions] Successfully subscribed to domain events.');
    } catch (error) {
        logger.error('[Store:setupSubscriptions] Error during domain event subscription:', error);
        // Попытка отписаться от того, на что успели подписаться
        unsubscribeDomainEvents(); 
    }
};

// Функция ОТПИСКИ от доменных событий
const unsubscribeDomainEvents = () => {
    if (!isSubscribedToDomainEvents && domainUnsubscribeFunctions.length === 0) {
        // Не подписаны и нет сохраненных функций для отписки
        // logger.log('[Store:unsubscribeDomainEvents] Not subscribed to domain events or no unsubscribe functions available.');
        return; 
    }
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
    isSubscribedToDomainEvents = false;
    logger.log('[Store:unsubscribeDomainEvents] Successfully unsubscribed from domain events.');
};

// Глобальный обработчик Connect
const handleSocketConnect = () => {
    logger.log('[Store:handleSocketConnect] Socket connected!');
    const dispatch = store.dispatch;
    const getState = store.getState; // Получаем getState
    dispatch(socketConnected());

    // 1. Настраиваем доменные подписки
    setupSubscriptions(dispatch, getState); // Передаем getState

    // 2. Логика комнаты курьеров при коннекте
    if (pendingJoinChatId) {
        logger.log(`[Store:handleSocketConnect] Входим в ОЖИДАЮЩУЮ комнату курьеров: ${pendingJoinChatId}`);
        joinCourierRoom(pendingJoinChatId);
    } else if (isOnCourierRoute && !joinedCourierChatId) {
        const state = store?.getState();
        const chatId = findCourierChatId(state);
        if (chatId) {
            logger.log(`[Store:handleSocketConnect] Сокет подключился на курьерском роуте. Входим в комнату: ${chatId}`);
            joinCourierRoom(chatId);
        }
    }
};

// Глобальный обработчик Disconnect
const handleSocketDisconnect = (reason: Socket.DisconnectReason) => {
    logger.warn(`[Store:handleSocketDisconnect] Socket disconnected! Reason: ${reason}`);
    store.dispatch(socketDisconnected());

    // 1. Отписываемся от доменных событий
    unsubscribeDomainEvents();

    // 2. Логика комнаты курьеров при дисконнекте
    if (joinedCourierChatId) {
        logger.log(`[Store:handleSocketDisconnect] Мы были в комнате ${joinedCourierChatId}.`);
        const currentJoinedChatId = joinedCourierChatId;
        joinedCourierChatId = null;
        if (isOnCourierRoute) {
            const state = store?.getState();
            const chatId = findCourierChatId(state);
            if (chatId === currentJoinedChatId) {
                 logger.log(`[Store:handleSocketDisconnect] ...но мы все еще на курьерском роуте (${currentPathname}). Ставим комнату ${chatId} в ожидание.`);
                 pendingJoinChatId = chatId;
            } else {
                 logger.warn(`[Store:handleSocketDisconnect] ...но текущий chatId (${chatId}) не совпадает с тем, из которого вышли (${currentJoinedChatId}). Ожидание не ставим.`);
                 pendingJoinChatId = null;
            }
        } else {
             pendingJoinChatId = null;
        }
    } else {
         pendingJoinChatId = null;
    }
};

// Функция запуска глобальных слушателей сокета
const startSocketStateListener = () => {
     logger.log('[Store:startSocketListener] Starting socket state listener...');
    // Отписываемся от старых перед подпиской на новые
    unsubscribeSocketConnect?.();
    unsubscribeSocketDisconnect?.();

    unsubscribeSocketConnect = socketService.subscribe('connect', handleSocketConnect);
    unsubscribeSocketDisconnect = socketService.subscribe('disconnect', handleSocketDisconnect);

    // Если сокет уже подключен в момент запуска слушателя
    if (socketService.isInitialized() && socketService.isConnected()) { // Проверяем и инициализацию, и коннект
        logger.log('[Store:startSocketListener] Socket already connected. Triggering connect handler manually.');
        handleSocketConnect(); // Вызываем обработчик для настройки подписок и входа в комнату
    }
};

// --- Слушатели Middleware --- 

// 1. Инициализация пользователя -> Инициализация сокета + Запуск слушателя состояния сокета + Первая попытка connect
listenerMiddleware.startListening({
    actionCreator: initializeFromTelegram.fulfilled,
    effect: async (action, listenerApi) => {
        const userId = action.payload?.id; // Добавил проверку на payload
        logger.log(`[Store:UserInitListener] User initialized. UserID: ${userId}`);

        if (userId) {
            if (!socketService.isInitialized()) {
                logger.log(`[Store:UserInitListener] Initializing socket...`);
                socketService.init(process.env.REACT_APP_WS_URL, userId);
                // Запускаем слушатель состояния ТОЛЬКО после первой инициализации
                startSocketStateListener();
            } else {
                logger.log(`[Store:UserInitListener] Socket already initialized. Ensuring state listener is running...`);
                // На всякий случай перезапускаем слушатель, если сокет уже был, но вдруг слушатель отвалился
                startSocketStateListener();
            }

            // Пытаемся подключиться
            if (!socketService.isConnected()) {
                logger.log(`[Store:UserInitListener] Attempting to connect socket...`);
                socketService.connect();
            } else {
                // Если уже подключен, убедимся что handleConnect был вызван
                 logger.log(`[Store:UserInitListener] Socket already connected. Triggering connect handler manually if needed...`);
                 // handleSocketConnect(); // Убрал повторный вызов, т.к. он уже есть в startSocketStateListener
            }
        } else {
             logger.warn('[Store:UserInitListener] User initialized but no UserID found!');
        }
    }
});

// 2. Слушатель смены роута -> вход/выход из комнаты курьеров
listenerMiddleware.startListening({
    actionCreator: routeChanged,
    effect: (action, listenerApi) => {
        logger.log(`[Store:RouteChange] Listener triggered for path: ${action.payload}`);
        const newPathname = action.payload;
        const oldPathname = currentPathname;
        currentPathname = newPathname;

        const wasOnCourier = isCourierRoute(oldPathname);
        const nowOnCourier = isCourierRoute(newPathname);
        const state = listenerApi.getState() as RootState;
        const isConnected = state.socket.isConnected;
        isOnCourierRoute = nowOnCourier;

        logger.log(`[Store:RouteChange] Route: ${oldPathname} -> ${newPathname}. IsCourier: ${nowOnCourier}. SocketConnected(from state): ${isConnected}`);

        if (nowOnCourier && !wasOnCourier) {
            logger.log('[Store:RouteChange] Вошли в курьерский раздел.');
            const chatId = findCourierChatId(state);
            if (chatId) {
                if (isConnected) {
                    logger.log('[Store:RouteChange] Сокет подключен (из state), входим в комнату курьеров...');
                    joinCourierRoom(chatId);
                } else {
                    logger.log(`[Store:RouteChange] Сокет НЕ подключен (из state), ставим комнату курьеров ${chatId} в ожидание...`);
                    pendingJoinChatId = chatId;
                }
            } else {
                logger.warn('[Store:RouteChange] Не найден chatId курьера при входе в раздел.');
            }
        } else if (!nowOnCourier && wasOnCourier) {
            logger.log('[Store:RouteChange] Вышли из курьерского раздела.');
            leaveCourierRoom();
        } else {
             logger.log(`[Store:RouteChange] Навигация ${nowOnCourier ? 'внутри' : 'вне'} курьерского раздела, комната не меняется.`);
        }
    }
});

// 3. Слушатель логаута -> полный дисконнект и очистка
listenerMiddleware.startListening({
    matcher: isAnyOf(
        userSlice.actions.clearUserData,
        userSlice.actions.resetUserState
    ),
    effect: async (action, listenerApi) => {
        logger.warn(`[Store:LogoutListener] Disconnecting socket due to action: ${action.type}`);
        listenerApi.dispatch(socketDisconnected());
        unsubscribeDomainEvents();
        leaveCourierRoom();
        unsubscribeSocketConnect?.();
        unsubscribeSocketDisconnect?.();
        unsubscribeSocketConnect = null;
        unsubscribeSocketDisconnect = null;
        joinedCourierChatId = null;
        pendingJoinChatId = null;
        isOnCourierRoute = false;
        currentPathname = null;
        isSubscribedToDomainEvents = false;
        if (socketService.isInitialized()) {
             socketService.disconnect();
        }
    }
});

// Загружаем резервы при инициализации приложения
store.dispatch(fetchReserves());

export default store; 