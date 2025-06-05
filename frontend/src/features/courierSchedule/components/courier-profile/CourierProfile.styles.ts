import styled, { keyframes } from 'styled-components';
import { Button } from '@shared/components/Buttons/Button';

const spin = keyframes`
    to {
        transform: rotate(360deg);
    }
`;

const fadeInUp = keyframes`
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

export const ProfileContainer = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    background: var(--card-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    margin: 16px;
    border: 1px solid var(--border-color);
    transition: all var(--transition-normal);
    animation: ${fadeInUp} 0.5s ease-out;

    @media (max-width: 768px) {
        margin: 12px;
        padding: 20px;
    }

    @media (max-width: 480px) {
        margin: 8px;
        padding: 16px;
    }
`;

export const AvatarWrapper = styled.div`
    position: relative;
    width: 140px;
    height: 140px;
    margin-bottom: 20px;

    @media (max-width: 768px) {
        width: 120px;
        height: 120px;
    }

    @media (max-width: 480px) {
        width: 100px;
        height: 100px;
        margin-bottom: 16px;
    }
`;

export const AvatarContainer = styled.div`
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid var(--primary-color);
    position: relative;
    box-shadow: var(--shadow-md);
    transition: all var(--transition-normal);

    &:hover {
        transform: var(--hover-transform);
        box-shadow: var(--shadow-lg);
    }
`;

export const Avatar = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--transition-normal);

    &:hover {
        transform: scale(1.05);
    }
`;

export const CourierName = styled.h2`
    font-size: 28px;
    font-weight: 600;
    color: var(--text-color);
    margin: 12px 0;
    text-align: center;
    transition: color var(--transition-normal);

    @media (max-width: 768px) {
        font-size: 24px;
    }

    @media (max-width: 480px) {
        font-size: 20px;
        margin: 8px 0;
    }
`;

export const StatusText = styled.p<{ $isRegistered?: boolean }>`
    font-size: 18px;
    color: ${props => props.$isRegistered ? 'var(--success-color)' : 'var(--text-secondary)'};
    margin: 12px 0;
    text-align: center;
    font-weight: ${props => props.$isRegistered ? '500' : 'normal'};
    transition: all var(--transition-normal);

    @media (max-width: 768px) {
        font-size: 16px;
    }

    @media (max-width: 480px) {
        font-size: 14px;
        margin: 8px 0;
    }
`;

export const RegisterButton = styled(Button)`
    margin-top: 20px;
    padding: 14px 28px;
    font-size: 16px;
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-sm);

    &:hover:not(:disabled) {
        transform: var(--hover-transform);
        box-shadow: var(--shadow-md);
    }

    &:active:not(:disabled) {
        transform: var(--active-transform);
    }

    &:disabled {
        opacity: var(--disabled-opacity);
        cursor: not-allowed;
    }

    @media (max-width: 768px) {
        padding: 12px 24px;
        font-size: 15px;
    }

    @media (max-width: 480px) {
        padding: 10px 20px;
        font-size: 14px;
        margin-top: 16px;
    }
`;

export const LoadingOverlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--card-background);
    opacity: 0.8;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    backdrop-filter: blur(4px);
    animation: ${fadeInUp} 0.3s ease-out;
`;

export const LoadingSpinner = styled.div`
    width: 32px;
    height: 32px;
    border: 3px solid var(--primary-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: ${spin} 1s linear infinite;

    @media (max-width: 480px) {
        width: 24px;
        height: 24px;
        border-width: 2px;
    }
`; 