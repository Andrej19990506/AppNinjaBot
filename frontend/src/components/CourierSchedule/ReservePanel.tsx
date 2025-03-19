import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useDispatch, useSelector } from 'react-redux';
import { 
    removeFromReserve, 
    forceFetchReserves, 
    subscribeToReserveEvents, 
    unsubscribeFromReserveEvents 
} from '../../store/slices/reservesSlice';
import { AppDispatch, RootState } from '../../store/store';
import { ReserveShift } from '../../types/shifts';
import { selectAllReserves } from '../../store/slices/reservesSlice';
import { RootState as ReduxRootState } from '../../store/store';
import LoadingOverlay from './LoadingOverlay';

// Интерфейсы
interface ReservePanelProps {
    date: Date;
    reserves: ReserveShift[];
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    dayShifts: ShiftSlot[];
    nightShifts: ShiftSlot[];
    onSwitchToShifts: () => void;
    onReserveSelect: () => Promise<any>;
    forceUpdate: () => void;
    showSuccessMessage: (message: string) => void;
}

// Обновляем интерфейс для типизации dayShifts и nightShifts
interface ShiftSlot {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
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

const DialogFooter = styled.div`
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

// Добавляем стиль для мини-индикатора загрузки
const MiniLoader = styled.div`
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
`;

// Стилизованная кнопка для добавления в резерв с индикатором загрузки
const ReserveButtonWithLoader = styled(SlotButton)`
    position: relative;
    
    &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
`;

// Компонент панели резервов
const ReservePanel: React.FC<ReservePanelProps> = ({
    date,
    reserves,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    dayShifts,
    nightShifts,
    onSwitchToShifts,
    onReserveSelect,
    forceUpdate,
    showSuccessMessage
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const [localReserves, setLocalReserves] = useState<ReserveShift[]>(reserves);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isAddLoading, setIsAddLoading] = useState<boolean>(false);
    const [isRemoveLoading, setIsRemoveLoading] = useState<boolean>(false);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Создаем ref для хранения ссылки на текущий слот в режиме удаления
    const deleteSlotRef = useRef<HTMLButtonElement>(null);
    
    // Обработчик кликов по документу для сброса режима удаления при клике вне слота
    useEffect(() => {
        if (confirmDelete) {
            const handleClickOutside = (event: MouseEvent) => {
                // Если у нас есть ссылка на элемент и клик был вне этого элемента
                if (deleteSlotRef.current && !deleteSlotRef.current.contains(event.target as Node)) {
                    console.log('[ReservePanel] Click outside delete slot, resetting delete mode');
                    setConfirmDelete(null);
                }
            };
            
            // Добавляем обработчик события
            document.addEventListener('mousedown', handleClickOutside);
            
            // Очищаем при размонтировании
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [confirmDelete]);
    
    // Получаем информацию о пользователе заранее
    const userInfo = useSelector((state: RootState) => state.user.user);
    
    // Синхронизируем локальное состояние с входящими props
    useEffect(() => {
        setLocalReserves(reserves);
    }, [reserves]);

    // Получаем все резервы напрямую из Redux для максимальной актуальности
    const allReduxReserves = useSelector(selectAllReserves);
    
    // Проверяем, есть ли другие резервы в Redux, соответствующие текущей дате
    const formattedDate = format(date, 'yyyy-MM-dd');
    const currentDateReserves = allReduxReserves.filter(
        reserve => reserve.date === formattedDate
    );
    
    console.log('[ReservePanel] Redux reserves by date:', {
        formattedDate,
        allReduxReserves: allReduxReserves.length,
        currentDateReserves: currentDateReserves.length,
        reservesData: currentDateReserves
    });
    
    // Всегда используем данные из Redux, поскольку они должны быть актуальными
    // благодаря подписке на WebSocket события
    const displayReserves = currentDateReserves;
    
    console.log('[ReservePanel] Reserves data:', {
        propsReserves: reserves.length,
        localReserves: localReserves.length,
        reduxReserves: currentDateReserves.length,
        displayReserves: displayReserves.length
    });

    // Определяем, имеет ли текущий пользователь резерв в списке reserves
    const userHasReserveInList = displayReserves.some(
        reserve => String(reserve.userId) === String(currentUserId)
    );
    
    // Найдем резерв пользователя из входных параметров
    const userReserve = userHasReserveInList ? 
        displayReserves.find(
            reserve => String(reserve.userId) === String(currentUserId)
        ) : null;
    
    // Проверка на активные смены у пользователя
    const userHasActiveShift = dayShifts.some(shift => String(shift.userId) === String(currentUserId)) || 
                              nightShifts.some(shift => String(shift.userId) === String(currentUserId));

    console.log('[ReservePanel] State:', {
        userHasReserveInList,
        userReserve,
        userHasActiveShift
    });

    // Подписываемся на WebSocket-события для обновления резервов в реальном времени
    useEffect(() => {
        console.log('[ReservePanel] Setting up WebSocket events subscription for reserves');
        
        // Подписываемся на события WebSocket
        subscribeToReserveEvents(dispatch);
        
        // Делаем начальную загрузку резервов
        dispatch(forceFetchReserves());
        
        // При размонтировании отписываемся от событий
        return () => {
            console.log('[ReservePanel] Cleaning up WebSocket events subscription for reserves');
            unsubscribeFromReserveEvents();
        };
    }, [dispatch]);
    
    // Обновляем UI при изменении даты 
    useEffect(() => {
        console.log('[ReservePanel] Date changed, refreshing reserves');
        dispatch(forceFetchReserves());
    }, [dispatch, date]);

    // При изменении состояния резерва пользователя или активной смены, принудительно обновляем UI
    const prevUserHasReserveInList = useRef(false);
    useEffect(() => {
        if (userHasReserveInList !== prevUserHasReserveInList.current) {
            console.log('[ReservePanel] User reserve state changed, forcing update');
            forceUpdate();
            prevUserHasReserveInList.current = userHasReserveInList;
        }
    }, [userHasReserveInList, forceUpdate]);

    // Добавляем защитный таймаут для сброса состояния загрузки
    const startLoadingSafetyTimeout = () => {
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
    };
    
    // Очищаем таймаут при размонтировании компонента
    useEffect(() => {
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, []);

    const handleReserveClick = async () => {
        console.log('[ReservePanel] handleReserveClick called');
        
        // Показываем только локальный индикатор для кнопки добавления
        setIsAddLoading(true);
        startLoadingSafetyTimeout();
        
        try {
            console.log('[ReservePanel] Calling onReserveSelect to add to reserve');
            
            // Сначала добавляем оптимистичный резерв в локальное состояние,
            // чтобы UI мгновенно отреагировал без моргания
            const optimisticReserve = userInfo ? {
                id: `temp-${Date.now()}`, // временный ID для оптимистичного обновления
                userId: currentUserId,
                date: format(date, 'yyyy-MM-dd'),
                photo_url: userInfo.photo_url || null,
                firstName: userInfo.first_name || '',
                lastName: userInfo.last_name || '',
                created_at: new Date().toISOString()
            } : null;
            
            if (optimisticReserve) {
                console.log('[ReservePanel] Adding optimistic reserve to local state:', optimisticReserve);
                setLocalReserves(prev => [...prev, optimisticReserve]);
            }
            
            // Отправляем запрос на сервер
            const result = await onReserveSelect();
            console.log('[ReservePanel] Reserve added successfully via onReserveSelect, result:', result);
            
            // Обновляем локальное состояние с актуальными данными с сервера
            if (result) {
                // Заменяем оптимистичный резерв на реальный без моргания UI
                setLocalReserves(prev => {
                    const filtered = prev.filter(r => r.id !== optimisticReserve?.id);
                    return [...filtered, result];
                });
                
                // Тихое обновление данных из Redux без перерисовки
                setTimeout(() => {
                    dispatch(forceFetchReserves());
                }, 300);
            }
            
            setIsAddLoading(false);
            // Очищаем таймаут, так как запрос успешно завершен
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        } catch (error) {
            console.error('[ReservePanel] Error adding to reserve:', error);
            
            // В случае ошибки, удаляем оптимистичный резерв
            if (userInfo) {
                setLocalReserves(prev => 
                    prev.filter(r => !r.id.toString().startsWith('temp-'))
                );
            }
            
            setIsAddLoading(false);
            // Очищаем таймаут, так как произошла ошибка
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        }
    };

    const handleStartDeleteReserve = (reserveId: string) => {
        console.log('[ReservePanel] handleStartDeleteReserve called for ID:', reserveId);
        
        // Включаем режим подтверждения для этого резерва
        setConfirmDelete(reserveId);
        
        // Убираем автоматический сброс, чтобы состояние не пропадало
        // setTimeout(() => {
        //     setConfirmDelete(null);
        // }, 3000);
    };

    const handleCancelReserve = async () => {
        console.log('[ReservePanel] handleCancelReserve called');
        
        // Показываем только индикатор удаления, а не полный экран загрузки
        setIsRemoveLoading(true);
        startLoadingSafetyTimeout();
        
        try {
            // Определяем ID резерва для отмены из списка резервов
            if (userReserve && userReserve.id) {
                const reserveId = String(userReserve.id);
                
                // Проверяем, находимся ли мы в режиме подтверждения для этого резерва
                if (confirmDelete === reserveId) {
                    console.log('[ReservePanel] Confirming cancellation for reserve ID:', reserveId);
                    
                    // Оптимистическое обновление UI до получения ответа от сервера
                    setLocalReserves(prevReserves => 
                        prevReserves.filter(reserve => reserve.id !== reserveId)
                    );
                    
                    // Вызываем dispatch для отправки WebSocket события
                    await dispatch(removeFromReserve({
                        reserveId: reserveId,
                        userId: String(currentUserId)
                    }));
                    
                    console.log('[ReservePanel] Reserve cancellation dispatched via WebSocket');
                    showSuccessMessage("Вы были успешно удалены из резерва");
                    
                    // Сбрасываем режим подтверждения
                    setConfirmDelete(null);
                    
                    // Принудительно обновляем компонент
                    forceUpdate();
                    
                    // Немедленно обновляем данные в Redux
                    dispatch(forceFetchReserves());
                } else {
                    // Первый клик - показываем подтверждение
                    handleStartDeleteReserve(reserveId);
                }
            } else {
                console.log('[ReservePanel] No valid reserve ID to cancel');
            }
            
            setIsRemoveLoading(false);
            // Очищаем таймаут, так как запрос успешно завершен
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        } catch (error) {
            console.error('[ReservePanel] Error canceling reserve:', error);
            
            setIsRemoveLoading(false);
            // Очищаем таймаут, так как произошла ошибка
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        }
    };

    // Удаляем полноэкранную загрузку - теперь используем локальные индикаторы
    // if (isLocalLoading) {
    //     return <LoadingOverlay context="reserve" />;
    // }

    return (
        <>
            <DialogHeader>
                <DialogTitle>Запись в резерв</DialogTitle>
                <DialogDate>{format(date, 'dd MMMM yyyy', { locale: ru })}</DialogDate>
            </DialogHeader>

            <ReserveGrid>
                {/* Отображаем существующие резервы */}
                {displayReserves.map((reserve) => {
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
                                    onClick={!isRemoveLoading ? handleCancelReserve : undefined}
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
                                    <DeleteButton 
                                        className="delete-reserve-button"
                                        style={{
                                            opacity: isDeleteMode && !isRemoveLoading ? 1 : 0
                                        }}
                                        onClick={(e) => {
                                            if (isRemoveLoading) return;
                                            e.stopPropagation();
                                            handleCancelReserve();
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
                                </SlotButton>
                            )}
                            <SlotTooltip>
                                {isCurrentUser ? 
                                    (userHasBothShiftAndReserve ? 'Вы (уже есть смена)' : 
                                     isDeleteMode ? 'Нажмите еще раз для удаления' : 'Нажмите для удаления') 
                                    : `${reserve.firstName} ${reserve.lastName}`}
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

            {displayReserves.length === 0 && !userHasReserveInList && !userHasActiveShift && (
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