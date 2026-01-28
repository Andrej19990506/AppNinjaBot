import React, { useState, useCallback, memo, createContext, useMemo, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@shared/store/store';
import {
    Overlay,
    ModalContainer,
    ModalContent,
    SuccessNotificationContainer
} from './ShiftAccessModal.styles';
import { StepOne, StepTwo, StepThree } from './StepsShiftAccess';
import { useStepNavigation, FormStep } from '../hooks';
import { useAccessSettings } from '../hooks/useAccessSettings';
import StepsContainer from './StepsShiftAccess/common/StepsContainer';
import ModalHeader from './common/ModalHeader';
import { SuccessNotification } from './common';
import { AccessSettings } from '@features/courierSchedule/types/courierScheduleTypes';
// import { ConflictModal } from './ConflictModal'; // Больше не используется - всегда жесткий режим
import { fetchAccessSettings } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';

interface ShiftAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatId?: string;
    onIsDirtyChange?: (isDirty: boolean) => void;
    onStepChange: (step: number) => void;
}

export interface ShiftAccessModalRef {
    triggerSave: () => Promise<boolean>;
    triggerReset: () => void;
    goToNextStep: () => void;
    goToPrevStep: () => void;
    isCurrentStepValid: () => boolean;
}

enum ModalState {
    FORM = 'form',
    SUCCESS = 'success',
}

export interface AccessSettingsContextType {
    settings: AccessSettings | null;
    isLoading: boolean;
    error: string | null;
    updateSettings: (updatedValues: Partial<AccessSettings>) => void;
}

const AccessSettingsContext = createContext<AccessSettingsContextType>({
    settings: null,
    isLoading: false,
    error: null,
    updateSettings: () => {}
});

const ShiftAccessModal = memo(forwardRef<ShiftAccessModalRef, ShiftAccessModalProps>(({ 
    isOpen, 
    onClose, 
    chatId, 
    onIsDirtyChange,
    onStepChange
}, ref) => {
    const dispatch = useDispatch<AppDispatch>();
    const [modalState, setModalState] = useState<ModalState>(ModalState.FORM);
    // const [showConflictModal, setShowConflictModal] = useState(false); // Больше не нужно - всегда жесткий режим
    const [existingShiftsCount, setExistingShiftsCount] = useState(0);
    const [pendingStrategy, setPendingStrategy] = useState<'soft' | 'hard' | null>(null);
    
    const {
        settings,
        isLoading,
        error,
        isDirty,
        handleSettingsChange,
        saveSettings,
        resetSettings
    } = useAccessSettings({ chatId });
    
    useEffect(() => {
        if (onIsDirtyChange) {
            onIsDirtyChange(isDirty);
        }
    }, [isDirty, onIsDirtyChange]);

    const {
        currentStep,
        goToNextStep,
        goToPrevStep,
        swipeDirection,
        resetStep
    } = useStepNavigation({
        totalSteps: 3,
        onStepChange: (step: FormStep) => onStepChange(step + 1),
        onComplete: () => console.log('All steps completed')
    });

    const accessSettingsContextValue = useMemo(() => ({
        settings,
        isLoading,
        error,
        updateSettings: handleSettingsChange
    }), [settings, isLoading, error, handleSettingsChange]);
    
    const handleSwipe = useCallback((direction: number) => {
        if (direction > 0) {
            goToPrevStep();
        } else {
            goToNextStep();
        }
    }, [goToNextStep, goToPrevStep]);
    
    // Обработка выбора стратегии (перемещено выше для использования в handleSaveAttempt)
    const handleStrategySelect = useCallback(async (strategy: 'soft' | 'hard') => {
        if (!chatId || !settings) return;
        
        console.log('[ShiftAccessModal] Выбрана стратегия:', strategy);
        console.log('[ShiftAccessModal] Текущие настройки:', settings);
        
        // Создаем обновленные настройки со стратегией
        const updatedSettings = {
            ...settings,
            transitionStrategy: strategy,
            isAccessBlocked: strategy === 'hard'
        };
        
        console.log('[ShiftAccessModal] Обновленные настройки:', updatedSettings);
        
        // Сохраняем с выбранной стратегией напрямую
        const result = await saveSettings(updatedSettings);
        
        console.log('[ShiftAccessModal] Результат сохранения:', result);
        
        if (result.success) {
            setModalState(ModalState.SUCCESS);
            resetStep();
            onStepChange(FormStep.STEP_ONE + 1);
            
            console.log('[ShiftAccessModal] Перезагрузка настроек для календаря...');
            
            // Важно! Перезагружаем настройки чтобы календарь обновился
            setTimeout(() => {
                dispatch(fetchAccessSettings({ chatId }));
                console.log('[ShiftAccessModal] fetchAccessSettings вызван');
            }, 500);
        }
    }, [dispatch, chatId, settings, saveSettings, resetStep, onStepChange]);
    
    const handleSaveAttempt = useCallback(async () => {
        const result = await saveSettings();
        
        // Проверяем наличие конфликта - автоматически применяем жесткий режим
        if (result.success && result.hasConflict) {
            console.log('[ShiftAccessModal] Обнаружен конфликт, автоматически применяем жесткий режим');
            setExistingShiftsCount(result.existingShiftsCount || 0);
            
            // Автоматически выбираем жесткий режим без показа модалки
            await handleStrategySelect('hard');
            return true;
        }
        
        if (result.success) {
            setModalState(ModalState.SUCCESS);
            resetStep();
            onStepChange(FormStep.STEP_ONE + 1);
        }
        return result.success;
    }, [saveSettings, resetStep, onStepChange, handleStrategySelect]);
    
    const handleResetAttempt = useCallback(() => {
        resetSettings();
    }, [resetSettings]);
    
    const isStepValid = (step: number): boolean => {
        return true;
    };
    
    useImperativeHandle(ref, () => ({
        triggerSave: handleSaveAttempt,
        triggerReset: handleResetAttempt,
        goToNextStep: goToNextStep,
        goToPrevStep: goToPrevStep,
        isCurrentStepValid: () => isStepValid(currentStep)
    }));

    const handleModalClose = useCallback(() => {
        setModalState(ModalState.FORM);
        resetStep();
        onStepChange(FormStep.STEP_ONE + 1);
        onClose();
    }, [onClose, resetStep, onStepChange]);
    
    const handleSuccessConfirm = useCallback(() => {
        handleModalClose();
    }, [handleModalClose]);
    
    const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (modalState === ModalState.SUCCESS) return;
        
        if (e.target === e.currentTarget) {
            handleModalClose();
        }
    }, [modalState, handleModalClose]);

    const renderCurrentStep = useCallback(() => {
        switch (currentStep) {
            case FormStep.STEP_ONE:
                return <StepOne />;
            case FormStep.STEP_TWO:
                return <StepTwo />;
            case FormStep.STEP_THREE:
                return <StepThree />;
            default:
                return <StepOne />;
        }
    }, [currentStep]);

    const modalTitle = "Настройки доступа смен";

    if (!isOpen) return null;

    return (
        <Overlay onClick={handleOverlayClick}>
            <ModalContainer>
                <ModalHeader 
                    title={modalTitle} 
                    onClose={handleModalClose}
                    showCloseButton={false}
                />
                
                <AccessSettingsContext.Provider value={accessSettingsContextValue}>
                    {modalState === ModalState.FORM ? (
                        <ModalContent>
                            <StepsContainer
                                currentStep={currentStep}
                                direction={swipeDirection}
                                onSwipe={handleSwipe}
                                maxHeight="calc(100vh - 150px)"
                            >
                                {renderCurrentStep()}
                            </StepsContainer>
                        </ModalContent>
                    ) : (
                        <ModalContent>
                            <SuccessNotificationContainer>
                                <SuccessNotification 
                                    message="Настройки доступа к записи в смены были успешно сохранены."
                                    onConfirm={handleSuccessConfirm}
                                />
                            </SuccessNotificationContainer>
                        </ModalContent>
                    )}
                </AccessSettingsContext.Provider>
            </ModalContainer>
            
            {/* Модалка конфликта смен убрана - всегда используется жесткий режим */}
        </Overlay>
    );
}));

ShiftAccessModal.displayName = 'ShiftAccessModal';

export { AccessSettingsContext };
export default ShiftAccessModal;
