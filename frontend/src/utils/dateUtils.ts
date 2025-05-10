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