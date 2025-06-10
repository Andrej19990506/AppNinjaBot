import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

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
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <Container>
      <ErrorCard>
        <TelegramIcon>
          <AnimatedTelegramSVG />
        </TelegramIcon>
        <Title>Доступ только через Telegram</Title>
        <Message>
          Это приложение работает только внутри Telegram.<br />
          Пожалуйста, откройте его через Telegram-бота.
        </Message>
        <TechInfo>
          <strong>Техническая информация:</strong><br />
          {error}
        </TechInfo>
        <TelegramButton href="https://t.me/NinjaSlovtsova_bot" target="_blank" rel="noopener noreferrer">
          <TelegramIcon><AnimatedTelegramSVG /></TelegramIcon>
          Открыть в Telegram
        </TelegramButton>
      </ErrorCard>
    </Container>
  );
};

export default TelegramAccessError; 