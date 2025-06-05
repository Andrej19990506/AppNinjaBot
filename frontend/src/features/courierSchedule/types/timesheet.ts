/**
 * Представляет данные по одному курьеру в ответе API табеля.
 */
export interface CourierTimesheetData {
    user_id: number;
    courier_name: string;
    /**
         * Словарь, где ключ - дата в формате 'YYYY-MM-DD',
         * а значение - информация о смене в этот день (например, '10', '18')
         * или null, если смены не было.
     */
    dates: { [date: string]: string | null };
}

/**
 * Описывает полную структуру ответа API для эндпоинта табеля.
 */
export interface TimesheetResponse {
    columns: string[];
    rows: CourierTimesheetData[];
}
