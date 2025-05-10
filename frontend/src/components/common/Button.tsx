import React from 'react';
import styled from 'styled-components';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'small' | 'medium' | 'large';
    fullWidth?: boolean;
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
    width: ${props => props.fullWidth ? '100%' : 'auto'};

    ${props => {
        switch (props.variant) {
            case 'secondary':
                return `
                    background-color: #E0E0E0;
                    color: #333333;
                    &:hover {
                        background-color: #D0D0D0;
                    }
                    &:active {
                        background-color: #C0C0C0;
                    }
                `;
            case 'danger':
                return `
                    background-color: #FF4444;
                    color: white;
                    &:hover {
                        background-color: #FF3333;
                    }
                    &:active {
                        background-color: #FF2222;
                    }
                `;
            default:
                return `
                    background-color: #4CAF50;
                    color: white;
                    &:hover {
                        background-color: #45a049;
                    }
                    &:active {
                        background-color: #3d8b40;
                    }
                `;
        }
    }}

    &:disabled {
        background-color: #CCCCCC;
        color: #666666;
        cursor: not-allowed;
        &:hover {
            background-color: #CCCCCC;
        }
    }
`;

export const Button: React.FC<ButtonProps> = ({ 
    children, 
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    ...props 
}) => {
    return (
        <StyledButton
            variant={variant}
            size={size}
            fullWidth={fullWidth}
            {...props}
        >
            {children}
        </StyledButton>
    );
}; 