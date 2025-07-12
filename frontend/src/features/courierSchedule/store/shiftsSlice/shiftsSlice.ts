// --- shiftsSlice.ts ---
// Только slice и редьюсеры для смен. Thunks и селекторы вынесены в отдельные файлы.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CourierShift, AccessSettings, WeeklySlotConfig, SlotConfigForDay, ShiftsUpdatedWsPayload, ShiftState } from '@features/courierSchedule/types/courierScheduleTypes';
import { bookShift, cancelShift, fetchAccessSettings, updateAccessSettings, fetchSlotConfig, assignCourierToShiftThunk, fetchShifts } from './shiftsThunks';




// --- Дефолтные значения для слотов ---
export const defaultSingleDaySlotConfig: SlotConfigForDay = {
    maxDaySlots: 4,
    maxNightSlots: 2,
    hasSeniorSlot: false,
    dayShiftStartTime: "10:00",
    dayShiftEndTime: "18:00",
    nightShiftStartTime: "18:00",
    nightShiftEndTime: "02:00",
};

export const defaultWeeklySlotConfig: WeeklySlotConfig = [
    { ...defaultSingleDaySlotConfig }, // Воскресенье
    { ...defaultSingleDaySlotConfig }, // Понедельник
    { ...defaultSingleDaySlotConfig }, // Вторник
    { ...defaultSingleDaySlotConfig }, // Среда
    { ...defaultSingleDaySlotConfig }, // Четверг
    { ...defaultSingleDaySlotConfig }, // Пятница
    { ...defaultSingleDaySlotConfig }, // Суббота
];

const initialState: ShiftState = {
    shifts: [],
    loading: false,
    error: null,
    accessSettings: null,
    slotConfig: defaultWeeklySlotConfig,
    isLoadingSettings: false,
    settingsError: null,
    isShiftDialogOpen: false,
    shiftDialogMode: 'shifts',
};

const shiftsSlice = createSlice({
    name: 'shifts',
    initialState,
    reducers: {
        // --- WebSocket: бронирование смены --- 
        shiftBookedWs: (state, action: PayloadAction<ShiftsUpdatedWsPayload>) => {
            const shift = action.payload.shift_data;
            const index = state.shifts.findIndex(s => s.id === shift.id);
            if (index !== -1) {
                state.shifts[index] = shift;
            } else {
                state.shifts.push(shift);
            }
        },
        // --- WebSocket: отмена смены --- 
        shiftCancelledWs: (state, action: PayloadAction<{ shift_id: string }>) => {
            state.shifts = state.shifts.filter(shift => shift.id !== action.payload.shift_id);
        },
        updateAccessRulesState: (state, action: PayloadAction<Partial<AccessSettings>>) => {},
        updateSlotConfigLocal: (state, action: PayloadAction<{ dayIndex: number; maxDaySlots: number; maxNightSlots: number; hasSeniorSlot?: boolean; dayShiftStartTime?: string; dayShiftEndTime?: string; nightShiftStartTime?: string; nightShiftEndTime?: string }>) => {
            const { dayIndex, maxDaySlots, maxNightSlots, hasSeniorSlot = false, dayShiftStartTime, dayShiftEndTime, nightShiftStartTime, nightShiftEndTime } = action.payload;
            if (state.slotConfig && dayIndex >= 0 && dayIndex <= 6) {
                state.slotConfig[dayIndex] = { 
                    maxDaySlots, 
                    maxNightSlots, 
                    hasSeniorSlot,
                    dayShiftStartTime: dayShiftStartTime || state.slotConfig[dayIndex].dayShiftStartTime || "10:00",
                    dayShiftEndTime: dayShiftEndTime || state.slotConfig[dayIndex].dayShiftEndTime || "18:00",
                    nightShiftStartTime: nightShiftStartTime || state.slotConfig[dayIndex].nightShiftStartTime || "18:00",
                    nightShiftEndTime: nightShiftEndTime || state.slotConfig[dayIndex].nightShiftEndTime || "02:00",
                };
            }
        },
        clearShifts: (state) => {},
        shiftAddedOrUpdated: (state, action: PayloadAction<CourierShift>) => {},
        shiftRemoved: (state, action: PayloadAction<string>) => {},
        removeShiftLocally: (state, action: PayloadAction<string>) => {},
        setShiftDialogOpen: (state, action: PayloadAction<boolean>) => {
            state.isShiftDialogOpen = action.payload;
        },
        setShiftDialogMode: (state, action: PayloadAction<'shifts' | 'reserves'>) => {
            state.shiftDialogMode = action.payload;
        },
        toggleShiftDialogMode: (state) => {
            state.shiftDialogMode = state.shiftDialogMode === 'shifts' ? 'reserves' : 'shifts';
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchShifts.fulfilled, (state, action) => {
                state.shifts = action.payload;
            })
            .addCase(bookShift.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(bookShift.fulfilled, (state, action) => {
                state.loading = false;
                const shift = action.payload;
                const index = state.shifts.findIndex(s => s.id === shift.id);
                if (index !== -1) {
                    state.shifts[index] = shift;
                } else {
                    state.shifts.push(shift);
                }
            })
            .addCase(bookShift.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Не удалось забронировать смену';
            })
            .addCase(cancelShift.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(cancelShift.fulfilled, (state, action) => {
                state.loading = false;
                state.shifts = state.shifts.filter(shift => shift.id !== action.payload);
            })
            .addCase(cancelShift.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Не удалось отменить смену';
            })
            .addCase(fetchAccessSettings.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(fetchAccessSettings.fulfilled, (state, action) => {
                state.isLoadingSettings = false;
                state.accessSettings = action.payload;
            })
            .addCase(fetchAccessSettings.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload || 'Не удалось загрузить настройки доступа';
            })
            .addCase(updateAccessSettings.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(updateAccessSettings.fulfilled, (state, action) => {
                state.isLoadingSettings = false;
                state.accessSettings = action.payload;
            })
            .addCase(updateAccessSettings.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload || 'Не удалось обновить настройки доступа';
            })

            .addCase(fetchSlotConfig.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(fetchSlotConfig.fulfilled, (state, action) => {
                state.isLoadingSettings = false;
                state.slotConfig = action.payload.config || defaultWeeklySlotConfig;
            })
            .addCase(fetchSlotConfig.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload || 'Не удалось загрузить конфиг слотов';
            })
            // --- assignCourierToShiftThunk ---
            .addCase(assignCourierToShiftThunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(assignCourierToShiftThunk.fulfilled, (state, action) => {
                state.loading = false;
                const shift = action.payload;
                const index = state.shifts.findIndex(s => s.id === shift.id);
                if (index !== -1) {
                    state.shifts[index] = shift;
                } else {
                    state.shifts.push(shift);
                }
            })
            .addCase(assignCourierToShiftThunk.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Не удалось назначить курьера';
            });
    }
});

export const {
    shiftBookedWs,
    shiftCancelledWs,
    updateAccessRulesState, 
    updateSlotConfigLocal, 
    clearShifts,
    shiftAddedOrUpdated,
    shiftRemoved,
    removeShiftLocally,
    setShiftDialogOpen,
    setShiftDialogMode,
    toggleShiftDialogMode,
} = shiftsSlice.actions;
export default shiftsSlice.reducer;
 