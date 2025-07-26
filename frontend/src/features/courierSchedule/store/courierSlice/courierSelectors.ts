// --- courierSelectors.ts ---
// Селекторы для состояния курьера.

import { RootState } from '@shared/store/store';
import { format } from 'date-fns';

export const selectCourierState = (state: RootState) => state.courier;
export const selectIsRegistered = (state: RootState) => state.courier.isRegistered;
export const selectCurrentShift = (state: RootState) => state.courier.currentShift;
export const selectIsLoading = (state: RootState) => state.courier.loading;
export const selectError = (state: RootState) => state.courier.error;
export const selectCouriers = (state: RootState) => state.courier.couriers;
export const selectCouriersLoading = (state: RootState) => state.courier.couriersLoading;
export const selectCouriersError = (state: RootState) => state.courier.couriersError;

// --- Селекторы для доступных курьеров ---
export const selectAvailableCouriers = (state: RootState) => state.courier.availableCouriers;
export const selectAvailableCouriersLoading = (state: RootState) => state.courier.availableCouriersLoading;
export const selectAvailableCouriersError = (state: RootState) => state.courier.availableCouriersError;
export const selectLastFetchedChatIdForCouriers = (state: RootState) => state.courier.lastFetchedChatId;

// НОВОЕ: Селекторы для курьерских чатов
export const selectCourierChats = (state: RootState) => state.courier.courierChats;
export const selectCourierChatsLoading = (state: RootState) => state.courier.courierChatsLoading;
export const selectCourierChatsError = (state: RootState) => state.courier.courierChatsError;

// Проверка: назначен ли курьер на дату
export const selectIsCourierAssignedOnDate = (
    state: RootState,
    userId: string,
    date: Date | string
): boolean => {
    const dateKey = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    return state.courier.assignedCouriersByDate[dateKey]?.[userId] ?? false;
}; 