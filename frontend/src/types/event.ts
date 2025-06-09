export interface RepeatSettings {
  type: 'none' | 'daily' | 'weekly' | 'monthly';
  weekdays?: number[];
  month_day?: number;
}

export interface EventNotificationBase {
  message: string;
  time: number;
  repeat?: RepeatSettings;
  chat_ids?: number[];
  requires_confirmation?: boolean;
}

export interface NotificationCreate extends EventNotificationBase {
  send_now?: boolean;
  use_absolute_time?: boolean;
  absolute_time?: string | Date;
}

export interface NotificationUpdate {
  message?: string;
  time?: number; 
  repeat?: RepeatSettings;
  chat_ids?: number[];
  requires_confirmation?: boolean;
  send_now?: boolean;
  use_absolute_time?: boolean;
}

export interface EventNotification extends EventNotificationBase {
  id: string;
  send_now?: boolean;
  use_absolute_time?: boolean;
  absolute_time?: string;
  status?: string;
  completed_at?: string;
}

export interface SchedulingStatus {
  active: boolean;
}

export interface EventBase {
  description?: string;
  date?: string | Date;
}

export interface EventCreate extends Omit<EventBase, 'date'> {
  description: string;
  date: string;
  event_type: 'manual' | 'ato';
  chat_ids?: number[];
  group_type?: string;
}

export interface EventRead {
  id: number;
  description: string;
  date: string;
  notifications: EventNotification[];
  scheduling_status: SchedulingStatus;
  last_check?: string | null;
  event_type?: 'manual' | 'ato' | 'АТО' | string;
  chat_ids?: number[];
  group_type?: string;
   
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
}

export interface RetailiQAReportApiResponse {
  result: RetailiQAReportResult;
}

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
