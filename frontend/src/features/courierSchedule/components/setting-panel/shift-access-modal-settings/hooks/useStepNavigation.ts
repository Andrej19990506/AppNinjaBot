import { useState, useCallback } from 'react';
import { PanInfo } from 'framer-motion';

// Перечисление шагов, которое мы перенесем из компонента ShiftAccessModal
export enum FormStep {
    STEP_ONE = 0,
    STEP_TWO = 1,
    STEP_THREE = 2
}

interface UseStepNavigationProps {
    initialStep?: FormStep; // Начальный шаг
    totalSteps: number; // Общее количество шагов
    onComplete?: () => void; // Callback, который вызывается при завершении всех шагов
    swipeThreshold?: number; // Порог свайпа для переключения шага (в пикселях)
    onStepChange?: (step: FormStep) => void; // Callback для изменения шага
}

interface UseStepNavigationReturn {
    currentStep: FormStep; // Текущий активный шаг
    setCurrentStep: (step: FormStep) => void; // Установка шага напрямую
    goToNextStep: () => void; // Перейти к следующему шагу
    goToPrevStep: () => void; // Перейти к предыдущему шагу
    resetStep: () => void; // Сбросить шаг до начального
    isFirstStep: boolean; // Находимся ли мы на первом шаге
    isLastStep: boolean; // Находимся ли мы на последнем шаге
    swipeDirection: number; // Направление последнего свайпа для анимации
    handleSwipe: (direction: number) => void; // Обработчик свайпа
    handleDragEnd: (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void; // Обработчик завершения перетаскивания для framer-motion
}

/**
 * Хук для управления пошаговой навигацией с поддержкой кнопок и свайпов
 */
export const useStepNavigation = ({
    initialStep = FormStep.STEP_ONE,
    totalSteps,
    onComplete,
    swipeThreshold = 100,
    onStepChange
}: UseStepNavigationProps): UseStepNavigationReturn => {
    const [currentStep, _setCurrentStep] = useState<FormStep>(initialStep);
    const [swipeDirection, setSwipeDirection] = useState<number>(0);
    
    // Обертка для setCurrentStep, вызывающая колбэк
    const setCurrentStep = useCallback((newStepOrCallback: FormStep | ((prevStep: FormStep) => FormStep)) => {
        _setCurrentStep(prevStep => {
            let newStep: FormStep;
            if (typeof newStepOrCallback === 'function') {
                newStep = newStepOrCallback(prevStep);
            } else {
                newStep = newStepOrCallback;
            }

            // Вызываем колбэк только если шаг действительно изменился
            if (newStep !== prevStep && onStepChange) {
                onStepChange(newStep);
            }
            return newStep;
        });
    }, [onStepChange]);

    // Переход к следующему шагу
    const goToNextStep = useCallback(() => {
        setCurrentStep(prevStep => {
            if (prevStep < totalSteps - 1) {
                return prevStep + 1;
            }
            
            // Если мы на последнем шаге и есть callback завершения, вызываем его
            if (onComplete && prevStep === totalSteps - 1) {
                onComplete();
            }
            
            return prevStep;
        });
    }, [totalSteps, onComplete, setCurrentStep]);
    
    // Переход к предыдущему шагу
    const goToPrevStep = useCallback(() => {
        setCurrentStep(prevStep => {
            if (prevStep > 0) {
                return prevStep - 1;
            }
            return prevStep;
        });
    }, [setCurrentStep]);
    
    // Сброс к начальному шагу
    const resetStep = useCallback(() => {
        setCurrentStep(initialStep);
        setSwipeDirection(0);
    }, [initialStep, setCurrentStep]);
    
    // Обработчик свайпа, который также устанавливает направление для анимации
    const handleSwipe = useCallback((direction: number) => {
        setSwipeDirection(direction);
        if (direction > 0) {
            goToPrevStep();
        } else {
            goToNextStep();
        }
    }, [goToNextStep, goToPrevStep]);
    
    // Обработчик завершения перетаскивания для Framer Motion
    const handleDragEnd = useCallback((e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const swipe = Math.abs(info.offset.x) > swipeThreshold;
        if (swipe) {
            const direction = info.offset.x > 0 ? 1 : -1;
            handleSwipe(direction);
        }
    }, [handleSwipe, swipeThreshold]);
    
    // Проверка, находимся ли мы на первом шаге
    const isFirstStep = currentStep === 0;
    
    // Проверка, находимся ли мы на последнем шаге
    const isLastStep = currentStep === totalSteps - 1;
    
    return {
        currentStep,
        setCurrentStep,
        goToNextStep,
        goToPrevStep,
        resetStep,
        isFirstStep,
        isLastStep,
        swipeDirection,
        handleSwipe,
        handleDragEnd
    };
}; 