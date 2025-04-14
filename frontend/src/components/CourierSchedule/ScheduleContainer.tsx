import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import ShiftPanel from './ShiftPanel';
import ReservePanel from './ReservePanel';
import { format } from 'date-fns';
import addDays from 'date-fns/addDays';
import { ru } from 'date-fns/locale';
import { AppDispatch, RootState } from '../../store/store';
import { bookShift, cancelShift, selectSlotConfig, selectIsLoading as selectIsLoadingShifts } from '../../store/slices/shiftsSlice';
import {
    fetchReservesForGroup,
    addCurrentUserToReserveThunk,
    removeReserveByIdThunk,
    selectAllReserves,
    selectReservesLoading as selectIsLoadingReserves
} from '../../store/slices/reservesSlice';
import { socketService } from '../../services/socket';
import { formatDateForAPI } from './CourierCalendar/utils/dateUtils';
import { logger } from '../../utils/logger';
import { SLOTS_CONFIG } from './CourierCalendar/constants';
import { selectUser } from '../../store/slices/userSlice';

// Стили
const Container = styled.div`
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
`;

const Title = styled.h1`
    font-size: 1.8rem;
    color: var(--text-color);
    margin: 0;
`;

const DateSelector = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
`;

const DateButton = styled.button<{ $active?: boolean }>`
    padding: 8px 16px;
    border-radius: var(--radius);
    border: 1px solid ${props => props.$active ? 'var(--primary-color)' : 'var(--border-color)'};
    background: ${props => props.$active ? 'var(--primary-light)' : 'transparent'};
    color: ${props => props.$active ? 'var(--primary-color)' : 'var(--text-color)'};
    font-size: 0.9rem;
    font-weight: ${props => props.$active ? '600' : '400'};
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
    min-width: 100px;

    &:hover {
        background: ${props => props.$active ? 'var(--primary-light)' : 'var(--hover-color)'};
    }
`;

// Компоненты уведомлений
const SnackbarContainer = styled.div<{ isOpen: boolean }>`
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: ${props => props.isOpen ? 'block' : 'none'};
`;

const AlertContainer = styled.div`
    padding: 12px 24px;
    background-color: #4caf50;
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const AlertMessage = styled.div`
    margin-right: 12px;
`;

const CloseButton = styled.button`
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 18px;
`;

// Наши собственные компоненты вместо MUI
const Snackbar: React.FC<{
    open: boolean;
    autoHideDuration?: number;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ open, autoHideDuration = 4000, onClose, children }) => {
    useEffect(() => {
        if (open && autoHideDuration) {
            const timer = setTimeout(onClose, autoHideDuration);
            return () => clearTimeout(timer);
        }
    }, [open, autoHideDuration, onClose]);

    return (
        <SnackbarContainer isOpen={open}>
            {children}
        </SnackbarContainer>
    );
};

const Alert: React.FC<{
    onClose: () => void;
    severity: 'success' | 'error' | 'warning' | 'info';
    sx?: React.CSSProperties;
    children: React.ReactNode;
}> = ({ onClose, severity, children, sx }) => {
    return (
        <AlertContainer style={sx}>
            <AlertMessage>{children}</AlertMessage>
            <CloseButton onClick={onClose}>×</CloseButton>
        </AlertContainer>
    );
};

const ScheduleContainer: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const user = useSelector(selectUser);
    const chatId = useMemo(() => user?.groups?.find(g => g.group_type === 'courier')?.chat_id, [user?.groups]);
    const allShifts = useSelector((state: RootState) => state.shifts.shifts);
    const allReserves = useSelector(selectAllReserves);
    const accessSettings = useSelector((state: RootState) => state.shifts.accessSettings);
    const slotConfig = useSelector(selectSlotConfig);
    const isLoadingShifts = useSelector(selectIsLoadingShifts);
    const isLoadingReserves = useSelector(selectIsLoadingReserves);

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [mode, setMode] = useState<'shifts' | 'reserves'>('shifts');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loadingSlotIndex, setLoadingSlotIndex] = useState<number | null>(null);
    const [loadingShiftType, setLoadingShiftType] = useState<'day' | 'night' | null>(null);
    
    const formattedDate = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

    // Фильтруем смены и резервы для выбранной даты
    const shiftsForDate = useMemo(() => allShifts.filter(shift => shift.date === formattedDate), [allShifts, formattedDate]);
    const dayShifts = useMemo(() => shiftsForDate.filter(s => s.shiftType === 'day'), [shiftsForDate]);
    const nightShifts = useMemo(() => shiftsForDate.filter(s => s.shiftType === 'night'), [shiftsForDate]);
    const reservesForDate = useMemo(() => allReserves.filter(reserve => reserve.date === formattedDate), [allReserves, formattedDate]);
    
    // Определяем, находится ли пользователь в резерве на эту дату
    const userIsInReserve = reservesForDate.some(reserve => String(reserve.userId) === String(user?.id));
    
    // Обработчики изменения даты
    const handlePrevDate = () => {
        setSelectedDate(current => addDays(current, -1));
    };

    const handleNextDate = () => {
        setSelectedDate(current => addDays(current, 1));
    };
    
    // Переключение между режимами (смены/резервы)
    const switchToShifts = useCallback(() => {
        setMode('shifts');
    }, []);
    
    const switchToReserves = useCallback(() => {
        setMode('reserves');
    }, []);
    
    // Восстанавливаем и дорабатываем handleSlotSelect
    const handleSlotSelect = useCallback(async (shiftType: 'day' | 'night', slotIndex: number) => {
        // Получаем актуальные смены для даты внутри useCallback
        const currentShiftsForDate = allShifts.filter(shift => shift.date === formattedDate);
        const currentDayShifts = currentShiftsForDate.filter(s => s.shiftType === 'day');
        const currentNightShifts = currentShiftsForDate.filter(s => s.shiftType === 'night');
        
        if (!user || !user.id || !selectedDate || !chatId) {
            setSuccessMessage('Недостаточно данных для выполнения операции');
            return;
        }

        // Находим текущую группу для определения статуса старшего
        const currentGroup = user.groups?.find(g => String(g.chat_id) === String(chatId));
        const isSenior = currentGroup?.is_senior_courier ?? false;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const relevantShifts = shiftType === 'day' ? currentDayShifts : currentNightShifts;
        const clickedSlot = relevantShifts.find(s => s.slotIndex === slotIndex);
        const isOccupiedByCurrentUser = clickedSlot?.userId === String(user.id);
        
        setLoadingShiftType(shiftType);
        setLoadingSlotIndex(slotIndex);

        try {
            if (isOccupiedByCurrentUser) {
                logger.info(`[ScheduleContainer] Отмена смены: ${shiftType} слот ${slotIndex} на ${dateStr}`);
                if (!clickedSlot?.id) throw new Error('Не найден ID смены для отмены');
                await dispatch(cancelShift({
                     shiftId: clickedSlot.id, 
                     chatId: chatId, 
                     userId: String(user.id),
                     date: dateStr 
                })).unwrap();
                setSuccessMessage('Смена успешно отменена');
            } else if (!clickedSlot || isSenior) {
                const operation = clickedSlot ? 'Изменение' : 'Бронирование';
                logger.info(`[ScheduleContainer] ${operation} смены: ${shiftType} слот ${slotIndex} на ${dateStr}`);
                await dispatch(bookShift({
                    date: dateStr,
                    userId: String(user.id),
                    shiftType: shiftType,
                    slotIndex: slotIndex,
                    chatId: chatId,
                })).unwrap();
                setSuccessMessage(`Смена успешно ${operation === 'Изменение' ? 'изменена' : 'забронирована'}`);
            } else {
                setSuccessMessage('Слот занят другим курьером');
                logger.warn('[ScheduleContainer] Попытка занять чужой слот обычным пользователем');
                 setLoadingShiftType(null);
                 setLoadingSlotIndex(null);
                 return;
            }
        } catch (error: any) {
            console.error(`Ошибка при ${isOccupiedByCurrentUser ? 'отмене' : 'бронировании'} смены:`, error);
            setSuccessMessage(error || 'Ошибка при выполнении операции');
        } finally {
             if (!(clickedSlot && !isOccupiedByCurrentUser && !isSenior)) {
                setLoadingShiftType(null);
                setLoadingSlotIndex(null);
             }
        }
    }, [user, selectedDate, chatId, dispatch, allShifts, formattedDate]);
    
    // Обновляем handleAddToReserve для использования Thunk
    const handleAddToReserve = useCallback(async () => {
        if (!user || !user.id || !chatId) {
            setSuccessMessage('Необходимо авторизоваться и выбрать группу');
            return;
        }
        
        // Преобразуем ID в числа
        const userTelegramId = parseInt(String(user.id), 10);
        const groupTelegramId = parseInt(chatId, 10);
        
        if (isNaN(userTelegramId) || isNaN(groupTelegramId)) {
            setSuccessMessage('Ошибка ID пользователя или группы');
            return;
        }

        try {
            // Проверки остаются теми же
            const userReserve = reservesForDate.find(reserve => String(reserve.userId) === String(user.id));
            if (userReserve) {
                setSuccessMessage('Вы уже в резерве на эту дату');
                return;
            }
            const userShift = shiftsForDate.find(shift => String(shift.userId) === String(user.id));
            if (userShift) {
                setSuccessMessage('Вы уже записаны на смену на эту дату');
                return;
            }
            
            logger.info('[ScheduleContainer] Добавление в резерв через Thunk:', {
                userTelegramId,
                groupTelegramId,
                date: selectedDate, // Передаем объект Date
            });
            
            // Вызываем Thunk addCurrentUserToReserveThunk
            await dispatch(addCurrentUserToReserveThunk({
                userTelegramId,
                groupTelegramId,
                date: selectedDate // Thunk ожидает Date
            })).unwrap();
            
            logger.info('[ScheduleContainer] Успешно добавлен в резерв (через Thunk)');
            setSuccessMessage('Вы успешно добавлены в резерв');
            
            // Принудительное обновление больше не нужно здесь, т.к. стейт обновится через Redux
            // setTimeout(() => { ... }, 500);
            
        } catch (error: any) {
            logger.error('Ошибка при добавлении в резерв:', error);
            setSuccessMessage(error?.message || error || 'Ошибка при добавлении в резерв');
        }
    }, [user, selectedDate, reservesForDate, shiftsForDate, chatId, dispatch]);
    
    // Обновляем handleRemoveFromReserve для использования Thunk
    const handleRemoveFromReserve = useCallback(async (reserveId: string) => {
        if (!user || !user.id || !chatId || !reserveId) { 
            setSuccessMessage('Недостаточно данных для удаления из резерва');
            return;
        }
        try {
            logger.info(`[ScheduleContainer] Удаление резерва ID: ${reserveId} через Thunk`);
            // Вызываем Thunk removeReserveByIdThunk
            await dispatch(removeReserveByIdThunk({ reserveId })).unwrap();
            setSuccessMessage('Вы успешно удалены из резерва');
        } catch (error: any) {
            logger.error('Ошибка при удалении из резерва:', error);
            setSuccessMessage(error?.message || error || 'Ошибка при удалении из резерва'); 
        }
    }, [dispatch, user, chatId]);
    
    // Обновляем forceUpdate для использования fetchReservesForGroup
    const forceUpdate = useCallback(() => {
        if (!chatId) {
            logger.warn('[ScheduleContainer] Попытка forceUpdate без chatId');
            return;
        }
        const groupId = parseInt(chatId, 10);
        if (!isNaN(groupId)) {
             logger.info(`[ScheduleContainer] Запуск fetchReservesForGroup для группы ${groupId} (forceUpdate)`);
            // Используем fetchReservesForGroup для обновления ВСЕХ резервов группы
            dispatch(fetchReservesForGroup({ groupId }));
        } else {
             logger.error('[ScheduleContainer] Невалидный chatId для forceUpdate', chatId);
        }
        // Обновление смен (shiftsSlice) здесь не требуется, оно управляется отдельно
    }, [dispatch, chatId]);
    
    // Обработчик закрытия уведомления
    const handleCloseSnackbar = () => {
        setSuccessMessage(null);
    };
    
    // Инициализация данных при первой загрузке компонента
    useEffect(() => {
        if (chatId) {
            const groupId = parseInt(chatId, 10);
            if (!isNaN(groupId)) {
                 logger.info(`[ScheduleContainer] Загрузка резервов для группы ${groupId} при монтировании/смене chatId`);
                dispatch(fetchReservesForGroup({ groupId }));
            } else {
                logger.error('[ScheduleContainer] Невалидный chatId при монтировании', chatId);
            }
        }
        
        // Находим текущую группу для лога
        const currentGroupForLog = user?.groups?.find(g => String(g.chat_id) === String(chatId));

        // Отладочная информация о статусе пользователя и группы
        console.log('👤 Данные пользователя в ScheduleContainer:', {
            user: {
                 id: user?.id,
                 firstName: user?.first_name,
                 lastName: user?.last_name,
                 // Убираем глобальный is_senior_courier
             },
             groupStatus: {
                 chatId: chatId,
                 role: currentGroupForLog?.role,
                 isSenior: currentGroupForLog?.is_senior_courier
             }
        });
    }, [chatId, dispatch, user]); // Убираем forceUpdate из зависимостей, используем dispatch
    
    // Форматирование даты для отображения
    const formattedDisplayDate = format(selectedDate, 'EEEE, d MMMM', { locale: ru });
    
    // Вычисляем лимиты слотов для выбранной даты
    const { currentMaxDay, currentMaxNight } = useMemo(() => {
        const dayIndex = selectedDate.getDay(); // 0 for Sunday, 1 for Monday, etc.
        const dayConfig = slotConfig ? slotConfig[dayIndex] : undefined;
        return {
            currentMaxDay: dayConfig?.maxDaySlots ?? SLOTS_CONFIG.DAY.MAX_SLOTS,
            currentMaxNight: dayConfig?.maxNightSlots ?? SLOTS_CONFIG.NIGHT.MAX_SLOTS
        };
    }, [selectedDate, slotConfig]);

    // Общий индикатор загрузки (можно улучшить, разделив по типу операции)
    const isLoading = isLoadingShifts || isLoadingReserves || (loadingSlotIndex !== null);

    return (
        <Container>
            <Header>
                <Title>Расписание курьеров</Title>
            </Header>
            
            <DateSelector>
                <DateButton onClick={handlePrevDate}>
                    ← Пред. день
                </DateButton>
                
                <DateButton $active>
                    {formattedDisplayDate}
                </DateButton>
                
                <DateButton onClick={handleNextDate}>
                    След. день →
                </DateButton>
            </DateSelector>
            
            <ShiftPanel
                date={selectedDate}
                dayShifts={dayShifts.map(shift => ({
                    id: shift.id,
                    userId: shift.userId,
                    photoUrl: shift.photoUrl,
                    firstName: shift.firstName,
                    lastName: shift.lastName,
                    shiftType: shift.shiftType,
                    slotIndex: shift.slotIndex,
                }))}
                nightShifts={nightShifts.map(shift => ({
                    id: shift.id,
                    userId: shift.userId,
                    photoUrl: shift.photoUrl,
                    firstName: shift.firstName,
                    lastName: shift.lastName,
                    shiftType: shift.shiftType,
                    slotIndex: shift.slotIndex,
                }))}
                maxDaySlots={currentMaxDay}
                maxNightSlots={currentMaxNight}
                currentUserId={user?.id ? String(user.id) : ''}
                currentUserName={`${user?.first_name || ''} ${user?.last_name || ''}`}
                onSlotSelect={handleSlotSelect}
                onSwitchToReserve={switchToReserves}
                showSuccessMessage={setSuccessMessage}
                isLoading={isLoadingShifts || (loadingSlotIndex !== null)}
                loadingSlot={loadingSlotIndex}
                loadingType={loadingShiftType}
                chatId={chatId}
            />
            
            <Snackbar
                open={!!successMessage}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
            >
                <Alert 
                    onClose={handleCloseSnackbar} 
                    severity="success" 
                    sx={{ width: '100%' }}
                >
                    {successMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default ScheduleContainer; 