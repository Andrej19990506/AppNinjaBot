import { configureStore, Action, ThunkAction } from '@reduxjs/toolkit';
import chatReducer from './slices/chatSlice';
import inventoryReducer from './slices/inventorySlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
    reducer: {
        chats: chatReducer,
        inventory: inventoryReducer,
        notification: notificationReducer
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Игнорируем определенные action types для WebSocket
                ignoredActions: ['socket/connected', 'socket/disconnected'],
            },
        }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    RootState,
    unknown,
    Action<string>
>; 