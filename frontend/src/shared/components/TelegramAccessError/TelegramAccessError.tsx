import React, { useEffect, useState, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { axiosInstance } from '@shared/api/api';

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
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  
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
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [error]);

  // Render Telegram Login Widget for browser auth (no Telegram.WebApp.initData)
  useEffect(() => {
    if (error !== 'AUTH_REQUIRED') return;
    if (!botUsername) return;
    if (!widgetContainerRef.current) return;

    // Telegram widget expects to be loaded as a script tag with data-* attrs.
    const container = widgetContainerRef.current;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');

    // Use same-origin callback in production (nginx proxies /v1/* to backend).
    const authUrl = `${window.location.origin}/v1/auth/telegram/login`;
    script.setAttribute('data-auth-url', authUrl);

    container.appendChild(script);
  }, [error, botUsername]);

  const isAuthRequired = error === 'AUTH_REQUIRED';

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
        {isAuthRequired ? (
          <div ref={widgetContainerRef} />
        ) : (
          <TelegramButton 
            href={`https://t.me/${botUsername}`} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <TelegramIcon>
              <AnimatedTelegramSVG />
            </TelegramIcon>
            <TelegramButtonText>
              Войти через Telegram
            </TelegramButtonText>
          </TelegramButton>
        )}

        {/* Подсказка */}
        <Hint>
          {isAuthRequired 
            ? 'Нажмите “Войти через Telegram”, чтобы авторизоваться в браузере'
            : 'Пожалуйста, откройте приложение через Telegram-бота для корректной работы'}
        </Hint>
      </Content>
    </Container>
  );
};

export default TelegramAccessError; 