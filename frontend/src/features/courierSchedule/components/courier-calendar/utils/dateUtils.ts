import { format } from 'date-fns';
import store from '@shared/store/store';
import { AccessSettings } from '@/features/courierSchedule/types/courierScheduleTypes';
import { RootState } from '@shared/store/store';

export const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
};

export const isSelected = (date: Date | null, selectedDate: Date | null): boolean => {
    if (!date || !selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear();
};

/**
 * Проверяет, доступна ли указанная дата для записи на смену
 * @param date Дата для проверки
 * @param userId ID пользователя (опционально)
 * @param accessSettings Настройки доступа из Redux
 * @returns true, если запись на указанную дату доступна
 */
export function isDateAvailable(date: Date, userId?: string | number, accessSettings?: AccessSettings | null): boolean {
    const state = store.getState() as RootState;
    // Получаем настройки либо из параметра, либо из хранилища
    const settings = accessSettings !== undefined ? accessSettings : state.shifts.accessSettings;

    // Рассчитываем доступные даты в соответствии с новой логикой
    const availableDates = calculateAvailableDates(settings);
    
    // Проверяем, включена ли указанная дата в список доступных дат
    const dateFormatted = format(date, 'yyyy-MM-dd');
    const isAvailable = availableDates.includes(dateFormatted);
    
    // Дополнительно проверяем персональные ограничения (если дата в целом доступна)
    if (isAvailable && userId && settings?.restrictedUsers?.includes(userId)) {
         return false;
    }
    return isAvailable;
}

export const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const days: (Date | null)[] = [];

    // Корректируем firstDayOfMonth для недели, начинающейся с понедельника
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    // Добавляем пустые ячейки в начало
    for (let i = 0; i < adjustedFirstDay; i++) {
        days.push(null);
    }

    // Добавляем дни месяца
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }

    return days;
};

export const formatDateForAPI = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
};

export const formatDateForDisplay = (date: Date): string => {
    return format(date, 'dd.MM.yyyy');
};

/**
 * Добавляет указанное количество дней к дате
 * @param date Исходная дата
 * @param days Количество дней
 * @returns Новая дата
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Добавляет указанное количество недель к дате
 * @param date Исходная дата
 * @param weeks Количество недель
 * @returns Новая дата
 */
export function addWeeks(date: Date, weeks: number): Date {
    return addDays(date, weeks * 7);
}

/**
 * Проверяет, что первая дата находится после второй
 * @param date1 Первая дата
 * @param date2 Вторая дата
 * @returns true, если date1 > date2
 */
export function isAfter(date1: Date, date2: Date): boolean {
    return date1.getTime() > date2.getTime();
}

/**
 * Проверяет, что первая дата находится до второй
 * @param date1 Первая дата
 * @param date2 Вторая дата
 * @returns true, если date1 < date2
 */
export function isBefore(date1: Date, date2: Date): boolean {
    return date1.getTime() < date2.getTime();
}

/**
 * Вычисляет следующий день недели от заданной даты
 * @param date Исходная дата
 * @param dayOfWeek День недели (0-6, где 0 - воскресенье)
 * @returns Дата следующего указанного дня недели
 */
export function getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
    return result;
}

/**
 * Находит первый день с нужным targetDay от базовой даты
 */
function findFirstTargetDayFrom(baseDate: Date, targetDay: number): Date {
    const result = new Date(baseDate);
    result.setHours(0, 0, 0, 0);
    
    // Находим ближайший targetDay (вперёд или назад, в зависимости от того что ближе)
    let currentDay = result.getDay();
    let daysToAdd = 0;
    
    if (currentDay === targetDay) {
        daysToAdd = 0;
    } else if (currentDay < targetDay) {
        daysToAdd = targetDay - currentDay;
    } else {
        daysToAdd = 7 - (currentDay - targetDay);
    }
    
    result.setDate(result.getDate() + daysToAdd);
    return result;
}

/**
 * Находит последний прошедший день регистрации
 * ИСПРАВЛЕНО v6: Использует activeStartDate из настроек как динамический якорь
 */
function getLastRegistrationDay(now: Date, targetDay: number, targetHour: number, targetMinute: number, periodLength: number): Date {
    // Получаем настройки из store
    const state = store.getState() as RootState;
    const settings = state.shifts.accessSettings;
    
    // Шаг 1: Находим БЛИЖАЙШИЙ targetDay назад от now
    const currentDay = now.getDay();
    let daysBackToTargetDay: number;
    
    if (currentDay === targetDay) {
        daysBackToTargetDay = 0;
    } else if (currentDay > targetDay) {
        daysBackToTargetDay = currentDay - targetDay;
    } else {
        daysBackToTargetDay = 7 - (targetDay - currentDay);
    }
    
    let candidate = new Date(now);
    candidate.setDate(now.getDate() - daysBackToTargetDay);
    candidate.setHours(targetHour, targetMinute, 0, 0);
    
    // Если кандидат в будущем, берём предыдущий targetDay
    if (candidate.getTime() > now.getTime()) {
        candidate.setDate(candidate.getDate() - 7);
    }
    
    // Шаг 2: Определяем якорную дату для расчёта циклов
    let anchorDate: Date;
    
    if (settings?.activeStartDate) {
        // Используем activeStartDate и находим первый targetDay от неё
        const startDate = new Date(settings.activeStartDate);
        anchorDate = findFirstTargetDayFrom(startDate, targetDay);
    } else {
        // Fallback: используем первый targetDay 2024 года
        const fallbackYear = 2024;
        anchorDate = new Date(fallbackYear, 0, 1, 0, 0, 0, 0);
        anchorDate = findFirstTargetDayFrom(anchorDate, targetDay);
    }
    
    // Нормализуем даты для точного подсчёта дней
    const candidateNormalized = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
    const anchorNormalized = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    
    // Считаем разницу в днях
    const daysDiff = Math.round((candidateNormalized.getTime() - anchorNormalized.getTime()) / (1000 * 60 * 60 * 24));
    
    // Находим остаток от деления на periodLength
    let remainder = Math.abs(daysDiff) % periodLength;
    
    // Шаг 3: Если остаток не 0, отматываем на остаток
    if (remainder !== 0) {
        if (daysDiff >= 0) {
            // Кандидат после якоря - отматываем назад
            candidate.setDate(candidate.getDate() - remainder);
        } else {
            // Кандидат до якоря - отматываем назад на (periodLength - remainder)
            candidate.setDate(candidate.getDate() - (periodLength - remainder));
        }
    }
    
    return candidate;
}

/**
 * Находит предпоследний прошедший день регистрации
 * День регистрации повторяется с периодичностью = periodLength
 */
function getPenultimateRegistrationDay(now: Date, targetDay: number, targetHour: number, targetMinute: number, periodLength: number): Date {
    // Находим последний день регистрации
    const lastRegDay = getLastRegistrationDay(now, targetDay, targetHour, targetMinute, periodLength);
    // Отнимаем periodLength дней
    const penultimateRegDay = new Date(lastRegDay);
    penultimateRegDay.setDate(penultimateRegDay.getDate() - periodLength);
    return penultimateRegDay;
}

/**
 * Находит следующий день регистрации
 * ИСПРАВЛЕНО: Использует эпоху для определения валидных дней
 */
function getNextRegistrationDay(now: Date, targetDay: number, targetHour: number, targetMinute: number, periodLength: number): Date {
    // Находим последний прошедший день регистрации
    const lastRegDay = getLastRegistrationDay(now, targetDay, targetHour, targetMinute, periodLength);
    
    // Добавляем один период
    const nextRegDay = new Date(lastRegDay);
    nextRegDay.setDate(lastRegDay.getDate() + periodLength);
    
    return nextRegDay;
}

// <<< НОВАЯ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ >>>
/**
 * Рассчитывает даты для ОДНОГО окна доступности.
 * @param baseRegistrationDate Базовая дата регистрации (уже прошедшая).
 * @param settings Настройки доступа.
 * @param now Текущая дата (для логов, если нужны).
 * @returns Массив строк дат YYYY-MM-DD.
 */
function calculateSingleWindowDates(
    baseRegistrationDate: Date,
    settings: AccessSettings,
    now?: Date // опционально для более детальных логов внутри, если понадобится
): string[] {
    const offsetType = settings.offsetType || 'days';
    const offsetAmount = settings.offsetAmount ?? 4;
    const periodLength = settings.periodLength ?? 7;

    const calculateStart = (baseRegDate: Date): Date => {
        if (offsetType === 'weeks') {
            return addWeeks(baseRegDate, offsetAmount);
        }
        return addDays(baseRegDate, offsetAmount);
    };

    const windowStartDate = calculateStart(baseRegistrationDate);
    const datesInWindow: string[] = [];
    for (let i = 0; i < periodLength; i++) {
        const date = addDays(windowStartDate, i);
        datesInWindow.push(format(date, 'yyyy-MM-dd'));
    }
    return datesInWindow;
}

export function calculateAvailableDates(accessSettings?: AccessSettings | null): string[] {
    const settings = accessSettings !== undefined ? accessSettings : (store.getState() as RootState).shifts.accessSettings;
    
    if (!settings) {
        return [];
    }
    
    if (!settings.isAlwaysActive) {
        const currentDate = new Date();
        const startDate = settings.activeStartDate ? new Date(settings.activeStartDate) : null;
        const endDate = settings.activeEndDate ? new Date(settings.activeEndDate) : null;
        
        if ((startDate && isBefore(currentDate, startDate)) || 
            (endDate && isAfter(currentDate, endDate))) {
            return [];
        }
    }
    
    const now = new Date();
    const todayDateStr = format(now, 'yyyy-MM-dd');
    const registrationDay = settings.registrationStartDay ?? 4;
    const registrationHour = settings.registrationStartHour ?? 12;
    const registrationMinute = settings.registrationStartMinute ?? 0;
    const periodLength = settings.periodLength ?? 7; // Важно, используется в getLast/getPenultimate

    // --- 1. Определяем базовые даты для ДВУХ циклов --- 
    // currentCycleBaseDate - это последний прошедший/текущий момент регистрации (День Х)
    const currentCycleBaseDate = getLastRegistrationDay(now, registrationDay, registrationHour, registrationMinute, periodLength);
    // previousCycleBaseDate - это предпоследний прошедший момент регистрации
    const previousCycleBaseDate = getPenultimateRegistrationDay(now, registrationDay, registrationHour, registrationMinute, periodLength);

    // --- 2. Рассчитываем полные окна для этих двух циклов --- 
    const currentCycleWindowDates_Full = calculateSingleWindowDates(currentCycleBaseDate, settings, now);
    const previousCycleWindowDates_Full = calculateSingleWindowDates(previousCycleBaseDate, settings, now);

    // --- 3. Логика выбора и объединения --- 
    const combinedDatesSet = new Set<string>();

    if (now.getTime() >= currentCycleBaseDate.getTime()) {
        // Из окна текущего цикла берем только те, что >= today (прошедшие дни закрываем!)
        currentCycleWindowDates_Full.forEach(dateStr => {
            if (dateStr >= todayDateStr) {
                combinedDatesSet.add(dateStr);
            }
        });
        
        // Из окна предыдущего цикла берем только те, что >= today
        previousCycleWindowDates_Full.forEach(dateStr => {
            if (dateStr >= todayDateStr) {
                combinedDatesSet.add(dateStr);
            }
        });
    } else {
        
        // Из окна предыдущего цикла берем только те, что >= today
        previousCycleWindowDates_Full.forEach(dateStr => {
            if (dateStr >= todayDateStr) {
                combinedDatesSet.add(dateStr);
            }
        });
    }
    
    // --- 4. Добавляем специальные даты и текущий день (если нужно) --- 
    if (settings.enabledDates && Array.isArray(settings.enabledDates)) {
        settings.enabledDates.forEach((dateStr: string) => {
            if (dateStr >= todayDateStr) { // Также фильтруем по сегодня, чтобы не показывать прошедшие спец.даты
                combinedDatesSet.add(dateStr);
            }
        });
    }
    if (settings.allowSameDay) {
         combinedDatesSet.add(todayDateStr); // todayDateStr уже отфильтрован по сути

    }

    // --- 5. Формируем итоговый список --- 
    const finalAvailableDates = Array.from(combinedDatesSet);
    finalAvailableDates.sort();
    

    return finalAvailableDates;
}

const formatDateToYYYYMMDD = (date: Date): string => format(date, 'yyyy-MM-dd');

/**
 * Интерфейс для информации о периоде записи
 */
export interface BookingPeriod {
    startDate: Date;
    endDate: Date;
    startDateStr: string;
    endDateStr: string;
    registrationDate: Date;
    registrationDateStr: string;
}

/**
 * Получает информацию о текущем периоде записи
 */
export function getCurrentBookingPeriod(accessSettings?: AccessSettings | null): BookingPeriod | null {
    const settings = accessSettings !== undefined ? accessSettings : (store.getState() as RootState).shifts.accessSettings;
    
    if (!settings) {
        return null;
    }
    
    const now = new Date();
    const registrationDay = settings.registrationStartDay ?? 4;
    const registrationHour = settings.registrationStartHour ?? 12;
    const registrationMinute = settings.registrationStartMinute ?? 0;
    const periodLength = settings.periodLength ?? 7;
    
    // Получаем последний день регистрации (текущий период)
    const currentRegistrationDate = getLastRegistrationDay(now, registrationDay, registrationHour, registrationMinute, periodLength);
    
    // Рассчитываем даты периода
    const periodDates = calculateSingleWindowDates(currentRegistrationDate, settings, now);
    
    if (periodDates.length === 0) {
        return null;
    }
    
    const startDate = new Date(periodDates[0]);
    const endDate = new Date(periodDates[periodDates.length - 1]);
    
    return {
        startDate,
        endDate,
        startDateStr: format(startDate, 'dd.MM.yyyy'),
        endDateStr: format(endDate, 'dd.MM.yyyy'),
        registrationDate: currentRegistrationDate,
        registrationDateStr: format(currentRegistrationDate, 'dd.MM.yyyy HH:mm')
    };
}

/**
 * Получает информацию о следующем периоде записи
 */
export function getNextBookingPeriod(accessSettings?: AccessSettings | null): BookingPeriod | null {
    const settings = accessSettings !== undefined ? accessSettings : (store.getState() as RootState).shifts.accessSettings;
    
    if (!settings) {
        return null;
    }
    
    const now = new Date();
    const registrationDay = settings.registrationStartDay ?? 4;
    const registrationHour = settings.registrationStartHour ?? 12;
    const registrationMinute = settings.registrationStartMinute ?? 0;
    const periodLength = settings.periodLength ?? 7;
    
    // Получаем следующий день регистрации
    const nextRegistrationDate = getNextRegistrationDay(now, registrationDay, registrationHour, registrationMinute, periodLength);
    
    // Рассчитываем даты периода
    const periodDates = calculateSingleWindowDates(nextRegistrationDate, settings, now);
    
    if (periodDates.length === 0) {
        return null;
    }
    
    const startDate = new Date(periodDates[0]);
    const endDate = new Date(periodDates[periodDates.length - 1]);
    
    return {
        startDate,
        endDate,
        startDateStr: format(startDate, 'dd.MM.yyyy'),
        endDateStr: format(endDate, 'dd.MM.yyyy'),
        registrationDate: nextRegistrationDate,
        registrationDateStr: format(nextRegistrationDate, 'dd.MM.yyyy HH:mm')
    };
} 