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

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--background-color);
  padding: 24px;
  position: relative;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 500px;
  animation: ${fadeIn} 0.7s cubic-bezier(0.4, 0, 0.2, 1);
`;

const LogoContainer = styled.div`
  margin-bottom: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 8px 16px rgba(255, 107, 53, 0.3));
`;

const Logo = styled.img`
  width: 160px;
  height: 160px;
  object-fit: contain;
`;

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;
  padding: 0 20px;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 800;
  color: var(--text-color);
  margin-bottom: 16px;
  text-align: center;
  letter-spacing: -0.5px;
  line-height: 1.2;
  
  @media (max-width: 480px) {
    font-size: 28px;
  }
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 24px;
  padding: 0 8px;
  margin: 0;
`;

const TelegramButton = styled.a`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: #0088cc;
  border-radius: 20px;
  padding: 18px 36px;
  min-width: calc(100% - 48px);
  max-width: calc(100% - 48px);
  text-decoration: none;
  box-shadow: 0 6px 12px rgba(0, 136, 204, 0.4);
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 136, 204, 0.5);
  }
  
  &:active {
    transform: scale(0.97);
    opacity: 0.85;
  }
  
  @media (max-width: 480px) {
    padding: 16px 32px;
    min-width: calc(100% - 32px);
    max-width: calc(100% - 32px);
  }
`;

const TelegramIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  width: 24px;
  height: 24px;
`;

const TelegramButtonText = styled.span`
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.3px;
  
  @media (max-width: 480px) {
    font-size: 16px;
  }
`;

const Hint = styled.p`
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 32px;
  padding: 0 24px;
  line-height: 20px;
  opacity: 0.7;
`;

interface Props {
  error: string;
}

const AnimatedTelegramSVG = () => (
  <svg width="24" height="24" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  const authPollingIntervalRef = useRef<number | null>(null);
  
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
          console.log(`🔐 [Auth] Начинаем настройку WebSocket для авторизации. SessionId: ${sessionId}`);
          
          // Проверяем, не инициализирован ли уже WebSocket
          if (!socketService.isInitialized()) {
            // Инициализируем и подключаемся к WebSocket
            const wsUrl = (window as any).APP_CONFIG?.WS_URL || import.meta.env.VITE_WS_URL || 'ws://localhost:8001';
            console.log(`🔐 [Auth] Инициализируем WebSocket с URL: ${wsUrl}`);
            socketService.init(wsUrl);
          } else {
            console.log(`🔐 [Auth] WebSocket уже инициализирован, используем существующее подключение`);
          }
          
          // Подключаемся, если еще не подключены
          if (!socketService.isConnected() && !socketService.isConnecting()) {
            console.log(`🔐 [Auth] Подключаемся к WebSocket...`);
            socketService.connect();
          } else {
            console.log(`🔐 [Auth] WebSocket уже подключен или подключается`);
          }
          
          // Ждем подключения - подписываемся на изменения состояния
          const waitForConnection = () => {
            return new Promise<void>((resolve, reject) => {
              if (socketService.isConnected()) {
                console.log(`🔐 [Auth] WebSocket уже подключен`);
                resolve();
                return;
              }
              
              console.log(`🔐 [Auth] Ожидаем подключения WebSocket...`);
              
              let resolved = false;
              
              // Подписываемся на изменения состояния
              const unsubscribe = socketService.onStateChange((state) => {
                if (resolved) return;
                console.log(`🔐 [Auth] Изменение состояния WebSocket:`, state);
                if (state.isConnected) {
                  resolved = true;
                  console.log(`🔐 [Auth] WebSocket подключен через подписку!`);
                  clearInterval(checkInterval);
                  clearTimeout(timeoutId);
                  unsubscribe();
                  resolve();
                }
              });
              
              // Проверяем периодически на случай, если подписка не сработает
              const checkInterval = setInterval(() => {
                if (resolved) {
                  clearInterval(checkInterval);
                  return;
                }
                if (socketService.isConnected()) {
                  resolved = true;
                  console.log(`🔐 [Auth] WebSocket подключен через проверку!`);
                  clearInterval(checkInterval);
                  clearTimeout(timeoutId);
                  unsubscribe();
                  resolve();
                }
              }, 100);
              
              // Таймаут 15 секунд
              const timeoutId = setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  clearInterval(checkInterval);
                  unsubscribe();
                  console.log(`🔐 [Auth] Таймаут ожидания подключения WebSocket`);
                  if (socketService.isConnected()) {
                    resolve();
                  } else {
                    reject(new Error('WebSocket не подключился в течение таймаута'));
                  }
                }
              }, 15000);
            });
          };
          
          try {
            await waitForConnection();
          } catch (error) {
            console.error(`❌ [Auth] Ошибка ожидания подключения:`, error);
            return;
          }
          
          console.log(`🔐 [Auth] Проверка состояния: isConnected=${socketService.isConnected()}, hasJoinedRoom=${hasJoinedRoom.current}`);
          
          if (socketService.isConnected() && !hasJoinedRoom.current) {
            // Присоединяемся к комнате для получения токена
            const roomName = `auth_session:${sessionId}`;
            console.log(`🔐 [Auth] Подключаемся к комнате: ${roomName}`);
            const joinResult = await socketService.joinRoom(roomName);
            console.log(`🔐 [Auth] Результат подключения к комнате: ${joinResult}`);
            hasJoinedRoom.current = true;
            console.log(`✅ [Auth] Подключились к комнате ${roomName} для получения токена`);

            const stopAuthPolling = () => {
              if (authPollingIntervalRef.current) {
                window.clearInterval(authPollingIntervalRef.current);
                authPollingIntervalRef.current = null;
              }
            };

            const handleTokenAuth = async (token: string, source: 'websocket' | 'polling', unsubscribe?: () => void) => {
              if (authInProgress.current) {
                console.log(`⚠️ [Auth] Пропускаем повторную авторизацию (${source}), процесс уже идет`);
                return;
              }

              authInProgress.current = true;
              console.log(`🔐 [Auth] Получен токен через ${source}, начинаем авторизацию`);

              try {
                const authResult = await authenticateWithBotToken(token);
                console.log('✅ [Auth] authenticateWithBotToken успешно', {
                  source,
                  hasUser: !!authResult.user,
                  hasGroups: !!authResult.groups,
                  groupsCount: authResult.groups?.length || 0
                });

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

                dispatch(initializeFromTelegram.fulfilled(user, ''));
                console.log('✅ [Auth] Авторизация успешна, страница обновится автоматически');

                stopAuthPolling();
                if (unsubscribe) unsubscribe();
                await socketService.leaveRoom(roomName);
              } catch (authError) {
                console.error(`❌ [Auth] Ошибка авторизации через ${source}:`, authError);
                authInProgress.current = false;
              }
            };
            
            // Подписываемся на событие bot_auth_token
            const unsubscribe = socketService.subscribe('bot_auth_token', async (data: { token: string; session_id: string }) => {
              console.log('🔐 [Auth] Получено событие bot_auth_token:', { 
                received_session_id: data.session_id, 
                expected_session_id: sessionId,
                match: data.session_id === sessionId,
                authInProgress: authInProgress.current
              });
              
              if (data.session_id === sessionId) {
                await handleTokenAuth(data.token, 'websocket', unsubscribe);
              } else {
                console.log('⚠️ [Auth] Событие проигнорировано:', {
                  sessionMatch: data.session_id === sessionId,
                  authInProgress: authInProgress.current
                });
              }
            });

            // Fallback: поллинг, если WebSocket событие потерялось
            authPollingIntervalRef.current = window.setInterval(async () => {
              if (authInProgress.current) return;
              try {
                const response = await axiosInstance.get(`/v1/auth/bot-auth-check/${sessionId}`);
                if (response.data?.has_token && response.data?.token) {
                  console.log('🔐 [Auth] Найден токен через polling fallback');
                  await handleTokenAuth(response.data.token, 'polling', unsubscribe);
                }
              } catch (pollError) {
                console.warn('⚠️ [Auth] Ошибка polling fallback:', pollError);
              }
            }, 1500);
          }
        } catch (wsError) {
          console.error('❌ [Auth] Ошибка настройки WebSocket:', wsError);
        }
      };
      
      setupWebSocket();
    }
    
    return () => {
      document.body.style.overflow = 'auto';
      if (authPollingIntervalRef.current) {
        window.clearInterval(authPollingIntervalRef.current);
        authPollingIntervalRef.current = null;
      }
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
      <Content>
        {/* Логотип */}
        <LogoContainer>
          <Logo 
            src="/Logo.png" 
            alt="Flowix Logo"
            onError={(e) => {
              // Fallback на SVG если PNG не найден
              (e.target as HTMLImageElement).src = '/logo.svg';
            }}
          />
        </LogoContainer>

        {/* Заголовок */}
        <TextContainer>
          <Title>Добро пожаловать в Flowix</Title>
          <Subtitle>
            {isAuthRequired 
              ? 'Для доступа к приложению необходимо авторизоваться через Telegram'
              : 'Это приложение работает только внутри Telegram. Пожалуйста, откройте его через Telegram-бота.'}
          </Subtitle>
        </TextContainer>

        {/* Кнопка авторизации через Telegram */}
        <TelegramButton 
          href={isAuthRequired ? botAuthLink : `https://t.me/${botUsername}`} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <TelegramIcon>
            <AnimatedTelegramSVG />
          </TelegramIcon>
          <TelegramButtonText>
            {isAuthRequired ? 'Авторизоваться через Telegram' : 'Открыть в Telegram'}
          </TelegramButtonText>
        </TelegramButton>

        {/* Подсказка */}
        <Hint>
          {isAuthRequired 
            ? 'Нажмите на кнопку выше, чтобы перейти к авторизации через Telegram бота'
            : 'Пожалуйста, откройте приложение через Telegram-бота для корректной работы'}
        </Hint>
      </Content>
    </Container>
  );
};

export default TelegramAccessError; 