import { configureStore } from '@reduxjs/toolkit';
import inventoryReducer, { setupHistoryWebSocket } from './slices/inventorySlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
    reducer: {
        inventory: inventoryReducer,
        notification: notificationReducer
    },
    middleware: (getDefaultMiddleware) => 
        getDefaultMiddleware({
            serializableCheck: false
        })
});

// Настройка WebSocket для истории
setupHistoryWebSocket(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 