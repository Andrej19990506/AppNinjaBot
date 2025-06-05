import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@shared/store/store';
import { AccessSettings } from '@features/courierSchedule/types/courierScheduleTypes';

/**
 * Хук для синхронизации настроек доступа с календарем
 * 
 * @param refreshCalendar - функция для обновления календаря
 * @returns текущие настройки доступа из Redux
 */
export const useAccessSettingsSync = (
  refreshCalendar?: () => void
): AccessSettings | null => {
  // Получаем настройки доступа из Redux
  const accessSettings = useSelector((state: RootState) => state.shifts.accessSettings);
  
  // Ref для хранения предыдущих настроек
  const prevSettingsRef = useRef<AccessSettings | null>(null);
  
  // Мемоизируем ключевые настройки, которые влияют на доступность
  const keySettings = useMemo(() => ({
    offsetType: accessSettings?.offsetType,
    offsetAmount: accessSettings?.offsetAmount,
    periodLength: accessSettings?.periodLength,
    daysAhead: accessSettings?.daysAhead,
    isAlwaysActive: accessSettings?.isAlwaysActive,
    activeStartDate: accessSettings?.activeStartDate,
    activeEndDate: accessSettings?.activeEndDate,
    enabledDates: accessSettings?.enabledDates,
    allowMultipleShifts: accessSettings?.allowMultipleShifts,
    allowSameDay: accessSettings?.allowSameDay,
    registrationStartDay: accessSettings?.registrationStartDay,
    registrationStartHour: accessSettings?.registrationStartHour,
    registrationStartMinute: accessSettings?.registrationStartMinute
  }), [accessSettings]);

  // Ref для хранения таймера обновления
  const updateTimerRef = useRef<number>();
  
  // При изменении ключевых настроек вызываем обновление календаря
  useEffect(() => {
    // Проверяем, действительно ли изменились важные настройки
    const hasImportantChanges = prevSettingsRef.current
      ? Object.entries(keySettings).some(([key, value]) => {
          const prevValue = prevSettingsRef.current?.[key as keyof AccessSettings];
          if (Array.isArray(value) && Array.isArray(prevValue)) {
            return JSON.stringify(value) !== JSON.stringify(prevValue);
          }
          return value !== prevValue;
        })
      : true;

    // Сохраняем текущие настройки для следующего сравнения
    prevSettingsRef.current = accessSettings;

    if (hasImportantChanges && refreshCalendar) {
      // Очищаем предыдущий таймер
      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
      }

      // Устанавливаем новый таймер с небольшой задержкой
      updateTimerRef.current = window.setTimeout(() => {
        refreshCalendar();
      }, 100);
    }

    return () => {
      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
      }
    };
  }, [keySettings, refreshCalendar, accessSettings]);
  
  return accessSettings;
} 