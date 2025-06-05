// --- reservesSlice.ts ---
// Только slice и редьюсеры для резервов. Thunks и селекторы вынесены в отдельные файлы.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ReserveEntry, ReservesState } from '@features/courierSchedule/types/courierScheduleTypes';
import { fetchReservesForGroup } from './reservesThunks';



const initialState: ReservesState = {
    reserves: [],
    loading: false,
    error: null,
};

const reservesSlice = createSlice({
    name: 'reserves',
    initialState,
    reducers: {
        clearReservesState: (state) => {
            state.reserves = [];
            state.loading = false;
            state.error = null;
        },
        reserveAdded: (state, action: PayloadAction<ReserveEntry>) => {
            const existingIndex = state.reserves.findIndex(r => r.id === action.payload.id);
            if (existingIndex === -1) {
                state.reserves.push(action.payload);
            }
            state.error = null;
        },
        reserveRemovedWs: (state, action: PayloadAction<{ id: string }>) => {
            state.reserves = state.reserves.filter(reserve => reserve.id !== action.payload.id);
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchReservesForGroup.fulfilled, (state, action) => {
                console.log('[DEBUG] reducer: fetchReservesForGroup.fulfilled payload =', action.payload);
                state.reserves = action.payload;
                state.loading = false;
                state.error = null;
            });
    }
});

export const { clearReservesState, reserveAdded, reserveRemovedWs } = reservesSlice.actions;
export default reservesSlice.reducer; 