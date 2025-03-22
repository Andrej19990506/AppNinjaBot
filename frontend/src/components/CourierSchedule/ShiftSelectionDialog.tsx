import React, { useState, useEffect, useReducer, useRef, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { ReserveShift } from '../../types/shifts';
import { format } from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllReserves, forceFetchReserves } from '../../store/slices/reservesSlice';
import { AppDispatch, RootState } from '../../store/store';
import { socketService } from '../../services/socket';
import ShiftPanel from './ShiftPanel';
import ReservePanel from './ReservePanel';
import LoadingOverlay from './LoadingOverlay';
import { ru } from 'date-fns/locale';

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

const DialogOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    backdrop-filter: blur(4px);
`;

const DialogContent = styled.div`
    background: var(--card-background);
    border-radius: var(--radius);
    padding: 24px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    animation: slideUp 0.3s ease;
    position: relative;

    @keyframes slideUp {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
`;

const DialogHeader = styled.div`
    margin-bottom: 24px;
    text-align: center;
`;

const DialogTitle = styled.h2`
    margin: 0;
    color: var(--text-color);
    font-size: 1.5rem;
    font-weight: 600;
`;

const DialogDate = styled.div`
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin-top: 8px;
`;

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

const SlotsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 12px;
    justify-items: center;
`;

const SlotButton = styled.button<{ $isOccupied?: boolean }>`
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px dashed ${props => props.$isOccupied ? 'transparent' : 'var(--primary-color)'};
    background: ${props => props.$isOccupied ? 'transparent' : 'rgba(76, 175, 80, 0.05)'};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;

    &:hover {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(1.05)'};
        background: ${props => props.$isOccupied ? 'transparent' : 'rgba(76, 175, 80, 0.1)'};
    }

    &:active {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(0.95)'};
    }
`;

const PlusIcon = styled.div`
    color: var(--primary-color);
    font-size: 1.8rem;
    font-weight: 300;
`;

const CourierAvatar = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    border: 2px solid var(--primary-color);
`;

const CloseButton = styled.button`
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background: var(--hover-color);
    }
`;

const SuccessNotification = styled.div`
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(76, 175, 80, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideDown 0.3s ease;
    z-index: 1200;

    @keyframes slideDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
`;

const CheckIcon = styled.span`
    font-size: 1.2rem;
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

const SlotButtonWrapper = styled.div`
    position: relative;
    
    &:hover ${SlotTooltip} {
        opacity: 1;
    }
`;

const ReserveSection = styled.div`
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
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
    transition: all 0.3s ease;

    &:hover {
        background: var(--primary-dark);
        transform: translateY(-1px);
    }

    &:active {
        transform: translateY(0);
    }
`;

const ReserveList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
`;

const ReserveItem = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: var(--background);
    border-radius: var(--radius);
`;

const ReserveAvatar = styled.img`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
`;

const ReserveInfo = styled.div`
    flex: 1;
`;

const ReserveName = styled.div`
    font-weight: 500;
    color: var(--text-color);
`;

const ReserveDate = styled.div`
    font-size: 0.9rem;
    color: var(--text-secondary);
`;

const NoSlotsMessage = styled.div`
    text-align: center;
    padding: 24px;
    color: var(--text-secondary);
    font-size: 1.1rem;
    line-height: 1.5;
    background: var(--background);
    border-radius: var(--radius);
    margin-bottom: 24px;
`;

const ReserveGrid = styled(SlotsGrid)`
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    margin: 24px 0;
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 12px;
    margin-top: 16px;
`;

const BookButton = styled(ReserveButton)`
    background: var(--primary-color);
    
    &:hover {
        background: var(--primary-dark);
    }
`;

const ReserveActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
`;

const CancelButton = styled(ReserveButton)`
    background: #f44336;
    
    &:hover {
        background: #d32f2f;
    }
`;

const DialogFooter = styled.div`
    margin-top: 24px;
`;

const ModeSwitchContainer = styled.div`
    display: flex;
    margin-bottom: 20px;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--border-color);
`;

const ModeButton = styled.button<{ active: boolean }>`
    flex: 1;
    padding: 10px;
    background: ${props => props.active ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.active ? 'white' : 'var(--text-color)'};
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: ${props => props.active ? '600' : '400'};

    &:hover {
        background: ${props => props.active ? 'var(--primary-color)' : 'var(--hover-color)'};
    }
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

const SuccessMessage = styled.div`
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(76, 175, 80, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideDown 0.3s ease;
    z-index: 1200;

    @keyframes slideDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
`;

interface ShiftSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    dayShifts: ShiftSlot[];
    nightShifts: ShiftSlot[];
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

    // Отслеживаем общее состояние загрузки
    useEffect(() => {
        if (shiftsLoading) {
            setIsBookingLoading(true);
        } else if (reservesLoading) {
            setIsReserveActionLoading(true);
        } else {
            setIsBookingLoading(false);
            setIsReserveActionLoading(false);
        }
        
        // Добавляем защитный таймаут, чтобы избежать бесконечной загрузки
        let loadingTimeout: NodeJS.Timeout;
        if (isBookingLoading || isReserveActionLoading) {
            loadingTimeout = setTimeout(() => {
                console.log('[ShiftSelectionDialog] Safety timeout triggered to prevent infinite loading');
                setIsBookingLoading(false);
                setIsReserveActionLoading(false);
            }, 5000); // 5 секунд максимум для загрузки
        }
        
        return () => {
            if (loadingTimeout) clearTimeout(loadingTimeout);
        };
    }, [shiftsLoading, reservesLoading, isBookingLoading, isReserveActionLoading]);

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
    
    if (!isOpen) return null;
    
    // Убираем полноэкранную загрузку, теперь состояния загрузки передаются в дочерние компоненты
    
    return (
        <DialogOverlay onClick={onClose}>
            <DialogContent onClick={e => e.stopPropagation()}>
                <CloseButton onClick={onClose}>&times;</CloseButton>
                
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
            </DialogContent>
        </DialogOverlay>
    );
};

export default ShiftSelectionDialog; 