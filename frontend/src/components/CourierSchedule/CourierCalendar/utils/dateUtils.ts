import { format } from 'date-fns';
import store from '../../../../store/store';
import { AccessSettings } from '../../../../store/slices/shiftsSlice';

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
    const state = store.getState();
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
 * Находит последний прошедший день регистрации
 */
function getLastRegistrationDay(now: Date, targetDay: number, targetHour: number, targetMinute: number, periodLength: number): Date {
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const targetTime = targetHour * 60 + targetMinute;
    
    // Определяем, сколько дней нужно вычесть
    let daysToSubtract;
    
    if (currentDay === targetDay) {
        // Если сегодня день регистрации, проверяем время
        if (currentTime >= targetTime) {
            // Если время уже прошло, используем сегодня
            daysToSubtract = 0;
        } else {
            // Если время еще не наступило, берем прошлую неделю
            daysToSubtract = periodLength;
        }
    } else if (currentDay > targetDay) {
        // Если день недели после дня регистрации
        daysToSubtract = currentDay - targetDay;
    } else {
        // Если день недели до дня регистрации
        daysToSubtract = 7 - (targetDay - currentDay);
    }
    
    // Создаем дату последнего дня регистрации
    const calculatedDate = new Date(now);
    calculatedDate.setDate(now.getDate() - daysToSubtract);
    calculatedDate.setHours(targetHour, targetMinute, 0, 0);

    return calculatedDate;
}

/**
 * Находит предпоследний прошедший день регистрации (всегда -7 дней)
 */
function getPenultimateRegistrationDay(now: Date, targetDay: number, targetHour: number, targetMinute: number, periodLength: number): Date {
    // Находим сначала последний
    const lastRegDay = getLastRegistrationDay(now, targetDay, targetHour, targetMinute, periodLength);
    // Отнимаем 7 дней, чтобы получить предыдущий
    const penultimateRegDay = new Date(lastRegDay);
    penultimateRegDay.setDate(penultimateRegDay.getDate() - periodLength);
    return penultimateRegDay;
}

/**
 * Находит следующий день регистрации
 */
function getNextRegistrationDay(now: Date, targetDay: number, targetHour: number, targetMinute: number): Date {
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const targetTime = targetHour * 60 + targetMinute;
    
    // Определяем, сколько дней нужно добавить
    let daysToAdd;
    
    if (currentDay === targetDay) {
        // Если сегодня день регистрации, проверяем время
        if (currentTime >= targetTime) {
            // Если время уже прошло, берем следующую неделю
            daysToAdd = 7;
        } else {
            // Если время еще не наступило, используем сегодня
            daysToAdd = 0;
        }
    } else if (currentDay < targetDay) {
        // Если день недели до дня регистрации
        daysToAdd = targetDay - currentDay;
    } else {
        // Если день недели после дня регистрации
        daysToAdd = 7 - (currentDay - targetDay);
    }
    
    // Создаем дату следующего дня регистрации
    const nextRegistrationDay = new Date(now);
    nextRegistrationDay.setDate(now.getDate() + daysToAdd);
    nextRegistrationDay.setHours(targetHour, targetMinute, 0, 0);
    
    return nextRegistrationDay;
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
    const settings = accessSettings !== undefined ? accessSettings : store.getState().shifts.accessSettings;
    
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
        // Добавляем все даты из окна текущего цикла (они все актуальны)
        currentCycleWindowDates_Full.forEach(dateStr => combinedDatesSet.add(dateStr));
        
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
        settings.enabledDates.forEach(dateStr => {
            if (dateStr >= todayDateStr) { // Также фильтруем по сегодня, чтобы не показывать прошедшие спец.даты
                combinedDatesSet.add(dateStr);
            }
        });
        // debugLog(`📌 Добавлены актуальные специальные даты.`);
    }
    if (settings.allowSameDay) {
         combinedDatesSet.add(todayDateStr); // todayDateStr уже отфильтрован по сути
         // debugLog('🌞 Добавлен текущий день (allowSameDay=true).');
    }

    // --- 5. Формируем итоговый список --- 
    const finalAvailableDates = Array.from(combinedDatesSet);
    finalAvailableDates.sort();
    

    return finalAvailableDates;
}

const formatDateToYYYYMMDD = (date: Date): string => format(date, 'yyyy-MM-dd'); 