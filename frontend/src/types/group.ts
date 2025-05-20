export interface Group {
  id: number; // Или string, если ID в БД не числовой. Используйте тот же тип, что и в вашей модели Group на бэкенде.
  group_id: number; // Telegram ID группы, используется для API вызовов к RetailiQA
  title: string; // Название группы для отображения в UI
  // Добавьте другие поля, если они есть в вашей модели Group и нужны на фронтенде
  // например, group_type, username и т.д.
} 