// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { format, addDays, subDays } from 'date-fns';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import isToday from 'date-fns/isToday';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import isYesterday from 'date-fns/isYesterday';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import isSameDay from 'date-fns/isSameDay';
import parseISO from 'date-fns/parseISO';
import { ru } from 'date-fns/locale';
import styles from './DateSelector.module.css';

interface DateSelectorProps {
  onDateChange: (date: Date) => void;
  initialDate?: Date;
  disableFutureDates?: boolean;
  availableDates?: string[]; // Массив доступных дат в формате YYYY-MM-DD
  showCalendarButton?: boolean; // Показывать ли кнопку календаря
  onCalendarButtonClick?: () => void; // Обработчик нажатия на кнопку календаря
}

const DateSelector: React.FC<DateSelectorProps> = ({ 
  onDateChange, 
  initialDate = new Date(), 
  disableFutureDates = true,
  availableDates = [],
  showCalendarButton = false,
  onCalendarButtonClick = () => {}
}) => {
  // Состояние для выбранной даты
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  // Ref для отслеживания, был ли уже выполнен начальный выбор даты
  const initialSelectionMade = useRef(false);
  // Ref для хранения последней выбранной даты для сравнения
  const lastSelectedDateRef = useRef<string>('');
  
  // Преобразуем строковые даты в объекты Date для сравнения
  const formattedAvailableDates = availableDates
    .map(dateStr => {
      // Обрабатываем разные форматы дат
      try {
        // Если дата в ISO формате с временем и часовым поясом
        if (dateStr.includes('T')) {
          const date = new Date(dateStr);
          return date.toISOString().split('T')[0]; // Берем только часть YYYY-MM-DD
        }
        
        // Если просто строка YYYY-MM-DD
        return dateStr.split('T')[0];
      } catch (error) {
        console.error('Ошибка обработки даты:', dateStr, error);
        return '';
      }
    })
    .filter(dateStr => dateStr !== ''); // Убираем пустые строки

  console.log('DateSelector: Available dates:', formattedAvailableDates);

  // Преобразуем initialDate в строку YYYY-MM-DD для сравнения
  const initialDateStr = initialDate ? format(initialDate, 'yyyy-MM-dd') : '';
  console.log('DateSelector: Initial date:', initialDateStr);

  // Проверяем, есть ли доступные даты
  const hasAvailableDates = formattedAvailableDates.length > 0;

  // Если у нас есть доступные даты, проверяем, что текущая выбранная дата находится в списке
  useEffect(() => {
    if (hasAvailableDates && initialDate) {
      const initialDateStr = format(initialDate, 'yyyy-MM-dd');
      console.log('DateSelector: Checking if date exists:', initialDateStr, 'in', formattedAvailableDates);
      
      // Если выбранная дата не в списке доступных, находим ближайшую доступную
      if (!formattedAvailableDates.includes(initialDateStr)) {
        console.log('DateSelector: Date not found in available dates');
        
        // Находим ближайшую доступную дату - преобразуем строки в объекты Date
        const datesToCompare = formattedAvailableDates
          .map(dateStr => new Date(dateStr))
          .filter(date => !isNaN(date.getTime())); // Отфильтровываем некорректные даты
        
        if (datesToCompare.length > 0) {
          // Сортируем по близости к выбранной дате
          datesToCompare.sort((a, b) => 
            Math.abs(a.getTime() - initialDate.getTime()) - 
            Math.abs(b.getTime() - initialDate.getTime())
          );
          
          const closestDate = datesToCompare[0];
          console.log('DateSelector: Selected date not available, switching to closest available date:', format(closestDate, 'yyyy-MM-dd'));
          setSelectedDate(closestDate);
          
          // Создаем ключ для проверки, вызывали ли мы уже onDateChange для этой даты
          const dateChangeKey = `dateSelector_${format(closestDate, 'yyyy-MM-dd')}`;
          const hasChangedDate = sessionStorage.getItem(dateChangeKey);
          
          if (!hasChangedDate) {
            // Устанавливаем флаг, чтобы не вызывать onDateChange повторно для этой даты
            sessionStorage.setItem(dateChangeKey, 'true');
            onDateChange(closestDate);
          } else {
            console.log('DateSelector: Already called onDateChange for this date, skipping callback');
          }
        } else {
          console.log('DateSelector: No valid dates in availableDates, keeping initial date');
        }
      } else {
        console.log('DateSelector: Date found in available dates');
      }
    }
  }, [hasAvailableDates, formattedAvailableDates, initialDate, onDateChange]);
  
  // Проверка, является ли дата сегодняшней или будущей
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isDisabledNext = disableFutureDates && isToday(selectedDate);
  
  // Проверяем, доступна ли предыдущая дата
  const isPrevAvailable = hasAvailableDates ? 
    // Если у нас есть список доступных дат, проверяем наличие более ранних дат
    formattedAvailableDates.some(dateStr => {
      const date = new Date(dateStr);
      return date < selectedDate;
    }) : 
    // Если нет списка доступных дат, всегда разрешаем навигацию назад
    true;

  // Проверяем, доступна ли следующая дата
  const isNextAvailable = !isDisabledNext && (hasAvailableDates ? 
    // Если у нас есть список доступных дат, проверяем наличие более поздних дат
    formattedAvailableDates.some(dateStr => {
      const date = new Date(dateStr);
      return date > selectedDate;
    }) : 
    // Если нет списка доступных дат, всегда разрешаем навигацию вперёд
    true);
  
  // Форматирование даты для отображения
  const formatDateDisplay = useCallback((date: Date): string => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    if (isToday(date)) {
      return 'Сегодня';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } else if (isYesterday(date)) {
      return 'Вчера';
    } else {
      return format(date, 'd MMMM yyyy', { locale: ru });
    }
  }, []);
  
  // Получение ближайшей предыдущей доступной даты
  const getPrevAvailableDate = useCallback((): Date => {
    if (!hasAvailableDates) {
      return addDays(selectedDate, -1);
    }
    
    // Находим ближайшую предыдущую доступную дату
    const prevDates = formattedAvailableDates
      .filter(dateStr => new Date(dateStr) < selectedDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    if (prevDates.length > 0) {
      return new Date(prevDates[0]);
    }
    
    return selectedDate; // Если нет предыдущих дат, остаемся на текущей
  }, [selectedDate, formattedAvailableDates, hasAvailableDates]);
  
  // Получение ближайшей следующей доступной даты
  const getNextAvailableDate = useCallback((): Date => {
    if (isDisabledNext) return selectedDate;
    
    if (!hasAvailableDates) {
      return addDays(selectedDate, 1);
    }
    
    // Находим ближайшую следующую доступную дату
    const nextDates = formattedAvailableDates
      .filter(dateStr => new Date(dateStr) > selectedDate)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    if (nextDates.length > 0) {
      return new Date(nextDates[0]);
    }
    
    return selectedDate; // Если нет следующих дат, остаемся на текущей
  }, [selectedDate, formattedAvailableDates, hasAvailableDates, isDisabledNext]);
  
  // Обработчики для кнопок навигации
  const handlePrevDay = useCallback(() => {
    if (!isPrevAvailable) return;
    
    const newDate = getPrevAvailableDate();
    const newDateStr = format(newDate, 'yyyy-MM-dd');
    
    // Проверяем, не выбрана ли уже эта дата
    if (lastSelectedDateRef.current !== newDateStr) {
      lastSelectedDateRef.current = newDateStr;
      setSelectedDate(newDate);
      onDateChange(newDate);
    } else {
      console.log('DateSelector: Already selected this date, skipping update');
    }
  }, [selectedDate, onDateChange, isPrevAvailable, getPrevAvailableDate]);
  
  const handleNextDay = useCallback(() => {
    if (!isNextAvailable) return;
    
    const newDate = getNextAvailableDate();
    const newDateStr = format(newDate, 'yyyy-MM-dd');
    
    // Проверяем, не выбрана ли уже эта дата
    if (lastSelectedDateRef.current !== newDateStr) {
      lastSelectedDateRef.current = newDateStr;
      setSelectedDate(newDate);
      onDateChange(newDate);
    } else {
      console.log('DateSelector: Already selected this date, skipping update');
    }
  }, [selectedDate, onDateChange, isNextAvailable, getNextAvailableDate]);
  
  // Обработчик для нажатия на кнопку календаря
  const handleCalendarClick = useCallback(() => {
    onCalendarButtonClick();
  }, [onCalendarButtonClick]);
  
  // Эффект для синхронизации при изменении initialDate извне
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    if (initialDate && !isSameDay(initialDate, selectedDate)) {
      console.log('DateSelector: Initial date changed, updating selected date');
      
      // Если есть доступные даты, проверяем, что новая дата в их числе
      if (hasAvailableDates) {
        const initialDateStr = format(initialDate, 'yyyy-MM-dd');
        
        if (formattedAvailableDates.includes(initialDateStr)) {
          console.log('DateSelector: Date exists in available dates');
          setSelectedDate(initialDate);
          // Не вызываем onDateChange здесь, так как этот эффект 
          // реагирует на изменение initialDate извне
        } else {
          console.log('DateSelector: Date not found in available dates');
          
          // Проверяем, не обрабатывали ли мы уже эту дату
          if (formattedAvailableDates.length > 0) {
            // Найдем ближайшую доступную дату к initialDate
            const datesToCompare = formattedAvailableDates.map(d => new Date(d));
            
            // Сортируем по близости к выбранной дате
            datesToCompare.sort((a, b) => 
              Math.abs(a.getTime() - initialDate.getTime()) - 
              Math.abs(b.getTime() - initialDate.getTime())
            );
            
            const closestDate = datesToCompare[0];
            // Проверяем, не выбрали ли мы уже ближайшую дату
            if (!isSameDay(closestDate, selectedDate)) {
              console.log('DateSelector: Selected date not available, switching to closest available date:', format(closestDate, 'yyyy-MM-dd'));
              setSelectedDate(closestDate);
              
              // Создаем ключ для проверки, вызывали ли мы уже onDateChange для этой даты
              const dateChangeKey = `dateSelector_${format(closestDate, 'yyyy-MM-dd')}`;
              const hasChangedDate = sessionStorage.getItem(dateChangeKey);
              
              if (!hasChangedDate) {
                // Устанавливаем флаг, чтобы не вызывать onDateChange повторно для этой даты
                sessionStorage.setItem(dateChangeKey, 'true');
                onDateChange(closestDate);
              } else {
                console.log('DateSelector: Already called onDateChange for this date, skipping callback');
              }
            } else {
              console.log('DateSelector: Already using closest available date, no change needed');
            }
          }
        }
      } else {
        console.log('DateSelector: No available dates restriction, updating to new date');
        setSelectedDate(initialDate);
        // Не вызываем onDateChange, так как эффект реагирует на initialDate
      }
    }
  }, [initialDate, selectedDate, hasAvailableDates, formattedAvailableDates, onDateChange]);
  
  return (
    <div className={styles.dateSelector}>
      <div className={`${styles.navigationButton} ${!isPrevAvailable ? styles.disabled : ''}`}
        onClick={isPrevAvailable ? handlePrevDay : undefined}
        aria-label="Предыдущий день"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </div>
      
      <div className={styles.dateDisplayContainer}>
        <div className={styles.dateDisplay}>
          {formatDateDisplay(selectedDate)}
        </div>
        
        {showCalendarButton && (
          <div 
            className={styles.calendarButton}
            onClick={handleCalendarClick}
            aria-label="Выбрать дату"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
            </svg>
          </div>
        )}
      </div>
      
      <div
        className={`${styles.navigationButton} ${!isNextAvailable ? styles.disabled : ''}`}
        onClick={isNextAvailable ? handleNextDay : undefined}
        aria-label="Следующий день"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </div>
    </div>
  );
};

export default DateSelector; 