import { useState, useCallback, RefObject } from 'react';

interface TouchHandlingOptions {
  onClose: () => void;
  threshold?: number;
  containerRef?: RefObject<HTMLElement>;
}

/**
 * Хук для обработки касаний и перетаскивания модального окна
 * @param options объект с опциями и обработчиками
 * @returns объект с обработчиками касаний и состояниями
 */
export function useTouchHandling({ onClose, threshold = 50, containerRef }: TouchHandlingOptions) {
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragY, setDragY] = useState<number>(0);

  // Обработчик начала касания
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;

    // Проверяем, является ли цель интерактивным элементом
    const interactiveTags = ['BUTTON', 'INPUT', 'A', 'TEXTAREA', 'SELECT'];
    let currentElement: HTMLElement | null = target;
    let isInteractive = false;
    while (currentElement && currentElement !== e.currentTarget) {
      if (interactiveTags.includes(currentElement.tagName) || currentElement.getAttribute('role') === 'button') {
        isInteractive = true;
        break;
      }
      currentElement = currentElement.parentElement;
    }

    // Если цель интерактивная, НИЧЕГО НЕ ДЕЛАЕМ, чтобы не мешать клику
    if (isInteractive) {
      console.log("[TouchHandling] Interactive element touched, ignoring touch start for drag.");
      return;
    }

    // Если цель не интерактивная, начинаем отслеживание для свайпа
    e.stopPropagation();
    setTouchStartY(e.touches[0].clientY);
    setTouchStartX(e.touches[0].clientX);
    setTouchStartTime(Date.now());
    setDragY(0);
    setIsDragging(false);
  }, []);

  // Обработчик движения при касании
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY === null || touchStartX === null) return;

    const touchY = e.touches[0].clientY;
    const touchX = e.touches[0].clientX;
    const deltaY = touchY - touchStartY;
    const deltaX = touchX - touchStartX;

    if (!isDragging && Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      setIsDragging(true);
      console.log("[TouchHandling] Drag started.");
    }

    if (isDragging) {
      e.stopPropagation();
      e.preventDefault();
      setDragY(deltaY);
    }
  }, [touchStartY, touchStartX, isDragging, threshold]);

  // Обработчик завершения касания
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY !== null) {
      if (isDragging) {
        e.stopPropagation();
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const dragDuration = Date.now() - (touchStartTime || 0);

        if (deltaY > threshold || (deltaY > 5 && dragDuration < 200)) {
          console.log("[TouchHandling] Closing due to swipe.");
          onClose();
        }
      } else {
        console.log("[TouchHandling] Touch ended, no drag.");
      }

      setTouchStartY(null);
      setTouchStartX(null);
      setTouchStartTime(null);
      setIsDragging(false);
      setDragY(0);
    }
  }, [isDragging, touchStartY, touchStartTime, threshold, onClose]);

  return {
    isDragging,
    dragY,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
} 