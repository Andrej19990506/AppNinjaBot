import React from 'react';
import styled from 'styled-components';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'small' | 'medium' | 'large';
    $fullWidth?: boolean;
}

const StyledButton = styled.button<ButtonProps>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: ${props => {
        switch (props.size) {
            case 'small': return '8px 16px';
            case 'large': return '16px 32px';
            default: return '12px 24px';
        }
    }};
    font-size: ${props => {
        switch (props.size) {
            case 'small': return '14px';
            case 'large': return '18px';
            default: return '16px';
        }
    }};
    font-weight: 500;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    width: ${props => props.$fullWidth ? '100%' : 'auto'};

    ${props => {
        switch (props.variant) {
            case 'secondary':
                return `
                    background-color: var(--button-secondary-bg, #E0E0E0);
                    color: var(--button-secondary-text, #333333);
                    &:hover {
                        background-color: var(--button-secondary-hover-bg, #D0D0D0);
                    }
                    &:active {
                        background-color: var(--gray-400, #C0C0C0);
                    }
                `;
            case 'danger':
                return `
                    background-color: var(--danger-color, #FF4444);
                    color: white;
                    &:hover {
                        background-color: var(--danger-dark, #FF3333);
                    }
                    &:active {
                        background-color: var(--error-color, #FF2222);
                    }
                `;
            default:
                return `
                    background-color: var(--primary-color, #FF5F1F);
                    color: var(--text-color-on-primary, white);
                    &:hover {
                        background-color: var(--primary-dark, #E64500);
                    }
                    &:active {
                        background-color: var(--orange-dark, #E64500);
                    }
                `;
        }
    }}

    &:disabled {
        background-color: var(--disabled-bg-color, #CCCCCC);
        color: var(--disabled-text-color, #666666);
        cursor: not-allowed;
        &:hover {
            background-color: var(--disabled-bg-color, #CCCCCC);
        }
    }
`;

export const Button: React.FC<ButtonProps> = ({ 
    children, 
    variant = 'primary',
    size = 'medium',
    $fullWidth = false,
    ...props 
}) => {
    return (
        <StyledButton
            variant={variant}
            size={size}
            $fullWidth={$fullWidth}
            {...props}
        >
            {children}
        </StyledButton>
    );
}; 