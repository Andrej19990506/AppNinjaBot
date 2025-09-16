// Типы для конфигурации поставок
export interface SuppliesConfig {
  spreadsheet_id: string;
  default_sheet_pattern: string; // например: "{month}"
  branch_name: string;
  start_row?: number;
  header_row?: number;
  months_range_back?: number; // по умолчанию 2
  months_range_forward?: number; // по умолчанию 2
}

// Извлечение месяца из даты (для определения нужного листа Google Sheets)
export const getMonthFromDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${year}`;
};

// Функция для генерации range на основе конфигурации и даты
export const generateRange = (config: SuppliesConfig, dateString: string): string => {
  const targetMonth = getMonthFromDate(dateString);
  const sheetName = config.default_sheet_pattern.replace('{month}', targetMonth);
  return `'${sheetName}'!A1:U220`; // Можно настроить диапазон
};