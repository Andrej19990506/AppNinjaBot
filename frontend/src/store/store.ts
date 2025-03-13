import { configureStore } from '@reduxjs/toolkit';
import inventoryReducer, { setupHistoryWebSocket } from './slices/inventorySlice';
import notificationReducer from './slices/notificationSlice';
import writeOffReducer, { setupWriteOffWebSocket } from './slices/writeOffSlice';

export const store = configureStore({
    reducer: {
        inventory: inventoryReducer,
        notification: notificationReducer,
        writeOff: writeOffReducer
    },
    middleware: (getDefaultMiddleware) => 
        getDefaultMiddleware({
            serializableCheck: false
        })
});

// Настройка WebSocket для истории
setupHistoryWebSocket(store);

// Настройка WebSocket для списаний
setupWriteOffWebSocket(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 