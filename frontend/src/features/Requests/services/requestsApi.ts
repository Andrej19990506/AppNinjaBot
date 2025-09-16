import { axiosInstance } from '@shared/api/api';

export type SuppliesQuery = {
  spreadsheet_id: string;
  range: string;
  date?: string;
  mode?: 'row' | 'table' | 'hybrid';
  subtract_withdrawn?: boolean;
  info_sheet_name?: string;
  exclude_zero?: boolean;
  debug?: boolean;
};

export const getSupplies = async (params: SuppliesQuery) => {
  const resp = await axiosInstance.get('/v1/supplies', { params });
  return resp.data as {
    spreadsheetId: string;
    range: string;
    date?: string;
    items: Array<{
      name: string;
      category?: string | null;
      unit?: string | null;
      supplier?: string | null;
      price: number | null;
      price_source?: 'row' | 'info';
      date?: string | null;
      limit_for_date?: number | null;
      quantity_for_date?: number | null;
      item_total?: number | null;
      status?: string | null;
      is_withdrawn?: boolean;
      debug?: {
        included_by_formula?: boolean;
        exclude_reason?: string | null;
        info_price_date?: string | null;
        info_price_value?: number | null;
      };
    }>;
    count: number;
    sheet_total?: number;
    summary: {
      total_quantity: number;
      total_cost: number;
      withdrawn_quantity: number;
      withdrawn_cost: number;
      net_quantity: number;
      net_cost: number;
    };
  };
};

// === НОВЫЕ ТИПЫ И ФУНКЦИИ ДЛЯ ПОСТАВОК ===

export interface DeliveryItem {
  name: string;
  category?: string;
  unit?: string;
  quantity?: number;
  price?: number;
  is_checked: boolean;
}

export interface UserInfo {
  name: string;
  initials: string;
  user_id?: number;
  telegram_id?: number;
}

export interface DeliveryAcceptRequest {
  supplier: string;
  branch?: string;
  delivery_date: string; // YYYY-MM-DD
  items: DeliveryItem[];
  accepted_by: UserInfo;
  notes?: string;
}

export interface DeliveryResponse {
  id: number;
  supplier: string;
  branch?: string;
  delivery_date: string;
  status: string;
  accepted_by_name: string;
  accepted_by_initials: string;
  accepted_at: string;
  total_items: number;
  checked_items: number;
  total_cost?: number;
  items: DeliveryItem[];
}

export interface DeliveryAcceptResponse {
  delivery_id: number;
  message: string;
  delivery: DeliveryResponse;
}

/**
 * Принятие поставки - отправка данных на сервер
 */
export const acceptDelivery = async (deliveryData: DeliveryAcceptRequest): Promise<DeliveryAcceptResponse> => {
  const resp = await axiosInstance.post('/v1/deliveries/accept', deliveryData);
  return resp.data;
};

/**
 * Получение списка принятых поставок
 */
export const getDeliveries = async (params?: {
  page?: number;
  size?: number;
  supplier?: string;
  branch?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  accepted_by?: string;
  include_stats?: boolean;
}) => {
  const resp = await axiosInstance.get('/v1/deliveries', { params });
  return resp.data as {
    deliveries: DeliveryResponse[];
    total: number;
    page: number;
    size: number;
    pages: number;
    stats?: any;
  };
};

/**
 * Получение деталей конкретной поставки
 */
export const getDelivery = async (deliveryId: number): Promise<DeliveryResponse> => {
  const resp = await axiosInstance.get(`/v1/deliveries/${deliveryId}`);
  return resp.data;
};

/**
 * Получение поставок за определенную дату
 */
export const getDeliveriesByDate = async (date: string): Promise<DeliveryResponse[]> => {
  const resp = await axiosInstance.get(`/v1/deliveries/by-date/${date}`);
  return resp.data;
};

/**
 * Получение статистики по поставкам
 */
/**
 * Отправка уведомления о принятии поставки в Telegram чат
 */
export const sendDeliveryNotification = async (params: {
  chat_id: string;
  supplier: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  accepted_by: {
    name: string;
    initials: string;
  };
  delivery_date: string;
  branch: string;
}) => {
  const resp = await axiosInstance.post('/v1/deliveries/send-notification', params);
  return resp.data as {
    success: boolean;
    message: string;
  };
};


