import { useState, useCallback } from 'react';

interface TouchHandlingOptions {
  onClose: () => void;
  threshold?: number;
}

/**
 * Хук для обработки касаний и перетаскивания модального окна
 * @param options объект с опциями и обработчиками
 * @returns объект с обработчиками касаний и состояниями
 */
export function useTouchHandling({ onClose, threshold = 50 }: TouchHandlingOptions) {
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Обработчик начала касания
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchStartY(e.touches[0].clientY);
    setTouchStartTime(Date.now());
  }, []);

  // Обработчик движения при касании
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchStartY === null) return;

    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY;

    if (Math.abs(deltaY) > 10) {
      setIsDragging(true);
    }

    if (deltaY > threshold) {
      onClose();
      setTouchStartY(null);
      setIsDragging(false);
    }
  }, [touchStartY, onClose, threshold]);

  // Обработчик завершения касания
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isDragging && e.type === 'click') {
      e.preventDefault();
    }
    setTouchStartY(null);
    setTouchStartTime(null);
    setIsDragging(false);
  }, [isDragging]);

  return {
    touchStartY,
    touchStartTime,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    setIsDragging
  };
} 