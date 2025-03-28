import styled, { keyframes } from 'styled-components';
import { Z_INDICES } from '../../constants';

const spin = keyframes`
    to {
        transform: rotate(360deg);
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

export const LoadingContainer = styled.div`
    position: absolute;
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
`;

export const Spinner = styled.div`
    width: 48px;
    height: 48px;
    border: 4px solid var(--primary-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: ${spin} 1s linear infinite;
    box-shadow: 0 2px 10px rgba(var(--primary-rgb), 0.2);
`;

export const LoadingText = styled.div`
    position: absolute;
    top: 60%;
    left: 50%;
    transform: translateX(-50%);
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-top: 16px;
`; 