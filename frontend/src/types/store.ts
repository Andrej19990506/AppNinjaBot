import { CourierShift } from './shifts';
import { InventoryItem } from './inventoryTypes';
import { WriteOffItem } from './writeOff';
import { Notification, User } from './index';
import { Action, ThunkAction } from '@reduxjs/toolkit';
import { ThunkDispatch, AnyAction } from '@reduxjs/toolkit';

// Определяем типы состояний - УДАЛЕНО

// --- Определяем AppDispatch и AppThunk ---
export type AppDispatch = ThunkDispatch<any, unknown, AnyAction>; // Используем any временно, пока RootState не импортирован

export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    any, // Используем any временно
    unknown,
    Action<string>
>;
// --- -------------------------------- --- 