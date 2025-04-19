import styled, { keyframes } from 'styled-components';
import { Z_INDICES } from '../../constants';

const spin = keyframes`
    to {
        transform: rotate(360deg);
    }
`;

const pulse = keyframes`
    0% {
        transform: scale(0.95);
        opacity: 0.7;
    }
    50% {
        transform: scale(1);
        opacity: 1;
    }
    100% {
        transform: scale(0.95);
        opacity: 0.7;
    }
`;

const moveUpDown = keyframes`
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-10px);
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

const fadeScale = keyframes`
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
`;

export const LoadingContainer = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card-background);
    z-index: ${Z_INDICES.LOADING_OVERLAY};
    animation: ${fadeIn} 0.3s ease;
    padding: 20px;
`;

export const LoadingCard = styled.div`
    background-color: var(--card-background);
    border-radius: 20px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08), 0 6px 16px rgba(0, 0, 0, 0.05);
    padding: 40px 32px;
    width: 90%;
    max-width: 360px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: ${fadeScale} 0.5s ease;
    border: 1px solid rgba(0, 0, 0, 0.05);
    overflow: hidden;
    position: relative;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 50%;
        height: 100%;
        background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0) 100%
        );
        animation: shimmer 2.5s infinite;
    }
    
    @keyframes shimmer {
        0% {
            left: -100%;
        }
        100% {
            left: 200%;
        }
    }
`;

export const IconWrapper = styled.div`
    margin-bottom: 32px;
    position: relative;
    width: 100px;
    height: 100px;
    animation: ${moveUpDown} 2.5s infinite ease-in-out;
`;

export const Circle = styled.div`
    position: absolute;
    width: 100%;
    height: 100%;
    border: 5px solid rgba(76, 175, 80, 0.1);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: ${spin} 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
`;

export const CircleInner = styled(Circle)`
    width: 70%;
    height: 70%;
    top: 15%;
    left: 15%;
    border-width: 4px;
    border-color: rgba(76, 175, 80, 0.05);
    border-top-color: var(--primary-dark);
    animation-duration: 0.8s;
    animation-direction: reverse;
`;

export const CircleCore = styled(Circle)`
    width: 40%;
    height: 40%;
    top: 30%;
    left: 30%;
    border-width: 3px;
    border-color: rgba(76, 175, 80, 0.03);
    border-top-color: #388E3C;
    animation-duration: 0.6s;
`;

export const CalendarIconWrapper = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
`;

export const CalendarIcon = styled.div`
    position: relative;
    width: 34px;
    height: 36px;
    background: linear-gradient(150deg, var(--primary-color) 0%, var(--primary-dark) 100%);
    border-radius: 6px;
    box-shadow: 0 4px 10px rgba(var(--primary-rgb), 0.3);
    animation: ${pulse} 1.5s infinite ease-in-out;
    
    &::before {
        content: '';
        position: absolute;
        top: -5px;
        left: 6px;
        width: 22px;
        height: 10px;
        border-radius: 5px 5px 0 0;
        border: 3px solid var(--primary-color);
        border-bottom: none;
    }
    
    &::after {
        content: '';
        position: absolute;
        top: 8px;
        left: 6px;
        width: 22px;
        height: 20px;
        background: white;
        border-radius: 2px;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: #333;
    }
`;

export const LoadingTitle = styled.h3`
    color: var(--text-color);
    font-size: 1.4rem;
    margin: 0 0 16px 0;
    font-weight: 600;
`;

export const LoadingText = styled.div`
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin: 0;
    line-height: 1.5;
`;

export const ProgressBar = styled.div`
    width: 100%;
    height: 6px;
    background-color: rgba(var(--primary-rgb), 0.15);
    border-radius: 3px;
    margin-top: 28px;
    overflow: hidden;
    position: relative;
    
    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: -50%;
        width: 50%;
        height: 100%;
        background: linear-gradient(
            to right, 
            var(--primary-color) 10%, 
            var(--primary-dark) 90%
        );
        animation: progressAnimation 1.8s infinite;
    }
    
    @keyframes progressAnimation {
        0% {
            left: -50%;
        }
        100% {
            left: 100%;
        }
    }
`;

/* Оставляем старый Spinner для обратной совместимости */
export const Spinner = styled.div`
    width: 48px;
    height: 48px;
    border: 4px solid var(--primary-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: ${spin} 1s linear infinite;
    box-shadow: 0 2px 10px rgba(var(--primary-rgb), 0.2);
`; 