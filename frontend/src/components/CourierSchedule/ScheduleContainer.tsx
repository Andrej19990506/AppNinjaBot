import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import ShiftPanel from './ShiftPanel';
import ReservePanel from './ReservePanel';
import { addDays, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AppDispatch, RootState } from '../../store/store';
import { useShiftsSync } from '../../hooks/useShiftsSync';
import { useReservesSync } from '../../hooks/useReservesSync';
import { Snackbar, Alert } from '@mui/material';
import { bookShift } from '../../store/slices/shiftsSlice';
import { socketService } from '../../services/socket';

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

const ScheduleContainer: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [mode, setMode] = useState<'shifts' | 'reserves'>('shifts');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Получаем данные пользователя из хранилища Redux
    const user = useSelector((state: RootState) => state.user.user);
    const shifts = useSelector((state: RootState) => state.shifts.shifts);
    const reserves = useSelector((state: RootState) => state.reserves.reserves);
    
    // Получаем chat_id
    const chatId = user?.groups && user.groups.length > 0 ? user.groups[0].chat_id : '';
    
    // Используем хуки для синхронизации данных смен и резервов
    const shiftSync = useShiftsSync(chatId);
    const reserveSync = useReservesSync(chatId);
    
    // Получаем смены на выбранную дату
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const shiftsForDate = shifts.filter(shift => shift.date === formattedDate);
    
    // Разделяем смены на дневные и ночные
    const dayShifts = shiftsForDate.filter(shift => shift.shiftType === 'day');
    const nightShifts = shiftsForDate.filter(shift => shift.shiftType === 'night');
    
    // Получаем резервы на выбранную дату
    const reservesForDate = reserves.filter(reserve => reserve.date === formattedDate);
    
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
    
    // Обработчик выбора слота для смены
    const handleSlotSelect = useCallback(async (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string) => {
        if (!user || !user.id) {
            setSuccessMessage('Необходимо авторизоваться');
            return;
        }
        
        try {
            // Журналируем статус старшего курьера перед созданием данных
            console.info('[ScheduleContainer] Обработка выбора смены:', {
                userId: user.id,
                isSeniorCourier: user.isSeniorCourier,
                date: formattedDate,
                shiftType,
                slotIndex
            });
            
            // Создаем данные для запроса
            const shiftData = {
                user_id: String(user.id),
                date: formattedDate,
                shift_type: shiftType,
                slot_index: slotIndex,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                photo_url: user.photo_url || '',
                chat_id: chatId,
                is_senior_courier: user.isSeniorCourier || false
            };
            
            // Журналируем перед отправкой на сервер
            console.info('[ScheduleContainer] Отправка данных смены:', shiftData);
            
            // Выполняем запись на смену через Redux
            await dispatch(bookShift({
                date: formattedDate,
                userId: String(user.id),
                shiftType: shiftType,
                slotIndex: slotIndex,
                existingShiftId: existingShiftId,
                chatId: chatId
            }));
            
            // Отправляем запрос на обновление смены через хук синхронизации
            shiftSync.updateShift(shiftData);
            
            setSuccessMessage('Вы успешно записались на смену');
        } catch (error) {
            console.error('Ошибка при записи на смену:', error);
            setSuccessMessage('Ошибка при записи на смену');
        }
    }, [user, formattedDate, shiftSync, chatId, dispatch]);
    
    // Обработчик отмены смены
    const handleCancelShift = useCallback(async (shiftId: string) => {
        try {
            shiftSync.cancelShift(shiftId);
            setSuccessMessage('Смена успешно отменена');
        } catch (error) {
            console.error('Ошибка при отмене смены:', error);
            setSuccessMessage('Ошибка при отмене смены');
        }
    }, [shiftSync]);
    
    // Обработчик добавления в резерв
    const handleAddToReserve = useCallback(async () => {
        if (!user || !user.id) {
            setSuccessMessage('Необходимо авторизоваться');
            return;
        }
        
        try {
            // Проверяем, не записан ли уже пользователь в резерв на эту дату
            const userReserve = reservesForDate.find(reserve => String(reserve.userId) === String(user.id));
            if (userReserve) {
                setSuccessMessage('Вы уже в резерве на эту дату');
                return;
            }
            
            // Проверяем, не записан ли уже пользователь на смену на эту дату
            const userShift = shiftsForDate.find(shift => String(shift.userId) === String(user.id));
            if (userShift) {
                setSuccessMessage('Вы уже записаны на смену на эту дату');
                return;
            }
            
            console.log('[ScheduleContainer] Добавление в резерв:', {
                user_id: String(user.id),
                date: formattedDate,
                chatId,
                isSeniorCourier: user.isSeniorCourier
            });
            
            // Используем хук для добавления в резерв с исправленными параметрами
            const result = await reserveSync.addToReserve(
                formattedDate,
                user,
                chatId
            );
            
            console.log('[ScheduleContainer] Результат добавления в резерв:', result);
            
            // Добавляем прямое событие для отладки
            socketService.emit("echo", { 
                message: "reserve-added",
                user_id: String(user.id),
                date: formattedDate,
                chat_id: chatId,
                timestamp: new Date().toISOString()
            });
            
            setSuccessMessage('Вы успешно добавлены в резерв');
            
            // Принудительно обновляем данные через небольшую задержку
            setTimeout(() => {
                reserveSync.loadReserves();
            }, 500);
            
            return result;
        } catch (error) {
            console.error('Ошибка при добавлении в резерв:', error);
            setSuccessMessage('Ошибка при добавлении в резерв');
            throw error;
        }
    }, [user, formattedDate, reservesForDate, shiftsForDate, reserveSync, chatId]);
    
    // Обработчик удаления из резерва
    const handleRemoveFromReserve = useCallback(async (reserveId: string) => {
        try {
            reserveSync.removeFromReserve(reserveId);
            setSuccessMessage('Вы успешно удалены из резерва');
        } catch (error) {
            console.error('Ошибка при удалении из резерва:', error);
            setSuccessMessage('Ошибка при удалении из резерва');
        }
    }, [reserveSync]);
    
    // Форсированное обновление данных
    const forceUpdate = useCallback(() => {
        shiftSync.loadShifts();
        reserveSync.loadReserves();
    }, [shiftSync, reserveSync]);
    
    // Обработчик закрытия уведомления
    const handleCloseSnackbar = () => {
        setSuccessMessage(null);
    };
    
    // Инициализация данных при первой загрузке компонента
    useEffect(() => {
        if (chatId) {
            forceUpdate();
        }
        
        // Отладочная информация о статусе пользователя
        console.log('👤 Данные пользователя в ScheduleContainer:', {
            user,
            isSeniorCourier: user?.isSeniorCourier,
        });
    }, [chatId, forceUpdate, user]);
    
    // Форматирование даты для отображения
    const formattedDisplayDate = format(selectedDate, 'EEEE, d MMMM', { locale: ru });
    
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
            
            {mode === 'shifts' ? (
                <ShiftPanel
                    date={selectedDate}
                    dayShifts={dayShifts.map(shift => ({
                        id: shift.id,
                        userId: shift.userId,
                        photo_url: shift.photo_url,
                        firstName: shift.firstName,
                        lastName: shift.lastName,
                        shiftType: shift.shiftType,
                        slotIndex: shift.slotIndex,
                        isSeniorCourier: shift.isSeniorCourier
                    }))}
                    nightShifts={nightShifts.map(shift => ({
                        id: shift.id,
                        userId: shift.userId,
                        photo_url: shift.photo_url,
                        firstName: shift.firstName,
                        lastName: shift.lastName,
                        shiftType: shift.shiftType,
                        slotIndex: shift.slotIndex,
                        isSeniorCourier: shift.isSeniorCourier
                    }))}
                    maxDaySlots={4}
                    maxNightSlots={2}
                    currentUserId={user?.id ? String(user.id) : ''}
                    currentUserAvatar={user?.photo_url || ''}
                    currentUserName={`${user?.first_name || ''} ${user?.last_name || ''}`}
                    onSlotSelect={handleSlotSelect}
                    onSwitchToReserve={switchToReserves}
                    forceUpdate={forceUpdate}
                    reserves={reservesForDate}
                    showSuccessMessage={setSuccessMessage}
                />
            ) : (
                <ReservePanel
                    date={selectedDate}
                    reserves={reservesForDate}
                    currentUserId={user?.id ? String(user.id) : ''}
                    onCancelReserve={handleRemoveFromReserve}
                    currentUserAvatar={user?.photo_url || ''}
                    currentUserName={`${user?.first_name || ''} ${user?.last_name || ''}`}
                    dayShifts={dayShifts.map(shift => ({
                        id: shift.id,
                        userId: shift.userId,
                        photo_url: shift.photo_url,
                        firstName: shift.firstName,
                        lastName: shift.lastName,
                        shiftType: shift.shiftType,
                        slotIndex: shift.slotIndex,
                        isSeniorCourier: shift.isSeniorCourier
                    }))}
                    nightShifts={nightShifts.map(shift => ({
                        id: shift.id,
                        userId: shift.userId,
                        photo_url: shift.photo_url,
                        firstName: shift.firstName,
                        lastName: shift.lastName,
                        shiftType: shift.shiftType,
                        slotIndex: shift.slotIndex,
                        isSeniorCourier: shift.isSeniorCourier
                    }))}
                    onSwitchToShifts={switchToShifts}
                    onReserveSelect={handleAddToReserve}
                    forceUpdate={forceUpdate}
                    showSuccessMessage={setSuccessMessage}
                />
            )}
            
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