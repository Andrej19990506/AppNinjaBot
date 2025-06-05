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
  requires_confirmation?: boolean; // Требуется ли подтверждение от пользователя
}

// Тип данных, отправляемых на API для создания уведомления
export interface NotificationCreate extends EventNotificationBase {
  // Наследует все поля EventNotificationBase
  // Бэкенд ожидает RepeatSettings внутри repeat
  
  // Поля для управления временем уведомления
  send_now?: boolean;             // Если true, уведомление отправляется немедленно
  use_absolute_time?: boolean;    // Если true, используется absolute_time вместо time
  absolute_time?: string | Date;  // Абсолютное время для уведомления (в формате ISO)
}

// Тип данных для обновления уведомления
export interface NotificationUpdate {
  message?: string;
  time?: number; 
  repeat?: RepeatSettings; // Повторение тоже можно обновлять
  chat_ids?: number[];     // И чаты
  requires_confirmation?: boolean;
  
  // Поля для управления временем уведомления
  send_now?: boolean;             // Если true, уведомление отправляется немедленно
  use_absolute_time?: boolean;    // Если true, используется absolute_time вместо time
  absolute_time?: string | Date;  // Абсолютное время для уведомления (в формате ISO)
}

// Тип данных уведомления, получаемых от API
export interface EventNotification extends EventNotificationBase {
  id: string; // ID уведомления (UUID от бэка, представленный строкой)
  
  // Поля для управления временем уведомления
  send_now?: boolean;             // Если true, уведомление отправляется немедленно
  use_absolute_time?: boolean;    // Если true, используется absolute_time вместо time
  absolute_time?: string;         // Абсолютное время для уведомления (в формате ISO)
  
  // Поля статуса и времени выполнения (для завершенных уведомлений)
  status?: string;                // Статус уведомления (например, 'completed', 'pending')
  completed_at?: string;          // Время завершения уведомления (в формате ISO)
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
  event_type: 'manual' | 'ato'; // Тип создаваемого события
  chat_ids?: number[]; // Заменяем target_chat_id_for_ato на chat_ids
  group_type?: string; // Тип группы (chef, courier, admin и т.д.)
}

// Тип данных события, получаемых от API
export interface EventRead {
  id: number; // ID события - int от бэка
  description: string;
  date: string; // API возвращает дату как строку ISO 8601
  notifications: EventNotification[]; // Массив данных уведомлений
  scheduling_status: SchedulingStatus;
  last_check?: string | null; // API возвращает строку ISO 8601 или null
  event_type?: 'manual' | 'ato' | 'АТО' | string; // Поле event_type, которое уже было или должно быть здесь для чтения
  chat_ids?: number[]; // Заменяем target_chat_id_for_ato на chat_ids
  group_type?: string; // Тип группы (chef, courier, admin и т.д.)
   
  // Поля для событий АТО от RetailiQA
  retailiqa_insp_id?: string;           // ID инспекции в RetailiQA
  retailiqa_insp_obj_id?: string;       // ID объекта в RetailiQA
  retailiqa_insp_obj_name?: string;     // Название объекта в RetailiQA
  retailiqa_penalty_points?: number;    // Штрафные баллы
  retailiqa_total_points?: number;      // Общие баллы
  retailiqa_comments?: string[];        // Список комментариев с замечаниями
  retailiqa_photos?: string[];          // Список URL фотографий
  created_at?: string;                  // Дата создания события
  updated_at?: string | null;           // Дата обновления события

  // Новые поля для результатов проверки RetailiQA
  retailiqa_score_percentage?: number; // Процент выполнения проверки
  retailiqa_max_points?: number;       // Максимально возможные баллы
  retailiqa_earned_points?: number;    // Набранные баллы

  // Новые поля для детальной информации о нарушениях
  retailiqa_violation_count?: number;  // Количество нарушений
  retailiqa_detailed_violations?: {    // Детальная информация о нарушениях
    title: string;            // Название пункта нарушения
    text: string;             // Текст комментария к нарушению
    penalty: number;          // Штрафные баллы за данный пункт
    type?: string;            // Тип нарушения (например, "нарушение" или "замечание")
    photos?: string[];        // Массив URL фотографий для этого нарушения
  }[];
}

// Тип для обновления события (если понадобится)
export interface EventUpdate extends Partial<EventCreate> {
  // Позволяет обновлять description и/или date
}


export interface RetailiQAReportItem {
  insp_id: string;
  insp_date: string;
  insp_date_plan: string;
  insp_date_plan_iso: string;
  insp_date_closed: string;
  insp_date_closed_plan: string;
  insp_started: string;
  insp_completed: string;
  insp_obj: string;
  insp_obj_id: string;
  insp_obj_code: string;
  insp_obj_region: string;
  insp_obj_visited: string; 
  insp_type: string;
  insp_schedule: string;
  insp_type_id: string;
  insp_inspector: string;
  inspector_id: string;
  scope_id: string;
  insp_category: string;
  insp_scope: string;
  scope_description: string;
  task_vp: number;
  task_pt: number;
  task_counter: number;
  task_sum: number;
  task_answer: string; 
  task_comments: string;
  task_photos: string;
  task_files: string;
  insp_supervisor: string;
  supervisor_id: string;
  insp_serial_no: string;
  scope_tags: string[];
  task_npp: number;
  state_message: string;
  is_closed: boolean;
  scope_type: string;
  managers_list: unknown[]; 
  is_auto_closed: boolean;
  content_type: number;
  insp_api_id: string;
}

export interface RetailiQAReportResult {
  result: RetailiQAReportItem[];
  // Если в этом объекте есть 'meta', его нужно будет добавить сюда
}

export interface RetailiQAReportApiResponse {
  result: RetailiQAReportResult;
  // Если на верхнем уровне ответа есть 'meta' или другие поля, их нужно будет добавить сюда
}

// Также может понадобиться интерфейс для /api/v2/check_objects/ если его детализация важна для бэкенда
// Например:
export interface RetailiQACheckObjectRegion {
  id: string;
  name: string;
  inspector: string | null;
  district: string | null;
  timezone: string;
  uid: string;
}

export interface RetailiQACheckObjectSigner {
  id: string;
  fio: string;
  uid: string;
}

export interface RetailiQACheckObjectInspector {
    id: string;
    fio: string;
    uid: string;
}

export interface RetailiQACheckObject {
  id: string;
  api_id: string | null;
  name: string;
  address: string;
  location: [number, number];
  region: RetailiQACheckObjectRegion;
  signers: RetailiQACheckObjectSigner[];
  inspectionType: string; 
  inspector: RetailiQACheckObjectInspector[];
  supervisor: string | null; 
  additional_supervisors: RetailiQACheckObjectInspector[];
  format: string | null; 
  uid: string;
  managers: unknown[]; 
}

export interface RetailiQACheckObjectsApiResponse {
    result: RetailiQACheckObject[];
    meta: {
        limit: number;
        offset: number;
        count: number;
    };
}
