import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export const useDeviceDetect = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    deviceType: 'desktop'
  });

  useEffect(() => {
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
    
    // Вызываем один раз при монтировании
    handleResize();
    
    // Добавляем слушатель события изменения размера окна
    window.addEventListener('resize', handleResize);
    
    // Отписываемся при размонтировании
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceInfo;
};

export default useDeviceDetect; 