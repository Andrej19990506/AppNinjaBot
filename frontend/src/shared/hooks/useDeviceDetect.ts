// --- useDeviceDetect ---
// Хук для определения типа устройства (мобильный, планшет, десктоп) по ширине экрана.
// Удобно использовать для адаптивного UI и условного рендера компонентов.

import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;      // true, если ширина < 768px
  isTablet: boolean;      // true, если ширина 768-1023px
  isDesktop: boolean;     // true, если ширина >= 1024px
  deviceType: 'mobile' | 'tablet' | 'desktop'; // строковое представление типа
}

// Главный хук
export const useDeviceDetect = (): DeviceInfo => {
  // Состояние с инфой об устройстве
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    deviceType: 'desktop'
  });

  useEffect(() => {
    // Функция для вычисления типа устройства по ширине окна
    const handleResize = () => {
      const width = window.innerWidth;
      
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;
      
      let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
      
      if (isMobile) deviceType = 'mobile';
      else if (isTablet) deviceType = 'tablet';
      else deviceType = 'desktop';
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        deviceType
      });
    };
    
    // Вызываем один раз при монтировании, чтобы сразу определить тип
    handleResize();
    
    // Подписываемся на resize окна, чтобы обновлять тип устройства на лету
    window.addEventListener('resize', handleResize);
    
    // Отписываемся при размонтировании компонента
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Возвращаем актуальную инфу об устройстве
  return deviceInfo;
};

export default useDeviceDetect; 