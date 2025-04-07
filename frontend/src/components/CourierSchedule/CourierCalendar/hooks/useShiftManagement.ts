import { useCallback } from 'react';
// import { socketService } from '../../../../services/socket'; // <<< УБИРАЕМ SOCKET
import { createOrUpdateShift } from '../../../../services/courierApi'; // <<< ДОБАВЛЯЕМ API ФУНКЦИЮ
import { logger } from '../../../../utils/logger';
import { format } from 'date-fns';
// import { useSelector } from 'react-redux'; // <-- Удаляем этот импорт

export const useShiftManagement = (currentUserId: string | number, chatId: string | number) => {
    // Получаем данные пользователя из Redux
    // const userInfo = useSelector((state: any) => state.user.user); // <-- Удаляем эту строку

    const handleShiftSelect = useCallback(async (
        date: Date,
        shiftType: 'day' | 'night',
        slotIndex: number,
        existingShiftId?: string,
        isDragAction?: boolean
    ) => {
        // Преобразуем ID в числа, если они строки
        const userTelegramId = typeof currentUserId === 'string' ? parseInt(currentUserId, 10) : currentUserId;
        const groupTelegramId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;

        // Проверка на NaN после парсинга
        if (isNaN(userTelegramId) || isNaN(groupTelegramId)) {
            logger.error('❌ Неверные ID пользователя или чата:', { currentUserId, chatId });
            return false; 
        }

        try {
            // Используем format из date-fns для получения локальной даты в формате YYYY-MM-DD
            const localDate = format(date, 'yyyy-MM-dd');
            
            logger.info('📡 Отправка запроса на создание смены:', {
                date: localDate,
                shiftType,
                slotIndex,
                userTelegramId,
                groupTelegramId,
            });

            const shiftDataForApi = {
                date: localDate,
                shift_type: shiftType,
                slot_index: slotIndex,
                user_telegram_id: userTelegramId,
                group_telegram_id: groupTelegramId,
            };

            // Вызываем API функцию вместо сокета
            const createdShift = await createOrUpdateShift(shiftDataForApi);

            if (createdShift) {
                logger.info('✅ Смена успешно создана через API:', createdShift);
                // TODO: Возможно, нужно обновить состояние Redux с новой сменой?
                // dispatch(addShift(createdShift));
                return true;
            } else {
                // Этого не должно быть, если API отработал без ошибок,
                // но на всякий случай
                logger.error('❌ API вернуло пустой результат при создании смены');
                return false;
            }

        } catch (error: any) {
            logger.error('❌ Ошибка при создании/обновлении смены через API:', error.message || error);
            return false;
        }
    }, [currentUserId, chatId]);

    return { handleShiftSelect };
}; 