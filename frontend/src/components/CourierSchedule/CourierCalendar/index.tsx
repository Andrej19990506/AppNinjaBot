import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../../../store/hooks';
import { CalendarProps } from './types';
import { useCalendarData } from './hooks/useCalendarData';
import { useReserveManagement } from './hooks/useReserveManagement';
import { isDateAvailable } from './utils/dateUtils';
import { isIOS } from './utils/touchUtils';
import LoadingOverlay from '../LoadingOverlay';
import { CalendarContainer, MonthsContainer, MonthContainer } from './styles';
import MonthSection from './components/MonthSection';
import { useAvailabilityCheck } from './hooks/useAvailabilityCheck';
import { useAccessSettingsSync } from './hooks/useAccessSettingsSync';
import { fetchAccessSettings, selectSlotConfig } from '../../../store/slices/shiftsSlice';
import { logger } from '../../../utils/logger';
import { format } from 'date-fns';
import { RootState } from '../../../store/store';
import ShiftSelectionDialog from '../ShiftSelectionDialog';

const CourierCalendar: React.FC<CalendarProps> = ({
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onClose,
    chatId,
    onShiftSelect
}) => {
    const dispatch = useAppDispatch();
    const slotConfig = useSelector((state: RootState) => selectSlotConfig(state));
    
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

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (isIOSDevice && e.touches.length > 1) {
            e.stopPropagation();
        }
    }, [isIOSDevice]);

    useEffect(() => {
        if (isIOSDevice && calendarRef.current) {
            const style = document.createElement('style');
            style.innerHTML = `
                .calendar-container { height: 100% !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; touch-action: pan-y pinch-zoom !important; }
                [class*="EmptySlotIndicator"], [class*="OccupiedSlotIndicator"], [class*="ReserveSlotIndicator"] { touch-action: auto !important; pointer-events: auto !important; }
            `;
            document.head.appendChild(style);
            calendarRef.current.classList.add('calendar-container');
            return () => { style.remove(); };
        }
    }, [isIOSDevice]);

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

    const combinedIsLoading = isShiftsLoading || isReservesLoading;

    if (combinedIsLoading && !shifts.length) {
        return <LoadingOverlay />;
    }

    const combinedError = shiftsError || reservesError;
    if (combinedError) {
        return <div>Ошибка: {combinedError}</div>;
    }

    return (
        <>
            <CalendarContainer ref={calendarRef} onTouchMove={handleTouchMove} className={isIOSDevice ? 'ios-scroll-container' : ''}>
                  
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
                            />
                        </MonthContainer>
                    ))}
                </MonthsContainer>
            </CalendarContainer>

            {selectedDateForDialog && (
                <ShiftSelectionDialog
                    isOpen={!!selectedDateForDialog}
                    onClose={handleCloseShiftDialog}
                    date={selectedDateForDialog}
                    dayShifts={selectedDateShifts.dayShifts}
                    nightShifts={selectedDateShifts.nightShifts}
                    slotConfig={slotConfig}
                    currentUserId={currentUserId}
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
                />
            )}
        </>
    );
};

export default CourierCalendar; 