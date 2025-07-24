import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import type { } from '@reduxjs/toolkit';
import inventoryReducer from '@/store/slices/inventorySlice';
import writeOffReducer from '@/features/WriteOff/store/writeOffSlice';
import notificationReducer from '@shared/store/notificationSlice/notificationSlice';
import userReducer, { userSlice } from '@shared/store/userSlice/userSlice';
import { initializeFromTelegram } from '@shared/store/userSlice/userThunks';
import adminReducer from '@/shared/store/adminSlice/adminSlice';
import courierReducer from '@features/courierSchedule/store/courierSlice/courierSlice';
import shiftsReducer from '@features/courierSchedule/store/shiftsSlice/shiftsSlice';
import reservesReducer from '@features/courierSchedule/store/reservesSlice/reservesSlice';
import { socketService, SocketState as ServiceSocketState } from '@shared/services/socketService';
import { routeChanged } from '@/store/actions';
import chatReducer from '@/shared/store/chatSlice/chatSlice';
import availableCouriersReducer from '@/features/courierSchedule/store/courierSlice/courierSlice';
import eventsReducer from '@/store/slices/eventsSlice';
import atoModalReducer from '@/store/slices/atoModalSlice';
import socketReducer, { socketConnected, socketDisconnected } from '@/store/slices/socketSlice';
import competitionsReducer from '@/store/slices/competitionsSlice';

// --- Middleware для прослушивания событий ---
export const listenerMiddleware = createListenerMiddleware();

// --- Переменные для логики комнат (WebSocket) ---
let joinedRoomId: string | null = null; // ID текущей комнаты
let pendingJoinRoomId: string | null = null; // Комната, в которую нужно войти после переподключения
let currentPathname: string | null = null; // Текущий маршрут

// --- Хелперы для работы с комнатами ---
const COURIER_ROUTE = '/courier/courier-schedule';

// Получить chat_id курьерской группы из state
const findCourierChatId = (state: RootState | null): string | undefined => {
    if (!state) {
        throw new Error('[Store:findCourierChatId] Попытка вызова до инициализации state!');
    }
    return state.user?.user?.groups?.find(g => g.group_type === 'courier')?.chat_id?.toString();
};

// Войти в комнату по roomId
const joinRoom = (roomId: string) => {
    const state = store?.getState();
    if (!state) {
        throw new Error('[Store:RoomLogic] Попытка войти в комнату без инициализированного store!');
    }
    const user = state.user.user;
    if (!user) {
        throw new Error('[Store:RoomLogic] Попытка войти в комнату без данных пользователя!');
    }
    if (joinedRoomId === roomId) {
        return;
    }
    if (joinedRoomId) {
        leaveRoom();
    }
    socketService.joinRoom(roomId, {
        userId: user.id,
        first_name: user.first_name,
        last_name: user.last_name
    });
    joinedRoomId = roomId;
    pendingJoinRoomId = null;
};

// Выйти из текущей комнаты
const leaveRoom = () => {
    if (joinedRoomId) {
        const leavingRoomId = joinedRoomId;
        joinedRoomId = null;
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
        user: userReducer,
        admin: adminReducer,
        courier: courierReducer,
        shifts: shiftsReducer,
        chat: chatReducer,
        reserves: reservesReducer,
        socket: socketReducer,
        availableCouriers: availableCouriersReducer,
        events: eventsReducer,
        atoModal: atoModalReducer,
        competitions: competitionsReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        }).prepend(listenerMiddleware.middleware)
});

// --- Типы для всего приложения ---
export type RootState = {
    inventory: ReturnType<typeof inventoryReducer>;
    writeOff: ReturnType<typeof writeOffReducer>;
    notification: ReturnType<typeof notificationReducer>;
    user: ReturnType<typeof userReducer>;
    admin: ReturnType<typeof adminReducer>;
    courier: ReturnType<typeof courierReducer>;
    shifts: ReturnType<typeof shiftsReducer>;
    chat: ReturnType<typeof chatReducer>;
    reserves: ReturnType<typeof reservesReducer>;
    socket: ReturnType<typeof socketReducer>;
    availableCouriers: ReturnType<typeof availableCouriersReducer>;
    events: ReturnType<typeof eventsReducer>;
    atoModal: ReturnType<typeof atoModalReducer>;
    competitions: ReturnType<typeof competitionsReducer>;
};
export type AppDispatch = typeof store.dispatch;

let unsubscribeSocketConnect: (() => void) | null = null;
let domainUnsubscribeFunctions: (() => void)[] = [];

// --- Подписка на доменные события (оставлено для расширения) ---
const setupSubscriptions = (dispatch: AppDispatch, getState: () => RootState) => {
    unsubscribeDomainEvents(); 
    domainUnsubscribeFunctions = [];
    // Здесь можно добавить подписки на события (например, смены, резервы и т.д.)
    };

    // --- Отписка от доменных событий ---
    const unsubscribeDomainEvents = () => {
    domainUnsubscribeFunctions.forEach(unsubscribe => {
        try {
            unsubscribe();
        } catch (error) {
            // Ошибка при отписке от события
        }
    });
    domainUnsubscribeFunctions = [];
};

// --- Обработчик подключения сокета ---
const handleSocketConnect = () => {
    const dispatch = store.dispatch;
    dispatch(socketConnected());
};

// --- Обработчик отключения сокета ---
const handleSocketDisconnect = (reason: string): void => {
    store.dispatch(socketDisconnected());
    unsubscribeDomainEvents();
    if (joinedRoomId) {
        const previousJoinedRoomId = joinedRoomId;
        joinedRoomId = null;
        let targetRoomForCurrentRoute: string | null = null;
        if (currentPathname) {
            const state = store?.getState();
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
             pendingJoinRoomId = previousJoinedRoomId;
        } else {
             pendingJoinRoomId = null;
        }
    } else {
         pendingJoinRoomId = null;
    }
};

// --- Слушатель состояния сокета ---
const startSocketStateListener = () => {
    if (unsubscribeSocketConnect) {
        unsubscribeSocketConnect();
        unsubscribeSocketConnect = null;
    }
    unsubscribeSocketConnect = socketService.onStateChange((newState: ServiceSocketState) => {
        const currentIsConnected = store.getState().socket.isConnected;
        if (newState.isConnected && !currentIsConnected) {
            handleSocketConnect();
        } else if (!newState.isConnected && currentIsConnected) {
            handleSocketDisconnect(newState.error || 'Состояние изменено на отключено');
        }
    });
};

// --- Middleware listeners ---
// 1. Инициализация пользователя -> инициализация сокета и запуск слушателя
listenerMiddleware.startListening({
    actionCreator: initializeFromTelegram.fulfilled,
    effect: (action) => {
        const userId = action.payload.id;
        const wsUrl = window.APP_CONFIG?.WS_URL || import.meta.env.VITE_WS_URL || 'ws://localhost:8001';
        socketService.init(wsUrl, userId); 
        startSocketStateListener();
        try {
            socketService.connect(); 
        } catch (error) {
            throw new Error('Ошибка при подключении сокета');
        }
    }
});

// 2. Слушатель подключения сокета -> подписки на события и вход в комнату
listenerMiddleware.startListening({
    actionCreator: socketConnected,
    effect: (action, listenerApi) => {
        setupSubscriptions(listenerApi.dispatch as AppDispatch, listenerApi.getState as () => RootState);
        if (pendingJoinRoomId) {
            joinRoom(pendingJoinRoomId);
        } else if (currentPathname) {
            const state = listenerApi.getState() as RootState;
            let determinedRoomName: string | null = null;
            if (currentPathname === COURIER_ROUTE) {
                const courierChatId = findCourierChatId(state);
                if (courierChatId) {
                    determinedRoomName = courierChatId;
                }
            } else {
                const inventoryMatch = currentPathname.match(/^\/inventory\/([^/]+)$/);
                if (inventoryMatch && inventoryMatch[1]) {
                    determinedRoomName = `inventory_${inventoryMatch[1]}`;
                }
            }
            if (determinedRoomName && determinedRoomName !== joinedRoomId) {
                if (joinedRoomId) {
                   leaveRoom();
                }
                joinRoom(determinedRoomName);
            }
        }
    }
});

// 3. Слушатель отключения сокета -> отписки и обновление состояния комнаты
listenerMiddleware.startListening({
    actionCreator: socketDisconnected,
    effect: (action, listenerApi) => {
        unsubscribeDomainEvents();
        const state = listenerApi.getState() as RootState;
        if (joinedRoomId) {
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
            if (targetRoomForCurrentRoute && targetRoomForCurrentRoute === previousJoinedRoomId) {
                pendingJoinRoomId = previousJoinedRoomId; 
            } else {
                pendingJoinRoomId = null; 
            }
        } else {
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
        let newTargetRoomName: string | null = null;
        if (newPath === COURIER_ROUTE) {
            const courierChatId = findCourierChatId(state);
            if (courierChatId) {
                newTargetRoomName = courierChatId;
            }
        } else {
            const inventoryMatch = newPath.match(/^\/inventory\/([^/]+)$/);
            if (inventoryMatch && inventoryMatch[1]) {
                newTargetRoomName = `inventory_${inventoryMatch[1]}`;
            }
        }
        if (newTargetRoomName !== joinedRoomId) {
            if (joinedRoomId) {
                leaveRoom(); 
            }
            if (newTargetRoomName) {
                if (isConnected) {
                    console.log('[DEBUG] Попытка joinRoom для курьеров:', newTargetRoomName);
                    joinRoom(newTargetRoomName); 
                } else {
                    pendingJoinRoomId = newTargetRoomName; 
                }
            } else {
                if (pendingJoinRoomId) {
                    pendingJoinRoomId = null;
                }
            }
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
        unsubscribeDomainEvents();
        leaveRoom();
        unsubscribeSocketConnect?.();
        joinedRoomId = null;
        pendingJoinRoomId = null;
        currentPathname = null;
        if (socketService.isInitialized()) {
             socketService.disconnect();
        }
    }
});

export default store; 