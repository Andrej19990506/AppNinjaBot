import { configureStore } from '@reduxjs/toolkit';
import inventoryReducer from './slices/inventorySlice';
import writeOffReducer from './slices/writeOffSlice';
import notificationReducer from './slices/notificationSlice';
import userReducer from './slices/userSlice';
import adminReducer from './slices/adminSlice';
import { setupWriteOffWebSocket } from './slices/writeOffSlice';

const store = configureStore({
    reducer: {
        inventory: inventoryReducer,
        writeOff: writeOffReducer,
        notification: notificationReducer,
        user: userReducer,
        admin: adminReducer
    },
    middleware: (getDefaultMiddleware) => 
        getDefaultMiddleware({
            serializableCheck: false
        })
});

// Initialize WebSocket connections
setupWriteOffWebSocket(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { store }; 