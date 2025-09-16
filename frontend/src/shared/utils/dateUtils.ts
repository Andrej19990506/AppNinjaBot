/**
 * Утилиты для работы с датами в красноярском часовом поясе (UTC+7)
 */

/**
 * Получает текущую дату в красноярском часовом поясе
 * @returns Строка в формате YYYY-MM-DD
 */
export const getKrasnoyarskDate = (): string => {
  const now = new Date();
  // Красноярское время (UTC+7)
  const krasnoyarskTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  return krasnoyarskTime.toISOString().split('T')[0];
};

/**
 * Получает текущую дату и время в красноярском часовом поясе
 * @returns Объект Date с красноярским временем
 */
export const getKrasnoyarskDateTime = (): Date => {
  const now = new Date();
  // Красноярское время (UTC+7)
  return new Date(now.getTime() + (7 * 60 * 60 * 1000));
};

/**
 * Конвертирует дату в красноярский часовой пояс
 * @param date - Исходная дата
 * @returns Дата в красноярском часовом поясе
 */
export const toKrasnoyarskTime = (date: Date): Date => {
  return new Date(date.getTime() + (7 * 60 * 60 * 1000));
};

/**
 * Проверяет, является ли день рабочим для приемки поставок
 * (понедельник, среда, пятница)
 * @param date - Дата для проверки (опционально, по умолчанию текущая)
 * @returns true, если день рабочий для приемки
 */
export const isDeliveryDay = (date?: Date): boolean => {
  const checkDate = date || getKrasnoyarskDateTime();
  const dayOfWeek = checkDate.getDay();
  // 1 = понедельник, 3 = среда, 5 = пятница
  return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
};

/**
 * Получает следующий рабочий день для приемки поставок
 * @param fromDate - Дата, с которой начинать поиск (опционально)
 * @returns Следующий рабочий день для приемки
 */
export const getNextDeliveryDay = (fromDate?: Date): Date => {
  const startDate = fromDate || getKrasnoyarskDateTime();
  let nextDate = new Date(startDate);
  
  // Ищем следующий рабочий день
  do {
    nextDate.setDate(nextDate.getDate() + 1);
  } while (!isDeliveryDay(nextDate));
  
  return nextDate;
};

/**
 * Форматирует дату для отображения в красноярском часовом поясе
 * @param date - Дата для форматирования
 * @param options - Опции форматирования
 * @returns Отформатированная строка
 */
export const formatKrasnoyarskDate = (
  date: Date, 
  options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  }
): string => {
  const krasnoyarskDate = toKrasnoyarskTime(date);
  return krasnoyarskDate.toLocaleDateString('ru-RU', options);
};

/**
 * Конвертирует локальную дату в UTC (для совместимости с WriteOff API)
 * @param localDate - Локальная дата
 * @returns Дата в UTC
 */
export const convertLocalDateToUTC = (localDate: string | Date): string => {
  const date = typeof localDate === 'string' ? new Date(localDate) : localDate;
  return date.toISOString();
};

/**
 * Конвертирует UTC дату в локальную (для совместимости с WriteOff API)
 * @param utcDate - Дата в UTC
 * @returns Локальная дата
 */
export const convertUTCDateToLocal = (utcDate: string): string => {
  const date = new Date(utcDate);
  return date.toLocaleDateString('ru-RU');
};

/**
 * Получает текущую дату в локальном формате YYYY-MM-DD (для совместимости с WriteOff API)
 * @returns Строка с текущей датой в формате YYYY-MM-DD
 */
export const getTodayLocalString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Получает дату в локальном формате YYYY-MM-DD (для совместимости с WriteOff API)
 * @param date - Дата для конвертации (опционально)
 * @returns Строка с датой в формате YYYY-MM-DD
 */
export const getLocalDateString = (date?: Date | string): string => {
  const targetDate = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  return targetDate.toISOString().split('T')[0];
};

/**
 * Проверяет, можно ли редактировать списания для указанной даты (для совместимости с WriteOff API)
 * @param date - Дата для проверки
 * @returns true, если можно редактировать списания
 */
export const canEditWriteOffsForDate = (date: string | Date): boolean => {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  // Можно редактировать списания за сегодня и за последние 7 дней
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  return targetDate >= sevenDaysAgo && targetDate <= today;
};