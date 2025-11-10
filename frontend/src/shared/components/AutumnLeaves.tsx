import React, { useEffect, useState, useCallback, useRef } from 'react';
import './AutumnLeaves.css';
import { soundService } from '../services/soundService';

interface AutumnLeavesProps {
  triggerStart?: boolean; // Триггер для ручного запуска
  enabled?: boolean;
}

const AutumnLeaves: React.FC<AutumnLeavesProps> = ({ triggerStart, enabled = true }) => {
  // Массив с путями к изображениям 
  const leafImages = [
    '/free-icon-snowflake-9011983.png',
  ];
  
  const [activeLeaves, setActiveLeaves] = useState<Array<{
    id: number;
    left: number;
    duration: number;
    imageSrc: string;
    windStrength: number;
    scale: number;
    windDirection: number;
    landingX: number;
    landingY: number;
    startRotation: number; // Начальный угол поворота
    endRotation: number; // Конечный угол поворота
    shouldStay: boolean; // Остается ли на экране
  }>>([]);

  const nextLeafIdRef = useRef(0);
  const isInitializedRef = useRef(false);
  const musicStartedRef = useRef(false);
  const snowflakesStartedRef = useRef(false); // Флаг что снежинки начали падать
  const addLeavesIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const userInteractedRef = useRef(false); // Флаг что пользователь уже взаимодействовал
  const nextCycleTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Таймер следующего цикла
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Таймер инициализации

  const createLeaf = useCallback((id: number) => {
    // 1% шанс что листочек останется на экране
    const shouldStay = Math.random() < 0.01;
    
    return {
      id: id,
      left: Math.random() * 100,
      duration: 8 + Math.random() * 8, // Одинаковая скорость для всех листочков
      imageSrc: leafImages[Math.floor(Math.random() * leafImages.length)], // Случайный выбор изображения
      windStrength: 1 + Math.random() * 2,
      scale: 0.8 + Math.random() * 0.6, // Увеличенный размер от 0.8 до 1.4
      windDirection: Math.random() < 0.5 ? -1 : 1,
      landingX: (Math.random() - 0.5) * 200, // Случайное смещение по X от -100px до +100px
      landingY: shouldStay ? (20 + Math.random() * 70) : (120 + Math.random() * 50), // Вернул к исходным значениям
      startRotation: Math.random() * 360, // Случайный начальный угол 0-360°
      endRotation: Math.random() * 180, // Случайный конечный угол 0-180° (половина оборота)
      shouldStay: shouldStay,
    };
  }, [leafImages]);

  // Добавляет одну порцию снежинок
  const addLeavesToQueue = useCallback(() => {
    setActiveLeaves(prev => {
      // Случайное количество снежинок от 1 до 3
      const leafCount = Math.floor(Math.random() * 3) + 1;
      
      const newLeaves: Array<{
        id: number;
        left: number;
        duration: number;
        imageSrc: string;
        windStrength: number;
        scale: number;
        windDirection: number;
        landingX: number;
        landingY: number;
        startRotation: number;
        endRotation: number;
        shouldStay: boolean;
      }> = [];
      
      for (let i = 0; i < leafCount; i++) {
        const currentId = nextLeafIdRef.current + i;
        newLeaves.push(createLeaf(currentId));
      }
      nextLeafIdRef.current += leafCount;
      
      return [...prev, ...newLeaves];
    });
  }, [createLeaf]);

  // Запускает постоянное падение снежинок
  const startContinuousSnowfall = useCallback(() => {
    if (addLeavesIntervalRef.current) {
      return; // Уже запущено
    }

    console.log('❄️ [AutumnLeaves] Запускаем постоянное падение снежинок');
    
    // Добавляем снежинки каждые 2-4 секунды для более красивого эффекта
    const addSnowflakes = () => {
      addLeavesToQueue();
      
      // Планируем следующую порцию снежинок через случайное время
      const nextDelay = 2000 + Math.random() * 2000; // 2-4 секунды
      addLeavesIntervalRef.current = setTimeout(addSnowflakes, nextDelay) as any;
    };
    
    // Запускаем первую итерацию
    addSnowflakes();
  }, [addLeavesToQueue]);

  // Останавливает падение снежинок
  const stopContinuousSnowfall = useCallback(() => {
    if (addLeavesIntervalRef.current) {
      console.log('❄️ [AutumnLeaves] Останавливаем падение снежинок');
      clearTimeout(addLeavesIntervalRef.current);
      addLeavesIntervalRef.current = null;
    }
  }, []);

  // Запускает новый цикл: музыка + снежинки
  const startWinterCycle = useCallback(async () => {
    if (!enabled) {
      console.log('❄️ [AutumnLeaves] Зимняя анимация отключена. Пропускаем запуск цикла.');
      return;
    }

    // Очищаем pending таймер следующего цикла, если есть
    if (nextCycleTimeoutRef.current) {
      clearTimeout(nextCycleTimeoutRef.current);
      nextCycleTimeoutRef.current = null;
    }

    if (musicStartedRef.current) {
      console.log('⚠️ [AutumnLeaves] Цикл уже запущен, пропускаем');
      return;
    }

    console.log('❄️🎵 [AutumnLeaves] Запускаем зимний цикл: музыка + снежинки...');
    musicStartedRef.current = true;
    
    // Запускаем постоянное падение снежинок (независимо от музыки)
    startContinuousSnowfall();
    
    // Пытаемся запустить музыку (если пользователь уже взаимодействовал, должно сработать)
    const success = await soundService.playWinterMusic();
    
    // Если удалось воспроизвести, значит пользователь уже взаимодействовал
    if (success && !userInteractedRef.current) {
      userInteractedRef.current = true;
      console.log('✅ [AutumnLeaves] Первое взаимодействие зарегистрировано, музыка разблокирована навсегда!');
    }
    
    if (success) {
      console.log('✅ [AutumnLeaves] Зимняя музыка запущена!');
      
      // Подписываемся на окончание музыки
      const musicElement = soundService.getWinterMusicElement();
      if (musicElement) {
        const onMusicEnded = () => {
          console.log('🎵 [AutumnLeaves] Музыка закончилась, останавливаем снежинки');
          
          // Останавливаем снежинки
          stopContinuousSnowfall();
          
          // Планируем следующий цикл через случайное время: 30, 60 или 90 секунд
          const nextDelays = [30, 60, 90];
          const randomDelay = nextDelays[Math.floor(Math.random() * nextDelays.length)];
          const nextDelay = randomDelay * 1000;
          console.log(`⏰ [AutumnLeaves] Следующий цикл через ${randomDelay} секунд`);
          
          nextCycleTimeoutRef.current = setTimeout(() => {
            // Сбрасываем флаг ПЕРЕД запуском нового цикла
            musicStartedRef.current = false;
            startWinterCycle();
          }, nextDelay);
          
          // Отписываемся от события
          musicElement.removeEventListener('ended', onMusicEnded);
        };
        
        musicElement.addEventListener('ended', onMusicEnded);
      }
    } else {
      console.log('⚠️ [AutumnLeaves] Музыка заблокирована браузером!');
      console.log('💡 [AutumnLeaves] Останавливаем снежинки, ждем клика пользователя...');
      
      // СРАЗУ останавливаем снежинки, так как музыка не играет
      stopContinuousSnowfall();
      
      // НЕ сбрасываем musicStartedRef.current! Оставляем true, чтобы при следующем клике
      // обработчик handleUserInteraction мог попытаться запустить музыку
      
      // Планируем следующую попытку через случайное время: 30, 60 или 90 секунд
      const nextDelays = [30, 60, 90];
      const randomDelay = nextDelays[Math.floor(Math.random() * nextDelays.length)];
      const nextDelay = randomDelay * 1000;
      console.log(`⏰ [AutumnLeaves] Следующая попытка автозапуска через ${randomDelay} секунд`);
      
      nextCycleTimeoutRef.current = setTimeout(() => {
        // Если за это время пользователь не кликнул и музыка не играет, пробуем снова
        if (!soundService.isWinterMusicPlaying()) {
          musicStartedRef.current = false; // Сбрасываем для нового цикла
          startWinterCycle();
        }
      }, nextDelay);
    }
  }, [startContinuousSnowfall, stopContinuousSnowfall, enabled]);

  // Обработчик ручного запуска через клик на елочку
  useEffect(() => {
    if (triggerStart && !musicStartedRef.current) {
      console.log('🎄 [AutumnLeaves] Ручной запуск через елочку');
      
      // Регистрируем взаимодействие пользователя (клик на елочку)
      if (!userInteractedRef.current) {
        userInteractedRef.current = true;
        console.log('🎄 [AutumnLeaves] Взаимодействие через елочку зарегистрировано!');
      }
      
      startWinterCycle();
    }
  }, [triggerStart, startWinterCycle, enabled]);

  // Обработчик взаимодействия пользователя (для autoplay bypass)
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (!enabled) {
        return;
      }
      // Регистрируем взаимодействие пользователя
      if (!userInteractedRef.current) {
        userInteractedRef.current = true;
        console.log('👆 [AutumnLeaves] Взаимодействие пользователя зарегистрировано!');
      }
      
      // Если цикл еще не начался, но снежинки уже должны падать, запускаем цикл
      if (!musicStartedRef.current && snowflakesStartedRef.current) {
        console.log('👆 [AutumnLeaves] Запускаем цикл по клику пользователя');
        startWinterCycle();
        return;
      }
      
      // Если музыка сейчас НЕ играет, но цикл активен, пытаемся запустить музыку
      if (musicStartedRef.current && !soundService.isWinterMusicPlaying()) {
        console.log('👆 [AutumnLeaves] Пытаемся запустить музыку после клика...');
        const success = await soundService.playWinterMusic();
        
        if (success) {
          console.log('✅ [AutumnLeaves] Музыка успешно запущена после клика!');
          
          // Запускаем снежинки (если они не падают)
          startContinuousSnowfall();
          
          // Подписываемся на окончание музыки
          const musicElement = soundService.getWinterMusicElement();
          if (musicElement) {
            const onMusicEnded = () => {
              console.log('🎵 [AutumnLeaves] Музыка закончилась (после ручного запуска)');
              stopContinuousSnowfall();
              
              // Следующий цикл через случайное время: 30, 60 или 90 секунд
              const nextDelays = [30, 60, 90];
              const randomDelay = nextDelays[Math.floor(Math.random() * nextDelays.length)];
              const nextDelay = randomDelay * 1000;
              console.log(`⏰ [AutumnLeaves] Следующий цикл через ${randomDelay} секунд`);
              
              nextCycleTimeoutRef.current = setTimeout(() => {
                // Сбрасываем флаг ПЕРЕД запуском нового цикла
                musicStartedRef.current = false;
                startWinterCycle();
              }, nextDelay);
              
              musicElement.removeEventListener('ended', onMusicEnded);
            };
            
            musicElement.addEventListener('ended', onMusicEnded);
          }
        }
      }
    };

    // Добавляем слушатели на различные события взаимодействия (БЕЗ once: true!)
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, [startWinterCycle, startContinuousSnowfall, stopContinuousSnowfall, enabled]);

  const handleAnimationEnd = useCallback((leafId: number) => {
    setActiveLeaves(prev => {
      const leaf = prev.find(l => l.id === leafId);
      if (leaf && !leaf.shouldStay) {
        return prev.filter(l => l.id !== leafId);
      }
      return prev;
    });
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <div className="autumn-leaves-container">
      {activeLeaves.map((leaf) => (
        <div
          key={leaf.id}
          className="autumn-leaf"
          style={{
            left: `${leaf.left}%`,
            animationDuration: `${leaf.duration}s`,
            transform: `scale(${leaf.scale})`,
            '--wind-strength': leaf.windStrength,
            '--wind-direction': leaf.windDirection,
            '--landing-x': `${leaf.landingX}px`,
            '--landing-y': `${leaf.landingY}vh`,
            '--start-rotation': `${leaf.startRotation}deg`,
            '--end-rotation': `${leaf.endRotation}deg`,
          } as React.CSSProperties}
          onAnimationEnd={() => handleAnimationEnd(leaf.id)}
        >
          <img 
            src={leaf.imageSrc} 
            alt="maple leaf" 
            style={{ width: '38px', height: '38px' }}
          />
        </div>
      ))}
    </div>
  );
};

export default AutumnLeaves;