import React from 'react';
import { ModalFooter as Footer } from '../../ShiftAccessModal.styles';
import { ActionButton, CancelButton } from '../buttons';

interface ModalFooterProps {
    onCancel: () => void;
    onNext?: () => void;
    onBack?: () => void;
    onSave: () => void;
    isLoading: boolean;
    isFirstStep: boolean;
    isLastStep: boolean;
    isDirty?: boolean;
}

const ModalFooter: React.FC<ModalFooterProps> = ({ 
    onCancel, 
    onNext,
    onBack,
    onSave, 
    isLoading,
    isFirstStep,
    isLastStep,
    isDirty = false
}) => (
    <Footer>
        <CancelButton onClick={onCancel}>
            Отмена
        </CancelButton>
        
        {!isFirstStep && (
            <CancelButton onClick={onBack}>
                Назад
            </CancelButton>
        )}
        
        {!isLastStep ? (
            <ActionButton 
                onClick={onNext}
            >
                Далее
            </ActionButton>
        ) : (
            <ActionButton 
                onClick={onSave}
                isLoading={isLoading}
                disabled={!isDirty && !isLoading}
            >
                Сохранить
            </ActionButton>
        )}
    </Footer>
);

export default React.memo(ModalFooter); 