/**
 * Утилиты для работы с touch-событиями на мобильных устройствах
 */

// Улучшенная функция предотвращения зума при двойном тапе в Safari на iOS
export const disableDoubleTapZoom = () => {
  let lastTap = 0;
  
  // Более надежный способ блокировки двойного тапа
  const preventZoom = (e: TouchEvent) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < 500 && tapLength > 0) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    lastTap = currentTime;
    return true;
  };

  // Применяем ко всем touch-событиям
  document.addEventListener('touchstart', preventZoom, { passive: false });
  document.addEventListener('touchend', preventZoom, { passive: false });
  
  // Блокируем нативный жест масштабирования
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    return false;
  }, { passive: false });
};

// Полностью блокирует зум на всей странице
export const disableAllZooming = () => {
  // Функция блокировки масштабирования
  const preventZoom = (e: TouchEvent | WheelEvent) => {
    // Если событие имеет больше одного касания (pinch-zoom)
    if ('touches' in e && e.touches.length > 1) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Если это колесико мыши с нажатым Ctrl (или Meta на Mac)
    if ('ctrlKey' in e && e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    return true;
  };

  // Обработчик для жестов масштабирования
  const preventGestureZoom = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // Устанавливаем все обработчики с passive: false для iOS
  document.addEventListener('touchmove', preventZoom as any, { passive: false });
  document.addEventListener('touchstart', preventZoom as any, { passive: false });
  document.addEventListener('wheel', preventZoom as any, { passive: false });
  document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  document.addEventListener('gestureend', preventGestureZoom, { passive: false });
  
  // CSS-хак для iOS: добавляем мета-тег для принудительного отключения зума
  const refreshMetaViewport = () => {
    const existingMetaTag = document.querySelector('meta[name="viewport"]');
    if (existingMetaTag) {
      existingMetaTag.setAttribute('content', 
        'width=device-width, initial-scale=1, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
  };
  
  // Обновляем мета-тег каждые 300ms (может быть необходимо для некоторых версий iOS)
  setInterval(refreshMetaViewport, 300);
  
  // Добавляем специальные стили для iOS
  const style = document.createElement('style');
  style.innerHTML = `
    * {
      touch-action: manipulation !important;
      -webkit-touch-callout: none !important;
      -webkit-tap-highlight-color: transparent !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
    
    html, body {
      touch-action: manipulation !important;
      -ms-touch-action: manipulation !important;
      -webkit-touch-action: manipulation !important;
      user-zoom: fixed !important;
      -ms-user-zoom: fixed !important;
      -webkit-user-zoom: fixed !important;
      overflow: hidden !important;
      height: 100% !important;
    }
    
    #root, main, .app-container {
      overflow-y: auto !important;
      height: 100% !important;
      position: relative !important;
      -webkit-overflow-scrolling: touch !important;
    }
  `;
  document.head.appendChild(style);
};

// Предотвращает масштабирование страницы на iOS при фокусе на элементах ввода
export const disableInputZoom = () => {
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    const content = viewportMeta.getAttribute('content') || '';
    
    if (!content.includes('maximum-scale')) {
      viewportMeta.setAttribute(
        'content', 
        `${content}, maximum-scale=1.0, user-scalable=no`
      );
    }
  }
};

// Обнаруживает устройство на iOS
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

// Применяет все исправления для iOS-устройств
export const applyIOSFixes = () => {
  if (isIOS()) {
    disableDoubleTapZoom();
    disableInputZoom();
    disableAllZooming(); // Добавляем полную блокировку зума
    
    // Добавляем класс iOS к body для применения специфических стилей
    document.body.classList.add('ios-device');
    
    // Блокируем масштабирование пальцами (pinch zoom)
    document.addEventListener('gesturestart', (e) => {
      e.preventDefault();
    }, { passive: false });
    
    // Исправляем проблему с фокусом на элементах
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Защита от зума при быстром двойном тапе
    let lastTapTime = 0;
    document.addEventListener('touchend', (e) => {
      const now = new Date().getTime();
      if (now - lastTapTime < 300) {
        e.preventDefault();
      }
      lastTapTime = now;
    }, { passive: false });
  }
};

export default {
  disableDoubleTapZoom,
  disableInputZoom,
  isIOS,
  applyIOSFixes,
  disableAllZooming
}; 