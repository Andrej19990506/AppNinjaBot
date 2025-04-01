import { useCallback } from 'react';
import { socketService } from '../../../../services/socket';
import { logger } from '../../../../utils/logger';
import { useSelector } from 'react-redux';

export const useShiftManagement = (currentUserId: string, chatId: string) => {
    // Получаем данные пользователя из Redux
    const userInfo = useSelector((state: any) => state.user.user);

    const handleShiftSelect = useCallback(async (
        date: Date,
        shiftType: 'day' | 'night',
        slotIndex: number,
        existingShiftId?: string,
        isDragAction?: boolean
    ) => {
        try {
            logger.info('📡 Отправка обновления смены:', {
                date,
                shiftType,
                slotIndex,
                existingShiftId,
                isDragAction
            });

            const shiftData = {
                date: date.toISOString(),
                shift_type: shiftType,
                slot_index: slotIndex,
                existing_shift_id: existingShiftId,
                is_drag_action: isDragAction,
                user_id: currentUserId,
                userId: currentUserId, // Для совместимости
                chat_id: chatId,
                // Добавляем все данные пользователя
                firstName: userInfo?.first_name || '',
                lastName: userInfo?.last_name || '',
                photo_url: userInfo?.photo_url || null,
                isSeniorCourier: userInfo?.is_senior_courier || false,
                // Добавляем snake_case версии для совместимости
                first_name: userInfo?.first_name || '',
                last_name: userInfo?.last_name || '',
                is_senior_courier: userInfo?.is_senior_courier || false
            };

            // Отправляем обновление через общую комнату чата
            socketService.emit('shift_update', shiftData);

            return true;
        } catch (error) {
            logger.error('❌ Ошибка при обновлении смены:', error);
            return false;
        }
    }, [currentUserId, chatId, userInfo]);

    return { handleShiftSelect };
}; 