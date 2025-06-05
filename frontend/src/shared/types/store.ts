// --- store.ts (types) ---
// Глобальные типы для Redux store

import type { InventoryState } from '@types/inventoryTypes';
import type { WriteOffState } from '@types/writeOff';
import type { NotificationState } from '@types/notification';
import type { UserState } from '@types/user';
import type { AdminState } from '@types/user'; // или './admin', если есть
import type { CourierState } from '@features/courierSchedule/types/courierScheduleTypes';
import type { ShiftState, ReserveState } from '@features/courierSchedule/types/courierScheduleTypes';
import type { ChatState } from '@features/chat/types/chatTypes';
import type { SocketState } from '@features/websocket/types/websocketTypes';
import type { AvailableCouriersState } from '@features/courierSchedule/types/courierScheduleTypes'; // или './availableCouriers', если есть
import type { EventsState } from '@features/courierSchedule/types/eventsTypes';
import type { AtoModalState } from '@features/courierSchedule/types/atoModalTypes'; // или './atoModal', если есть

// --- Интерфейс состояния всего приложения ---
export interface RootState {
  inventory: InventoryState;
  writeOff: WriteOffState;
  notification: NotificationState;
  user: UserState;
  admin: AdminState;
  courier: CourierState;
  shifts: ShiftState;
  chat: ChatState;
  reserves: ReserveState;
  socket: SocketState;
  availableCouriers: AvailableCouriersState;
  events: EventsState;
  atoModal: AtoModalState;
}

import { ThunkDispatch, AnyAction, Action, ThunkAction } from '@reduxjs/toolkit';

export type AppDispatch = ThunkDispatch<RootState, unknown, AnyAction>;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action<string>>; 