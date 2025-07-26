import React, { useMemo, useRef, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import styles from './SimpleChart.module.css';
import { InventoryHistoryItem } from '@/types/inventoryTypes';

interface ChartPoint {
  x: number;
  y: number;
  date: Date;
  value: number;
  type: 'raw' | 'semifinished';
  record: InventoryHistoryItem;
}

interface SimpleChartProps {
  history: InventoryHistoryItem[];
  width?: number;
  height?: number;
}

const SimpleChart: React.FC<SimpleChartProps> = ({ 
  history, 
  width = 800, 
  height = 300 
}) => {
  // Рассчитываем оптимальную ширину в зависимости от количества данных
  const calculateOptimalWidth = (dataLength: number, baseWidth: number) => {
    if (dataLength === 0) return baseWidth;
    
    // Адаптивное расстояние между точками в зависимости от размера экрана
    const isMobileDevice = baseWidth < 480;
    const isTabletDevice = baseWidth < 768;
    
         let minPointDistance: number;
     if (isMobileDevice) {
       minPointDistance = 40; // Нормальное значение для мобильных
     } else if (isTabletDevice) {
       minPointDistance = 50; // Нормальное значение для планшетов
     } else {
       minPointDistance = 70; // Нормальное значение для десктопа
     }
     
     // Отступы по краям
     const margins = 120;
     
     // Рассчитанная ширина на основе количества точек
     const calculatedWidth = dataLength * minPointDistance + margins;
     
     // ВОЗВРАЩАЕМ принудительное увеличение для гарантированного скролла
     const forcedMinWidth = baseWidth + 400; // Добавляем 400px для гарантированного скролла
    
     // Минимальная ширина равна базовой ширине
     // Максимальная ширина ограничена для разумного скролла
     const maxWidth = isMobileDevice ? baseWidth * 4 : baseWidth * 6;
     
     const finalWidth = Math.min(Math.max(Math.max(baseWidth, calculatedWidth), forcedMinWidth), maxWidth);
    
    return finalWidth;
  };
  
  const optimalWidth = calculateOptimalWidth(history?.length || 0, width);
  
  // Определяем тип экрана один раз (но используем базовую ширину для определения)
  const isMobile = width < 480;
  const isTablet = width < 768;
  
     // Компонент готов к рендеру с оптимальной шириной
  
  // Ref для контейнера графика для горизонтального скролла
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Состояние для отслеживания прогресса скролла
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Состояние для отслеживания, находится ли курсор над графиком
  const [isHoveringChart, setIsHoveringChart] = useState(false);
  
     // Состояние наведения инициализировано

  // Обработка горизонтального скролла через вертикальное колесико мыши
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    
         const handleWheel = (e: WheelEvent) => {
       // Проверяем, что график шире контейнера (есть горизонтальный скролл)
       if (optimalWidth <= width) return;
       
       // Проверяем, что это именно вертикальное движение колесика
       if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
       
       // Проверяем, что курсор действительно над контейнером
       const rect = container.getBoundingClientRect();
       const isOverContainer = 
         e.clientX >= rect.left && 
         e.clientX <= rect.right && 
         e.clientY >= rect.top && 
         e.clientY <= rect.bottom;
       
       if (!isOverContainer) return;
       
       // Агрессивно предотвращаем стандартную прокрутку
       e.preventDefault();
       e.stopPropagation();
       e.stopImmediatePropagation();
       
               // Преобразуем вертикальное движение колесика в горизонтальное
        // Увеличиваем скорость скролла в 5 раза
        const multiplier = e.shiftKey ? 10 : 5;
        const scrollAmount = e.deltaY * multiplier;
       
       // Получаем текущую позицию и максимальную позицию скролла
       const currentScrollLeft = container.scrollLeft;
       const maxScrollLeft = container.scrollWidth - container.clientWidth;
       
       // Рассчитываем новую позицию с ограничениями
       const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentScrollLeft + scrollAmount));
       
       // Напрямую устанавливаем scrollLeft для отзывчивого скролла
       container.scrollLeft = newScrollLeft;
       return false;
     };
    
    // Добавляем обработчики для разных типов событий колесика
    const wheelOptions = { passive: false, capture: true };
    
         // Обработчик для старых браузеров/событий
     const handleLegacyWheel = (e: any) => {
       if (optimalWidth <= width) return;
       
       let deltaY = 0;
       if (e.wheelDelta) {
         deltaY = -e.wheelDelta / 120;
       } else if (e.detail) {
         deltaY = e.detail / 3;
       }
       
       if (Math.abs(deltaY) > 0) {
         // Проверяем, что курсор действительно над контейнером
         const rect = container.getBoundingClientRect();
         const isOverContainer = 
           e.clientX >= rect.left && 
           e.clientX <= rect.right && 
           e.clientY >= rect.top && 
           e.clientY <= rect.bottom;
         
         if (!isOverContainer) return;
         
         e.preventDefault();
         e.stopPropagation();
         e.stopImmediatePropagation();
         
         const multiplier = e.shiftKey ? 2 : 1;
         const scrollAmount = deltaY * 30 * multiplier;
         
         const currentScrollLeft = container.scrollLeft;
         const maxScrollLeft = container.scrollWidth - container.clientWidth;
         const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentScrollLeft + scrollAmount));
         
         container.scrollLeft = newScrollLeft;
         return false;
       }
     };
    
    // Обработчики для сенсорных устройств
    let touchStartX = 0;
    let touchStartScrollLeft = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (optimalWidth <= width) return;
      touchStartX = e.touches[0].clientX;
      touchStartScrollLeft = container.scrollLeft;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (optimalWidth <= width) return;
      
      const touchX = e.touches[0].clientX;
      const diffX = touchStartX - touchX;
      
      // Проверяем, что это горизонтальное движение
      if (Math.abs(diffX) > 10) {
        e.preventDefault();
        e.stopPropagation();
        
        const newScrollLeft = touchStartScrollLeft + diffX;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft));
             }
     };
     
                  // Обработчики для отслеживания наведения курсора
       const handleMouseEnter = () => setIsHoveringChart(true);
       const handleMouseLeave = () => setIsHoveringChart(false);
      
             // Глобальный обработчик для window - для более надежного перехвата
       const handleGlobalWheel = (e: WheelEvent) => {
         if (!isHoveringChart || optimalWidth <= width) return;
         
         // Проверяем, что это вертикальное движение
         if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
         
         // Проверяем, что событие происходит над нашим контейнером
         const rect = container.getBoundingClientRect();
         const isOverContainer = 
           e.clientX >= rect.left && 
           e.clientX <= rect.right && 
           e.clientY >= rect.top && 
           e.clientY <= rect.bottom;
         
         if (isOverContainer) {
           e.preventDefault();
           e.stopPropagation();
           e.stopImmediatePropagation();
           
           const multiplier = e.shiftKey ? 2 : 1;
           const scrollAmount = e.deltaY * multiplier;
           
           const currentScrollLeft = container.scrollLeft;
           const maxScrollLeft = container.scrollWidth - container.clientWidth;
           const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentScrollLeft + scrollAmount));
           
           container.scrollLeft = newScrollLeft;
           return false;
         }
       };
     
                  // Регистрируем все обработчики
       container.addEventListener('wheel', handleWheel, wheelOptions);
       container.addEventListener('mousewheel', handleLegacyWheel, wheelOptions);
       container.addEventListener('DOMMouseScroll', handleLegacyWheel, wheelOptions);
       container.addEventListener('touchstart', handleTouchStart, { passive: false });
       container.addEventListener('touchmove', handleTouchMove, { passive: false });
       container.addEventListener('mouseenter', handleMouseEnter);
       container.addEventListener('mouseleave', handleMouseLeave);
       
       // Глобальный обработчик на window
       window.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true });
     
                  // Убираем обработчики при размонтировании
       return () => {
         container.removeEventListener('wheel', handleWheel, wheelOptions);
         container.removeEventListener('mousewheel', handleLegacyWheel, wheelOptions);
         container.removeEventListener('DOMMouseScroll', handleLegacyWheel, wheelOptions);
         container.removeEventListener('touchstart', handleTouchStart);
         container.removeEventListener('touchmove', handleTouchMove);
         container.removeEventListener('mouseenter', handleMouseEnter);
         container.removeEventListener('mouseleave', handleMouseLeave);
         window.removeEventListener('wheel', handleGlobalWheel, { capture: true } as any);
       };
   }, [optimalWidth, width, isHoveringChart]);

  // Отслеживание прогресса скролла
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateScrollProgress = () => {
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const maxScroll = scrollWidth - clientWidth;
      
      if (maxScroll > 0) {
        const progress = (scrollLeft / maxScroll) * 100;
        setScrollProgress(Math.round(progress));
      } else {
        setScrollProgress(0);
      }
    };

    // Изначальный расчет
    updateScrollProgress();

    // Добавляем обработчик скролла
    container.addEventListener('scroll', updateScrollProgress);

    // Убираем обработчик при размонтировании
    return () => {
      container.removeEventListener('scroll', updateScrollProgress);
    };
  }, [optimalWidth]);

  // Поддержка клавиатурных сокращений для навигации
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || optimalWidth <= width) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Проверяем, что фокус в контейнере графика
      if (!container.contains(document.activeElement)) return;

      const scrollAmount = e.shiftKey ? 100 : 50;
      let newScrollLeft = container.scrollLeft;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          newScrollLeft = Math.max(0, container.scrollLeft - scrollAmount);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newScrollLeft = Math.min(
            container.scrollWidth - container.clientWidth,
            container.scrollLeft + scrollAmount
          );
          break;
        case 'Home':
          e.preventDefault();
          newScrollLeft = 0;
          break;
        case 'End':
          e.preventDefault();
          newScrollLeft = container.scrollWidth - container.clientWidth;
          break;
        default:
          return;
      }

      container.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    };

    // Делаем контейнер фокусируемым
    container.tabIndex = 0;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'График аналитики товара');

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [optimalWidth, width]);
  
  const { points, maxValue, minDate, maxDate, anomalies } = useMemo(() => {
    if (!history || history.length === 0) {
      return { points: [], maxValue: 0, minDate: new Date(), maxDate: new Date(), anomalies: [] };
    }

    // Сортируем по времени
    const sortedHistory = [...history].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const minDate = new Date(sortedHistory[0].timestamp);
    const maxDate = new Date(sortedHistory[sortedHistory.length - 1].timestamp);
    const timeRange = maxDate.getTime() - minDate.getTime();
    
    const values = sortedHistory.map(h => h.new_quantity || 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    
    // Если все значения одинаковые, добавляем небольшой отступ для визуализации
    let valueRange = maxValue - minValue;
    if (valueRange === 0) {
      valueRange = Math.max(1, maxValue * 0.1); // 10% от значения или минимум 1
    }

    // Создаем точки для графика с равномерным распределением
    const points: ChartPoint[] = sortedHistory.map((record, index) => {
      const date = new Date(record.timestamp);
      
      // Равномерное распределение точек независимо от реального времени между ними
      const positionPercent = sortedHistory.length > 1 ? index / (sortedHistory.length - 1) : 0;
      
      // ИСПРАВЛЯЕМ: правильные скобки для вычисления
      const valuePercent = ((record.new_quantity || 0) - minValue) / valueRange;
      
             return {
         x: 60 + positionPercent * (optimalWidth - 120), // равномерное распределение
         y: height - 40 - valuePercent * (height - 80), // отступы сверху и снизу (больше значение = выше точка)
         date,
         value: record.new_quantity || 0,
         type: record.type,
         record
       };
    });

    // Детектируем аномалии (большие изменения)
    const anomalies = points.filter((point, index) => {
      if (index === 0) return false;
      const prevPoint = points[index - 1];
      const change = Math.abs(point.value - prevPoint.value);
      const changePercent = prevPoint.value > 0 ? (change / prevPoint.value) * 100 : 0;
      return changePercent > 50; // Считаем аномалией изменение >50%
    });

    return { points, maxValue, minDate, maxDate, anomalies };
  }, [history, optimalWidth, height]);

  // Группируем точки по типу
  const rawPoints = points.filter(p => p.type === 'raw');
  const semifinishedPoints = points.filter(p => p.type === 'semifinished');

  // Создаем SVG path для линии
  const createPath = (points: ChartPoint[]) => {
    if (points.length === 0) return '';
    return points.reduce((path, point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${path} ${command} ${point.x} ${point.y}`;
    }, '');
  };

  // Создаем SVG path для области под линией
  const createAreaPath = (points: ChartPoint[]) => {
    if (points.length === 0) return '';
    const lineHeight = height - 40;
    let path = `M ${points[0].x} ${lineHeight}`;
    
    points.forEach(point => {
      path += ` L ${point.x} ${point.y}`;
    });
    
    path += ` L ${points[points.length - 1].x} ${lineHeight} Z`;
    return path;
  };

  // Временные метки для оси X - показываем метку для каждой точки
  const timeLabels = useMemo(() => {
    if (points.length === 0) return [];
    
    const firstDate = points[0].date;
    const lastDate = points[points.length - 1].date;
    const timeDiff = lastDate.getTime() - firstDate.getTime();
    
    // Определяем оптимальный формат даты в зависимости от временного диапазона
    let dateFormat: string;
    
    if (timeDiff <= 24 * 60 * 60 * 1000) {
      // Менее суток - показываем время
      dateFormat = 'HH:mm';
    } else if (timeDiff <= 7 * 24 * 60 * 60 * 1000) {
      // Менее недели - показываем день и время
      dateFormat = isMobile ? 'dd.MM' : 'dd.MM HH:mm';
    } else if (timeDiff <= 30 * 24 * 60 * 60 * 1000) {
      // Менее месяца - показываем только дату
      dateFormat = 'dd.MM';
    } else {
      // Больше месяца - показываем месяц и год
      dateFormat = isMobile ? 'MMM' : 'MMM yyyy';
    }
    
    // Создаем метку для каждой точки данных
    const labels = points.map(point => ({
      x: point.x,
      text: format(point.date, dateFormat, { locale: ru })
    }));
    
    return labels;
  }, [points, isMobile, isTablet]);

  // Метки для оси Y
  const valueLabels = useMemo(() => {
    if (points.length === 0) return [];
    
    const labels = [];
    const labelCount = 5;
    const minValue = Math.min(...points.map(p => p.value));
    const maxValue = Math.max(...points.map(p => p.value));
    
    console.log('🔢 [Y AXIS] Значения для оси Y:', {
      pointsLength: points.length,
      minValue,
      maxValue,
      labelCount
    });
    
    for (let i = 0; i < labelCount; i++) {
      // Вычисляем значение от минимального до максимального
      const value = Math.round(minValue + ((maxValue - minValue) * i) / (labelCount - 1));
      const y = height - 40 - (i * (height - 80)) / (labelCount - 1);
      labels.push({ y, value });
    }
    
    console.log('📊 [Y AXIS] Сгенерированные метки:', labels);
    return labels;
  }, [points, height]);

  if (points.length === 0) {
    return (
      <div className={styles.noData}>
        <p>📈 Данных для графика пока нет</p>
        <p>История появится после изменений товара</p>
      </div>
    );
  }

  return (
    <div ref={chartContainerRef} className={styles.chartContainer}>
      {/* Индикатор скролла - показываем только если график шире контейнера */}
      {optimalWidth > width && (
        <div 
          className={styles.scrollIndicator}
          style={{ '--scroll-progress': `${scrollProgress}%` } as React.CSSProperties}
        >
          <span>📊 {isMobile ? 'Смахните' : 'Колесико • ← →'}</span>
          <div className={styles.scrollProgress}></div>
        </div>
      )}
      
      <svg width={optimalWidth} height={height} className={styles.svg}>
        {/* Градиенты и паттерны */}
        <defs>
          {/* Сетка */}
          <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 30" fill="none" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.2"/>
          </pattern>
          
          {/* Градиент для линии сырья */}
          <linearGradient id="rawGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0.05"/>
          </linearGradient>
          
          {/* Градиент для линии полуфабриката */}
          <linearGradient id="semifinishedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--success-color)" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="var(--success-color)" stopOpacity="0.05"/>
          </linearGradient>
        </defs>
        
        <rect width={optimalWidth} height={height} fill="url(#grid)" />

        {/* Оси */}
        <line x1="60" y1={height - 40} x2={optimalWidth - 60} y2={height - 40} 
              stroke="var(--border-color)" strokeWidth="2" />
        <line x1="60" y1="40" x2="60" y2={height - 40} 
              stroke="var(--border-color)" strokeWidth="2" />

        {/* Метки оси Y */}
        {valueLabels.map((label, index) => (
          <g key={index}>
            <line x1="55" y1={label.y} x2="65" y2={label.y} 
                  stroke="var(--text-secondary)" strokeWidth="1" />
            <text 
              x="50" 
              y={label.y + 4} 
              className={styles.axisLabel} 
              textAnchor="end"
              fill="var(--text-primary)"
              fontSize="12"
              fontWeight="500"
            >
              {label.value}
            </text>
          </g>
        ))}

        {/* Метки оси X */}
        {timeLabels.map((label, index) => {
          return (
            <g key={index}>
              <line x1={label.x} y1={height - 45} x2={label.x} y2={height - 35} 
                    stroke="var(--text-secondary)" strokeWidth="1" />
              <text 
                x={label.x} 
                y={height - (isMobile ? 12 : isTablet ? 15 : 20)} 
                className={styles.axisLabel} 
                textAnchor={isMobile || isTablet ? "end" : "middle"}
                transform={isMobile || isTablet ? `rotate(-45, ${label.x}, ${height - (isMobile ? 12 : 15)})` : undefined}
              >
                {label.text}
              </text>
            </g>
          );
        })}

        {/* Область под графиком сырья */}
        {rawPoints.length > 0 && (
          <motion.path
            d={createAreaPath(rawPoints)}
            fill="url(#rawGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: "easeInOut", delay: 0.5 }}
          />
        )}

        {/* Область под графиком полуфабриката */}
        {semifinishedPoints.length > 0 && (
          <motion.path
            d={createAreaPath(semifinishedPoints)}
            fill="url(#semifinishedGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: "easeInOut", delay: 0.7 }}
          />
        )}

        {/* Линия для сырья */}
        {rawPoints.length > 0 && (
          <motion.path
            d={createPath(rawPoints)}
            stroke="var(--primary-color)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        )}

        {/* Линия для полуфабриката */}
        {semifinishedPoints.length > 0 && (
          <motion.path
            d={createPath(semifinishedPoints)}
            stroke="var(--success-color)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5,5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
          />
        )}

        {/* Точки на графике */}
        {points.map((point, index) => {
          // Умное позиционирование тултипа
          const tooltipWidth = 180;
          const tooltipHeight = 60;
          let tooltipX = point.x - tooltipWidth / 2;
          let tooltipY = point.y - tooltipHeight - 10;
          
                     // Корректируем позицию, чтобы тултип не выходил за границы
           if (tooltipX < 10) tooltipX = 10;
           if (tooltipX + tooltipWidth > optimalWidth - 10) tooltipX = optimalWidth - tooltipWidth - 10;
           if (tooltipY < 10) tooltipY = point.y + 20; // Показываем снизу, если сверху нет места
          
                     // Адаптивный формат даты для тултипа
           const firstDate = points[0].date;
           const lastDate = points[points.length - 1].date;
           const timeDiff = lastDate.getTime() - firstDate.getTime();
           
           let tooltipDateFormat: string;
           if (timeDiff <= 24 * 60 * 60 * 1000) {
             tooltipDateFormat = isMobile ? 'dd.MM HH:mm' : 'dd.MM.yyyy HH:mm:ss';
           } else if (timeDiff <= 7 * 24 * 60 * 60 * 1000) {
             tooltipDateFormat = isMobile ? 'dd.MM HH:mm' : 'dd.MM.yyyy HH:mm';
           } else {
             tooltipDateFormat = 'dd.MM.yyyy';
           }
          
          return (
            <motion.g key={index}>
              {/* Внешнее кольцо для лучшего визуального эффекта */}
              <motion.circle
                cx={point.x}
                cy={point.y}
                r="10"
                fill={point.type === 'raw' ? 'var(--primary-color)' : 'var(--success-color)'}
                opacity="0.2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              />
              
              {/* Основная точка */}
              <motion.circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill={point.type === 'raw' ? 'var(--primary-color)' : 'var(--success-color)'}
                stroke="white"
                strokeWidth="2"
                className={styles.dataPoint}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              />
              
              {/* Tooltip при наведении */}
              <motion.g className={styles.tooltip} opacity="0">
                <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} 
                      rx="8" fill="var(--card-background)" stroke="var(--border-color)"
                      filter="drop-shadow(0 4px 12px rgba(0,0,0,0.15))" />
                
                {/* Стрелочка указывающая на точку */}
                <polygon 
                  points={`${point.x-5},${tooltipY + tooltipHeight} ${point.x},${tooltipY + tooltipHeight + 5} ${point.x+5},${tooltipY + tooltipHeight}`}
                  fill="var(--card-background)" 
                  stroke="var(--border-color)"
                  style={{ display: tooltipY < point.y ? 'block' : 'none' }}
                />
                
                <text x={tooltipX + tooltipWidth/2} y={tooltipY + 20} textAnchor="middle" 
                      className={styles.tooltipText}>
                  📦 {point.value} шт.
                </text>
                <text x={tooltipX + tooltipWidth/2} y={tooltipY + 35} textAnchor="middle" 
                      className={styles.tooltipDate}>
                  🕒 {format(point.date, tooltipDateFormat, { locale: ru })}
                </text>
                <text x={tooltipX + tooltipWidth/2} y={tooltipY + 50} textAnchor="middle" 
                      className={styles.tooltipType}>
                  {point.type === 'raw' ? '🥬 Сырье' : '🍽️ Полуфабрикат'}
                </text>
              </motion.g>
            </motion.g>
          );
        })}

        {/* Выделяем аномалии */}
        {anomalies.map((anomaly, index) => (
          <motion.circle
            key={`anomaly-${index}`}
            cx={anomaly.x}
            cy={anomaly.y}
            r="12"
            fill="none"
            stroke="var(--warning-color)"
            strokeWidth="2"
            strokeDasharray="3,3"
            className={styles.anomaly}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 2 }}
          />
        ))}

        {/* Легенда */}
        <g className={styles.legend}>
          {rawPoints.length > 0 && (
            <g>
              <circle cx="80" cy="25" r="4" fill="var(--primary-color)" />
              <text x="90" y="29" className={styles.legendText}>Сырье</text>
            </g>
          )}
          {semifinishedPoints.length > 0 && (
            <g>
              <circle cx="150" cy="25" r="4" fill="var(--success-color)" />
              <text x="160" y="29" className={styles.legendText}>Полуфабрикат</text>
            </g>
          )}
          {anomalies.length > 0 && (
            <g>
              <circle cx="250" cy="25" r="4" fill="none" stroke="var(--warning-color)" strokeWidth="2" />
              <text x="260" y="29" className={styles.legendText}>⚠️ Аномалии</text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

export default SimpleChart; 