import React, { useState, useCallback, memo, createContext, useMemo } from 'react';
import {
    Overlay,
    ModalContainer,
    ModalContent,
    SuccessNotificationContainer
} from './ShiftAccessModal.styles';
import { StepOne, StepTwo, StepThree } from './StepsShiftAccess';
import { useStepNavigation, FormStep } from '../../ShiftAccessModal/hooks';
import { useAccessSettings } from '../../ShiftAccessModal/hooks/useAccessSettings';
import StepIndicator from './StepsShiftAccess/common/StepIndicator';
import StepsContainer from './StepsShiftAccess/common/StepsContainer';
import ModalHeader from './common/ModalHeader';
import ModalFooter from './common/ModalFooter';
import { SuccessNotification } from './common';
import { AccessSettings } from '../../../../store/slices/shiftsSlice';

interface ShiftAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatId?: string;
}

enum ModalState {
    FORM = 'form',
    SUCCESS = 'success',
}

export interface AccessSettingsContextType {
    settings: AccessSettings;
    isLoading: boolean;
    error: string | null;
    updateSettings: (updatedValues: Partial<AccessSettings>) => void;
}

export const AccessSettingsContext = createContext<AccessSettingsContextType>({
    settings: {} as AccessSettings,
    isLoading: false,
    error: null,
    updateSettings: () => {}
});

const ShiftAccessModal = memo(({ isOpen, onClose, chatId }: ShiftAccessModalProps) => {
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
    
    const {
        currentStep,
        goToNextStep,
        goToPrevStep,
        resetStep,
        isFirstStep,
        isLastStep,
        swipeDirection,
        // handleDragEnd: _handleDragEnd
    } = useStepNavigation({
        totalSteps: 3,
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
    
    const handleSave = useCallback(async () => {
        const success = await saveSettings();
        
        if (success) {
            setModalState(ModalState.SUCCESS);
        }
    }, [saveSettings]);
    
    const handleModalClose = useCallback(() => {
        if (isDirty) {
            resetSettings();
        }
        setModalState(ModalState.FORM);
        resetStep();
        onClose();
    }, [onClose, resetStep, isDirty, resetSettings]);
    
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
                    showCloseButton={true}
                />
                
                <AccessSettingsContext.Provider value={accessSettingsContextValue}>
                    {modalState === ModalState.FORM ? (
                        <>
                            <ModalContent>
                                <StepIndicator 
                                    currentStep={currentStep} 
                                    totalSteps={3} 
                                />
                                
                                <StepsContainer
                                    currentStep={currentStep}
                                    direction={swipeDirection}
                                    onSwipe={handleSwipe}
                                    maxHeight="calc(100vh - 250px)"
                                >
                                    {renderCurrentStep()}
                                </StepsContainer>
                            </ModalContent>
                            
                            <ModalFooter 
                                onCancel={handleModalClose}
                                onNext={goToNextStep}
                                onBack={goToPrevStep}
                                onSave={handleSave}
                                isLoading={isLoading}
                                isFirstStep={isFirstStep}
                                isLastStep={isLastStep}
                                isDirty={isDirty}
                            />
                        </>
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
});

ShiftAccessModal.displayName = 'ShiftAccessModal';

export default ShiftAccessModal;
