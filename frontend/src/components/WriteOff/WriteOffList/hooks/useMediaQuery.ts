import { useState, useEffect } from 'react';

/**
 * Хук для отслеживания изменений в медиа-запросах
 * @param query CSS медиа-запрос, например '(max-width: 768px)'
 * @returns boolean значение, указывающее, соответствует ли текущее состояние запросу
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => {
    // Проверяем поддержку matchMedia в браузере
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    // Выходим, если matchMedia не поддерживается
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    // Создаем медиа-запрос
    const mediaQuery = window.matchMedia(query);
    
    // Функция-обработчик изменения состояния
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Устанавливаем начальное значение
    setMatches(mediaQuery.matches);

    // Добавляем слушатель события
    if (mediaQuery.addListener) {
      // Старый API для поддержки Safari
      mediaQuery.addListener(handleChange);
    } else {
      // Современный API
      mediaQuery.addEventListener('change', handleChange);
    }

    // Очистка при размонтировании
    return () => {
      if (mediaQuery.removeListener) {
        // Старый API для поддержки Safari
        mediaQuery.removeListener(handleChange);
      } else {
        // Современный API
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, [query]);

  return matches;
};

/**
 * Хук для определения мобильного устройства
 * @param mobileBreakpoint - ширина экрана, ниже которой устройство считается мобильным
 * @returns Boolean - true, если устройство мобильное
 */
export const useIsMobile = (mobileBreakpoint = 768): boolean => {
  return useMediaQuery(`(max-width: ${mobileBreakpoint}px)`);
}; 