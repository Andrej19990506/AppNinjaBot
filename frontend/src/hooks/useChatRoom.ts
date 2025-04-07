import { useState, useEffect, useCallback } from 'react';
import { useWebSocketConnection } from './useWebSocketConnection';
import { tooltipManager } from '../components/Tooltip';

// Тип для пользователя в комнате
export type RoomUser = {
  sid: string;
  name?: string;
  displayName?: string;
  role?: string;
  is_senior_courier?: boolean;
  connection_state?: 'active' | 'away';
  connection_time?: string;
  [key: string]: any;
};

// Тип для данных о комнате
export type RoomData = {
  room: string;
  users: RoomUser[];
};

// Тип для сообщения
export type Message = {
  text: string;
  room: string;
  user?: RoomUser;
  timestamp?: string;
  isSystem?: boolean;
};

// Хук для работы с чат-комнатами
export const useChatRoom = (roomName: string, userInfo?: Record<string, any>) => {
  const { socketState, sendMessage, subscribe } = useWebSocketConnection();
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAway, setIsAway] = useState(false);

  // Обработчик пинга
  const handlePing = useCallback((data: { timestamp: string }) => {
    sendMessage('pong', data);
  }, [sendMessage]);

  // Обработчик состояния "away"
  const handleUserAway = useCallback((data: { sid: string; user_info: RoomUser }) => {
    if (data.sid === socketState.socketId) {
      setIsAway(true);
    }
    setRoomUsers(prev => prev.map(user => 
      user.sid === data.sid 
        ? { ...user, connection_state: 'away' }
        : user
    ));
    tooltipManager.show(`${data.user_info.displayName || 'Пользователь'} отошёл`, 'info');
  }, [socketState.socketId]);

  // Обработчик возвращения пользователя
  const handleUserBack = useCallback((data: { sid: string; user_info: RoomUser }) => {
    if (data.sid === socketState.socketId) {
      setIsAway(false);
    }
    setRoomUsers(prev => prev.map(user => 
      user.sid === data.sid 
        ? { ...user, connection_state: 'active' }
        : user
    ));
    tooltipManager.show(`${data.user_info.displayName || 'Пользователь'} вернулся`, 'success');
  }, [socketState.socketId]);

  // Обработчик отключения пользователя
  const handleUserDisconnected = useCallback((data: { 
    sid: string; 
    reason: 'manual' | 'timeout'; 
    user_info: RoomUser 
  }) => {
    setRoomUsers(prev => prev.filter(user => user.sid !== data.sid));
    const reason = data.reason === 'timeout' ? 'таймаут соединения' : 'вышел';
    tooltipManager.show(`${data.user_info.displayName || 'Пользователь'} ${reason}`, 'info');
  }, []);

  // Обработчик события присоединения к комнате
  const handleRoomJoined = useCallback((data: { room: string; status: string }) => {
    if (data.room === roomName && data.status === 'success') {
      setIsInRoom(true);
      sendMessage('get_room_users', { room: roomName });
    }
  }, [roomName, sendMessage]);

  // Обработчик события выхода из комнаты
  const handleRoomLeft = useCallback((data: { room: string }) => {
    if (data.room === roomName) {
      setIsInRoom(false);
      setRoomUsers([]);
    }
  }, [roomName]);

  // Обработчик списка пользователей в комнате
  const handleRoomUsers = useCallback((data: RoomData) => {
    if (data.room === roomName) {
      setRoomUsers(data.users);
    }
  }, [roomName]);

  // Обработчик обновления списка пользователей в комнате
  const handleRoomUsersUpdate = useCallback((data: RoomData) => {
    if (data.room === roomName) {
      setRoomUsers(data.users);
    }
  }, [roomName]);

  // Обработчик присоединения пользователя к комнате
  const handleUserJoined = useCallback((data: { room: string; user: RoomUser }) => {
    if (data.room === roomName) {
      sendMessage('get_room_users', { room: roomName });
      tooltipManager.show(`${data.user.displayName || 'Пользователь'} присоединился к комнате`, 'success');
    }
  }, [roomName, sendMessage]);

  // Обработчик сообщений
  const handleMessage = useCallback((data: Message) => {
    if (data.room === roomName) {
      setMessages(prev => [...prev, data]);
    }
  }, [roomName]);

  // Присоединение к комнате
  const joinRoom = useCallback(() => {
    if (!socketState.isConnected) {
      console.error('Невозможно присоединиться к комнате: WebSocket не подключен');
      return;
    }

    if (isInRoom) {
      console.warn('Уже в комнате:', roomName);
      return;
    }

    sendMessage('join_room', { room: roomName, user_info: userInfo });
  }, [socketState.isConnected, isInRoom, roomName, userInfo, sendMessage]);

  // Выход из комнаты
  const leaveRoom = useCallback(() => {
    if (!socketState.isConnected) {
      console.error('Невозможно выйти из комнаты: WebSocket не подключен');
      return;
    }

    if (!isInRoom) {
      console.warn('Не в комнате:', roomName);
      return;
    }

    sendMessage('leave_room', { room: roomName });
  }, [socketState.isConnected, isInRoom, roomName, sendMessage]);

  // Отправка сообщения в комнату
  const sendRoomMessage = useCallback((text: string) => {
    if (!socketState.isConnected || !isInRoom) {
      console.error('Невозможно отправить сообщение: не подключен или не в комнате');
      return;
    }

    sendMessage('message', { 
      text, 
      room: roomName 
    });
  }, [socketState.isConnected, isInRoom, roomName, sendMessage]);

  // Подписка на события комнаты
  useEffect(() => {
    if (!socketState.isConnected) return;

    const unsubscribes = [
      subscribe('room_joined', handleRoomJoined),
      subscribe('room_left', handleRoomLeft),
      subscribe('room_users', handleRoomUsers),
      subscribe('room_users_update', handleRoomUsersUpdate),
      subscribe('user_joined', handleUserJoined),
      subscribe('message', handleMessage),
      subscribe('ping', handlePing),
      subscribe('user_away', handleUserAway),
      subscribe('user_back', handleUserBack),
      subscribe('user_disconnected', handleUserDisconnected)
    ];

    // Запрашиваем список пользователей в комнате
    if (isInRoom) {
      sendMessage('get_room_users', { room: roomName });
    }

    // Отписываемся от событий при размонтировании
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [
    socketState.isConnected,
    isInRoom,
    roomName,
    sendMessage,
    subscribe,
    handleRoomJoined,
    handleRoomLeft,
    handleRoomUsers,
    handleRoomUsersUpdate,
    handleUserJoined,
    handleMessage,
    handlePing,
    handleUserAway,
    handleUserBack,
    handleUserDisconnected
  ]);

  // Автоматически пытаемся присоединиться к комнате, когда подключен WebSocket
  useEffect(() => {
    if (socketState.isConnected && !isInRoom) {
      // Пропускаем автоматическое присоединение для глобальной комнаты,
      // так как она обрабатывается в AppInitializer
      if (roomName !== 'global') {
        joinRoom();
      }
    }
  }, [socketState.isConnected, isInRoom, joinRoom, roomName]);

  return {
    isInRoom,
    roomUsers,
    messages,
    isAway,
    joinRoom,
    leaveRoom,
    sendMessage: sendRoomMessage
  };
};

export default useChatRoom; 