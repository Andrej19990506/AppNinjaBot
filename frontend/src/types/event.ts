// frontend/src/types/event.ts

// Тип для настроек повтора
export interface RepeatSettings {
  type: 'none' | 'daily' | 'weekly' | 'monthly';
  weekdays?: number[]; // Массив чисел от 0 до 6, опционально
  month_day?: number;  // Число от 1 до 31, опционально
}

// Базовый тип для полей уведомления
export interface EventNotificationBase {
  message: string;
  time: number; // Минуты до события
  repeat?: RepeatSettings; // Настройки повтора для этого уведомления
  chat_ids?: number[];     // Список ID чатов для этого уведомления
}

// Тип данных, отправляемых на API для создания уведомления
export interface NotificationCreate extends EventNotificationBase {
  // Наследует все поля EventNotificationBase
  // Бэкенд ожидает RepeatSettings внутри repeat
}

// Тип данных для обновления уведомления
export interface NotificationUpdate {
  message?: string;
  time?: number; 
  repeat?: RepeatSettings; // Повторение тоже можно обновлять
  chat_ids?: number[];     // И чаты
}

// Тип данных уведомления, получаемых от API
export interface EventNotification extends EventNotificationBase {
  id: string; // ID уведомления (UUID от бэка, представленный строкой)
}

// Тип статуса планирования, получаемый от API
export interface SchedulingStatus {
  active: boolean;
}

// Базовый тип события
export interface EventBase {
  description?: string;
  // Дата может быть строкой (от API) или объектом Date (для работы во фронте)
  date?: string | Date;
}

// Тип данных, отправляемых на API для создания события
export interface EventCreate extends Omit<EventBase, 'date'> {
  description: string; // Обязательно при создании
  date: string; // На API отправляем дату как строку ISO 8601
}

// Тип данных события, получаемых от API
export interface EventRead {
  id: number; // ID события - int от бэка
  description: string;
  date: string; // API возвращает дату как строку ISO 8601
  notifications: EventNotification[]; // Массив данных уведомлений
  scheduling_status: SchedulingStatus;
  last_check?: string | null; // API возвращает строку ISO 8601 или null
}

// Тип для обновления события (если понадобится)
export interface EventUpdate extends Partial<EventCreate> {
  // Позволяет обновлять description и/или date
}
