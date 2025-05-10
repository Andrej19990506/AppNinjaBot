import { useState, useCallback, useEffect, useRef } from 'react';

export interface DraggableItem {
  id?: string;
  userId?: string;
  photo_url?: string | null;
  firstName?: string;
  lastName?: string;
  shiftType?: 'day' | 'night';
  slotIndex: number;
  isSeniorCourier?: boolean;
  [key: string]: any;
}

export interface DropTarget {
  shiftType: 'day' | 'night';
  slotIndex: number;
  rect: DOMRect;
}

export interface HighlightedTarget {
  shiftType: 'day' | 'night';
  slotIndex: number;
  canDrop: boolean;
}

export interface DragPosition {
  x: number;
  y: number;
}

interface UseDragAndDropProps {
  onItemMove: (
    item: DraggableItem,
    sourceType: 'day' | 'night',
    sourceIndex: number,
    targetType: 'day' | 'night',
    targetIndex: number
  ) => Promise<void> | void;
  longPressDelay?: number;
  isSeniorUser: boolean;
  onLongPressNonSenior?: (item: DraggableItem) => void;
  targetSelector?: string;
}

interface UseDragAndDropResult {
  isDragging: boolean;
  draggedItem: DraggableItem | null;
  dragSourceType: 'day' | 'night' | null;
  dragSourceIndex: number | null;
  dragPosition: DragPosition;
  highlightedTarget: HighlightedTarget | null;
  dropTargets: DropTarget[];
  dragActive: boolean;
  pressAnimationActive: boolean;
  pressAnimationSlot: number | null;
  pressAnimationShiftType: 'day' | 'night' | null;
  handleItemPress: (
    event: React.MouseEvent | React.TouchEvent,
    item: DraggableItem,
    type: 'day' | 'night',
    index: number
  ) => void;
  handleItemRelease: () => void;
  collectDropTargets: () => void;
  resetDragState: () => void;
}

/**
 * Хук для управления функциональностью drag-and-drop
 * Позволяет перетаскивать элементы между различными слотами
 * Разработан для перемещения курьеров между сменами старшими курьерами
 * 
 * @param onItemMove Колбэк, вызываемый при перемещении элемента
 * @param longPressDelay Задержка для длительного нажатия в мс
 * @param isSeniorUser Флаг, указывающий является ли пользователь старшим курьером
 * @param onLongPressNonSenior Колбэк для не старших курьеров при долгом нажатии
 * @param targetSelector CSS-селектор для обнаружения целевых элементов
 */
const useDragAndDrop = ({
  onItemMove,
  longPressDelay = 500,
  isSeniorUser,
  onLongPressNonSenior,
  targetSelector = '[data-testid^="slot-day-"], [data-testid^="slot-night-"]'
}: UseDragAndDropProps): UseDragAndDropResult => {
  // Состояние для перетаскивания
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DraggableItem | null>(null);
  const [dragSourceType, setDragSourceType] = useState<'day' | 'night' | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition>({ x: 0, y: 0 });
  const [dropTargets, setDropTargets] = useState<DropTarget[]>([]);
  const [highlightedTarget, setHighlightedTarget] = useState<HighlightedTarget | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Состояние для анимации длительного нажатия
  const [pressAnimationActive, setPressAnimationActive] = useState(false);
  const [pressAnimationSlot, setPressAnimationSlot] = useState<number | null>(null);
  const [pressAnimationShiftType, setPressAnimationShiftType] = useState<'day' | 'night' | null>(null);

  // Реф для таймера длительного нажатия
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Функция для сброса состояния перетаскивания
  const resetDragState = useCallback(() => {
    setIsDragging(false);
    setDraggedItem(null);
    setDragSourceType(null);
    setDragSourceIndex(null);
    setHighlightedTarget(null);
    setDropTargets([]);
    setDragActive(false);
    
    // Сбрасываем анимацию
    setPressAnimationActive(false);
    setPressAnimationSlot(null);
    setPressAnimationShiftType(null);
    
    // Очищаем таймер
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  // Функция для сбора целей перетаскивания
  const collectDropTargets = useCallback(() => {
    const targets: DropTarget[] = [];
    
    try {
      // Собираем все дневные слоты
      const daySlotElements = document.querySelectorAll('[data-testid^="slot-day-"]');
      daySlotElements.forEach((element) => {
        const dataTestId = element.getAttribute('data-testid');
        if (!dataTestId) return;
        
        const parts = dataTestId.split('-');
        if (parts.length < 3) return;
        
        const index = parseInt(parts[2]);
        if (isNaN(index)) return;
        
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect && rect.width && rect.height) {
            targets.push({
              shiftType: 'day',
              slotIndex: index,
              rect: rect
            });
          }
        }
      });
      
      // Собираем все ночные слоты
      const nightSlotElements = document.querySelectorAll('[data-testid^="slot-night-"]');
      nightSlotElements.forEach((element) => {
        const dataTestId = element.getAttribute('data-testid');
        if (!dataTestId) return;
        
        const parts = dataTestId.split('-');
        if (parts.length < 3) return;
        
        const index = parseInt(parts[2]);
        if (isNaN(index)) return;
        
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect && rect.width && rect.height) {
            targets.push({
              shiftType: 'night',
              slotIndex: index,
              rect: rect
            });
          }
        }
      });
      
      console.log('[useDragAndDrop] Собраны цели перетаскивания:', targets.length);
      setDropTargets(targets);
    } catch (error) {
      console.error('[useDragAndDrop] Ошибка при сборе целей перетаскивания:', error);
      setDropTargets([]);
    }
  }, []);

  // Обработчик перемещения во время перетаскивания
  const handleDragMove = useCallback((event: MouseEvent | TouchEvent) => {
    // Предотвращаем действия браузера по умолчанию при перетаскивании
    if (event.cancelable !== false) {
      event.preventDefault();
    }
    event.stopPropagation();
    
    if (!isDragging || !draggedItem) return;
    
    // Определяем координаты касания/указателя мыши
    let clientX, clientY;
    if (event instanceof TouchEvent) {
      if (event.touches.length === 0) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    // Устанавливаем позицию аватара точно под курсором/пальцем
    setDragPosition({
      x: clientX,
      y: clientY
    });
    
    // Находим целевой слот под курсором
    if (dropTargets.length > 0) {
      let newHighlightedTarget: HighlightedTarget | null = null;
      
      // Проверяем попадание в один из целевых слотов
      for (const target of dropTargets) {
        const { rect, slotIndex, shiftType } = target;
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
          // Определяем, можно ли переместить в эту цель (не тот же самый слот)
          const canDrop = dragSourceType !== shiftType || dragSourceIndex !== slotIndex;
          newHighlightedTarget = { slotIndex, shiftType, canDrop };
          break;
        }
      }
      
      // Обновляем подсвеченный слот, если он изменился
      if (JSON.stringify(newHighlightedTarget) !== JSON.stringify(highlightedTarget)) {
        setHighlightedTarget(newHighlightedTarget);
      }
    }
  }, [isDragging, draggedItem, dropTargets, highlightedTarget, dragSourceType, dragSourceIndex]);

  // Обработчик отпускания после перетаскивания
  const handleDragEnd = useCallback(() => {
    // Удаляем все обработчики событий
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);
    
    try {
      // Проверяем наличие всех необходимых данных для перемещения
      if (isDragging && 
          highlightedTarget && 
          highlightedTarget.canDrop && 
          draggedItem && 
          dragSourceType && 
          dragSourceIndex !== null) {
        
        // Перемещаем элемент
        onItemMove(
          draggedItem,
          dragSourceType,
          dragSourceIndex,
          highlightedTarget.shiftType,
          highlightedTarget.slotIndex
        );
      }
    } catch (error) {
      console.error('[useDragAndDrop] Ошибка в handleDragEnd:', error);
    } finally {
      // Всегда сбрасываем состояние перетаскивания
      resetDragState();
    }
  }, [isDragging, highlightedTarget, draggedItem, dragSourceType, dragSourceIndex, onItemMove, handleDragMove, resetDragState]);

  // Обработчик долгого нажатия на элемент для drag-and-drop
  const handleItemPress = useCallback((
    event: React.MouseEvent | React.TouchEvent,
    item: DraggableItem,
    type: 'day' | 'night',
    index: number
  ) => {
    // Предотвращаем срабатывание onClick родительской кнопки
    event.preventDefault();
    event.stopPropagation();
    
    console.log('[useDragAndDrop] handleItemPress START:', { item, type, index, isSeniorUser });
    
    // Устанавливаем атрибут для предотвращения обработки клика
    document.body.setAttribute('data-avatar-click', 'true');
    
    // Сохраняем DOM-элемент и его позицию
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    console.log('[useDragAndDrop] Element and position captured:', { 
      element: !!element,
      rect
    });
    
    // Определяем начальные координаты события (касание или мышь)
    let clientX: number, clientY: number;
    
    if ('touches' in event && event.touches.length > 0) {
      // Сенсорное событие
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      // Событие мыши
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      // Используем центр элемента, если не получили координаты
      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;
    }
    
    // Активируем анимацию для визуальной обратной связи
    setPressAnimationActive(true);
    setPressAnimationSlot(index);
    setPressAnimationShiftType(type);
    
    // Устанавливаем таймер для долгого нажатия
    pressTimerRef.current = setTimeout(() => {
      console.log('[useDragAndDrop] Timeout triggered for press action', { isSeniorUser });
      
      // Сбрасываем анимацию нажатия
      setPressAnimationActive(false);
      setPressAnimationSlot(null);
      setPressAnimationShiftType(null);
      
      // Если пользователь старший курьер, активируем перетаскивание
      if (isSeniorUser) {
        try {
          if (!element) {
            console.error('[useDragAndDrop] No element found');
            return;
          }
          
          console.log('[useDragAndDrop] Starting drag for senior user with item:', item);
          
          // Создаем объект с данными об элементе для drag-and-drop
          setDraggedItem(item);
          setDragSourceType(type);
          setDragSourceIndex(index);
          
          // Устанавливаем начальную позицию перетаскиваемого элемента
          // точно в месте нажатия/касания
          setDragPosition({
            x: clientX,
            y: clientY
          });
          
          // Собираем информацию о целях для перетаскивания
          collectDropTargets();
          
          // Активируем состояние перетаскивания
          setIsDragging(true);
          setDragActive(true);
          
          // Добавляем обработчики событий на уровне документа
          document.addEventListener('mousemove', handleDragMove, { passive: false });
          document.addEventListener('touchmove', handleDragMove, { passive: false });
          document.addEventListener('mouseup', handleDragEnd);
          document.addEventListener('touchend', handleDragEnd);
        } catch (error) {
          console.error('[useDragAndDrop] Error in drag initialization:', error);
        }
      } else if (onLongPressNonSenior) {
        // Для не старших курьеров вызываем отдельный колбэк (например, показ профиля)
        console.log('[useDragAndDrop] Calling non-senior long press handler');
        onLongPressNonSenior(item);
      }
    }, longPressDelay);
  }, [collectDropTargets, handleDragMove, handleDragEnd, longPressDelay, isSeniorUser, onLongPressNonSenior]);

  // Обработчик отпускания элемента
  const handleItemRelease = useCallback(() => {
    // Очищаем таймер при отпускании
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    
    // Сбрасываем анимацию
    setPressAnimationActive(false);
    setPressAnimationSlot(null);
    setPressAnimationShiftType(null);
  }, []);

  // Обработчики для мобильных устройств
  useEffect(() => {
    const preventTouchDefault = (e: TouchEvent) => {
      if (isDragging) {
        // Убедимся, что предотвращаем события только при перетаскивании
        // и только если событие можно отменить
        if (e.cancelable !== false) {
          e.preventDefault();
        }
        e.stopPropagation();
      }
    };
    
    // Используем опцию { passive: false } чтобы позволить preventDefault
    document.addEventListener('touchmove', preventTouchDefault, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', preventTouchDefault);
    };
  }, [isDragging]);

  // Очистка ресурсов при размонтировании компонента
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  return {
    isDragging,
    draggedItem,
    dragSourceType,
    dragSourceIndex,
    dragPosition,
    highlightedTarget,
    dropTargets,
    dragActive,
    pressAnimationActive,
    pressAnimationSlot,
    pressAnimationShiftType,
    handleItemPress,
    handleItemRelease,
    collectDropTargets,
    resetDragState
  };
};

export default useDragAndDrop; 