import React from 'react';
import styled from 'styled-components';
import WarningIcon from '@mui/icons-material/Warning';
import Tooltip from '@mui/material/Tooltip';

interface FrozenShiftIndicatorProps {
    size?: 'small' | 'medium' | 'large';
    showTooltip?: boolean;
}

const IndicatorWrapper = styled.div<{ $size: 'small' | 'medium' | 'large' }>`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const BlurredBackdrop = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    border-radius: 50%;
    z-index: 0;
`;

const TriangleContainer = styled.div<{ $size: 'small' | 'medium' | 'large' }>`
    position: relative;
    width: ${props => {
        switch (props.$size) {
            case 'small': return '24px';
            case 'medium': return '28px';
            case 'large': return '32px';
            default: return '28px';
        }
    }};
    height: ${props => {
        switch (props.$size) {
            case 'small': return '24px';
            case 'medium': return '28px';
            case 'large': return '32px';
            default: return '28px';
        }
    }};
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #FFC107 0%, #FFB300 100%);
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.3);
    animation: pulse 2s ease-in-out infinite;
    z-index: 1;
    
    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(255, 193, 7, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.3);
        }
        50% {
            transform: scale(1.08);
            box-shadow: 0 3px 10px rgba(255, 193, 7, 0.8), 0 0 0 2.5px rgba(255, 255, 255, 0.4);
        }
    }

    svg {
        color: #000;
        font-size: ${props => {
            switch (props.$size) {
                case 'small': return '14px';
                case 'medium': return '16px';
                case 'large': return '18px';
                default: return '16px';
            }
        }};
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }
`;

export const FrozenShiftIndicator: React.FC<FrozenShiftIndicatorProps> = ({
    size = 'medium',
    showTooltip = true
}) => {
    const indicator = (
        <IndicatorWrapper $size={size}>
            <BlurredBackdrop />
            <TriangleContainer $size={size}>
                <WarningIcon />
            </TriangleContainer>
        </IndicatorWrapper>
    );

    if (showTooltip) {
        return (
            <Tooltip 
                title="Смены заморожены администратором" 
                placement="top" 
                arrow
                sx={{ pointerEvents: 'auto' }}
            >
                <div style={{ 
                    pointerEvents: 'auto', 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0
                }}>
                    {indicator}
                </div>
            </Tooltip>
        );
    }

    return indicator;
};

