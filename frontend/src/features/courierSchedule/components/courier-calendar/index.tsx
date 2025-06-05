import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useCalendarData } from '@features/courierSchedule/components/hooks/useCalendarData';
import { useReserveManagement } from '@features/courierSchedule/components/reserve-panel/hooks/useReserveManagement';
import { isDateAvailable } from '@/features/courierSchedule/components/courier-calendar/utils/dateUtils';
import { isIOS } from '@/features/courierSchedule/components/courier-calendar/utils/touchUtils';
import LoadingOverlay from '@/features/courierSchedule/components/loading-overlay';
import { CalendarContainer, MonthsContainer, MonthContainer } from '@/features/courierSchedule/components/courier-calendar/styles';
import MonthSection from '@features/courierSchedule/components/courier-calendar/components/layout/mobile-layout/courier-calendar/month-section';
import { useAvailabilityCheck } from '@/features/courierSchedule/components/setting-panel/shift-access-modal-settings/hooks/useAvailabilityCheck';
import { useAccessSettingsSync } from '@/features/courierSchedule/components/setting-panel/shift-access-modal-settings/hooks/useAccessSettingsSync';
import { fetchAccessSettings, cancelShift } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { format } from 'date-fns';
import { RootState } from '@shared/store/store';
import ShiftSelectionDialog from '@/features/courierSchedule/components/CourierSelectionDialog';
import { addNotification } from '@shared/store/notificationSlice/notificationSlice';
import { selectUsersById } from '@shared/store/userSlice/userSelectors';
import { useAppSelector } from '@/shared/store/hooks';
import { useAppDispatch } from '@/shared/store/hooks';
import { NotificationTypes } from '@/shared/store/notificationSlice/notificationTypes';
import { selectSlotConfig } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { CalendarProps } from '@features/courierSchedule/components/types';
import { addCurrentUserToReserveThunk } from '@features/courierSchedule/store/reservesSlice/reservesThunks';
import { useCourierWebSocketSync } from '@features/courierSchedule/hooks/useCourierWebSocketSync';

const CourierCalendar: React.FC<CalendarProps> = ({
    currentUserId,
    currentUserAvatar,
    currentUserName,
    isCurrentUserSenior,
    chatId,
    onShiftSelect,
    onOpenProfile
}) => {

    const [forceLoading, setForceLoading] = useState(false);
    
    const dispatch = useAppDispatch();
    const slotConfig = useSelector((state: RootState) => selectSlotConfig(state));
    const usersById = useAppSelector(selectUsersById);
    
    const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);

    const calendarRef = useRef<HTMLDivElement>(null);
    const isIOSDevice = isIOS();

    const accessSettings = useAccessSettingsSync(() => {});

    const {
        shifts,
        isLoading: isShiftsLoading,
        error: shiftsError,
        currentMonth,
        getDayShifts,
        getNightShifts,
        hasUserShift,
    } = useCalendarData(currentUserId);

    const monthsToDisplay = useMemo(() => {
        const monthsArray: Date[] = [];
        const baseMonth = new Date(currentMonth);
        baseMonth.setDate(1);
        for (let i = 0; i < 12; i++) {
            const monthDate = new Date(baseMonth);
            monthDate.setMonth(baseMonth.getMonth() + i);
            monthsArray.push(monthDate);
        }
        return monthsArray;
    }, [currentMonth]);

    const {
        isLoading: isReservesLoading,
        error: reservesError,
        getDisplayReservesForDate,
        isCurrentUserInReserveForDate,
        addCurrentUserToReserve,
        cancelReserveById
    } = useReserveManagement(currentUserId, chatId || '');

    useAvailabilityCheck(chatId || '', () => {});

    useEffect(() => {
        if (chatId) {
            dispatch(fetchAccessSettings({ chatId }));
        } else {
        }
    }, [dispatch, chatId]);

    useCourierWebSocketSync();

    const handleDayClick = useCallback((date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const jsDate = new Date(date);
        const dayOfWeek = jsDate.getDay();

        if (accessSettings ? isDateAvailable(date, currentUserId, accessSettings) : false) {
            // Устанавливаем дату для диалога
            setSelectedDateForDialog(date);
            
            // Добавляем проверку даты прямо после установки
            const selectedDate = new Date(date);
            selectedDate.setDate(selectedDate.getDate() + 1);
            
        }
    }, [accessSettings, currentUserId]);

    const handleCloseShiftDialog = useCallback(() => {
        setSelectedDateForDialog(null);
    }, []);

    // Добавляем обработчик изменения даты при свайпе
    const handleDateChange = useCallback((newDate: Date) => {
        // Проверяем, доступна ли новая дата
        const isNewDateAllowed = accessSettings ? isDateAvailable(newDate, currentUserId, accessSettings) : false;
        
        if (isNewDateAllowed) {
            // Обновляем выбранную дату
            setSelectedDateForDialog(newDate);
        } else {
            // Если дата недоступна, показываем уведомление
            dispatch(addNotification({ 
                type: NotificationTypes.WARNING, 
                message: 'Запись на эту дату недоступна', 
                isToast: true 
            }));
        }
    }, [accessSettings, currentUserId, dispatch]);
    
    // Функции для проверки доступности предыдущей и следующей даты
    const isPrevDateAvailable = useMemo(() => {
        if (!selectedDateForDialog || !accessSettings) return false;
        
        const prevDate = new Date(selectedDateForDialog);
        prevDate.setDate(prevDate.getDate() - 1);
        
        return isDateAvailable(prevDate, currentUserId, accessSettings);
    }, [selectedDateForDialog, accessSettings, currentUserId]);
    
    const isNextDateAvailable = useMemo(() => {
        if (!selectedDateForDialog || !accessSettings) return false;
        
        const nextDate = new Date(selectedDateForDialog);
        nextDate.setDate(nextDate.getDate() + 1);
        
        return isDateAvailable(nextDate, currentUserId, accessSettings);
    }, [selectedDateForDialog, accessSettings, currentUserId]);

    const selectedDateShifts = useMemo(() => {
        if (!selectedDateForDialog) return { dayShifts: [], nightShifts: [] };
        return {
            dayShifts: getDayShifts(selectedDateForDialog),
            nightShifts: getNightShifts(selectedDateForDialog)
        };
    }, [selectedDateForDialog, getDayShifts, getNightShifts]);


    const handleDialogShiftSelect = useCallback(async (
        shiftType: 'day' | 'night', 
        slotIndex: number
    ): Promise<any> => {
        if (!selectedDateForDialog) {
            return Promise.reject('No date selected');
        }
        
        try {
            await onShiftSelect(selectedDateForDialog, shiftType, slotIndex);
            return Promise.resolve(); 
        } catch (e) {
            return Promise.reject(e); 
        }
        
    }, [selectedDateForDialog, onShiftSelect]);

    // Обновляем handleDeleteShift: принимаем requesterId и вызываем cancelShift через dispatch
    const handleDeleteShift = useCallback(async (shiftId: string, requesterId: string): Promise<any> => {
        try {
            await dispatch(cancelShift({ shiftId, userId: requesterId })).unwrap();
            return Promise.resolve(); // Успех
        } catch (error: any) {
            // Возвращаем ошибку, чтобы ShiftSelectionDialog мог её обработать (показать уведомление)
            return Promise.reject(error); 
        }
    }, [dispatch]);

    
    const handleMoveToReserve = useCallback(async (shiftId: string, courierId: string): Promise<any> => {
        if (!selectedDateForDialog) {
            return Promise.reject('Дата резерва не выбрана');
        }
        try {
            await dispatch(addCurrentUserToReserveThunk({
                userTelegramId: Number(courierId),
                groupTelegramId: Number(chatId),
                date: selectedDateForDialog
            })).unwrap();
            return Promise.resolve(); // Успех
        } catch (error) {
            return Promise.reject(error);
        }
    }, [dispatch, chatId, selectedDateForDialog]);


    const handleShowNotification = useCallback((type: NotificationTypes, message: string, title?: string) => {
        dispatch(addNotification({ type, message, title, isToast: true }));
    }, [dispatch]);

    // <<< Объединяем все условия загрузки >>>
    const combinedIsLoading = forceLoading || (isShiftsLoading || isReservesLoading);

    const combinedError = shiftsError || reservesError;


    return (
        <>
            <CalendarContainer 
                ref={calendarRef} 
                className={isIOSDevice ? 'ios-scroll-container' : ''}
                style={{ filter: combinedIsLoading ? 'blur(12px)' : 'none', pointerEvents: combinedIsLoading ? 'none' : 'auto' }}
            >
                    <MonthsContainer>
                        {monthsToDisplay.map((month) => (
                            <MonthContainer key={format(month, 'yyyy-MM')}>
                                <MonthSection
                                    month={month}
                                    onDayClick={handleDayClick}
                                    getDayShifts={getDayShifts}
                                    getNightShifts={getNightShifts}
                                    userIsInReserve={isCurrentUserInReserveForDate}
                                    hasUserShift={hasUserShift}
                                    currentUserId={currentUserId}
                                    accessSettings={accessSettings || null}
                                    slotConfig={slotConfig}
                                    isDateAvailable={(date: Date) => accessSettings ? isDateAvailable(date, currentUserId, accessSettings) : false}
                                    selectedDate={selectedDateForDialog}
                                    currentUserAvatar={currentUserAvatar}
                                    usersById={usersById}
                                    isCurrentUserSenior={isCurrentUserSenior}
                                />
                            </MonthContainer>
                        ))}
                    </MonthsContainer>
            </CalendarContainer>

            {/* Рендерим диалог выбора смены */}            
            {selectedDateForDialog && (
                <ShiftSelectionDialog
                    isOpen={!!selectedDateForDialog}
                    onClose={handleCloseShiftDialog}
                    date={selectedDateForDialog}
                    dayShifts={selectedDateShifts.dayShifts}
                    nightShifts={selectedDateShifts.nightShifts}
                    slotConfig={slotConfig}
                    currentUserId={currentUserId}
                    requesterId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    currentUserName={currentUserName}
                    onSlotSelect={handleDialogShiftSelect}
                    chatId={chatId}
                    getDisplayReservesForDate={getDisplayReservesForDate}
                    isCurrentUserInReserveForDate={isCurrentUserInReserveForDate}
                    addCurrentUserToReserve={addCurrentUserToReserve}
                    cancelReserveById={cancelReserveById}
                    isLoading={isReservesLoading}
                    error={reservesError}
                    onDeleteShift={handleDeleteShift}
                    onMoveToReserve={handleMoveToReserve}
                    showNotification={handleShowNotification}
                    onOpenProfile={onOpenProfile}
                    onDateChange={handleDateChange}
                    disablePrevDate={!isPrevDateAvailable}
                    disableNextDate={!isNextDateAvailable}
                />
            )}

            {!combinedError && <LoadingOverlay isVisible={combinedIsLoading} />}


            {combinedError && (
                <div style={{ 
                    position: 'absolute', 
                    top: 0, left: 0, right: 0, bottom: 0, 
                    background: 'rgba(255, 0, 0, 0.7)', 
                    color: 'white', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: '20px', 
                    zIndex: 101, 
                    textAlign: 'center'
                }}>
                    Ошибка загрузки данных: {combinedError}
                </div>
             )}
        </>
    );
};

export default CourierCalendar; 