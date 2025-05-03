import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { CalendarProps } from './types';
import { useCalendarData } from './hooks/useCalendarData';
import { useReserveManagement } from './hooks/useReserveManagement';
import { isDateAvailable } from './utils/dateUtils';
import { isIOS } from './utils/touchUtils';
import LoadingOverlay from './components/LoadingOverlay';
import { CalendarContainer, MonthsContainer, MonthContainer } from './styles';
import MonthSection from './components/MonthSection';
import { useAvailabilityCheck } from './hooks/useAvailabilityCheck';
import { useAccessSettingsSync } from './hooks/useAccessSettingsSync';
import { fetchAccessSettings, selectSlotConfig, removeShiftLocally } from '../../../store/slices/shiftsSlice';
import { logger } from '../../../utils/logger';
import { format } from 'date-fns';
import { RootState } from '../../../store/store';
import ShiftSelectionDialog from '../ShiftSelectionDialog';
import { addNotification, NotificationTypes } from '../../../store/slices/notificationSlice';
import { deleteShiftAsSenior } from '../../../services/courierApi';
import { selectUsersById } from '../../../store/slices/userSlice';

const CourierCalendar: React.FC<CalendarProps> = ({
    currentUserId,
    currentUserAvatar,
    currentUserName,
    isCurrentUserSenior,
    onClose,
    chatId,
    onShiftSelect,
    onOpenSlotSettings,
    onLongPress,
    onOpenProfile
}) => {
    // Принудительное отображение загрузочного экрана
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
            logger.log(`🔍 Загрузка настроек доступа для chatId ${chatId} при монтировании календаря`);
            // @ts-ignore: игнорируем ошибку типа для диспетчера
            dispatch(fetchAccessSettings({ chatId }));
        } else {
            logger.warn('⚠️ chatId не определен при монтировании календаря, настройки доступа не загружены.');
        }
    }, [dispatch, chatId]);

    const handleDayClick = useCallback((date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const isAllowed = accessSettings ? isDateAvailable(date, currentUserId, accessSettings) : false;
        
        if (isAllowed) {
            logger.log(`[CourierCalendar] Клик по доступной дате: ${dateStr}`);
            setSelectedDateForDialog(date);
        } else {
            logger.log(`[CourierCalendar] Клик по недоступной дате: ${dateStr}`);
        }
    }, [accessSettings, currentUserId]);

    const handleCloseShiftDialog = useCallback(() => {
        logger.log('[CourierCalendar] Closing shift dialog');
        setSelectedDateForDialog(null);
    }, []);

    const selectedDateShifts = useMemo(() => {
        if (!selectedDateForDialog) return { dayShifts: [], nightShifts: [] };
        return {
            dayShifts: getDayShifts(selectedDateForDialog),
            nightShifts: getNightShifts(selectedDateForDialog)
        };
    }, [selectedDateForDialog, getDayShifts, getNightShifts]);

    // <<< ДОБАВЛЯЕМ ЛОГ ДЛЯ selectedDateShifts >>>
    useEffect(() => {
        if (selectedDateForDialog) {
            logger.debug(`[CourierCalendar] selectedDateShifts updated/checked:`, {
                date: format(selectedDateForDialog, 'yyyy-MM-dd'),
                dayCount: selectedDateShifts.dayShifts.length,
                nightCount: selectedDateShifts.nightShifts.length,
                dayIds: selectedDateShifts.dayShifts.map(s => s.id),
                nightIds: selectedDateShifts.nightShifts.map(s => s.id)
            });
        }
    }, [selectedDateShifts, selectedDateForDialog]); // Зависим от selectedDateShifts и selectedDateForDialog

    const handleDialogShiftSelect = useCallback(async (
        shiftType: 'day' | 'night', 
        slotIndex: number
    ): Promise<any> => {
        if (!selectedDateForDialog) {
            logger.error('[CourierCalendar] handleDialogShiftSelect called without selectedDateForDialog');
            return Promise.reject('No date selected');
        }
        
        try {
            await onShiftSelect(selectedDateForDialog, shiftType, slotIndex);
            return Promise.resolve(); 
        } catch (e) {
            logger.error('[CourierCalendar] Error calling original onShiftSelect:', e);
            return Promise.reject(e); 
        }
        
    }, [selectedDateForDialog, onShiftSelect]);

    // Обновляем handleDeleteShift: принимаем requesterId и вызываем deleteShiftAsSenior
    const handleDeleteShift = useCallback(async (shiftId: string, requesterId: string): Promise<any> => {
        logger.info(`[CourierCalendar] handleDeleteShift called for shift ID: ${shiftId} by requester ID: ${requesterId}`);
        // TODO: Добавить реальную обработку ошибок API?
        try {
            // Вызываем новую функцию API
            await deleteShiftAsSenior(shiftId, requesterId);
            logger.info(`[CourierCalendar] API call deleteShiftAsSenior for ${shiftId} successful.`);

            // Если API вызов успешен, удаляем локально
            // logger.info(`[CourierCalendar] ====> About to dispatch removeShiftLocally for ${shiftId}`);
            // dispatch(removeShiftLocally(shiftId));
            // logger.info(`[CourierCalendar] Successfully deleted shift ${shiftId} via API and dispatched removeShiftLocally.`);
            return Promise.resolve(); // Успех
        } catch (error: any) {
            logger.error(`[CourierCalendar] Error deleting shift ${shiftId} via API:`, error);
            // Возвращаем ошибку, чтобы ShiftSelectionDialog мог её обработать (показать уведомление)
            return Promise.reject(error); 
        }
    }, []); // Зависимость от requesterId здесь не нужна, т.к. он приходит аргументом

    // NEW Handler for Moving to Reserve (passed to ShiftSelectionDialog)
    const handleMoveToReserve = useCallback(async (shiftId: string, courierId: string): Promise<any> => {
        logger.info(`[CourierCalendar] handleMoveToReserve called for shift ID: ${shiftId}, Courier ID: ${courierId}`);
        // TODO: Add API call to move shift to reserve on the backend here
        try {
            // --- Replace with actual API call --- 
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate minimal delay
            // --- End Replace --- 

            // If API call is successful, dispatch action to remove from Redux state (assuming it's removed from shifts)
            // IMPORTANT: Backend should handle adding to reserve list. We only remove from shifts locally.
            dispatch(removeShiftLocally(shiftId)); 
            logger.info(`[CourierCalendar] Successfully moved shift ${shiftId} to reserve (locally removed) after simulated backend call.`);
            return Promise.resolve(); // Indicate success
        } catch (error) {
            logger.error(`[CourierCalendar] Error moving shift ${shiftId} to reserve:`, error);
            // TODO: Handle API error
            return Promise.reject(error); // Indicate failure
        }
    }, [dispatch]);

    // Handler for showing notifications
    const handleShowNotification = useCallback((type: NotificationTypes, message: string, title?: string) => {
        logger.info(`[CourierCalendar] Dispatching notification: ${type} - ${message}`);
        dispatch(addNotification({ type, message, title, isToast: true }));
    }, [dispatch]);

    // <<< Объединяем все условия загрузки >>>
    const combinedIsLoading = forceLoading || (isShiftsLoading || isReservesLoading);

    const combinedError = shiftsError || reservesError;

    // <<< Теперь рендерим ОСНОВНУЮ СТРУКТУРУ ВСЕГДА >>>
    return (
        <>
            <CalendarContainer 
                ref={calendarRef} 
                className={isIOSDevice ? 'ios-scroll-container' : ''}
                style={{ filter: combinedIsLoading ? 'blur(12px)' : 'none', pointerEvents: combinedIsLoading ? 'none' : 'auto' }}
            >
                {/* <<< УБИРАЕМ УСЛОВНЫЙ РЕНДЕРИНГ >>> */}
                {/* {!combinedIsLoading && ( */} 
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
                {/* )} */} 
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
                />
            )}

            {/* <<< РЕНДЕРИМ ОВЕРЛЕЙ, ЕСЛИ НЕТ ОШИБКИ, И ПЕРЕДАЕМ ВИДИМОСТЬ ЧЕРЕЗ ПРОПС >>> */}
            {!combinedError && <LoadingOverlay isVisible={combinedIsLoading} />}

            {/* <<< УСЛОВНО РЕНДЕРИМ ОШИБКУ ПОВЕРХ (можно стилизовать лучше) >>> */}
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