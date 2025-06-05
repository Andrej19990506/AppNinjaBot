import React from 'react';
import styled, { keyframes } from 'styled-components';
import { User } from '@/types/user'; // Импортируем тип User

// Стилизованный контейнер
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 20px;
  background-color: var(--background-color);
  text-align: center;
  box-sizing: border-box;
`;

// Контейнер для контента (аватарка + текст + иконка)
const ContentWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 20px; /* Пространство между элементами */
  padding: 30px;
  background-color: var(--card-background); /* Фон карточки из темы */
  border-radius: var(--radius-lg); /* Большой радиус */
  box-shadow: var(--shadow-md); /* Тень */
  max-width: 500px; /* Ограничим ширину */
`;

// Аватарка пользователя
const Avatar = styled.img`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--primary-transparent);
`;

// Контейнер для текста (заголовок + сообщение)
const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Выравниваем текст по левому краю */
  text-align: left;
`;

// Заголовок
const Title = styled.h2`
  color: var(--text-color);
  font-size: 1.3rem; /* Немного уменьшим */
  margin: 0 0 5px 0; /* Убираем лишние отступы */
`;

// Сообщение
const Message = styled.p`
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.4;
  margin: 0;
`;

// Анимация пульсации
const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 0.9;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.05);
  }
`;

// Контейнер для анимированной иконки
const AnimatedIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${pulseAnimation} 2.5s ease-in-out infinite;
  color: var(--warning-color, var(--primary-color)); /* Используем цвет warning или основной */
`;

// Компонент SVG иконки (восклицательный знак в треугольнике)
const WarningIconSVG: React.FC = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="40" /* Размер иконки */
    height="40" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" /* Цвет берется из AnimatedIconWrapper */
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
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
      <ContentWrapper>
        <Avatar src={userAvatar} alt={`Аватар ${userName}`} />
        <TextContainer>
          <Title>{userName}, доступ ограничен!</Title>
          <Message>
            Ты не состоишь ни в одной рабочей группе (повар/курьер).
            Обратись к администратору для получения доступа.
          </Message>
        </TextContainer>
        <AnimatedIconWrapper>
          <WarningIconSVG />
        </AnimatedIconWrapper>
      </ContentWrapper>
    </Container>
  );
};

export default NoGroupAssigned; 