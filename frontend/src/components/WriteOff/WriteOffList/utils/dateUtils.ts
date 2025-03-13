/**
 * Форматирует дату в удобочитаемый формат
 * Пример: "15 мая 2023, 14:30"
 * 
 * @param dateString строка с датой или объект Date
 * @returns отформатированная строка даты
 */
export const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Неверная дата';
  }
  
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return date.toLocaleDateString('ru-RU', options);
};

/**
 * Форматирует дату относительно текущего времени
 * Например: "5 минут назад", "Вчера в 15:30", "15 мая 2023"
 * 
 * @param dateString строка с датой или объект Date
 * @returns отформатированная строка с относительной датой
 */
export const formatRelativeDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Неверная дата';
  }
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  // Меньше минуты
  if (diffSec < 60) {
    return 'Только что';
  }
  
  // Меньше часа
  if (diffMin < 60) {
    return `${diffMin} ${getMinutesText(diffMin)} назад`;
  }
  
  // Меньше суток
  if (diffHour < 24) {
    return `${diffHour} ${getHoursText(diffHour)} назад`;
  }
  
  // Вчера
  if (diffDay === 1) {
    return `Вчера в ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // Меньше недели
  if (diffDay < 7) {
    return `${diffDay} ${getDaysText(diffDay)} назад`;
  }
  
  // Больше недели - полная дата
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  
  return date.toLocaleDateString('ru-RU', options);
};

/**
 * Вспомогательная функция для получения правильного склонения слова "минута"
 */
function getMinutesText(minutes: number): string {
  if (minutes >= 11 && minutes <= 19) {
    return 'минут';
  }
  
  const lastDigit = minutes % 10;
  
  if (lastDigit === 1) {
    return 'минуту';
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'минуты';
  }
  
  return 'минут';
}

/**
 * Вспомогательная функция для получения правильного склонения слова "час"
 */
function getHoursText(hours: number): string {
  if (hours >= 11 && hours <= 19) {
    return 'часов';
  }
  
  const lastDigit = hours % 10;
  
  if (lastDigit === 1) {
    return 'час';
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'часа';
  }
  
  return 'часов';
}

/**
 * Вспомогательная функция для получения правильного склонения слова "день"
 */
function getDaysText(days: number): string {
  if (days >= 11 && days <= 19) {
    return 'дней';
  }
  
  const lastDigit = days % 10;
  
  if (lastDigit === 1) {
    return 'день';
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня';
  }
  
  return 'дней';
} 