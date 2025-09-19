import React, { useEffect, useState, useCallback, useRef } from 'react';
import './AutumnLeaves.css';

const AutumnLeaves: React.FC = () => {
  // Массив с путями к изображениям кленовых листьев
  const leafImages = [
    '/maple-leaf_12092303.png',
    '/maple-leaf_12114293.png',
    '/leaf_12224039.png'
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
  }>>([]);

  const nextLeafIdRef = useRef(0);
  const isInitializedRef = useRef(false);

  const createLeaf = useCallback((id: number) => {
    return {
      id: id,
      left: Math.random() * 100,
      duration: 8 + Math.random() * 8,
      imageSrc: leafImages[Math.floor(Math.random() * leafImages.length)], // Случайный выбор изображения
      windStrength: 1 + Math.random() * 2,
      scale: 0.8 + Math.random() * 0.6, // Увеличенный размер от 0.8 до 1.4
      windDirection: Math.random() < 0.5 ? -1 : 1,
      landingX: (Math.random() - 0.5) * 200, // Случайное смещение по X от -100px до +100px
      landingY: 20 + Math.random() * 70, // Случайная высота приземления от 20vh до 90vh (весь экран)
    };
  }, [leafImages]);

  const addLeavesToQueue = useCallback(() => {
    setActiveLeaves(prev => {
      
      // Убрали ограничение - теперь листочки могут накапливаться бесконечно!
      
      // Случайное количество листочков от 1 до 3 (не больше 3 за раз)
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
      }> = [];
      
      for (let i = 0; i < leafCount; i++) {
        const currentId = nextLeafIdRef.current + i;
        newLeaves.push(createLeaf(currentId));
      }
      nextLeafIdRef.current += leafCount;
      
      const updated = [...prev, ...newLeaves];
      
      return updated;
    });
    
    // Планируем следующий раунд через случайное время: 10, 20 или 30 секунд
    const delays = [30, 60, 90];
    const nextDelay = delays[Math.floor(Math.random() * delays.length)] * 1000;
    setTimeout(addLeavesToQueue, nextDelay);
  }, [createLeaf]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    
    const initialDelay = 25 * 1000;
    setTimeout(() => {
      addLeavesToQueue();
    }, initialDelay);
  }, [addLeavesToQueue]);

  // Обработчик завершения анимации падения
  const handleAnimationEnd = useCallback((leafId: number) => {
    // Листочки больше не исчезают - накапливаем их для наблюдения!
    console.log(`🍁 Листочек ${leafId} приземлился! Всего листочков: ${activeLeaves.length + 1}`);
  }, [activeLeaves.length]);

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