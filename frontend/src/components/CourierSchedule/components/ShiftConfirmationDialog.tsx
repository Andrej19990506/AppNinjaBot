import React from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ShiftConfirmationDialogProps {
    date: Date;
    pendingShift: {
        shiftType: 'day' | 'night';
        slotIndex: number;
        existingShiftId?: string;
    } | null;
    onConfirm: () => void;
    onCancel: () => void;
    isOpen: boolean;
}

// Стили
const ConfirmationModal = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.3s ease;
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;

const ConfirmationContent = styled.div`
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 90%;
    width: 350px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    position: relative;
    animation: scaleIn 0.3s ease;
    
    @keyframes scaleIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
`;

const CloseIcon = styled.button`
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    font-size: 18px;
    color: #666;
    cursor: pointer;
    padding: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #333;
    }
`;

const ConfirmationTitle = styled.h3`
    margin-top: 0;
    margin-bottom: 16px;
    font-weight: 500;
    font-size: 1.3rem;
    color: #333;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const ShiftTypeIcon = styled.span`
    font-size: 1.4rem;
`;

const ConfirmationText = styled.p`
    margin-bottom: 24px;
    color: #555;
    font-size: 0.95rem;
    line-height: 1.5;
`;

const ConfirmationButtons = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 12px;
`;

const Button = styled.button`
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
`;

const CancelButton = styled(Button)`
    background: #f1f1f1;
    color: #555;
    border: none;
    
    &:hover {
        background: #e5e5e5;
    }
    
    &:active {
        transform: scale(0.97);
    }
`;

const ConfirmButton = styled(Button)`
    background: var(--primary-color);
    color: white;
    border: none;
    
    &:hover {
        background: var(--primary-dark);
    }
    
    &:active {
        transform: scale(0.97);
    }
`;

const ConfirmIcon = styled.span`
    font-size: 1.1rem;
`;

const ShiftConfirmationDialog: React.FC<ShiftConfirmationDialogProps> = ({
    date,
    pendingShift,
    onConfirm,
    onCancel,
    isOpen
}) => {
    if (!isOpen || !pendingShift) return null;
    
    return (
        <ConfirmationModal onClick={onCancel}>
            <ConfirmationContent onClick={e => e.stopPropagation()}>
                <CloseIcon onClick={onCancel} title="Закрыть">✕</CloseIcon>
                <ConfirmationTitle>
                    <ShiftTypeIcon>
                        {pendingShift.shiftType === 'day' ? '☀️' : '🌙'}
                    </ShiftTypeIcon>
                    Подтверждение записи
                </ConfirmationTitle>
                <ConfirmationText>
                    Вы уверены, что хотите записаться на <strong>{pendingShift.shiftType === 'day' ? 'дневную' : 'вечернюю'}</strong> смену 
                    <br />на <strong>{format(date, 'd MMMM yyyy', { locale: ru })}</strong>?
                </ConfirmationText>
                <ConfirmationButtons>
                    <CancelButton onClick={onCancel}>
                        <ConfirmIcon>✕</ConfirmIcon> Отмена
                    </CancelButton>
                    <ConfirmButton onClick={onConfirm}>
                        <ConfirmIcon>✓</ConfirmIcon> Подтвердить
                    </ConfirmButton>
                </ConfirmationButtons>
            </ConfirmationContent>
        </ConfirmationModal>
    );
};

export default ShiftConfirmationDialog; 