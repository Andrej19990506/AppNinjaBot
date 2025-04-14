import React, { useState, useCallback, memo, createContext, useMemo, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
    Overlay,
    ModalContainer,
    ModalContent,
    SuccessNotificationContainer
} from './ShiftAccessModal.styles';
import { StepOne, StepTwo, StepThree } from './StepsShiftAccess';
import { useStepNavigation, FormStep } from '../../ShiftAccessModal/hooks';
import { useAccessSettings } from '../../ShiftAccessModal/hooks/useAccessSettings';
import StepsContainer from './StepsShiftAccess/common/StepsContainer';
import ModalHeader from './common/ModalHeader';
import { SuccessNotification } from './common';
import { AccessSettings } from '../../../../store/slices/shiftsSlice';

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

export const AccessSettingsContext = createContext<AccessSettingsContextType>({
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
    const [modalState, setModalState] = useState<ModalState>(ModalState.FORM);
    
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
        swipeDirection
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
        console.log(`[ShiftAccessModal] Swiped. Direction: ${direction}.`);
        if (direction > 0) {
            goToPrevStep();
        } else {
            goToNextStep();
        }
    }, [goToNextStep, goToPrevStep]);
    
    const handleSaveAttempt = useCallback(async () => {
        const success = await saveSettings();
        if (success) {
            setModalState(ModalState.SUCCESS);
        }
        return success;
    }, [saveSettings]);
    
    const handleResetAttempt = useCallback(() => {
        resetSettings();
    }, [resetSettings]);
    
    const isStepValid = (step: number): boolean => {
        console.warn(`[ShiftAccessModal] isStepValid(${step}) check not implemented.`);
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
        onClose();
    }, [onClose]);
    
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
                console.warn(`[ShiftAccessModal] Unknown step: ${currentStep}. Rendering StepOne.`);
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
                    showCloseButton={true}
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
        </Overlay>
    );
}));

ShiftAccessModal.displayName = 'ShiftAccessModal';

export default ShiftAccessModal;
