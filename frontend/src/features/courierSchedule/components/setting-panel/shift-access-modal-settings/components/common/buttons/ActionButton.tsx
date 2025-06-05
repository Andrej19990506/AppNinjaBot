import React from 'react';
import styled from 'styled-components';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
}

const StyledButton = styled.button<{ isLoading?: boolean }>`
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-normal);
    display: flex;
    align-items: center;
    justify-content: center;
    
    &:hover {
        background: var(--primary-dark);
        transform: var(--hover-transform);
    }
    
    &:active {
        transform: var(--active-transform);
    }
    
    &:disabled {
        opacity: var(--disabled-opacity);
        cursor: not-allowed;
        background: var(--primary-color);
        transform: none;
    }
`;

export const ActionButton: React.FC<ActionButtonProps> = ({ 
    children, 
    isLoading = false,
    disabled,
    ...props 
}) => {
    return (
        <StyledButton
            disabled={disabled || isLoading}
            isLoading={isLoading}
            {...props}
        >
            {isLoading ? 'Загрузка...' : children}
        </StyledButton>
    );
}; 