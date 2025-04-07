import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useDispatch, useSelector } from 'react-redux';
import { 
    // Закомментируем неиспользуемое
    // removeFromReserve, 
    forceFetchReserves, 
    subscribeToReserveEvents, 
    // unsubscribeFromReserveEvents,
    reserveAdded,
    // reserveDeleted
} from '../../store/slices/reservesSlice';
import { AppDispatch, RootState } from '../../store/store';
// import { RootState as ReduxRootState } from '../../store/store';
import { ReserveShift } from '../../types';
import { selectAllReserves } from '../../store/slices/reservesSlice';
import LoadingOverlay from './LoadingOverlay';
import { socketService } from '../../services/socket';
import { formatDateForAPI } from './CourierCalendar/utils/dateUtils';

interface ShiftSlotLocal {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
}

// Интерфейсы
interface ReservePanelProps {
    date: Date;
    reserves: ReserveShift[];
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    dayShifts: ShiftSlotLocal[];
    nightShifts: ShiftSlotLocal[];
    onSwitchToShifts: () => void;
    onReserveSelect: () => Promise<any>;
    onCancelReserve: (reserveId: string) => void;
    forceUpdate: () => void;
    showSuccessMessage: (message: string) => void;
    chatId?: string;
    isLoading?: boolean;
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

// Комментируем неиспользуемые стили
/* const DialogFooter = styled.div`
    margin-top: 24px;
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 12px;
    margin-top: 16px;
`;

const ModeButton = styled.button`
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
`; */

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

// Комментируем неиспользуемый компонент
/* const MiniLoader = styled.div`
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-left: 8px;
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`; */

// Стилизованная кнопка для добавления в резерв с индикатором загрузки
const ReserveButtonWithLoader = styled(SlotButton)`
    position: relative;
    
    &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
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

// Компонент панели резервов
const ReservePanel: React.FC<ReservePanelProps> = ({
    date,
    reserves = [],
    currentUserId,
    currentUserAvatar,
    currentUserName,
    dayShifts = [],
    nightShifts = [],
    onSwitchToShifts,
    onReserveSelect,
    onCancelReserve,
    forceUpdate,
    showSuccessMessage,
    chatId,
    isLoading = false
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const [localReserves, setLocalReserves] = useState<ReserveShift[]>([]);
    const [confirmDelete] = useState<string | null>(null);
    const [isAddLoading, setIsAddLoading] = useState<boolean>(false);
    const [isRemoveLoading, setIsRemoveLoading] = useState<boolean>(false);
    const [, setUpdateCounter] = useState(0);
    const [pendingReserve, setPendingReserve] = useState<ReserveShift | null>(null);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Создаем ref для хранения ссылки на текущий слот в режиме удаления
    const deleteSlotRef = useRef<HTMLButtonElement>(null);
    
    // Получаем информацию о пользователе заранее
    const userInfo = useSelector((state: RootState) => state.user.user);
    
    // Синхронизируем локальное состояние с входящими props
    useEffect(() => {
        setLocalReserves(reserves);
    }, [reserves]);

    // Получаем все резервы напрямую из Redux для максимальной актуальности
    const allReduxReserves = useSelector(selectAllReserves);
    
    // Форматируем дату для API
    const formattedDate = formatDateForAPI(date);
    
    // Проверяем, есть ли другие резервы в Redux, соответствующие текущей дате
    const currentDateReserves = allReduxReserves.filter(
        reserve => {
            // Сравниваем только даты без времени
            const reserveDate = reserve.date.split('T')[0];
            const formattedDateOnly = formattedDate.split('T')[0];
            return reserveDate === formattedDateOnly;
        }
    );
    
    // Логируем только если есть резервы для текущей даты
    if (currentDateReserves.length > 0) {
        console.log('[ReservePanel] Found reserves for date:', {
            date: formattedDate,
            reserves: currentDateReserves
        });
    }
    
    // Всегда используем данные из Redux
    const displayReserves = currentDateReserves;

    // Определяем, имеет ли текущий пользователь резерв в списке reserves
    const userHasReserveInList = displayReserves.some(
        reserve => String(reserve.userId) === String(currentUserId)
    );
    
    // Найдем резерв пользователя
    const userReserve = userHasReserveInList ? 
        displayReserves.find(
            reserve => String(reserve.userId) === String(currentUserId)
        ) : null;
    
    // Проверка на активные смены у пользователя
    const userHasActiveShift = (dayShifts || []).some(shift => String(shift.userId) === String(currentUserId)) || 
                              (nightShifts || []).some(shift => String(shift.userId) === String(currentUserId));

    console.log('[ReservePanel] State:', {
        userHasReserveInList,
        userReserve,
        userHasActiveShift,
        dayShifts: dayShifts?.length || 0,
        nightShifts: nightShifts?.length || 0
    });

    // Функция для локального обновления состояния
    const triggerUpdate = useCallback(() => {
        setUpdateCounter(prev => prev + 1);
    }, []);

    // Подписываемся на WebSocket-события для обновления резервов в реальном времени
    useEffect(() => {
        console.log('[ReservePanel] Setting up WebSocket events subscription for reserves');
        
        // Добавим проверку подключения WebSocket
        const isSocketConnected = socketService.isConnected();
        console.log(`[ReservePanel] 🔌 WebSocket connected: ${isSocketConnected}`);
        
        // Подписываемся на события WebSocket с дополнительными логами
        const unsubscribe = subscribeToReserveEvents(dispatch);
        
        // При размонтировании отписываемся от событий
        return () => {
            console.log('[ReservePanel] Cleaning up WebSocket events subscription for reserves');
            // Используем optional chaining для безопасного вызова
            unsubscribe?.(); 
        };
    }, [dispatch, chatId, date]);

    // Отдельный эффект для обработки временных резервов
    useEffect(() => {
        if (!pendingReserve) return;

        const handleReserveAdded = (data: any) => {
            if (data.userId === currentUserId && data.date === format(date, 'yyyy-MM-dd')) {
                console.log('[ReservePanel] ✅ Received confirmation for pending reserve');
                // Удаляем временный резерв из локального состояния
                setLocalReserves(prev => prev.filter(r => r.id !== pendingReserve.id));
                setPendingReserve(null);
                setIsAddLoading(false);
                triggerUpdate();
                dispatch(forceFetchReserves({ groupId: parseInt(chatId || '0', 10), date: formattedDate }));
            }
        };

        socketService.subscribe('reserve_added', handleReserveAdded);

        return () => {
            socketService.unsubscribe('reserve_added');
        };
    }, [pendingReserve, currentUserId, date, dispatch, triggerUpdate, chatId, formattedDate]);

    // При изменении состояния резерва пользователя или активной смены, обновляем UI
    const prevUserHasReserveInList = useRef(false);
    useEffect(() => {
        if (userHasReserveInList !== prevUserHasReserveInList.current) {
            console.log('[ReservePanel] User reserve state changed, triggering update');
            triggerUpdate();
            prevUserHasReserveInList.current = userHasReserveInList;
        }
    }, [userHasReserveInList, triggerUpdate]);

    // Добавляем защитный таймаут для сброса состояния загрузки
    // Комментируем неиспользуемую функцию
    /* const startLoadingSafetyTimeout = () => {
        // Сначала очищаем существующий таймаут, если он есть
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
        }
        
        // Устанавливаем новый таймаут
        loadingTimeoutRef.current = setTimeout(() => {
            console.log('[ReservePanel] Safety timeout triggered to prevent infinite loading');
            setIsAddLoading(false);
            setIsRemoveLoading(false);
        }, 5000); // 5 секунд максимум для загрузки
    }; */
    
    // Очищаем таймаут при размонтировании компонента
    useEffect(() => {
        // Копируем значение ref в локальную переменную внутри эффекта
        const timeoutId = loadingTimeoutRef.current;
        
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, []);

    // Обработчик добавления в резерв
    const handleReserveClick = useCallback(() => {
        if (!date) return;
        
        console.log('[ReservePanel] handleReserveClick called');
        
        // Создаем временный резерв с данными пользователя
        const tempReserve = {
            id: `temp-${Date.now()}`,
            date: format(date, "yyyy-MM-dd'T'17:00:00.000'Z'"),
            userId: currentUserId,
            user_id: currentUserId,
            firstName: userInfo?.first_name || currentUserName?.split(' ')[0] || '',
            lastName: userInfo?.last_name || currentUserName?.split(' ')[1] || '',
            photo_url: userInfo?.photo_url || currentUserAvatar || null,
            isSeniorCourier: userInfo?.is_senior_courier || false,
            created_at: new Date().toISOString()
        };
        
        console.log('[ReservePanel] Creating temporary reserve:', tempReserve);
        
        // Добавляем временный резерв в Redux
        dispatch(reserveAdded(tempReserve));
        
        // Вызываем callback для добавления в резерв
        console.log('[ReservePanel] Calling onReserveSelect to add to reserve');
        onReserveSelect();
    }, [date, currentUserId, currentUserName, currentUserAvatar, dispatch, onReserveSelect, userInfo]);

    // Комментируем неиспользуемую функцию
    /* const handleStartDeleteReserve = (reserveId: string) => {
        console.log('[ReservePanel] handleStartDeleteReserve called for ID:', reserveId);
        
        // Включаем режим подтверждения для этого резерва
        setConfirmDelete(reserveId);
        
        // Убираем автоматический сброс, чтобы состояние не пропадало
        // setTimeout(() => {
        //     setConfirmDelete(null);
        // }, 3000);
    }; */

    const handleCancelReserve = async (reserveId: string) => {
        if (!reserveId) {
            console.error('[ReservePanel] Reserve ID is required');
            return;
        }
        
        try {
            setIsRemoveLoading(true);
            
            console.log('[ReservePanel] Removing from reserve with ID:', reserveId);
            
            // Проверяем, доступен ли chatId
            if (!chatId) {
                console.log('[ReservePanel] Warning: No chatId provided for reserve cancellation');
            }
            
            // Оптимистично удаляем резерв из визуального списка
            // const reserveToRemove = userReserve; // Неиспользуемая переменная
            setLocalReserves(prev => prev.filter(r => r.id !== reserveId));
            
            // Отправляем запрос на удаление, используя chatId
            await onCancelReserve(reserveId);
            
            // Показываем успешное сообщение
            showSuccessMessage('Вы удалены из резерва');
            
            console.log('[ReservePanel] Successfully removed from reserve');
        } catch (error) {
            console.error('[ReservePanel] Failed to remove from reserve:', error);
            
            // Визуально отменяем оптимистичное обновление
            setLocalReserves(reserves);
            
            showSuccessMessage('Не удалось удалить резерв');
        } finally {
            setIsRemoveLoading(false);
        }
    };

    // Обновляем отображение резервов с учетом временного резерва
    const displayReservesWithPending = useMemo(() => {
        if (!localReserves.length) return [];
        
        // Если есть ожидающий резерв, добавляем его в список только если пользователь еще не в резерве
        if (pendingReserve && !userHasReserveInList) {
            return [...localReserves, pendingReserve];
        }
        
        return localReserves;
    }, [localReserves, pendingReserve, userHasReserveInList]);

    // Показываем loading только при начальной загрузке компонента
    if (isLoading) {
        return <LoadingOverlay />;
    }

    // Добавляем индикатор загрузки для операций с резервами
    const renderLoadingIndicator = () => {
        if (isAddLoading || isRemoveLoading) {
            return (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    zIndex: 1000
                }}>
                    {isAddLoading ? 'Добавление в резерв...' : 'Удаление из резерва...'}
                </div>
            );
        }
        return null;
    };

    return (
        <>
            {renderLoadingIndicator()}
            <DialogHeader>
                <DialogTitle>Запись в резерв</DialogTitle>
                <DialogDate>{format(date, 'dd MMMM yyyy', { locale: ru })}</DialogDate>
            </DialogHeader>

            <ReserveGrid>
                {/* Отображаем существующие резервы */}
                {displayReservesWithPending.map((reserve) => {
                    const isCurrentUser = String(reserve.userId) === String(currentUserId);
                    const reserveId = String(reserve.id);
                    const isDeleteMode = confirmDelete === reserveId;
                    
                    // Если это текущий пользователь, который уже имеет смену - визуально выделим это
                    const userHasBothShiftAndReserve = isCurrentUser && userHasActiveShift;
                    
                    // Логируем подробности для отладки
                    if (isCurrentUser) {
                        console.log('[ReservePanel] Rendering current user reserve with state:', {
                            userHasActiveShift,
                            userHasBothShiftAndReserve,
                            reserve,
                            userId: reserve.userId,
                            currentUserId,
                            isDeleteMode
                        });
                    }
                    
                    return (
                        <SlotButtonWrapper key={reserve.id}>
                            {isCurrentUser ? (
                                <CurrentUserReserve 
                                    $isOccupied={true}
                                    style={{
                                        border: '2px solid var(--primary-color)',
                                        background: userHasBothShiftAndReserve ? 'rgba(255, 193, 7, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                                        position: 'relative'
                                    }}
                                    onClick={!isRemoveLoading ? () => handleCancelReserve(reserveId) : undefined}
                                    ref={isDeleteMode ? deleteSlotRef : undefined}
                                    disabled={isRemoveLoading}
                                >
                                    <CourierAvatar
                                        src={reserve.photo_url || defaultAvatar}
                                        alt={`${reserve.firstName} ${reserve.lastName}`}
                                        className="current-user-avatar"
                                        style={{
                                            border: userHasBothShiftAndReserve ? 
                                                '2px solid #ffc107' : '2px solid var(--primary-color)',
                                            transition: 'all 0.3s ease',
                                            opacity: isRemoveLoading ? 0.7 : 1
                                        }}
                                        onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            img.src = defaultAvatar;
                                        }}
                                    />
                                    {reserve.isSeniorCourier && (
                                        <SeniorBadge title="Старший курьер">
                                            <span style={{ 
                                                fontSize: '12px', 
                                                fontWeight: 'bold' 
                                            }}>⭐</span>
                                        </SeniorBadge>
                                    )}
                                    <DeleteButton 
                                        className="delete-reserve-button"
                                        style={{
                                            opacity: isDeleteMode && !isRemoveLoading ? 1 : 0
                                        }}
                                        onClick={(e) => {
                                            if (isRemoveLoading) return;
                                            e.stopPropagation();
                                            handleCancelReserve(reserveId);
                                        }}
                                    >
                                        ×
                                    </DeleteButton>
                                </CurrentUserReserve>
                            ) : (
                                <SlotButton 
                                    $isOccupied={true}
                                    style={{
                                        border: 'transparent',
                                        background: 'transparent',
                                        position: 'relative'
                                    }}
                                >
                                    <CourierAvatar
                                        src={reserve.photo_url || defaultAvatar}
                                        alt={`${reserve.firstName} ${reserve.lastName}`}
                                        style={{
                                            border: '2px solid var(--border-color)', 
                                            transition: 'all 0.3s ease'
                                        }}
                                        onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            img.src = defaultAvatar;
                                        }}
                                    />
                                    {reserve.isSeniorCourier && (
                                        <SeniorBadge title="Старший курьер">
                                            <span style={{ 
                                                fontSize: '12px', 
                                                fontWeight: 'bold' 
                                            }}>⭐</span>
                                        </SeniorBadge>
                                    )}
                                </SlotButton>
                            )}
                            <SlotTooltip>
                                {isCurrentUser ? 
                                    (userHasBothShiftAndReserve ? 'Вы (уже есть смена)' : 
                                     isDeleteMode ? 'Нажмите еще раз для удаления' : 'Нажмите для удаления') 
                                    : (
                                        <div style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            alignItems: 'center'
                                        }}>
                                            {reserve.isSeniorCourier && (
                                                <span style={{
                                                    display: 'inline-block',
                                                    background: 'linear-gradient(45deg, #FFC107, #FF9800)',
                                                    color: '#333',
                                                    padding: '2px 6px',
                                                    borderRadius: '10px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '5px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                }}>
                                                    ⭐ Старший курьер
                                                </span>
                                            )}
                                            <span>{reserve.firstName} {reserve.lastName}</span>
                                        </div>
                                    )
                                }
                            </SlotTooltip>
                        </SlotButtonWrapper>
                    );
                })}
                
                {/* Показываем кнопку записи, если пользователь еще не в резерве */}
                {!userHasReserveInList && !userHasActiveShift && (
                    <SlotButtonWrapper>
                        <ReserveButtonWithLoader 
                            $isOccupied={false}
                            onClick={!isAddLoading ? handleReserveClick : undefined}
                            disabled={isAddLoading}
                        >
                            <PlusIcon>+</PlusIcon>
                        </ReserveButtonWithLoader>
                        <SlotTooltip>Записаться в резерв</SlotTooltip>
                    </SlotButtonWrapper>
                )}
            </ReserveGrid>

            {displayReservesWithPending.length === 0 && !userHasReserveInList && !userHasActiveShift && (
                <NoSlotsMessage>
                    В резерве пока никого нет.<br/>
                    Нажмите на "+" чтобы записаться первым.
                </NoSlotsMessage>
            )}
            
            {userHasActiveShift && !userHasReserveInList && (
                <NoSlotsMessage>
                    У вас уже есть смена на эту дату.<br/>
                    Нельзя одновременно быть в смене и в резерве.
                </NoSlotsMessage>
            )}
        </>
    );
};

export default ReservePanel; 