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

const slideIn = keyframes`
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--background-color);
  padding: 20px;
  color: var(--text-color);
`;

const ErrorCard = styled.div`
  background-color: var(--card-background);
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: var(--shadow-lg);
  max-width: 400px;
  width: 90%;
  animation: ${fadeIn} var(--transition-slow) ease-out;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--primary-color);
  text-align: center;
`;

const Message = styled.p`
  margin: 1rem 0;
  line-height: 1.5;
  color: var(--text-secondary);
  text-align: center;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background-color: var(--primary-transparent);
  border-radius: var(--radius-sm);
  margin: 1.5rem 0;
  overflow: hidden;
`;

const Progress = styled.div`
  width: 30%;
  height: 100%;
  background-color: var(--primary-color);
  border-radius: var(--radius-sm);
  animation: ${slideIn} 1.5s ease-in-out infinite;
`;

const TelegramButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  background: var(--gradient-primary);
  color: white;
  border-radius: var(--radius);
  text-decoration: none;
  font-weight: 500;
  margin-top: 1rem;
  transition: transform var(--transition-normal);

  &:hover {
    transform: var(--hover-transform);
  }

  &:active {
    transform: var(--active-transform);
  }
`;

const TelegramIcon = styled.span`
  margin-right: 0.5rem;
  font-size: 1.2rem;
`;

interface Props {
  error: string;
}

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
        <Title>Доступ ограничен</Title>
        <Message>
          Это приложение доступно только через Telegram. Пожалуйста, откройте приложение, в Telegram.
        </Message>
        <ProgressBar>
          <Progress />
        </ProgressBar>
        <Message>
          <strong>Техническая информация:</strong>
          <br />
          {error}
        </Message>
        <TelegramButton href="https://t.me/NinjaSlovtsova_bot" target="_blank" rel="noopener noreferrer">
          <TelegramIcon>📱</TelegramIcon>
          Открыть в Telegram
        </TelegramButton>
      </ErrorCard>
    </Container>
  );
};

export default TelegramAccessError; 