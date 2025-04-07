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
    onTouchMove?: () => void;
    successAnimation: boolean;
    pressAnimationActive: boolean;
    isDragging: boolean;
    draggableProvided?: DraggableProvided;
    isLoading?: boolean;
    isError?: boolean;
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

// Добавляем стили для анимаций
const LoadingOverlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse 1.5s infinite;

    @keyframes pulse {
        0% {
            opacity: 0.6;
        }
        50% {
            opacity: 0.9;
        }
        100% {
            opacity: 0.6;
        }
    }
`;

const ErrorOverlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    background: rgba(244, 67, 54, 0.1);
    border: 2px solid #f44336;
    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;

    @keyframes shake {
        10%, 90% {
            transform: translate3d(-1px, 0, 0);
        }
        20%, 80% {
            transform: translate3d(2px, 0, 0);
        }
        30%, 50%, 70% {
            transform: translate3d(-4px, 0, 0);
        }
        40%, 60% {
            transform: translate3d(4px, 0, 0);
        }
    }
`;

const LoadingSpinner = styled.div`
    width: 24px;
    height: 24px;
    border: 3px solid var(--primary-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
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
    onTouchMove,
    successAnimation,
    pressAnimationActive,
    isDragging,
    draggableProvided,
    isLoading,
    isError
}) => {
    const isOccupied = Boolean(courier);
    const isCurrentUser = courier?.userId === currentUserId;

    // Добавляем лог при рендеринге слота с курьером
    if (isOccupied && courier) {
        console.log(`[ShiftSlot] Rendering slot with courier:`, {
            firstName: courier.firstName || 'undefined',
            lastName: courier.lastName || 'undefined',
            photo: courier.photo_url ? (courier.photo_url.substring(0, 30) + '...') : 'undefined',
            userId: courier.userId || 'undefined',
            isSeniorCourier: courier.isSeniorCourier,
            shiftType,
            slotIndex,
            fullCourier: courier
        });
    } else if (isOccupied) {
        console.warn(`[ShiftSlot] Slot marked as occupied but courier is undefined:`, { shiftType, slotIndex });
    }

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
            className={`slot-button ${isOccupied ? 'occupied' : ''} ${successAnimation ? 'success' : ''} ${pressAnimationActive ? 'press-active' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={handleSlotClick}
            $isOccupied={isOccupied}
            {...(draggableProvided ? draggableProvided.draggableProps : {})}
            {...(draggableProvided ? draggableProvided.dragHandleProps : {})}
            ref={draggableProvided ? draggableProvided.innerRef : null}
        >
            {isOccupied && courier ? (
                <CourierAvatarContainer
                    onClick={(e) => onCourierClick(e, courier, shiftType, slotIndex)}
                    onMouseDown={(e) => onCourierClick(e, courier, shiftType, slotIndex)}
                    onTouchStart={(e) => onCourierClick(e, courier, shiftType, slotIndex)}
                    onTouchMove={onTouchMove}
                    onTouchEnd={(e) => onCourierClick(e, courier, shiftType, slotIndex)}
                    className={`courier-avatar-container ${isDragging ? 'dragging' : ''}`}
                    $isDraggable={isDraggable}
                    $isDragging={isDragging}
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
            
            {/* Анимация загрузки */}
            {isLoading && (
                <LoadingOverlay>
                    <LoadingSpinner />
                </LoadingOverlay>
            )}
            
            {/* Анимация ошибки */}
            {isError && <ErrorOverlay />}
        </SlotButton>
    );
};

export default React.memo(ShiftSlot); 