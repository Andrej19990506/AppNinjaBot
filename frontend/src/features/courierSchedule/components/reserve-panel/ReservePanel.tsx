import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import defaultAvatar from '@/assets/images/Ninja.jpg';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ReserveEntry, ShiftSlot as ShiftSlotType } from '@features/courierSchedule/types/courierScheduleTypes';
import { logger } from '@shared/utils/logger';
import { deleteReserve } from '@features/courierSchedule/services/courierApi/reservesApi';

interface ReservePanelProps {
    date: Date;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    dayShifts: ShiftSlotType[];
    nightShifts: ShiftSlotType[];
    onSwitchToShifts: () => void;
    getDisplayReservesForDate: (date: Date | null) => ReserveEntry[];
    isCurrentUserInReserveForDate: (date: Date | null) => boolean;
    addCurrentUserToReserve: (date: Date) => Promise<void>;
    cancelReserveById: (reserveId: string) => Promise<void>;
    isLoading: boolean; 
    error: string | null; 
    isCurrentUserSenior: boolean;
    forceUpdate?: () => void;
    showSuccessMessage: (message: string) => void;
    chatId?: string; 
}

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

const ReserveGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 12px;
    justify-items: center;
    margin: 24px 0;
`;

const SlotButton = styled.button<{
    $isOccupied?: boolean;
    $isConfirming?: boolean;
    $isDeleting?: boolean;
}>`
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: none;
    background: ${props => props.$isOccupied
        ? 'transparent'
        : 'rgba(var(--primary-color-rgb), 0.05)'};
    box-shadow: ${props => props.$isConfirming
        ? '0 0 0 3px var(--danger-color), 0 0 8px 2px rgba(244, 67, 54, 0.5)'
        : props.$isOccupied
            ? '0 0 0 2px var(--primary-color)'
            : '0 0 0 2px dashed var(--primary-color)'};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: visible;
    filter: ${props => props.$isDeleting ? 'brightness(0.6)' : 'none'};

    &:hover {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(1.05)'};
        background: ${props => props.$isOccupied
            ? 'transparent'
            : 'rgba(var(--primary-color-rgb), 0.1)'};
    }

    &:active {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(0.95)'};
    }

    &:disabled {
        cursor: not-allowed;
        filter: brightness(0.8);
        box-shadow: 0 0 0 2px var(--grey-light);
    }
`;

const PlusIcon = styled.div`
    color: var(--primary-color);
    font-size: 1.8rem;
    font-weight: 300;
`;

const CourierAvatar = styled.img<{ $isLoading?: boolean }>`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    opacity: ${props => props.$isLoading ? 0.5 : 1};
    transition: opacity 0.3s ease;
`;

const SlotTooltip = styled.div`
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
    z-index: 9999; /* Увеличенный z-index */
    max-width: none;
    overflow: visible;
    /* Гарантирует, что тултип никогда не будет обрезан контейнером */
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.2));

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



// Стилизованная кнопка для добавления в резерв с индикатором загрузки
const ReserveButtonWithLoader = styled(SlotButton)`
    position: relative;
    
    &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    /* Стили для лоадера внутри кнопки */
    .loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 24px; /* Размер лоадера */
        height: 24px;
        border: 3px solid rgba(var(--primary-color-rgb), 0.3);
        border-top-color: var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: translate(-50%, -50%) rotate(360deg);
        }
    }
`;

// Добавляем стиль для значка старшего курьера
const SeniorBadge = styled.div`
    position: absolute;
    top: -5px;
    right: -5px;
    background: linear-gradient(45deg, #FFC107, #FF9800);
    color: #333;
    font-size: 10px;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 10px rgba(255, 193, 7, 0.5);
    z-index: 10;
    animation: pulse 2s infinite;
    pointer-events: auto;
    
    @keyframes pulse {
        0% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 0 0 rgba(255, 193, 7, 0.7);
        }
        70% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 10px 5px rgba(255, 193, 7, 0);
        }
        100% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 0 0 rgba(255, 193, 7, 0);
        }
    }
    
    /* Увеличиваем размер на больших экранах */
    @media (min-width: 768px) {
        top: -6px;
        right: -6px;
        height: 22px;
        width: 22px;
        font-size: 12px;
    }
`;

// Добавляем стиль для информационного сообщения
const InfoMessage = styled.p`
    text-align: center;
    color: var(--text-secondary);
    background-color: var(--background-secondary);
    padding: 12px;
    border-radius: var(--radius);
    margin: 16px 0;
    font-size: 0.9rem;
`;

// Стиль для кнопки переключения
const SwitchButton = styled.button`
    display: block;
    width: 100%;
    padding: 12px 20px;
    margin-top: 24px;
    background-color: var(--background-secondary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;

    &:hover {
        background-color: var(--background-tertiary);
        color: var(--text-color);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

// Стиль для текста ошибки
const ErrorText = styled.p`
    color: var(--error-color);
    text-align: center;
    margin-bottom: 16px;
`;

const DeleteConfirmationIcon = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(244, 67, 54, 0.7);
    color: white;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    z-index: 5;
    opacity: 1;
    transition: opacity 0.3s ease;
`;

const LoadingOverlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 6;
    border-radius: 50%;

    .loader {
        width: 24px;
        height: 24px;
        border: 3px solid rgba(var(--text-color-rgb), 0.3);
        border-top-color: var(--text-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;

// Компонент панели резервов
const ReservePanel: React.FC<ReservePanelProps> = ({
    date,
    currentUserId,
    dayShifts = [],
    nightShifts = [],
    onSwitchToShifts,
    getDisplayReservesForDate,
    isCurrentUserInReserveForDate,
    addCurrentUserToReserve,
    cancelReserveById,
    isLoading: isHookLoading, 
    error: hookError, 
    isCurrentUserSenior, 
    forceUpdate,
    showSuccessMessage,
    chatId,
}) => {

    // Локальное состояние для ошибок UI и ID удаляемого резерва
    const [uiError, setUiError] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false); 
    const [deletingReserveId, setDeletingReserveId] = useState<string | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [tooltipTargetId, setTooltipTargetId] = useState<string | null>(null);
    const confirmationTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Получаем резервы для текущей даты 
    const reserves = typeof getDisplayReservesForDate === 'function' 
        ? getDisplayReservesForDate(date) 
        : []; 
    const isCurrentUserInReserve = typeof isCurrentUserInReserveForDate === 'function'
        ? isCurrentUserInReserveForDate(date)
        : false; 

    const userHasShift = useMemo(() => {
        return [...dayShifts, ...nightShifts].some(shift => String(shift.userId) === String(currentUserId));
    }, [dayShifts, nightShifts, currentUserId]);

    const canAttemptReserve = !isCurrentUserInReserve && !isHookLoading;

    const showAddReserveButton = canAttemptReserve && (!userHasShift || (userHasShift && isCurrentUserSenior));

    const showContactSeniorMessage = canAttemptReserve && userHasShift && !isCurrentUserSenior;

    const handleReserveClick = useCallback(async () => {
        setUiError(null); 
        setIsAdding(true); 
        logger.info('[ReservePanel] handleReserveClick started');
        try {
            await addCurrentUserToReserve(date); 
            showSuccessMessage('Вы успешно добавлены в резерв!');
        } catch (err: any) {
            const errorMsg = err?.message || 'Не удалось добавить в резерв';
            setUiError(errorMsg); 
        } finally {
            setIsAdding(false); 
        }
    }, [addCurrentUserToReserve, date, showSuccessMessage]);

    // --- Получение Telegram ID текущего пользователя ---
    const currentUserTelegramId = parseInt(currentUserId, 10);

    // --- Логика сброса подтверждения И тултипа ---
    const resetState = useCallback(() => {
        if (confirmationTimerRef.current) {
            clearTimeout(confirmationTimerRef.current);
            confirmationTimerRef.current = null;
        }
        setConfirmingDeleteId(null);
        setTooltipTargetId(null);
    }, []);

    // Эффект для сброса подтверждения ПО ТАЙМЕРУ
    useEffect(() => {
        if (confirmingDeleteId) {
            confirmationTimerRef.current = setTimeout(() => {
                resetState(); 
            }, 4000); 
        }
        return () => {
            if (confirmationTimerRef.current) {
                clearTimeout(confirmationTimerRef.current);
            }
        };
    }, [confirmingDeleteId, resetState]);

    const handleDeleteReserve = useCallback(async (reserveIdToDelete: string) => {
        if (deletingReserveId) return;
        setDeletingReserveId(reserveIdToDelete);
        resetState();
        try {
            await cancelReserveById(reserveIdToDelete);
            showSuccessMessage('Резерв курьера удален.');
        } catch (err: any) {
        } finally {
            setDeletingReserveId(null);
        }
    }, [resetState, showSuccessMessage, deletingReserveId, cancelReserveById]);

    const handleCourierClick = (reserveId: string) => {
        if (deletingReserveId) return; 

        if (confirmingDeleteId === reserveId) {
            handleDeleteReserve(reserveId);
        } else {
            resetState(); 
            setConfirmingDeleteId(reserveId);
            setTooltipTargetId(reserveId); 
        }
    };

    const displayError = uiError || hookError;

    return (
        <>
            <DialogHeader>
                <DialogTitle>Резерв</DialogTitle>
                <DialogDate>
                    {format(date, 'd MMMM yyyy, EEEE', { locale: ru })}
                </DialogDate>
            </DialogHeader>

            {/* Показываем сообщение об ошибке */}
            {displayError && (
                <ErrorText>
                    Ошибка: {displayError}
                </ErrorText>
            )}

            {/* Сетка с резервами */}
            <ReserveGrid
                onClick={(e) => {
                    const targetElement = e.target as HTMLElement;
                    const clickedButton = targetElement.closest('button[aria-label]'); 
                    if (!clickedButton) { 
                        resetState(); 
                    } else {
                    }
                }}
            >
                {reserves.map((reserve) => {
                    const isCurrent = String(reserve.userId) === currentUserId;
                    const isConfirming = confirmingDeleteId === reserve.id;
                    const isDeleting = deletingReserveId === reserve.id;
                    const canInteract = isCurrentUserSenior;
                    const avatarSrc = reserve.photoUrl;
                    const isSenior = reserve.isSeniorCourier;
                    const tooltipText = `${reserve.firstName || ''} ${reserve.lastName || ''}`.trim() || `ID: ${reserve.userId}`;
                    const showTooltip = tooltipTargetId === reserve.id;

                    return (
                        <SlotButtonWrapper key={reserve.id}>
                            <SlotButton
                                $isOccupied={true}
                                $isConfirming={isConfirming}
                                $isDeleting={isDeleting}
                                onClick={canInteract ? (e) => {
                                    e.stopPropagation(); 
                                    handleCourierClick(reserve.id)
                                } : undefined}
                                disabled={deletingReserveId !== null && !isDeleting}
                                aria-label={tooltipText}
                            >
                                <CourierAvatar
                                    src={avatarSrc || defaultAvatar}
                                    alt={tooltipText}
                                    $isLoading={isDeleting}
                                    onError={(e) => { if (e.currentTarget.src !== defaultAvatar) e.currentTarget.src = defaultAvatar; }}
                                />
                                {/* Значок старшего курьера */}
                                {isSenior && !isConfirming && !isDeleting && (
                                    <SeniorBadge title="Старший курьер">★</SeniorBadge>
                                )}
                                {/* Иконка подтверждения удаления */}
                                {isConfirming && !isDeleting && (
                                    <DeleteConfirmationIcon title="Нажмите еще раз для удаления">
                                        ×
                                    </DeleteConfirmationIcon>
                                )}
                                {/* Лоадер удаления */}
                                {isDeleting && (
                                    <LoadingOverlay>
                                        <div className="loader"></div>
                                    </LoadingOverlay>
                                )}
                            </SlotButton>
                            {/* Условный рендеринг тултипа */}
                            {showTooltip && (
                                <SlotTooltip style={{ opacity: 1, pointerEvents: 'none' }}>
                                    {tooltipText}
                                </SlotTooltip>
                            )}
                        </SlotButtonWrapper>
                    );
                })}

                {showAddReserveButton && (
                    <ReserveButtonWithLoader
                        onClick={handleReserveClick}
                        disabled={isAdding || isHookLoading || deletingReserveId !== null}
                        title="Записаться в резерв"
                        aria-label="Добавить себя в резерв"
                    >
                        {(isAdding || isHookLoading) ? <div className="loader"></div> : <PlusIcon>+</PlusIcon>}
                    </ReserveButtonWithLoader>
                )}
            </ReserveGrid>

            {showContactSeniorMessage && (
                <InfoMessage>
                    Вы уже записаны в смену на этот день.
                    Обратитесь к старшему курьеру для записи в резерв.
                </InfoMessage>
            )}

            <SwitchButton onClick={onSwitchToShifts}>Перейти к сменам</SwitchButton>
        </>
    );
};

export default React.memo(ReservePanel); 