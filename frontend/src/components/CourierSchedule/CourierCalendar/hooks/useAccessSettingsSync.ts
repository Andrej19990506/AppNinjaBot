import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../store';
import { AccessSettings } from '../../../../store/slices/shiftsSlice';

/**
 * Хук для синхронизации настроек доступа с календарем
 * 
 * @param refreshCalendar - функция для обновления календаря
 * @returns текущие настройки доступа из Redux
 */
export const useAccessSettingsSync = (
  refreshCalendar?: () => void
): AccessSettings | undefined => {
  // Получаем настройки доступа из Redux
  const accessSettings = useSelector((state: RootState) => state.shifts.accessSettings);
  
  // При изменении настроек вызываем обновление календаря
  useEffect(() => {
    if (refreshCalendar) {
      refreshCalendar();
    }
  }, [
    accessSettings?.offsetType,
    accessSettings?.offsetAmount,
    accessSettings?.periodLength,
    accessSettings?.daysAhead,
    accessSettings?.isAlwaysActive,
    accessSettings?.activeStartDate,
    accessSettings?.activeEndDate,
    accessSettings?.enabledDates,
    refreshCalendar
  ]);
  
  return accessSettings;
}; 