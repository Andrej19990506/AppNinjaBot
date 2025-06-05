// --- reservesSelectors.ts ---
// Селекторы для состояния резервов.

import { RootState } from '@shared/types/store';
import { ReserveEntry } from '@features/courierSchedule/types/courierScheduleTypes';

export const selectAllReserves = (state: RootState): ReserveEntry[] => state.reserves.reserves;
export const selectReservesLoading = (state: RootState): boolean => state.reserves.loading;
export const selectReservesError = (state: RootState): string | null => state.reserves.error; 