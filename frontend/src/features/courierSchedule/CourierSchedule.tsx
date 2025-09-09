import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useAppSelector, useAppDispatch } from '@shared/store/hooks';
import CourierProfile from '@/features/courierSchedule/components/courier-profile/CourierProfile';
import CourierProfileDialog from '@/features/courierSchedule/components/CourierProfileDialog';
import CourierCalendar from '@/features/courierSchedule/components/courier-calendar/index';
import { addNotification} from '@shared/store/notificationSlice/notificationSlice';
import { NotificationTypes } from '@shared/store/notificationSlice/notificationTypes';
import { bookShift } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { fetchSlotConfig } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { format } from 'date-fns';
import { ShiftAccessModalRef } from '@/features/courierSchedule/components/setting-panel/shift-access-modal-settings';
import SettingsPanel from '@/features/courierSchedule/components/setting-panel/SettingsPanel';
import Footer from '@features/Inventory/Footer';
import SlotSettings, { SlotSettingsRef } from './components/setting-panel/slot-settings';
import { SettingsOverlay as ModalBackdropOverlay } from './components/courier-calendar/styles';
import ShiftAccessModal from '@/features/courierSchedule/components/setting-panel/shift-access-modal-settings';
import TimesheetPreview from '@/features/courierSchedule/components/TimesheetPreview';
import { TimesheetResponse } from '@features/courierSchedule/types/timesheet';
import { getTimesheetData, requestTimesheetViaBot } from '@features/courierSchedule/services/courierApi';
import type { SelectedPeriod } from '@/features/courierSchedule/components/TimesheetPreview';
import useDeviceDetect from '@shared/hooks/useDeviceDetect';
import ChatSelector, { ChatItem } from '@shared/components/ChatSelector/ChatSelector';

// НОВЫЕ ИМПОРТЫ для работы с курьерскими чатами
import { fetchCourierChats } from '@features/courierSchedule/store/courierSlice/courierThunks';
import { selectCourierChats, selectCourierChatsLoading, selectCourierChatsError } from '@features/courierSchedule/store/courierSlice/courierSelectors';

const Container = styled.div`
    padding: 20px;
    max-width: 1200px;
    margin: 80px auto 0 auto;
    color: var(--text-color);
`;


const CourierSchedule: React.FC = () => {
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.user.user);
    const deviceInfo = useDeviceDetect();
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
    const [isTimesheetLoading, setIsTimesheetLoading] = useState(false);
    const [timesheetData, setTimesheetData] = useState<TimesheetResponse | null>(null);
    const [isTimesheetPreviewVisible, setIsTimesheetPreviewVisible] = useState(false);
    const [timesheetError, setTimesheetError] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>({ 
        type: 'month', 
        year: new Date().getFullYear(), 
        month: new Date().getMonth() 
    });

    // Новые состояния для списка курьеров
    const [isCouriersListOpen, setIsCouriersListOpen] = useState(false);

    // <<< Получаем конфиг слотов из стейта >>>
    const slotConfig = useAppSelector((state) => state.shifts.slotConfig);

    // НОВОЕ: получаем курьерские чаты из Redux вместо user.groups
    const courierChats = useAppSelector(selectCourierChats);
    const courierChatsLoading = useAppSelector(selectCourierChatsLoading);
    const courierChatsError = useAppSelector(selectCourierChatsError);

    // Добавим новое состояние для хранения данных выбранного курьера
    const [selectedCourier, setSelectedCourier] = useState<any | null>(null);
    // Состояние для отображения модального окна профиля
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // НОВОЕ: преобразуем курьерские чаты в формат для ChatSelector (БЕЗ couriers_count)
    const courierGroups = useMemo(() => {
        const groups = courierChats.map(chat => {
            // ОТЛАДКА: логируем информацию о старших курьерах
            const seniorAdmins = chat.admins.filter(admin => admin.is_senior_courier);
            const seniorMembers = chat.members.filter(member => member.is_senior_courier);
            console.log(`🌟 [CourierSchedule] Чат "${chat.title}": старшие админы:`, seniorAdmins, 'старшие участники:', seniorMembers);
            
            return {
                chat_id: chat.chat_id,
                chat_title: chat.title,
                title: chat.title,
                group_type: chat.group_type,
                admins: chat.admins.map(admin => ({
                    ...admin,
                    first_name: admin.first_name ?? null,
                    last_name: admin.last_name ?? null,
                    username: admin.username ?? null,
                    photo_url: admin.photo_url ?? null,
                    // ОБНОВЛЕНО: используем данные из API напрямую
                    isSeniorCourier: admin.is_senior_courier || false,
                })),
                members: chat.members
                    .filter(member => member.first_name) // Фильтруем записи с пустым first_name
                    .map(member => ({
                        user_id: member.user_id,
                        first_name: member.first_name || 'Участник',
                        photo_url: member.photo_url ?? undefined,
                        // ОБНОВЛЕНО: используем данные из API напрямую
                        isSeniorCourier: member.is_senior_courier || false,
                    })),
                is_senior_courier: user?.groups?.find(g => g.group_type === 'courier' && String(g.chat_id) === chat.chat_id)?.is_senior_courier || false
            };
        });
        
        console.log('🚚 [CourierSchedule] Сформированные курьерские группы:', groups);
        return groups;
    }, [courierChats, user?.groups]);

    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

    // НОВОЕ: загружаем курьерские чаты при инициализации
    useEffect(() => {
        if (user?.id) {
            console.log('🚚 [CourierSchedule] Загружаем курьерские чаты для пользователя:', user.id);
            dispatch(fetchCourierChats({ userId: user.id }));
        }
    }, [dispatch, user?.id]);

    // Если только один курьерский чат — выбираем его автоматически
    useEffect(() => {
        if (courierGroups.length === 1) {
            setSelectedChatId(courierGroups[0].chat_id.toString());
        }
    }, [courierGroups]);

    // ОБНОВЛЯЕМ: courierChatId теперь берется из курьерских чатов
    const courierChatId = useMemo(() => {
        // Сначала пробуем найти в курьерских чатах
        const courierChat = courierChats.find(chat => chat.chat_id === selectedChatId);
        if (courierChat) {
            return Number(courierChat.chat_id);
        }
        // Fallback на старую логику если selectedChatId не установлен
        const courierGroup = user?.groups?.find(g => g.group_type === 'courier');
        return courierGroup ? Number(courierGroup.chat_id) : undefined;
    }, [courierChats, selectedChatId, user?.groups]);

    // ОБНОВЛЯЕМ: currentCourierGroup теперь ищется в курьерских чатах
    const currentCourierGroup = useMemo(() => {
        if (!courierChatId) return null;
        
        // Пробуем найти в курьерских чатах
        const courierChat = courierChats.find(chat => String(chat.chat_id) === String(courierChatId));
        if (courierChat) {
            return {
                ...courierChat,
                // Добавляем поля совместимости со старым форматом
                is_senior_courier: user?.groups?.find(g => g.group_type === 'courier' && String(g.chat_id) === String(courierChatId))?.is_senior_courier
            };
        }
        
        // Fallback на старую логику
        if (!user?.groups) return null;
        return user.groups.find(g => g.group_type === 'courier' && String(g.chat_id) === String(courierChatId));
    }, [courierChats, courierChatId, user?.groups]);

    useEffect(() => {
        if (courierChatId) {
            dispatch(fetchSlotConfig({ chatId: courierChatId }));
        }
    }, [dispatch, courierChatId]);


    useEffect(() => {
        if (user && (!user.first_name || !user.last_name)) {
            setIsProfileDialogOpen(true);
        }
    }, [user]);

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
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

        if (!selectedChatId) {
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
                chatId: selectedChatId
            })).unwrap();

            // Показываем подтверждение ТОЛЬКО если запрос прошел успешно
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Смена успешно забронирована'
            }));
        } catch (error: any) {
            console.log('Ошибка при бронировании смены:', error);
            
            let errorMessage = 'Не удалось забронировать смену';
            
            // Специальная обработка для ошибки настроек группы
            if (error.message && error.message.includes('Настройки группы не настроены')) {
                errorMessage = 'Настройки группы не настроены. Обратитесь к администратору для настройки параметров смен.';
                // Показываем модальное окно настроек
                setShowShiftAccessSettings(true);
            } else {
                try {
                    const errorData = JSON.parse(error.message.split('Failed to book shift: ')[1]);
                    errorMessage = errorData.error || errorMessage;
                } catch {
                    errorMessage = error.message || errorMessage;
                }
            }

            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: errorMessage
            }));
            
            // Пробрасываем ошибку дальше, чтобы ShiftConfirmationDialog мог её обработать
            throw error;
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
            // НЕ СБРАСЫВАЕМ isSlotSettingsDirty при смене дня, так как изменения могут быть в других днях
            // setIsSlotSettingsDirty(false);
        }
    }, [selectedDayIndexForSlots]);

    const handleShiftAccessDirtyChange = useCallback((dirty: boolean) => {
        if (activeModalType === 'shiftAccess') {
            setIsShiftAccessDirty(dirty);
        }
    }, [activeModalType]);


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
            console.log('[CourierSchedule] getIsModalSaveDisabled - slotSettings:', { dirty, isSlotSettingsDirty });
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
        // Сбрасываем только при первом открытии, но не при переключении дней
        setIsSlotSettingsDirty(false);
        setShowSlotSettings(true);
    }, [closeSettingsPanel, showShiftAccessSettings, handleCloseShiftAccessSettings]);

    const handleLongPress = useCallback((shiftType: 'day' | 'night', slotIndex: number) => {
        console.log(`[CourierSchedule] Long press detected on ${shiftType} slot ${slotIndex}`, { 
            isCouriersListOpen, 
            currentState: 'setting to true'
        });
        
        setIsCouriersListOpen(true);
        
        setTimeout(() => {
            console.log('[CourierSchedule] Check after setTimeout', { 
                isCouriersListOpenAfterTimeout: isCouriersListOpen 
            });
        }, 0);
    }, [isCouriersListOpen]);
    
    const handleCloseCouriersList = useCallback(() => {
        console.log('[CourierSchedule] Closing couriers list', { 
            isCouriersListOpen, 
            currentState: 'setting to false'
        });
        setIsCouriersListOpen(false);
    }, [isCouriersListOpen]);

    const fetchTimesheetData = useCallback(async (chatId: string, period: SelectedPeriod) => {
        console.log(`[CourierSchedule] Fetching timesheet data for chat ${chatId}, period:`, period);
        setIsTimesheetLoading(true);
        setTimesheetError(null);
        try {
            const params: Record<string, any> = {};
            if (period.type === 'month') {
                if (period.year !== undefined) params.year = period.year;
                if (period.month !== undefined) params.month = period.month + 1; 
            } else if (period.type === 'week') {
                params.is_weekly = true;
            }
          
            const data = await getTimesheetData(chatId, { params });
            setTimesheetData(data);
        } catch (err) {
            console.error('[CourierSchedule] Error fetching timesheet data:', err);
            setTimesheetError(err instanceof Error ? err.message : 'Не удалось загрузить табель');
            setTimesheetData(null); 
        } finally {
            setIsTimesheetLoading(false);
        }
    }, []); 

    const handleTimesheetPeriodChange = useCallback((newPeriod: SelectedPeriod) => {
        console.log('[CourierSchedule] handleTimesheetPeriodChange called with:', newPeriod);
        setSelectedPeriod(newPeriod);
        if (selectedChatId) { 
            fetchTimesheetData(selectedChatId, newPeriod);
        } else {
            console.error('[CourierSchedule] Cannot fetch timesheet data: selectedChatId is missing.');
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Не удалось определить ID чата курьеров' }));
        }
    }, [selectedChatId, fetchTimesheetData, dispatch]); 

    const handleShowTimesheet = useCallback(() => {
        if (!selectedChatId) {
             dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Не удалось определить ID чата курьеров' }));
             return;
        }
        fetchTimesheetData(selectedChatId, selectedPeriod); 
        setIsTimesheetPreviewVisible(true);
    }, [selectedChatId, dispatch, fetchTimesheetData, selectedPeriod]);

    const handleOpenCourierProfile = useCallback((courier: any) => {
        setSelectedCourier({
            first_name: courier.firstName || courier.first_name || '',
            last_name: courier.lastName || courier.last_name || '',
            photo_url: courier.photoUrl || courier.photo_url || undefined,
            isSeniorCourier: courier.isSeniorCourier || courier.is_senior_courier || false
        });
        setIsProfileModalOpen(true);
    }, []);

    const handleCloseProfileModal = useCallback(() => {
        setIsProfileModalOpen(false);
        setSelectedCourier(null);
    }, []);

    const handleSendTimesheetRequestWrapper = useCallback(async (destination: 'user' | 'group') => {
        const destinationText = destination === 'user' ? "личный чат" : "чат группы";
        const originalLoadingState = isTimesheetLoading;

        if (!user?.id) {
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Не удалось идентифицировать пользователя.' }));
            return;
        }
        if (!selectedChatId) {
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Не удалось определить группу.' }));
            return;
        }
        
        dispatch(addNotification({ type: NotificationTypes.INFO, message: `Запрос на отправку табеля в ${destinationText} отправлен...` }));

        setIsTimesheetLoading(true); 
        
        try {
            await requestTimesheetViaBot({
                groupTelegramId: selectedChatId,
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
    }, [user, selectedChatId, dispatch, selectedPeriod, isTimesheetLoading, setIsTimesheetLoading]); 

    return (
        <Container>
            {isProfileDialogOpen && user && (
                <CourierProfileDialog 
                    isOpen={isProfileDialogOpen} 
                    onClose={() => setIsProfileDialogOpen(false)} 
                    onSave={handleProfileSave}
                    chatId={selectedChatId || undefined}
                />
            )}

            {/* --- ВЫБОР ЧАТА ДЛЯ КУРЬЕРА --- */}
            {user && courierGroups.length > 1 && !selectedChatId && !courierChatsLoading && (
                <ChatSelector
                    chats={courierGroups}
                    mode="events"
                    title="Выберите чат для расписания курьеров"
                    onChatSelect={(ids) => setSelectedChatId(ids[0])}
                />
            )}

            {/* Показываем загрузку пока загружаются курьерские чаты */}
            {courierChatsLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <div>Загрузка курьерских чатов...</div>
                </div>
            )}

            {/* Показываем ошибку если не удалось загрузить чаты */}
            {courierChatsError && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'red' }}>
                    <div>Ошибка загрузки чатов: {courierChatsError}</div>
                </div>
            )}

            {/* --- КАЛЕНДАРЬ и все связанные элементы --- */}
            {selectedChatId && (
                <>
                    {showCalendar && user && (
                        <CourierCalendar 
                            chatId={selectedChatId}
                            currentUserId={String(user.id)}
                            currentUserAvatar={user.photo_url || undefined}
                            currentUserName={`${user.first_name || ''} ${user.last_name || ''}`}
                            isCurrentUserSenior={currentCourierGroup?.is_senior_courier ?? false}
                            onClose={() => setShowCalendar(false)} 
                            onShiftSelect={handleShiftSelect}
                            onOpenSlotSettings={(dayIndex: number) => {
                                setSelectedDayIndexForSlots(dayIndex);
                                setShowSlotSettings(true);
                                if (isSettingsPanelOpen) closeSettingsPanel();
                                if (showShiftAccessSettings) handleCloseShiftAccessSettings();
                            }}
                            onLongPress={handleLongPress}
                            onOpenProfile={handleOpenCourierProfile}
                        />
                    )}

                    <ShiftAccessModal 
                        ref={shiftAccessModalRef}
                        isOpen={showShiftAccessSettings}
                        onClose={handleCloseShiftAccessSettings}
                        chatId={selectedChatId || undefined}
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
                            chatId={Number(selectedChatId)}
                            dayIndex={selectedDayIndexForSlots}
                            onDayChangeRequest={handleSlotSettingsDayChange}
                            onDirtyChange={setIsSlotSettingsDirty}
                        />
                    )}
                    <SettingsPanel 
                        isOpen={isSettingsPanelOpen}
                        onClose={closeSettingsPanel}
                        onOpenShiftAccess={handleOpenShiftAccessModal}
                        onOpenSlotSettings={handleOpenSlotSettingsFromPanel}
                        onOpenTimesheet={handleShowTimesheet} 
                    />
                    {isTimesheetPreviewVisible && selectedChatId && (
                        <TimesheetPreview
                            isOpen={isTimesheetPreviewVisible}
                            onClose={() => setIsTimesheetPreviewVisible(false)}
                            onSendRequest={handleSendTimesheetRequestWrapper} 
                            data={timesheetData}
                            isLoading={isTimesheetLoading}
                            error={timesheetError}
                            chatId={selectedChatId}
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
                    {isProfileModalOpen && selectedCourier && (
                        <CourierProfile 
                            isSeniorCourier={selectedCourier.isSeniorCourier}
                            targetUserId={selectedCourier.userId}
                            isModal={true}
                            isOpen={isProfileModalOpen}
                            onClose={handleCloseProfileModal}
                        />
                    )}
                </>
            )}
        </Container>
    );
};

export default CourierSchedule; 