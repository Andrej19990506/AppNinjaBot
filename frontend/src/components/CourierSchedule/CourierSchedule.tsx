import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import CourierProfile from '../CourierProfile/CourierProfile';
import CourierProfileDialog from './CourierProfileDialog';
import CourierCalendar from './CourierCalendar/index';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';
import { bookShift } from '../../store/slices/shiftsSlice';
import { fetchSlotConfig } from '../../store/slices/shiftsSlice';
import { format } from 'date-fns';
import { ShiftAccessModalRef } from '../CourierProfile/ShiftAccessModal';
import SettingsPanel from '../CourierProfile/SettingsPanel';
import Footer from '../Inventory/Footer';
import SlotSettings, { SlotSettingsRef } from './CourierCalendar/components/SlotSettings';
import { SettingsOverlay as ModalBackdropOverlay } from './CourierCalendar/styles';
import ShiftAccessModal from '../CourierProfile/ShiftAccessModal';
import CouriersList from './CouriersList';
import TimesheetPreview from '../CourierProfile/TimesheetPreview';
// <<< Импортируем типы для табеля >>>
import { TimesheetResponse } from '../../types/timesheet';
// <<< Импортируем НОВУЮ API функцию и УДАЛЯЕМ старую >>>
import { getTimesheetData, requestTimesheetViaBot } from '../../services/courierApi';
// <<< Добавляем импорт типа конфига слотов из Redux >>>
// import { WeeklySlotConfig } from '../../store/slices/shiftsSlice'; // <<< УБИРАЕМ НЕИСПОЛЬЗУЕМЫЙ ИМПОРТ
// <<< Импортируем тип SelectedPeriod >>>
import type { SelectedPeriod } from '../CourierProfile/TimesheetPreview';

const Container = styled.div`
    padding: 20px;
    max-width: 1200px;
    margin: 80px auto 0 auto;
    color: var(--text-color);
`;

const Header = styled.div`
    margin-bottom: 24px;
    text-align: center;
`;

const Title = styled.h1`
    font-size: 2rem;
    margin: 0;
    color: var(--text-color);
    margin-bottom: 8px;
`;

const Subtitle = styled.p`
    color: var(--text-secondary);
    margin: 0;
    font-size: 1rem;
`;

const CourierSchedule: React.FC = () => {
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.user.user);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const [showCalendar, setShowCalendar] = useState(true);
    const [showShiftAccessSettings, setShowShiftAccessSettings] = useState(false);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const [showSlotSettings, setShowSlotSettings] = useState(false);
    const [selectedDayIndexForSlots, setSelectedDayIndexForSlots] = useState<number | null>(null);
    const [isSlotSettingsDirty, setIsSlotSettingsDirty] = useState(false);
    const [isShiftAccessDirty, setIsShiftAccessDirty] = useState(false);
    const [currentModalStep, setCurrentModalStep] = useState(1);
    const shiftAccessModalRef = useRef<ShiftAccessModalRef>(null);
    const slotSettingsRef = useRef<SlotSettingsRef>(null);
    
    // <<< Состояния для Табеля >>>
    const [isTimesheetLoading, setIsTimesheetLoading] = useState(false);
    const [timesheetData, setTimesheetData] = useState<TimesheetResponse | null>(null);
    const [isTimesheetPreviewVisible, setIsTimesheetPreviewVisible] = useState(false);
    const [timesheetError, setTimesheetError] = useState<string | null>(null);
    // <<< ДОБАВЛЯЕМ STATE ДЛЯ ВЫБРАННОГО ПЕРИОДА >>>
    const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>({ 
        type: 'month', 
        year: new Date().getFullYear(), 
        month: new Date().getMonth() 
    });

    // Новые состояния для списка курьеров
    const [isCouriersListOpen, setIsCouriersListOpen] = useState(false);

    // <<< Получаем конфиг слотов из стейта >>>
    const slotConfig = useAppSelector((state) => state.shifts.slotConfig);

    // Добавим новое состояние для хранения данных выбранного курьера
    const [selectedCourier, setSelectedCourier] = useState<any | null>(null);
    // Состояние для отображения модального окна профиля
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const courierChatId = useMemo(() => {
        const courierGroup = user?.groups?.find(g => g.group_type === 'courier');
        return courierGroup ? Number(courierGroup.chat_id) : undefined;
    }, [user?.groups]);

    const courierChatIdString = useMemo(() => {
        return courierChatId?.toString();
    }, [courierChatId]);

    const currentCourierGroup = useMemo(() => {
        if (!user?.groups || !courierChatId) return null;
        return user.groups.find(g => g.group_type === 'courier' && String(g.chat_id) === String(courierChatId));
    }, [user?.groups, courierChatId]);

    useEffect(() => {
        if (courierChatId) {
            console.log('[CourierSchedule] Fetching slot config for chat ID:', courierChatId);
            dispatch(fetchSlotConfig({ chatId: courierChatId }));
        }
    }, [dispatch, courierChatId]);


    // <<< ВОЗВРАЩАЕМ useEffect, который ставит overflow: hidden на body >>>
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        console.log('[CourierSchedule] Body scroll disabled (Restored).');
        return () => {
            document.body.style.overflow = originalOverflow;
            console.log('[CourierSchedule] Body scroll restored on unmount (Restored).');
        };
    }, []);

    const handleProfileSave = async (data: { 
        firstName: string; 
        lastName: string; 

    }) => {
 
        console.warn("[CourierSchedule] handleProfileSave вызвана, но логика сохранения перенесена в CourierProfileDialog.");
        return Promise.resolve(); // Возвращаем пустой промис
    };

    const handleShiftSelect = async (date: Date, shiftType: 'day' | 'night', slotIndex: number) => {
        console.log('Выбрана дата:', date);
        
        if (!user?.id) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Необходимо войти в систему для бронирования смены'
            }));
            return;
        }

        if (!courierChatIdString) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Не удалось определить группу для бронирования смены'
            }));
            return;
        }

        try {
            await dispatch(bookShift({
                date: format(date, 'yyyy-MM-dd'),
                shiftType,
                slotIndex,
                userId: String(user.id),
                chatId: courierChatIdString
            })).unwrap();

            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Смена успешно забронирована'
            }));
        } catch (error: any) {
            console.log('Ошибка при бронировании смены:', error);
            
            let errorMessage = 'Не удалось забронировать смену';
            
            try {
                const errorData = JSON.parse(error.message.split('Failed to book shift: ')[1]);
                errorMessage = errorData.error || errorMessage;
            } catch {
                errorMessage = error.message || errorMessage;
            }

            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: errorMessage
            }));
        }
    };

    const isModalActive = showShiftAccessSettings || showSlotSettings;
    const activeModalType: 'shiftAccess' | 'slotSettings' | 'none' = 
        showShiftAccessSettings ? 'shiftAccess' : 
        showSlotSettings ? 'slotSettings' : 'none';

    const handleCloseShiftAccessSettings = useCallback(() => {
        setShowShiftAccessSettings(false);
        setIsShiftAccessDirty(false);
    }, []);

    const handleCloseSlotSettings = useCallback(() => {
        setShowSlotSettings(false);
        setSelectedDayIndexForSlots(null);
        setIsSlotSettingsDirty(false);
    }, []);

    const closeSettingsPanel = useCallback(() => {
        setIsSettingsPanelOpen(false);
    }, []);

    const handleOpenShiftAccessModal = useCallback(() => {
        closeSettingsPanel();
        if (showSlotSettings) handleCloseSlotSettings();
        setCurrentModalStep(1);
        setIsShiftAccessDirty(false);
        setShowShiftAccessSettings(true);
    }, [closeSettingsPanel, showSlotSettings, handleCloseSlotSettings]);

    const handleSlotSettingsDayChange = useCallback((newDayIndex: number) => {
        console.log(`[CourierSchedule] Request to change slot settings day to: ${newDayIndex}`);
        if (selectedDayIndexForSlots !== newDayIndex) {
            setSelectedDayIndexForSlots(newDayIndex);
            setIsSlotSettingsDirty(false);
        }
    }, [selectedDayIndexForSlots]);

    const handleShiftAccessDirtyChange = useCallback((dirty: boolean) => {
        if (activeModalType === 'shiftAccess') {
            setIsShiftAccessDirty(dirty);
        }
    }, [activeModalType]);

    // <<< ВРЕМЕННО КОММЕНТИРУЕМ useEffect для проверки isDirty >>>
    // useEffect(() => {
    //     let intervalId: NodeJS.Timeout | null = null;
    //     if (activeModalType === 'slotSettings') {
    //         intervalId = setInterval(() => {
    //             setIsModalDirty(slotSettingsRef.current?.isDirty ?? false);
    //         }, 300);
    //     } else {
    //         if (activeModalType !== 'shiftAccess') {
    //             setIsModalDirty(false); 
    //         }
    //     }
    //     return () => { if (intervalId) clearInterval(intervalId); };
    // }, [activeModalType]);

    const handleModalSave = async () => {
        if (activeModalType === 'shiftAccess') {
            console.log('[CourierSchedule] Footer save -> shiftAccessModalRef.triggerSave()');
            await shiftAccessModalRef.current?.triggerSave();
        } else if (activeModalType === 'slotSettings') {
            console.log('[CourierSchedule] Footer save -> slotSettingsRef.current?.triggerSave()');
            await slotSettingsRef.current?.triggerSave(); 
        }
    };

    const handleModalCancel = () => {
        if (activeModalType === 'shiftAccess') {
            if (isShiftAccessDirty) {
                shiftAccessModalRef.current?.triggerReset();
            }
            handleCloseShiftAccessSettings();
        } else if (activeModalType === 'slotSettings') {
            slotSettingsRef.current?.triggerReset(); 
            handleCloseSlotSettings(); 
        }
    };

    const handleModalPrevStep = () => {
        if (activeModalType === 'shiftAccess') {
            console.log('[CourierSchedule] Footer back -> shiftAccessModalRef.goToPrevStep()');
            shiftAccessModalRef.current?.goToPrevStep();
        }
    };

    const handleModalNextStep = () => {
        if (activeModalType === 'shiftAccess') {
            console.log('[CourierSchedule] Footer next -> shiftAccessModalRef.goToNextStep()');
            shiftAccessModalRef.current?.goToNextStep();
        }
    };

    const handleFooterBack = () => {
        console.log('[Footer] Back button clicked (standard mode)');
    };

    const MODAL_TOTAL_STEPS = 3;

    const getIsModalNextDisabled = () => {
        if (activeModalType === 'shiftAccess') {
            const isLast = currentModalStep === MODAL_TOTAL_STEPS;
            return isLast;
        }
        return true;
    };

    const getIsModalSaveDisabled = () => {
        let dirty = false;
        if (activeModalType === 'shiftAccess') {
            dirty = isShiftAccessDirty;
            const isLast = currentModalStep === MODAL_TOTAL_STEPS;
            return !isLast || !dirty;
        } else if (activeModalType === 'slotSettings') {
            dirty = isSlotSettingsDirty;
            return !dirty;
        }
        return true;
    };

    const toggleSettingsPanel = useCallback(() => {
        setIsSettingsPanelOpen(prev => !prev);
    }, []);

    const handleOpenSlotSettingsFromPanel = useCallback(() => {
        const defaultDayIndex = 1; // Или 0, если нужно
        console.log(`[CourierSchedule] Opening slot settings from panel (default day: ${defaultDayIndex})`);
        closeSettingsPanel();
        if (showShiftAccessSettings) handleCloseShiftAccessSettings();
        setSelectedDayIndexForSlots(defaultDayIndex);
        setIsSlotSettingsDirty(false);
        setShowSlotSettings(true);
    }, [closeSettingsPanel, showShiftAccessSettings, handleCloseShiftAccessSettings]);

    // Новый обработчик долгого нажатия на слот
    const handleLongPress = useCallback((shiftType: 'day' | 'night', slotIndex: number) => {
        console.log(`[CourierSchedule] Long press detected on ${shiftType} slot ${slotIndex}`, { 
            isCouriersListOpen, 
            currentState: 'setting to true'
        });
        
        // Установим флаг и проверим, что он установился
        setIsCouriersListOpen(true);
        
        // Проверка в следующем тике, установился ли флаг
        setTimeout(() => {
            console.log('[CourierSchedule] Check after setTimeout', { 
                isCouriersListOpenAfterTimeout: isCouriersListOpen 
            });
        }, 0);
    }, [isCouriersListOpen]);
    
    // Закрытие списка курьеров
    const handleCloseCouriersList = useCallback(() => {
        console.log('[CourierSchedule] Closing couriers list', { 
            isCouriersListOpen, 
            currentState: 'setting to false'
        });
        setIsCouriersListOpen(false);
    }, [isCouriersListOpen]);

    // <<< ИЗМЕНЯЕМ fetchTimesheetData >>>
    const fetchTimesheetData = useCallback(async (chatId: string, period: SelectedPeriod) => {
        console.log(`[CourierSchedule] Fetching timesheet data for chat ${chatId}, period:`, period);
        setIsTimesheetLoading(true);
        setTimesheetError(null);
        try {
            // <<< ФОРМИРУЕМ ПАРАМЕТРЫ ДЛЯ API >>>
            const params: Record<string, any> = {};
            if (period.type === 'month') {
                if (period.year !== undefined) params.year = period.year;
                // +1 т.к. API может ожидать 1-12 (убедитесь, что это так на бэкенде!)
                if (period.month !== undefined) params.month = period.month + 1; 
            } else if (period.type === 'week') {
                params.is_weekly = true;
            }
            // <<< РАСКОММЕНТИРОВАЛИ ПЕРЕДАЧУ ПАРАМЕТРОВ >>>
            // console.log('[CourierSchedule] TODO: Pass these params to getTimesheetData:', params);
            const data = await getTimesheetData(chatId, { params }); // <<< Передаем параметры как второй аргумент
            // const data = await getTimesheetData(chatId); // <<< УДАЛЯЕМ ВРЕМЕННЫЙ ВЫЗОВ
            setTimesheetData(data);
        } catch (err) {
            console.error('[CourierSchedule] Error fetching timesheet data:', err);
            setTimesheetError(err instanceof Error ? err.message : 'Не удалось загрузить табель');
            setTimesheetData(null); 
        } finally {
            setIsTimesheetLoading(false);
        }
    // <<< УБИРАЕМ getTimesheetData ИЗ ЗАВИСИМОСТЕЙ >>>
    }, []); 

    // <<< ДОБАВЛЯЕМ ОБРАБОТЧИК СМЕНЫ ПЕРИОДА >>>
    const handleTimesheetPeriodChange = useCallback((newPeriod: SelectedPeriod) => {
        console.log('[CourierSchedule] handleTimesheetPeriodChange called with:', newPeriod);
        setSelectedPeriod(newPeriod);
        // Вызываем загрузку данных для нового периода
        if (courierChatIdString) { 
            fetchTimesheetData(courierChatIdString, newPeriod);
        } else {
            console.error('[CourierSchedule] Cannot fetch timesheet data: courierChatIdString is missing.');
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Не удалось определить ID чата курьеров' }));
        }
    // <<< Добавляем fetchTimesheetData в зависимости >>>
    }, [courierChatIdString, fetchTimesheetData, dispatch]); 

    // <<< Обработчик для кнопки "Показать табель" >>>
    const handleShowTimesheet = useCallback(() => {
        if (!courierChatIdString) {
             dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Не удалось определить ID чата курьеров' }));
             return;
        }
        // <<< ИСПРАВЛЯЕМ ВЫЗОВ: Передаем selectedPeriod >>>
        fetchTimesheetData(courierChatIdString, selectedPeriod); 
        setIsTimesheetPreviewVisible(true);
    }, [courierChatIdString, dispatch, fetchTimesheetData, selectedPeriod]);

    // Добавим функцию для открытия профиля курьера
    const handleOpenCourierProfile = useCallback((courier: any) => {
        console.log('[CourierSchedule] Opening profile for courier:', courier);
        setSelectedCourier({
            first_name: courier.firstName || courier.first_name || '',
            last_name: courier.lastName || courier.last_name || '',
            photo_url: courier.photoUrl || courier.photo_url || undefined,
            isSeniorCourier: courier.isSeniorCourier || courier.is_senior_courier || false
        });
        setIsProfileModalOpen(true);
    }, []);

    // Добавим функцию для закрытия профиля курьера
    const handleCloseProfileModal = useCallback(() => {
        setIsProfileModalOpen(false);
        setSelectedCourier(null);
    }, []);

    // <<< НОВАЯ ФУНКЦИЯ-ОБЕРТКА ДЛЯ ОТПРАВКИ ТАБЕЛЯ >>>
    const handleSendTimesheetRequestWrapper = useCallback(async (destination: 'user' | 'group') => {
        // <<< Добавляем `originalLoadingState` и `destinationText` как локальные переменные >>>
        const destinationText = destination === 'user' ? "личный чат" : "чат группы";
        const originalLoadingState = isTimesheetLoading;

        if (!user?.id) {
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Не удалось идентифицировать пользователя.' }));
            return;
        }
        if (!courierChatIdString) {
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Не удалось определить группу.' }));
            return;
        }
        
        dispatch(addNotification({ type: NotificationTypes.INFO, message: `Запрос на отправку табеля в ${destinationText} отправлен...` }));

        setIsTimesheetLoading(true); 
        
        try {
            await requestTimesheetViaBot({
                groupTelegramId: courierChatIdString,
                userId: String(user.id),
                destination: destination,
                 year: selectedPeriod.type === 'month' ? selectedPeriod.year : undefined,
                 month: selectedPeriod.type === 'month' ? (selectedPeriod.month !== undefined ? selectedPeriod.month + 1 : undefined) : undefined,
                 is_weekly: selectedPeriod.type === 'week' ? true : undefined
            });
            dispatch(addNotification({ type: NotificationTypes.SUCCESS, message: `Запрос принят. Табель скоро будет отправлен в ${destinationText}.` }));
        } catch (error: any) {
            const message = error.message || 'Неизвестная ошибка при запросе табеля.';
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: `Ошибка запроса табеля: ${message}` }));
        } finally {
             setIsTimesheetLoading(originalLoadingState);
        }
    // <<< УБИРАЕМ requestTimesheetViaBot ИЗ ЗАВИСИМОСТЕЙ >>>
    }, [user, courierChatIdString, dispatch, selectedPeriod, isTimesheetLoading, setIsTimesheetLoading]); 

    return (
        <Container>
            {isProfileDialogOpen && user && (
                <CourierProfileDialog 
                    isOpen={isProfileDialogOpen} 
                    onClose={() => setIsProfileDialogOpen(false)} 
                    onSave={handleProfileSave}
                    chatId={courierChatIdString}
                />
            )}

            {showCalendar && user && (
                <CourierCalendar 
                    chatId={courierChatIdString}
                    currentUserId={String(user.id)}
                    currentUserAvatar={user.photo_url || undefined}
                    currentUserName={`${user.first_name || ''} ${user.last_name || ''}`}
                    isCurrentUserSenior={currentCourierGroup?.is_senior_courier ?? false}
                    onClose={() => setShowCalendar(false)} 
                    onShiftSelect={handleShiftSelect}
                    onOpenSlotSettings={(dayIndex: number) => {
                        console.log(`[CourierSchedule] Slot Settings clicked for day index: ${dayIndex}`);
                        setSelectedDayIndexForSlots(dayIndex);
                        setShowSlotSettings(true);
                        if (isSettingsPanelOpen) closeSettingsPanel();
                        if (showShiftAccessSettings) handleCloseShiftAccessSettings();
                    }}
                    onLongPress={handleLongPress}
                    onOpenProfile={handleOpenCourierProfile}
                />
            )}
            
            {/* Добавляем компонент списка курьеров */}
            {user && courierChatIdString && (
                <CouriersList
                    isOpen={isCouriersListOpen}
                    onClose={handleCloseCouriersList}
                    groupId={courierChatIdString}
                    requesterId={String(user.id)}
                    onOpenProfile={handleOpenCourierProfile}
                />
            )}
            
            <ShiftAccessModal 
                ref={shiftAccessModalRef}
                isOpen={showShiftAccessSettings}
                onClose={handleCloseShiftAccessSettings}
                chatId={courierChatIdString}
                onIsDirtyChange={handleShiftAccessDirtyChange}
                onStepChange={setCurrentModalStep}
            />
            
            <ModalBackdropOverlay 
                $isOpen={showSlotSettings} 
                onClick={handleCloseSlotSettings}
            /> 
            {selectedDayIndexForSlots !== null && (
                <SlotSettings
                    ref={slotSettingsRef}
                    isOpen={showSlotSettings}
                    onClose={handleCloseSlotSettings}
                    chatId={courierChatId}
                    dayIndex={selectedDayIndexForSlots}
                    onDayChangeRequest={handleSlotSettingsDayChange}
                    onDirtyChange={setIsSlotSettingsDirty}
                />
            )}

            {(() => { 
                console.log(`[CourierSchedule] Rendering SettingsPanel CHECK. isSettingsPanelOpen: ${isSettingsPanelOpen}`);
                return null;
            })()} 
            <SettingsPanel 
                isOpen={isSettingsPanelOpen}
                onClose={closeSettingsPanel}
                onOpenShiftAccess={handleOpenShiftAccessModal}
                onOpenSlotSettings={handleOpenSlotSettingsFromPanel}
                onOpenTimesheet={handleShowTimesheet} 
            />

            {/* <<< ИСПРАВЛЯЕМ ВЫЗОВ TimesheetPreview >>> */}
            {isTimesheetPreviewVisible && courierChatIdString && (
                 <TimesheetPreview
                    isOpen={isTimesheetPreviewVisible}
                    onClose={() => setIsTimesheetPreviewVisible(false)}
                    // <<< Используем новую обертку >>>
                    onSendRequest={handleSendTimesheetRequestWrapper} 
                    data={timesheetData}
                    isLoading={isTimesheetLoading}
                    error={timesheetError}
                    chatId={courierChatIdString}
                    slotConfig={slotConfig}
                    groupTitle={currentCourierGroup?.title || 'Группа курьеров'} 
                    onPeriodChange={handleTimesheetPeriodChange} 
                 />
             )}

            <Footer 
                onBack={handleFooterBack}
                showSettingsButton={currentCourierGroup?.is_senior_courier ?? false} 
                onSettingsClick={toggleSettingsPanel}
                showModalActions={isModalActive}
                showModalSteps={activeModalType === 'shiftAccess'}
                modalCurrentStep={activeModalType === 'shiftAccess' ? currentModalStep : undefined}
                modalTotalSteps={activeModalType === 'shiftAccess' ? MODAL_TOTAL_STEPS : undefined}
                onModalBack={activeModalType === 'shiftAccess' ? handleModalPrevStep : undefined}
                onModalNext={activeModalType === 'shiftAccess' ? handleModalNextStep : undefined}
                isModalNextDisabled={getIsModalNextDisabled()}
                onModalSave={handleModalSave}
                onModalCancel={handleModalCancel}
                isModalSaveDisabled={getIsModalSaveDisabled()}
            />

            {/* Добавим рендеринг модального окна профиля */}
            {isProfileModalOpen && selectedCourier && (
                <CourierProfile 
                    isSeniorCourier={selectedCourier.isSeniorCourier}
                    targetUserId={selectedCourier.userId}
                    isModal={true}
                    isOpen={isProfileModalOpen}
                    onClose={handleCloseProfileModal}
                />
            )}
        </Container>
    );
};

export default CourierSchedule; 