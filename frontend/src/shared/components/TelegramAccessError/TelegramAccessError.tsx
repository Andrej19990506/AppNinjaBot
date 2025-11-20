import React, { useEffect, useState, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { axiosInstance, authenticateWithBotToken } from '@shared/api/api';
import { socketService } from '@shared/services/socketService';
import { useAppDispatch } from '@shared/store/hooks';
import { initializeFromTelegram } from '@shared/store/userSlice/userThunks';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--background-color);
  padding: 20px;
`;

const ErrorCard = styled.div`
  background: var(--card-background);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem 2rem 2rem;
  box-shadow: var(--shadow-lg);
  max-width: 400px;
  width: 100%;
  animation: ${fadeIn} 0.7s cubic-bezier(0.4,0,0.2,1);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: 1.2rem;
  color: var(--primary-color);
  text-align: center;
  font-weight: 700;
`;

const Message = styled.p`
  margin: 0.5rem 0 1.5rem 0;
  line-height: 1.6;
  color: var(--text-color);
  text-align: center;
  font-size: 1.08rem;
`;

const TechInfo = styled.div`
  background: var(--card-background-transparent);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: var(--text-secondary);
  font-size: 0.98rem;
  text-align: center;
`;

const TelegramButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem 1.7rem;
  background: var(--gradient-primary);
  color: var(--text-color-on-primary);
  border-radius: 16px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1.1rem;
  box-shadow: 0 2px 8px rgba(34,158,217,0.10);
  margin-top: 0.5rem;
  transition: background 0.2s, transform 0.15s;
  gap: 0.7rem;
  &:hover {
    background: var(--gradient-primary);
    filter: brightness(1.08);
    transform: translateY(-2px) scale(1.04);
  }
`;

const TelegramIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  animation: ${pulse} 1.2s infinite;
`;

interface Props {
  error: string;
}

const AnimatedTelegramSVG = () => (
  <svg width="34" height="34" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="120" r="120" fill="#229ED9"/>
    <path d="M180.5 72.5L156.5 180.5C154.5 188.5 149.5 190.5 142.5 186.5L110.5 162.5L95.5 176.5C93.5 178.5 91.5 180.5 88.5 180.5L90.5 147.5L157.5 86.5C160.5 83.5 157.5 82.5 153.5 85.5L77.5 137.5L45.5 127.5C38.5 125.5 38.5 120.5 47.5 117.5L170.5 73.5C176.5 71.5 181.5 75.5 180.5 72.5Z" fill="white"/>
  </svg>
);

const TelegramAccessError: React.FC<Props> = ({ error }) => {
  const [botUsername, setBotUsername] = useState<string>('Flouix_bot');
  const [sessionId] = useState<string>(() => {
    // Генерируем session_id один раз при монтировании (без префикса auth_, он добавится в ссылке)
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  });
  const dispatch = useAppDispatch();
  const hasJoinedRoom = useRef(false);
  const authInProgress = useRef(false);
  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    // Получаем username бота с бэкенда
    const fetchBotUsername = async () => {
      try {
        const response = await axiosInstance.get('/v1/auth/bot-username');
        if (response.data?.bot_username) {
          setBotUsername(response.data.bot_username);
        }
      } catch (error) {
        console.warn('⚠️ [Auth] Не удалось получить username бота, используем дефолтный:', error);
        // Оставляем дефолтный Flouix_bot
      }
    };
    
    fetchBotUsername();
    
    // Подключаемся к WebSocket и подписываемся на комнату для получения токена
    if (error === 'AUTH_REQUIRED') {
      const setupWebSocket = async () => {
        try {
          // Инициализируем и подключаемся к WebSocket
          socketService.init();
          socketService.connect();
          
          // Ждем подключения
          const waitForConnection = () => {
            return new Promise<void>((resolve) => {
              if (socketService.isConnected()) {
                resolve();
                return;
              }
              
              const checkInterval = setInterval(() => {
                if (socketService.isConnected()) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
              
              // Таймаут 5 секунд
              setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
              }, 5000);
            });
          };
          
          await waitForConnection();
          
          if (socketService.isConnected() && !hasJoinedRoom.current) {
            // Присоединяемся к комнате для получения токена
            const roomName = `auth_session:${sessionId}`;
            await socketService.joinRoom(roomName);
            hasJoinedRoom.current = true;
            console.log(`✅ [Auth] Подключились к комнате ${roomName} для получения токена`);
            
            // Подписываемся на событие bot_auth_token
            const unsubscribe = socketService.subscribe('bot_auth_token', async (data: { token: string; session_id: string }) => {
              console.log('🔐 [Auth] Получено событие bot_auth_token:', { 
                received_session_id: data.session_id, 
                expected_session_id: sessionId,
                match: data.session_id === sessionId,
                authInProgress: authInProgress.current
              });
              
              if (data.session_id === sessionId && !authInProgress.current) {
                authInProgress.current = true;
                console.log('🔐 [Auth] Получен токен через WebSocket, начинаем авторизацию');
                
                try {
                  // Авторизуемся через токен
                  console.log('🔐 [Auth] Вызываем authenticateWithBotToken...');
                  const authResult = await authenticateWithBotToken(data.token);
                  console.log('✅ [Auth] authenticateWithBotToken успешно', {
                    hasUser: !!authResult.user,
                    hasGroups: !!authResult.groups,
                    groupsCount: authResult.groups?.length || 0
                  });
                  
                  // Формируем объект пользователя из результата авторизации
                  const mappedGroups = (authResult.groups || []).map((group: any) => ({
                    id: undefined,
                    group_id: group.group_id,
                    chat_id: group.group_id,
                    title: group.title || '',
                    chat_title: group.title || '',
                    group_type: group.group_type || '',
                    username: undefined,
                    description: undefined,
                    members_count: undefined,
                    json_metadata: undefined,
                    supplies_config: undefined,
                    created_at: undefined,
                    role: group.role || 'member',
                    is_senior_courier: group.is_senior_courier || false,
                  }));
                  
                  const user = {
                    id: authResult.user.user_id,
                    first_name: authResult.user.first_name || '',
                    last_name: authResult.user.last_name || '',
                    username: authResult.user.username || '',
                    photo_url: authResult.user.photo_url || '',
                    groups: mappedGroups,
                    isAdmin: false,
                    adminRights: {} as any
                  };
                  
                  // Диспатчим успешную инициализацию через thunk
                  console.log('🔐 [Auth] Диспатчим успешную инициализацию пользователя...');
                  // Используем fulfilled action напрямую
                  dispatch(initializeFromTelegram.fulfilled(user, ''));
                  
                  console.log('✅ [Auth] Авторизация успешна, страница обновится автоматически');
                  
                  // Отписываемся от события
                  unsubscribe();
                  
                  // Покидаем комнату
                  await socketService.leaveRoom(roomName);
                } catch (authError) {
                  console.error('❌ [Auth] Ошибка авторизации через WebSocket токен:', authError);
                  authInProgress.current = false;
                }
              } else {
                console.log('⚠️ [Auth] Событие проигнорировано:', {
                  sessionMatch: data.session_id === sessionId,
                  authInProgress: authInProgress.current
                });
              }
            });
          }
        } catch (wsError) {
          console.error('❌ [Auth] Ошибка настройки WebSocket:', wsError);
        }
      };
      
      setupWebSocket();
    }
    
    return () => {
      document.body.style.overflow = 'auto';
      // Отключаемся от WebSocket при размонтировании
      if (hasJoinedRoom.current) {
        socketService.leaveRoom(`auth_session:${sessionId}`);
      }
    };
  }, [error, sessionId, dispatch]);

  const isAuthRequired = error === 'AUTH_REQUIRED';
  const botAuthLink = `https://t.me/${botUsername}?start=auth_${sessionId}`;

  return (
    <Container>
      <ErrorCard>
        <TelegramIcon>
          <AnimatedTelegramSVG />
        </TelegramIcon>
        {isAuthRequired ? (
          <>
            <Title>Авторизация через Telegram</Title>
            <Message>
              Для доступа к приложению необходимо авторизоваться через Telegram бота.<br />
              Нажмите на кнопку ниже, чтобы перейти к авторизации.
            </Message>
            <TelegramButton href={botAuthLink} target="_blank" rel="noopener noreferrer">
              <TelegramIcon><AnimatedTelegramSVG /></TelegramIcon>
              Авторизоваться через Telegram
            </TelegramButton>
          </>
        ) : (
          <>
            <Title>Доступ только через Telegram</Title>
            <Message>
              Это приложение работает только внутри Telegram.<br />
              Пожалуйста, откройте его через Telegram-бота.
            </Message>
            <TechInfo>
              <strong>Техническая информация:</strong><br />
              {error}
            </TechInfo>
            <TelegramButton href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">
              <TelegramIcon><AnimatedTelegramSVG /></TelegramIcon>
              Открыть в Telegram
            </TelegramButton>
          </>
        )}
      </ErrorCard>
    </Container>
  );
};

export default TelegramAccessError; 