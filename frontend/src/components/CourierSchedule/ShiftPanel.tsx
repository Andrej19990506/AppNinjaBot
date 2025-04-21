import React, { useMemo } from 'react';
import styled from 'styled-components'; // Возвращаем styled
import ShiftPanelContainer from './ShiftPanelContainer';
import { logger } from '../../utils/logger';
import { LayoutGroup } from 'framer-motion'; 
import ShiftSlotComponent from './components/ShiftSlot';
import { CourierShift } from '../../types/shifts'; // ОСТАВЛЯЕМ
import { format } from 'date-fns';
import CouriersPanel, { CouriersPanelProps } from './components/CouriersPanel';
// import { ShiftType } from '../../types'; // <<< УДАЛЯЕМ ЭТОТ ИМПОРТ

// Определяем ShiftType локально
type ShiftType = CourierShift['shiftType']; // <<< ДОБАВЛЯЕМ ЛОКАЛЬНОЕ ОПРЕДЕЛЕНИЕ

// --- Восстанавливаем Styled Components (или импортируем из styles.ts) ---
const ShiftSection = styled.div`
    margin-bottom: 37px;
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
    date: Date | null;
    dayShifts: CourierShift[];
    nightShifts: CourierShift[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number) => void;
    onSwitchToReserve: () => void;
    showSuccessMessage: (message: string) => void;
    showErrorMessage?: (message: string) => void;
    isLoading: boolean;
    loadingSlot: number | null;
    loadingType: 'day' | 'night' | null;
    chatId?: string;
    isSenior?: boolean;
    draggingShiftType?: 'day' | 'night' | null;
    isDraggingGlobal?: boolean;
    processingShiftId?: string | null;
    isProcessingMove?: boolean;
    onOpenProfile?: (courier: CourierShift) => void;
    onLongPressEmptySlot: (shiftType: 'day' | 'night', slotIndex: number) => void;
    isCouriersPanelOpen: boolean;
    panelTargetShiftType: ShiftType | null;
    panelTargetSlotIndex: number | null;
    onCloseCouriersPanel: () => void;
    activeDragId?: string | null;
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
    showErrorMessage, // <<< Получаем новый проп
    isLoading = false,
    loadingSlot = null,
    loadingType = null,
    chatId,
    isSenior,
    draggingShiftType,
    isDraggingGlobal,
    processingShiftId,
    isProcessingMove,
    onOpenProfile,
    onLongPressEmptySlot,
    isCouriersPanelOpen,
    panelTargetShiftType,
    panelTargetSlotIndex,
    onCloseCouriersPanel,
    activeDragId
}) => {
    // Логгируем приходящий isSenior
    logger.debug('[ShiftPanel] Rendering with isSenior:', isSenior);

    // Определяем, есть ли у пользователя дневная/ночная смена
    const userHasDayShift = useMemo(() => dayShifts.some(shift => shift.userId === currentUserId), [dayShifts, currentUserId]);
    const userHasNightShift = useMemo(() => nightShifts.some(shift => shift.userId === currentUserId), [nightShifts, currentUserId]);
    logger.debug('[ShiftPanel] Calculated user shift presence:', { userHasDayShift, userHasNightShift }); // Доп. лог

    // Вычисляем состояния для подсказок (используем userHasDayShift || userHasNightShift)
    const userHasShift = userHasDayShift || userHasNightShift; 
    const totalSlots = maxDaySlots + maxNightSlots;
    const totalOccupiedSlots = dayShifts.length + nightShifts.length;
    const isFullyBooked = totalOccupiedSlots >= totalSlots;
    
    return (
        <>
            <ShiftSection key="day-shift-section">
                <ShiftTitle>
                    <ShiftIcon>☀️</ShiftIcon> Дневная смена
                </ShiftTitle>
                <LayoutGroup>
                    <ShiftPanelContainer
                        shiftType="day"
                        shifts={dayShifts}
                        maxSlots={maxDaySlots}
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                        onSlotSelect={onSlotSelect}
                        isLoading={isLoading && loadingType === 'day'}
                        loadingSlot={loadingType === 'day' ? loadingSlot : null}
                        userHasShift={userHasDayShift}
                        chatId={chatId}
                        isSenior={isSenior}
                        showSuccessMessage={showSuccessMessage}
                        showErrorMessage={showErrorMessage}
                        draggingShiftType={draggingShiftType}
                        isDraggingGlobal={isDraggingGlobal}
                        onOpenProfile={onOpenProfile ? (shiftSlot) => onOpenProfile({
                            ...shiftSlot,
                            date: format(date || new Date(), 'yyyy-MM-dd'),
                            shiftType: 'day'
                        } as CourierShift) : undefined}
                        onLongPressEmptySlot={onLongPressEmptySlot}
                    />
                </LayoutGroup>
            </ShiftSection>

            <ShiftSection key="night-shift-section">
                <ShiftTitle>
                    <ShiftIcon>🌙</ShiftIcon> Вечерняя смена
                </ShiftTitle>
                <LayoutGroup>
                    <ShiftPanelContainer
                        shiftType="night"
                        shifts={nightShifts}
                        maxSlots={maxNightSlots}
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                        onSlotSelect={onSlotSelect}
                        isLoading={isLoading && loadingType === 'night'}
                        loadingSlot={loadingType === 'night' ? loadingSlot : null}
                        userHasShift={userHasNightShift}
                        chatId={chatId}
                        isSenior={isSenior}
                        showSuccessMessage={showSuccessMessage}
                        showErrorMessage={showErrorMessage}
                        draggingShiftType={draggingShiftType}
                        isDraggingGlobal={isDraggingGlobal}
                        onOpenProfile={onOpenProfile ? (shiftSlot) => onOpenProfile({
                            ...shiftSlot,
                            date: format(date || new Date(), 'yyyy-MM-dd'),
                            shiftType: 'night'
                        } as CourierShift) : undefined}
                        onLongPressEmptySlot={onLongPressEmptySlot}
                    />
                </LayoutGroup>
            </ShiftSection>

            {/* Подсказка для старшего рендерится на основе isSenior */}
            {isSenior && (
                <SeniorHint>
                    ⭐ Как старший курьер, вы можете перетаскивать аватары других курьеров в зону удаления (корзину).
                </SeniorHint>
            )}

            {isFullyBooked && !userHasShift && (
                <NoSlotsMessage key="no-slots-message">
                    Все смены уже заняты.<br/>
                    Вы можете <ReserveLinkButton onClick={onSwitchToReserve}>записаться в резерв</ReserveLinkButton>.
                </NoSlotsMessage>
            )}

            {/* <<< УСЛОВНЫЙ РЕНДЕРИНГ ПАНЕЛИ КУРЬЕРОВ >>> */}
            {isCouriersPanelOpen && panelTargetShiftType && panelTargetSlotIndex !== null && (
                 <CouriersPanel
                     shiftType={panelTargetShiftType}
                     slotIndex={panelTargetSlotIndex}
                     onClose={onCloseCouriersPanel}
                     chatId={chatId}
                     date={date}
                 />
            )}
        </>
    );
});

export default ShiftPanel; 