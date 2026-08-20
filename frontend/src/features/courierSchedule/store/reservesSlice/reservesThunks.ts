// --- reservesThunks.ts ---
// Thunks для работы с резервами: загрузка, добавление, удаление.

import { createAsyncThunk } from '@reduxjs/toolkit';
import { getReserves, addReserve, deleteReserve} from '@features/courierSchedule/services/courierApi/reservesApi';
import { deleteShiftAsSenior, moveShiftToReserve } from '@features/courierSchedule/services/courierApi/shiftsApi';
import { format } from 'date-fns';
import { selectAllShifts } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { RootState } from '@shared/store/store';
import { ApiReserve, ReserveEntry } from '@features/courierSchedule/types/courierScheduleTypes';
import { fetchShifts } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { logger } from '@shared/utils/logger';

function mapApiReserveToReserveEntry(apiReserve: ApiReserve): ReserveEntry {
    return {
        id: apiReserve.id,
        userId: apiReserve.member?.user_id ? String(apiReserve.member.user_id) : '',
        date: apiReserve.date,
        photoUrl: apiReserve.member?.photo_url || null,
        firstName: apiReserve.member?.first_name || '',
        lastName: apiReserve.member?.last_name || '',
        isSeniorCourier: apiReserve.member?.is_senior_courier ?? false,
        createdAt: apiReserve.created_at,
        chatId: apiReserve.chat_id,
    };
}

// --- Thunk: загрузка всех резервов для группы ---
export const fetchReservesForGroup = createAsyncThunk<
    ReserveEntry[],
    { groupId: number },
    { rejectValue: string }
>(
    'reserves/fetchByGroup',
    async ({ groupId }, { rejectWithValue }) => {
        console.log('[DEBUG] fetchReservesForGroup THUNK START', groupId);
        try {
            const apiReserves: ApiReserve[] = await getReserves(groupId);
            console.log('[DEBUG] fetchReservesForGroup THUNK SUCCESS', apiReserves);
            return apiReserves.map(mapApiReserveToReserveEntry);
        } catch (error: any) {
            console.log('[DEBUG] fetchReservesForGroup THUNK ERROR', error);
            const errorMsg = error.message || 'Неизвестная ошибка при загрузке резервов';
            return rejectWithValue(errorMsg);
        }
    }
);

// --- Thunk: добавление текущего пользователя в резерв ---
export const addCurrentUserToReserveThunk = createAsyncThunk<
    ReserveEntry,
    { userTelegramId: number; groupTelegramId: number; date: Date },
    { rejectValue: string }
>(
    'reserves/addToReserve',
    async ({ userTelegramId, groupTelegramId, date }, { rejectWithValue, dispatch, getState }) => {
        const formattedDate = format(date, 'yyyy-MM-dd');
        try {
            const apiResponse = await addReserve({
                user_telegram_id: userTelegramId,
                group_telegram_id: groupTelegramId,
                reserve_date: formattedDate
            });
            try {
                const state = getState() as RootState;
                const allShifts = selectAllShifts(state);
                const userShiftsOnDate = allShifts.filter(shift =>
                    String(shift.userId) === String(userTelegramId) &&
                    String(shift.date) === String(formattedDate)
                );
                logger.info('[addCurrentUserToReserveThunk] Найдено смен для удаления:', userShiftsOnDate.length, userShiftsOnDate);
                if (userShiftsOnDate.length > 0) {
                    for (const shiftToCancel of userShiftsOnDate) {
                        try {
                            logger.info('[addCurrentUserToReserveThunk] Удаляем смену:', shiftToCancel.id, 'для пользователя', userTelegramId);
                            await deleteShiftAsSenior(shiftToCancel.id, String(userTelegramId));
                        } catch (cancelError: any) {
                            logger.error('[addCurrentUserToReserveThunk] Ошибка при удалении смены:', shiftToCancel.id, cancelError);
                        }
                    }
                    // После удаления смен диспатчим обновление стора смен
                    await dispatch(fetchShifts({ chatId: groupTelegramId }));
                }
            } catch (errorGettingShifts: any) {
                logger.error('[addCurrentUserToReserveThunk] Ошибка получения смен:', errorGettingShifts);
            }

            await dispatch(fetchReservesForGroup({ groupId: groupTelegramId }));
            return mapApiReserveToReserveEntry(apiResponse);
        } catch (error: any) {
            const errorMsg = error.message || 'Не удалось добавить в резерв';
            return rejectWithValue(errorMsg);
        }
    }
);

// --- Thunk: удаление резерва по ID ---
export const removeReserveByIdThunk = createAsyncThunk<
    { id: string },
    { reserveId: string; requesterTelegramId: number | string; groupTelegramId: number },
    { rejectValue: string; dispatch: any }
>(
    'reserves/removeById',
    async ({ reserveId, requesterTelegramId, groupTelegramId }, { rejectWithValue, dispatch }) => {
        try {
            await deleteReserve(reserveId, requesterTelegramId);
            // После удаления обновляем стор резервов
            await dispatch(fetchReservesForGroup({ groupId: groupTelegramId }));
            return { id: reserveId };
        } catch (error: any) {
            const errorMsg = error.response?.data?.detail || error.message || 'Не удалось удалить резерв';
            return rejectWithValue(errorMsg);
        }
    }
);

// --- Thunk: перемещение курьера из смены в резерв ---
export const moveCourierToReserveThunk = createAsyncThunk<
    ReserveEntry,
    { shiftId: string; requesterId: number | string; groupTelegramId: number; date: Date },
    { rejectValue: string }
>(
    'reserves/moveCourierToReserve',
    async ({ shiftId, requesterId, groupTelegramId, date }, { rejectWithValue, dispatch }) => {
        try {
            // 1. Перемещаем смену в резерв через API (старший курьер)
            const apiReserve = await moveShiftToReserve(shiftId, requesterId);
            // 2. Обновляем резервы и смены
            await dispatch(fetchReservesForGroup({ groupId: groupTelegramId }));
            await dispatch(fetchShifts({ chatId: groupTelegramId }));
            // 3. Маппим и возвращаем
            return mapApiReserveToReserveEntry(apiReserve);
        } catch (error: any) {
            const errorMsg = error.message || 'Не удалось переместить курьера в резерв';
            return rejectWithValue(errorMsg);
        }
    }
);

export { mapApiReserveToReserveEntry };