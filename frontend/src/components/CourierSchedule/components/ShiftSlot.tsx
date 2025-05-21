import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import styled, { css } from 'styled-components';
import { useSelector } from 'react-redux';
import { selectUsersById } from '../../../store/slices/userSlice';
import defaultAvatar from '../../../assets/images/Ninja.jpg';
// @ts-ignore
import { useDraggable, useDroppable, DraggableAttributes, DraggableSyntheticListeners, useDndContext } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import 'styled-components';
import { createGlobalStyle } from 'styled-components';

import type { ShiftSlot } from '../../../types/shifts';
import { logger } from '../../../utils/logger';
import { deleteShiftAsSenior } from '../../../services/courierApi';
import { useAppDispatch } from '../../../store/hooks';
import { removeShiftLocally } from '../../../store/slices/shiftsSlice';

const GlobalTooltipFix = createGlobalStyle`
  .shift-selection-dialog .MuiBottomDrawer-content,
  .shift-selection-dialog .MuiBottomDrawer-body,
  .shift-panel-container,
  .shift-grid-container,
  .slot-button {
    overflow: visible !important;
  }
`;

export interface ShiftSlotProps {
    shiftType: 'day' | 'night';
    slotIndex: number;
    courier?: ShiftSlot | null;
    currentUserId: string;
    isDisabled: boolean;
    onSlotClick: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction?: boolean) => void;
    isLoading: boolean;
    successAnimation: boolean;
    pressAnimationActive: boolean;
    isError: boolean;
    isSenior?: boolean;
    showSuccessMessage?: (message: string) => void;
    showErrorMessage?: (message: string) => void;
    isDraggingGlobal?: boolean;
    draggingShiftType?: 'day' | 'night' | null;
    isMovingFrom?: boolean;
    // Добавляем пропсы для useDraggable / useDroppable
    attributes?: DraggableAttributes;
    listeners?: DraggableSyntheticListeners;
    setNodeRef?: (node: HTMLElement | null) => void;
    isOver?: boolean;
    isDragging?: boolean;
    isPotentialDropTarget?: boolean;
    // Добавляем пропс для открытия профиля курьера
    onOpenProfile?: (courier: ShiftSlot) => void;
    // <<< НОВЫЕ ПРОПСЫ ДЛЯ ТУЛТИПА >>>
    isActiveTooltip?: boolean;
    onRequestTooltip?: (type: 'day' | 'night', index: number) => void;
    // <<< НОВЫЙ ПРОП ДЛЯ ДОЛГОГО НАЖАТИЯ (УБИРАЕМ ОПЦИОНАЛЬНОСТЬ) >>>
    onLongPressEmptySlot: (shiftType: 'day' | 'night', slotIndex: number) => void;
    $isPanelDragActive?: boolean;
    // Новые пропсы для слота старшего курьера
    isSeniorCourierSlot?: boolean; // Является ли слотом для старшего курьера
}

// Стили
const SlotButton = styled.button<{
    $isOccupied: boolean;
    $isDisabled: boolean;
    $isDropTarget?: boolean;
    $isAvailableEmpty?: boolean;
    $isPotentialDropTarget?: boolean;
    $isPanelDragActive?: boolean; // Флаг остается
    $isSeniorSlot?: boolean; // Добавляем флаг для стилизации слота старшего курьера
}>`
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    transition: all 0.2s ease;
    color: var(--text-color);
    font-size: 1.5rem;
    padding: 0;
    
    ${props => {
        if (props.$isSeniorSlot) {
            // Стиль для слота старшего курьера (даже если он пустой)
            return css`
                background-color: ${props.$isOccupied ? 'transparent' : 'rgba(255, 215, 0, 0.05)'};
                border: 2px dashed #FFD700;
                box-shadow: ${props.$isOccupied ? 'none' : '0 0 10px rgba(255, 215, 0, 0.3)'};
                cursor: ${props.$isDisabled ? 'not-allowed' : 'pointer'};
            `;
        } else if (props.$isAvailableEmpty) {
            return css`
                background-color: var(--card-background);
                border: 2px dashed var(--primary-color);
                cursor: pointer;
            `;
        } else if (props.$isDisabled && !props.$isOccupied) {
            return css`
                background-color: var(--gray-100, #242424);
                border: 2px solid var(--gray-300, #333333);
                cursor: not-allowed;
            `;
        } else if (props.$isOccupied) {
            return css`
                background-color: transparent;
                border: 2px solid transparent;
                cursor: default;
            `;
        } else {
            return css`
                background-color: var(--card-background);
                border: 2px solid var(--border-color);
                cursor: pointer;
            `;
        }
    }}
    
    &:hover {
        ${props => {
            if (props.$isSeniorSlot && !props.$isOccupied) {
                return css`
                    background-color: rgba(255, 215, 0, 0.1);
                    border: 2px dashed #FFD700;
                    box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
                `;
            } else if (props.$isAvailableEmpty) {
                return css`
                    background-color: var(--hover-overlay);
                    border: 2px dashed var(--primary-color);
                `;
            } else if (props.$isDisabled && !props.$isOccupied) {
                return `/* No hover */`;
            } else if (props.$isOccupied) {
                return `/* Handled by Avatar */`;
            } else {
                return css`
                    background-color: var(--hover-overlay);
                    border-color: var(--border-color);
                `;
            }
        }}
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

    ${props => props.$isDropTarget && css`
        border: 2px dashed var(--primary-color);
        background-color: rgba(var(--primary-color-rgb), 0.1);
        transform: scale(1.05);
        box-shadow: var(--shadow-lg);
        transition: transform 0.1s ease-out, background-color 0.1s ease-out, border-color 0.1s ease-out, box-shadow 0.1s ease-out;
    `}

    ${props => (props.$isPanelDragActive || props.$isPotentialDropTarget) && props.$isAvailableEmpty && !props.$isDropTarget && css`
        border-color: var(--primary-color);
        border-style: dashed;
        box-shadow: 0 0 8px 2px var(--primary-color);
        transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    `}


`;

const PlusIcon = styled.div<{$isDisabled: boolean}>`
    color: ${props => props.$isDisabled ? 'var(--gray-600, #737373)' : 'var(--primary-color)'};
    font-size: 1.8rem;
    font-weight: 300;
`;

const CourierAvatarContainer = styled.div<{
    $isDragging?: boolean;
    $isDisabled: boolean;
    $canDrag: boolean;
}>`
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 50%;
    border: 2px solid var(--primary-color);
    transition: all 0.2s ease;
    -webkit-touch-callout: none !important;
    pointer-events: auto;
    user-select: none !important;
    -webkit-user-select: none !important;
    -webkit-user-drag: none !important;
    user-drag: none !important;
    opacity: ${props => props.$isDisabled ? 0.5 : (props.$isDragging ? 0.4 : 1)};
    cursor: ${props => props.$isDisabled ? 'not-allowed' : (props.$canDrag ? 'grab' : 'default')};
    transform-style: preserve-3d;

    ${props => props.$canDrag && `
        &:hover {
           transform: scale(1.05);
           box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        &:active {
            cursor: grabbing;
            transform: scale(0.95);
        }
    `}
    
    ${props => props.$isDragging && `
        /* При перетаскивании не трансформируем, просто меняем прозрачность */
        transform: none !important; 
        cursor: grabbing;
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

const DeleteConfirmationIcon = styled.div`
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(244, 67, 54, 0.7);
    color: white;
    width: 100%; height: 100%;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: bold;
    cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    z-index: 5; opacity: 1; transition: opacity 0.3s ease;
`;



// <<< Контейнер для Tooltip >>>
const TooltipWrapper = styled.div`
    position: relative; /* Для позиционирования тултипа */
    width: 100%;
    height: 100%;
    overflow: visible;
`;

// Компонент тултипа, который будет рендериться через портал
const TooltipPortal: React.FC<{
    isVisible?: boolean;
    anchorElement: HTMLElement | null;
    tooltipContent: React.ReactNode;
    courier: ShiftSlot;
    onOpenProfile?: (courier: ShiftSlot) => void;
    onRequestTooltip?: (type: 'day' | 'night', index: number) => void;
    shiftType: 'day' | 'night';
    slotIndex: number;
}> = ({ 
    isVisible, 
    anchorElement, 
    tooltipContent, 
    courier, 
    onOpenProfile,
    onRequestTooltip,
    shiftType,
    slotIndex
}) => {
    // Если тултип не должен быть виден, не рендерим ничего
    if (!isVisible || !anchorElement) return null;
    
    const openProfileDirectly = () => {
        // Закрываем тултип
        if (onRequestTooltip) {
            onRequestTooltip(shiftType, slotIndex);
        }
        
        if (onOpenProfile) {
            // ВАЖНОЕ ИЗМЕНЕНИЕ: Передаем объект courier напрямую.
            // Предполагается, что 'courier' уже содержит все необходимые и корректные данные (включая date и shiftType самой смены).
            onOpenProfile(courier);
            return;
        } else {
            logger.warn('[TooltipPortal] onOpenProfile handler is not available!');
        }
    };
    
    // Вычисляем позицию относительно элемента-якоря
    const anchorRect = anchorElement.getBoundingClientRect();
    
    // Портал в body
    return ReactDOM.createPortal(
        <div 
            style={{
                position: 'fixed',
                left: `${anchorRect.left + anchorRect.width / 2}px`,
                top: `${anchorRect.top - 10}px`,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                padding: '10px 15px',
                borderRadius: '4px',
                fontSize: '12px',
                minWidth: '120px',
                textAlign: 'center',
                zIndex: 99999, // Убедимся, что zIndex достаточно высокий
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}
            data-tooltip-portal="true"
            onClick={(e) => {
                e.stopPropagation(); 
            }}
        >
            <div>{tooltipContent}</div>
            {courier.isSeniorCourier && <div style={{ color: '#FFD700' }}>Старший курьер ★</div>}
            
            <button 
                style={{ 
                    marginTop: '10px',
                    width: '100%',
                    padding: '8px 12px', 
                    backgroundColor: 'var(--primary-color)',
                    color: 'var(--text-color-on-primary)',
                    border: 'none', 
                    borderRadius: 'var(--radius-sm, 4px)',
                    cursor: 'pointer', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    transition: 'background-color 0.2s ease'
                }} 
                onMouseDownCapture={(e) => {
                    e.stopPropagation(); 
                    openProfileDirectly();
                }}
            >
                Открыть профиль
            </button>
            
            <div style={{
                position: 'absolute',
                left: '50%',
                top: '100%',
                transform: 'translateX(-50%)',
                borderWidth: '6px',
                borderStyle: 'solid',
                borderColor: 'rgba(0, 0, 0, 0.8) transparent transparent transparent'
            }}></div>
        </div>,
        document.body
    );
};

// Дополнительные стили для слота старшего курьера
const SeniorSlotIndicator = styled.div`
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: rgba(255, 215, 0, 0.1);
    pointer-events: none;
    z-index: 1;

    &::before {
        content: '+';
        font-size: 24px;
        color: #FFD700;
        opacity: 0.8;
    }
`;

const ShiftSlotComponent: React.FC<ShiftSlotProps> = React.memo(({
    shiftType,
    slotIndex,
    courier,
    currentUserId,
    isDisabled: propIsDisabled,
    onSlotClick,
    successAnimation,
    pressAnimationActive,
    isLoading,
    isError,
    isSenior,
    showSuccessMessage,
    showErrorMessage,
    draggingShiftType,
    isDraggingGlobal,
    onOpenProfile,
    isActiveTooltip,
    onRequestTooltip,
    onLongPressEmptySlot,
    $isPanelDragActive,
    isSeniorCourierSlot = false,
}): React.ReactElement | null => {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isDeletingSelf, setIsDeletingSelf] = useState(false);
    const confirmationTimerRef = useRef<NodeJS.Timeout | null>(null);
    const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const dispatch = useAppDispatch();

    const usersById = useSelector(selectUsersById);
    const courierUserId = useMemo(() => {
        const id = courier?.userId;
        if (typeof id === 'string') return parseInt(id, 10);
        if (typeof id === 'number') return id;
        return null;
    }, [courier?.userId]);

    const courierInfoFromRedux = useMemo(() =>
        courierUserId ? usersById[courierUserId] : null,
        [usersById, courierUserId]
    );

    useEffect(() => {
        logger.debug(`[ShiftSlot ${shiftType}-${slotIndex}] Render/Prop Update. Courier Prop:`, courier ? { id: courier.id, userId: courier.userId, name: courier.firstName } : null);
    }, [courier, shiftType, slotIndex]);

    const isOccupied = Boolean(courier);
    const isCurrentUser = isOccupied && courier?.userId === currentUserId;
    
    // Определяем видимость слота (для старшего слота)
    // ПРАВИЛЬНАЯ ЛОГИКА:
    // Слот видим если:
    // 1. Это НЕ слот старшего курьера, ИЛИ
    // 2. Это слот старшего курьера И (он занят ИЛИ текущий пользователь старший курьер)
    const isSlotVisible = !isSeniorCourierSlot || (isSeniorCourierSlot && (isOccupied || isSenior));
    
    // Доступен ли пустой слот старшего курьера для занятия
    const canBookSeniorSlot = isSeniorCourierSlot && !isOccupied && isSenior;
    
    // Для стилизации слота
    const isDisabledForStyles = (!isOccupied && propIsDisabled) || isDeletingSelf || (isSeniorCourierSlot && !isSenior && !isOccupied);
    const isClickDisabled = isLoading || isError || isDisabledForStyles;
    
    const isCurrentUserSlot = isOccupied && courier && String(courier.userId) === currentUserId;
    const canDeleteSelf = isSenior && isCurrentUserSlot;

    const canDrag = isOccupied && (isSenior ?? false) && !isCurrentUser; 
    
    const draggableId = courier ? `shift-${shiftType}-${slotIndex}-${courier.userId}` : `empty-${shiftType}-${slotIndex}`;
    
    const { 
        attributes: dragAttributes, 
        listeners: dragListeners, 
        setNodeRef: setDraggableNodeRef, 
        isDragging,
        active, 
        over 
    } = useDraggable({
        id: draggableId,
        disabled: !canDrag,
        data: { 
            type: 'shift',
            courier: courier, 
            shiftType: shiftType,
            slotIndex: slotIndex,
            shiftDbId: courier?.id
        }
    });
    
    if (isDragging) {
        console.log(`[ShiftSlot ${shiftType}-${slotIndex}] DRAGGING ACTIVE (Brief):`, { id: active?.id, overId: over?.id });
    }
    
    const style: React.CSSProperties = isDragging ? {
        touchAction: 'none',
    } : { touchAction: 'none' };

    const showSeniorBadge = isOccupied && courier?.isSeniorCourier;

    useEffect(() => {
        return () => {
            if (confirmationTimerRef.current) {
                clearTimeout(confirmationTimerRef.current);
            }
        };
    }, []);

    const resetState = useCallback(() => {
        if (confirmationTimerRef.current) {
            clearTimeout(confirmationTimerRef.current);
            confirmationTimerRef.current = null;
        }
        setIsConfirmingDelete(false);
        logger.log(`[ShiftSlotComponent ${shiftType}-${slotIndex}] State reset (delete confirm only).`);
    }, [shiftType, slotIndex]);

    useEffect(() => {
        if (isConfirmingDelete) {
            logger.log(`[ShiftSlotComponent ${shiftType}-${slotIndex}] Confirmation active. Starting timer.`);
            confirmationTimerRef.current = setTimeout(() => {
                logger.log(`[ShiftSlotComponent ${shiftType}-${slotIndex}] Confirmation timeout. Resetting state.`);
                resetState();
            }, 4000);
        }
        return () => {
            if (confirmationTimerRef.current) {
                clearTimeout(confirmationTimerRef.current);
            }
        };
    }, [isConfirmingDelete, resetState, shiftType, slotIndex]);

    const handleDeleteSelf = useCallback(async () => {
        if (!courier || isDeletingSelf) {
            logger.warn(`[ShiftSlotComponent ${shiftType}-${slotIndex}] handleDeleteSelf called with invalid state or no courier data.`);
            return; 
        }
        if (!courier.id) {
             logger.warn(`[ShiftSlotComponent ${shiftType}-${slotIndex}] handleDeleteSelf called but courier has no ID.`);
             return;
        }
        
        setIsDeletingSelf(true);
        resetState(); 
        const shiftDbId = courier.id;
        logger.log(`[ShiftSlotComponent ${shiftType}-${slotIndex}] Deleting own shift ${shiftDbId} by user ${currentUserId}`);

        try {
            await deleteShiftAsSenior(shiftDbId, String(currentUserId)); 
            dispatch(removeShiftLocally(shiftDbId));
            logger.info(`[ShiftSlotComponent ${shiftType}-${slotIndex}] Dispatched removeShiftLocally for ${shiftDbId} after self-delete API call.`);
            if (showSuccessMessage) {
                showSuccessMessage('Ваша смена успешно удалена.');
            }
        } catch (error: any) {
            logger.error(`[ShiftSlotComponent ${shiftType}-${slotIndex}] Error deleting own shift:`, error);
            if (showErrorMessage) {
                showErrorMessage(error.message || 'Ошибка удаления смены');
            }
        } finally {
            setIsDeletingSelf(false);
        }
    }, [courier, currentUserId, resetState, showSuccessMessage, showErrorMessage, shiftType, slotIndex, isDeletingSelf, dispatch]);

    const handleAvatarClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation(); 
        if (isDeletingSelf) return;

        logger.log(`[ShiftSlotComponent ${shiftType}-${slotIndex}] Avatar clicked. Current confirmation: ${isConfirmingDelete}, Requesting tooltip.`);

        if (canDeleteSelf && isConfirmingDelete) {
            handleDeleteSelf();
        } else if (canDeleteSelf) {
            if (onRequestTooltip) {
                onRequestTooltip(shiftType, slotIndex);
            }
            resetState();
            setIsConfirmingDelete(true);
        } else {
            if (onRequestTooltip) {
                onRequestTooltip(shiftType, slotIndex);
            }
            resetState(); 
        }
    };

    const handleEmptySlotClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!isDisabledForStyles) {
            logger.log(`[ShiftSlot ${shiftType}-${slotIndex}] Empty slot clicked.`);
            onSlotClick(shiftType, slotIndex);
        }
    };

    const tooltipText = useMemo(() => {
        if (!courier) return '';
        const firstName = courierInfoFromRedux?.first_name ?? courier.firstName ?? '';
        const lastName = courierInfoFromRedux?.last_name ?? courier.lastName ?? '';
        const name = `${firstName} ${lastName}`.trim();
        const idText = name ? name : `ID: ${courier.userId}`;
        return courier.isSeniorCourier ? `${idText}\nСтарший курьер ★` : idText;
    }, [courier, courierInfoFromRedux]);

    const droppableId = `empty-drop-${shiftType}-${slotIndex}`;
    const { 
        isOver,
        setNodeRef: setDroppableNodeRef 
    } = useDroppable({
        id: droppableId,
        disabled: isOccupied || isSeniorCourierSlot,
        data: {
            type: 'empty-slot',
            shiftType: shiftType,
            slotIndex: slotIndex,
        }
    });

    const isInvalidDropTarget = useMemo(() => {
        return isOver && !isOccupied && draggingShiftType === shiftType;
    }, [isOver, isOccupied, draggingShiftType, shiftType]);

    const isAvailableEmpty = !isOccupied && !propIsDisabled;

    const isPotentialDropTarget = useMemo(() => {
        return isDraggingGlobal && !isOccupied && draggingShiftType !== null && draggingShiftType !== shiftType;
    }, [isDraggingGlobal, isOccupied, draggingShiftType, shiftType]);

    const setCombinedNodeRef = useCallback((node: HTMLElement | null) => {
        if (canDrag) {
            setDraggableNodeRef(node);
        } else if (!isOccupied) {
            setDroppableNodeRef(node);
        }
    }, [canDrag, isOccupied, setDraggableNodeRef, setDroppableNodeRef]);

    const listeners = canDrag ? dragListeners : undefined;
    const attributes = canDrag ? dragAttributes : {};

    const handlePointerDown = () => {
        logger.debug(`[ShiftSlot PointerDown ${shiftType}-${slotIndex}] Checking long press conditions:`, {
            isCourierPresent: !!courier,
            isDisabledSlot: isDisabledForStyles,
            isUserSenior: isSenior,
            isHandlerDefined: !!onLongPressEmptySlot
        });

        if (!courier && isSenior && onLongPressEmptySlot) {
            setLongPressTriggered(false);
            longPressTimeoutRef.current = setTimeout(() => {
                logger.debug(`[ShiftSlotComponent] Long press detected on empty slot: ${shiftType} ${slotIndex}`);
                onLongPressEmptySlot(shiftType, slotIndex);
                setLongPressTriggered(true);
            }, 500);
        } else {
             logger.debug(`[ShiftSlot PointerDown ${shiftType}-${slotIndex}] Long press conditions NOT met.`);
        }
    };

    const handlePointerUpOrLeave = () => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (longPressTimeoutRef.current) {
                clearTimeout(longPressTimeoutRef.current);
            }
        };
    }, []);

    const { active: dndActive } = useDndContext();
    const isPanelDragActive = dndActive?.data.current?.type === 'courier-from-panel';
    const isSlotDragActive = dndActive?.data.current?.type === 'shift-slot';

    useEffect(() => {
        if (active) {
            logger.debug(`[ShiftSlot ${shiftType}-${slotIndex}] Drag active. States:`, {
                activeDragType: active.data.current?.type,
                isPanelDragActive_local: isPanelDragActive,
                isSlotDragActive_local: isSlotDragActive,
                isPotentialDropTarget_local: isPotentialDropTarget,
                isAvailableEmpty_local: isAvailableEmpty,
                isDroppableOver_local: isOver,
                isDisabled_prop: propIsDisabled,
                isDisabled_local: isDisabledForStyles
            });
        }
    }, [active, shiftType, slotIndex, isPanelDragActive, isSlotDragActive, isPotentialDropTarget, isAvailableEmpty, isOver, propIsDisabled, isDisabledForStyles]);

    // Добавляем реф для доступа к DOM-элементу аватара
    const avatarRef = useRef<HTMLDivElement>(null);

    // Добавляем лог при монтировании и изменении isSeniorCourierSlot
    useEffect(() => {
        logger.debug(`[ShiftSlot ${shiftType}-${slotIndex}] isSeniorCourierSlot=${isSeniorCourierSlot}, isSenior=${isSenior}, isOccupied=${isOccupied}, isSlotVisible=${isSlotVisible}`);
    }, [isSeniorCourierSlot, isSenior, courier, shiftType, slotIndex, isOccupied, isSlotVisible]);

    // Если слот не должен быть видим, не рендерим его
    if (!isSlotVisible) return null;

    // <<< НАЧАЛО ИЗМЕНЕНИЯ: Логика скрытия пустого слота старшего для не-старших >>>
    if (isSeniorCourierSlot && !isOccupied && !isSenior) {
        logger.debug(`[ShiftSlot ${shiftType}-${slotIndex}] Hiding empty senior slot for non-senior user.`);
        return null; // Не рендерим компонент
    }
    // <<< КОНЕЦ ИЗМЕНЕНИЯ >>>

    return (
        <>
            <GlobalTooltipFix />
            <SlotButton
                ref={setCombinedNodeRef}
                data-testid={`slot-${shiftType}-${slotIndex}`}
                data-type={shiftType}
                data-index={slotIndex}
                data-occupied={isOccupied}
                data-senior-slot={isSeniorCourierSlot}
                className={`slot-button ${isOccupied ? 'occupied' : ''} ${successAnimation ? 'success' : ''} ${pressAnimationActive ? 'press-active' : ''} ${isDragging ? 'dragging' : ''} ${isSeniorCourierSlot ? 'senior-slot' : ''}`}
                onClick={!isOccupied ? handleEmptySlotClick : undefined}
                onMouseDown={!courier ? handlePointerDown : undefined}
                onMouseUp={!courier ? handlePointerUpOrLeave : undefined}
                onMouseLeave={!courier ? handlePointerUpOrLeave : undefined}
                onTouchStart={!courier ? handlePointerDown : undefined}
                onTouchEnd={!courier ? handlePointerUpOrLeave : undefined}
                onTouchCancel={!courier ? handlePointerUpOrLeave : undefined}
                style={{ touchAction: !courier && isSenior ? 'none' : 'auto', ...style }}
                $isOccupied={isOccupied}
                $isDisabled={isDisabledForStyles}
                $isDropTarget={isOver && !isInvalidDropTarget}
                $isAvailableEmpty={isAvailableEmpty}
                $isPotentialDropTarget={isPotentialDropTarget}
                $isPanelDragActive={isPanelDragActive}
                $isSeniorSlot={isSeniorCourierSlot}
                aria-label={(isOccupied && courier) ? tooltipText : `${isSeniorCourierSlot ? 'Слот старшего курьера' : 'Свободный слот'} ${slotIndex + 1}`}
                disabled={isClickDisabled}
                title={isDisabledForStyles ? (isSeniorCourierSlot ? "Слот только для старшего курьера" : "Слот недоступен") : (courier ? tooltipText : (isSeniorCourierSlot ? "Слот старшего курьера" : "Свободный слот"))}
                {...(canDrag ? attributes : {})}
            >
                {isLoading ? (
                    <LoadingOverlay>
                        <LoadingSpinner />
                    </LoadingOverlay>
                ) : isError ? (
                    <ErrorOverlay />
                ) : courier ? (
                    <motion.div 
                        key={courier.id}
                        layout
                        style={{ width: '100%', height: '100%' }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                    >
                        <TooltipWrapper 
                            ref={avatarRef}
                            {...(canDrag ? listeners : {})}
                            style={style}
                            onClick={handleAvatarClick}
                        >
                            <CourierAvatarContainer
                                $isDisabled={(!canDrag && !isCurrentUser) ?? false}
                                $canDrag={canDrag}
                                $isDragging={isDragging} 
                                title={tooltipText}
                            >
                                <CourierAvatarImage 
                                    src={courierInfoFromRedux?.photo_url ?? courier.photoUrl ?? defaultAvatar}
                                    alt={tooltipText.split('\n')[0]}
                                    className={isCurrentUser ? 'current-user' : ''}
                                    onError={(e) => {
                                        const img = e.target as HTMLImageElement;
                                        img.src = defaultAvatar;
                                    }}
                                />
                                {showSeniorBadge && !isDeletingSelf && (
                                    <SeniorBadge />
                                )}
                                {isConfirmingDelete && !isDeletingSelf && (
                                    <DeleteConfirmationIcon title="Нажмите для удаления смены">
                                        ×
                                    </DeleteConfirmationIcon>
                                )}
                                {isDeletingSelf && (
                                    <LoadingOverlay><LoadingSpinner /></LoadingOverlay>
                                )}
                            </CourierAvatarContainer>
                            
                            {/* Заменяем обычный тултип на портальный */}
                            <TooltipPortal 
                                isVisible={!!isActiveTooltip}
                                anchorElement={avatarRef.current}
                                tooltipContent={tooltipText.split('\n')[0]}
                                courier={courier}
                                onOpenProfile={onOpenProfile}
                                onRequestTooltip={onRequestTooltip}
                                shiftType={shiftType}
                                slotIndex={slotIndex}
                            />
                        </TooltipWrapper>
                    </motion.div>
                ) : (
                    <>
                        {/* Всегда показываем индикатор для слота старшего курьера */}
                        {isSeniorCourierSlot && (
                            <SeniorSlotIndicator />
                        )}
                        <PlusIcon $isDisabled={isDisabledForStyles}>+</PlusIcon>
                    </>
                )}
            </SlotButton>
        </>
    );
});

export default ShiftSlotComponent; 