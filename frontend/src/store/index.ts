import { configureStore, Action, ThunkAction } from '@reduxjs/toolkit';
import chatReducer from './slices/chatSlice';
import inventoryReducer from './slices/inventorySlice';
import notificationReducer from './slices/notificationSlice';
import writeOffReducer from './slices/writeOffSlice';
import userReducer from './slices/userSlice';
import courierReducer from './slices/courierSlice';
import shiftsReducer from './slices/shiftsSlice';
import reservesReducer from './slices/reservesSlice';
import socketReducer from './slices/socketSlice';

import store from './store';

import { setupWriteOffWebSocket } from './slices/writeOffSlice';
import { subscribeToShiftEvents } from './slices/shiftsSlice';

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 