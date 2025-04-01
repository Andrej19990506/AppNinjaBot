import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { ReserveShift, CourierShift } from '../../types';
import { format } from 'date-fns';
import { useDispatch } from 'react-redux';
import { forceFetchReserves } from '../../store/slices/reservesSlice';
import { AppDispatch } from '../../store/store';
import ShiftPanel from './ShiftPanel';
import ReservePanel from './ReservePanel';
import { ru } from 'date-fns/locale';
import BottomDrawer from './components/BottomDrawer';

const ModeSwitchContainer = styled.div`
    display: flex;
    margin: 0 -24px 24px -24px;
    padding: 0 24px;
    background: var(--card-background);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: var(--shadow-sm);
`;

const ModeButton = styled.button<{ active: boolean }>`
    flex: 1;
    padding: 16px;
    background: ${props => props.active ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.active ? 'white' : 'var(--text-color)'};
    border: none;
    cursor: pointer;
    transition: all var(--transition-normal);
    font-weight: ${props => props.active ? '600' : '400'};
    position: relative;
    overflow: hidden;

    &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: ${props => props.active ? 'white' : 'var(--primary-color)'};
        transform: scaleX(${props => props.active ? 1 : 0});
        transform-origin: right;
        transition: transform var(--transition-normal);
    }

    &:hover {
        background: ${props => props.active ? 'var(--primary-color)' : 'var(--primary-transparent)'};
        
        &::after {
            transform: scaleX(1);
            transform-origin: left;
        }
    }

    &:disabled {
        opacity: var(--disabled-opacity);
        cursor: not-allowed;
        pointer-events: none;
    }

    ${props => props.active && `
        box-shadow: var(--shadow-md);
    `}
`;

interface ShiftSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    dayShifts: CourierShift[];
    nightShifts: CourierShift[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction?: boolean) => Promise<any>;
    onReserveSelect: () => Promise<any>;
    onCancelReserve: (reserveId: string) => Promise<void>;
    reserves: ReserveShift[];
    chatId?: string;
}

const ShiftSelectionDialog: React.FC<ShiftSelectionDialogProps> = ({
    isOpen,
    onClose,
    date,
    dayShifts,
    nightShifts,
    maxDaySlots,
    maxNightSlots,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onSlotSelect,
    onReserveSelect,
    onCancelReserve,
    reserves,
    chatId
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const [mode, setMode] = useState<'shifts' | 'reserves'>('shifts');
    const [isLoading, setIsLoading] = useState(false);
    const [isBookingLoading, setIsBookingLoading] = useState(false);
    const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
    const [loadingType, setLoadingType] = useState<'day' | 'night' | null>(null);

    useEffect(() => {
        if (isOpen) {
            setMode('shifts');
        }
    }, [isOpen]);

    // Функция для отображения стандартного сообщения с toast
    const showToast = (message: string) => {
        console.log('[ShiftSelectionDialog] showToast:', message);
        // Здесь мог бы быть вызов toast библиотеки
    };

    // Функция для отображения сообщения об успешном действии
    const showSuccessMessage = (message: string) => {
        console.log('[ShiftSelectionDialog] showSuccessMessage:', message);
        // Более заметное сообщение об успехе
    };

    // Обработчик выбора слота
    const handleSlotSelectWrapper = async (
        shiftType: 'day' | 'night',
        slotIndex: number,
        existingShiftId?: string,
        isDragAction = false
    ) => {
        setIsBookingLoading(true);
        try {
            setLoadingType(shiftType);
            setLoadingSlot(slotIndex);
            await onSlotSelect(shiftType, slotIndex, existingShiftId, isDragAction);
            if (!isDragAction) {
                showSuccessMessage('Запись на смену успешно выполнена');
            }
        } catch (error) {
            console.error('[ShiftSelectionDialog] Error booking shift:', error);
            showToast('Произошла ошибка при записи на смену');
        } finally {
            setLoadingType(null);
            setLoadingSlot(null);
            setIsBookingLoading(false);
        }
    };

    // Обработчик выбора резерва
    const handleReserveSelectWrapper = async () => {
        try {
            setIsLoading(true);
            await onReserveSelect();
            dispatch(forceFetchReserves());
            showSuccessMessage('Успешно добавлено в резерв');
        } catch (error) {
            console.error('[ShiftSelectionDialog] Error in reserve selection:', error);
            showToast('Произошла ошибка при добавлении в резерв');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BottomDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={`Смены на ${format(date, 'd MMMM yyyy', { locale: ru })}`}
        >
            <ModeSwitchContainer>
                <ModeButton
                    active={mode === 'shifts'}
                    onClick={() => setMode('shifts')}
                >
                    Смены
                </ModeButton>
                <ModeButton
                    active={mode === 'reserves'}
                    onClick={() => setMode('reserves')}
                >
                    Резерв
                </ModeButton>
            </ModeSwitchContainer>

            {mode === 'shifts' ? (
                <ShiftPanel
                    date={date}
                    dayShifts={dayShifts}
                    nightShifts={nightShifts}
                    maxDaySlots={maxDaySlots}
                    maxNightSlots={maxNightSlots}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    currentUserName={currentUserName}
                    onSlotSelect={handleSlotSelectWrapper}
                    onSwitchToReserve={() => setMode('reserves')}
                    forceUpdate={() => dispatch(forceFetchReserves())}
                    reserves={reserves}
                    showSuccessMessage={showSuccessMessage}
                    chatId={chatId}
                    isLoading={isBookingLoading}
                    loadingSlot={loadingSlot}
                    loadingType={loadingType}
                />
            ) : (
                <ReservePanel
                    date={date}
                    reserves={reserves}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    currentUserName={currentUserName}
                    dayShifts={dayShifts}
                    nightShifts={nightShifts}
                    onSwitchToShifts={() => setMode('shifts')}
                    onReserveSelect={handleReserveSelectWrapper}
                    onCancelReserve={onCancelReserve}
                    forceUpdate={() => dispatch(forceFetchReserves())}
                    showSuccessMessage={showSuccessMessage}
                    chatId={chatId}
                    isLoading={isLoading}
                />
            )}
        </BottomDrawer>
    );
};

export default ShiftSelectionDialog; 