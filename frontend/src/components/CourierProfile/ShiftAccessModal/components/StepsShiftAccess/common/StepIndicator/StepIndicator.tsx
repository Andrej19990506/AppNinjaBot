import React from 'react';
import styled from 'styled-components';
import { FormStep } from '../../../../hooks';

// Стилизованные компоненты для индикатора шагов
const StepIndicatorWrapper = styled.div`
    display: flex;
    justify-content: center;
    padding-top: 8px;
`;

const StepDot = styled.div<{ active: boolean; completed: boolean }>`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin: 0 6px;
    background-color: ${props => 
        props.active 
            ? 'var(--primary-color)' 
            : props.completed 
                ? 'var(--primary-light)' 
                : 'var(--gray-300)'
    };
    transition: all 0.3s ease;
    position: relative;
    
    &::after {
        content: '';
        position: absolute;
        height: 2px;
        width: 12px;
        background-color: ${props => 
            props.completed ? 'var(--primary-light)' : 'var(--gray-300)'
        };
        top: 50%;
        transform: translateY(-50%);
        left: 10px;
        display: ${props => props.active && !props.completed ? 'none' : 'block'};
    }
    
    &:last-child::after {
        display: none;
    }
`;

interface StepIndicatorProps {
    currentStep: FormStep;
    totalSteps: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
    return (
        <StepIndicatorWrapper>
            {Array.from({ length: totalSteps }).map((_, index) => (
                <StepDot 
                    key={index}
                    active={currentStep === index} 
                    completed={currentStep > index} 
                />
            ))}
        </StepIndicatorWrapper>
    );
};

export default React.memo(StepIndicator); 