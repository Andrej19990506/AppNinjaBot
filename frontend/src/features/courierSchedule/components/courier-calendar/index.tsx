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
import { FrozenShiftsBanner } from '@features/courierSchedule/components/FrozenShiftsBanner';
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
import { selectSelectedChatId } from '@shared/store/chatSlice/chatSelectors';

const CourierCalendar: React.FC<CalendarProps> = ({
    currentUserId,
    currentUserAvatar,
    currentUserName,
    isCurrentUserSenior,
    chatId: propChatId,
    onShiftSelect,
    onOpenProfile,
    onOpenShiftTemplateSettings
}) => {

    const [forceLoading, setForceLoading] = useState(false);
    
    const dispatch = useAppDispatch();
    const slotConfig = useSelector((state: RootState) => selectSlotConfig(state));
    const usersById = useAppSelector(selectUsersById);
    
    const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);

    const calendarRef = useRef<HTMLDivElement>(null);
    const isIOSDevice = isIOS();

    const accessSettings = useAccessSettingsSync(() => {});

    const selectedChatId = useAppSelector(selectSelectedChatId);
    const chatId = propChatId || selectedChatId || '';

    const {
        shifts,
        isLoading: isShiftsLoading,
        error: shiftsError,
        currentMonth,
        getShiftsForDate,
        hasUserShift,
    } = useCalendarData(currentUserId, chatId);

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
    } = useReserveManagement(currentUserId, chatId);

    useAvailabilityCheck(chatId || '', () => {});

    useEffect(() => {
        if (chatId) {
            dispatch(fetchAccessSettings({ chatId }));
        } else {
        }
    }, [dispatch, chatId]);

    useCourierWebSocketSync(chatId);

    const handleDayClick = useCallback((date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const jsDate = new Date(date);
        const dayOfWeek = jsDate.getDay();

        if (accessSettings ? isDateAvailable(date, currentUserId, accessSettings) : false) {
            // Устанавливаем дату для диалога
            setSelectedDateForDialog(date);
            
            // Загружаем шаблоны для конкретной даты при открытии диалога
            // Это гарантирует, что версия шаблона будет применена для этой даты
            if (chatId) {
                const dateStr = format(date, 'yyyy-MM-dd');
                import('@features/courierSchedule/store/shiftsSlice/shiftTemplatesThunks').then(({ fetchAllShiftTemplatesThunk }) => {
                    dispatch(fetchAllShiftTemplatesThunk({ 
                        chatId: Number(chatId), 
                        forDate: dateStr 
                    }));
                });
            }
            
            // Добавляем проверку даты прямо после установки
            const selectedDate = new Date(date);
            selectedDate.setDate(selectedDate.getDate() + 1);
            
        }
    }, [accessSettings, currentUserId, chatId, dispatch]);

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
            
            // Загружаем шаблоны для новой даты при изменении даты в диалоге
            // Это гарантирует, что версия шаблона будет применена для этой даты
            if (chatId) {
                const dateStr = format(newDate, 'yyyy-MM-dd');
                import('@features/courierSchedule/store/shiftsSlice/shiftTemplatesThunks').then(({ fetchAllShiftTemplatesThunk }) => {
                    dispatch(fetchAllShiftTemplatesThunk({ 
                        chatId: Number(chatId), 
                        forDate: dateStr 
                    }));
                });
            }
        } else {
            // Если дата недоступна, показываем уведомление
            dispatch(addNotification({ 
                type: NotificationTypes.WARNING, 
                message: 'Запись на эту дату недоступна', 
                isToast: true 
            }));
        }
    }, [accessSettings, currentUserId, chatId, dispatch]);
    
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
        if (!selectedDateForDialog) return [];
        return getShiftsForDate(selectedDateForDialog);
    }, [selectedDateForDialog, getShiftsForDate]);


    const handleDialogShiftSelect = useCallback(async (
        templateId: string,
        slotIndex: number,
        existingShiftId?: string,
        isDragAction?: boolean
    ): Promise<any> => {
        if (!selectedDateForDialog) {
            return Promise.reject('No date selected');
        }
        
        try {
            await onShiftSelect(selectedDateForDialog, templateId, slotIndex);
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

    // Проверяем заблокирован ли доступ
    const isFrozen = accessSettings?.isAccessBlocked || false;
    
    // Функция для проверки, заморожена ли конкретная дата
    const isDateFrozen = useCallback((date: Date): boolean => {
        // Сначала проверяем есть ли смена у ТЕКУЩЕГО пользователя на эту дату
        if (!hasUserShift(date)) {
            return false; // Нет смены - нет треугольника
        }
        
        // Если доступ не заблокирован - смены не заморожены
        if (!isFrozen || !accessSettings) {
            console.log('[isDateFrozen] Доступ не заблокирован или нет настроек', { isFrozen, hasAccessSettings: !!accessSettings });
            return false;
        }
        
        const nextOpeningDate = accessSettings.nextOpeningDate;
        const periodLength = accessSettings.periodLength || 7;
        const offsetAmount = accessSettings.offsetAmount || 0;
        
        if (!nextOpeningDate) {
            console.log('[isDateFrozen] Нет nextOpeningDate, показываем все как замороженные');
            return true; // Если нет даты следующего открытия - все заморожено
        }
        
        try {
            const checkDate = new Date(date);
            
            // ✅ Сначала устанавливаем UTC для checkDate для корректного сравнения
            checkDate.setUTCHours(0, 0, 0, 0);
            
            const now = new Date();
            now.setUTCHours(0, 0, 0, 0);
            
            // ✅ Если дата в прошлом - НЕ показываем треугольник (только будущие смены могут быть конфликтными)
            if (checkDate <= now) {
                console.log('[isDateFrozen] Дата в прошлом или сегодня, не показываем треугольник', {
                    checkDate: checkDate.toISOString().split('T')[0],
                    now: now.toISOString().split('T')[0]
                });
                return false;
            }
            
            // Вычисляем период смен по новым правилам
            const activeStartDate = accessSettings.activeStartDate;
            if (!activeStartDate) {
                // Нет activeStartDate - все заморожено
                console.log('[isDateFrozen] Нет activeStartDate, все заморожено');
                return true;
            }
            
            // ✅ Парсим дату в UTC, чтобы избежать проблем с часовыми поясами (как на бэкенде)
            // Формат: '2026-01-31' -> Date в UTC
            const activeStart = new Date(activeStartDate + 'T00:00:00Z');
            
            // Начало периода смен = activeStartDate + offsetAmount (в UTC, как на бэкенде)
            const newPeriodStart = new Date(activeStart);
            newPeriodStart.setUTCDate(newPeriodStart.getUTCDate() + offsetAmount);
            
            const newPeriodEnd = new Date(newPeriodStart);
            newPeriodEnd.setUTCDate(newPeriodEnd.getUTCDate() + periodLength);
            
            // Проверяем попадает ли смена в новый период
            const isInNewPeriod = checkDate >= newPeriodStart && checkDate < newPeriodEnd;
            
            // Вычисляем, является ли смена конфликтной (как на бэкенде)
            const isBeforePeriod = checkDate < newPeriodStart;
            const isAfterOrEqualPeriod = checkDate >= newPeriodEnd;
            const isConflicting = isBeforePeriod || isAfterOrEqualPeriod;
            
            console.log('[isDateFrozen] Проверка периода:', {
                date: checkDate.toISOString().split('T')[0],
                activeStartDate: activeStartDate,
                periodStart: newPeriodStart.toISOString().split('T')[0],
                periodEnd: newPeriodEnd.toISOString().split('T')[0],
                periodLength,
                offsetAmount,
                isInNewPeriod,
                isBeforePeriod,
                isAfterOrEqualPeriod,
                isConflicting: !isInNewPeriod
            });
            
            if (isInNewPeriod) {
                // Смена в новом периоде - БЕЗ треугольника (валидная смена)
                return false;
            }
            
            // Смена ВНЕ нового периода - конфликт! С треугольником
            console.log('[isDateFrozen] ✅ Конфликт: смена вне периода', {
                date: checkDate.toISOString().split('T')[0],
                periodStart: newPeriodStart.toISOString().split('T')[0],
                periodEnd: newPeriodEnd.toISOString().split('T')[0]
            });
            return true;
        } catch (e) {
            console.error('[isDateFrozen] Ошибка:', e);
            return false;
        }
    }, [isFrozen, accessSettings, hasUserShift]);

    // Проверяем есть ли хотя бы одна конфликтная смена у текущего пользователя
    const hasConflictingShifts = useMemo(() => {
        if (!accessSettings?.isAccessBlocked) {
            console.log('[hasConflictingShifts] Доступ не заблокирован, конфликтов нет');
            return false;
        }
        
        // Проходим по всем сменам текущего пользователя
        const userShifts = shifts.filter(shift => String(shift.userId) === String(currentUserId));
        
        // Логируем ВСЕ смены в группе для диагностики
        const allShiftsDates = shifts.map(s => new Date(s.date).toISOString().split('T')[0]).sort();
        console.log('[hasConflictingShifts] ВСЕ смены в группе (для диагностики):', {
            total: shifts.length,
            allDates: allShiftsDates.join(', '),
            userShiftsCount: userShifts.length
        });
        
        // Вычисляем период для логирования
        const activeStartDate = accessSettings.activeStartDate;
        const offsetAmount = accessSettings.offsetAmount || 0;
        const periodLength = accessSettings.periodLength || 7;
        
        let periodInfo = 'N/A';
        if (activeStartDate) {
            const activeStart = new Date(activeStartDate + 'T00:00:00Z');
            const newPeriodStart = new Date(activeStart);
            newPeriodStart.setUTCDate(newPeriodStart.getUTCDate() + offsetAmount);
            const newPeriodEnd = new Date(newPeriodStart);
            newPeriodEnd.setUTCDate(newPeriodEnd.getUTCDate() + periodLength);
            periodInfo = `${newPeriodStart.toISOString().split('T')[0]} - ${newPeriodEnd.toISOString().split('T')[0]}`;
        }
        
        // Сортируем смены по дате для удобства
        const sortedShifts = [...userShifts].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateA - dateB;
        });
        
        console.log('[hasConflictingShifts] Смены текущего пользователя:', {
            total: userShifts.length,
            period: periodInfo,
            allDates: sortedShifts.map(s => new Date(s.date).toISOString().split('T')[0]).join(', '),
            shifts: sortedShifts.map(s => ({ 
                date: s.date, 
                id: s.id,
                dateStr: new Date(s.date).toISOString().split('T')[0]
            }))
        });
        
        // ✅ Фильтруем только будущие смены (прошедшие и сегодняшние не могут быть конфликтными)
        const now = new Date();
        now.setUTCHours(0, 0, 0, 0);
        
        const futureShifts = userShifts.filter(shift => {
            const shiftDate = new Date(shift.date);
            shiftDate.setUTCHours(0, 0, 0, 0);
            return shiftDate > now; // Только будущие смены
        });
        
        // Проверяем есть ли хотя бы одна замороженная среди будущих смен
        const conflictingShifts = futureShifts.filter(shift => {
            const shiftDate = new Date(shift.date);
            const isFrozen = isDateFrozen(shiftDate);
            return isFrozen;
        });
        
        // Логируем все конфликтные смены отдельно
        if (conflictingShifts.length > 0) {
            console.log('[hasConflictingShifts] ✅ Найдены конфликтные смены:', conflictingShifts.map(s => ({
                date: s.date,
                dateStr: new Date(s.date).toISOString().split('T')[0],
                id: s.id
            })));
        } else {
            console.log('[hasConflictingShifts] ❌ Конфликтных смен не найдено. Все смены попадают в период:', periodInfo);
        }
        
        const result = conflictingShifts.length > 0;
        console.log('[hasConflictingShifts] Результат:', {
            totalUserShifts: userShifts.length,
            conflictingShifts: conflictingShifts.length,
            hasConflicting: result,
            isAccessBlocked: accessSettings?.isAccessBlocked,
            activeStartDate: accessSettings?.activeStartDate
        });
        
        return result;
    }, [shifts, currentUserId, isDateFrozen, accessSettings?.isAccessBlocked]);

    console.log('[CourierCalendar] hasConflictingShifts:', hasConflictingShifts, 'isAccessBlocked:', accessSettings?.isAccessBlocked);

    return (
        <>
            <CalendarContainer 
                ref={calendarRef} 
                className={isIOSDevice ? 'ios-scroll-container' : ''}
                style={{ filter: combinedIsLoading ? 'blur(12px)' : 'none', pointerEvents: combinedIsLoading ? 'none' : 'auto' }}
            >
                    {hasConflictingShifts && (
                        <div style={{ padding: '16px 16px 0 16px' }}>
                            <FrozenShiftsBanner 
                                nextOpeningDate={accessSettings?.nextOpeningDate}
                                reason="Правила записи изменены. Ваши смены, не попадающие в новый график, временно заморожены до следующего открытия доступа."
                            />
                        </div>
                    )}
                    <MonthsContainer>
                        {monthsToDisplay.map((month) => (
                            <MonthContainer key={format(month, 'yyyy-MM')}>
                                <MonthSection
                                    month={month}
                                    onDayClick={handleDayClick}
                                    getShiftsForDate={getShiftsForDate}
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
                                    isDateFrozen={isDateFrozen}
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
                    shifts={selectedDateShifts}
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
                    onOpenShiftTemplateSettings={onOpenShiftTemplateSettings}
                />
            )}

            {!combinedError && <LoadingOverlay isVisible={combinedIsLoading} />}


            {combinedError && !combinedError.includes('Настройки группы не настроены') && (
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