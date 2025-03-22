import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useDispatch, useSelector } from 'react-redux';
import { cancelShift } from '../../store/slices/shiftsSlice';
import { removeFromReserve } from '../../store/slices/reservesSlice';
import { AppDispatch, RootState } from '../../store/store';
import { ReserveShift, ShiftSlot } from '../../types/shifts';
import LoadingOverlay from './LoadingOverlay';
import CourierProfileDialog from '../CourierProfileDialog/CourierProfileDialog';
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided, DropResult } from '@hello-pangea/dnd';
import useShiftDragAndDrop from '../../hooks/useShiftDragAndDrop';
import { keyframes } from 'styled-components';
import { createGlobalStyle } from 'styled-components';

// Интерфейсы
interface ShiftSlotLocal {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
}

interface ShiftPanelProps {
    date: Date;
    dayShifts: ShiftSlotLocal[];
    nightShifts: ShiftSlotLocal[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction?: boolean) => void;
    onSwitchToReserve: () => void;
    forceUpdate: () => void;
    reserves: ReserveShift[];
    showSuccessMessage: (message: string) => void;
    chatId?: string;
}

// Стили (которые нужны только для этого компонента)
const ShiftSection = styled.div`
    margin-bottom: 24px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const ShiftTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: var(--text-color);
    font-size: 1.2rem;
    font-weight: 500;
`;

const ShiftIcon = styled.span`
    font-size: 1.4rem;
`;

const SlotsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 12px;
    justify-items: center;
`;

const SlotButton = styled.button<{ $isOccupied?: boolean }>`
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px dashed ${props => props.$isOccupied ? 'transparent' : 'var(--primary-color)'};
    background: ${props => props.$isOccupied ? 'transparent' : 'rgba(76, 175, 80, 0.05)'};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: visible;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    
    &.slot-button {
        /* Дополнительные стили для селектора slot-button */
    }

    &:hover {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(1.05)'};
        background: ${props => props.$isOccupied ? 'transparent' : 'rgba(76, 175, 80, 0.1)'};
    }

    &:active {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(0.95)'};
    }

    &.drop-target {
        border-color: var(--primary-color);
        background: rgba(76, 175, 80, 0.15);
        transform: scale(1.1);
        box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
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
    transition: all 0.3s ease;
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
        
        &:active {
            cursor: grabbing;
            transform: scale(0.95);
        }
        
        ${props.$isDragging && `
            opacity: 0.7;
            transform: scale(1.1);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            cursor: grabbing;
            transition: all 0.2s ease;
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

const SlotTooltip = styled.div`
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    white-space: normal;
    max-width: 350px;
    text-align: center;
    word-wrap: break-word;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1000;

    &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.8);
    }
`;

// Стиль для анимированного индикатора цели при перетаскивании
const TargetIndicator = styled.div`
    position: absolute;
    top: -5px;
    left: -5px;
    right: -5px;
    bottom: -5px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: scale(0);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
    
    &.active {
        transform: scale(1.2);
        opacity: 1;
        background: radial-gradient(circle, rgba(76, 175, 80, 0.3) 0%, rgba(76, 175, 80, 0) 70%);
        
        &::before, &::after {
            content: '';
            position: absolute;
            border-radius: 50%;
            border: 3px dashed rgba(76, 175, 80, 0.8);
            top: -4px;
            left: -4px;
            right: -4px;
            bottom: -4px;
            animation: rotate 6s linear infinite;
            box-shadow: 0 0 15px rgba(76, 175, 80, 0.6);
        }
        
        &::after {
            border: 3px solid rgba(76, 175, 80, 0.5);
            top: -8px;
            left: -8px;
            right: -8px;
            bottom: -8px;
            animation: rotate 4s linear infinite reverse;
        }
    }
    
    @keyframes rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .target-icon {
        transition: all 0.5s ease;
        color: var(--primary-color);
        opacity: 0;
        transform: translateY(15px) scale(0.5);
        font-size: 2.5rem;
        text-shadow: 0 0 10px rgba(76, 175, 80, 0.8);
        filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.9));
        
        &::after {
            content: "⊕";
        }
    }
    
    &.active .target-icon {
        opacity: 0.95;
        transform: translateY(0) scale(1);
        animation: pulse-icon 1.5s infinite alternate;
    }
    
    @keyframes pulse-icon {
        from { transform: scale(0.9); text-shadow: 0 0 5px rgba(76, 175, 80, 0.6); }
        to { transform: scale(1.1); text-shadow: 0 0 15px rgba(76, 175, 80, 1); }
    }
`;

const SlotButtonWrapper = styled.div`
    position: relative;
    margin: 5px;
    
    &:hover ${SlotTooltip} {
        opacity: 1;
    }
    
    .slot-button {
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                   box-shadow 0.3s ease,
                   background-color 0.3s ease;
        
        &.drop-target {
            z-index: 2;
            background: linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.15) 100%);
            
            &::before {
                content: '';
                position: absolute;
                top: -10px;
                left: -10px;
                right: -10px;
                bottom: -10px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(76, 175, 80, 0.3) 0%, rgba(76, 175, 80, 0) 70%);
                z-index: -1;
                animation: pulse-target 1.5s infinite ease-in-out;
                box-shadow: 0 0 20px rgba(76, 175, 80, 0.4);
            }
        }
        
        &.drop-target-active {
            transform: scale(1.15);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 30px rgba(76, 175, 80, 0.5);
            background-color: rgba(76, 175, 80, 0.12);
            z-index: 3;
            animation: glow 1.5s infinite alternate;
        }
    }
    
    @keyframes pulse-target {
        0% {
            transform: scale(1);
            opacity: 0.9;
        }
        50% {
            transform: scale(1.15);
            opacity: 0.5;
        }
        100% {
            transform: scale(1);
            opacity: 0.9;
        }
    }
    
    @keyframes glow {
        from { box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 30px rgba(76, 175, 80, 0.5); }
        to { box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3), 0 0 40px rgba(76, 175, 80, 0.8); }
    }
    
    /* Эффекты для перетаскиваемого элемента */
    .dragging {
        z-index: 1000;
        
        .courier-avatar-container {
            transform: scale(1.1);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 15px rgba(76, 175, 80, 0.6);
            transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
    }
`;

const NoSlotsMessage = styled.div`
    text-align: center;
    padding: 24px;
    color: var(--text-secondary);
    font-size: 1.1rem;
    line-height: 1.5;
    background: var(--background);
    border-radius: var(--radius);
    margin-bottom: 24px;
`;

const DialogHeader = styled.div`
    margin-bottom: 24px;
    text-align: center;
`;

const DialogTitle = styled.h2`
    margin: 0;
    color: var(--text-color);
    font-size: 1.5rem;
    font-weight: 600;
`;

const DialogDate = styled.div`
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin-top: 8px;
`;

const DialogFooter = styled.div`
    margin-top: 24px;
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 12px;
    margin-top: 16px;
`;

const ModeButton = styled.button`
    width: 100%;
    padding: 12px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        background: var(--primary-dark);
        transform: translateY(-1px);
    }

    &:active {
        transform: translateY(0);
    }
`;

const ReserveButton = styled.button`
    width: 100%;
    padding: 12px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        background: var(--primary-dark);
        transform: translateY(-1px);
    }

    &:active {
        transform: translateY(0);
    }
`;

const ReserveLink = styled.a`
    color: var(--primary-color);
    text-decoration: none;
    cursor: pointer;

    &:hover {
        text-decoration: underline;
    }
`;

// Обновляем стиль для значка старшего курьера
const SeniorBadge = styled.div`
    position: absolute;
    top: -6px;
    right: -6px;
    background: linear-gradient(45deg, #FFC107, #FF9800);
    color: #333;
    font-size: 10px;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 10px rgba(255, 193, 7, 0.5);
    z-index: 10;
    animation: pulse 2s infinite;
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
    transform-origin: center;
    
    @keyframes pulse {
        0% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 0 0 rgba(255, 193, 7, 0.7);
        }
        70% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 10px 5px rgba(255, 193, 7, 0);
        }
        100% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 0 0 rgba(255, 193, 7, 0);
        }
    }
    
    /* Увеличиваем размер на больших экранах */
    @media (min-width: 768px) {
        top: -8px;
        right: -8px;
        height: 24px;
        width: 24px;
        font-size: 14px;
    }
    
    &:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 8px rgba(0,0,0,0.4), 0 0 15px rgba(255, 193, 7, 0.6);
    }
    
    &:active {
        transform: scale(0.9);
    }
`;

// Добавляем компонент для инструкции
const LongPressHint = styled.div`
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-align: center;
    margin-top: 16px;
    padding: 10px;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: var(--radius);
    animation: fadeIn 1s ease;
    border-left: 3px solid var(--primary-color);
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;

// Обновляем стиль для анимации долгого нажатия
const PressAnimation = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    background: rgba(76, 175, 80, 0.1);
    opacity: 0;
    transform: scale(0);
    transition: all 0.3s ease;
    pointer-events: none;
    z-index: 2;
    
    &.active {
        transform: scale(1);
        opacity: 1;
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
        }
    }
`;

// Добавляем стили для модального окна подтверждения
const ConfirmationModal = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
    animation: fadeIn var(--transition-normal);
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;

const ConfirmationContent = styled.div`
    background-color: var(--card-background);
    border-radius: var(--radius-lg);
    padding: 28px;
    width: 90%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
    animation: slideUp var(--transition-normal);
    border: 1px solid var(--border-color);
    position: relative;
    
    @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`;

const CloseIcon = styled.button`
    position: absolute;
    top: 8px;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.2rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--transition-normal);
    opacity: 0.7;
    
    &:hover {
        background: var(--hover-overlay);
        color: var(--text-color);
        opacity: 1;
    }
    
    &:active {
        transform: scale(0.9);
    }
`;

const ConfirmationTitle = styled.h3`
    margin: 0 0 16px 0;
    color: var(--text-color);
    font-size: 1.3rem;
    font-weight: 600;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const ConfirmationText = styled.p`
    margin: 0 0 28px 0;
    color: var(--text-secondary);
    text-align: center;
    line-height: 1.5;
    font-size: 1.1rem;
`;

const ConfirmationButtons = styled.div`
    display: flex;
    justify-content: center;
    gap: 16px;
    
    @media (max-width: 480px) {
        flex-direction: column-reverse;
        width: 100%;
    }
`;

const ConfirmButton = styled.button`
    padding: 12px 24px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    &:hover {
        background: var(--primary-dark);
        transform: var(--hover-transform);
        box-shadow: var(--shadow-md);
    }
    
    &:active {
        transform: var(--active-transform);
    }
    
    @media (max-width: 480px) {
        width: 100%;
        padding: 14px 24px;
    }
`;

const CancelButton = styled.button`
    padding: 12px 24px;
    background: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    &:hover {
        background: var(--hover-overlay);
        transform: var(--hover-transform);
    }
    
    &:active {
        background: var(--active-overlay);
        transform: var(--active-transform);
    }
    
    @media (max-width: 480px) {
        width: 100%;
        padding: 14px 24px;
    }
`;

const ConfirmIcon = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
`;

const ShiftTypeIcon = styled.span`
    display: inline-block;
    margin-right: 8px;
    font-size: 1.5rem;
`;

// Добавляем стиль для индикатора блокировки
const BlockedIndicator = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    z-index: 5;
    pointer-events: none;
    backdrop-filter: blur(1px);
    border: 2px dashed var(--error-color);
    animation: pulse-border 2s infinite;
    
    @keyframes pulse-border {
        0% {
            border-color: rgba(239, 68, 68, 0.7);
        }
        50% {
            border-color: rgba(239, 68, 68, 0.3);
        }
        100% {
            border-color: rgba(239, 68, 68, 0.7);
        }
    }
    
    &::before {
        content: "🔒";
        font-size: 1.4rem;
        opacity: 0.8;
        filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.5));
    }
`;

const SeniorHint = styled.div`
    color: #FFC107;
    font-size: 1rem;
    padding: 10px;
    margin-top: 10px;
    border-radius: var(--radius);
    background-color: rgba(255, 193, 7, 0.1);
    border-left: 3px solid #FFC107;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: fadeIn 1s ease;
    
    &::before {
        content: "⭐";
    }
`;

// Добавляем стиль для анимации возможности дропа
const DropIndicator = styled.div`
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

// Добавляем анимированный стиль для подсветки при перетаскивании
const DragHintOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 999;
    background: rgba(76, 175, 80, 0.05);
    opacity: 0;
    transition: opacity 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &.visible {
        opacity: 1;
    }
    
    .hint-text {
        padding: 12px 20px;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        font-weight: 500;
        color: #333;
        max-width: 80%;
        text-align: center;
    }
`;

// Анимированная галочка для подтверждения успешного перемещения
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

// Компонент панели смен обернутый в React.memo для предотвращения ненужных перерисовок
const ShiftPanel = React.memo(({
    date,
    dayShifts,
    nightShifts,
    maxDaySlots,
    maxNightSlots,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onSlotSelect,
    onSwitchToReserve,
    forceUpdate,
    reserves,
    showSuccessMessage,
    chatId
}: ShiftPanelProps): React.ReactNode => {
    const dispatch = useDispatch<AppDispatch>();
    // Создаем локальное состояние для смен, чтобы контролировать UI независимо от props
    const [localDayShifts, setLocalDayShifts] = useState(dayShifts);
    const [localNightShifts, setLocalNightShifts] = useState(nightShifts);
    
    // Добавляем useEffect для синхронизации локальных состояний с пропсами
    useEffect(() => {
        console.log('[ShiftPanel] Updating local shifts from props due to changes');
        setLocalDayShifts(dayShifts);
        setLocalNightShifts(nightShifts);
    }, [dayShifts, nightShifts]);
    
    // Добавляем состояние для управления диалогом
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<{
        id: number | string;
        name: string;
        avatar?: string;
        isSeniorCourier?: boolean;
    } | null>(null);
    
    // Состояние для отображения тултипа при клике
    const [hoveredSlot, setHoveredSlot] = useState<{
        shiftType: 'day' | 'night', 
        slotIndex: number,
        showTooltip: boolean
    } | null>(null);
    
    // Таймер для определения долгого нажатия
    const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
    
    // Добавляем состояние для анимации долгого нажатия
    const [pressAnimationActive, setPressAnimationActive] = useState(false);
    const [pressAnimationSlot, setPressAnimationSlot] = useState<number | null>(null);
    const [pressAnimationShiftType, setPressAnimationShiftType] = useState<'day' | 'night' | null>(null);
    
    // Добавляем состояние для модального окна подтверждения
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [pendingShift, setPendingShift] = useState<{
        shiftType: 'day' | 'night', 
        slotIndex: number, 
        existingShiftId?: string
    } | null>(null);
    
    // Получаем информацию о текущем пользователе
    const { user } = useSelector((state: RootState) => state.user);
    const isCurrentUserSenior = user?.isSeniorCourier || false;
    
    // Добавляем состояние для анимации успешного перемещения
    const [successAnimations, setSuccessAnimations] = useState<Map<string, boolean>>(new Map());
    
    // Проверяем, все ли слоты заняты
    const totalSlots = maxDaySlots + maxNightSlots;
    const occupiedSlots = localDayShifts.length + localNightShifts.length;
    const isFullyBooked = occupiedSlots >= totalSlots;

    // Проверяем, есть ли у пользователя смена
    const userDayShift = localDayShifts.find(shift => String(shift.userId) === String(currentUserId));
    const userNightShift = localNightShifts.find(shift => String(shift.userId) === String(currentUserId));
    const userHasShift = !!userDayShift || !!userNightShift;

    // Проверяем, есть ли у пользователя резерв
    const userHasReserve = reserves.some(
        reserve => String(reserve.userId) === String(currentUserId) && 
                  reserve.date === format(date, 'yyyy-MM-dd')
    );

    // Используем новый хук для drag-and-drop
    const {
        onDragEnd,
        handleItemPress,
        handleItemRelease,
        pressAnimationActive: dragAndDropPressAnimationActive,
        pressAnimationSlot: dragAndDropPressAnimationSlot,
        pressAnimationShiftType: dragAndDropPressAnimationShiftType,
    } = useShiftDragAndDrop({
        isSeniorUser: isCurrentUserSenior,
        onItemMove: async (item, sourceType, sourceIndex, targetType, targetIndex) => {
            console.log('[ShiftPanel] onItemMove called:', { item, sourceType, sourceIndex, targetType, targetIndex });
            
            // Получаем информацию о перемещаемом курьере
            const sourceShifts = sourceType === 'day' ? localDayShifts : localNightShifts;
            const targetShifts = targetType === 'day' ? localDayShifts : localNightShifts;
            
            const movedCourier = sourceShifts.find(shift => shift.slotIndex === sourceIndex);
            if (!movedCourier) {
                console.error('[ShiftPanel] Courier not found for move operation:', { sourceType, sourceIndex });
                return;
            }
            
            console.log('[ShiftPanel] Found courier to move:', movedCourier);
            
            try {
                // Оптимистично обновляем UI
                console.log('[ShiftPanel] Optimistically updating UI before API call');
            const updatedSourceShifts = sourceShifts.filter(shift => shift.slotIndex !== sourceIndex);
            const updatedTargetShifts = [...targetShifts];
            
            const updatedCourier = {
                ...movedCourier,
                slotIndex: targetIndex,
                shiftType: targetType
            };
            
            updatedTargetShifts.push(updatedCourier);
            
            if (sourceType === 'day') {
                setLocalDayShifts(updatedSourceShifts);
            } else {
                setLocalNightShifts(updatedSourceShifts);
            }
            
            if (targetType === 'day') {
                setLocalDayShifts(updatedTargetShifts);
            } else {
                setLocalNightShifts(updatedTargetShifts);
            }
            
                // Вызываем API напрямую для перезаписи курьера, без показа модального окна
                if (movedCourier.id) {
                    console.log('[ShiftPanel] Calling handleSlotSelect with isDragAction=true for courier:', movedCourier.id);
                    // Для администраторов/старших курьеров - прямое перемещение без подтверждения
                    try {
                        console.log('[ShiftPanel] Waiting for API call completion...');
                        await handleSlotSelect(targetType, targetIndex, movedCourier.id, true);
                        console.log('[ShiftPanel] API call successful! UI should update now');
                        
                        // Обновить весь компонент для гарантии
                        console.log('[ShiftPanel] Forcing UI update after successful API call');
                        forceUpdate();
                        
                        // Показываем уведомление
                        showSuccessMessage(`${movedCourier.firstName || ''} ${movedCourier.lastName || ''} перемещен в ${targetType === 'day' ? 'дневную' : 'вечернюю'} смену`);
                    } catch (error) {
                        console.error('[ShiftPanel] Error during drag-and-drop move:', error);
                        // В случае ошибки возвращаем исходное состояние
                        setLocalDayShifts(dayShifts);
                        setLocalNightShifts(nightShifts);
                        showSuccessMessage('Произошла ошибка при перемещении курьера');
                    }
                }
            } catch (error) {
                console.error('[ShiftPanel] Error during drag-and-drop move:', error);
                // В случае ошибки возвращаем исходное состояние
                setLocalDayShifts(dayShifts);
                setLocalNightShifts(nightShifts);
                showSuccessMessage('Произошла ошибка при перемещении курьера');
            }
        },
        onLongPressNonSenior: (item) => {
            if (item.userId) {
                setSelectedCourier({
                    id: item.userId,
                    name: `${item.firstName || ''} ${item.lastName || ''}`.trim(),
                    avatar: item.photo_url || undefined,
                    isSeniorCourier: item.isSeniorCourier || false
                });
                setProfileDialogOpen(true);
            }
        }
    });

    const handleSlotSelect = async (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction = false) => {
        console.log('[ShiftPanel] handleSlotSelect called with params:', { 
            shiftType, 
            slotIndex, 
            existingShiftId, 
            isDragAction,
            currentUserIsSenior: isCurrentUserSenior
        });
        
        // Если это действие drag-and-drop, просто пропускаем проверки и сразу вызываем API
        if (isDragAction && isCurrentUserSenior) {
            console.log('[ShiftPanel] Senior user drag action detected, bypassing confirmation and calling API directly');
            // Передаем действие в родительский компонент для API-запроса
            try {
                console.log('[ShiftPanel] About to call parent onSlotSelect with params:', {
                    shiftType, 
                    slotIndex, 
                    existingShiftId, 
                    isDragAction
                });
                const result = await onSlotSelect(shiftType, slotIndex, existingShiftId, isDragAction);
                console.log('[ShiftPanel] API call successful in drag action mode, result:', result);
                return result;
            } catch (error) {
                console.error('[ShiftPanel] API call failed in drag action mode:', error);
                
                // Обрабатываем ошибку доступа если смена принадлежит другому пользователю
                if (error instanceof Error && error.message &&
                    (error.message.includes('belongs to another user') || 
                     error.message.includes('принадлежит другому пользователю'))) {
                    showSuccessMessage('Ошибка доступа: смена принадлежит другому пользователю. Обновите права доступа.');
                } else {
                    showSuccessMessage('Произошла ошибка при перемещении курьера');
                }
                
                // Обновляем UI к исходному состоянию
                console.log('[ShiftPanel] Resetting UI after API error');
                setLocalDayShifts(dayShifts);
                setLocalNightShifts(nightShifts);
                
                throw error;
            }
        }
        
        const isAvatarClick = document.body.hasAttribute('data-avatar-click');
        if (isAvatarClick) {
            console.log('[ShiftPanel] Avatar click detected, skipping slot selection');
            document.body.removeAttribute('data-avatar-click');
            return;
        }
        
        // Если слот принадлежит текущему пользователю, отменяем смену
        if (existingShiftId && ((shiftType === 'day' && userDayShift) || (shiftType === 'night' && userNightShift))) {
            console.log('[ShiftPanel] Slot belongs to current user, canceling shift');
            return handleCancelShift();
        }
        
        // Проверка ограничений только для обычных курьеров
        if (!isCurrentUserSenior) {
            if ((userDayShift && shiftType === 'night') || (userNightShift && shiftType === 'day')) {
                console.log('[ShiftPanel] Regular courier trying to switch between day and night shifts');
                showSuccessMessage('Переход между сменами доступен только старшему курьеру');
                return;
            }
        }
        
        // Открываем диалог подтверждения
        setPendingShift({ shiftType, slotIndex, existingShiftId });
        setConfirmationOpen(true);
    };
    
    // Новая функция для обработки подтверждения записи на смену
    const handleConfirmShift = async () => {
        if (!pendingShift) return;
        
        const { shiftType, slotIndex, existingShiftId } = pendingShift;
        
        try {
            // Оптимистично добавляем смену в локальное состояние
            const optimisticShift = {
                id: `temp-${Date.now()}`,
                userId: currentUserId,
                photo_url: currentUserAvatar,
                firstName: currentUserName?.split(' ')[0] || '',
                lastName: currentUserName?.split(' ')[1] || '',
                shiftType,
                slotIndex,
                date: format(date, 'yyyy-MM-dd')
            };
            
            // Добавляем в локальное состояние для мгновенного отображения
            if (shiftType === 'day') {
                setLocalDayShifts(prevShifts => [...prevShifts, optimisticShift]);
            } else {
                // То же самое для ночных смен
                setLocalNightShifts(prevShifts => [...prevShifts, optimisticShift]);
            }
            
            // Проверяем, есть ли пользователь в резерве на эту дату
            const userReserve = reserves.find(
                reserve => String(reserve.userId) === String(currentUserId) && 
                           reserve.date === format(date, 'yyyy-MM-dd')
            );
            
            let wasInReserve = false;
            // Если пользователь в резерве, запоминаем это для последующего уведомления
            if (userReserve && userReserve.id) {
                console.log('[ShiftPanel] User is in reserve, this will be handled by shiftsSlice');
                wasInReserve = true;
            }
            
            // Закрываем модальное окно подтверждения
            setConfirmationOpen(false);
            setPendingShift(null);
            
            // Вызываем onSlotSelect callback для отправки запроса на сервер
            await onSlotSelect(shiftType, slotIndex, existingShiftId);
            console.log('[ShiftPanel] Slot selection successful');
            
            // Показываем уведомление об удалении из резерва, если пользователь был в резерве
            if (wasInReserve) {
                // Небольшая задержка, чтобы уведомление появилось после успешной записи на смену
                setTimeout(() => {
                    showSuccessMessage('Вы были автоматически удалены из резерва при записи на смену');
                }, 500);
            }
            
            // Показываем анимацию галочки для успешной записи на смену
            const animationKey = `${shiftType}-${slotIndex}`;
            setSuccessAnimations(prevAnimations => {
                const newAnimations = new Map(prevAnimations);
                newAnimations.set(animationKey, true);
                return newAnimations;
            });
            
            // Удаляем анимацию через 2 секунды
            setTimeout(() => {
                setSuccessAnimations(prevAnimations => {
                    const newAnimations = new Map(prevAnimations);
                    newAnimations.delete(animationKey);
                    return newAnimations;
                });
            }, 2000);
        } catch (error) {
            console.error('[ShiftPanel] Error selecting slot:', error);
            // В случае ошибки отменяем оптимистичное обновление
            if (shiftType === 'day') {
                setLocalDayShifts(prevShifts => 
                    prevShifts.filter(shift => !shift.id?.toString().startsWith('temp-'))
                );
            } else {
                setLocalNightShifts(prevShifts => 
                    prevShifts.filter(shift => !shift.id?.toString().startsWith('temp-'))
                );
            }
        }
    };
    
    // Функция для отмены создания смены
    const handleCancelConfirmation = useCallback(() => {
        setConfirmationOpen(false);
        setPendingShift(null);
    }, []);

    const handleCancelShift = async () => {
        console.log('[ShiftPanel] handleCancelShift called');
        
        try {
            // Находим ID смены пользователя (дневной или ночной)
            const userShift = userDayShift || userNightShift;
            
            if (userShift && userShift.id) {
                console.log('[ShiftPanel] Canceling shift with ID:', userShift.id);
                
                // Запоминаем тип смены и индекс слота для анимации
                const shiftType = userShift.shiftType || (userDayShift ? 'day' : 'night');
                const slotIndex = userShift.slotIndex;
                
                // Оптимистично удаляем смену из локального состояния
                if (userDayShift) {
                    setLocalDayShifts(prevShifts => 
                        prevShifts.filter(shift => shift.id !== userShift.id)
                    );
                } else if (userNightShift) {
                    setLocalNightShifts(prevShifts => 
                        prevShifts.filter(shift => shift.id !== userShift.id)
                    );
                }
                
                // Показываем уведомление об успешной отмене до выполнения запроса
                showSuccessMessage('Смена успешно отменена');
                
                // Проверяем, есть ли chatId
                if (!chatId) {
                    console.log('[ShiftPanel] Warning: No chatId provided for canceling shift, using default');
                }
                
                // Показываем анимацию галочки для успешной отмены смены
                const animationKey = `${shiftType}-${slotIndex}`;
                setSuccessAnimations(prevAnimations => {
                    const newAnimations = new Map(prevAnimations);
                    newAnimations.set(animationKey, true);
                    return newAnimations;
                });
                
                // Удаляем анимацию через 2 секунды
                setTimeout(() => {
                    setSuccessAnimations(prevAnimations => {
                        const newAnimations = new Map(prevAnimations);
                        newAnimations.delete(animationKey);
                        return newAnimations;
                    });
                }, 2000);
                
                // Вызываем dispatch для отмены смены на сервере с параметром chatId
                await dispatch(cancelShift({
                    shiftId: String(userShift.id),
                    chatId: chatId
                }));
                
                console.log('[ShiftPanel] Shift cancellation successful');
                
                // После отмены смены предлагаем перейти к панели резерва
                setTimeout(() => {
                    // Даем пользователю время увидеть анимацию отмены смены
                    onSwitchToReserve();
                    showSuccessMessage('Вы можете записаться в резерв');
                }, 1000);
            } else {
                console.log('[ShiftPanel] No shift to cancel');
            }
        } catch (error) {
            console.error('[ShiftPanel] Error canceling shift:', error);
            
            // В случае ошибки восстанавливаем состояние
            setLocalDayShifts(dayShifts);
            setLocalNightShifts(nightShifts);
        }
    };

    // Обработчик клика на аватар курьера (короткое нажатие)
    const handleCourierAvatarClick = (
        event: React.MouseEvent | React.TouchEvent,
        courier: { 
            userId?: string; 
            firstName?: string; 
            lastName?: string; 
            photo_url?: string | null;
            isSeniorCourier?: boolean;
        },
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        console.log('[ShiftPanel] handleCourierAvatarClick:', {
            courier,
            shiftType,
            slotIndex,
            isCurrentUserSenior
        });
        
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        document.body.setAttribute('data-avatar-click', 'true');
        
        setHoveredSlot({
            shiftType,
            slotIndex,
            showTooltip: true
        });
        
        setTimeout(() => {
            setHoveredSlot(null);
        }, 2000);
    };
    
    // Обработчик долгого нажатия на аватар курьера
    const handleCourierAvatarPress = (
        event: React.MouseEvent | React.TouchEvent,
        courier: { 
            userId?: string; 
            firstName?: string; 
            lastName?: string; 
            photo_url?: string | null;
            isSeniorCourier?: boolean;
        },
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        console.log('[ShiftPanel] handleCourierAvatarPress:', {
            courier,
            shiftType,
            slotIndex,
            isCurrentUserSenior,
            eventType: event.type
        });
        
        const shiftSlot = {
            ...courier,
            slotIndex,
            shiftType
        };
        
        console.log('[ShiftPanel] Calling handleItemPress with shiftSlot:', shiftSlot);
        handleItemPress(event, shiftSlot, shiftType, slotIndex);
    };
    
    // Обработчик отпускания после нажатия
    const handleCourierAvatarRelease = async (e?: React.MouseEvent | React.TouchEvent | any) => {
        console.log('[ShiftPanel] handleCourierAvatarRelease called', {
            type: e?.type,
            clientX: e?.clientX,
            clientY: e?.clientY,
            hasTouches: !!e?.touches,
            hasChangedTouches: !!e?.changedTouches,
            changedTouches: e?.changedTouches ? Array.from(e.changedTouches as TouchList).map(t => ({ clientX: t.clientX, clientY: t.clientY })) : []
        });

        // Получаем координаты события (для touch или mouse)
        let clientX: number | undefined;
        let clientY: number | undefined;
        if (e?.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
            console.log('[ShiftPanel] Touch coordinates from changedTouches:', { clientX, clientY });
        } else if (e?.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            console.log('[ShiftPanel] Touch coordinates from touches:', { clientX, clientY });
        } else if (e?.clientX !== undefined && e?.clientY !== undefined) {
            clientX = e.clientX;
            clientY = e.clientY;
            console.log('[ShiftPanel] Mouse coordinates:', { clientX, clientY });
        } else {
            console.log('[ShiftPanel] No coordinates available in event');
        }

        console.log('[ShiftPanel] Checking for active dragging elements');
        // Проверка наличия элементов с классом dragging
        const draggingElements = document.querySelectorAll('.dragging');
        console.log('[ShiftPanel] Found dragging elements:', draggingElements.length);

        if (draggingElements.length > 0) {
            console.log('[ShiftPanel] Processing release during active drag');
            
            // Берем первый найденный элемент с классом dragging
            const dragElement = draggingElements[0] as HTMLElement;
            
            // Логируем все свойства и атрибуты элемента для отладки
            console.log('[ShiftPanel] Drag element details:', {
                element: dragElement,
                id: dragElement.id,
                className: dragElement.className,
                style: dragElement.style.cssText,
                dataType: dragElement.getAttribute('data-type'),
                dataIndex: dragElement.getAttribute('data-index'),
                dataDraggableId: dragElement.getAttribute('data-draggable-id'),
                dataRfdDraggableId: dragElement.getAttribute('data-rfd-draggable-id'),
                allAttributes: Array.from(dragElement.attributes).map(attr => ({ name: attr.name, value: attr.value })),
                children: dragElement.children.length,
                innerHTML: dragElement.innerHTML.substring(0, 100) + '...'
            });
            
            // Проверяем все дочерние элементы на наличие атрибута data-draggable-id
            let sourceId = dragElement.getAttribute('data-draggable-id');
            
            if (!sourceId) {
                console.log('[ShiftPanel] Looking for data-draggable-id in child elements');
                const childWithId = dragElement.querySelector('[data-draggable-id]');
                if (childWithId) {
                    sourceId = childWithId.getAttribute('data-draggable-id');
                    console.log('[ShiftPanel] Found data-draggable-id in child element:', sourceId);
                }
            }
            
            // Если не нашли в дочерних элементах, ищем в ближайших родителях
            if (!sourceId) {
                console.log('[ShiftPanel] Looking for data-draggable-id in parent elements');
                const parentWithId = dragElement.closest('[data-draggable-id]');
                if (parentWithId) {
                    sourceId = parentWithId.getAttribute('data-draggable-id');
                    console.log('[ShiftPanel] Found data-draggable-id in parent element:', sourceId);
                }
            }
            
            // Дополнительная проверка для атрибута data-rfd-draggable-id
            if (!sourceId) {
                console.log('[ShiftPanel] Looking for data-rfd-draggable-id');
                const rfdId = dragElement.getAttribute('data-rfd-draggable-id');
                if (rfdId) {
                    sourceId = rfdId;
                    console.log('[ShiftPanel] Using data-rfd-draggable-id as fallback:', sourceId);
                }
            }
            
            // Если всё еще не нашли, берем ID из элемента с классом courier-avatar-container
            if (!sourceId && dragElement.classList.contains('courier-avatar-container')) {
                console.log('[ShiftPanel] Trying to extract ID from courier-avatar-container');
                const slotElement = dragElement.closest('[data-testid]');
                if (slotElement) {
                    const testId = slotElement.getAttribute('data-testid');
                    if (testId && (testId.startsWith('day-slot-') || testId.startsWith('night-slot-'))) {
                        const parts = testId.split('-');
                        if (parts.length === 3) {
                            sourceId = `${parts[0]}-${parts[2]}`;
                            console.log('[ShiftPanel] Constructed ID from data-testid:', sourceId);
                        }
                    }
                }
            }
            
            if (sourceId) {
                console.log('[ShiftPanel] Found source ID:', sourceId);
                
                const [sourceType, sourceIndex] = sourceId.split('-');
                
                // Если есть координаты, ищем целевой слот используя новую функцию
                if (clientX !== undefined && clientY !== undefined) {
                    console.log('[ShiftPanel] Searching for target slot with findClosestElement');
                    
                    // Используем новую функцию для поиска ближайшего слота
                    const targetSlotInfo = findClosestElement(clientX, clientY);
                    
                    console.log('[ShiftPanel] Found closest slot:', targetSlotInfo);
                    
                    // Если нашли подходящий слот и расстояние не слишком большое
                    if (targetSlotInfo.element && targetSlotInfo.index >= 0 && targetSlotInfo.distance < 100) {
                        console.log('[ShiftPanel] Found target slot:', targetSlotInfo);
                        
                        const targetType = targetSlotInfo.type;
                        const targetIndex = targetSlotInfo.index;
                        
                        // Проверяем, что исходный и целевой слоты разные
                        if (sourceType !== targetType || parseInt(sourceIndex) !== targetIndex) {
                            console.log('[ShiftPanel] Source and target slots are different, proceeding with move');
                            
                            try {
                                // Находим информацию о курьере для сохранения исходного ID
                                const sourceShifts = sourceType === 'day' ? localDayShifts : localNightShifts;
                                const sourceCourier = sourceShifts.find(shift => shift.slotIndex === parseInt(sourceIndex));
                                
                                if (!sourceCourier) {
                                    console.error('[ShiftPanel] Could not find source courier in slot', sourceType, sourceIndex);
                                    showSuccessMessage('Ошибка: не удалось найти информацию о курьере');
                                    return;
                                }
                                
                                console.log('[ShiftPanel] Found source courier:', sourceCourier);
                                
                                console.log('[ShiftPanel] Calling handleSlotSelect with:', {
                                    sourceType, 
                                    sourceIndex, 
                                    targetType, 
                                    targetIndex,
                                    courierUserId: sourceCourier.userId,
                                    existingShiftId: sourceCourier.id,
                                    isDragAction: true
                                });
                                
                                // Вызываем API для обновления слота, передавая ID исходной смены
                                const result = await handleSlotSelect(
                                    targetType, 
                                    targetIndex, 
                                    sourceCourier.id, // Передаем ID исходной смены
                                    true
                                );
                                
                                console.log('[ShiftPanel] handleSlotSelect result:', result);
                                showSuccessMessage('Курьер успешно перемещен');
                            } catch (error) {
                                console.error('[ShiftPanel] Error during slot update:', error);
                                // Показываем сообщение об ошибке
                                showSuccessMessage('Не удалось переместить курьера');
                            }
                        } else {
                            console.log('[ShiftPanel] Source and target slots are the same, cancelling move');
                        }
                    } else {
                        console.log('[ShiftPanel] No suitable target slot found or distance too large:', targetSlotInfo);
                    }
                } else {
                    console.log('[ShiftPanel] No coordinates available, cannot determine target slot');
                }
            } else {
                console.log('[ShiftPanel] Missing data attributes on dragging element');
            }
            
            // Очищаем состояние перетаскивания
            draggingElements.forEach(el => {
                console.log('[ShiftPanel] Cleaning up dragging element:', el);
                el.classList.remove('dragging');
                if (el instanceof HTMLElement) {
                    el.style.transform = '';
                    el.style.opacity = '';
                    el.style.cursor = '';
                }
            });
        } else {
            console.log('[ShiftPanel] No dragging elements found');
        }
        
        // Вызываем функцию из хука для очистки состояния
        if (handleItemRelease) {
            console.log('[ShiftPanel] Calling handleItemRelease to clean up state');
        handleItemRelease();
        }
    };

    // Модифицированная функция renderSlots
    const renderSlots = useMemo(() => {
        return (shiftType: 'day' | 'night', slots: number) => {
            console.log('[ShiftPanel] renderSlots called:', { shiftType, slots, isCurrentUserSenior });
            
            const shiftsArray = shiftType === 'day' ? localDayShifts : localNightShifts;
            const userHasThisTypeShift = shiftsArray.some(shift => String(shift.userId) === String(currentUserId));
            const userHasOtherTypeShift = (shiftType === 'day' ? localNightShifts : localDayShifts)
                .some(shift => String(shift.userId) === String(currentUserId));
            
            return Array.from({ length: slots }).map((_, index) => {
                const existingShift = shiftsArray.find(shift => shift.slotIndex === index);
                
                const isCurrentUser = existingShift && String(existingShift.userId) === String(currentUserId);
                const isBlockedDueToOtherShift = !isCurrentUserSenior && userHasOtherTypeShift && !existingShift;
                
                // Обновляем логику isDisabled для старшего курьера
                const isDisabled = !isCurrentUserSenior && (
                    (!!existingShift && !isCurrentUser) || 
                    (userHasThisTypeShift && !isCurrentUser) ||
                    (userHasOtherTypeShift)
                );

                const slotContent = (
                    <SlotButtonWrapper key={`${shiftType}-${index}`}>
                        <SlotButton 
                            $isOccupied={!!existingShift}
                            onClick={() => handleSlotSelect(shiftType, index, existingShift?.id)}
                            disabled={isDisabled}
                            title={isCurrentUser ? 'Нажмите, чтобы отменить смену' : undefined}
                            data-testid={`slot-${shiftType}-${index}`}
                            className="slot-button"
                            data-draggable-id={`${shiftType}-${index}`}
                            style={{
                                opacity: isDisabled && !existingShift ? 0.5 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                position: 'relative'
                            }}
                        >
                            {existingShift ? (
                                <React.Fragment>
                                    <CourierAvatarContainer 
                                        $isDraggable={isCurrentUserSenior}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleCourierAvatarClick(e, existingShift, shiftType, index);
                                        }}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleCourierAvatarPress(e, existingShift, shiftType, index);
                                        }}
                                        onMouseUp={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleCourierAvatarRelease(e);
                                        }}
                                        onMouseLeave={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleCourierAvatarRelease(e);
                                        }}
                                        onTouchStart={(e) => {
                                            // Не вызываем preventDefault для touch-событий,
                                            // чтобы позволить им пробросить до document
                                            e.stopPropagation();
                                            console.log('[ShiftPanel] touchStart event on avatar');
                                            handleCourierAvatarPress(e, existingShift, shiftType, index);
                                        }}
                                        onTouchEnd={(e) => {
                                            // Не вызываем preventDefault для touch-событий
                                            e.stopPropagation();
                                            console.log('[ShiftPanel] touchEnd event on avatar');
                                            handleCourierAvatarRelease(e);
                                        }}
                                        onTouchCancel={(e) => {
                                            // Не вызываем preventDefault для touch-событий
                                            e.stopPropagation();
                                            console.log('[ShiftPanel] touchCancel event on avatar');
                                            handleCourierAvatarRelease(e);
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            return false;
                                        }}
                                        draggable={isCurrentUserSenior}
                                        data-senior={isCurrentUserSenior}
                                        className="courier-avatar-container"
                                        data-draggable-id={`${shiftType}-${index}`}
                                        data-type={shiftType}
                                        data-index={index}
                                        style={{ 
                                            WebkitTouchCallout: 'none',
                                            touchAction: 'none',
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                            pointerEvents: isCurrentUserSenior ? 'auto' : 'none',
                                            position: 'relative'
                                        }}
                                    >
                                        {/* Проверяем, нужно ли показать анимацию галочки для этого слота */}
                                        <SuccessCheckmark className={successAnimations.get(`${shiftType}-${index}`) ? 'active' : ''} />
                                        
                                        <CourierAvatarImage
                                            src={existingShift.photo_url || defaultAvatar} 
                                            alt={`${existingShift.firstName || 'Курьер'}`}
                                            loading="lazy"
                                            decoding="async"
                                            draggable="false"
                                            data-telegram-disable-copy="true"
                                            data-telegram-disable-link="true"
                                            data-telegram-disable-preview="true"
                                            data-telegram-disable-selection="true"
                                        />
                                        {existingShift.isSeniorCourier && (
                                            <SeniorBadge 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedCourier({
                                                        id: existingShift.userId || '',
                                                        name: `${existingShift.firstName || ''} ${existingShift.lastName || ''}`.trim(),
                                                        avatar: existingShift.photo_url || undefined,
                                                        isSeniorCourier: existingShift.isSeniorCourier
                                                    });
                                                    setProfileDialogOpen(true);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                                title="Открыть профиль старшего курьера"
                                            >
                                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>⭐</span>
                                            </SeniorBadge>
                                        )}
                                    </CourierAvatarContainer>
                                    
                                    {dragAndDropPressAnimationActive && 
                                     dragAndDropPressAnimationSlot === index && 
                                     dragAndDropPressAnimationShiftType === shiftType && (
                                        <PressAnimation className="active" />
                                    )}
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    <PlusIcon>+</PlusIcon>
                                    {isCurrentUserSenior && !existingShift && (
                                        <DropIndicator className={dragAndDropPressAnimationActive ? 'active' : ''} />
                                    )}
                                    
                                    {/* Анимированная галочка для пустых слотов */}
                                    <SuccessCheckmark className={successAnimations.get(`${shiftType}-${index}`) ? 'active' : ''} />
                                </React.Fragment>
                            )}
                            
                            {!existingShift && isBlockedDueToOtherShift && (
                                <BlockedIndicator />
                            )}
                        </SlotButton>
                        
                        {existingShift && (
                            <SlotTooltip style={{ opacity: hoveredSlot && hoveredSlot.shiftType === shiftType && hoveredSlot.slotIndex === index && hoveredSlot.showTooltip ? 1 : undefined }}>
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    alignItems: 'center'
                                }}>
                                    {existingShift.isSeniorCourier && (
                                        <span style={{
                                            display: 'inline-block',
                                            background: 'linear-gradient(45deg, #FFC107, #FF9800)',
                                            color: '#333',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            marginBottom: '5px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                        }}>
                                            ⭐ Старший курьер
                                        </span>
                                    )}
                                    <span>{existingShift.firstName || 'Курьер'} {existingShift.lastName || ''}</span>
                                </div>
                            </SlotTooltip>
                        )}
                        
                        {!existingShift && (
                            <>
                                {userHasOtherTypeShift && (
                                    <SlotTooltip style={{ opacity: hoveredSlot && hoveredSlot.shiftType === shiftType && hoveredSlot.slotIndex === index && hoveredSlot.showTooltip ? 1 : undefined }}>
                                        Вы уже записаны на {userHasThisTypeShift ? 'дневную' : 'вечернюю'} смену.<br/>
                                        Перемещение между сменами может выполнить только старший курьер или администратор.
                                    </SlotTooltip>
                                )}
                                {!userHasOtherTypeShift && userHasThisTypeShift && !isCurrentUser && (
                                    <SlotTooltip style={{ opacity: hoveredSlot && hoveredSlot.shiftType === shiftType && hoveredSlot.slotIndex === index && hoveredSlot.showTooltip ? 1 : undefined }}>
                                        Вы уже записаны на {shiftType === 'day' ? 'дневную' : 'вечернюю'} смену
                                    </SlotTooltip>
                                )}
                            </>
                        )}
                    </SlotButtonWrapper>
                );

                // Оборачиваем в Draggable только если есть курьер и текущий пользователь - старший курьер
                return existingShift && isCurrentUserSenior ? (
                    <Draggable 
                        key={`${shiftType}-${index}`}
                        draggableId={`${shiftType}-${index}`}
                        index={index}
                    >
                        {(provided: DraggableProvided) => {
                            console.log('[ShiftPanel] Rendering Draggable:', {
                                shiftType,
                                index,
                                draggableId: `${shiftType}-${index}`
                            });
                            return (
                                <div 
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    data-draggable-id={`${shiftType}-${index}`}
                                >
                                    {slotContent}
                                </div>
                            );
                        }}
                    </Draggable>
                ) : (
                    slotContent
                );
            });
        };
    }, [
        localDayShifts,
        localNightShifts,
        currentUserId,
        isCurrentUserSenior,
        handleSlotSelect,
        handleCourierAvatarClick,
        handleCourierAvatarPress,
        handleCourierAvatarRelease,
        dragAndDropPressAnimationActive,
        dragAndDropPressAnimationSlot,
        dragAndDropPressAnimationShiftType,
        hoveredSlot,
        successAnimations // Добавляем зависимость от успешных анимаций
    ]);

    // Обновляем useEffect для обработки drag-and-drop
    useEffect(() => {
        let dragElement: HTMLElement | null = null;
        let initialPosition = { x: 0, y: 0 };
        let isDragging = false;
        let dragStartTime = 0;
        let activeDropTarget: Element | null = null;

        const resetDragState = () => {
            console.log('[ShiftPanel] Resetting drag state');
            
            // Очищаем все элементы с классом dragging, кроме тех, что имеют маркеры успешного перемещения
            const draggingElements = document.querySelectorAll('.dragging') as NodeListOf<HTMLElement>;
            draggingElements.forEach(el => {
                // Проверяем, помечен ли элемент как успешно перемещенный или ожидающий завершения перемещения
                const isSuccessful = el.hasAttribute('data-success') || 
                                     el.hasAttribute('data-success-pending') ||
                                     el.hasAttribute('data-moving');
                
                if (!isSuccessful) {
                    console.log('[ShiftPanel] Resetting non-successful drag element:', el);
                    el.classList.remove('dragging');
                    el.style.transform = '';
                    el.style.transition = '';
                    el.style.opacity = '1';
                    el.style.cursor = '';
                } else {
                    console.log('[ShiftPanel] Preserving successful drag element:', el);
                    // Для успешно перемещенных элементов только убираем класс dragging
                    el.classList.remove('dragging');
                }
            });
            
            // Очищаем все слоты с классом drop-target
            const dropTargets = document.querySelectorAll('.drop-target');
            dropTargets.forEach(el => {
                el.classList.remove('drop-target');
            });
            
            // Сбрасываем состояние
            isDragging = false;
            dragElement = null;
            dragStartTime = 0;
            initialPosition = { x: 0, y: 0 };
            activeDropTarget = null;
        };

        const handleCustomDragStart = (e: CustomEvent<{
            item: ShiftSlot;
            type: 'day' | 'night';
            index: number;
            position: { x: number; y: number };
        }>) => {
            console.log('[ShiftPanel] Custom drag start event:', e.detail);
            const { item, type, index, position } = e.detail;
            
            if (isCurrentUserSenior) {
                console.log('[ShiftPanel] Starting drag operation for senior user');
                
                // Находим элемент для перетаскивания
                const dragId = `${type}-${index}`;
                const foundElement = document.querySelector(`[data-draggable-id="${dragId}"]`) as HTMLElement;
                
                if (!foundElement) {
                    console.error('[ShiftPanel] Could not find element with draggable ID:', dragId);
                    return;
                }
                
                dragElement = foundElement;
                dragElement.classList.add('dragging');
                
                initialPosition = position;
                isDragging = true;
                dragStartTime = Date.now();
                
                if (dragElement) {
                    dragElement.style.cursor = 'grabbing';
                    dragElement.style.transition = 'none';
                    console.log('[ShiftPanel] Drag element initialized:', dragElement);
                }
                
                const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
                    if (!isDragging || !dragElement) return;
                    
                    // Не вызываем preventDefault для touch-событий при горизонтальном перемещении,
                    // чтобы не блокировать системные жесты свайпа
                    const isTouchEvent = 'touches' in moveEvent;
                    const pos = isTouchEvent 
                        ? { x: moveEvent.touches[0].clientX, y: moveEvent.touches[0].clientY }
                        : { x: moveEvent.clientX, y: moveEvent.clientY };
                    
                    // Вычисляем смещение от начального положения
                    const deltaX = pos.x - initialPosition.x;
                    const deltaY = pos.y - initialPosition.y;
                    
                    // Предотвращаем действие по умолчанию только если движение явно вертикальное
                    // или мы явно перетаскиваем элемент (класс dragging)
                    const isVerticalMove = Math.abs(deltaY) > Math.abs(deltaX) * 1.5;
                    if (!isTouchEvent || isVerticalMove) {
                        moveEvent.preventDefault();
                    }
                    
                    // Логируем каждое 10-е перемещение, чтобы не переполнять консоль
                    if (Math.random() < 0.1) {
                        console.log('[ShiftPanel] Dragging element at position:', pos);
                    }
                    
                    // Проверяем, находимся ли мы над допустимым слотом
                    const slots = document.querySelectorAll('.slot-button');
                    let isOverValidSlot = false;
                    let closestSlot: Element | null = null;
                    let minDistance = Infinity;
                    
                    // Очищаем все слоты с классом drop-target
                    document.querySelectorAll('.drop-target').forEach(slot => {
                        slot.classList.remove('drop-target');
                        slot.classList.remove('drop-target-active');
                    });
                    
                    // Получаем информацию о перетаскиваемом аватаре курьера
                    const dragId = dragElement.getAttribute('data-draggable-id') || '';
                    const dragParts = dragId.split('-');
                    const dragSourceType = dragParts[0] as 'day' | 'night';
                    const dragSourceIndex = parseInt(dragParts[1], 10);
                    
                    console.log('[ShiftPanel] Drag source:', { dragSourceType, dragSourceIndex });
                    
                    // Ищем ближайший слот с усовершенствованным алгоритмом
                    slots.forEach((slot) => {
                        const rect = slot.getBoundingClientRect();
                        const slotId = slot.getAttribute('data-draggable-id') || slot.getAttribute('data-testid');
                        
                        // Извлекаем тип и индекс из data-draggable-id или data-testid
                        let slotType: 'day' | 'night' = 'day';
                        let slotIndex = -1;
                        
                        if (slotId) {
                            if (slotId.startsWith('day-')) {
                                slotType = 'day';
                                slotIndex = parseInt(slotId.split('-')[1], 10);
                            } else if (slotId.startsWith('night-')) {
                                slotType = 'night';
                                slotIndex = parseInt(slotId.split('-')[1], 10);
                            } else if (slotId.startsWith('slot-day-')) {
                                slotType = 'day';
                                slotIndex = parseInt(slotId.split('-')[2], 10);
                            } else if (slotId.startsWith('slot-night-')) {
                                slotType = 'night';
                                slotIndex = parseInt(slotId.split('-')[2], 10);
                            }
                        }
                        
                        // Проверяем, является ли слот занятым (содержит аватар курьера)
                        const isOccupied = slot.querySelector('.courier-avatar-container') !== null;
                        
                        // Проверяем, принадлежит ли слот к той же смене, что и перетаскиваемый аватар
                        const isSameShiftType = slotType === dragSourceType;
                        
                        // Вычисляем расстояние до центра слота с весовыми коэффициентами
                        const centerX = (rect.left + rect.right) / 2;
                        const centerY = (rect.top + rect.bottom) / 2;
                        
                        // Горизонтальное расстояние имеет больший вес (для лучшего группирования по рядам)
                        const horizontalDist = Math.abs(pos.x - centerX);
                        const verticalDist = Math.abs(pos.y - centerY) * 0.7; // Уменьшаем вес вертикального расстояния
                        
                        const distance = Math.sqrt(Math.pow(horizontalDist, 2) + Math.pow(verticalDist, 2));
                        
                        // Проверяем прямое попадание в слот (курсор находится над слотом)
                        const isDirectHit = pos.x >= rect.left && pos.x <= rect.right && 
                                          pos.y >= rect.top && pos.y <= rect.bottom;
                        
                        // Сильно уменьшаем расстояние, если курсор находится прямо над слотом
                        let adjustedDistance = isDirectHit ? distance * 0.3 : distance;
                        
                        // Если слот занят или принадлежит к той же смене, увеличиваем расстояние (делаем его менее привлекательным)
                        if (isOccupied || isSameShiftType) {
                            adjustedDistance = adjustedDistance * 1000; // Сделаем практически невозможным выбор слота того же типа
                        }
                        
                        // Если это ближайший слот или прямое попадание, но не занятый
                        if (adjustedDistance < minDistance && slotIndex >= 0) {
                            minDistance = adjustedDistance;
                            closestSlot = slot;
                            
                            // Если курсор находится над слотом, отмечаем это
                            if (isDirectHit && !isOccupied) {
                                isOverValidSlot = true;
                            }
                        }
                    });
                    
                    // Если нашли ближайший слот, отмечаем его как цель для перетаскивания,
                    // но только если он не занят и не принадлежит к тому же типу смены
                    if (closestSlot) {
                        const slotElement = closestSlot as HTMLElement;
                        const isOccupied = slotElement.querySelector('.courier-avatar-container') !== null;
                        
                        // Проверяем, принадлежит ли слот к той же смене
                        const slotId = slotElement.getAttribute('data-draggable-id') || slotElement.getAttribute('data-testid');
                        let slotType = 'unknown';
                        if (slotId?.startsWith('day-') || slotId?.startsWith('slot-day-')) {
                            slotType = 'day';
                        } else if (slotId?.startsWith('night-') || slotId?.startsWith('slot-night-')) {
                            slotType = 'night';
                        }
                        
                        const isSameShiftType = slotType === dragSourceType;
                        
                        // Не добавляем drop-target класс для слотов того же типа
                        if (!isOccupied && !isSameShiftType) {
                            slotElement.classList.add('drop-target');
                            activeDropTarget = slotElement;
                            
                            // Если курсор находится достаточно близко к слоту, добавляем класс активной цели
                            const rect = slotElement.getBoundingClientRect();
                            const isCloseEnough = minDistance < rect.width * 0.7;
                            
                            if (isCloseEnough) {
                                slotElement.classList.add('drop-target-active');
                            }
                        } else {
                            if (isSameShiftType) {
                                console.log('[ShiftPanel] Slot is of the same shift type, ignoring for drop target');
                            } else {
                                console.log('[ShiftPanel] Closest slot is occupied, ignoring for drop target');
                            }
                            activeDropTarget = null;
                        }
                    } else {
                        activeDropTarget = null;
                    }
                    
                    // Обновляем позицию и визуальное состояние с плавной анимацией
                    if (dragElement) {
                        // Базовое смещение для перетаскивания
                        dragElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                        
                        // Изменяем визуальное состояние в зависимости от наличия активной цели
                        let targetHasAvatar = false;
                        if (closestSlot) {
                            const avatar = (closestSlot as HTMLElement).querySelector('.courier-avatar-container');
                            targetHasAvatar = avatar !== null;
                        }
                        
                        const hasActiveTarget = closestSlot && 
                                               !targetHasAvatar && 
                                               (closestSlot as HTMLElement).classList.contains('drop-target-active');
                        
                        if (hasActiveTarget) {
                            // Добавляем плавную анимацию для эффекта "прилипания"
                            dragElement.style.transition = 'opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease';
                            
                            // Увеличиваем непрозрачность для визуального выделения
                            dragElement.style.opacity = '0.9';
                            
                            // Добавляем тень для визуального эффекта поднятия
                            dragElement.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
                            
                            // Активируем индикатор цели в ближайшем слоте
                            if (closestSlot) {
                                const targetIndicator = (closestSlot as HTMLElement).querySelector('.target-indicator') as HTMLElement;
                                if (targetIndicator) {
                                    targetIndicator.classList.add('active');
                                }
                            }
                        } else {
                            // Для обычного перемещения отключаем анимацию transform
                            dragElement.style.transition = 'opacity 0.2s ease, box-shadow 0.2s ease';
                            
                            // Уменьшаем непрозрачность для показа состояния перетаскивания
                            dragElement.style.opacity = isOverValidSlot ? '0.8' : '0.6';
                            
                            // Добавляем базовую тень
                            dragElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                            
                            // Деактивируем все индикаторы целей
                            document.querySelectorAll('.target-indicator.active').forEach(indicator => {
                                (indicator as HTMLElement).classList.remove('active');
                            });
                        }
                    }
                };
                
                const handleEnd = async (endEvent: MouseEvent | TouchEvent) => {
                    if (!isDragging || !dragElement) {
                        console.log('[ShiftPanel] handleEnd called but no active drag');
                        return;
                    }
                    
                    // Для touch-событий не блокируем действие по умолчанию для системных жестов
                    const isTouchEvent = 'changedTouches' in endEvent;
                    if (!isTouchEvent) {
                        endEvent.preventDefault();
                    }
                    
                    console.log('[ShiftPanel] handleEnd triggered for drag element:', dragElement);
                    console.log('[ShiftPanel] Drag element attributes:', {
                        id: dragElement.id,
                        className: dragElement.className,
                        dataId: dragElement.getAttribute('data-draggable-id'),
                        dataType: dragElement.getAttribute('data-type'),
                        dataIndex: dragElement.getAttribute('data-index')
                    });
                    
                    // Определяем позицию, где был отпущен курьер
                    const endPos = isTouchEvent
                        ? { x: endEvent.changedTouches[0].clientX, y: endEvent.changedTouches[0].clientY }
                        : { x: endEvent.clientX, y: endEvent.clientY };
                    
                    console.log('[ShiftPanel] Drop position:', endPos);
                    
                    // Если есть активная цель для перетаскивания, используем ее
                    let targetSlot = activeDropTarget;
                    
                    // Если нет активной цели, проверяем все слоты
                    if (!targetSlot) {
                        // Проверяем, находимся ли мы над допустимым слотом
                        const slots = document.querySelectorAll('.slot-button:not(:has(.courier-avatar-container))');
                        console.log('[ShiftPanel] Found', slots.length, 'possible empty target slots');
                        
                        // Подробное логирование всех слотов
                        slots.forEach((slot, idx) => {
                            const rect = slot.getBoundingClientRect();
                            const slotId = slot.getAttribute('data-draggable-id') || slot.getAttribute('data-testid');
                            console.log(`[ShiftPanel] Slot #${idx} ID:${slotId} bounds:`, { 
                                left: rect.left, 
                                right: rect.right, 
                                top: rect.top, 
                                bottom: rect.bottom,
                                contains: (
                                    endPos.x >= rect.left && endPos.x <= rect.right && 
                                    endPos.y >= rect.top && endPos.y <= rect.bottom
                                ),
                                isEmpty: slot.querySelector('.courier-avatar-container') === null
                            });
                        });
                        
                        // Получаем информацию о перетаскиваемом элементе
                        const dragId = dragElement.getAttribute('data-draggable-id') || '';
                        const dragParts = dragId.split('-');
                        const dragSourceType = dragParts[0] as 'day' | 'night';
                        
                        // Находим ближайший ПУСТОЙ слот к позиции отпускания
                        let minDistance = Number.MAX_VALUE;
                        
                        // Поиск целевого слота с использованием расстояния до центра слота
                        slots.forEach((slot) => {
                            // Проверяем, пуст ли слот
                            const isOccupied = slot.querySelector('.courier-avatar-container') !== null;
                            if (isOccupied) {
                                return; // Пропускаем занятые слоты
                            }
                            
                            // Проверяем, принадлежит ли слот к той же смене
                            const slotId = slot.getAttribute('data-draggable-id') || slot.getAttribute('data-testid');
                            let slotType = 'unknown';
                            if (slotId?.startsWith('day-') || slotId?.startsWith('slot-day-')) {
                                slotType = 'day';
                            } else if (slotId?.startsWith('night-') || slotId?.startsWith('slot-night-')) {
                                slotType = 'night';
                            }
                            
                            // Всегда пропускаем слоты того же типа, независимо от статуса пользователя
                            const isSameShiftType = slotType === dragSourceType;
                            if (isSameShiftType) {
                                console.log('[ShiftPanel] Cannot move within the same shift type, skipping slot');
                                return; // Пропускаем слоты того же типа для всех пользователей
                            }
                            
                            const rect = slot.getBoundingClientRect();
                            const centerX = (rect.left + rect.right) / 2;
                            const centerY = (rect.top + rect.bottom) / 2;
                            
                            // Вычисляем расстояние до центра слота
                            const distance = Math.sqrt(
                                Math.pow(endPos.x - centerX, 2) + 
                                Math.pow(endPos.y - centerY, 2)
                            );
                            
                            // Если точка внутри слота, устанавливаем минимальное расстояние
                            if (endPos.x >= rect.left && endPos.x <= rect.right && 
                                endPos.y >= rect.top && endPos.y <= rect.bottom) {
                                targetSlot = slot;
                                minDistance = 0;
                                console.log('[ShiftPanel] Found direct hit on target empty slot:', slot.getAttribute('data-draggable-id'));
                            } 
                            // Если это ближайший слот и расстояние меньше определенного порога
                            else if (distance < minDistance && distance < 100) { // 100px порог для "близости"
                                targetSlot = slot;
                                minDistance = distance;
                                console.log('[ShiftPanel] Found closest empty target slot:', slot.getAttribute('data-draggable-id'), 'distance:', distance);
                            }
                        });
                        
                        // Также проверяем, есть ли слот с классом drop-target
                        const dropTargetSlot = document.querySelector('.slot-button.drop-target:not(:has(.courier-avatar-container))');
                        if (dropTargetSlot && !targetSlot) {
                            console.log('[ShiftPanel] Using highlighted empty drop target as fallback');
                            targetSlot = dropTargetSlot;
                        }
                    } else {
                        // Проверяем, пуст ли активный слот
                        const isOccupied = targetSlot.querySelector('.courier-avatar-container') !== null;
                        if (isOccupied) {
                            console.log('[ShiftPanel] Active drop target is occupied, cancelling drop');
                            targetSlot = null;
                        } else {
                            console.log('[ShiftPanel] Using active empty drop target:', 
                                targetSlot?.getAttribute('data-draggable-id') || 
                                targetSlot?.getAttribute('data-testid') || 'unknown');
                        }
                    }
                    
                    console.log('[ShiftPanel] Final target slot found:', !!targetSlot);
                    
                    // Если нашли целевой слот, выполняем перемещение
                    if (targetSlot) {
                        // Получаем атрибуты data-type и data-index из элемента перетаскивания
                        const sourceType = dragElement.getAttribute('data-type') as 'day' | 'night';
                        const sourceIndexStr = dragElement.getAttribute('data-index');
                        
                        if (!sourceType || !sourceIndexStr) {
                            console.error('[ShiftPanel] Missing source data attributes, trying draggable-id fallback');
                            const sourceDataId = dragElement.getAttribute('data-draggable-id');
                            if (sourceDataId) {
                                const sourceParts = sourceDataId.split('-');
                                if (sourceParts.length >= 2) {
                                    console.log('[ShiftPanel] Extracted source data from draggable-id:', sourceParts);
                                    const [type, index] = sourceParts;
                                    
                                    // Проверяем, что type в допустимых значениях ('day' или 'night')
                                    if (type === 'day' || type === 'night') {
                                        console.log('[ShiftPanel] Valid source type from draggable-id:', type);
                                        const sourceIndex = parseInt(index, 10);
                                        
                                        if (!isNaN(sourceIndex)) {
                                            console.log('[ShiftPanel] Processing source:', { type, sourceIndex });
                                            
                                            // Получаем идентификатор целевого слота
                                            const targetDataId = targetSlot.getAttribute('data-draggable-id') || 
                                                               targetSlot.getAttribute('data-testid')?.replace('slot-', '');
                                            
                                            if (targetDataId) {
                                                const targetParts = targetDataId.split('-');
                                                if (targetParts.length >= 2) {
                                                    let targetType = targetParts[0];
                                                    let targetIndexStr = targetParts[1];
                                                    
                                                    // Обработка случая, когда ID имеет формат 'slot-day-1'
                                                    if (targetType === 'slot' && targetParts.length >= 3) {
                                                        targetType = targetParts[1];
                                                        targetIndexStr = targetParts[2];
                                                    }
                                                    
                                                    const targetIndex = parseInt(targetIndexStr, 10);
                                                    
                                                    if ((targetType === 'day' || targetType === 'night') && !isNaN(targetIndex)) {
                                                        // Проверяем, не перемещаем ли мы в ту же самую смену (только для не-старших курьеров)
                                                        if (!isCurrentUserSenior && type === targetType) {
                                                            console.log('[ShiftPanel] Non-senior user cannot move within the same shift type');
                                                            return;
                                                        }
                                                        
                                                        console.log('[ShiftPanel] Processing move:', { 
                                                            sourceType: type, 
                                                            sourceIndex, 
                                                            targetType, 
                                                            targetIndex 
                                                        });
                                                        
                                                        // Находим данные о перемещаемом курьере
                                                        const sourceShifts = type === 'day' ? localDayShifts : localNightShifts;
                                                        const movedCourier = sourceShifts.find(shift => shift.slotIndex === sourceIndex);
                                                        
                                                        console.log('[ShiftPanel] Source shifts:', sourceShifts);
                                                        console.log('[ShiftPanel] Moved courier found:', movedCourier);
                                                        
                                                        if (movedCourier) {
                                                            const result = await processDropAction(
                                                                movedCourier, 
                                                                type as 'day' | 'night', 
                                                                sourceIndex, 
                                                                targetType as 'day' | 'night', 
                                                                targetIndex
                                                            );
                                                            
                                                            if (result) {
                                                                console.log('[ShiftPanel] Drop action was successful');
                                                            } else {
                                                                console.error('[ShiftPanel] Drop action failed');
                                                            }
                                                        } else {
                                                            console.error('[ShiftPanel] Could not find courier at source position');
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            const sourceIndex = parseInt(sourceIndexStr, 10);
                            if (!isNaN(sourceIndex)) {
                                console.log('[ShiftPanel] Extracted source data:', { sourceType, sourceIndex });
                                
                                // Получаем идентификатор целевого слота
                                const targetDataId = targetSlot.getAttribute('data-draggable-id') || 
                                                   targetSlot.getAttribute('data-testid')?.replace('slot-', '');
                                
                                if (targetDataId) {
                                    const targetParts = targetDataId.split('-');
                                    if (targetParts.length >= 2) {
                                        let targetType = targetParts[0];
                                        let targetIndexStr = targetParts[1];
                                        
                                        // Обработка случая, когда ID имеет формат 'slot-day-1'
                                        if (targetType === 'slot' && targetParts.length >= 3) {
                                            targetType = targetParts[1];
                                            targetIndexStr = targetParts[2];
                                        }
                                        
                                        const targetIndex = parseInt(targetIndexStr, 10);
                                        
                                        if ((targetType === 'day' || targetType === 'night') && !isNaN(targetIndex)) {
                                            // Проверяем, не перемещаем ли мы в ту же самую смену (только для не-старших курьеров)
                                            if (!isCurrentUserSenior && sourceType === targetType) {
                                                console.log('[ShiftPanel] Non-senior user cannot move within the same shift type');
                                                return;
                                            }
                                            
                                            console.log('[ShiftPanel] Processing move:', { 
                                                sourceType, 
                                                sourceIndex, 
                                                targetType, 
                                                targetIndex 
                                            });
                                            
                                            // Находим данные о перемещаемом курьере
                                            const sourceShifts = sourceType === 'day' ? localDayShifts : localNightShifts;
                                            const movedCourier = sourceShifts.find(shift => shift.slotIndex === sourceIndex);
                                            
                                            console.log('[ShiftPanel] Source shifts:', sourceShifts);
                                            console.log('[ShiftPanel] Moved courier found:', movedCourier);
                                            
                                            if (movedCourier) {
                                                const result = await processDropAction(
                                                    movedCourier, 
                                                    sourceType, 
                                                    sourceIndex, 
                                                    targetType as 'day' | 'night', 
                                                    targetIndex
                                                );
                                                
                                                if (result) {
                                                    console.log('[ShiftPanel] Drop action was successful');
                                                } else {
                                                    console.error('[ShiftPanel] Drop action failed');
                                                }
                                            } else {
                                                console.error('[ShiftPanel] Could not find courier at source position');
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        console.log('[ShiftPanel] No valid drop target found, cancelling drag operation');
                    }
                    
                    // Всегда сбрасываем состояние перетаскивания, но НЕ сбрасываем стили элемента,
                    // который успешно перемещается (data-success-pending) или был перемещен (data-success)
                    console.log('[ShiftPanel] Resetting drag state, but preserving successful moves');
                    
                    // Сохраняем ссылку на dragElement, чтобы использовать его после сброса состояния
                    const currentDragElement = dragElement;
                    const isMoving = currentDragElement.hasAttribute('data-moving') ||
                                     currentDragElement.hasAttribute('data-success-pending') ||
                                     currentDragElement.hasAttribute('data-success');
                    
                    // Очищаем обработчики и другие глобальные состояния
                    document.removeEventListener('mousemove', handleMove as any);
                    document.removeEventListener('touchmove', handleMove as any, { passive: false } as any);
                    document.removeEventListener('mouseup', handleGlobalMouseUp as any);
                    document.removeEventListener('touchend', handleGlobalTouchEnd as any);
                    
                    // Очищаем все слоты с классом drop-target
                    document.querySelectorAll('.drop-target').forEach(el => {
                        el.classList.remove('drop-target');
                    });
                    
                    // Сбрасываем глобальные переменные состояния
                    isDragging = false;
                    activeDropTarget = null;
                    dragStartTime = 0;
                    initialPosition = { x: 0, y: 0 };
                    
                    // Сбрасываем dragElement только если он не в процессе успешного перемещения
                    if (!isMoving) {
                        console.log('[ShiftPanel] Resetting drag element styles to original');
                        currentDragElement.classList.remove('dragging');
                        currentDragElement.style.transform = '';
                        currentDragElement.style.transition = 'all 0.3s ease';
                        currentDragElement.style.opacity = '1';
                        currentDragElement.style.cursor = '';
                    } else {
                        console.log('[ShiftPanel] Preserving drag element styles due to successful or pending move');
                    }
                    
                    // Очищаем ссылку на элемент, но НЕ сбрасываем его стили
                    dragElement = null;
                };

                // Функция для обработки перемещения курьера между слотами
                const processDropAction = async (
                    movedCourier: ShiftSlotLocal,
                    sourceType: 'day' | 'night',
                    sourceIndex: number,
                    targetType: 'day' | 'night',
                    targetIndex: number
                ): Promise<boolean> => {
                    console.log('[ShiftPanel] Drop detected:', {
                        movedCourier,
                        sourceType,
                        sourceIndex,
                        targetType,
                        targetIndex
                    });
                    
                    // Проверка на то, что начальный и конечный слот различаются
                    if (sourceType === targetType && sourceIndex === targetIndex) {
                        console.log('[ShiftPanel] Source and target slots are the same, cancelling move');
                        return false;
                    }

                    try {
                        // Находим существующего курьера
                        const sourceCourier = movedCourier;
                        
                        if (!sourceCourier || !sourceCourier.id) {
                            console.error('[ShiftPanel] No courier found at source position or missing ID');
                            return false;
                        }
                        
                        console.log('[ShiftPanel] Found source courier:', sourceCourier);
                        
                        // Вызываем handleSlotSelect для обработки перемещения
                        // Передаем параметры для обновления смены с сохранением данных курьера
                        console.log('[ShiftPanel] Calling handleSlotSelect with:', {
                            sourceType,
                            sourceIndex,
                            targetType,
                            targetIndex,
                            courierUserId: sourceCourier.userId,
                            existingShiftId: sourceCourier.id
                        });
                        
                        // Оптимистично обновляем локальное состояние перед отправкой запроса
                        // Это позволит увидеть изменения до получения ответа от сервера
                        const newDayShifts = [...localDayShifts];
                        const newNightShifts = [...localNightShifts];
                        
                        // Если перемещаем из дневной смены
                        if (sourceType === 'day') {
                            // Удаляем курьера из исходного слота
                            const updatedDayShifts = newDayShifts.filter(
                                (shift: ShiftSlotLocal) => shift.slotIndex !== sourceIndex
                            );
                            setLocalDayShifts(updatedDayShifts);
                            
                            // Если перемещаем в ночную смену
                            if (targetType === 'night') {
                                // Добавляем курьера в целевой слот
                                const updatedCourier: ShiftSlotLocal = {
                                    ...sourceCourier,
                                    slotIndex: targetIndex,
                                    shiftType: 'night'
                                };
                                setLocalNightShifts([...newNightShifts, updatedCourier]);
                            }
                        } 
                        // Если перемещаем из ночной смены
                        else if (sourceType === 'night') {
                            // Удаляем курьера из исходного слота
                            const updatedNightShifts = newNightShifts.filter(
                                (shift: ShiftSlotLocal) => shift.slotIndex !== sourceIndex
                            );
                            setLocalNightShifts(updatedNightShifts);
                            
                            // Если перемещаем в дневную смену
                            if (targetType === 'day') {
                                // Добавляем курьера в целевой слот
                                const updatedCourier: ShiftSlotLocal = {
                                    ...sourceCourier,
                                    slotIndex: targetIndex,
                                    shiftType: 'day'
                                };
                                setLocalDayShifts([...newDayShifts, updatedCourier]);
                            }
                        } else {
                            // Необработанный тип смены
                            console.error('[ShiftPanel] Unhandled shift type:', sourceType);
                            return false;
                        }
                        
                        // После оптимистичного обновления UI вызываем API для фактического обновления
                        await handleSlotSelect(
                            targetType, 
                            targetIndex, 
                            sourceCourier.id, 
                            true // isDragAction
                        );
                        
                        console.log('[ShiftPanel] handleSlotSelect completed');
                        
                        // Показываем сообщение об успешном перемещении
                        showSuccessMessage('Курьер успешно перемещен');
                        
                        // Активируем анимацию галочки напрямую
                        activateSuccessAnimation(targetType, targetIndex);
                        
                        return true;
                    } catch (error) {
                        console.error('[ShiftPanel] Error in processDropAction:', error);
                        // В случае ошибки можно отменить оптимистичное обновление,
                        // загрузив актуальные данные заново
                        forceUpdate();
                        return false;
                    }
                };

                const handleGlobalTouchEnd = (endEvent: TouchEvent) => {
                    if (isDragging && dragElement) {
                        console.log('[ShiftPanel] Global touchend event detected during drag');
                        handleEnd(endEvent);
                    }
                };

                const handleGlobalMouseUp = (endEvent: MouseEvent) => {
                    if (isDragging && dragElement) {
                        console.log('[ShiftPanel] Global mouseup event detected during drag');
                        handleEnd(endEvent);
                    }
                };

                // Явно добавляем обработчики с сообщениями
                console.log('[ShiftPanel] Adding event listeners for drag');
                document.addEventListener('mousemove', handleMove as any);
                document.addEventListener('touchmove', handleMove as any, { passive: false });
                document.addEventListener('mouseup', handleGlobalMouseUp as any);
                document.addEventListener('touchend', handleGlobalTouchEnd as any);
                console.log('[ShiftPanel] Event listeners added for drag operations');
            }
        };

        // Добавим обработчик только для предотвращения контекстного меню
        const preventContextMenu = (e: Event) => {
            e.preventDefault();
            return false;
        };

        document.addEventListener('customDragStart', handleCustomDragStart as EventListener);
        document.addEventListener('contextmenu', preventContextMenu);
        
        return () => {
            document.removeEventListener('customDragStart', handleCustomDragStart as EventListener);
            document.removeEventListener('contextmenu', preventContextMenu);
            resetDragState();
        };
    }, [
        isCurrentUserSenior, 
        localDayShifts, 
        localNightShifts, 
        dayShifts, 
        nightShifts, 
        forceUpdate, 
        handleSlotSelect, 
        showSuccessMessage, 
        onDragEnd
    ]);

    // Обновляем useEffect для глобальных обработчиков перетаскивания
    useEffect(() => {
        // Глобальный обработчик окончания перетаскивания
        const handleGlobalMouseUp = (e: MouseEvent) => {
            console.log('[ShiftPanel] Global document mouseup detected');
            
            // Если есть активный элемент перетаскивания, обрабатываем его
            const draggingElement = document.querySelector('.dragging') as HTMLElement;
            if (draggingElement) {
                console.log('[ShiftPanel] Found active dragging element during global mouseup');
                
                // Пересоздаем синтетическое событие для вызова нашего обработчика
                const syntheticEvent = {
                    type: 'mouseup',
                    clientX: e.clientX,
                    clientY: e.clientY,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };
                
                // Напрямую вызываем обработчик отпускания
                handleCourierAvatarRelease(syntheticEvent);
                
                // Проверяем статус перемещения элемента
                const isMoving = draggingElement.hasAttribute('data-moving') ||
                                 draggingElement.hasAttribute('data-success-pending') ||
                                 draggingElement.hasAttribute('data-success');
                                 
                // Убираем класс перетаскивания только если элемент НЕ был успешно перемещен
                if (!isMoving) {
                    console.log('[ShiftPanel] Resetting non-moving element styles');
                    draggingElement.classList.remove('dragging');
                    draggingElement.style.transform = 'translate(0, 0)';
                    draggingElement.style.transition = 'all 0.3s ease';
                    draggingElement.style.opacity = '1';
                } else {
                    console.log('[ShiftPanel] Preserving moving element styles');
                    // Для перемещаемых элементов только убираем класс dragging
                    draggingElement.classList.remove('dragging');
                }
            }
        };
        
        const handleGlobalTouchEnd = (e: TouchEvent) => {
            console.log('[ShiftPanel] Global document touchend detected');
            
            // Если есть активный элемент перетаскивания, обрабатываем его
            const draggingElement = document.querySelector('.dragging') as HTMLElement;
            if (draggingElement) {
                console.log('[ShiftPanel] Found active dragging element during global touchend');
                
                // Пересоздаем синтетическое событие для вызова нашего обработчика
                const touch = e.changedTouches?.[0];
                if (touch) {
                    const syntheticEvent = {
                        type: 'touchend',
                        changedTouches: [touch],
                        preventDefault: () => {},
                        stopPropagation: () => {}
                    };
                    
                    // Напрямую вызываем обработчик отпускания
                    handleCourierAvatarRelease(syntheticEvent);
                    
                    // Проверяем статус перемещения элемента
                    const isMoving = draggingElement.hasAttribute('data-moving') ||
                                     draggingElement.hasAttribute('data-success-pending') ||
                                     draggingElement.hasAttribute('data-success');
                                     
                    // Убираем класс перетаскивания только если элемент НЕ был успешно перемещен
                    if (!isMoving) {
                        console.log('[ShiftPanel] Resetting non-moving element styles');
                        draggingElement.classList.remove('dragging');
                        draggingElement.style.transform = 'translate(0, 0)';
                        draggingElement.style.transition = 'all 0.3s ease';
                        draggingElement.style.opacity = '1';
                    } else {
                        console.log('[ShiftPanel] Preserving moving element styles');
                        // Для перемещаемых элементов только убираем класс dragging
                        draggingElement.classList.remove('dragging');
                    }
                }
            }
        };

        // Добавляем глобальные обработчики к документу
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('touchend', handleGlobalTouchEnd);
        
        // Удаляем обработчики при размонтировании
        return () => {
            document.removeEventListener('mouseup', handleGlobalMouseUp);
            document.removeEventListener('touchend', handleGlobalTouchEnd);
        };
    }, [handleCourierAvatarRelease]);

    // Добавляем после объявления компонента, но до объявления useEffect или других хуков
    
    // Функция для поиска элемента с минимальным расстоянием до заданных координат
    const findClosestElement = (clientX: number, clientY: number) => {
        console.log('[ShiftPanel] Finding closest slot element to:', { clientX, clientY });
        
        // Логирование имеющихся селекторов для отладки
        const allSlotButtons = document.querySelectorAll('.slot-button');
        console.log('[ShiftPanel] Found .slot-button elements:', allSlotButtons.length);
        
        let closestElement: Element | null = null;
        let closestType: 'day' | 'night' = 'day';
        let closestIndex = -1;
        let minDistance = Infinity;
        
        // Функция для определения расстояния от точки до центра элемента
        // Используем взвешенное расстояние, где вертикальное расстояние имеет меньший вес
        // что помогает лучше группировать слоты по рядам
        const distanceToCenter = (element: Element, x: number, y: number) => {
            const rect = element.getBoundingClientRect();
            const centerX = (rect.left + rect.right) / 2;
            const centerY = (rect.top + rect.bottom) / 2;
            
            // Усиливаем притяжение по горизонтали, ослабляем по вертикали
            const horizontalWeight = 1.0;
            const verticalWeight = 0.7; // Уменьшенный вес для вертикального расстояния
            
            return Math.sqrt(
                Math.pow((x - centerX) * horizontalWeight, 2) + 
                Math.pow((y - centerY) * verticalWeight, 2)
            );
        };
        
        // Проверяем все элементы с классом slot-button
        allSlotButtons.forEach(slot => {
            const distance = distanceToCenter(slot, clientX, clientY);
            const draggableId = slot.getAttribute('data-draggable-id') || '';
            
            // Извлекаем тип и индекс из data-draggable-id
            let slotType: 'day' | 'night' = 'day';
            let slotIndex = -1;
            
            if (draggableId.startsWith('day-')) {
                slotType = 'day';
                slotIndex = parseInt(draggableId.split('-')[1], 10);
            } else if (draggableId.startsWith('night-')) {
                slotType = 'night';
                slotIndex = parseInt(draggableId.split('-')[1], 10);
            } else {
                // Пробуем определить тип по другим атрибутам
                const testId = slot.getAttribute('data-testid') || '';
                if (testId.includes('day')) {
                    slotType = 'day';
                    const matches = testId.match(/\d+/);
                    if (matches) {
                        slotIndex = parseInt(matches[0], 10);
                    }
                } else if (testId.includes('night')) {
                    slotType = 'night';
                    const matches = testId.match(/\d+/);
                    if (matches) {
                        slotIndex = parseInt(matches[0], 10);
                    }
                }
            }
            
            if (Math.random() < 0.05) {  // Логируем только 5% проверок для уменьшения шума
                console.log(`[ShiftPanel] Checking slot ${slotType}-${slotIndex}:`, { 
                    distance, 
                    draggableId,
                    rect: slot.getBoundingClientRect()
                });
            }
            
            // Улучшенный алгоритм отбора ближайшего слота с увеличенным влиянием
            // для слотов, которые явно находятся под курсором
            const rect = slot.getBoundingClientRect();
            const isDirectHit = 
                clientX >= rect.left && clientX <= rect.right && 
                clientY >= rect.top && clientY <= rect.bottom;
                
            // Если курсор находится прямо над слотом, значительно уменьшаем расстояние
            const adjustedDistance = isDirectHit ? distance * 0.3 : distance;
            
            if (adjustedDistance < minDistance && slotIndex >= 0) {
                minDistance = adjustedDistance;
                closestElement = slot as HTMLElement;
                closestType = slotType;
                closestIndex = slotIndex;
            }
        });
        
        return { 
            element: closestElement as HTMLElement | null, 
            type: closestType, 
            index: closestIndex, 
            distance: minDistance 
        };
    };

    // Функция для активации анимации галочки после успешного действия
    const activateSuccessAnimation = useCallback((shiftType: 'day' | 'night', slotIndex: number) => {
        const animationKey = `${shiftType}-${slotIndex}`;
        
        console.log('[ShiftPanel] Активация анимации успеха для:', animationKey);
        
        // Устанавливаем анимацию в карту
        setSuccessAnimations(prevAnimations => {
            const newAnimations = new Map(prevAnimations);
            newAnimations.set(animationKey, true);
            console.log('[ShiftPanel] Активные анимации после установки:', Array.from(newAnimations.entries()));
            return newAnimations;
        });
        
        // Дополнительное обновление UI для гарантии отображения анимации
        setTimeout(() => {
            forceUpdate();
            console.log('[ShiftPanel] Принудительное обновление UI после активации анимации');
        }, 10);
        
        // Удаляем анимацию через 3 секунды
        setTimeout(() => {
            console.log('[ShiftPanel] Удаление анимации успеха для:', animationKey);
            setSuccessAnimations(prevAnimations => {
                const newAnimations = new Map(prevAnimations);
                newAnimations.delete(animationKey);
                console.log('[ShiftPanel] Активные анимации после удаления:', Array.from(newAnimations.entries()));
                return newAnimations;
            });
            
            // Дополнительное обновление UI после удаления анимации
            setTimeout(forceUpdate, 10);
        }, 3000);
    }, [forceUpdate]);
    
    // Находим смену текущего пользователя (дневную или ночную)
    const userShift = userDayShift || userNightShift;

    return (
        <DragDropContext onDragEnd={(result) => {
            console.log('[ShiftPanel] DragDropContext onDragEnd:', result);
            onDragEnd(result);
        }}>
            <React.Fragment key="shift-panel-root">
                <DialogHeader>
                    <DialogTitle>Выбор смены</DialogTitle>
                    <DialogDate>{format(date, 'dd MMMM yyyy', { locale: ru })}</DialogDate>
                </DialogHeader>

                <ShiftSection key="day-shift-section">
                    <ShiftTitle>
                        <ShiftIcon>☀️</ShiftIcon> Дневная смена
                    </ShiftTitle>
                    <Droppable droppableId="day-shift">
                        {(provided: DroppableProvided) => (
                            <SlotsGrid
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                style={{ minHeight: '80px' }}
                            >
                                {renderSlots('day', maxDaySlots)}
                                {provided.placeholder}
                            </SlotsGrid>
                        )}
                    </Droppable>
                </ShiftSection>

                <ShiftSection key="night-shift-section">
                    <ShiftTitle>
                        <ShiftIcon>🌙</ShiftIcon> Вечерняя смена
                    </ShiftTitle>
                    <Droppable droppableId="night-shift">
                        {(provided: DroppableProvided) => (
                            <SlotsGrid
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                style={{ minHeight: '80px' }}
                            >
                                {renderSlots('night', maxNightSlots)}
                                {provided.placeholder}
                            </SlotsGrid>
                        )}
                    </Droppable>
                </ShiftSection>

                {/* Подсказка для старших курьеров */}
                {isCurrentUserSenior && (
                    <SeniorHint>
                        Вы - старший курьер. У вас есть возможность управлять сменами других курьеров.
                    </SeniorHint>
                )}
                
                {/* Обычная подсказка о долгом нажатии для обычных курьеров */}
                {!isCurrentUserSenior && (
                    <LongPressHint>
                        💡 Совет: Удерживайте аватар курьера для просмотра расширенного профиля
                    </LongPressHint>
                )}
                
                {isFullyBooked && !userHasShift && (
                    <NoSlotsMessage key="no-slots-message">
                        Все смены уже заняты.<br/>
                        Вы можете записаться в резерв.
                    </NoSlotsMessage>
                )}
                
                {/* Диалог профиля курьера (при долгом нажатии) */}
                {selectedCourier && (
                    <CourierProfileDialog
                        open={profileDialogOpen}
                        onClose={() => setProfileDialogOpen(false)}
                        courierId={Number(selectedCourier.id)}
                        courierName={selectedCourier.name}
                        courierAvatar={selectedCourier.avatar}
                        chatId={chatId}
                        isSeniorCourier={selectedCourier.isSeniorCourier}
                    />
                )}
                
                {/* Модальное окно подтверждения записи на смену */}
                {confirmationOpen && (
                    <ConfirmationModal
                        className="modal-backdrop"
                        onClick={handleCancelConfirmation}
                    >
                        <ConfirmationContent>
                            <CloseIcon onClick={handleCancelConfirmation} title="Закрыть">✕</CloseIcon>
                            <ConfirmationTitle>
                                <ShiftTypeIcon>
                                    {pendingShift?.shiftType === 'day' ? '☀️' : '🌙'}
                                </ShiftTypeIcon>
                                Подтверждение записи
                            </ConfirmationTitle>
                            <ConfirmationText>
                                Вы уверены, что хотите записаться на <strong>{pendingShift?.shiftType === 'day' ? 'дневную' : 'вечернюю'}</strong> смену 
                                <br />на <strong>{format(date, 'd MMMM yyyy', { locale: ru })}</strong>?
                            </ConfirmationText>
                            <ConfirmationButtons>
                                <CancelButton onClick={handleCancelConfirmation}>
                                    <ConfirmIcon>✕</ConfirmIcon> Отмена
                                </CancelButton>
                                <ConfirmButton onClick={handleConfirmShift}>
                                    <ConfirmIcon>✓</ConfirmIcon> Подтвердить
                                </ConfirmButton>
                            </ConfirmationButtons>
                        </ConfirmationContent>
                    </ConfirmationModal>
                )}
            </React.Fragment>
        </DragDropContext>
    );
}, (prevProps: ShiftPanelProps, nextProps: ShiftPanelProps) => {
    return (
        prevProps.date.getTime() === nextProps.date.getTime() &&
        prevProps.dayShifts.length === nextProps.dayShifts.length &&
        prevProps.nightShifts.length === nextProps.nightShifts.length &&
        prevProps.currentUserId === nextProps.currentUserId &&
        prevProps.reserves.length === nextProps.reserves.length
    );
});

// Экспортируем компонент
export default ShiftPanel; 