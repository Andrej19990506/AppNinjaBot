import React, { useState, useCallback, memo, createContext, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
    Overlay,
    ModalContainer,
    ModalContent,
    animationVariants,
    animationTransition
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
    chatId?: string;  // Добавляем необязательное свойство chatId
}

// Перечисление состояний модального окна
enum ModalState {
    FORM = 'form',        // Форма настроек
    SUCCESS = 'success',  // Уведомление об успешном сохранении
}

// Интерфейс для контекста настроек доступа
export interface AccessSettingsContextType {
    settings: AccessSettings;
    isLoading: boolean;
    error: string | null;
    updateSettings: (updatedValues: Partial<AccessSettings>) => void;
}

// Создаем контекст для настроек доступа
export const AccessSettingsContext = createContext<AccessSettingsContextType>({
    settings: {} as AccessSettings,
    isLoading: false,
    error: null,
    updateSettings: () => {}
});

// Основной компонент модального окна, обернутый в memo для предотвращения лишних рендеров
const ShiftAccessModal = memo(({ isOpen, onClose, chatId }: ShiftAccessModalProps) => {
    const [modalState, setModalState] = useState<ModalState>(ModalState.FORM);
    
    // Используем хук для управления настройками доступа
    const {
        settings,
        isLoading,
        error,
        isDirty,
        handleSettingsChange,
        saveSettings,
        resetSettings
    } = useAccessSettings({ chatId });
    
    // Используем хук для управления шагами и свайпами
    const {
        currentStep,
        goToNextStep,
        goToPrevStep,
        resetStep,
        isFirstStep,
        isLastStep,
        swipeDirection,
        handleDragEnd
    } = useStepNavigation({
        totalSteps: 3,
        onComplete: () => console.log('All steps completed')
    });
    
    // Создаем мемоизированное значение для контекста
    const accessSettingsContextValue = useMemo(() => ({
        settings,
        isLoading,
        error,
        updateSettings: handleSettingsChange
    }), [settings, isLoading, error, handleSettingsChange]);
    
    // Адаптер между handleDragEnd и onSwipe
    const handleSwipe = useCallback((direction: number) => {
        if (direction > 0) {
            goToPrevStep();
        } else {
            goToNextStep();
        }
    }, [goToNextStep, goToPrevStep]);
    
    // Мемоизируем обработчик клика по оверлею
    const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Не закрываем модальное окно при клике по оверлею во время отображения успешного уведомления
        if (modalState === ModalState.SUCCESS) return;
        
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose, modalState]);
    
    // Мемоизируем обработчик сохранения настроек
    const handleSave = useCallback(async () => {
        // Сохраняем настройки через хук
        const success = await saveSettings();
        
        if (success) {
            // Показываем уведомление об успешном сохранении
            setModalState(ModalState.SUCCESS);
        }
    }, [saveSettings]);
    
    // Обработчик подтверждения (кнопка OK в уведомлении об успехе)
    const handleSuccessConfirm = useCallback(() => {
        // Сначала возвращаем состояние формы
        setModalState(ModalState.FORM);
        // Сбрасываем шаг на первый
        resetStep();
        // Затем закрываем модальное окно
        onClose();
    }, [onClose, resetStep]);
    
    // Обработчик для сброса состояния модального окна при закрытии
    const handleModalClose = useCallback(() => {
        // Если есть несохраненные изменения, сбрасываем их
        if (isDirty) {
            resetSettings();
        }
        
        onClose();
        // Сбрасываем состояние с небольшой задержкой после закрытия
        setTimeout(() => {
            setModalState(ModalState.FORM);
            resetStep();
        }, 300);
    }, [onClose, resetStep, isDirty, resetSettings]);

    // Отрисовка компонента текущего шага
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

    // Константное имя модального окна для предотвращения пересоздания строки при каждом рендере
    const modalTitle = "Настройки доступа смен";

    // Используем AnimatePresence для анимации появления/исчезновения
    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <Overlay 
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={animationVariants.overlay}
                    transition={animationTransition.overlay}
                    onClick={handleOverlayClick}
                >
                    <ModalContainer
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={animationVariants.modal}
                        transition={animationTransition.modal}
                        layoutId="shiftAccessModal"
                    >
                        <ModalHeader 
                            title={modalTitle} 
                            onClose={handleModalClose}
                            showCloseButton={modalState === ModalState.FORM}
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
                                    <SuccessNotification 
                                        message="Настройки доступа к записи в смены были успешно сохранены."
                                        onConfirm={handleSuccessConfirm}
                                    />
                                </ModalContent>
                            )}
                        </AccessSettingsContext.Provider>
                    </ModalContainer>
                </Overlay>
            )}
        </AnimatePresence>
    );
});

// Устанавливаем отображаемое имя для компонента в React DevTools
ShiftAccessModal.displayName = 'ShiftAccessModal';

export default ShiftAccessModal;
