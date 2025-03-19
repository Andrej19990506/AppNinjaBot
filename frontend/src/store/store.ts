import { configureStore } from '@reduxjs/toolkit';
import inventoryReducer from './slices/inventorySlice';
import writeOffReducer from './slices/writeOffSlice';
import notificationReducer from './slices/notificationSlice';
import userReducer from './slices/userSlice';
import adminReducer from './slices/adminSlice';
import courierReducer from './slices/courierSlice';
import shiftsReducer from './slices/shiftsSlice';
import reservesReducer from './slices/reservesSlice';
import { setupWriteOffWebSocket } from './slices/writeOffSlice';
import { subscribeToShiftEvents } from './slices/shiftsSlice';
import { subscribeToReserveEvents } from './slices/reservesSlice';

const store = configureStore({
    reducer: {
        inventory: inventoryReducer,
        writeOff: writeOffReducer,
        notification: notificationReducer,
        user: userReducer,
        admin: adminReducer,
        courier: courierReducer,
        shifts: shiftsReducer,
        reserves: reservesReducer
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        })
});

// Initialize WebSocket connections
setupWriteOffWebSocket(store);
subscribeToShiftEvents(store.dispatch);
subscribeToReserveEvents(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store; 