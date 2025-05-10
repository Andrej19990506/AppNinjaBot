import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../../store/store';
import { bookShift } from '../../../../store/slices/shiftsSlice';
import { formatDateForAPI } from '../utils/dateUtils';

export const useShiftManagement = (currentUserId: string, chatId?: string) => {
    const dispatch = useDispatch<AppDispatch>();

    const handleShiftSelect = useCallback(async (
        date: Date,
        shiftType: 'day' | 'night',
        slotIndex: number,
        existingShiftId?: string,
        isDragAction = false
    ) => {
        try {
            const dateString = formatDateForAPI(date);
            
            if (!chatId) {
                console.log('[Calendar] Warning: No chatId provided for shift booking');
            }
            
            console.log('[Calendar] Booking/updating shift:', {
                date: dateString,
                shiftType,
                slotIndex,
                userId: currentUserId,
                existingShiftId,
                chatId,
                isDragAction
            });
            
            const result = await dispatch(bookShift({
                date: dateString,
                shiftType,
                slotIndex,
                userId: currentUserId,
                existingShiftId,
                chatId,
                isDragAction
            })).unwrap();
            
            console.log('[Calendar] Shift booking completed successfully:', result);
            return result;
        } catch (error) {
            console.error('[Calendar] Error in handleShiftSelect:', error);
            throw error;
        }
    }, [dispatch, currentUserId, chatId]);

    return {
        handleShiftSelect
    };
}; 