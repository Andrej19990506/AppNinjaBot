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
    const isSeniorCourier = user?.isSeniorCourier || false;
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
 * Рассчитывает доступные даты на основе настроек доступа
 * @param accessSettings Настройки доступа из Redux
 * @returns Массив доступных дат в формате YYYY-MM-DD
 */
export function calculateAvailableDates(accessSettings?: AccessSettings): string[] {
    debugLog('📅 Расчет доступных дат...');
    // Если настройки не переданы, получаем их из хранилища
    const settings = accessSettings || store.getState().shifts.accessSettings;
    
    // Если настройки не загружены, возвращаем пустой массив
    if (!settings) {
        debugLog('❌ Настройки не загружены, расчет невозможен');
        return [];
    }
    
    debugLog('📊 Настройки доступа перед расчетом:', settings);
    
    // Проверяем, активно ли правило
    if (!settings.isAlwaysActive) {
        // Если правило не всегда активно, проверяем, находимся ли мы в указанном диапазоне дат
        const currentDate = new Date();
        const startDate = settings.activeStartDate ? new Date(settings.activeStartDate) : null;
        const endDate = settings.activeEndDate ? new Date(settings.activeEndDate) : null;
        
        if (
            (startDate && isBefore(currentDate, startDate)) || 
            (endDate && isAfter(currentDate, endDate))
        ) {
            // Мы находимся вне указанного диапазона, возвращаем пустой массив
            debugLog('❌ Правило неактивно в текущий период');
            return [];
        }
    }
    
    // Текущая дата для расчетов
    const now = new Date();
    debugLog(`⏰ Текущее время: ${now.toISOString()}`);
    
    // Используем именно значения из настроек, игнорируя значения по умолчанию
    const registrationDay = settings.registrationStartDay;
    const registrationHour = settings.registrationStartHour;
    const registrationMinute = settings.registrationStartMinute;
    
    // Проверяем, что значения существуют, иначе используем резервные значения
    if (registrationDay === undefined || registrationHour === undefined || registrationMinute === undefined) {
        debugLog('⚠️ Критические значения отсутствуют в настройках, используем резервные');
        
        // Вывод всего объекта в консоль для диагностики
        debugLog('🔍 Полный объект настроек:', JSON.stringify(settings, null, 2));
        
        // Используем резервные значения
        const fallbackDay = 5; // Пятница
        const fallbackHour = 3;
        const fallbackMinute = 15;
        
        debugLog(`📆 День регистрации: ${fallbackDay} (резервное значение)`);
        debugLog(`⏰ Время регистрации: ${fallbackHour}:${fallbackMinute} (резервные значения)`);
        
        // Находим ближайший день недели для открытия регистрации
        const nextOpeningDay = getNextDayOfWeek(now, fallbackDay);
        
        // Учитываем часовой пояс Красноярска (UTC+7)
        const localTimezoneOffset = now.getTimezoneOffset();
        const krasnoyarskOffset = -420; 
        const offsetDifference = localTimezoneOffset - krasnoyarskOffset;
        
        // Устанавливаем время открытия регистрации с учетом часового пояса
        nextOpeningDay.setHours(fallbackHour, fallbackMinute, 0, 0);
        
        // Настраиваем время в соответствии с часовым поясом Красноярска
        const nextOpeningDayAdjusted = new Date(nextOpeningDay.getTime() - offsetDifference * 60000);
        
        debugLog(`📅 Ближайший день открытия регистрации (локальное время): ${nextOpeningDay.toISOString()}`);
        debugLog(`📅 Ближайший день открытия регистрации (Красноярск): ${nextOpeningDayAdjusted.toISOString()}`);
        
        // Проверяем, открыта ли уже регистрация, сравнивая с correctedNow
        const isRegistrationOpen = now >= nextOpeningDayAdjusted;
        debugLog(`🔍 Регистрация открыта: ${isRegistrationOpen ? 'ДА' : 'НЕТ'}`);
        
        // Если регистрация не открыта, возвращаем пустой массив
        if (!isRegistrationOpen) {
            debugLog('❌ Регистрация закрыта, доступные даты не рассчитываются');
            return [];
        }
        
        // Рассчитываем начальную дату периода доступа
        let accessStartDate: Date;
        
        // Используем резервные значения смещения
        const fallbackOffsetType = 'days' as 'days' | 'weeks' | 'none';
        const fallbackOffsetAmount = 5;
        
        debugLog(`📏 Смещение: ${fallbackOffsetAmount} ${fallbackOffsetType} (резервные значения)`);
        
        if (fallbackOffsetType === 'weeks') {
            // Смещение в неделях
            accessStartDate = addWeeks(nextOpeningDayAdjusted, fallbackOffsetAmount);
        } else {
            // Смещение в днях
            accessStartDate = addDays(nextOpeningDayAdjusted, fallbackOffsetAmount);
        }
        
        debugLog(`🗓️ Дата начала доступного периода: ${accessStartDate.toISOString()}`);
        
        // Используем резервное значение периода
        const fallbackPeriodLength = 7;
        debugLog(`📏 Длина периода: ${fallbackPeriodLength} дней (резервное значение)`);
        
        // Рассчитываем все доступные даты
        const availableDates: string[] = [];
        for (let i = 0; i < fallbackPeriodLength; i++) {
            const date = addDays(accessStartDate, i);
            availableDates.push(format(date, 'yyyy-MM-dd'));
        }
        
        debugLog(`✅ Рассчитаны доступные даты: ${availableDates.length} дней`);
        debugLog(`📅 Доступные даты: ${availableDates.join(', ')}`);
        
        return availableDates;
    }
    
    debugLog(`📆 День регистрации: ${registrationDay} (день недели)`);
    debugLog(`⏰ Время регистрации: ${registrationHour}:${registrationMinute}`);
    
    // Находим ближайший день недели для открытия регистрации
    const nextOpeningDay = getNextDayOfWeek(now, registrationDay);
    
    // Учитываем часовой пояс Красноярска (UTC+7)
    // Получаем текущее смещение пользователя в минутах
    const localTimezoneOffset = now.getTimezoneOffset(); // Возвращает смещение в минутах от UTC (отрицательные для восточных)
    // Красноярск: UTC+7 = -420 минут
    const krasnoyarskOffset = -420;
    // Разница между локальным временем и Красноярском в минутах
    const offsetDifference = localTimezoneOffset - krasnoyarskOffset;
    
    // Устанавливаем время открытия регистрации с учетом часового пояса
    nextOpeningDay.setHours(registrationHour, registrationMinute, 0, 0);
    
    // Настраиваем время в соответствии с часовым поясом Красноярска
    const nextOpeningDayAdjusted = new Date(nextOpeningDay.getTime() - offsetDifference * 60000);
    
    debugLog(`📅 Ближайший день открытия регистрации (локальное время): ${nextOpeningDay.toISOString()}`);
    debugLog(`📅 Ближайший день открытия регистрации (Красноярск): ${nextOpeningDayAdjusted.toISOString()}`);
    
    // Проверяем, открыта ли уже регистрация, сравнивая с correctedNow
    const isRegistrationOpen = now >= nextOpeningDayAdjusted;
    debugLog(`🔍 Регистрация открыта: ${isRegistrationOpen ? 'ДА' : 'НЕТ'}`);
    
    // Если регистрация не открыта, возвращаем пустой массив
    if (!isRegistrationOpen) {
        debugLog('❌ Регистрация закрыта, доступные даты не рассчитываются');
        return [];
    }
    
    // Рассчитываем начальную дату периода доступа
    let accessStartDate: Date;
    
    // Смещение: на сколько дней или недель вперед от дня открытия
    // Используем значения из настроек
    const offsetType = settings.offsetType || 'days';
    const offsetAmount = settings.offsetAmount || 5;
    
    debugLog(`📏 Смещение: ${offsetAmount} ${offsetType}`);
    
    if (offsetType === 'weeks') {
        // Смещение в неделях
        accessStartDate = addWeeks(nextOpeningDayAdjusted, offsetAmount);
    } else {
        // Смещение в днях
        accessStartDate = addDays(nextOpeningDayAdjusted, offsetAmount);
    }
    
    debugLog(`🗓️ Дата начала доступного периода: ${accessStartDate.toISOString()}`);
    
    // Длительность периода в днях
    const periodLength = settings.periodLength || 7;
    debugLog(`📏 Длина периода: ${periodLength} дней`);
    
    // Рассчитываем все доступные даты
    const availableDates: string[] = [];
    for (let i = 0; i < periodLength; i++) {
        const date = addDays(accessStartDate, i);
        availableDates.push(format(date, 'yyyy-MM-dd'));
    }
    
    // Добавляем специальные даты из настроек
    if (settings.enabledDates && Array.isArray(settings.enabledDates)) {
        debugLog(`🔍 Проверка специальных дат: ${settings.enabledDates.length} дат`);
        settings.enabledDates.forEach(dateStr => {
            if (!availableDates.includes(dateStr)) {
                debugLog(`➕ Добавлена специальная дата: ${dateStr}`);
                availableDates.push(dateStr);
            }
        });
    }
    
    // Проверяем "allowSameDay" - разрешена ли запись на текущий день
    if (settings.allowSameDay) {
        const today = format(now, 'yyyy-MM-dd');
        if (!availableDates.includes(today)) {
            debugLog(`➕ Добавлен текущий день (allowSameDay=true): ${today}`);
            availableDates.push(today);
        }
    }
    
    debugLog(`✅ Рассчитаны доступные даты: ${availableDates.length} дней`);
    debugLog(`📅 Доступные даты: ${availableDates.join(', ')}`);
    
    return availableDates;
} 