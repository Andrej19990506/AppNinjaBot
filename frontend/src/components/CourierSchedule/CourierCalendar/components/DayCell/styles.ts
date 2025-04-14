import styled from 'styled-components';

interface DayCellContainerProps {
    $isToday?: boolean;
    $isSelected?: boolean;
    $hasShifts?: boolean;
    $isAvailable?: boolean;
}

export const DayCellContainer = styled.div<DayCellContainerProps>`
    aspect-ratio: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: var(--radius);
    padding: 2px;
    transition: all 0.2s ease;
    touch-action: pan-y;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    user-select: none;
    z-index: 1;
    
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    perspective: 1000;

    &:hover {
        background: var(--hover-color);
    }

    ${props => props.$isToday && `
        border: 2px solid var(--primary-color);
    `}

    ${props => props.$isSelected && `
        background: var(--primary-color);
        color: white;
    `}

    &:active {
        opacity: 0.9;
    }
`;

export const CourierAvatar = styled.img`
    width: 95%;
    height: 95%;
    border-radius: 50%;
    object-fit: cover;
    pointer-events: none;
    touch-action: none;
    transform: translate3d(0, 0, 0);
    
    @media (hover: hover) {
        &:hover {
            opacity: 0.9;
        }
    }
`;

export const DayNumber = styled.span<{ $isAvailable?: boolean }>`
    font-size: ${props => props.$isAvailable ? '1.1rem' : '1rem'};
    font-weight: ${props => props.$isAvailable ? '600' : 'normal'};
    color: ${props => props.$isAvailable ? '#4CAF50' : 'inherit'};
    position: relative;
    z-index: 1;
    line-height: 1;
    pointer-events: none;
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
`;

export const EmptySlotIndicator = styled.div`
    width: 90%;
    height: 90%;
    border-radius: 50%;
    border: 2px solid #4CAF50;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(76, 175, 80, 0.05);
    position: relative;
    overflow: hidden;
    
    pointer-events: none;
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    user-select: none;
    
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    will-change: auto;
    
    background-image: radial-gradient(
        circle, 
        rgba(255, 255, 255, 0.3) 0%, 
        rgba(76, 175, 80, 0.05) 70%
    );
`;

export const OccupiedSlotIndicator = styled(EmptySlotIndicator)`
    border-color: #FF3B30;
    background-color: rgba(255, 59, 48, 0.05);
    background-image: radial-gradient(
        circle, 
        rgba(255, 255, 255, 0.3) 0%, 
        rgba(255, 59, 48, 0.05) 70%
    );
`;

export const ReserveSlotIndicator = styled(EmptySlotIndicator)`
    border-color: #FF9500;
    background-color: rgba(255, 149, 0, 0.05);
    background-image: radial-gradient(
        circle, 
        rgba(255, 255, 255, 0.3) 0%, 
        rgba(255, 149, 0, 0.05) 70%
    );
`;

export const ReserveIcon = styled.div`
    position: absolute;
    top: -4px;
    right: -4px;
    width: 18px;
    height: 18px;
    background-color: #FF9500;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    font-weight: bold;
    pointer-events: none;
    touch-action: none;
    z-index: 2;
    border: 1px solid white;
    
    &::before {
        content: '!';
        display: inline-block;
    }
`;

export const LockIcon = styled.div`
    position: absolute;
    width: 16px;
    height: 16px;
    top: 58%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    background-color: #FF3B30;
    border-radius: 3px;
    pointer-events: none;
    touch-action: none;
    
    &::before {
        content: '🔒';
        font-size: 10px;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
    }
`; 