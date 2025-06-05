// Типизированная информация о пользователе
export interface UserInfo {
  user_id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  socket_id?: string;
}

// Общий интерфейс для событий
export interface WebSocketEvent<T = any> {
  type: string;
  data: T;
  timestamp: number;
}

// Параметры для подключения к комнате
export interface JoinRoomParams {
  chatId: string;
  userInfo: UserInfo;
  force?: boolean;
  refresh?: boolean;
}

// Параметры для отключения от комнаты
export interface LeaveRoomParams {
  chatId: string;
  userInfo: UserInfo;
}

// Результат подключения к комнате
export interface JoinRoomResult {
  success: boolean;
  roomName: string;
  activeUsers?: UserInfo[];
  error?: string;
}

// Параметры для подписки на событие
export interface SubscribeEventParams<T = any> {
  eventName: string;
  handler: (data: T) => void;
}


export interface RoomOptions {
  force?: boolean;
  refresh?: boolean;
} 