import { useEffect } from 'react';
import './SnowEffect.css';

interface SnowOnElementsProps {
  /** Селекторы элементов, на которые нужно добавить снег */
  selectors?: string[];
  /** Вероятность появления снега на элементе (0-1) */
  probability?: number;
  /** Включить эффект */
  enabled?: boolean;
}

/**
 * Компонент добавляет эффект снега на случайные элементы страницы
 * Использование: <SnowOnElements selectors={['.menu-item', '.button']} probability={0.5} />
 */
const SnowOnElements: React.FC<SnowOnElementsProps> = ({ 
  selectors = ['.menu-item', '.button', '.card'],
  probability = 0.4,
  enabled = true
}) => {
  useEffect(() => {
    if (!enabled) return;

    console.log('❄️ [SnowOnElements] Добавляем снег на элементы...');

    // Сохраняем элементы, на которые уже добавили снег
    const snowedElements = new Set<Element>();

    const applySnow = () => {
      // Объединяем все селекторы
      const allSelectors = selectors.join(', ');
      const elements = document.querySelectorAll(allSelectors);

      console.log(`❄️ [SnowOnElements] Найдено ${elements.length} элементов`);

      elements.forEach((element, index) => {
        // Если на этот элемент уже добавлен снег, пропускаем
        if (snowedElements.has(element)) return;

        const htmlElement = element as HTMLElement;

        // Проверяем, виден ли элемент на экране
        const rect = htmlElement.getBoundingClientRect();
        const style = window.getComputedStyle(htmlElement);
        
        const isVisible = 
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          htmlElement.offsetParent !== null; // Элемент не скрыт через родителя

        // Пропускаем невидимые элементы
        if (!isVisible) return;

        // Случайно решаем, добавлять ли снег на этот элемент
        if (Math.random() < probability) {
          // Определяем тип снега в зависимости от формы элемента
          const isCircular = htmlElement.offsetWidth === htmlElement.offsetHeight &&
                           style.borderRadius.includes('50%');

          // Добавляем класс снега
          if (isCircular) {
            htmlElement.classList.add('snow-on-circle');
          } else {
            htmlElement.classList.add('snow-on-element');
            
            // Случайно выбираем интенсивность снега
            const intensity = Math.random();
            if (intensity < 0.3) {
              htmlElement.classList.add('snow-light');
            } else if (intensity > 0.7) {
              htmlElement.classList.add('snow-heavy');
            }
          }

          // Запоминаем, что на этот элемент добавлен снег
          snowedElements.add(element);

          console.log(`❄️ [SnowOnElements] Снег добавлен на видимый элемент #${index}`);
        }
      });
    };

    // Применяем снег сразу
    applySnow();
    
    // Дополнительные проверки через задержки на случай динамической подгрузки элементов
    const additionalCheckId1 = setTimeout(applySnow, 300);
    const additionalCheckId2 = setTimeout(applySnow, 1000);
    const additionalCheckId3 = setTimeout(applySnow, 2000);

    return () => {
      clearTimeout(additionalCheckId1);
      clearTimeout(additionalCheckId2);
      clearTimeout(additionalCheckId3);
      
      // Убираем все классы снега при размонтировании
      const allSelectors = selectors.join(', ');
      const elements = document.querySelectorAll(allSelectors);
      elements.forEach(element => {
        element.classList.remove(
          'snow-on-element',
          'snow-on-circle',
          'snow-light',
          'snow-heavy'
        );
      });
    };
  }, [selectors, probability, enabled]);

  return null; // Этот компонент не рендерит ничего
};

export default SnowOnElements;

