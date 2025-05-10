import React, { useState, useEffect, useReducer, useRef, useMemo, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { ReserveShift, CourierShift } from '../../types';
import { format } from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllReserves, forceFetchReserves } from '../../store/slices/reservesSlice';
import { AppDispatch, RootState } from '../../store/store';
import { socketService } from '../../services/socket';
import ShiftPanel from './ShiftPanel';
import ReservePanel from './ReservePanel';
import LoadingOverlay from './LoadingOverlay';
import { ru } from 'date-fns/locale';
import BottomDrawer from './components/BottomDrawer';

// Анимация для мини-индикатора загрузки
const spin = keyframes`
    to { transform: rotate(360deg); }
`;

// Мини-индикатор загрузки
const MiniLoader = styled.div`
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: ${spin} 1s linear infinite;
    margin-left: 8px;
`;

interface ShiftSlot {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    date?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
}


const SlotsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 16px;
    justify-items: center;
    padding: 8px;
`;

const SlotButton = styled.button<{ $isOccupied?: boolean }>`
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px dashed ${props => props.$isOccupied ? 'transparent' : 'var(--primary-color)'};
    background: ${props => props.$isOccupied ? 'transparent' : 'var(--primary-transparent)'};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(circle at center, var(--primary-transparent) 0%, transparent 70%);
        opacity: 0;
        transition: opacity var(--transition-normal);
    }

    &:hover {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(1.05)'};
        background: ${props => props.$isOccupied ? 'transparent' : 'var(--primary-transparent)'};
        
        &::before {
            opacity: 1;
        }
    }

    &:active {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(0.95)'};
    }
`;


const SlotTooltip = styled.div`
    display: flex;
    flex-direction: column-reverse;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1000;

    &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.8);
    }
`;


const ReserveButton = styled.button`
    width: 100%;
    padding: 12px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);

    &:hover {
        background: var(--primary-dark);
        transform: var(--hover-transform);
    }

    &:active {
        transform: var(--active-transform);
    }
`;


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

const TabsContainer = styled.div`
    display: flex;
    margin-bottom: 20px;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--border-color);
`;

const Tab = styled.button<{ $isActive: boolean }>`
    flex: 1;
    padding: 10px;
    background: ${props => props.$isActive ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.$isActive ? 'white' : 'var(--text-color)'};
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: ${props => props.$isActive ? '600' : '400'};

    &:hover {
        background: ${props => props.$isActive ? 'var(--primary-color)' : 'var(--hover-color)'};
    }
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
    const [isReserveMode, setIsReserveMode] = useState<boolean>(false);
    const [isBookingLoading, setIsBookingLoading] = useState<boolean>(false);
    const [isReserveActionLoading, setIsReserveActionLoading] = useState<boolean>(false);
    const wsEventsRef = useRef({
        reserveDeleted: false,
        reserveAdded: false
    });
    const formattedDate = useMemo(() => format(date, 'yyyy-MM-dd'), [date]);
    const wsHandlerKey = useMemo(() => 
        `${currentUserId || 'guest'}-${formattedDate}`, 
        [currentUserId, formattedDate]
    );
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    const allReserves = useSelector(selectAllReserves);
    const shiftsLoading = useSelector((state: RootState) => state.shifts.loading);
    const reservesLoading = useSelector((state: RootState) => state.reserves.loading);
    const actualReserves: ReserveShift[] = useMemo(() => {
        if (!reserves || !Array.isArray(reserves)) return [];
        return reserves
            .filter(r => format(date, 'yyyy-MM-dd') === r.date)
            .map(reserve => ({
                id: reserve.id,
                userId: reserve.userId,
                date: reserve.date,
                photo_url: reserve.photo_url,
                firstName: reserve.firstName,
                lastName: reserve.lastName,
                created_at: reserve.created_at || new Date().toISOString()
            }));
    }, [reserves, date]);
    const isCurrentUserInReserve = useMemo(() => {
        if (!currentUserId || !actualReserves.length) return false;
        return actualReserves.some(r => r.userId === currentUserId);
    }, [currentUserId, actualReserves]);
    
    const showToast = (message: string) => {
        console.log('[Toast]', message);
        // Имитация toast сообщения через console.log
        // В реальном приложении заменить на toast библиотеку
    };
    
    const showSuccessMessage = (message: string) => {
        showToast(message);
    };

    useEffect(() => {
        console.log(`[ShiftSelectionDialog] Setting up WebSocket listeners with key: ${wsHandlerKey}`);
        
        const handleReserveDeleted = (data: any) => {
            console.log(`[ShiftSelectionDialog] Reserve deleted event received:`, data);
            
            if (data.user_id === currentUserId && data.date === formattedDate) {
                console.log(`[ShiftSelectionDialog] User ${currentUserId} was removed from reserve for ${formattedDate}`);
                
                wsEventsRef.current.reserveDeleted = true;
                
                showSuccessMessage("Вы были успешно удалены из резерва");
                
                // Переключаемся на вкладку смен после удаления из резерва
                if (isReserveMode) {
                    setIsReserveMode(false);
                }
            }
            
            // Независимо от того, чей резерв удален, обновляем данные
            dispatch(forceFetchReserves()).then(() => {
                forceUpdate();
                if (data.user_id === currentUserId) {
                    wsEventsRef.current.reserveDeleted = false;
                }
            });
        };
        
        const handleReserveAdded = (data: any) => {
            console.log(`[ShiftSelectionDialog] Reserve added event received:`, data);
            
            if (data.user_id === currentUserId && data.date === formattedDate) {
                console.log(`[ShiftSelectionDialog] User ${currentUserId} was added to reserve for ${formattedDate}`);
                
                wsEventsRef.current.reserveAdded = true;
                
                showSuccessMessage("Вы были успешно добавлены в резерв");
                
                if (!isReserveMode) {
                    setIsReserveMode(true);
                }
            }
            
            // Независимо от того, чей резерв добавлен, обновляем данные
            dispatch(forceFetchReserves()).then(() => {
                forceUpdate();
                if (data.user_id === currentUserId) {
                    wsEventsRef.current.reserveAdded = false;
                }
            });
        };
        
        socketService.on('reserve_deleted', handleReserveDeleted);
        socketService.on('reserve_added', handleReserveAdded);
        
        return () => {
            console.log(`[ShiftSelectionDialog] Cleaning up WebSocket listeners for key: ${wsHandlerKey}`);
            socketService.off('reserve_deleted', handleReserveDeleted);
            socketService.off('reserve_added', handleReserveAdded);
        };
    }, [wsHandlerKey, currentUserId, formattedDate, dispatch, forceUpdate, isReserveMode]);

    // Обновляем эффект для отслеживания загрузки
    useEffect(() => {
        // Устанавливаем состояние загрузки только при открытии диалога
        if (isOpen) {
            if (shiftsLoading) {
                setIsBookingLoading(true);
            } else if (reservesLoading) {
                setIsReserveActionLoading(true);
            } else {
                setIsBookingLoading(false);
                setIsReserveActionLoading(false);
            }
        }
    }, [shiftsLoading, reservesLoading, isOpen]);

    // Модифицируем wrapper для SlotSelect и ReserveSelect
    const handleSlotSelectWrapper = (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction = false) => {
        setIsBookingLoading(true);
        
        console.log('[ShiftSelectionDialog] Selecting slot, isDragAction:', isDragAction);
        
        onSlotSelect(shiftType, slotIndex, existingShiftId, isDragAction)
            .then(() => {
                setIsBookingLoading(false);
                if (isDragAction) {
                    console.log('[ShiftSelectionDialog] Drag-and-drop operation completed successfully');
                } else {
                    showSuccessMessage('Запись на смену успешно выполнена');
                }
            })
            .catch(error => {
                console.error('[ShiftSelectionDialog] Error booking shift:', error);
                setIsBookingLoading(false);
                showToast('Произошла ошибка при записи на смену');
            });
    };
    
    const handleReserveSelectWrapper = async () => {
        setIsReserveActionLoading(true);
        try {
            await onReserveSelect();
        } catch (error) {
            console.error('[ShiftSelectionDialog] Error in reserve selection:', error);
            // Явно сбрасываем состояние загрузки в случае ошибки
            setIsReserveActionLoading(false);
        } finally {
            // Добавляем явный сброс состояния загрузки через короткий таймаут
            // на случай, если Redux состояние не обновилось
            setTimeout(() => {
                if (isReserveActionLoading) {
                    console.log('[ShiftSelectionDialog] Reserve action completed, ensuring loading state is reset');
                    setIsReserveActionLoading(false);
                }
            }, 300);
        }
    };
    
    // Обновляем функцию закрытия диалога
    const handleClose = useCallback(() => {
        // Просто закрываем диалог без обновления состояний
        onClose();
    }, [onClose]);

    if (!isOpen) return null;
    
    return (
        <BottomDrawer
            isOpen={isOpen}
            onClose={handleClose}
            title={format(date, 'd MMMM yyyy', { locale: ru })}
        >
            <ModeSwitchContainer>
                <ModeButton 
                    active={!isReserveMode} 
                    onClick={() => setIsReserveMode(false)}
                    data-testid="shift-mode-button"
                    disabled={isBookingLoading || isReserveActionLoading}
                >
                    Смены
                </ModeButton>
                <ModeButton 
                    active={isReserveMode} 
                    onClick={() => setIsReserveMode(true)}
                    data-testid="reserve-mode-button"
                    disabled={isBookingLoading || isReserveActionLoading}
                >
                    Резерв {isCurrentUserInReserve && '✓'}
                </ModeButton>
            </ModeSwitchContainer>
            
            {isReserveMode ? 
                <div 
                    key="reserve-panel"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        willChange: 'transform',
                        transform: 'translateZ(0)'
                    }}
                >
                    <ReservePanel 
                        reserves={actualReserves}
                        onReserveSelect={handleReserveSelectWrapper}
                        onCancelReserve={onCancelReserve}
                        currentUserId={currentUserId}
                        currentUserAvatar={currentUserAvatar}
                        currentUserName={currentUserName}
                        date={date}
                        dayShifts={dayShifts}
                        nightShifts={nightShifts}
                        onSwitchToShifts={() => setIsReserveMode(false)}
                        showSuccessMessage={showSuccessMessage}
                        forceUpdate={forceUpdate}
                        chatId={chatId}
                    />
                </div> :
                <div 
                    key="shift-panel"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        willChange: 'transform',
                        transform: 'translateZ(0)'
                    }}
                >
                    <ShiftPanel 
                        dayShifts={dayShifts} 
                        nightShifts={nightShifts}
                        maxDaySlots={maxDaySlots}
                        maxNightSlots={maxNightSlots}
                        onSlotSelect={handleSlotSelectWrapper}
                        forceUpdate={forceUpdate}
                        currentUserId={currentUserId}
                        currentUserAvatar={currentUserAvatar}
                        currentUserName={currentUserName}
                        onSwitchToReserve={() => setIsReserveMode(true)}
                        date={date}
                        reserves={actualReserves}
                        showSuccessMessage={showSuccessMessage}
                        chatId={chatId}
                    />
                </div>
            }
        </BottomDrawer>
    );
};

export default ShiftSelectionDialog; 