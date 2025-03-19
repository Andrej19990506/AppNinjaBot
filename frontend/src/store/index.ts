import { configureStore, Action, ThunkAction } from '@reduxjs/toolkit';
import chatReducer from './slices/chatSlice';
import inventoryReducer from './slices/inventorySlice';
import notificationReducer from './slices/notificationSlice';
import writeOffReducer from './slices/writeOffSlice';
import userReducer from './slices/userSlice';
import courierReducer from './slices/courierSlice';
import shiftsReducer from './slices/shiftsSlice';
import reservesReducer, { subscribeToReserveEvents, fetchReserves } from './slices/reservesSlice';
import { setupWriteOffWebSocket } from './slices/writeOffSlice';
import { subscribeToShiftEvents } from './slices/shiftsSlice';

export const store = configureStore({
    reducer: {
        chats: chatReducer,
        inventory: inventoryReducer,
        notification: notificationReducer,
        writeOff: writeOffReducer,
        user: userReducer,
        courier: courierReducer,
        shifts: shiftsReducer,
        reserves: reservesReducer
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Игнорируем определенные action types для WebSocket
                ignoredActions: ['socket/connected', 'socket/disconnected'],
            },
        }),
});

// Инициализируем WebSocket соединения
setupWriteOffWebSocket(store);
subscribeToShiftEvents(store.dispatch);
subscribeToReserveEvents(store.dispatch);

// Загружаем резервы при инициализации приложения
store.dispatch(fetchReserves());

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    RootState,
    unknown,
    Action<string>
>; 