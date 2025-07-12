import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const formatDate = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'd MMMM yyyy HH:mm', { locale: ru });
};

export const formatRelativeDate = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
        return 'только что';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes} мин. назад`;
    } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} ч. назад`;
    } else {
        return format(dateObj, 'd MMMM yyyy', { locale: ru });
    }
};

/**
 * Получает дату в локальном часовом поясе пользователя в формате YYYY-MM-DD
 * @param date - Дата (по умолчанию текущая дата)
 * @returns Строка в формате YYYY-MM-DD
 */
export const getLocalDateString = (date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Получает сегодняшнюю дату в локальном часовом поясе в формате YYYY-MM-DD
 * @returns Строка в формате YYYY-MM-DD
 */
export const getTodayLocalString = (): string => {
    return getLocalDateString();
};

/**
 * Конвертирует локальную дату в UTC дату для API запросов
 * Это нужно потому что в БД даты хранятся в UTC, а пользователь работает в локальном времени
 */
export const convertLocalDateToUTC = (localDateString: string): string => {
    // Создаем дату в локальном времени на полночь
    const localDate = new Date(localDateString + 'T00:00:00');
    
    // Преобразуем в UTC и возвращаем только дату
    const utcYear = localDate.getUTCFullYear();
    const utcMonth = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const utcDay = String(localDate.getUTCDate()).padStart(2, '0');
    
    return `${utcYear}-${utcMonth}-${utcDay}`;
};

/**
 * Конвертирует UTC дату из API в локальную дату для отображения
 */
export const convertUTCDateToLocal = (utcDateString: string): string => {
    // Создаем дату как UTC на полночь
    const utcDate = new Date(utcDateString + 'T00:00:00Z');
    
    // Преобразуем в локальное время и возвращаем только дату
    const localYear = utcDate.getFullYear();
    const localMonth = String(utcDate.getMonth() + 1).padStart(2, '0');
    const localDay = String(utcDate.getDate()).padStart(2, '0');
    
    return `${localYear}-${localMonth}-${localDay}`;
};

/**
 * Проверяет, можно ли редактировать списания для указанной даты
 * Редактирование разрешено только для сегодняшнего дня
 */
export const canEditWriteOffsForDate = (date: string): boolean => {
    const today = getTodayLocalString();
    return date === today;
};

/**
 * Проверяет, является ли дата прошедшей
 */
export const isPastDate = (date: string): boolean => {
    const today = getTodayLocalString();
    return date < today;
};

/**
 * Проверяет, является ли дата будущей
 */
export const isFutureDate = (date: string): boolean => {
    const today = getTodayLocalString();
    return date > today;
};

/**
 * Проверяет, является ли дата сегодняшней
 */
export const isToday = (date: string): boolean => {
    const today = getTodayLocalString();
    return date === today;
}; 