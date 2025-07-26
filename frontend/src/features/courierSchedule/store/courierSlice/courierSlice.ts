// --- courierSlice.ts ---
// Только slice и редьюсеры для состояния курьера. Thunks и селекторы вынесены в отдельные файлы.

import { createSlice } from '@reduxjs/toolkit';
import { CourierInfo } from '@features/courierSchedule/types/courierScheduleTypes';
import { format } from 'date-fns';
import { fetchAvailableCouriers, fetchCouriers, fetchCourierChats, CourierChat } from '@features/courierSchedule/store/courierSlice/courierThunks';
import { assignCourierToShiftThunk } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';

interface CourierState {
    isRegistered: boolean;
    currentShift: {
        startTime: string | null;
        endTime: string | null;
    } | null;
    loading: boolean;
    error: string | null;
    couriers: CourierInfo[];
    couriersLoading: boolean;
    couriersError: string | null;
    availableCouriers: CourierInfo[];
    availableCouriersLoading: boolean;
    availableCouriersError: string | null;
    lastFetchedChatId: string | null;
    assignedCouriersByDate: Record<string, Record<string, boolean>>;
    
    // НОВОЕ: состояние для курьерских чатов
    courierChats: CourierChat[];
    courierChatsLoading: boolean;
    courierChatsError: string | null;
}

const initialState: CourierState = {
    isRegistered: false,
    currentShift: null,
    loading: false,
    error: null,
    couriers: [],
    couriersLoading: false,
    couriersError: null,
    availableCouriers: [],
    availableCouriersLoading: false,
    availableCouriersError: null,
    lastFetchedChatId: null,
    assignedCouriersByDate: {},
    
    // НОВОЕ: инициализация состояния курьерских чатов
    courierChats: [],
    courierChatsLoading: false,
    courierChatsError: null,
};

const courierSlice = createSlice({
    name: 'courier',
    initialState,
    reducers: {
        resetShiftRegistration: (state) => {
            state.isRegistered = false;
            state.currentShift = null;
        },
        clearCouriers: (state) => {
            state.couriers = [];
        },
        // --- Очистка доступных курьеров ---
        clearAvailableCouriers: (state) => {
            state.availableCouriers = [];
            state.availableCouriersLoading = false;
            state.availableCouriersError = null;
            state.lastFetchedChatId = null;
            state.assignedCouriersByDate = {};
        },
        // НОВОЕ: очистка курьерских чатов
        clearCourierChats: (state) => {
            state.courierChats = [];
            state.courierChatsLoading = false;
            state.courierChatsError = null;
        },
    },
    extraReducers: (builder) => {
        // НОВОЕ: обработка fetchCourierChats
        builder
            .addCase(fetchCourierChats.pending, (state) => {
                state.courierChatsLoading = true;
                state.courierChatsError = null;
            })
            .addCase(fetchCourierChats.fulfilled, (state, action) => {
                console.log('✅ [Redux] fetchCourierChats.fulfilled payload:', action.payload);
                state.courierChatsLoading = false;
                state.courierChats = action.payload;
                state.courierChatsError = null;
            })
            .addCase(fetchCourierChats.rejected, (state, action) => {
                console.error('❌ [Redux] fetchCourierChats.rejected:', action.payload);
                state.courierChatsLoading = false;
                state.courierChatsError = action.payload ?? 'Не удалось загрузить курьерские чаты';
                state.courierChats = [];
            })
            
        // --- Доступные курьеры ---
        builder
            .addCase(fetchAvailableCouriers.pending, (state, action) => {
                state.availableCouriersLoading = true;
                state.availableCouriersError = null;
                state.lastFetchedChatId = action.meta.arg.groupTelegramId;
            })
            .addCase(fetchAvailableCouriers.fulfilled, (state, action) => {
                console.log('[Redux] fetchAvailableCouriers.fulfilled payload:', action.payload);
                state.availableCouriersLoading = false;
                state.availableCouriers = action.payload;
                state.availableCouriersError = null;
            })
            .addCase(fetchAvailableCouriers.rejected, (state, action) => {
                state.availableCouriersLoading = false;
                state.availableCouriersError = action.payload ?? 'Неизвестная ошибка';
                state.availableCouriers = [];
            })
            .addCase(fetchCouriers.pending, (state) => {
                state.couriersLoading = true;
                state.couriersError = null;
            })
            .addCase(fetchCouriers.fulfilled, (state, action) => {
                console.log('[Redux] fetchCouriers.fulfilled payload:', action.payload);
                state.couriers = action.payload;
                state.couriersLoading = false;
                state.couriersError = null;
            })
            .addCase(fetchCouriers.rejected, (state, action) => {
                state.couriersLoading = false;
                state.couriersError = action.payload ?? 'Не удалось загрузить курьеров';
                state.couriers = [];
            })
            .addCase(assignCourierToShiftThunk.fulfilled, (state, action) => {
                const assignedShift = action.payload;
                const userId = assignedShift.userId;
                const date = assignedShift.date;
                if (!userId || !date) {
                    return;
                }
                const dateKey = format(new Date(date), 'yyyy-MM-dd');
                if (!state.assignedCouriersByDate[dateKey]) {
                    state.assignedCouriersByDate[dateKey] = {};
                }
                state.assignedCouriersByDate[dateKey][userId] = true;
            });
    },
});

export const { resetShiftRegistration, clearCouriers, clearAvailableCouriers, clearCourierChats } = courierSlice.actions;
export default courierSlice.reducer; 