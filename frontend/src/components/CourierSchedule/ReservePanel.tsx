import React, { useCallback, useState, useMemo } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ReserveEntry, ShiftSlot as ShiftSlotType } from '../../types/shifts';
import { logger } from '../../utils/logger';

// Обновляем интерфейс пропсов
interface ReservePanelProps {
    date: Date;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    dayShifts: ShiftSlotType[];
    nightShifts: ShiftSlotType[];
    onSwitchToShifts: () => void;
    // Новые пропсы от хука (будут переданы из ShiftSelectionDialog -> CourierCalendar)
    getDisplayReservesForDate: (date: Date | null) => ReserveEntry[];
    isCurrentUserInReserveForDate: (date: Date | null) => boolean;
    addCurrentUserToReserve: (date: Date) => Promise<void>;
    cancelReserveById: (reserveId: string) => Promise<void>;
    isLoading: boolean; // Состояние загрузки от хука
    error: string | null; // Ошибка от хука
    isCurrentUserSenior: boolean;
    // Старые пропсы, которые остаются
    forceUpdate?: () => void;
    showSuccessMessage: (message: string) => void;
    chatId?: string; 
}

// Стили (которые нужны только для этого компонента)
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
    overflow: visible;

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

const CurrentUserReserve = styled(SlotButton)`
    &:hover .current-user-avatar {
        filter: brightness(0.7);
    }
    
    &:hover .delete-reserve-button {
        opacity: 1;
    }
`;

const DeleteButton = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(244, 67, 54, 0.6);
    color: white;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    z-index: 5;
    opacity: 0;
    transition: opacity 0.3s ease;
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

// Компонент панели резервов
const ReservePanel: React.FC<ReservePanelProps> = ({
    date,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    dayShifts = [],
    nightShifts = [],
    onSwitchToShifts,
    // Новые пропсы
    getDisplayReservesForDate,
    isCurrentUserInReserveForDate,
    addCurrentUserToReserve,
    cancelReserveById,
    isLoading: isHookLoading, // Переименуем, чтобы не конфликтовать с локальным isLoading
    error: hookError, // Переименуем
    isCurrentUserSenior, // <<< Получаем пропс без значения по умолчанию
    // Старые пропсы
    forceUpdate,
    showSuccessMessage,
    chatId,
}) => {
    // --- Логируем тип полученного пропса ---
    logger.debug('[ReservePanel] Received prop getDisplayReservesForDate type:', typeof getDisplayReservesForDate);
    if (typeof getDisplayReservesForDate !== 'function') {
        logger.error('[ReservePanel] getDisplayReservesForDate is NOT a function! Prop value:', getDisplayReservesForDate);
    }
    // --- Конец лога ---

    // Локальное состояние для ошибок UI и ID удаляемого резерва
    const [uiError, setUiError] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false); // Локальный лоадер для кнопки добавления
    const [removingReserveId, setRemovingReserveId] = useState<string | null>(null); // Локальный лоадер для кнопки удаления

    // Получаем резервы для текущей даты 
    // Добавляем проверку, что это функция, перед вызовом
    const reserves = typeof getDisplayReservesForDate === 'function' 
        ? getDisplayReservesForDate(date) 
        : []; // Возвращаем пустой массив, если не функция
    // Проверяем, есть ли текущий юзер в резерве
    const isCurrentUserInReserve = typeof isCurrentUserInReserveForDate === 'function'
        ? isCurrentUserInReserveForDate(date)
        : false; // Возвращаем false, если не функция

    // Проверяем, есть ли у пользователя смена на эту дату
    const userHasShift = useMemo(() => {
        return [...dayShifts, ...nightShifts].some(shift => String(shift.userId) === String(currentUserId));
    }, [dayShifts, nightShifts, currentUserId]);

    // ===> ОБНОВЛЕННАЯ ЛОГИКА ОТОБРАЖЕНИЯ <===
    const canAttemptReserve = !isCurrentUserInReserve && !isHookLoading;

    // Показываем кнопку добавления?
    // Условие: можно пытаться + (нет смены ИЛИ (есть смена И юзер - старший))
    const showAddReserveButton = canAttemptReserve && (!userHasShift || (userHasShift && isCurrentUserSenior));

    // Показываем сообщение "Обратитесь к старшему"?
    // Условие: можно пытаться + есть смена + юзер НЕ старший
    const showContactSeniorMessage = canAttemptReserve && userHasShift && !isCurrentUserSenior;

    // Логирование состояния для отладки
    logger.debug(`[ReservePanel] Conditions: isCurrentUserInReserve=${isCurrentUserInReserve}, isHookLoading=${isHookLoading}, userHasShift=${userHasShift}, isCurrentUserSenior=${isCurrentUserSenior} -> showAddButton=${showAddReserveButton}, showContactMsg=${showContactSeniorMessage}`);

    // Логирование при рендере
    logger.info('[ReservePanel] Rendering', {
        date,
        currentUserId,
        isHookLoading,
        hookError,
        reservesCount: reserves.length,
        isCurrentUserInReserve,
    });

    // --- Обработчики событий ---

    const handleReserveClick = useCallback(async () => {
        setUiError(null); // Сброс локальной ошибки
        setIsAdding(true); // Включаем локальный лоадер добавления
        logger.info('[ReservePanel] handleReserveClick started');
        try {
            await addCurrentUserToReserve(date); // Используем функцию из пропсов
            logger.info('[ReservePanel] addCurrentUserToReserve successful');
            showSuccessMessage('Вы успешно добавлены в резерв!');
            // forceUpdate(); // Обновление данных теперь через Redux/WebSocket
        } catch (err: any) {
            const errorMsg = err?.message || 'Не удалось добавить в резерв';
            logger.error('[ReservePanel] Error adding to reserve:', err);
            setUiError(errorMsg); // Показываем локальную ошибку
        } finally {
            setIsAdding(false); // Выключаем локальный лоадер добавления
        }
    }, [addCurrentUserToReserve, date, showSuccessMessage]);

    const handleCancelReserve = useCallback(async (reserveId: string) => {
        if (!reserveId) {
            logger.warn('[ReservePanel] handleCancelReserve called with empty reserveId');
            return;
        }
        setUiError(null); // Сброс локальной ошибки
        setRemovingReserveId(reserveId); // Включаем локальный лоадер удаления для конкретной кнопки
        logger.info(`[ReservePanel] handleCancelReserve started for ID: ${reserveId}`);
        try {
            await cancelReserveById(reserveId); // Используем функцию из пропсов
            logger.info(`[ReservePanel] cancelReserveById successful for ID: ${reserveId}`);
            showSuccessMessage('Резерв успешно отменен!');
            // forceUpdate(); // Обновление данных теперь через Redux/WebSocket
        } catch (err: any) {
            const errorMsg = err?.message || 'Не удалось отменить резерв';
            logger.error('[ReservePanel] Error cancelling reserve:', err);
            setUiError(errorMsg); // Показываем локальную ошибку
        } finally {
            setRemovingReserveId(null); // Выключаем локальный лоадер удаления
        }
    }, [cancelReserveById, showSuccessMessage]);

    // --- Рендеринг ---

    // Отображение общей ошибки от хука
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
            <ReserveGrid>
                {/* Отображаем занятые слоты (резервы) */}
                {reserves.map((reserve) => {
                    const isCurrent = String(reserve.userId) === String(currentUserId);
                    // Используем поля напрямую из reserve
                    const avatarSrc = isCurrent ? currentUserAvatar : reserve.photoUrl;
                    const name = isCurrent ? currentUserName : reserve.firstName || 'Неизвестный курьер'; // Берем firstName
                    const isSenior = reserve.isSeniorCourier; // Берем isSeniorCourier
                    const isRemovingThis = removingReserveId === reserve.id; // Проверяем, удаляется ли именно этот резерв

                    return (
                        <SlotButtonWrapper key={reserve.id}>
                            {isCurrent ? (
                                // Кнопка для отмены своего резерва
                                <CurrentUserReserve
                                    $isOccupied
                                    onClick={() => handleCancelReserve(reserve.id)}
                                    disabled={isHookLoading || isRemovingThis || isAdding} // Блокируем во время любых загрузок
                                    aria-label={`Отменить резерв ${name}`}
                                >
                                    <CourierAvatar
                                        className="current-user-avatar"
                                        src={avatarSrc || defaultAvatar}
                                        alt={`Аватар ${name}`}
                                        onError={(e) => (e.currentTarget.src = defaultAvatar)}
                                    />
                                    {isSenior && <SeniorBadge title="Старший курьер">★</SeniorBadge>}
                                    {/* Кнопка удаления поверх */}
                                    <DeleteButton className="delete-reserve-button">
                                        {isRemovingThis ? <div className="loader"></div> : '✕'}
                                    </DeleteButton>
                                </CurrentUserReserve>
                            ) : (
                                // Просто занятый слот (другой курьер)
                                <SlotButton $isOccupied disabled aria-label={`Резерв ${name}`}>
                                    <CourierAvatar
                                        src={avatarSrc || defaultAvatar}
                                        alt={`Аватар ${name}`}
                                        onError={(e) => (e.currentTarget.src = defaultAvatar)}
                                    />
                                    {isSenior && <SeniorBadge title="Старший курьер">★</SeniorBadge>}
                                </SlotButton>
                            )}
                            <SlotTooltip>{name}</SlotTooltip>
                        </SlotButtonWrapper>
                    );
                })}

                {/* ===> ОТОБРАЖЕНИЕ КНОПКИ ДОБАВЛЕНИЯ (по новому условию) <=== */}
                {showAddReserveButton && (
                    <ReserveButtonWithLoader
                        onClick={handleReserveClick} // Был handleAddToReserve, переименовал для ясности?
                        disabled={isAdding || isHookLoading || removingReserveId !== null}
                        title="Записаться в резерв"
                        aria-label="Добавить себя в резерв"
                    >
                        {(isAdding || isHookLoading) ? <div className="loader"></div> : <PlusIcon>+</PlusIcon>}
                        <SlotTooltip>Добавить себя</SlotTooltip>
                    </ReserveButtonWithLoader>
                )}
            </ReserveGrid>

            {/* ===> ОТОБРАЖЕНИЕ СООБЩЕНИЯ "ОБРАТИТЕСЬ К СТАРШЕМУ" <=== */}
            {showContactSeniorMessage && (
                <InfoMessage>
                    Вы уже записаны в смену на этот день.
                    Обратитесь к старшему курьеру для записи в резерв.
                </InfoMessage>
            )}

            {/* Кнопка Переключиться на смены (без изменений) */}
             <SwitchButton onClick={onSwitchToShifts}>Перейти к сменам</SwitchButton>
        </>
    );
};

export default ReservePanel; 