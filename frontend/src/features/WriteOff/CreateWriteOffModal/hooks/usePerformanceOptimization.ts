import { useEffect } from 'react';

/**
 * Хук для оптимизации производительности анимаций на мобильных устройствах
 * - Отключает ненужные эффекты
 * - Оптимизирует рендеринг 
 * - Временно скрывает сложные элементы во время анимации
 */
export function usePerformanceOptimization(isOpen: boolean, isMobile: boolean) {
  useEffect(() => {
    if (!isMobile) return; // Применяем оптимизации только на мобильных устройствах
    
    // Отключаем внешние анимации при открытии модального окна
    const enablePerformanceMode = () => {
      if (isOpen) {
        // Добавляем класс для оптимизации производительности
        document.body.classList.add('performance-mode');
        console.log('🚀 Включён режим оптимизации производительности');
        
        // Отключаем анимации фона
        const backgrounds = document.querySelectorAll<HTMLElement>('[class*="background"], [class*="gradient"]');
        backgrounds.forEach(el => {
          if (el) el.style.animation = 'none';
        });
      } else {
        // Восстанавливаем обычный режим
        document.body.classList.remove('performance-mode');
        console.log('✅ Режим оптимизации производительности отключен');
      }
    };

    // Устанавливаем оптимизации сразу и после небольшой задержки
    // (для обработки случаев, когда DOM обновляется асинхронно)
    enablePerformanceMode();
    const timerId = setTimeout(enablePerformanceMode, 100);

    return () => {
      clearTimeout(timerId);
      document.body.classList.remove('performance-mode');
    };
  }, [isOpen, isMobile]);
} 