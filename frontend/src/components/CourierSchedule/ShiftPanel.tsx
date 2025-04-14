import React, { useMemo } from 'react';
import styled from 'styled-components'; // Возвращаем styled
import { useSelector } from 'react-redux'; // Возвращаем useSelector
import { RootState } from '../../store/store'; // Импортируем RootState
import { ShiftSlot } from '../../types/shifts'; // Импортируем ShiftSlot
// Удаляем локальное определение ShiftSlotLocal
// interface ShiftSlotLocal {
//     id?: string;
//     userId?: string;
//     photoUrl?: string | null;
//     firstName?: string;
//     lastName?: string;
//     slotIndex: number;
// }

import ShiftPanelContainer from './ShiftPanelContainer';
import { logger } from '../../utils/logger';

// --- Восстанавливаем Styled Components (или импортируем из styles.ts) ---
const ShiftSection = styled.div`
    margin-bottom: 24px;
    &:last-child {
        margin-bottom: 0;
    }
`;

const ShiftTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: var(--text-color);
    font-size: 1.2rem;
    font-weight: 500;
`;

const ShiftIcon = styled.span`
    font-size: 1.4rem;
`;

const SeniorHint = styled.div`
    margin-top: 16px;
    padding: 12px 16px;
    background-color: rgba(255, 213, 0, 0.1);
    border-left: 3px solid #FFD700;
    border-radius: 4px;
    color: #705E00;
    font-size: 0.9rem;
    line-height: 1.5;
`;

const NoSlotsMessage = styled.div`
    margin-top: 16px;
    padding: 16px;
    background-color: rgba(255, 152, 0, 0.1);
    border-left: 3px solid #FF9800;
    border-radius: 4px;
    color: #A66200;
    font-size: 0.95rem;
    text-align: center;
    line-height: 1.5;
`;

const ReserveLinkButton = styled.button`
    background: none;
    border: none;
    padding: 0;
    color: var(--primary-color);
    font-weight: bold;
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    font-family: inherit;
    &:hover {
        text-decoration: none;
    }
`;
// --- -------------------------------------------------------------- ---

interface ShiftPanelProps {
    date: Date;
    dayShifts: ShiftSlot[];
    nightShifts: ShiftSlot[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction?: boolean) => void;
    onSwitchToReserve: () => void;
    showSuccessMessage: (message: string) => void;
    isLoading: boolean; // Общий флаг загрузки (переименован из isBookingLoading в ShiftSelectionDialog)
    loadingSlot: number | null;
    loadingType: 'day' | 'night' | null;
    chatId?: string;
    isBookingLoading?: boolean; // <-- Добавляем опциональный пропс
}

/**
 * ShiftPanel компонент
 * Отвечает за отображение и управление дневными и ночными сменами курьеров
 * 
 * Этот компонент был рефакторинг для улучшения читаемости и поддерживаемости
 * и теперь использует ShiftPanelContainer для основной логики
 */
const ShiftPanel: React.FC<ShiftPanelProps> = React.memo(({ 
    date, // Проп date пока не используется, но оставляем
    dayShifts, 
    nightShifts, 
    maxDaySlots, 
    maxNightSlots, 
    currentUserId, 
    currentUserName, 
    onSlotSelect, 
    onSwitchToReserve, 
    showSuccessMessage, // Этот проп тоже пока не используется напрямую здесь
    isLoading,
    loadingSlot,
    loadingType,
    chatId
}) => {
    // Получаем user целиком, чтобы достать группы
    const user = useSelector((state: RootState) => state.user.user);
    
    // Определяем статус старшего для текущей группы
    const isSenior = useMemo(() => {
        if (!user || !user.groups || !chatId) return false;
        const currentGroup = user.groups.find(g => String(g.chat_id) === chatId);
        return currentGroup?.is_senior_courier ?? false;
    }, [user, chatId]);
    
    // Логгируем приходящие смены
    logger.debug('[ShiftPanel] Rendering with shifts:', { dayShifts, nightShifts, currentUserId, isSenior });

    // Определяем, есть ли у пользователя дневная/ночная смена
    const userHasDayShift = dayShifts.some(shift => shift.userId === currentUserId);
    const userHasNightShift = nightShifts.some(shift => shift.userId === currentUserId);
    logger.debug('[ShiftPanel] Calculated user shift presence:', { userHasDayShift, userHasNightShift }); // Доп. лог

    // Вычисляем состояния для подсказок (используем userHasDayShift || userHasNightShift)
    const userHasShift = userHasDayShift || userHasNightShift; // Обновляем эту логику
    const totalSlots = maxDaySlots + maxNightSlots;
    const totalOccupiedSlots = dayShifts.length + nightShifts.length;
    const isFullyBooked = totalOccupiedSlots >= totalSlots;
    
    return (
        <>
            <ShiftSection key="day-shift-section">
                <ShiftTitle>
                    <ShiftIcon>☀️</ShiftIcon> Дневная смена
                </ShiftTitle>
                <ShiftPanelContainer
                    shiftType="day"
                    shifts={dayShifts}
                    maxSlots={maxDaySlots}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    onSlotSelect={onSlotSelect}
                    isLoading={isLoading && loadingType === 'day'}
                    loadingSlot={loadingType === 'day' ? loadingSlot : null}
                    userHasShift={userHasDayShift} // <-- Передаем флаг для дневной смены
                    chatId={chatId}
                />
            </ShiftSection>

            <ShiftSection key="night-shift-section">
                <ShiftTitle>
                    <ShiftIcon>🌙</ShiftIcon> Вечерняя смена
                </ShiftTitle>
                <ShiftPanelContainer
                    shiftType="night"
                    shifts={nightShifts}
                    maxSlots={maxNightSlots}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    onSlotSelect={onSlotSelect}
                    isLoading={isLoading && loadingType === 'night'}
                    loadingSlot={loadingType === 'night' ? loadingSlot : null}
                    userHasShift={userHasNightShift} // <-- Передаем флаг для ночной смены
                    chatId={chatId}
                />
            </ShiftSection>

            {/* Условный рендеринг подсказок */} 
            {isSenior && (
                <SeniorHint>
                    ⭐ Как старший курьер, вы можете записывать или снимать со слотов других курьеров, нажимая на соответствующие слоты.
                </SeniorHint>
            )}

            {isFullyBooked && !userHasShift && (
                <NoSlotsMessage key="no-slots-message">
                    Все смены уже заняты.<br/>
                    Вы можете <ReserveLinkButton onClick={onSwitchToReserve}>записаться в резерв</ReserveLinkButton>.
                </NoSlotsMessage>
            )}
        </>
    );
});

export default ShiftPanel; 