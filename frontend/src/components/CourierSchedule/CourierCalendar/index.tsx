import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
import CalendarHeader from './components/CalendarHeader';
import MonthSection from './components/MonthSection';
import { useAvailabilityCheck } from './hooks/useAvailabilityCheck';
import { useAccessSettingsSync } from './hooks/useAccessSettingsSync';
import { fetchAccessSettings } from '../../../store/slices/shiftsSlice';
import { useWebSocketConnection } from '../../../hooks/useWebSocketConnection';
import { logger } from '../../../utils/logger';

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
    const { subscribe, socketState } = useWebSocketConnection();
    
    // Состояние
    const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
    const [, setIsDialogClosing] = useState(false);
    const [shouldRenderDialog, setShouldRenderDialog] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);
    const isIOSDevice = isIOS();
    const [forceUpdate, setForceUpdate] = useState<number>(0);

    // Функция для принудительного обновления компонента
    const refreshCalendar = useCallback(() => {
        logger.log('[CourierCalendar] Вызов refreshCalendar для обновления');
        setForceUpdate(prev => prev + 1);
    }, []);
    
    // Используем наш новый хук для синхронизации настроек
    const accessSettings = useAccessSettingsSync(refreshCalendar);

    // Функция для принудительного обновления компонента
    useEffect(() => {
        if (socketState.isConnected && chatId) {
            logger.log(`[CourierCalendar] Подписка на 'registration_opened' для chatId: ${chatId}`);
            const unsubscribe = subscribe<{ chat_id: string; type: string; source: string }>('registration_opened', (data) => {
                logger.log('[CourierCalendar] Получено событие registration_opened:', data);
                if (data.chat_id === chatId) {
                    logger.info(`[CourierCalendar] Событие для нашего чата (${chatId})! Вызываем refreshCalendar.`);
                    refreshCalendar();
                } else {
                    logger.log(`[CourierCalendar] Событие для другого чата (${data.chat_id}), игнорируем.`);
                }
            });

            return () => {
                logger.log(`[CourierCalendar] Отписка от 'registration_opened' для chatId: ${chatId}`);
                unsubscribe();
            };
        }
    }, [socketState.isConnected, chatId, subscribe, refreshCalendar]);

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
            // Добавляем стили для предотвращения зума, но сохраняем интерактивность
            const style = document.createElement('style');
            style.innerHTML = `
                .calendar-container {
                    height: 100% !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                    touch-action: pan-y pinch-zoom !important;
                }
                
                [class*="EmptySlotIndicator"],
                [class*="OccupiedSlotIndicator"],
                [class*="ReserveSlotIndicator"] {
                    touch-action: auto !important;
                    pointer-events: auto !important;
                }
            `;
            document.head.appendChild(style);
            
            // Добавляем класс для CSS-селекторов
            calendarRef.current.classList.add('calendar-container');
            
            return () => {
                // Удаляем стили при размонтировании
                style.remove();
            };
        }
    }, [isIOSDevice]);

    // Хуки для управления данными и действиями
    const {
        shifts,
        isLoading,
        error,
        currentMonth,
        getDayShifts,
        getNightShifts,
        hasUserShift,
        refetchData
    } = useCalendarData(currentUserId);

    const {
        getReservesForDate,
        userIsInReserve,
        handleAddToReserve,
        handleCancelReserve
    } = useReserveManagement(currentUserId, chatId || '');

    const { handleShiftSelect } = useShiftManagement(currentUserId, chatId || '');

    // Убираем неиспользуемое значение из деструктуризации
    useAvailabilityCheck(chatId || '', refreshCalendar);

    // Загружаем настройки доступа при монтировании компонента
    useEffect(() => {
        if (chatId) {
            console.log(`🔍 Загрузка настроек доступа для chatId ${chatId} при монтировании календаря`);
            // @ts-ignore: игнорируем ошибку типа для диспетчера
            dispatch(fetchAccessSettings({ chatId }));
        } else {
            console.warn('⚠️ chatId не определен при монтировании календаря, настройки доступа не загружены.');
        }
    }, [dispatch, chatId]);

    // Оптимизируем обработку настроек
    useEffect(() => {
        if (!accessSettings) {
            console.log('❌ Настройки доступа не загружены в календаре');
            return;
        }

        console.log('📊 Настройки доступа в календаре:', accessSettings);
        
        // Проверяем, действительно ли настройки изменились
        const hasSettingsChanged = accessSettings.lastUpdated !== undefined;
        
        if (hasSettingsChanged) {
            console.log('🔄 Настройки доступа изменились, планируем обновление календаря');
            
            // Используем requestAnimationFrame для плавного обновления
            const frameId = requestAnimationFrame(() => {
                console.log('🎨 Обновляем календарь в следующем кадре');
                // Добавляем небольшую задержку для предотвращения блокировки
                setTimeout(() => {
                    refreshCalendar();
                }, 50);
            });
            
            return () => cancelAnimationFrame(frameId);
        }
    }, [accessSettings, refreshCalendar]);

    // Оптимизируем обновление данных календаря
    useEffect(() => {
        if (forceUpdate > 0 && accessSettings) {
            console.log('🔄 Запуск обновления данных календаря');
            
            // Увеличиваем задержку и добавляем промежуточное состояние
            const timeoutId = setTimeout(() => {
                console.log('📊 Обновляем данные календаря');
                // Используем Promise для асинхронного обновления
                Promise.resolve().then(() => {
                    refetchData();
                });
            }, 200);
            
            return () => {
                console.log('🧹 Очистка таймера обновления данных');
                clearTimeout(timeoutId);
            };
        }
    }, [forceUpdate, refetchData, accessSettings]);

    // Не сохраняем результат, если он не используется
    useMemo(() => {
        if (!accessSettings) return [];
        return calculateAvailableDates(accessSettings);
    }, [accessSettings]);

    // Обработчики
    const handleDayClick = useCallback((date: Date) => {
        if (selectedDateForDialog && 
            selectedDateForDialog.getTime() === date.getTime()) {
            return;
        }
        
        // Проверяем доступность даты с учетом мемоизированных настроек
        if (isDateAvailable(date, currentUserId, accessSettings)) {
            setSelectedDateForDialog(date);
        }
    }, [selectedDateForDialog, currentUserId, accessSettings]);

    // Обработчик закрытия диалога
    const handleCloseDialog = useCallback(() => {
        setIsDialogClosing(true);
        // Даем время на анимацию закрытия
        setTimeout(() => {
            setIsDialogClosing(false);
            setShouldRenderDialog(false);
            setSelectedDateForDialog(null);
        }, 300);
    }, []);

    // Обновляем shouldRenderDialog при изменении selectedDateForDialog
    useEffect(() => {
        if (selectedDateForDialog) {
            setShouldRenderDialog(true);
        }
    }, [selectedDateForDialog]);

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

            {shouldRenderDialog && (
                <ShiftSelectionDialog
                    isOpen={true}
                    onClose={handleCloseDialog}
                    date={selectedDateForDialog!}
                    dayShifts={getDayShifts(selectedDateForDialog!)}
                    nightShifts={getNightShifts(selectedDateForDialog!)}
                    maxDaySlots={4}
                    maxNightSlots={2}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    currentUserName={currentUserName}
                    onSlotSelect={handleShiftDialogSelect}
                    onReserveSelect={() => handleAddToReserve(selectedDateForDialog!)}
                    onCancelReserve={handleCancelReserve}
                    reserves={getReservesForDate(selectedDateForDialog!)}
                    chatId={chatId}
                />
            )}
        </CalendarContainer>
    );
};

// Экспортируем компонент
export { CourierCalendar }; 