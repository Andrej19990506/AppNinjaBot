import React from 'react';
import styled from 'styled-components';

interface CalendarIconProps {
    size?: number;
    className?: string;
}

const IconWrapper = styled.div<{ size: number }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${props => props.size}px;
    height: ${props => props.size}px;
`;

const CalendarIcon: React.FC<CalendarIconProps> = ({ size = 24, className }) => {
    return (
        <IconWrapper size={size} className={className}>
            <svg 
                width={size} 
                height={size} 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
            >
                <path 
                    d="M8 2V5" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                />
                <path 
                    d="M16 2V5" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                />
                <path 
                    d="M3.5 9.09H20.5" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                />
                <path 
                    fillRule="evenodd" 
                    clipRule="evenodd" 
                    d="M19 4.5H5C3.895 4.5 3 5.395 3 6.5V19C3 20.105 3.895 21 5 21H19C20.105 21 21 20.105 21 19V6.5C21 5.395 20.105 4.5 19 4.5Z" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                />
                <path 
                    d="M9.5 14.5H7.5C7.224 14.5 7 14.724 7 15V17C7 17.276 7.224 17.5 7.5 17.5H9.5C9.776 17.5 10 17.276 10 17V15C10 14.724 9.776 14.5 9.5 14.5Z" 
                    fill="var(--primary-color)" 
                    stroke="var(--primary-color)" 
                    strokeWidth="0.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                />
                <circle 
                    cx="12.5" 
                    cy="12.5" 
                    r="0.5" 
                    fill="currentColor" 
                />
                <circle 
                    cx="16.5" 
                    cy="12.5" 
                    r="0.5" 
                    fill="currentColor" 
                />
                <circle 
                    cx="12.5" 
                    cy="16.5" 
                    r="0.5" 
                    fill="currentColor" 
                />
                <circle 
                    cx="16.5" 
                    cy="16.5" 
                    r="0.5" 
                    fill="currentColor" 
                />
            </svg>
        </IconWrapper>
    );
};

export default CalendarIcon; 