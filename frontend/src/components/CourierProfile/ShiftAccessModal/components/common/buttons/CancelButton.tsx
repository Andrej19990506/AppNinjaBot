import React from 'react';
import styled from 'styled-components';

interface CancelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const StyledButton = styled.button`
    background: var(--hover-overlay);
    color: var(--text-color);
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
        background: var(--active-overlay);
        transform: var(--hover-transform);
    }
    
    &:active {
        transform: var(--active-transform);
    }
    
    &:disabled {
        opacity: var(--disabled-opacity);
        cursor: not-allowed;
    }
`;

export const CancelButton: React.FC<CancelButtonProps> = ({ 
    children, 
    ...props 
}) => {
    return (
        <StyledButton {...props}>
            {children}
        </StyledButton>
    );
}; 