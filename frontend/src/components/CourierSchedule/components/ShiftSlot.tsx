import React from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../../assets/images/Ninja.jpg';
import { DraggableProvided } from '@hello-pangea/dnd';

// Интерфейсы
interface ShiftSlotLocalType {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
}

interface ShiftSlotProps {
    shiftType: 'day' | 'night';
    slotIndex: number;
    courier?: ShiftSlotLocalType;
    currentUserId: string;
    isDraggable: boolean;
    onSlotClick: (shiftType: 'day' | 'night', slotIndex: number) => void;
    onCourierClick: (event: React.MouseEvent | React.TouchEvent, courier: ShiftSlotLocalType, shiftType: 'day' | 'night', slotIndex: number) => void;
    successAnimation: boolean;
    pressAnimationActive: boolean;
    isDragging: boolean;
    draggableProvided?: DraggableProvided;
}

// Стили
const SlotButton = styled.button<{ $isOccupied: boolean; $isDragTarget?: boolean }>`
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: ${props => props.$isOccupied ? 'transparent' : 'var(--background-paper)'};
    border: 2px solid ${props => props.$isOccupied ? 'transparent' : 'var(--border-color)'};
    cursor: ${props => props.$isOccupied ? 'default' : 'pointer'};
    transition: all 0.2s ease;
    color: var(--text-color);
    font-size: 1.5rem;
    padding: 0;
    
    &:hover {
        background-color: ${props => props.$isOccupied ? 'transparent' : 'var(--hover-color)'};
    }

    &.drop-target {
        border: 2px dashed var(--primary-color);
        background-color: rgba(76, 175, 80, 0.15);
        transform: scale(1.1);
    }
    
    &.drop-active {
        border: 2px solid var(--primary-color);
        background-color: rgba(76, 175, 80, 0.3);
        transform: scale(1.15);
        box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
        transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
`;

const PlusIcon = styled.div`
    color: var(--primary-color);
    font-size: 1.8rem;
    font-weight: 300;
`;

const CourierAvatarContainer = styled.div<{ $isDraggable?: boolean; $isDragging?: boolean }>`
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 50%;
    border: 2px solid var(--primary-color);
    transition: all 0.2s ease;
    -webkit-touch-callout: none !important;
    touch-action: none !important;
    pointer-events: ${props => props.$isDraggable ? 'auto' : 'none'} !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    -webkit-user-drag: none !important;
    user-drag: none !important;
    -webkit-tap-highlight-color: transparent !important;
    
    ${props => props.$isDraggable && `
        cursor: grab;
        
        &:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        &:active, &.pressing {
            cursor: grabbing;
            transform: scale(0.95);
        }
        
        &.dragging {
            opacity: 0.7;
            transform: scale(1.1);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            cursor: grabbing;
            z-index: 9999;
            transition: all 0.15s ease;
        }
        
        ${props.$isDragging && `
            opacity: 0.7;
            transform: scale(1.1);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            cursor: grabbing;
            z-index: 9999;
            transition: all 0.15s ease;
        `}
    `}
`;

const CourierAvatarImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 50%;
    overflow: hidden;
    -webkit-touch-callout: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
    -webkit-user-drag: none !important;
    user-drag: none !important;
    pointer-events: none !important;
`;

const SeniorBadge = styled.div`
    position: absolute;
    top: -3px;
    right: -3px;
    width: 16px;
    height: 16px;
    background-color: #FFD700;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    color: #FFFFFF;
    text-shadow: 0 0 1px rgba(0, 0, 0, 0.5);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 10;
    pointer-events: none;
    
    &::after {
        content: '★';
    }
`;

const ShiftSlot: React.FC<ShiftSlotProps> = ({
    shiftType,
    slotIndex,
    courier,
    currentUserId,
    isDraggable,
    onSlotClick,
    onCourierClick,
    successAnimation,
    pressAnimationActive,
    isDragging,
    draggableProvided
}) => {
    const isOccupied = Boolean(courier);
    const isCurrentUser = courier?.userId === currentUserId;

    // Обработчик клика по слоту
    const handleSlotClick = (e: React.MouseEvent | React.TouchEvent) => {
        // Если слот занят, не обрабатываем клик
        if (isOccupied) return;
        
        // Предотвращаем всплытие события
        e.stopPropagation();
        
        // Вызываем обработчик
        onSlotClick(shiftType, slotIndex);
    };

    return (
        <SlotButton
            data-testid={`slot-${shiftType}-${slotIndex}`}
            data-type={shiftType}
            data-index={slotIndex}
            data-occupied={isOccupied}
            className={`slot-button ${isOccupied ? 'occupied' : ''} ${successAnimation ? 'success-animation' : ''}`}
            onClick={handleSlotClick}
            $isOccupied={isOccupied}
            {...(draggableProvided ? draggableProvided.draggableProps : {})}
            {...(draggableProvided ? draggableProvided.dragHandleProps : {})}
            ref={draggableProvided ? draggableProvided.innerRef : null}
        >
            {isOccupied && courier ? (
                <CourierAvatarContainer
                    onClick={(e) => onCourierClick(e, courier, shiftType, slotIndex)}
                    onTouchStart={(e) => onCourierClick(e, courier, shiftType, slotIndex)}
                    onTouchEnd={(e) => onCourierClick(e, courier, shiftType, slotIndex)}
                    className={`courier-avatar-container ${isDragging ? 'dragging' : ''}`}
                    style={{
                        cursor: isDraggable ? 'grab' : 'pointer'
                    }}
                >
                    <CourierAvatarImage 
                        src={courier.photo_url || defaultAvatar}
                        alt={`${courier.firstName} ${courier.lastName}`}
                        className={isCurrentUser ? 'current-user' : ''}
                        onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = defaultAvatar;
                        }}
                    />
                    {courier.isSeniorCourier && <SeniorBadge />}
                </CourierAvatarContainer>
            ) : (
                <PlusIcon>+</PlusIcon>
            )}
        </SlotButton>
    );
};

export default React.memo(ShiftSlot); 