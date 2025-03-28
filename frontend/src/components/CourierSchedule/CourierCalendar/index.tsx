import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { CalendarProps } from './types';
import { useCalendarData } from './hooks/useCalendarData';
import { useReserveManagement } from './hooks/useReserveManagement';
import { useShiftManagement } from './hooks/useShiftManagement';
import { isDateAvailable, calculateAvailableDates } from './utils/dateUtils';
import { applyIOSFixes, isIOS } from './utils/touchUtils';
import LoadingOverlay from '../LoadingOverlay';
import ShiftSelectionDialog from '../ShiftSelectionDialog';
import { CalendarContainer, MonthsContainer, MonthContainer } from './styles';
import { SLOTS_CONFIG } from './constants';
import CalendarHeader from './components/CalendarHeader';
import MonthSection from './components/MonthSection';
import { useAvailabilityCheck } from './hooks/useAvailabilityCheck';
import { useAccessSettingsSync } from './hooks/useAccessSettingsSync';
import { fetchAccessSettings } from '../../../store/slices/shiftsSlice';
import { AnyAction } from 'redux';

const CourierCalendar: React.FC<CalendarProps> = ({
    onShiftSelect,
    selectedDate,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onClose,
    chatId
}) => {
    const dispatch = useDispatch();
    
    // Состояние
    const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);
    const isIOSDevice = isIOS();
    const [availableDates, setAvailableDates] = useState<string[]>([]); 
    const [forceUpdate, setForceUpdate] = useState<number>(0);

    // Функция для принудительного обновления компонента
    const refreshCalendar = useCallback(() => {
        setForceUpdate(prev => prev + 1);
    }, []);
    
    // Используем наш новый хук для синхронизации настроек
    const accessSettings = useAccessSettingsSync(refreshCalendar);

    // Блокируем масштабирование при скролле на iOS
    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (isIOSDevice && e.touches.length > 1) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, [isIOSDevice]);

    // Применяем исправления для iOS при монтировании компонента
    useEffect(() => {
        applyIOSFixes();
        
        // Дополнительный фикс для iOS Safari
        if (isIOSDevice && calendarRef.current) {
            // Добавляем стили для предотвращения зума
            const style = document.createElement('style');
            style.innerHTML = `
                body, html {
                    height: 100% !important;
                    overflow: hidden !important;
                    position: fixed !important;
                    width: 100% !important;
                    touch-action: manipulation !important;
                }
                
                .calendar-container {
                    height: 100% !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                    touch-action: pan-y !important;
                }
                
                [class*="EmptySlotIndicator"],
                [class*="OccupiedSlotIndicator"],
                [class*="ReserveSlotIndicator"] {
                    touch-action: none !important;
                    pointer-events: none !important;
                }
            `;
            document.head.appendChild(style);
            
            // Добавляем класс для CSS-селекторов
            calendarRef.current.classList.add('calendar-container');
            
            // Добавляем атрибут, отключающий масштабирование
            document.body.setAttribute('ontouchmove', 'event.preventDefault();');
        }
        
        return () => {
            // Очищаем атрибут при размонтировании
            document.body.removeAttribute('ontouchmove');
        };
    }, [isIOSDevice]);

    // Загружаем настройки доступа при монтировании компонента
    useEffect(() => {
        console.log('🔍 Загрузка настроек доступа при монтировании календаря');
        // @ts-ignore: игнорируем ошибку типа для диспетчера
        dispatch(fetchAccessSettings({ chatId }));
    }, [dispatch, chatId]);

    // Принудительно обновляем календарь при изменении настроек
    useEffect(() => {
        if (accessSettings && accessSettings.lastUpdated) {
            console.log('🔄 Настройки доступа изменились, обновляем календарь');
            console.log('📅 Новые настройки:', accessSettings);
            refreshCalendar();
        }
    }, [accessSettings, refreshCalendar]);

    // После эффекта для загрузки настроек доступа добавляем новый эффект
    useEffect(() => {
        if (accessSettings) {
            console.log('📊 Настройки доступа в календаре:', accessSettings);
            
            // Проверка получения актуальных настроек
            console.log('📊 Проверка актуальности настроек:');
            console.log(`📆 registrationStartDay: ${accessSettings.registrationStartDay}`);
            console.log(`⏰ registrationStartHour: ${accessSettings.registrationStartHour}`);
            console.log(`⏰ registrationStartMinute: ${accessSettings.registrationStartMinute}`);
            console.log(`📏 offsetType: ${accessSettings.offsetType}`);
            console.log(`📏 offsetAmount: ${accessSettings.offsetAmount}`);
            console.log(`📅 lastUpdated: ${accessSettings.lastUpdated}`);
            
            // Проверяем текущий день и день открытия регистрации
            const now = new Date();
            const dayOfWeek = now.getDay();
            const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
            
            console.log(`⏰ Текущий день недели: ${dayOfWeek} (${dayNames[dayOfWeek]})`);
            console.log(`📅 День открытия регистрации: ${accessSettings.registrationStartDay ?? 4} (${dayNames[(accessSettings.registrationStartDay ?? 4) % 7]})`);
            
            // Принудительно вызываем пересчет доступных дат после загрузки настроек
            if (forceUpdate === 0) {
                console.log('🔄 Запускаем принудительное обновление календаря после загрузки настроек');
                refreshCalendar();
            }
        } else {
            console.log('❌ Настройки доступа не загружены в календаре');
        }
    }, [accessSettings, forceUpdate, refreshCalendar]);

    // Хуки для управления данными и действиями
    const {
        shifts,
        isLoading,
        error,
        currentMonth,
        setCurrentMonth,
        getDayShifts,
        getNightShifts,
        hasUserShift,
        refetchData
    } = useCalendarData(currentUserId);

    // Обновляем данные календаря при изменении настроек
    useEffect(() => {
        if (forceUpdate > 0) {
            refetchData();
        }
    }, [forceUpdate, refetchData]);

    const {
        reserves,
        getReservesForDate,
        userIsInReserve,
        handleAddToReserve,
        handleCancelReserve
    } = useReserveManagement(currentUserId, chatId);

    const { handleShiftSelect } = useShiftManagement(currentUserId, chatId);

    // Добавляем хук для проверки доступности
    const { refreshCalendar: refreshFromWebSocket } = useAvailabilityCheck(chatId, refreshCalendar);

    // Обработчики
    const handleDayClick = useCallback((date: Date) => {
        if (selectedDateForDialog && 
            selectedDateForDialog.getTime() === date.getTime()) {
            return;
        }
        
        // Передаем userId и accessSettings в функцию isDateAvailable для учета актуальных настроек
        if (isDateAvailable(date, currentUserId, accessSettings)) {
            setSelectedDateForDialog(date);
        }
    }, [selectedDateForDialog, currentUserId, accessSettings]);

    const handleCloseDialog = useCallback(() => {
        setSelectedDateForDialog(null);
    }, []);

    // Обработчик для диалога выбора смены
    const handleShiftDialogSelect = useCallback(async (
        shiftType: 'day' | 'night',
        slotIndex: number,
        existingShiftId?: string,
        isDragAction?: boolean
    ) => {
        if (!selectedDateForDialog) return;
        return handleShiftSelect(selectedDateForDialog, shiftType, slotIndex, existingShiftId, isDragAction);
    }, [selectedDateForDialog, handleShiftSelect]);

    // Если загружаем данные впервые, показываем оверлей
    if (isLoading && !shifts.length) {
        return <LoadingOverlay />;
    }

    if (error) {
        return <div>Ошибка: {error}</div>;
    }

    // Получаем список месяцев для отображения
    const months = Array.from({ length: 12 }, (_, i) => 
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i, 1)
    );

    return (
        <CalendarContainer 
            ref={calendarRef} 
            onTouchMove={handleTouchMove}
        >
            <CalendarHeader onClose={onClose} />
            
            {/* Компонент уведомления о WebSocket обновлениях */}
            <div id="ws-notification" className="ws-notification" style={{ display: 'none', position: 'fixed', top: '10px', right: '10px', padding: '10px', background: '#4CAF50', color: 'white', borderRadius: '4px', zIndex: 1000 }}>
                <span id="ws-notification-message">Получено обновление</span>
            </div>
            
            <MonthsContainer>
                {months.map((month) => (
                    <MonthContainer key={`${month.getFullYear()}-${month.getMonth()}`}>
                        <MonthSection
                            month={month}
                            selectedDate={selectedDate || null}
                            onDayClick={handleDayClick}
                            getDayShifts={(date: Date) => getDayShifts(date).map(shift => ({
                                ...shift,
                                photo_url: shift.photo_url || undefined
                            }))}
                            getNightShifts={(date: Date) => getNightShifts(date).map(shift => ({
                                ...shift,
                                photo_url: shift.photo_url || undefined
                            }))}
                            hasUserShift={hasUserShift}
                            userIsInReserve={userIsInReserve}
                            currentUserAvatar={currentUserAvatar}
                            currentUserId={currentUserId}
                            accessSettings={accessSettings}
                        />
                    </MonthContainer>
                ))}
            </MonthsContainer>

            {selectedDateForDialog && (
                <ShiftSelectionDialog
                    isOpen={true}
                    onClose={handleCloseDialog}
                    date={selectedDateForDialog}
                    dayShifts={getDayShifts(selectedDateForDialog)}
                    nightShifts={getNightShifts(selectedDateForDialog)}
                    maxDaySlots={4}
                    maxNightSlots={2}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    currentUserName={currentUserName}
                    onSlotSelect={handleShiftDialogSelect}
                    onReserveSelect={() => handleAddToReserve(selectedDateForDialog)}
                    onCancelReserve={handleCancelReserve}
                    reserves={getReservesForDate(selectedDateForDialog)}
                    chatId={chatId}
                />
            )}
        </CalendarContainer>
    );
};

// Экспортируем компонент
export { CourierCalendar }; 