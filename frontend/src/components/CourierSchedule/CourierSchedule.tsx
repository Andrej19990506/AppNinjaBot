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
    const [showCalendar, setShowCalendar] = useState(false);
    const [showShiftAccessSettings, setShowShiftAccessSettings] = useState(false);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const [showSlotSettings, setShowSlotSettings] = useState(false);
    const [selectedDayIndexForSlots, setSelectedDayIndexForSlots] = useState<number | null>(null);
    const [isModalDirty, setIsModalDirty] = useState(false);
    const [currentModalStep, setCurrentModalStep] = useState(1);
    const shiftAccessModalRef = useRef<ShiftAccessModalRef>(null);
    const slotSettingsRef = useRef<SlotSettingsRef>(null);
    
    // Новые состояния для списка курьеров
    const [isCouriersListOpen, setIsCouriersListOpen] = useState(false);

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

    useEffect(() => {
        if (!user) return;

        const profileNotFilled = !user.first_name?.trim() || !user.last_name?.trim();
        
        let shouldOpenForSeniority = false;
        if (!profileNotFilled && currentCourierGroup) {
            const isAdminOrCreator = 
                currentCourierGroup.role === 'administrator' || 
                currentCourierGroup.role === 'creator' ||
                currentCourierGroup.role === 'admin';
            
            const isSeniorStatusNull = currentCourierGroup.is_senior_courier === null;
            
            shouldOpenForSeniority = isAdminOrCreator && isSeniorStatusNull;
        }

        if (profileNotFilled || shouldOpenForSeniority) {
            console.log(`[CourierSchedule] Opening profile dialog. Reason: ${profileNotFilled ? 'Profile not filled' : 'Admin/Creator needs to set senior status'}`);
            setIsProfileDialogOpen(true);
        } else {
            if (isProfileDialogOpen) {
                 console.log('[CourierSchedule] Closing profile dialog as conditions are met.');
                 setIsProfileDialogOpen(false); 
            }
        }
    }, [user, currentCourierGroup, isProfileDialogOpen]);

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        console.log('[CourierSchedule] Body scroll disabled.');

        return () => {
            document.body.style.overflow = originalOverflow;
            console.log('[CourierSchedule] Body scroll restored on unmount.');
        };
    }, []);

    const handleProfileSave = async (data: { 
        firstName: string; 
        lastName: string; 
        // Убираем isSeniorCourier и seniorPassword, так как они обрабатываются внутри диалога
        // isSeniorCourier?: boolean; 
        // seniorPassword?: string;
    }) => {
        // Эта функция больше не нужна в CourierSchedule, 
        // так как вся логика сохранения теперь внутри CourierProfileDialog.
        // Мы можем ее либо полностью удалить, либо оставить пустой заглушкой,
        // если она где-то используется (например, как пропс).
        // Пока оставим пустой для безопасности.
        console.warn("[CourierSchedule] handleProfileSave вызвана, но логика сохранения перенесена в CourierProfileDialog.");
        // if (!user?.id) return;
        // try {
        //     // ... старый код вызова updateCourierProfile ...
        //     // dispatch(updateUser(...)) // <-- Убираем этот dispatch
        //     // dispatch(addNotification(...))
        //     // return result;
        // } catch (error) {
        //     // ... старая обработка ошибок ...
        // }
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
        setIsModalDirty(false);
    }, []);

    const handleCloseSlotSettings = useCallback(() => {
        setShowSlotSettings(false);
        setSelectedDayIndexForSlots(null);
        setIsModalDirty(false);
    }, []);

    const closeSettingsPanel = useCallback(() => {
        setIsSettingsPanelOpen(false);
    }, []);

    const handleOpenShiftAccessModal = useCallback(() => {
        closeSettingsPanel();
        if (showSlotSettings) handleCloseSlotSettings();
        setCurrentModalStep(1);
        setIsModalDirty(false);
        setShowShiftAccessSettings(true);
    }, [closeSettingsPanel, showSlotSettings, handleCloseSlotSettings]);

    const handleSlotSettingsDayChange = useCallback((newDayIndex: number) => {
        console.log(`[CourierSchedule] Request to change slot settings day to: ${newDayIndex}`);
        if (selectedDayIndexForSlots !== newDayIndex) {
            setSelectedDayIndexForSlots(newDayIndex);
            setIsModalDirty(false); 
        }
    }, [selectedDayIndexForSlots]);

    const handleShiftAccessDirtyChange = useCallback((dirty: boolean) => {
        if (activeModalType === 'shiftAccess') {
            setIsModalDirty(dirty);
        }
    }, [activeModalType]);

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        if (activeModalType === 'slotSettings') {
            intervalId = setInterval(() => {
                setIsModalDirty(slotSettingsRef.current?.isDirty ?? false);
            }, 300);
        } else {
            if (activeModalType !== 'shiftAccess') {
                setIsModalDirty(false); 
            }
        }
        return () => { if (intervalId) clearInterval(intervalId); };
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
            if (isModalDirty) { 
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
            dirty = isModalDirty;
            const isLast = currentModalStep === MODAL_TOTAL_STEPS;
            return !isLast || !dirty;
        } else if (activeModalType === 'slotSettings') {
            dirty = slotSettingsRef.current?.isDirty ?? false;
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
        setIsModalDirty(false);
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

    return (
        <Container>
            <Header>
                <Title>Запись на смену</Title>
                <Subtitle>Выберите удобную дату для работы</Subtitle>
            </Header>

            {user && (
                <CourierProfile 
                    onRegisterClick={() => setShowCalendar(true)} 
                    isSeniorCourier={currentCourierGroup?.is_senior_courier ?? false}
                />
            )}

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
                />
            )}
            
            {/* Добавляем компонент списка курьеров */}
            {user && courierChatIdString && (
                <CouriersList
                    isOpen={isCouriersListOpen}
                    onClose={handleCloseCouriersList}
                    groupId={courierChatIdString}
                    requesterId={String(user.id)}
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
            />

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
        </Container>
    );
};

export default CourierSchedule; 