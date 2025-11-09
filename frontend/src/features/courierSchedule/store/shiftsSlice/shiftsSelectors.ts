// --- shiftsSelectors.ts ---
// Селекторы для состояния смен.

import { RootState } from '@shared/store/store';
import { CourierShift, AccessSettings, WeeklySlotConfig, SlotConfigForDay, CourierInfo } from '@features/courierSchedule/types/courierScheduleTypes';
import { createSelector } from 'reselect';
import { defaultWeeklySlotConfig } from './shiftsSlice';

export const selectAllShifts = (state: RootState): CourierShift[] => state.shifts.shifts;
export const selectShiftsByDate = (state: RootState, date: string): CourierShift[] =>
    state.shifts.shifts.filter((shift: CourierShift) => shift.date === date);
export const selectIsLoading = (state: RootState) => state.shifts.loading;
export const selectError = (state: RootState) => state.shifts.error;
export const selectAccessSettings = (state: RootState): AccessSettings | null => state.shifts.accessSettings;
export const selectSlotConfig = (state: RootState): WeeklySlotConfig | null => state.shifts.slotConfig;
export const selectIsLoadingSettings = (state: RootState) => state.shifts.isLoadingSettings;
export const selectSettingsError = (state: RootState) => state.shifts.settingsError;
export const selectSlotConfigForDay = (dayIndex: number) => (state: RootState): SlotConfigForDay => {
    if (dayIndex < 0 || dayIndex > 6) return defaultWeeklySlotConfig[0];
    const dayConfig = state.shifts.slotConfig ? state.shifts.slotConfig[dayIndex] : undefined;
    const result = dayConfig ?? defaultWeeklySlotConfig[dayIndex];
    
    console.log('[selectSlotConfigForDay] Debug:', {
        dayIndex,
        slotConfig: state.shifts.slotConfig,
        dayConfig,
        result,
        shiftTemplates: result.shiftTemplates,
        shiftTemplatesLength: result.shiftTemplates?.length || 0
    });
    
    return result;
};

// Селектор: проверяет, назначен ли курьер на дату
export const selectIsCourierAssignedOnDate = (userId: string | null, date: string | null) => 
    createSelector(
        (state: RootState) => state.shifts.shifts,
        (shifts) => {
            if (!userId || !date) return false;
            return shifts.some((shift: CourierShift) => String(shift.userId) === String(userId) && shift.date === date);
        }
    );

// Селектор: карта назначенных курьеров на дату
export const selectAssignedCouriersMapOnDate = (date: string | null) =>
    createSelector(
        (state: RootState) => state.shifts.shifts,
        (shifts) => {
            const assignedMap: { [userId: string]: true } = {};
            if (!date) return assignedMap;
            shifts.forEach((shift: CourierShift) => {
                if (shift.date === date && shift.userId) {
                    assignedMap[String(shift.userId)] = true;
                }
            });
            return assignedMap;
        }
    );


export const selectIsShiftDialogOpen = (state: RootState): boolean => state.shifts.isShiftDialogOpen;

export const selectShiftDialogMode = (state: RootState): 'shifts' | 'reserves' => state.shifts.shiftDialogMode;

// Селектор: доступные курьеры на дату (не назначены ни на одну смену в этот день)
export const selectAvailableCouriersByDate = (date: string) =>
    createSelector(
        (state: RootState) => state.courier.couriers, // все курьеры группы
        (state: RootState) => state.shifts.shifts,     // все смены
        (couriers: CourierInfo[], shifts: CourierShift[]) => {
            const assignedIds = new Set(
                shifts.filter(shift => shift.date === date && shift.userId).map(shift => String(shift.userId))
            );
            return couriers.filter(courier => !assignedIds.has(String(courier.user_id)));
        }
    );

export const selectLocalAppliedTemplates = (state: RootState) => state.shifts.localAppliedTemplates;
export const selectLocalAppliedTemplatesForDay = (dayIndex: number) => createSelector(
    (state: RootState) => state.shifts.localAppliedTemplates,
    (localAppliedTemplates) => localAppliedTemplates[dayIndex] || []
); 