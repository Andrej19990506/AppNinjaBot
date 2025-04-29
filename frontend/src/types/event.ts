// frontend/src/types/event.ts

// Тип для настроек повтора
export interface RepeatSettings {
  type: 'none' | 'daily' | 'weekly' | 'monthly';
  weekdays?: number[]; // 0-6
  month_day?: number; // 1-31
}

// Тип для уведомления
export interface EventNotification {
  message: string;
  time: number; // Минуты до события
  // id?: number; // Если у уведомлений будет свой ID
}

// Тип для статуса планирования
export interface SchedulingStatus {
  active: boolean;
}

// Базовый тип события (для Create/Update)
export interface EventBase {
  description?: string;
  date?: string | Date; // Дата может быть строкой или объектом Date
  repeat?: RepeatSettings;
  notifications?: EventNotification[];
  chat_ids?: number[];
  // active?: boolean; // Для EventUpdate, если нужно
}

// Тип для создания события (данные, отправляемые на API)
export interface EventCreate extends Omit<EventBase, 'description'> {
  description: string; // Обязательно
  date: string; // На API обычно отправляем строку в ISO формате
  // repeat, notifications, chat_ids будут необязательными и возьмут значения по умолчанию на бэке,
  // если не переданы, или используем Partial<EventBase> в мутации
}

// Тип для чтения события (данные, получаемые от API)
export interface EventRead {
  id: number;
  description: string;
  date: string; // API возвращает строку, можно преобразовать в Date при необходимости
  repeat: RepeatSettings;
  notifications: EventNotification[];
  chat_ids: number[];
  scheduling_status: SchedulingStatus;
  last_check?: string | null; // API возвращает строку или null
} 