import React, { createContext, useContext, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChatContext as ChatContextEnum, selectChat, clearSelectedChat, fetchChats } from '../store/slices/chatSlice';
import { ChatInventory } from '../types/inventory';
import { WriteOffChat } from '../types/writeOff';
import { RootState, AppDispatch } from '../store';

// Тип для чата в зависимости от контекста
export type ContextChat = ChatInventory | WriteOffChat;

interface ChatContextProps {
  // Текущий контекст (инвентаризация, списание или события)
  contextType: ChatContextEnum;
  
  // Текущий выбранный чат в контексте
  selectedChat: ContextChat | null;
  
  // Права администратора для текущего чата
  adminRights: { status: string; can_manage_chat?: boolean } | null;
  
  // Список всех чатов в контексте
  chats: ContextChat[];
  
  // Состояние загрузки чатов
  loading: boolean;
  
  // Сообщение об ошибке, если есть
  error: string | null;
  
  // Проверка наличия прав администратора
  isAdmin: boolean;
  
  // Методы
  selectChatById: (chatId: string) => void;
  clearSelectedChat: () => void;
  refreshChats: () => void;
}

const DefaultChatContext: ChatContextProps = {
  contextType: ChatContextEnum.INVENTORY,
  selectedChat: null,
  adminRights: null,
  chats: [],
  loading: false,
  error: null,
  isAdmin: false,
  selectChatById: () => {},
  clearSelectedChat: () => {},
  refreshChats: () => {}
};

export const ChatContextInstance = createContext<ChatContextProps>(DefaultChatContext);

export const useChatContext = () => useContext(ChatContextInstance);

interface ChatContextProviderProps {
  children: ReactNode;
  contextType: ChatContextEnum;
}

export const ChatContextProvider: React.FC<ChatContextProviderProps> = ({ 
  children, 
  contextType 
}) => {
  const dispatch = useDispatch<AppDispatch>();
  // Ref для отслеживания, был ли уже выполнен запрос
  const fetchedRef = useRef<boolean>(false);
  // Ref для отслеживания предыдущего контекста
  const prevContextRef = useRef<ChatContextEnum | null>(null);
  // Ref для таймера между повторными запросами
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Используем отдельные селекторы для каждого значения, чтобы избежать создания новых объектов
  const chats = useSelector((state: RootState) => 
    Array.isArray(state.chats?.chats?.[contextType]) 
      ? state.chats.chats[contextType] as ContextChat[]
      : []
  );
  
  const selectedChat = useSelector((state: RootState) => 
    state.chats?.selectedChat?.[contextType] as ContextChat | null
  );
  
  const loading = useSelector((state: RootState) => 
    state.chats?.loading?.[contextType] || false
  );
  
  const error = useSelector((state: RootState) => 
    state.chats?.error?.[contextType] || null
  );
  
  // Получаем права администратора для выбранного чата
  const adminRights = useSelector((state: RootState) => 
    selectedChat ? state.chats.adminRights[selectedChat.chat_id] : null
  );

  // Метод для выбора чата по ID
  const selectChatById = useCallback((chatId: string) => {
    const chat = chats.find((c: ContextChat) => c.chat_id === chatId);
    if (chat) {
      dispatch(selectChat({ chat, context: contextType }));
    }
  }, [dispatch, chats, contextType]);

  // Метод для очистки выбранного чата
  const clearChat = useCallback(() => {
    dispatch(clearSelectedChat(contextType));
  }, [dispatch, contextType]);
  
  // Метод для обновления списка чатов
  const refreshChats = useCallback(() => {
    // Сбрасываем флаг при ручном обновлении
    fetchedRef.current = false;
    
    // Используем таймер для предотвращения слишком частых запросов
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    console.log(`[ChatContext] Обновляем чаты для контекста ${contextType}`);
    
    timerRef.current = setTimeout(() => {
      dispatch(fetchChats(contextType));
    }, 300);
  }, [dispatch, contextType]);

  // Сбрасываем флаг при изменении типа контекста
  useEffect(() => {
    if (contextType !== prevContextRef.current) {
      console.log(`[ChatContext] Контекст изменился с ${prevContextRef.current} на ${contextType}, сбрасываем флаг запроса`);
      fetchedRef.current = false;
      prevContextRef.current = contextType;
    }
    
    // Очищаем таймер при размонтировании компонента
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [contextType]);

  // Загрузка чатов при инициализации контекста
  useEffect(() => {
    // Предотвращаем повторные запросы при загрузке или если уже есть данные
    if (loading || fetchedRef.current) {
      console.log(`[ChatContext] Пропускаем запрос чатов: loading=${loading}, fetchedRef=${fetchedRef.current}`);
      return;
    }
    
    // Если у нас уже есть чаты, не делаем повторный запрос
    if (chats.length > 0) {
      console.log(`[ChatContext] Уже есть ${chats.length} чатов, не запрашиваем снова`);
      return;
    }
    
    // Защита от частых повторных запросов при ошибке
    if (error) {
      console.log(`[ChatContext] Есть ошибка, не делаем автоматический повторный запрос: ${error}`);
      return;
    }
    
    // Устанавливаем флаг, что запрос выполнен
    fetchedRef.current = true;
    
    console.log(`[ChatContext] Загружаем чаты для контекста: ${contextType}`);
    
    // Используем таймер для предотвращения слишком частых запросов
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(() => {
      dispatch(fetchChats(contextType));
    }, 300); // Небольшая задержка для предотвращения множественных вызовов
  }, [dispatch, contextType, chats.length, loading, error]);

  // Проверка наличия прав администратора
  const isAdmin = !!adminRights?.can_manage_chat;

  // Мемоизируем контекстное значение, чтобы избежать ненужных ререндеров
  const contextValue = useMemo(() => ({
    contextType,
    selectedChat,
    adminRights,
    chats,
    loading,
    error,
    isAdmin,
    selectChatById,
    clearSelectedChat: clearChat,
    refreshChats
  }), [
    contextType,
    selectedChat,
    adminRights,
    chats,
    loading,
    error,
    isAdmin,
    selectChatById,
    clearChat,
    refreshChats
  ]);

  return (
    <ChatContextInstance.Provider value={contextValue}>
      {children}
    </ChatContextInstance.Provider>
  );
};

export const InventoryChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ChatContextProvider contextType={ChatContextEnum.INVENTORY}>
    {children}
  </ChatContextProvider>
);

export const WriteOffChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ChatContextProvider contextType={ChatContextEnum.WRITE_OFF}>
    {children}
  </ChatContextProvider>
);

export const EventsChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ChatContextProvider contextType={ChatContextEnum.EVENTS}>
    {children}
  </ChatContextProvider>
); 