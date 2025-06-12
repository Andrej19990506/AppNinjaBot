import React from 'react';
import styled, { keyframes } from 'styled-components';
import { User } from '@/types/user'; // Импортируем тип User

// Анимация появления
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--background-color);
  padding: 32px 12px;
  box-sizing: border-box;
  animation: ${fadeIn} 0.7s cubic-bezier(0.4,0,0.2,1);
`;

const Card = styled.div`
  background: var(--card-background);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 48px 32px 32px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 420px;
  width: 100%;
  animation: ${fadeIn} 1s cubic-bezier(0.4,0,0.2,1);
`;

const Illustration = styled.div`
  margin-bottom: 24px;
  svg {
    width: 120px;
    height: 120px;
    display: block;
  }
`;

const Title = styled.h2`
  color: var(--primary-color);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 12px 0;
  text-align: center;
`;

const Message = styled.p`
  color: var(--text-secondary);
  font-size: 1.08rem;
  line-height: 1.6;
  margin: 0 0 24px 0;
  text-align: center;
`;

const Avatar = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--primary-transparent);
  margin-bottom: 16px;
`;

const ContactButton = styled.a`
  display: inline-block;
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 600;
  font-size: 1rem;
  padding: 12px 28px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  text-decoration: none;
  margin-top: 8px;
  transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
  &:hover {
    background: var(--primary-color);
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px) scale(1.03);
  }
`;

// Простая иконка замка (lock)
const LockSVG: React.FC = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="36" width="44" height="28" rx="8" fill="#E0E7FF" />
    <rect x="30" y="28" width="20" height="16" rx="10" fill="#6366F1" />
    <rect x="38" y="52" width="4" height="8" rx="2" fill="#6366F1" />
    <circle cx="40" cy="46" r="4" fill="#6366F1" />
  </svg>
);

const SupportBlock = styled.div`
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SupportLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--primary-color);
  color: var(--text-color-on-primary);
  font-weight: 600;
  font-size: 1.05rem;
  padding: 10px 22px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  margin-top: 8px;
  transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
  &:hover {
    background: var(--primary-dark);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px) scale(1.03);
  }
`;

const TelegramIcon = () => (
  <svg width="22" height="22" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="120" r="120" fill="#229ED9"/>
    <path d="M180.5 74.5L157.5 180.5C157.5 180.5 154.5 188.5 146.5 185.5L104.5 153.5L87.5 166.5C87.5 166.5 86 167.5 84.5 167.5L87.5 143.5L157.5 87.5C157.5 87.5 160.5 85.5 157.5 84.5C154.5 83.5 151.5 85.5 151.5 85.5L72.5 120.5C72.5 120.5 69.5 121.5 70.5 124.5C71.5 127.5 75.5 128.5 75.5 128.5L99.5 135.5L146.5 104.5C146.5 104.5 148.5 103.5 149.5 105.5C150.5 107.5 148.5 109.5 148.5 109.5L110.5 143.5L110.5 143.5" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Определяем пропсы для компонента
interface NoGroupAssignedProps {
  user: User | null;
}

const NoGroupAssigned: React.FC<NoGroupAssignedProps> = ({ user }) => {
  const userName = user?.first_name || 'Пользователь';
  const userAvatar = user?.photo_url || 'https://via.placeholder.com/60/CCCCCC/808080?text=...'; // Заглушка, если фото нет

  return (
    <Container>
      <Card>
        <Avatar src={userAvatar} alt={`Аватар ${userName}`} />
        <Title>Нет доступа к рабочим группам</Title>
        <Message>
          {userName}, вы пока не добавлены ни в одну рабочую группу.<br />
          Попросите администратора добавить вас, чтобы начать работу в системе.
        </Message>
        <SupportBlock>
          <div style={{ color: '#888', fontSize: '1rem', marginBottom: 4, textAlign: 'center' }}>
            Если вы считаете, что это ошибка — обратитесь в техподдержку:
          </div>
          <SupportLink href="https://t.me/+HU1WcpcswddlNjI6" target="_blank" rel="noopener noreferrer">
            <TelegramIcon />
            NinjaPizzaBot Тех. Поддержка
          </SupportLink>
        </SupportBlock>
      </Card>
    </Container>
  );
};

export default NoGroupAssigned; 