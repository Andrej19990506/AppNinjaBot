import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../../assets/images/Ninja.jpg';

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
    onSlotClick: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string) => void;
    onCourierClick?: (
        event: React.MouseEvent | React.TouchEvent,
        courier: ShiftSlotLocalType,
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => void;
    successAnimation?: boolean;
    pressAnimationActive?: boolean;
    isDragTarget?: boolean;
    isDragging?: boolean;
    draggableProvided?: any;
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

const SuccessCheckmark = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    background: rgba(76, 175, 80, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0);
    z-index: 6;
    pointer-events: none;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    
    &.active {
        opacity: 1;
        transform: scale(1);
        animation: success-pulse 2s forwards cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    &::before {
        content: "✓";
        color: white;
        font-size: 2.5rem;
        font-weight: bold;
        filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));
        animation: success-check 0.5s forwards cubic-bezier(0.34, 1.56, 0.64, 1);
        opacity: 0;
        transform: scale(0.5) rotate(-15deg);
    }
    
    @keyframes success-pulse {
        0% { 
            transform: scale(1); 
            background: rgba(76, 175, 80, 0.9);
        }
        70% { 
            transform: scale(1.1); 
            background: rgba(76, 175, 80, 0.9);
        }
        100% { 
            transform: scale(0); 
            background: rgba(76, 175, 80, 0);
            opacity: 0;
        }
    }
    
    @keyframes success-check {
        0% { 
            opacity: 0; 
            transform: scale(0.5) rotate(-15deg);
        }
        30% { 
            opacity: 1; 
            transform: scale(1.2) rotate(5deg);
        }
        100% { 
            opacity: 1; 
            transform: scale(1) rotate(0);
        }
    }
`;

const PressAnimation = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    border: 2px dashed var(--primary-color);
    background: rgba(76, 175, 80, 0.1);
    opacity: 0;
    transform: scale(0.95);
    transition: all 0.3s ease;
    pointer-events: none;
    z-index: 1;
    
    &.active {
        opacity: 1;
        transform: scale(1);
        animation: pulse-drop 1.5s infinite;
    }
    
    @keyframes pulse-drop {
        0% {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
        }
        50% {
            border-color: var(--primary-dark);
            box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
        }
        100% {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
        }
    }
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

// Стили для перетаскиваемого элемента
const DraggableWrapper = styled.div<{ $isDragging?: boolean }>`
    ${props => props.$isDragging && `
        z-index: 9999;
        pointer-events: auto;
        touch-action: none;
        transform: scale(1.1);
    `}
`;

// Добавляем ручку для перетаскивания для старших курьеров
const DragHandle = styled.div`
    position: absolute;
    top: -5px;
    right: -5px;
    width: 22px;
    height: 22px;
    background-color: #FFD700;
    border-radius: 50%;
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(0, 0, 0, 0.7);
    font-size: 12px;
    cursor: grab;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
    
    &:hover {
        transform: scale(1.1);
        background-color: #FFE44D;
    }
    
    &:active {
        cursor: grabbing;
        transform: scale(0.95);
    }
    
    &::after {
        content: '≡';
        font-weight: bold;
    }
`;

const ShiftSlot: React.FC<ShiftSlotProps> = React.memo(({
    shiftType,
    slotIndex,
    courier,
    currentUserId,
    isDraggable,
    onSlotClick,
    onCourierClick,
    successAnimation,
    pressAnimationActive,
    isDragTarget,
    isDragging,
    draggableProvided
}) => {
    const isOccupied = Boolean(courier?.userId);
    const isCurrentUser = courier?.userId === currentUserId;
    const [isPressed, setIsPressed] = useState(false);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Добавляем состояние, которое отслеживает, находится ли этот слот в процессе перетаскивания
    const [isBeingDragged, setIsBeingDragged] = useState(false);
    
    // Отслеживаем события начала и завершения операций перетаскивания
    useEffect(() => {
        // Обработчик начала перетаскивания
        const handleDragStart = (event: CustomEvent) => {
            // Проверяем, касается ли перетаскивание этого слота
            if (courier?.userId && event.detail.item.userId === courier.userId && 
                event.detail.sourceType === shiftType && event.detail.sourceIndex === slotIndex) {
                console.log('ShiftSlot: This slot is being dragged', shiftType, slotIndex);
                setIsBeingDragged(true);
                // Немедленно скрываем аватар в исходном слоте для избежания дублирования
                const avatarContainer = document.querySelector(`[data-draggable-id="${shiftType}-${slotIndex}"]`);
                if (avatarContainer && avatarContainer.parentElement) {
                    const slotButton = avatarContainer.parentElement;
                    slotButton.classList.add('source-drag-slot');
                }
            } else if (!courier) {
                // Если слот пустой, добавляем его как потенциальную цель для перетаскивания
                const slotButton = document.querySelector(`[data-testid="slot-${shiftType}-${slotIndex}"]`);
                if (slotButton) {
                    slotButton.classList.add('drop-target');
                    
                    // Добавляем data-атрибут для поиска при перетаскивании
                    (slotButton as HTMLElement).setAttribute('data-slot', JSON.stringify({
                        type: shiftType,
                        index: slotIndex
                    }));
                }
            }
        };
        
        // Обработчик завершения перетаскивания
        const handleDragEnd = (event: CustomEvent) => {
            const detail = event.detail || {};
            
            if (isBeingDragged) {
                console.log('ShiftSlot: Drag operation completed for this slot');
                setIsBeingDragged(false);
            }
            
            // Удаляем все классы после завершения перетаскивания
            const slotButton = document.querySelector(`[data-testid="slot-${shiftType}-${slotIndex}"]`);
            if (slotButton) {
                slotButton.classList.remove('source-drag-slot');
                slotButton.classList.remove('drop-target');
                slotButton.classList.remove('drop-active');
                slotButton.classList.remove('magnetic-target');
                
                // Удаляем data-атрибуты
                (slotButton as HTMLElement).removeAttribute('data-slot');
            }
            
            // Если это был успешный перенос и мы были целевым слотом
            if (detail.success && detail.targetType === shiftType && detail.targetIndex === slotIndex) {
                // Добавляем короткую анимацию успешной операции
                console.log('ShiftSlot: We were the target of successful drop');
                setTimeout(() => {
                    setIsBeingDragged(false);
                }, 200);
            }
        };
        
        // Обработчик успешного завершения перетаскивания
        const handleDragOperationComplete = (event: CustomEvent) => {
            // Проверяем, является ли это слот источником перетаскивания
            if (courier?.userId && event.detail.item.userId === courier.userId && 
                event.detail.sourceType === shiftType && event.detail.sourceIndex === slotIndex) {
                console.log('ShiftSlot: Forced cleanup for source slot after successful drag operation');
                setIsBeingDragged(true);
                
                // Через небольшую задержку снимаем состояние перетаскивания, чтобы 
                // визуально подтвердить, что слот больше не содержит аватара
                setTimeout(() => {
                    setIsBeingDragged(false);
                }, 200);
            }
            
            // Удаляем все классы эффекта магнита после любой операции
            const dropActiveSlots = document.querySelectorAll('.drop-active, .magnetic-target');
            dropActiveSlots.forEach(slot => {
                slot.classList.remove('drop-active');
                slot.classList.remove('magnetic-target');
            });
        };
        
        // Подписываемся на события
        document.addEventListener('dragOperationStart', handleDragStart as EventListener);
        document.addEventListener('customDragEnd', handleDragEnd as EventListener);
        document.addEventListener('dragOperationComplete', handleDragOperationComplete as EventListener);
        
        return () => {
            document.removeEventListener('dragOperationStart', handleDragStart as EventListener);
            document.removeEventListener('customDragEnd', handleDragEnd as EventListener);
            document.removeEventListener('dragOperationComplete', handleDragOperationComplete as EventListener);
        };
    }, [courier, shiftType, slotIndex, isBeingDragged]);
    
    // Функция для начала долгого нажатия
    const handleLongPressStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isOccupied || !courier || !isDraggable) return;
        
        // Устанавливаем состояние нажатия
        setIsPressed(true);
        
        // Передаем событие обработчику курьера, если он задан
        if (onCourierClick) {
            onCourierClick(e, courier, shiftType, slotIndex);
        }
        
        // Добавляем класс для визуального эффекта удержания
        const target = e.currentTarget;
        if (target) {
            target.classList.add('pressing');
        }
    };
    
    // Функция для окончания долгого нажатия
    const handleLongPressEnd = () => {
        setIsPressed(false);
        
        // Удаляем класс для визуального эффекта
        const avatarContainers = document.querySelectorAll('.courier-avatar-container');
        avatarContainers.forEach(container => {
            container.classList.remove('pressing');
        });
    };
    
    // Обработчик клика по слоту
    const handleSlotClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        // Если слот занят, ничего не делаем
        if (isOccupied) return;
        onSlotClick(shiftType, slotIndex);
    };
    
    // При размонтировании компонента, очищаем все таймеры
    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
        };
    }, []);
    
    // Рендерим содержимое с учетом предоставленных props
    const renderContent = () => {
        // Если слот находится в процессе перетаскивания, не отображаем аватар
        if (isBeingDragged) {
            return (
                <SlotButton 
                    onClick={handleSlotClick}
                    $isOccupied={false}
                    $isDragTarget={isDragTarget}
                    className={`slot-button empty ${isDragTarget ? 'drop-target' : ''}`}
                    aria-label={`${shiftType === 'day' ? 'Дневная' : 'Ночная'} смена, слот ${slotIndex + 1}`}
                    type="button"
                    data-testid={`slot-${shiftType}-${slotIndex}`}
                    data-occupied={false}
                    data-type={shiftType}
                    data-index={slotIndex}
                >
                    <PlusIcon>+</PlusIcon>
                </SlotButton>
            );
        }
        
        const content = (
            <SlotButton 
                onClick={handleSlotClick}
                $isOccupied={isOccupied}
                $isDragTarget={isDragTarget}
                className={`slot-button ${isOccupied ? 'occupied' : 'empty'} ${isDragTarget ? 'drop-target' : ''}`}
                aria-label={`${shiftType === 'day' ? 'Дневная' : 'Ночная'} смена, слот ${slotIndex + 1}`}
                type="button"
                data-testid={`slot-${shiftType}-${slotIndex}`}
                data-occupied={isOccupied}
                data-type={shiftType}
                data-index={slotIndex}
            >
                {isOccupied ? (
                    <CourierAvatarContainer 
                        className="courier-avatar-container"
                        $isDraggable={isDraggable}
                        $isDragging={isDragging}
                        onMouseDown={handleLongPressStart}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                        onTouchStart={handleLongPressStart}
                        onTouchEnd={handleLongPressEnd}
                        onTouchCancel={handleLongPressEnd}
                        data-draggable-id={`${shiftType}-${slotIndex}`}
                        data-type={shiftType}
                        data-index={slotIndex}
                    >
                        <CourierAvatarImage 
                            src={courier?.photo_url || defaultAvatar}
                            alt={`${courier?.firstName || ''} ${courier?.lastName || ''}`}
                            onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.src = defaultAvatar;
                            }}
                            draggable="false"
                        />
                        {courier?.isSeniorCourier && <SeniorBadge />}
                        
                        {/* Анимация успешного действия */}
                        <SuccessCheckmark className={successAnimation ? 'active' : ''} />
                        
                        {/* Анимация долгого нажатия */}
                        <PressAnimation className={pressAnimationActive ? 'active' : ''} />
                    </CourierAvatarContainer>
                ) : (
                    <PlusIcon>+</PlusIcon>
                )}
            </SlotButton>
        );
        
        // Если предоставлены props для drag-and-drop, оборачиваем контент
        if (draggableProvided && isDraggable && isOccupied) {
            return (
                <div
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    {...draggableProvided.dragHandleProps}
                    style={{
                        ...draggableProvided.draggableProps.style,
                        position: 'relative'
                    }}
                    data-draggable-id={`${shiftType}-${slotIndex}`}
                >
                    {content}
                </div>
            );
        }
        
        return content;
    };
    
    return renderContent();
});

export default ShiftSlot; 