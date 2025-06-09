import { useState, useEffect } from 'react';


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
      mediaQuery.addListener(handleChange);
    } else {
      mediaQuery.addEventListener('change', handleChange);
    }

    // Очистка при размонтировании
    return () => {
      if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      } else {
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, [query]);

  return matches;
};


export const useIsMobile = (mobileBreakpoint = 768): boolean => {
  return useMediaQuery(`(max-width: ${mobileBreakpoint}px)`);
}; 