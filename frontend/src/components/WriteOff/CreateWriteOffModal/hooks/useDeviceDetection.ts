import { useState, useEffect } from 'react';

/**
 * Хук для определения типа устройства на основе размера экрана
 * @returns объект с флагами isMobile и isDesktop
 */
export function useDeviceDetection() {
  // Инициализируем с правильным значением сразу
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const isMobileView = width <= 768;
      console.log(`[useDeviceDetection] Определение типа устройства: ширина=${width}px, isMobile=${isMobileView}`);
      setWindowWidth(width);
      setIsMobile(isMobileView);
    };
    
    // Начальная проверка при монтировании
    checkMobile();
    console.log(`[useDeviceDetection] INITIAL STATE: width=${windowWidth}, isMobile=${isMobile}`);
    
    // Подписываемся на изменение размера окна
    window.addEventListener('resize', checkMobile);
    
    // Отписываемся при размонтировании компонента
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [windowWidth]);
  
  return { isMobile, isDesktop: !isMobile, windowWidth };
} 