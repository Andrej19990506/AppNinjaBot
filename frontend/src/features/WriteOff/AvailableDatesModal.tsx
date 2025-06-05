import React, { useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import styles from '@/features/WriteOff/AvailableDatesModal.module.css';

interface AvailableDatesModalProps {
  availableDates: string[];
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  isVisible: boolean;
}

const AvailableDatesModal: React.FC<AvailableDatesModalProps> = ({
  availableDates,
  onSelectDate,
  onClose,
  isVisible
}) => {
  // Группируем даты по месяцам для более удобного представления
  const groupedDates = useMemo(() => {
    const groups: Record<string, string[]> = {};
    
    // Сортируем даты в обратном порядке (от новых к старым)
    const sortedDates = [...availableDates].sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
    
    sortedDates.forEach(dateStr => {
      const date = new Date(dateStr);
      const monthKey = format(date, 'MMMM yyyy', { locale: ru });
      
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      
      groups[monthKey].push(dateStr);
    });
    
    return groups;
  }, [availableDates]);
  
  // Обработчик выбора даты
  const handleSelectDate = useCallback((dateStr: string) => {
    onSelectDate(new Date(dateStr));
    onClose();
  }, [onSelectDate, onClose]);
  
  // Если модальное окно не видимо, ничего не отображаем
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Выберите дату</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        
        <div className={styles.datesList}>
          {Object.keys(groupedDates).length > 0 ? (
            Object.entries(groupedDates).map(([month, dates]) => (
              <div key={month} className={styles.monthGroup}>
                <h3 className={styles.monthTitle}>{month}</h3>
                <div className={styles.datesGrid}>
                  {dates.map(dateStr => {
                    const date = new Date(dateStr);
                    return (
                      <button
                        key={dateStr}
                        className={styles.dateButton}
                        onClick={() => handleSelectDate(dateStr)}
                      >
                        {format(date, 'd', { locale: ru })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>Нет доступных дат со списаниями</p>
              <p className={styles.helpText}>Создайте новое списание на текущую дату, чтобы она появилась в списке</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvailableDatesModal; 