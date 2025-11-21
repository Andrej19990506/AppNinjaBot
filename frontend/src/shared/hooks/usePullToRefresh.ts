import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Минимальное расстояние для активации (в пикселях)
  resistance?: number; // Сопротивление при перетаскивании (0-1)
  disabled?: boolean;
  minPullDistance?: number; // Минимальное расстояние для показа иконки (в пикселях)
}

interface PullToRefreshState {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  startY: number | null;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  resistance = 0.5,
  disabled = false,
  minPullDistance = 30, // Минимальное расстояние для показа иконки
}: UsePullToRefreshOptions) => {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    startY: null,
  });

  const containerRef = useRef<HTMLElement | null>(null);
  const isAtTopRef = useRef(false);

  // Проверяем, находится ли пользователь в верхней части страницы
  const checkIfAtTop = useCallback(() => {
    if (disabled) return false;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    return scrollTop === 0;
  }, [disabled]);

  // Обработчик начала касания/нажатия
  const handleStart = useCallback(
    (clientY: number) => {
      if (disabled || state.isRefreshing) return;

      if (checkIfAtTop()) {
        isAtTopRef.current = true;
        // НЕ устанавливаем isPulling сразу - только отслеживаем начальную позицию
        setState({
          isPulling: false, // Не показываем иконку сразу
          isRefreshing: false,
          pullDistance: 0,
          startY: clientY,
        });
      }
    },
    [disabled, state.isRefreshing, checkIfAtTop]
  );

  // Обработчик движения
  const handleMove = useCallback(
    (clientY: number) => {
      if (disabled || !isAtTopRef.current || state.startY === null) return;

      const deltaY = clientY - state.startY;
      
      // Разрешаем только движение вниз
      if (deltaY > 0) {
        // Применяем сопротивление для более плавного эффекта
        const distance = Math.min(deltaY * resistance, threshold * 2);
        
        // Показываем иконку только после достижения минимального порога
        const shouldShowIcon = distance >= minPullDistance;
        
        setState((prev) => ({
          ...prev,
          isPulling: shouldShowIcon, // Показываем иконку только после minPullDistance
          pullDistance: distance,
        }));
      } else {
        // Если движение вверх, сбрасываем состояние
        setState((prev) => ({
          ...prev,
          isPulling: false,
          pullDistance: 0,
        }));
      }
    },
    [disabled, state.startY, threshold, resistance, minPullDistance]
  );

  // Обработчик окончания касания/нажатия
  const handleEnd = useCallback(async () => {
    if (disabled || !state.isPulling) return;

    if (state.pullDistance >= threshold && !state.isRefreshing) {
      setState((prev) => ({
        ...prev,
        isRefreshing: true,
        isPulling: false,
      }));

      try {
        await onRefresh();
      } catch (error) {
        console.error('Ошибка при обновлении:', error);
      } finally {
        setState({
          isPulling: false,
          isRefreshing: false,
          pullDistance: 0,
          startY: null,
        });
        isAtTopRef.current = false;
      }
    } else {
      // Если не достигли порога, просто сбрасываем состояние
      setState({
        isPulling: false,
        isRefreshing: false,
        pullDistance: 0,
        startY: null,
      });
      isAtTopRef.current = false;
    }
  }, [disabled, state.isPulling, state.pullDistance, state.isRefreshing, threshold, onRefresh]);

  // Touch события (мобильные устройства)
  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      handleStart(e.touches[0].clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Блокируем скролл только если мы действительно тянем (pullDistance >= minPullDistance)
      if (state.isPulling && isAtTopRef.current && state.pullDistance >= minPullDistance) {
        e.preventDefault(); // Предотвращаем скролл только при активном перетаскивании
      }
      handleMove(e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, state.isPulling, state.pullDistance, minPullDistance, handleStart, handleMove, handleEnd]);

  // Mouse события (десктоп, для тестирования)
  useEffect(() => {
    if (disabled) return;

    let isMouseDown = false;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Левая кнопка мыши
        isMouseDown = true;
        handleStart(e.clientY);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Блокируем скролл только если мы действительно тянем (pullDistance >= minPullDistance)
      if (isMouseDown && state.isPulling && isAtTopRef.current && state.pullDistance >= minPullDistance) {
        e.preventDefault();
      }
      if (isMouseDown) {
        handleMove(e.clientY);
      }
    };

    const handleMouseUp = () => {
      if (isMouseDown) {
        isMouseDown = false;
        handleEnd();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [disabled, state.isPulling, state.pullDistance, minPullDistance, handleStart, handleMove, handleEnd]);

  // Вычисляем прогресс (0-1) для анимации
  const progress = Math.min(state.pullDistance / threshold, 1);
  const shouldShowLoader = state.isPulling || state.isRefreshing;

  return {
    isRefreshing: state.isRefreshing,
    isPulling: state.isPulling,
    pullDistance: state.pullDistance,
    progress,
    shouldShowLoader,
    containerRef,
  };
};

