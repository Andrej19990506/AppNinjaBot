import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import defaultAvatar from '@shared/assets/images/Ninja.jpg';

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
    userName?: string;
    userAvatar?: string;
}

const slideIn = keyframes`
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

const fadeIn = keyframes`
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
`;

const successAnimation = keyframes`
    0% {
        transform: scale(0.5);
        opacity: 0;
    }
    50% {
        transform: scale(1.2);
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
`;

const ConfirmationContainer = styled.div`
    padding: 16px;
    width: 100%;
    animation: ${slideIn} 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    
    @media (min-width: 768px) {
        padding: 24px;
    }
`;

const ConfirmationCard = styled.div`
    background: var(--card-background);
    border-radius: var(--radius-lg);
    padding: 20px;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-color);
    position: relative;
    overflow: hidden;
    width: 100%;
    min-height: 400px;
    display: flex;
    flex-direction: column;
    
    @media (min-width: 768px) {
        padding: 24px;
    }
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: var(--gradient-primary);
    }
`;

const SuccessOverlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--card-background);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: ${fadeIn} 0.3s ease-out;
    z-index: 10;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
`;

const UserAvatar = styled.div`
    width: 100px;
    height: 100px;
    border-radius: 50%;
    margin-bottom: 24px;
    position: relative;
    animation: ${successAnimation} 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    border: 3px solid var(--primary-color);
    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.2);
    background: var(--card-background);
    
    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: opacity 0.3s ease;
        border-radius: 50%;
    }
    
    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(45deg, rgba(var(--primary-rgb), 0.1), rgba(var(--primary-rgb), 0));
        pointer-events: none;
        border-radius: 50%;
    }
`;

const SuccessIcon = styled.div`
    position: absolute;
    bottom: -8px;
    right: -8px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid var(--card-background);
    box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.3);
    z-index: 2;
    
    svg {
        width: 20px;
        height: 20px;
        stroke: white;
        stroke-width: 2.5;
    }
`;

const SuccessMessage = styled.div`
    text-align: center;
    margin-bottom: 24px;
    animation: ${fadeIn} 0.3s ease-out 0.2s both;
    width: 100%;
    box-sizing: border-box;
    
    h3 {
        color: var(--text-color);
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 12px 0;
        background: var(--gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    p {
        color: var(--text-secondary);
        font-size: 1rem;
        margin: 0;
        line-height: 1.6;
        white-space: pre-line;
        
        strong {
            color: var(--primary-color);
            font-weight: 500;
        }
    }
`;

const ConfirmationHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    
    @media (max-width: 360px) {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
`;

const ShiftTypeIcon = styled.div`
    width: 48px;
    height: 48px;
    min-width: 48px;
    border-radius: 12px;
    background: var(--primary-transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    
    @media (max-width: 360px) {
        width: 40px;
        height: 40px;
        min-width: 40px;
        font-size: 20px;
    }
`;

const HeaderContent = styled.div`
    flex: 1;
`;

const Title = styled.h3`
    margin: 0 0 4px 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color);
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    
    @media (max-width: 360px) {
        font-size: 1.1rem;
    }
`;

const Subtitle = styled.div`
    color: var(--text-secondary);
    font-size: 0.95rem;
    
    @media (max-width: 360px) {
        font-size: 0.9rem;
    }
`;

const ConfirmationDetails = styled.div`
    margin: 20px 0;
    padding: 16px;
    background: var(--primary-transparent);
    border-radius: var(--radius);
    color: var(--text-color);
    font-size: 0.95rem;
    line-height: 1.5;
    
    @media (max-width: 360px) {
        padding: 12px;
        font-size: 0.9rem;
        margin: 16px 0;
    }
    
    strong {
        color: var(--primary-color);
        font-weight: 500;
    }
`;

const ButtonsContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 24px;
    
    @media (max-width: 360px) {
        grid-template-columns: 1fr;
        gap: 8px;
        margin-top: 20px;
    }
`;

const Button = styled.button`
    padding: 12px;
    border-radius: var(--radius);
    font-weight: 500;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all var(--transition-normal);
    will-change: transform;
    white-space: nowrap;
    width: 100%;
    min-height: 48px;
    
    @media (max-width: 360px) {
        font-size: 0.9rem;
        min-height: 44px;
    }
    
    svg {
        width: 20px;
        height: 20px;
        stroke: currentColor;
        stroke-width: 2;
        
        @media (max-width: 360px) {
            width: 18px;
            height: 18px;
        }
    }
    
    &:active {
        transform: scale(0.98);
    }
`;

const CancelButton = styled(Button)`
    background: var(--gray-100);
    color: var(--text-secondary);
    border: none;
    
    &:hover {
        background: var(--gray-200);
    }
    
    @media (max-width: 360px) {
        order: 2; // Меняем порядок кнопок на мобильных
    }
`;

const ConfirmButton = styled(Button)`
    background: var(--gradient-primary);
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.2);
    
    &:hover {
        box-shadow: 0 6px 16px rgba(var(--primary-rgb), 0.3);
        transform: translateY(-1px);
    }
    
    @media (max-width: 360px) {
        order: 1; // Меняем порядок кнопок на мобильных
    }
`;

const ErrorMessage = styled.div`
    color: var(--error-color);
    background-color: var(--error-background);
    border: 1px solid var(--error-border-color);
    padding: 10px 15px;
    border-radius: var(--radius);
    margin-top: 15px;
    text-align: center;
    font-size: 0.9rem;
`;

const Spinner = styled.div`
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid #fff;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

const ShiftConfirmationDialog: React.FC<ShiftConfirmationDialogProps> = ({
    date,
    pendingShift,
    onConfirm,
    onCancel,
    isOpen,
    userName,
    userAvatar
}) => {
    const [showSuccess, setShowSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    if (!isOpen || !pendingShift) return null;

    const handleConfirm = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            await onConfirm();
            setShowSuccess(true);
        } catch (err: any) {
            console.error('[ShiftConfirmationDialog] Error during onConfirm:', err);
            setErrorMsg(err?.message || 'Произошла неизвестная ошибка');
            setShowSuccess(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setErrorMsg(null);
        setShowSuccess(false);
        onCancel();
    };

    const handleSuccessClose = () => {
        setErrorMsg(null);
        setShowSuccess(false);
        onCancel();
    };

    return (
        <ConfirmationContainer>
            <ConfirmationCard>
                {showSuccess ? (
                    <SuccessOverlay>
                        <UserAvatar>
                            <img 
                                src={userAvatar || defaultAvatar} 
                                alt={userName || 'Пользователь'}
                                onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.src = defaultAvatar;
                                    img.style.opacity = '1';
                                }}
                                onLoad={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.opacity = '1';
                                }}
                                style={{ opacity: userAvatar ? '0' : '1' }}
                            />
                            <SuccessIcon>
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path 
                                        d="M20 6L9 17l-5-5" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </SuccessIcon>
                        </UserAvatar>
                        <SuccessMessage>
                            <h3>Запись подтверждена!</h3>
                            <p>
                                {userName ? `${userName}, вы` : 'Вы'} успешно записались на{' '}
                                <strong>{pendingShift.shiftType === 'day' ? 'дневную' : 'вечернюю'}</strong> смену
                                {'\n'}
                                {format(date, 'd MMMM yyyy', { locale: ru })}
                            </p>
                        </SuccessMessage>
                        <ConfirmButton onClick={handleSuccessClose} disabled={isLoading}>
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            OK
                        </ConfirmButton>
                    </SuccessOverlay>
                ) : (
                    <>
                        <ConfirmationHeader>
                            <ShiftTypeIcon>
                                {pendingShift.shiftType === 'day' ? '☀️' : '🌙'}
                            </ShiftTypeIcon>
                            <HeaderContent>
                                <Title>Подтверждение записи</Title>
                                <Subtitle>
                                    {format(date, 'd MMMM yyyy', { locale: ru })}
                                </Subtitle>
                            </HeaderContent>
                        </ConfirmationHeader>

                        <ConfirmationDetails>
                            Вы собираетесь записаться на <strong>{pendingShift.shiftType === 'day' ? 'дневную' : 'вечернюю'}</strong> смену.
                            Пожалуйста, подтвердите ваш выбор.
                        </ConfirmationDetails>

                        {errorMsg && (
                            <ErrorMessage>{errorMsg}</ErrorMessage>
                        )}

                        <ButtonsContainer>
                            <CancelButton onClick={handleCancel} disabled={isLoading}>
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Отмена
                            </CancelButton>
                            <ConfirmButton onClick={handleConfirm} disabled={isLoading}>
                                {isLoading ? (
                                    <Spinner /> 
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none">
                                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                                {isLoading ? 'Обработка...' : 'Подтвердить'}
                            </ConfirmButton>
                        </ButtonsContainer>
                    </>
                )}
            </ConfirmationCard>
        </ConfirmationContainer>
    );
};

export default ShiftConfirmationDialog; 