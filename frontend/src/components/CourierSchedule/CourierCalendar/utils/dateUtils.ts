import { format } from 'date-fns';
import store from '../../../../store/store';
import { AccessSettings } from '../../../../store/slices/shiftsSlice';

// Константа для включения/отключения отладочных сообщений
const DEBUG_DATES = false;

// Вспомогательная функция для условного логирования
const debugLog = (message: string, ...data: any[]) => {
    if (DEBUG_DATES) {
        console.log(message, ...data);
    }
};

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
export function isDateAvailable(date: Date, userId?: string | number, accessSettings?: AccessSettings): boolean {
    debugLog(`🔍 Проверка доступности даты: ${format(date, 'yyyy-MM-dd')}`);
    
    const state = store.getState();
    // Получаем настройки либо из параметра, либо из хранилища
    const settings = accessSettings || state.shifts.accessSettings;
    const user = state.user.user;
    
    // Проверяем, является ли пользователь старшим курьером
    const isSeniorCourier = user?.is_senior_courier || false;
    debugLog(`👤 Пользователь старший курьер: ${isSeniorCourier ? 'Да' : 'Нет'}`);
    
    // Для старших курьеров доступны все даты (если нет персональных ограничений)
    if (isSeniorCourier && userId) {
        // Проверяем, не ограничен ли доступ для этого пользователя
        const userAccessRestricted = settings.restrictedUsers?.includes(userId);
        
        if (!userAccessRestricted) {
            debugLog(`✅ Дата доступна (пользователь старший курьер): ${format(date, 'yyyy-MM-dd')}`);
            return true;
        }
    }
    
    // Рассчитываем доступные даты в соответствии с новой логикой
    const availableDates = calculateAvailableDates(settings);
    
    // Проверяем, включена ли указанная дата в список доступных дат
    const dateFormatted = format(date, 'yyyy-MM-dd');
    const isAvailable = availableDates.includes(dateFormatted);
    
    debugLog(`${isAvailable ? '✅' : '❌'} Дата ${dateFormatted} ${isAvailable ? 'доступна' : 'недоступна'}`);
    
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
function getLastRegistrationDay(now: Date, targetDay: number, targetHour: number, targetMinute: number): Date {
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
            daysToSubtract = 7;
        }
    } else if (currentDay > targetDay) {
        // Если день недели после дня регистрации
        daysToSubtract = currentDay - targetDay;
    } else {
        // Если день недели до дня регистрации
        daysToSubtract = 7 - (targetDay - currentDay);
    }
    
    // Создаем дату последнего дня регистрации
    const lastRegistrationDay = new Date(now);
    lastRegistrationDay.setDate(now.getDate() - daysToSubtract);
    lastRegistrationDay.setHours(targetHour, targetMinute, 0, 0);
    
    return lastRegistrationDay;
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

/**
 * Рассчитывает доступные даты на основе настроек доступа
 * @param accessSettings Настройки доступа из Redux
 * @returns Массив доступных дат в формате YYYY-MM-DD
 */
export function calculateAvailableDates(accessSettings?: AccessSettings): string[] {
    debugLog('📅 Расчет доступных дат...');
    const settings = accessSettings || store.getState().shifts.accessSettings;
    
    if (!settings) {
        debugLog('❌ Настройки не загружены, расчет невозможен');
        return [];
    }
    
    // Проверяем активность правила
    if (!settings.isAlwaysActive) {
        const currentDate = new Date();
        const startDate = settings.activeStartDate ? new Date(settings.activeStartDate) : null;
        const endDate = settings.activeEndDate ? new Date(settings.activeEndDate) : null;
        
        if ((startDate && isBefore(currentDate, startDate)) || 
            (endDate && isAfter(currentDate, endDate))) {
            debugLog('❌ Правило неактивно в текущий период');
            return [];
        }
    }
    
    const now = new Date();
    debugLog(`⏰ Текущее время: ${now.toISOString()}`);
    
    // Получаем настройки времени регистрации
    const registrationDay = settings.registrationStartDay ?? 4; // Четверг по умолчанию
    const registrationHour = settings.registrationStartHour ?? 12;
    const registrationMinute = settings.registrationStartMinute ?? 0;
    
    // Находим последний прошедший день регистрации
    const lastRegistrationDay = getLastRegistrationDay(now, registrationDay, registrationHour, registrationMinute);
    
    // Находим следующий день регистрации
    const nextRegistrationDay = getNextRegistrationDay(now, registrationDay, registrationHour, registrationMinute);
    
    debugLog(`📅 Последний день регистрации: ${lastRegistrationDay.toISOString()}`);
    debugLog(`📅 Следующий день регистрации: ${nextRegistrationDay.toISOString()}`);
    
    // Применяем смещение к последнему дню регистрации
    const offsetType = settings.offsetType || 'days';
    const offsetAmount = settings.offsetAmount ?? 4;
    const periodLength = settings.periodLength ?? 7;
    
    let accessStartDate: Date;
    if (offsetType === 'weeks') {
        accessStartDate = addWeeks(lastRegistrationDay, offsetAmount);
    } else {
        accessStartDate = addDays(lastRegistrationDay, offsetAmount);
    }
    
    debugLog(`📅 Начало периода доступа: ${accessStartDate.toISOString()}`);
    
    // Формируем список доступных дат
    const availableDates: string[] = [];
    for (let i = 0; i < periodLength; i++) {
        const date = addDays(accessStartDate, i);
        availableDates.push(format(date, 'yyyy-MM-dd'));
    }
    
    // Добавляем специальные даты
    if (settings.enabledDates && Array.isArray(settings.enabledDates)) {
        settings.enabledDates.forEach(dateStr => {
            if (!availableDates.includes(dateStr)) {
                availableDates.push(dateStr);
            }
        });
    }
    
    // Добавляем текущий день если разрешено
    if (settings.allowSameDay) {
        const today = format(now, 'yyyy-MM-dd');
        if (!availableDates.includes(today)) {
            availableDates.push(today);
        }
    }
    
    debugLog(`✅ Рассчитаны доступные даты: ${availableDates.join(', ')}`);
    return availableDates;
} 