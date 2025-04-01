import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useSelector } from 'react-redux';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { RootState } from '../../store/store';
import { useShiftUIState } from './hooks/useShiftUIState';
import ShiftSlot from './components/ShiftSlot';
import ShiftConfirmationDialog from './components/ShiftConfirmationDialog';

// TODO: Временная заглушка для useWebSocket, будет заменена на реальную реализацию
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const useWebSocket = (chatId?: string) => ({
    isConnected: false,
    connect: () => console.log('🔄 [useWebSocket] Подключение временно недоступно'),
    disconnect: () => console.log('🔄 [useWebSocket] Отключение временно недоступно'),
    subscribe: () => {
        console.log('🔄 [useWebSocket] Подписка временно недоступна');
        return () => console.log('🧹 [useWebSocket] Отписка временно недоступна');
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    joinShiftsRoom: (chatId: string) => {
        console.log('🔄 [useWebSocket] Присоединение к комнате смен временно недоступно');
    }
});

// Интерфейсы
interface ShiftSlotLocal {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    is_senior_courier?: boolean;
}

interface ShiftPanelContainerProps {
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
    reserves: any[];
    showSuccessMessage: (message: string) => void;
    chatId?: string;
    isLoading?: boolean;
    loadingSlot?: number | null;
    loadingType?: 'day' | 'night' | null;
}

// Стили
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

// Добавляем стили для подсветки целевого слота
const SlotHighlight = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    border: 3px dashed var(--primary-color);
    background-color: rgba(76, 175, 80, 0.1);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    
    &.active {
        opacity: 1;
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% {
            transform: scale(1);
            opacity: 0.5;
        }
        50% {
            transform: scale(1.1);
            opacity: 0.8;
        }
        100% {
            transform: scale(1);
            opacity: 0.5;
        }
    }
`;

const SeniorHint = styled.div`
    margin-top: 16px;
    padding: 12px 16px;
    background-color: rgba(255, 213, 0, 0.1);
    border-left: 3px solid #FFD700;
    border-radius: 4px;
    color: #705E00;
    font-size: 0.9rem;
`;

const LongPressHint = styled.div`
    margin-top: 16px;
    padding: 12px 16px;
    background-color: rgba(76, 175, 80, 0.1);
    border-left: 3px solid var(--primary-color);
    border-radius: 4px;
    color: var(--primary-dark);
    font-size: 0.9rem;
`;

const NoSlotsMessage = styled.div`
    margin-top: 16px;
    padding: 16px;
    background-color: rgba(255, 152, 0, 0.1);
    border-left: 3px solid #FF9800;
    border-radius: 4px;
    color: #A66200;
    font-size: 0.95rem;
    text-align: center;
    line-height: 1.5;
`;

const GlobalStyles = createGlobalStyle`
    .source-drag-slot {
        opacity: 0.3;
    }
    
    .drop-active {
        border: 2px solid var(--primary-color) !important;
        background-color: rgba(76, 175, 80, 0.3) !important;
        transform: scale(1.15) !important;
        box-shadow: 0 0 15px rgba(76, 175, 80, 0.5) !important;
        transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }
    
    .magnetic-target {
        border: 2px dashed var(--primary-color) !important;
        background-color: rgba(76, 175, 80, 0.2) !important;
        transform: scale(1.1) !important;
        box-shadow: 0 0 12px rgba(76, 175, 80, 0.4) !important;
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        animation: magnetic-pulse 1.5s infinite !important;
    }
    
    @keyframes magnetic-pulse {
        0% {
            transform: scale(1.1);
            box-shadow: 0 0 5px rgba(76, 175, 80, 0.4);
        }
        50% {
            transform: scale(1.15);
            box-shadow: 0 0 15px rgba(76, 175, 80, 0.6);
        }
        100% {
            transform: scale(1.1);
            box-shadow: 0 0 5px rgba(76, 175, 80, 0.4);
        }
    }
`;

// Добавляем хук для управления drag-and-drop
const useDragAndDrop = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
    const [dragGhost, setDragGhost] = useState<HTMLElement | null>(null);
    const [dragCourier, setDragCourier] = useState<any | null>(null);
    const [dragSourceType, setDragSourceType] = useState<'day' | 'night' | null>(null);
    const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
    const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
    const [currentPosition, setCurrentPosition] = useState({ x: 0, y: 0 });
    
    // Используем рефы для состояния чтобы обработчики событий имели доступ к актуальным значениям
    const isDraggingRef = useRef(false);
    const dragElementRef = useRef<HTMLElement | null>(null);
    const dragGhostRef = useRef<HTMLElement | null>(null);
    const startPositionRef = useRef({ x: 0, y: 0 });
    
    // Обновляем рефы при изменении соответствующих состояний
    useEffect(() => {
        isDraggingRef.current = isDragging;
    }, [isDragging]);
    
    useEffect(() => {
        dragElementRef.current = dragElement;
    }, [dragElement]);
    
    useEffect(() => {
        dragGhostRef.current = dragGhost;
    }, [dragGhost]);
    
    useEffect(() => {
        startPositionRef.current = startPosition;
    }, [startPosition]);

    // Функция для поиска ближайшего пустого слота к указанным координатам
    const findClosestDropTarget = useCallback((x: number, y: number, maxDistance = 120) => {
        // Получаем все пустые слоты
        const allSlots = document.querySelectorAll('.slot-button:not(.occupied)');
        let closestSlot: Element | null = null;
        let closestType: 'day' | 'night' = 'day';
        let closestIndex = -1;
        let minDistance = Infinity;
        
        allSlots.forEach((slot) => {
            const rect = (slot as HTMLElement).getBoundingClientRect();
            const slotId = slot.getAttribute('data-testid');
            
            // Извлекаем тип и индекс из id
            let slotType: 'day' | 'night' = 'day';
            let slotIndex = -1;
            
            if (slotId) {
                const parts = slotId.split('-');
                if (parts.length === 3) {
                    slotType = parts[1] as 'day' | 'night';
                    slotIndex = parseInt(parts[2], 10);
                }
            }
            
            // Пропускаем слоты с некорректным индексом
            if (slotIndex < 0) {
                return;
            }
            
            // Вычисляем расстояние до центра слота
            const centerX = (rect.left + rect.right) / 2;
            const centerY = (rect.top + rect.bottom) / 2;
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            
            // Проверяем прямое попадание в слот (высший приоритет)
            const isDirectHit = 
                x >= rect.left && x <= rect.right && 
                y >= rect.top && y <= rect.bottom;
            
            // Если это прямое попадание - присваиваем очень маленькое расстояние для приоритета
            const effectiveDistance = isDirectHit ? 0.1 : distance;
            
            // Используем эффективное расстояние для определения ближайшего слота
            if (effectiveDistance < minDistance) {
                minDistance = effectiveDistance;
                closestSlot = slot;
                closestType = slotType;
                closestIndex = slotIndex;
            }
        });
        
        // Проверяем, находится ли слот в пределах допустимого расстояния
        const isWithinMagneticRange = minDistance <= maxDistance;
        
        // Очищаем все подсветки
        const highlightElements = document.querySelectorAll('.slot-highlight.active, .magnetic-target');
        highlightElements.forEach(el => {
            (el as HTMLElement).classList.remove('active');
            (el as HTMLElement).classList.remove('magnetic-target');
        });
        
        // Если нашли ближайший слот в пределах магнитного расстояния
        if (closestSlot && isWithinMagneticRange) {
            (closestSlot as HTMLElement).classList.add('magnetic-target');
        }
        
        return { 
            slot: closestSlot, 
            type: closestType, 
            index: closestIndex, 
            distance: minDistance,
            isWithinMagneticRange
        };
    }, []);

    // Создаем рефы для функций, чтобы разорвать циклические зависимости
    const handleMouseMoveGlobalRef = useRef<(e: MouseEvent) => void>();
    const handleTouchMoveGlobalRef = useRef<(e: TouchEvent) => void>();
    
    // Функция для плавного обновления позиции призрака перетаскивания
    const updateGhostPosition = useCallback((x: number, y: number) => {
        // Обновляем текущую позицию
        setCurrentPosition({ x, y });
        
        // Получаем актуальные значения элемента и призрака из рефов
        const ghost = dragGhostRef.current;
        const element = dragElementRef.current;
        
        if (ghost && element) {
            // Используем RequestAnimationFrame для плавной анимации
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            
            animationFrameRef.current = requestAnimationFrame(() => {
                // Вычисляем смещение относительно начальной позиции
                const deltaX = x - startPositionRef.current.x;
                const deltaY = y - startPositionRef.current.y;
                
                // Обновляем позицию призрака
                ghost.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
                
                // Находим ближайший целевой слот
                findClosestDropTarget(x, y);
                
                animationFrameRef.current = null;
            });
        }
    }, [findClosestDropTarget]);
    
    // Глобальные обработчики движения для плавного обновления позиции
    const handleMouseMoveGlobal = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        
        // Предотвращаем стандартное поведение
        e.preventDefault();
        e.stopPropagation();
        
        // Обновляем позицию призрака перетаскивания
        updateGhostPosition(e.clientX, e.clientY);
    }, [updateGhostPosition]);
    
    const handleTouchMoveGlobal = useCallback((e: TouchEvent) => {
        if (!isDraggingRef.current) return;
        
        // Предотвращаем прокрутку и зум страницы
        e.preventDefault();
        
        // Получаем координаты текущего касания
        const touch = e.touches[0];
        
        // Обновляем позицию призрака перетаскивания
        updateGhostPosition(touch.clientX, touch.clientY);
    }, [updateGhostPosition]);

    // Сохраняем функции в рефы
    useEffect(() => {
        handleMouseMoveGlobalRef.current = handleMouseMoveGlobal;
        handleTouchMoveGlobalRef.current = handleTouchMoveGlobal;
    }, [handleMouseMoveGlobal, handleTouchMoveGlobal]);
    
    // Функция для очистки состояния перетаскивания
    const cleanupDragState = useCallback(() => {
        console.log('[useDragAndDrop] cleanupDragState: Cleaning up drag state');
        
        // Удаляем "призрак" перетаскивания, если он есть
        if (dragGhostRef.current && dragGhostRef.current.parentNode) {
            dragGhostRef.current.parentNode.removeChild(dragGhostRef.current);
        }
        
        // Удаляем все обработчики событий, которые были добавлены
        document.removeEventListener('mousemove', handleMouseMoveGlobalRef.current as EventListener);
        document.removeEventListener('touchmove', handleTouchMoveGlobalRef.current as EventListener);
        
        // Очищаем визуальные эффекты
        document.querySelectorAll('.drop-target, .drop-active, .magnetic-target, .source-drag-slot').forEach(el => {
            (el as HTMLElement).classList.remove('drop-target');
            (el as HTMLElement).classList.remove('drop-active');
            (el as HTMLElement).classList.remove('magnetic-target');
            (el as HTMLElement).classList.remove('source-drag-slot');
        });
        
        // Сбрасываем состояние перетаскивания
        setIsDragging(false);
        isDraggingRef.current = false;
        
        setDragElement(null);
        dragElementRef.current = null;
        
        setDragGhost(null);
        dragGhostRef.current = null;
        
        setDragCourier(null);
        setDragSourceType(null);
        setDragSourceIndex(null);
        
        // Отменяем все ожидающие анимационные фреймы
        if (animationFrameRef.current) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);
    
    // Создаем ref для хранения ID запроса анимации
    const animationFrameRef = useRef<number | null>(null);
    
    // Функция для окончания перетаскивания
    const handleDragEnd = useCallback((x: number, y: number, onSlotSelect: Function) => {
        if (!isDraggingRef.current) return;
        
        // Ищем ближайший целевой слот для завершения операции
        const dropTarget = findClosestDropTarget(x, y, 150);
        const validDropTarget = dropTarget?.slot && dropTarget.isWithinMagneticRange;
        
        if (validDropTarget && dropTarget.slot && dragCourier && dragCourier.id) {
            // Получаем данные о текущем предмете и исходной позиции
            const sourceType = dragSourceType || 'day';
            const sourceIndex = dragSourceIndex !== null ? dragSourceIndex : 0;
            const targetType = dropTarget.type;
            const targetIndex = dropTarget.index;
            
            // Получаем координаты целевого слота
            const targetRect = (dropTarget.slot as HTMLElement).getBoundingClientRect();
            const targetCenterX = targetRect.left + targetRect.width / 2;
            const targetCenterY = targetRect.top + targetRect.height / 2;
            
            // Подсвечиваем целевой слот
            (dropTarget.slot as HTMLElement).classList.add('drop-active');
            
            // Находим исходный слот для создания анимации перемещения
            const sourceSlot = document.querySelector(`[data-testid="slot-${sourceType}-${sourceIndex}"]`);
            if (sourceSlot && dragElementRef.current) {
                // Создаем "летящий" аватар для анимации перемещения
                const flyingAvatar = document.createElement('div');
                flyingAvatar.className = 'flying-avatar';
                flyingAvatar.style.position = 'fixed';
                flyingAvatar.style.zIndex = '9999';
                flyingAvatar.style.pointerEvents = 'none';
                
                // Копируем стили и содержимое из призрака перетаскивания
                if (dragElementRef.current) {
                    const ghostRect = dragElementRef.current.getBoundingClientRect();
                    
                    // Устанавливаем начальную позицию и размеры
                    flyingAvatar.style.width = `${ghostRect.width}px`;
                    flyingAvatar.style.height = `${ghostRect.height}px`;
                    flyingAvatar.style.top = `${ghostRect.top}px`;
                    flyingAvatar.style.left = `${ghostRect.left}px`;
                    flyingAvatar.style.borderRadius = '50%';
                    flyingAvatar.style.overflow = 'visible';
                    
                    // Копируем содержимое из призрака (или используем базовые стили)
                    flyingAvatar.innerHTML = dragElementRef.current.innerHTML;
                    
                    // Добавляем специальные эффекты
                    flyingAvatar.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2)';
                    flyingAvatar.style.transform = 'scale(1)';
                    
                    // Добавляем в DOM
                    document.body.appendChild(flyingAvatar);
                    
                    // Сразу удаляем призрак перетаскивания, чтобы он не мешал
                    if (dragElementRef.current.parentNode) {
                        dragElementRef.current.style.opacity = '0';
                    }
                    
                    // Запускаем анимацию перемещения к целевому слоту
                    setTimeout(() => {
                        flyingAvatar.style.transform = 'scale(0.8)';
                        flyingAvatar.style.top = `${targetCenterY - ghostRect.height / 2}px`;
                        flyingAvatar.style.left = `${targetCenterX - ghostRect.width / 2}px`;
                        
                        // После завершения анимации удаляем летящий аватар
                        setTimeout(() => {
                            flyingAvatar.style.opacity = '0';
                            setTimeout(() => {
                                if (flyingAvatar.parentNode) {
                                    flyingAvatar.parentNode.removeChild(flyingAvatar);
                                }
                                
                                // Отправляем событие успешного переноса ПОСЛЕ завершения анимации
                                // Это предотвратит мгновенное появление аватара в целевом слоте
                                const dragEndEvent = new CustomEvent('dragOperationComplete', {
                                    detail: {
                                        success: true,
                                        sourceType: dragSourceType,
                                        sourceIndex: dragSourceIndex,
                                        targetType: targetType,
                                        targetIndex: targetIndex,
                                        item: dragCourier,
                                        animated: true // Флаг, что анимация уже выполнена
                                    }
                                });
                                document.dispatchEvent(dragEndEvent);
                                
                            }, 300);
                        }, 300);
                    }, 10);
                }
            }
            
            // Вызываем API через props.onSlotSelect
            onSlotSelect(targetType, targetIndex, dragCourier.id, true);
        }
        
        cleanupDragState();
    }, [dragCourier, dragSourceType, dragSourceIndex, findClosestDropTarget, cleanupDragState]);

    // Обработчик окончания перетаскивания мышью
    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        
        console.log('[useDragAndDrop] handleMouseUp: End drag operation');
        
        e.preventDefault();
        e.stopPropagation();
        
        // Вызываем обобщенную функцию окончания перетаскивания
        handleDragEnd(e.clientX, e.clientY, handleSlotSelectCallback.current);
    }, [handleDragEnd]);

    // Обработчик окончания касания
    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!isDraggingRef.current) return;
        
        console.log('[useDragAndDrop] handleTouchEnd: End touch drag operation');
        
        e.preventDefault();
        
        // Используем координаты последнего известного касания
        let endX = currentPosition.x;
        let endY = currentPosition.y;
        
        // Если есть данные о последнем касании, используем их
        if (e.changedTouches && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            endX = touch.clientX;
            endY = touch.clientY;
        }
        
        // Вызываем функцию окончания перетаскивания
        handleDragEnd(endX, endY, handleSlotSelectCallback.current);
    }, [currentPosition, handleDragEnd]);

    // Хранит ссылку на функцию обработки выбора слота
    const handleSlotSelectCallback = useRef<Function>(() => {});

    // Функция для начала операции перетаскивания
    const startDragOperation = useCallback((element: HTMLElement, courier: any, sourceType: 'day' | 'night', sourceIndex: number, startX: number, startY: number, onSlotSelect: Function) => {
        console.log('[useDragAndDrop] startDragOperation', {
            element,
            courier,
            sourceType,
            sourceIndex,
            startX,
            startY
        });
        
        // Сохраняем функцию обработки выбора слота
        handleSlotSelectCallback.current = onSlotSelect;
        
        // Устанавливаем переменные для отслеживания перетаскивания
        setIsDragging(true);
        isDraggingRef.current = true;
        
        setDragElement(element);
        dragElementRef.current = element;
        
        setDragCourier(courier);
        setDragSourceType(sourceType);
        setDragSourceIndex(sourceIndex);
        
        // Запоминаем начальную позицию
        setStartPosition({ x: startX, y: startY });
        startPositionRef.current = { x: startX, y: startY };
        
        // Устанавливаем текущую позицию равной начальной
        setCurrentPosition({ x: startX, y: startY });
        
        // Создаем "призрак" перетаскивания
        // Получаем реальные размеры элемента
        const rect = element.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Создаем элемент призрака
        const ghostElement = document.createElement('div');
        ghostElement.style.position = 'fixed';
        ghostElement.style.width = `${width}px`;
        ghostElement.style.height = `${height}px`;
        ghostElement.style.top = `${startY - height / 2}px`;
        ghostElement.style.left = `${startX - width / 2}px`;
        ghostElement.style.pointerEvents = 'none';
        ghostElement.style.opacity = '0.8';
        ghostElement.style.zIndex = '9999';
        ghostElement.style.transform = 'translate3d(0, 0, 0)';
        ghostElement.style.willChange = 'transform';
        ghostElement.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        ghostElement.style.borderRadius = '50%';
        ghostElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
        ghostElement.id = 'drag-ghost';
        
        // Сначала пытаемся найти и клонировать исходное изображение
        const originalImage = element.querySelector('img');
        if (originalImage) {
            // Если нашли оригинальное изображение, клонируем его
            const clonedImage = originalImage.cloneNode(true) as HTMLImageElement;
            clonedImage.style.width = '100%';
            clonedImage.style.height = '100%';
            clonedImage.style.borderRadius = '50%';
            clonedImage.style.objectFit = 'cover';
            clonedImage.style.display = 'block';
            ghostElement.appendChild(clonedImage);
        } else {
            // Если не нашли оригинальное изображение, создаем новое
            const image = document.createElement('img');
            
            // Пытаемся получить абсолютный путь к изображению
            if (courier.photo_url) {
                // Проверяем, является ли путь относительным
                if (courier.photo_url.startsWith('/') && !courier.photo_url.startsWith('//')) {
                    // Превращаем относительный путь в абсолютный
                    const baseUrl = window.location.origin;
                    image.src = `${baseUrl}${courier.photo_url}`;
                } else {
                    image.src = courier.photo_url;
                }
            } else {
                // Используем дефолтный аватар, если нет ссылки
                image.src = 'default-avatar.jpg';
            }
            
            image.style.width = '100%';
            image.style.height = '100%';
            image.style.borderRadius = '50%';
            image.style.objectFit = 'cover';
            image.style.display = 'block';
            
            // Добавляем обработчик ошибок загрузки
            image.onerror = function() {
                console.log('[useDragAndDrop] Error loading image, using default avatar');
                this.src = 'default-avatar.jpg';
                // Повторно пытаемся загрузить дефолтный аватар
                this.onerror = function() {
                    console.error('[useDragAndDrop] Failed to load default avatar');
                    // Создаем цветной фон с инициалами пользователя
                    const initials = courier.firstName && courier.lastName 
                        ? `${courier.firstName[0]}${courier.lastName[0]}` 
                        : courier.userId?.substring(0, 2) || 'U';
                    
                    // Удаляем изображение
                    if (this.parentNode) {
                        this.parentNode.removeChild(this);
                    }
                    
                    // Создаем текстовый элемент с инициалами
                    const initialsElement = document.createElement('div');
                    initialsElement.style.width = '100%';
                    initialsElement.style.height = '100%';
                    initialsElement.style.borderRadius = '50%';
                    initialsElement.style.backgroundColor = '#4CAF50';
                    initialsElement.style.color = 'white';
                    initialsElement.style.display = 'flex';
                    initialsElement.style.alignItems = 'center';
                    initialsElement.style.justifyContent = 'center';
                    initialsElement.style.fontSize = '24px';
                    initialsElement.style.fontWeight = 'bold';
                    initialsElement.textContent = initials;
                    
                    ghostElement.appendChild(initialsElement);
                };
            };
            
            ghostElement.appendChild(image);
        }
        
        // Добавляем призрак на страницу
        document.body.appendChild(ghostElement);
        
        // Сохраняем ссылку на призрак
        setDragGhost(ghostElement);
        dragGhostRef.current = ghostElement;
        
        // Находим слот, из которого происходит перетаскивание, и отмечаем его
        const sourceSlot = document.querySelector(`[data-testid="slot-${sourceType}-${sourceIndex}"]`);
        if (sourceSlot) {
            console.log('[useDragAndDrop] Found source slot, marking as source-drag-slot');
            (sourceSlot as HTMLElement).classList.add('source-drag-slot');
        } else {
            console.warn('[useDragAndDrop] Source slot not found', { sourceType, sourceIndex });
        }
        
        // Находим все пустые слоты и помечаем их как потенциальные цели для перетаскивания
        const emptySlots = document.querySelectorAll('.slot-button:not(.occupied)');
        console.log('[useDragAndDrop] Found empty slots:', emptySlots.length);
        emptySlots.forEach(slot => {
            (slot as HTMLElement).classList.add('drop-target');
        });
        
        // Создаем и отправляем событие начала перетаскивания
        const dragStartEvent = new CustomEvent('customDragStart', {
            detail: {
                sourceType,
                sourceIndex,
                item: courier,
                position: { x: startX, y: startY },
                operationId: `drag-${Date.now()}-${courier.userId || 'unknown'}`,
                isDragOperation: true,
                timestamp: Date.now()
            },
            bubbles: true
        });
        document.dispatchEvent(dragStartEvent);
        
        console.log('[useDragAndDrop] Adding event listeners for drag tracking');
        
        // Добавляем глобальные обработчики для плавного отслеживания
        document.addEventListener('mousemove', handleMouseMoveGlobal);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMoveGlobal as EventListener, { passive: false } as AddEventListenerOptions);
        document.addEventListener('touchend', handleTouchEnd as EventListener);
        
        // Для начального плавного перехода - устанавливаем анимацию через небольшую задержку
        setTimeout(() => {
            if (ghostElement) {
                ghostElement.style.transition = 'transform 0.1s ease-out';
            }
        }, 10);
        
    }, [handleMouseMoveGlobal, handleTouchMoveGlobal, handleMouseUp, handleTouchEnd]);

    // Обработчик начала перетаскивания для мыши
    const initDragWithMouse = useCallback((e: React.MouseEvent, courier: any, sourceType: 'day' | 'night', sourceIndex: number, onSlotSelect: Function) => {
        console.log('[useDragAndDrop] initDragWithMouse called', { courier, sourceType, sourceIndex });
        
        // Проверяем, что нажата левая кнопка мыши
        if (e.button !== 0) return;
        
        // Предотвращаем стандартное поведение браузера
        e.preventDefault();
        e.stopPropagation();
        
        // Получаем элемент, который будем перетаскивать
        const target = e.currentTarget as HTMLElement;
        if (!target) {
            console.error('[useDragAndDrop] No target element found');
            return;
        }
        
        console.log('[useDragAndDrop] Starting drag operation');
        
        // Запускаем операцию перетаскивания
        startDragOperation(target, courier, sourceType, sourceIndex, e.clientX, e.clientY, onSlotSelect);
    }, [startDragOperation]);

    // Обработчик начала перетаскивания для сенсорных экранов
    const initDragWithTouch = useCallback((e: React.TouchEvent, courier: any, sourceType: 'day' | 'night', sourceIndex: number, onSlotSelect: Function) => {
        console.log('[useDragAndDrop] initDragWithTouch called', { courier, sourceType, sourceIndex });
        
        // Предотвращаем скролл и другие действия браузера
        e.preventDefault();
        
        // Получаем координаты первого касания
        const touch = e.touches[0];
        if (!touch) {
            console.error('[useDragAndDrop] No touch detected');
            return;
        }
        
        // Получаем элемент, который будем перетаскивать
        const target = e.currentTarget as HTMLElement;
        if (!target) {
            console.error('[useDragAndDrop] No target element found');
            return;
        }
        
        console.log('[useDragAndDrop] Starting touch drag operation');
        
        // Запускаем операцию перетаскивания
        startDragOperation(target, courier, sourceType, sourceIndex, touch.clientX, touch.clientY, onSlotSelect);
    }, [startDragOperation]);

    // При размонтировании компонента, очищаем состояние перетаскивания
    useEffect(() => {
        return () => {
            cleanupDragState();
        };
    }, [cleanupDragState]);

    return {
        isDragging,
        dragElement,
        dragCourier,
        dragSourceType,
        dragSourceIndex,
        startPosition,
        currentPosition,
        initDragWithMouse,
        initDragWithTouch,
        handleDragEnd,
        cleanupDragState
    };
};

const ShiftPanelContainer: React.FC<ShiftPanelContainerProps> = ({
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
    chatId,
    isLoading,
    loadingSlot,
    loadingType
}) => {
    // const dispatch = useDispatch<AppDispatch>(); // Закомментируем неиспользуемую переменную
    const currentUser = useSelector((state: RootState) => state.user.user);
    const isCurrentUserSenior = currentUser?.is_senior_courier || false;
    
    // Инициализируем хук для UI-состояния
    const uiState = useShiftUIState({
        dayShifts,
        nightShifts
    });
    
    // Используем useWebSocket вместо useShiftWebSockets
    const { joinShiftsRoom } = useWebSocket(chatId);
    
    // Подключаемся к комнате смен при монтировании
    useEffect(() => {
        if (chatId) {
            joinShiftsRoom(chatId);
        }
    }, [chatId, joinShiftsRoom]);
    
    // Используем хук для управления drag-and-drop
    const dragAndDrop = useDragAndDrop();
    
    // Проверяем, имеет ли текущий пользователь смену на выбранную дату
    const userHasShift = [...uiState.localDayShifts, ...uiState.localNightShifts]
        .some(shift => shift.userId === currentUserId);
    
    // Проверяем, все ли слоты заняты
    const totalSlots = maxDaySlots + maxNightSlots;
    const totalOccupiedSlots = uiState.localDayShifts.length + uiState.localNightShifts.length;
    const isFullyBooked = totalOccupiedSlots >= totalSlots;
    
    // Обработчик клика по слоту
    const handleSlotSelect = useCallback((shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction = false) => {
        console.log('[ShiftPanel] handleSlotSelect called with params:', { shiftType, slotIndex, existingShiftId, isDragAction, currentUserIsSenior: isCurrentUserSenior });
        
        // Если это перетаскивание и пользователь не старший курьер - ничего не делаем
        if (isDragAction && !isCurrentUserSenior) {
            console.log('[ShiftPanel] Ignoring drag action for non-senior courier');
            return;
        }
        
        // Если старший курьер и это не перетаскивание, просто открываем окно подтверждения
        if (isCurrentUserSenior && !isDragAction) {
            console.log('[ShiftPanel] Senior courier clicked slot, showing confirmation');
            uiState.openConfirmation(shiftType, slotIndex, existingShiftId);
            return;
        }
        
        // Проверяем, не находится ли пользователь в резерве
        const userInReserve = reserves.some(reserve => reserve.userId === currentUserId);
        
        // Если пользователь в резерве, смена будет управляться через shiftsSlice
        if (userInReserve) {
            console.log('[ShiftPanel] User is in reserve, this will be handled by shiftsSlice');
            // Напрямую вызываем обработчик, shiftsSlice позаботится о переходе из резерва
            onSlotSelect(shiftType, slotIndex, existingShiftId, isDragAction);
            return;
        }
        
        // В остальных случаях показываем подтверждение
        uiState.openConfirmation(shiftType, slotIndex, existingShiftId);
    }, [isCurrentUserSenior, currentUserId, reserves, uiState, onSlotSelect]);
    
    // Обработчик подтверждения выбора смены
    const handleConfirmShift = useCallback(async () => {
        if (!uiState.pendingShift) return;
        
        try {
            console.log('[ShiftPanel] Confirming shift selection:', uiState.pendingShift);
            
            // Показываем анимацию успешного действия для слота
            uiState.showSuccessAnimation(
                uiState.pendingShift.shiftType, 
                uiState.pendingShift.slotIndex
            );
            
            // Вызываем обработчик выбора слота
            await onSlotSelect(
                uiState.pendingShift.shiftType,
                uiState.pendingShift.slotIndex,
                uiState.pendingShift.existingShiftId
            );
            
            // Не закрываем окно подтверждения сразу, а показываем сообщение об успехе
            // Закрытие произойдет только после нажатия кнопки OK в SuccessOverlay
            
            console.log('[ShiftPanel] Slot selection successful');
            
        } catch (error) {
            console.error('[ShiftPanel] Error in handleConfirmShift:', error);
            
            // В случае ошибки закрываем окно подтверждения
            uiState.closeConfirmation();
        }
    }, [uiState, onSlotSelect]);
    
    // Добавляем эффект для обработки окончания перетаскивания
    useEffect(() => {
        // Функция для обработки отпускания элемента
        const handleGlobalMouseUp = (e: MouseEvent) => {
            console.log('[ShiftPanel] Global mouse up detected');
            
            if (dragAndDrop.isDragging) {
                // Пытаемся получить элемент под курсором
                const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
                const slotElement = elementsAtPoint.find(el => 
                    el.classList.contains('slot-button') || 
                    (el.hasAttribute('data-testid') && 
                    (el.getAttribute('data-testid') || '').startsWith('slot-'))
                );
                
                if (slotElement) {
                    const testId = slotElement.getAttribute('data-testid') || '';
                    const parts = testId.split('-');
                    
                    if (parts.length === 3) {
                        const slotType = parts[1] as 'day' | 'night';
                        const slotIndex = parseInt(parts[2], 10);
                        
                        console.log('[ShiftPanel] Found slot under cursor', { slotType, slotIndex });
                        
                        // Особая обработка для пустого слота
                        if (!slotElement.classList.contains('occupied')) {
                            // Используем настоящую функцию onSlotSelect из пропсов
                            // и передаем id из dragAndDrop.dragCourier.id если он существует
                            if (dragAndDrop.dragCourier) {
                                console.log('[ShiftPanel] Calling onSlotSelect from global handler', { 
                                    type: slotType, 
                                    index: slotIndex, 
                                    id: dragAndDrop.dragCourier.id || '', 
                                    isDrag: true 
                                });
                                
                                // Создаем плавную анимацию перемещения аватара от источника к цели
                                const sourceType = dragAndDrop.dragSourceType || 'day';
                                const sourceIndex = dragAndDrop.dragSourceIndex !== null ? dragAndDrop.dragSourceIndex : 0;
                                
                                // Получаем координаты целевого слота
                                const targetRect = slotElement.getBoundingClientRect();
                                const targetCenterX = targetRect.left + targetRect.width / 2;
                                const targetCenterY = targetRect.top + targetRect.height / 2;
                                
                                // Подсвечиваем целевой слот
                                slotElement.classList.add('drop-active');
                                
                                // Находим исходный слот для создания анимации перемещения
                                const sourceSlot = document.querySelector(`[data-testid="slot-${sourceType}-${sourceIndex}"]`);
                                if (sourceSlot && dragAndDrop.dragElement) {
                                    // Создаем "летящий" аватар для анимации перемещения
                                    const flyingAvatar = document.createElement('div');
                                    flyingAvatar.className = 'flying-avatar';
                                    flyingAvatar.style.position = 'fixed';
                                    flyingAvatar.style.zIndex = '9999';
                                    flyingAvatar.style.pointerEvents = 'none';
                                    
                                    // Копируем стили и содержимое из призрака перетаскивания
                                    if (dragAndDrop.dragElement) {
                                        const ghostRect = dragAndDrop.dragElement.getBoundingClientRect();
                                        
                                        // Устанавливаем начальную позицию и размеры
                                        flyingAvatar.style.width = `${ghostRect.width}px`;
                                        flyingAvatar.style.height = `${ghostRect.height}px`;
                                        flyingAvatar.style.top = `${ghostRect.top}px`;
                                        flyingAvatar.style.left = `${ghostRect.left}px`;
                                        flyingAvatar.style.borderRadius = '50%';
                                        flyingAvatar.style.overflow = 'visible';
                                        
                                        // Копируем содержимое из призрака (или используем базовые стили)
                                        flyingAvatar.innerHTML = dragAndDrop.dragElement.innerHTML;
                                        
                                        // Добавляем специальные эффекты
                                        flyingAvatar.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2)';
                                        flyingAvatar.style.transform = 'scale(1)';
                                        
                                        // Добавляем в DOM
                                        document.body.appendChild(flyingAvatar);
                                        
                                        // Сразу удаляем призрак перетаскивания, чтобы он не мешал
                                        if (dragAndDrop.dragElement.parentNode) {
                                            dragAndDrop.dragElement.style.opacity = '0';
                                        }
                                        
                                        // Запускаем анимацию перемещения к целевому слоту
                                        setTimeout(() => {
                                            flyingAvatar.style.transform = 'scale(0.8)';
                                            flyingAvatar.style.top = `${targetCenterY - ghostRect.height / 2}px`;
                                            flyingAvatar.style.left = `${targetCenterX - ghostRect.width / 2}px`;
                                            
                                            // После завершения анимации удаляем летящий аватар
                                            setTimeout(() => {
                                                flyingAvatar.style.opacity = '0';
                                                setTimeout(() => {
                                                    if (flyingAvatar.parentNode) {
                                                        flyingAvatar.parentNode.removeChild(flyingAvatar);
                                                    }
                                                    
                                                    // Отправляем событие успешного переноса ПОСЛЕ завершения анимации
                                                    // Это предотвратит мгновенное появление аватара в целевом слоте
                                                    const dragEndEvent = new CustomEvent('dragOperationComplete', {
                                                        detail: {
                                                            success: true,
                                                            sourceType: dragAndDrop.dragSourceType,
                                                            sourceIndex: dragAndDrop.dragSourceIndex,
                                                            targetType: slotType,
                                                            targetIndex: slotIndex,
                                                            item: dragAndDrop.dragCourier,
                                                            animated: true // Флаг, что анимация уже выполнена
                                                        }
                                                    });
                                                    document.dispatchEvent(dragEndEvent);
                                                    
                                                }, 300);
                                            }, 300);
                                        }, 10);
                                    }
                                }
                                
                                // Вызываем API через props.onSlotSelect
                                onSlotSelect(slotType, slotIndex, dragAndDrop.dragCourier.id, true);
                            }
                        }
                    }
                }
            }
            
            dragAndDrop.cleanupDragState();
        };
        
        const handleGlobalTouchEnd = (e: TouchEvent) => {
            console.log('[ShiftPanel] Global touch end detected');
            
            if (dragAndDrop.isDragging && e.changedTouches && e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                
                // Пытаемся получить элемент под пальцем
                const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
                const slotElement = elementsAtPoint.find(el => 
                    el.classList.contains('slot-button') || 
                    (el.hasAttribute('data-testid') && 
                    (el.getAttribute('data-testid') || '').startsWith('slot-'))
                );
                
                if (slotElement) {
                    const testId = slotElement.getAttribute('data-testid') || '';
                    const parts = testId.split('-');
                    
                    if (parts.length === 3) {
                        const slotType = parts[1] as 'day' | 'night';
                        const slotIndex = parseInt(parts[2], 10);
                        
                        console.log('[ShiftPanel] Found slot under finger', { slotType, slotIndex });
                        
                        // Особая обработка для пустого слота
                        if (!slotElement.classList.contains('occupied')) {
                            // Используем настоящую функцию onSlotSelect из пропсов
                            if (dragAndDrop.dragCourier) {
                                console.log('[ShiftPanel] Calling onSlotSelect from global handler', { 
                                    type: slotType, 
                                    index: slotIndex, 
                                    id: dragAndDrop.dragCourier.id || '', 
                                    isDrag: true 
                                });
                                
                                // Создаем плавную анимацию перемещения аватара от источника к цели
                                const sourceType = dragAndDrop.dragSourceType || 'day';
                                const sourceIndex = dragAndDrop.dragSourceIndex !== null ? dragAndDrop.dragSourceIndex : 0;
                                
                                // Получаем координаты целевого слота
                                const targetRect = slotElement.getBoundingClientRect();
                                const targetCenterX = targetRect.left + targetRect.width / 2;
                                const targetCenterY = targetRect.top + targetRect.height / 2;
                                
                                // Подсвечиваем целевой слот
                                slotElement.classList.add('drop-active');
                                
                                // Находим исходный слот для создания анимации перемещения
                                const sourceSlot = document.querySelector(`[data-testid="slot-${sourceType}-${sourceIndex}"]`);
                                if (sourceSlot && dragAndDrop.dragElement) {
                                    // Создаем "летящий" аватар для анимации перемещения
                                    const flyingAvatar = document.createElement('div');
                                    flyingAvatar.className = 'flying-avatar';
                                    flyingAvatar.style.position = 'fixed';
                                    flyingAvatar.style.zIndex = '9999';
                                    flyingAvatar.style.pointerEvents = 'none';
                                    
                                    // Копируем стили и содержимое из призрака перетаскивания
                                    if (dragAndDrop.dragElement) {
                                        const ghostRect = dragAndDrop.dragElement.getBoundingClientRect();
                                        
                                        // Устанавливаем начальную позицию и размеры
                                        flyingAvatar.style.width = `${ghostRect.width}px`;
                                        flyingAvatar.style.height = `${ghostRect.height}px`;
                                        flyingAvatar.style.top = `${ghostRect.top}px`;
                                        flyingAvatar.style.left = `${ghostRect.left}px`;
                                        flyingAvatar.style.borderRadius = '50%';
                                        flyingAvatar.style.overflow = 'visible';
                                        
                                        // Копируем содержимое из призрака (или используем базовые стили)
                                        flyingAvatar.innerHTML = dragAndDrop.dragElement.innerHTML;
                                        
                                        // Добавляем специальные эффекты
                                        flyingAvatar.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2)';
                                        flyingAvatar.style.transform = 'scale(1)';
                                        
                                        // Добавляем в DOM
                                        document.body.appendChild(flyingAvatar);
                                        
                                        // Сразу удаляем призрак перетаскивания, чтобы он не мешал
                                        if (dragAndDrop.dragElement.parentNode) {
                                            dragAndDrop.dragElement.style.opacity = '0';
                                        }
                                        
                                        // Запускаем анимацию перемещения к целевому слоту
                                        setTimeout(() => {
                                            flyingAvatar.style.transform = 'scale(0.8)';
                                            flyingAvatar.style.top = `${targetCenterY - ghostRect.height / 2}px`;
                                            flyingAvatar.style.left = `${targetCenterX - ghostRect.width / 2}px`;
                                            
                                            // После завершения анимации удаляем летящий аватар
                                            setTimeout(() => {
                                                flyingAvatar.style.opacity = '0';
                                                setTimeout(() => {
                                                    if (flyingAvatar.parentNode) {
                                                        flyingAvatar.parentNode.removeChild(flyingAvatar);
                                                    }
                                                    
                                                    // Отправляем событие успешного переноса ПОСЛЕ завершения анимации
                                                    // Это предотвратит мгновенное появление аватара в целевом слоте
                                                    const dragEndEvent = new CustomEvent('dragOperationComplete', {
                                                        detail: {
                                                            success: true,
                                                            sourceType: dragAndDrop.dragSourceType,
                                                            sourceIndex: dragAndDrop.dragSourceIndex,
                                                            targetType: slotType,
                                                            targetIndex: slotIndex,
                                                            item: dragAndDrop.dragCourier,
                                                            animated: true // Флаг, что анимация уже выполнена
                                                        }
                                                    });
                                                    document.dispatchEvent(dragEndEvent);
                                                    
                                                }, 300);
                                            }, 300);
                                        }, 10);
                                    }
                                }
                                
                                // Вызываем API через props.onSlotSelect
                                onSlotSelect(slotType, slotIndex, dragAndDrop.dragCourier.id, true);
                            }
                        }
                    }
                }
            }
            
            dragAndDrop.cleanupDragState();
        };
        
        // Добавляем глобальные обработчики событий
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('touchend', handleGlobalTouchEnd);
        
        // Очищаем обработчики при размонтировании
        return () => {
            document.removeEventListener('mouseup', handleGlobalMouseUp);
            document.removeEventListener('touchend', handleGlobalTouchEnd);
        };
    }, [dragAndDrop, onSlotSelect]);
    
    // Добавляем состояние для отслеживания касания
    const touchStartTimeRef = useRef<number>(0);
    const isTouchMoveRef = useRef<boolean>(false);

    // Изменяем обработчики для поддержки долгого нажатия
    const handleCourierClick = useCallback((
        event: React.MouseEvent | React.TouchEvent,
        courier: ShiftSlotLocal,
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        // Прекращаем всплытие события
        event.stopPropagation();

        // Если это touch событие
        if ('touches' in event) {
            // Если это touchstart, записываем время начала касания
            if (event.type === 'touchstart') {
                touchStartTimeRef.current = Date.now();
                isTouchMoveRef.current = false;
                return;
            }
            
            // Если это touchend, проверяем, было ли движение
            if (event.type === 'touchend') {
                // Если было движение, игнорируем клик
                if (isTouchMoveRef.current) {
                    return;
                }
                
                // Проверяем длительность касания
                const touchDuration = Date.now() - touchStartTimeRef.current;
                
                // Если касание длилось более 500мс и пользователь старший курьер,
                // начинаем перетаскивание
                if (touchDuration > 500 && isCurrentUserSenior) {
                    dragAndDrop.initDragWithTouch(event, courier, shiftType, slotIndex, onSlotSelect);
                    return;
                }
            }
        }

        // Для старших курьеров и событий мыши
        if (isCurrentUserSenior && 'button' in event) {
            dragAndDrop.initDragWithMouse(event, courier, shiftType, slotIndex, onSlotSelect);
            return;
        }

        // Для обычных пользователей или если это его собственный аватар
        if (courier.userId === currentUserId || !isCurrentUserSenior) {
            uiState.openProfileDialog(courier);
        }
    }, [currentUserId, isCurrentUserSenior, uiState, onSlotSelect, dragAndDrop]);

    // Добавляем обработчик touchmove
    const handleTouchMove = useCallback(() => {
        isTouchMoveRef.current = true;
    }, []);

    // Изменяем функцию renderSlots для поддержки долгого нажатия
    const renderSlots = useCallback((shiftType: 'day' | 'night', slots: number) => {
        console.log('[ShiftPanel] renderSlots called:', { shiftType, slots, isCurrentUserSenior });
        
        const shiftsArray = shiftType === 'day' ? uiState.localDayShifts : uiState.localNightShifts;
        
        // Создаем массив индексов слотов
        const slotsArray = Array.from({ length: slots }, (_, i) => i);
        
        return slotsArray.map(index => {
            // Находим курьера для этого слота, если есть
            const courier = shiftsArray.find(shift => 
                Number(shift.slotIndex) === index && shift.shiftType === shiftType
            );
            
            // Создаем ключ для анимации успеха
            const animationKey = `${shiftType}-${index}`;
            const showSuccessAnim = uiState.successAnimations.has(animationKey);
            
            // Определяем, активна ли анимация долгого нажатия для этого слота
            const showPressAnim = 
                dragAndDrop.isDragging && 
                dragAndDrop.dragElement && 
                dragAndDrop.dragElement.getAttribute('data-testid') === `slot-${shiftType}-${index}`;
            
            // Определяем, можно ли перетаскивать этот слот (только старшие курьеры)
            const draggable = Boolean(courier && isCurrentUserSenior);
            
            // Если слот занят и можно перетаскивать, используем Draggable
            if (courier && draggable) {
                const draggableId = `${shiftType}-${index}`;
                console.log('[ShiftPanel] Rendering Draggable:', { shiftType, index, draggableId });
                
                return (
                    <Draggable 
                        key={draggableId}
                        draggableId={draggableId}
                        index={index}
                    >
                        {(provided) => {
                            // Получаем isDragging из provided.draggableProps['data-rbd-draggable-context-id']
                            // Или просто false, если нельзя определить
                            const isDraggingThis = false;
                            
                            return (
                                <div 
                                    key={`${shiftType}-${index}-container`} 
                                    style={{ position: 'relative' }}
                                    onTouchStart={(e) => courier && handleCourierClick(e, courier, shiftType, index)}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={(e) => courier && handleCourierClick(e, courier, shiftType, index)}
                                    onClick={(e) => courier && handleCourierClick(e, courier, shiftType, index)}
                                >
                                    <ShiftSlot
                                        shiftType={shiftType}
                                        slotIndex={index}
                                        courier={courier}
                                        currentUserId={currentUserId}
                                        isDraggable={draggable}
                                        onSlotClick={handleSlotSelect}
                                        onCourierClick={handleCourierClick}
                                        successAnimation={showSuccessAnim}
                                        pressAnimationActive={showPressAnim || false}
                                        isDragging={isDraggingThis}
                                        draggableProvided={provided}
                                    />
                                    {!courier && <SlotHighlight className="slot-highlight" />}
                                </div>
                            );
                        }}
                    </Draggable>
                );
            }
            
            // Для обычных слотов просто используем ShiftSlot
            return (
                <div key={`${shiftType}-${index}-container`} style={{ position: 'relative' }}>
                    <ShiftSlot
                        key={`${shiftType}-${index}`}
                        shiftType={shiftType}
                        slotIndex={index}
                        courier={courier}
                        currentUserId={currentUserId}
                        isDraggable={false}
                        onSlotClick={handleSlotSelect}
                        onCourierClick={handleCourierClick}
                        successAnimation={showSuccessAnim}
                        pressAnimationActive={showPressAnim || false}
                        isDragging={false}
                    />
                    {!courier && <SlotHighlight className="slot-highlight" />}
                </div>
            );
        });
    }, [
        uiState.localDayShifts,
        uiState.localNightShifts,
        uiState.successAnimations,
        dragAndDrop.isDragging,
        dragAndDrop.dragElement,
        currentUserId,
        isCurrentUserSenior,
        handleSlotSelect,
        handleCourierClick,
        handleTouchMove
    ]);
    
    // Добавляем функцию для проверки возможности перетаскивания в целевой слот
    const canDropToSlot = useCallback((targetType: 'day' | 'night', targetIndex: number, sourceType: 'day' | 'night'): boolean => {
        // Запрещаем перетаскивание в тот же тип смены
        if (targetType === sourceType) {
            console.log('[ShiftPanel] Dropping to the same shift type is forbidden');
            return false;
        }
        
        // Проверяем, занят ли целевой слот
        const isTargetOccupied = targetType === 'day'
            ? uiState.localDayShifts.some(shift => shift.slotIndex === targetIndex)
            : uiState.localNightShifts.some(shift => shift.slotIndex === targetIndex);
        
        if (isTargetOccupied) {
            console.log('[ShiftPanel] Target slot is already occupied');
            return false;
        }
        
        return true;
    }, [uiState.localDayShifts, uiState.localNightShifts]);

    // Обновляем обработчик движения мыши для визуальных эффектов при наведении на разные типы слотов
    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (!dragAndDrop.isDragging || !dragAndDrop.dragElement || !dragAndDrop.dragCourier) return;

        const { clientX, clientY } = e;
        const offsetX = dragAndDrop.startPosition.x;
        const offsetY = dragAndDrop.startPosition.y;
        
        // Перемещаем элемент с аватаром за курсором
        const translateX = clientX - offsetX;
        const translateY = clientY - offsetY;
        dragAndDrop.dragElement.style.transform = `translate(${translateX}px, ${translateY}px)`;
        
        // Очищаем все активные и запрещенные метки со слотов
        document.querySelectorAll('.drop-active, .drop-forbidden, .magnetic-target').forEach(el => {
            el.classList.remove('drop-active');
            el.classList.remove('drop-forbidden');
            el.classList.remove('magnetic-target');
            el.classList.remove('slot-occupied');
            (el as HTMLElement).removeAttribute('title');
        });
        
        // Находим элементы под курсором
        const elementsUnderPointer = document.elementsFromPoint(clientX, clientY);
        
        // Находим слот под курсором
        const slotElement = elementsUnderPointer.find(el => 
            el.classList.contains('slot-button') || 
            (el.hasAttribute('data-testid') && 
            (el.getAttribute('data-testid') || '').startsWith('slot-'))
        );
        
        if (slotElement) {
            const typeAttr = slotElement.getAttribute('data-type');
            if (!typeAttr || (typeAttr !== 'day' && typeAttr !== 'night')) return;
            
            const type = typeAttr as 'day' | 'night';
            const index = parseInt(slotElement.getAttribute('data-index') || '-1', 10);
            
            if (dragAndDrop.dragSourceType && index >= 0) {
                // Проверяем возможность перетаскивания в этот слот
                const canDrop = canDropToSlot(type, index, dragAndDrop.dragSourceType);
                
                if (canDrop) {
                    // Разрешенный слот - добавляем эффект магнита
                    slotElement.classList.add('drop-active');
                    slotElement.classList.add('magnetic-target');
                } else {
                    // Запрещенный слот - визуальные эффекты запрета
                    slotElement.classList.add('drop-forbidden');
                    
                    // Определяем причину запрета для подсказки
                    if (type === dragAndDrop.dragSourceType) {
                        (slotElement as HTMLElement).setAttribute('title', 'Нельзя перетаскивать в тот же тип смены');
                    } else {
                        // Проверяем, занят ли слот
                        const isOccupied = slotElement.getAttribute('data-occupied') === 'true';
                        if (isOccupied) {
                            slotElement.classList.add('slot-occupied');
                            (slotElement as HTMLElement).setAttribute('title', 'Этот слот уже занят');
                        }
                    }
                }
            }
        }
    }, [dragAndDrop, canDropToSlot]);

    // Обработчик движения для сенсорных экранов
    const handleGlobalTouchMove = useCallback((e: TouchEvent) => {
        if (!dragAndDrop.isDragging || !dragAndDrop.dragElement) return;
        
        // Получаем координаты последнего касания
        const touch = e.touches[0];
        const { clientX, clientY } = touch;
        
        // Используем общую логику обработки движения
        const mouseEvent = new MouseEvent('mousemove', {
            clientX,
            clientY,
            bubbles: true,
            cancelable: true,
            view: window
        });
        
        handleGlobalMouseMove(mouseEvent);
    }, [dragAndDrop, handleGlobalMouseMove]);

    // Обновляем обработчик отпускания мыши для учета запретов
    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        console.log('[ShiftPanel] Global mouse up detected');
        
        if (!dragAndDrop.isDragging || !dragAndDrop.dragElement || !dragAndDrop.dragCourier) return;
        
        // Пытаемся получить элемент под курсором
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
        const slotElement = elementsAtPoint.find(el => 
            el.classList.contains('slot-button') || 
            (el.hasAttribute('data-testid') && 
            (el.getAttribute('data-testid') || '').startsWith('slot-'))
        );
        
        if (slotElement) {
            const testId = slotElement.getAttribute('data-testid') || '';
            const parts = testId.split('-');
            
            if (parts.length === 3) {
                const slotType = parts[1] as 'day' | 'night';
                const slotIndex = parseInt(parts[2], 10);
                
                console.log('[ShiftPanel] Found slot under cursor', { slotType, slotIndex });
                
                // Проверяем, можно ли сделать дроп в этот слот
                if (dragAndDrop.dragSourceType) {
                    const canDrop = canDropToSlot(slotType, slotIndex, dragAndDrop.dragSourceType);
                    
                    if (canDrop) {
                        // ... остальной код успешного перетаскивания ...
                        // Создаем плавную анимацию перемещения аватара от источника к цели
                        const targetRect = slotElement.getBoundingClientRect();
                        const targetCenterX = targetRect.left + targetRect.width / 2;
                        const targetCenterY = targetRect.top + targetRect.height / 2;
                        
                        // Подсвечиваем целевой слот
                        slotElement.classList.add('drop-active');
                        
                        // Создаем "летящий" аватар для анимации перемещения
                        const flyingAvatar = document.createElement('div');
                        flyingAvatar.className = 'flying-avatar';
                        flyingAvatar.style.position = 'fixed';
                        flyingAvatar.style.zIndex = '9999';
                        flyingAvatar.style.pointerEvents = 'none';
                        
                        // Копируем стили и содержимое из призрака перетаскивания
                        const ghostRect = dragAndDrop.dragElement.getBoundingClientRect();
                        
                        // Устанавливаем начальную позицию и размеры
                        flyingAvatar.style.width = `${ghostRect.width}px`;
                        flyingAvatar.style.height = `${ghostRect.height}px`;
                        flyingAvatar.style.top = `${ghostRect.top}px`;
                        flyingAvatar.style.left = `${ghostRect.left}px`;
                        flyingAvatar.style.borderRadius = '50%';
                        flyingAvatar.style.overflow = 'visible';
                        
                        // Копируем содержимое из призрака (или используем базовые стили)
                        flyingAvatar.innerHTML = dragAndDrop.dragElement.innerHTML;
                        
                        // Добавляем специальные эффекты
                        flyingAvatar.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2)';
                        flyingAvatar.style.transform = 'scale(1)';
                        
                        // Добавляем в DOM
                        document.body.appendChild(flyingAvatar);
                        
                        // Сразу удаляем призрак перетаскивания, чтобы он не мешал
                        dragAndDrop.dragElement.style.opacity = '0';
                        
                        // Запускаем анимацию перемещения к целевому слоту
                        setTimeout(() => {
                            flyingAvatar.style.transform = 'scale(0.8)';
                            flyingAvatar.style.top = `${targetCenterY - ghostRect.height / 2}px`;
                            flyingAvatar.style.left = `${targetCenterX - ghostRect.width / 2}px`;
                            
                            // После завершения анимации удаляем летящий аватар
                            setTimeout(() => {
                                flyingAvatar.style.opacity = '0';
                                setTimeout(() => {
                                    if (flyingAvatar.parentNode) {
                                        flyingAvatar.parentNode.removeChild(flyingAvatar);
                                    }
                                    
                                    // Отправляем событие успешного переноса ПОСЛЕ завершения анимации
                                    // Это предотвратит мгновенное появление аватара в целевом слоте
                                    const dragEndEvent = new CustomEvent('dragOperationComplete', {
                                        detail: {
                                            success: true,
                                            sourceType: dragAndDrop.dragSourceType,
                                            sourceIndex: dragAndDrop.dragSourceIndex,
                                            targetType: slotType,
                                            targetIndex: slotIndex,
                                            item: dragAndDrop.dragCourier
                                        }
                                    });
                                    document.dispatchEvent(dragEndEvent);
                                    
                                    // Важно: Вызываем onSlotSelect для создания API-запроса
                                    // после завершения визуальной анимации
                                    if (onSlotSelect) {
                                        console.log('[ShiftPanel] Calling onSlotSelect after animation');
                                        onSlotSelect(
                                            slotType, 
                                            slotIndex, 
                                            dragAndDrop.dragCourier.id, 
                                            true // Это операция перетаскивания
                                        );
                                    }
                                }, 50);
                            }, 250);
                        }, 10);
                    } else {
                        // Запрещенное перетаскивание - показываем анимацию отказа
                        console.log('[ShiftPanel] Drop is forbidden, showing rejection animation');
                        showDropRejectionAnimation(e, dragAndDrop);
                    }
                }
            }
        } else {
            // Если дроп не на слот - показываем отмену и возврат
            console.log('[ShiftPanel] Drop is not on a slot, showing rejection animation');
            showDropRejectionAnimation(e, dragAndDrop);
        }
        
        // Очищаем состояние перетаскивания
        dragAndDrop.cleanupDragState();
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [dragAndDrop, handleGlobalMouseMove, onSlotSelect, canDropToSlot]);

    // Также обновляем обработчик для сенсорных экранов
    const handleGlobalTouchEnd = useCallback((e: TouchEvent) => {
        if (!dragAndDrop.isDragging || !dragAndDrop.dragElement || !dragAndDrop.dragCourier) return;
        
        // Получаем координаты последнего касания
        const touch = e.changedTouches[0];
        const { clientX, clientY } = touch;
        
        // Пытаемся получить элемент под касанием
        const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
        const slotElement = elementsAtPoint.find(el => 
            el.classList.contains('slot-button') || 
            (el.hasAttribute('data-testid') && 
            (el.getAttribute('data-testid') || '').startsWith('slot-'))
        );
        
        if (slotElement) {
            const testId = slotElement.getAttribute('data-testid') || '';
            const parts = testId.split('-');
            
            if (parts.length === 3) {
                const slotType = parts[1] as 'day' | 'night';
                const slotIndex = parseInt(parts[2], 10);
                
                // Проверяем, можно ли сделать дроп в этот слот
                if (dragAndDrop.dragSourceType) {
                    const canDrop = canDropToSlot(slotType, slotIndex, dragAndDrop.dragSourceType);
                    
                    if (canDrop) {
                        // Разрешенное перетаскивание - обрабатываем дроп
                        // Аналогично handleGlobalMouseUp
                        // Важно: Вызываем onSlotSelect для создания API-запроса
                        if (onSlotSelect) {
                            onSlotSelect(
                                slotType, 
                                slotIndex, 
                                dragAndDrop.dragCourier.id, 
                                true // Это операция перетаскивания
                            );
                        }
                    } else {
                        // Запрещенное перетаскивание - показываем анимацию отказа
                        const mouseEvent = new MouseEvent('mouseup', {
                            clientX,
                            clientY
                        });
                        showDropRejectionAnimation(mouseEvent, dragAndDrop);
                    }
                }
            }
        } else {
            // Если дроп не на слот - показываем отмену и возврат
            const mouseEvent = new MouseEvent('mouseup', {
                clientX,
                clientY
            });
            showDropRejectionAnimation(mouseEvent, dragAndDrop);
        }
        
        // Очищаем состояние перетаскивания
        dragAndDrop.cleanupDragState();
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
    }, [dragAndDrop, onSlotSelect, canDropToSlot, handleGlobalTouchMove]);

    // Функция для анимации отказа в перетаскивании
    const showDropRejectionAnimation = (e: MouseEvent, dragAndDrop: any) => {
        if (!dragAndDrop.dragElement) return;
        
        // Добавляем класс для анимации "отказа"
        dragAndDrop.dragElement.classList.add('drop-denied');
        
        // Анимируем возврат в исходную позицию
        dragAndDrop.dragElement.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        dragAndDrop.dragElement.style.transform = 'translate(0px, 0px) scale(0.9)';
        dragAndDrop.dragElement.style.opacity = '0.7';
        
        // Добавляем индикатор запрета
        const deniedIndicator = document.createElement('div');
        deniedIndicator.style.position = 'absolute';
        deniedIndicator.style.top = '50%';
        deniedIndicator.style.left = '50%';
        deniedIndicator.style.transform = 'translate(-50%, -50%)';
        deniedIndicator.style.width = '40px';
        deniedIndicator.style.height = '40px';
        deniedIndicator.style.background = 'rgba(255, 0, 0, 0.6)';
        deniedIndicator.style.borderRadius = '50%';
        deniedIndicator.style.display = 'flex';
        deniedIndicator.style.alignItems = 'center';
        deniedIndicator.style.justifyContent = 'center';
        deniedIndicator.style.zIndex = '20';
        deniedIndicator.innerHTML = '<span style="color: white; font-size: 24px; font-weight: bold;">✖</span>';
        deniedIndicator.style.opacity = '0';
        deniedIndicator.style.transition = 'all 0.3s ease';
        
        dragAndDrop.dragElement.appendChild(deniedIndicator);
        
        // Анимируем индикатор запрета
        setTimeout(() => {
            deniedIndicator.style.opacity = '1';
            
            // Создаем событие завершения перетаскивания
            const dragEndEvent = new CustomEvent('customDragEnd', {
                detail: {
                    success: false,
                    sourceType: dragAndDrop.dragSourceType,
                    sourceIndex: dragAndDrop.dragSourceIndex,
                    item: dragAndDrop.dragCourier
                }
            });
            
            // Через некоторое время скрываем всё
            setTimeout(() => {
                deniedIndicator.style.opacity = '0';
                dragAndDrop.dragElement.style.opacity = '0';
                
                // После того, как анимация отказа завершилась, отправляем событие
                setTimeout(() => {
                    document.dispatchEvent(dragEndEvent);
                }, 300);
            }, 500);
        }, 100);
    };

    // Добавляем обработчики для DragDropContext
    const handleDragStart = useCallback((initial: any) => {
        console.log('[ShiftPanel] DragDropContext onDragStart', initial);
    }, []);

    const handleDragEnd = useCallback((result: DropResult) => {
        if (!result.destination) return;
        
        const { destination, draggableId } = result;
        
        // Получаем тип назначения
        const destType = destination.droppableId === 'day-shift' ? 'day' : 'night';
        
        // Получаем индекс слота
        const destIndex = destination.index;
        
        // Получаем ID курьера
        const courierId = draggableId;
        
        // Если есть функция обработки перемещения, вызываем её
        if (onSlotSelect) {
            onSlotSelect(destType, destIndex, courierId, true);
        }
    }, [onSlotSelect]);

    return (
        <>
            <GlobalStyles />
            <DragDropContext 
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <React.Fragment key="shift-panel-root">
                    {/* Показываем либо основной контент, либо диалог подтверждения */}
                    {uiState.confirmationOpen ? (
                        <ShiftConfirmationDialog
                            date={date}
                            pendingShift={uiState.pendingShift}
                            onConfirm={handleConfirmShift}
                            onCancel={() => uiState.closeConfirmation()}
                            isOpen={true}
                            userName={currentUserName}
                            userAvatar={currentUserAvatar}
                        />
                    ) : (
                        <>
                            <ShiftSection key="day-shift-section">
                                <ShiftTitle>
                                    <ShiftIcon>☀️</ShiftIcon> Дневная смена
                                </ShiftTitle>
                                <Droppable droppableId="day-shift">
                                    {(provided) => (
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
                                    {(provided) => (
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

                            {/* Подсказки */}
                            {isCurrentUserSenior && (
                                <SeniorHint>
                                    Вы - старший курьер. У вас есть возможность управлять сменами других курьеров.
                                </SeniorHint>
                            )}
                            
                            {!isCurrentUserSenior && (
                                <LongPressHint>
                                    Совет: Удерживайте аватар курьера для просмотра расширенного профиля
                                </LongPressHint>
                            )}
                            
                            {isFullyBooked && !userHasShift && (
                                <NoSlotsMessage key="no-slots-message">
                                    Все смены уже заняты.<br/>
                                    Вы можете записаться в резерв.
                                </NoSlotsMessage>
                            )}
                        </>
                    )}


                </React.Fragment>
            </DragDropContext>
        </>
    );
};

// Оптимизируем компонент с помощью React.memo с улучшенной функцией сравнения
export default React.memo(ShiftPanelContainer, (prevProps, nextProps) => {
    // Предотвращаем перерендеринг, если никакие важные свойства не изменились
    // Это важно для предотвращения лишних подключений WebSocket
    
    // Вместо сравнения всего массива смен, сравним только идентификаторы и индексы
    const getDayShiftsSignature = (shifts: ShiftSlotLocal[]) => 
        shifts.map(s => `${s.userId}-${s.slotIndex}`).sort().join(',');
    
    const getNightShiftsSignature = (shifts: ShiftSlotLocal[]) => 
        shifts.map(s => `${s.userId}-${s.slotIndex}`).sort().join(',');
    
    // Сравниваем дату
    const sameDate = prevProps.date.getTime() === nextProps.date.getTime();
    
    // Сравниваем массивы смен по сигнатурам, а не глубоким сравнением
    const sameDayShifts = getDayShiftsSignature(prevProps.dayShifts) === getDayShiftsSignature(nextProps.dayShifts);
    const sameNightShifts = getNightShiftsSignature(prevProps.nightShifts) === getNightShiftsSignature(nextProps.nightShifts);
    
    // Проверяем свойства пользователя
    const sameUser = 
        prevProps.currentUserId === nextProps.currentUserId &&
        prevProps.currentUserAvatar === nextProps.currentUserAvatar &&
        prevProps.currentUserName === nextProps.currentUserName;
    
    // Проверяем остальные свойства
    const sameMetadata = 
        prevProps.maxDaySlots === nextProps.maxDaySlots &&
        prevProps.maxNightSlots === nextProps.maxNightSlots &&
        prevProps.chatId === nextProps.chatId;
    
    // Особая проверка для предотвращения ререндера во время операции перетаскивания
    const isDragging = document.querySelector('.dragging') !== null || 
                       document.querySelector('.drop-target') !== null ||
                       document.querySelector('[data-dragging="true"]') !== null;
    
    if (isDragging) {
        console.log('[ShiftPanelContainer] Preventing re-render during drag operation');
        return true; // Предотвращаем ререндер во время перетаскивания
    }
    
    // Проверяем, существует ли глобальная переменная и установлен ли флаг перетаскивания
    if (typeof window !== 'undefined' && (window as any).globalSocketTracker?.isDragging) {
        console.log('[ShiftPanelContainer] Preventing re-render due to global drag state');
        return true; // Предотвращаем ререндер, если в глобальном состоянии установлен флаг перетаскивания
    }
    
    // Возвращаем true, если все свойства одинаковые (компонент не должен обновляться)
    // Возвращаем false, если какие-то свойства изменились (компонент должен обновиться)
    const shouldPreventUpdate = sameDate && sameDayShifts && sameNightShifts && sameUser && sameMetadata;
    
    if (!shouldPreventUpdate) {
        console.log('[ShiftPanelContainer] Update triggered by props changes', {
            sameDate, sameDayShifts, sameNightShifts, sameUser, sameMetadata
        });
    }
    
    return shouldPreventUpdate;
}); 