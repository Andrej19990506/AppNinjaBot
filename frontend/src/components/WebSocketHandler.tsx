import React from 'react';
import styled, { keyframes } from 'styled-components';
import { logger } from '../utils/logger';
import { useAppDispatch } from '../store/hooks';
import { addNotification, NotificationTypes } from '../store/slices/notificationSlice';
import useWebSocketConnection from '../hooks/useWebSocketConnection';
import { tooltipManager } from '../components/Tooltip';
import { socketService } from '../services/socket';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0) rotate(-10deg);
  }
  50% {
    transform: translateY(-10px) rotate(5deg);
  }
`;

const zzz = keyframes`
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.5);
  }
  50% {
    opacity: 1;
    transform: translate(-15px, -15px) scale(0.75);
  }
  100% {
    opacity: 0;
    transform: translate(-30px, -30px) scale(1);
  }
`;

const questionMark = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
`;

const Overlay = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--background-color);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  opacity: ${props => props.$isVisible ? '0.97' : '0'};
  pointer-events: ${props => props.$isVisible ? 'all' : 'none'};
  animation: ${props => props.$isVisible ? fadeIn : fadeOut} 0.3s ease-out;
  transition: opacity 0.3s ease;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
`;

const IconContainer = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--primary-transparent);
  display: flex;
  justify-content: center;
  align-items: center;
  animation: ${pulse} 2s ease-in-out infinite;
  position: relative;
`;

const Icon = styled.div`
  width: 60px;
  height: 60px;
  position: relative;
  animation: ${float} 3s ease-in-out infinite;

  &::before {
    content: '?';
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    font-weight: bold;
    color: var(--primary-color);
    animation: ${questionMark} 3s ease-in-out infinite;
  }

  &::after {
    content: '';
    position: absolute;
    width: 15px;
    height: 15px;
    background: var(--primary-color);
    border-radius: 50%;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0.7;
  }
`;

const Zzz = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 24px;
  font-weight: bold;
  color: var(--primary-color);
  opacity: 0;
  animation: ${zzz} 3s ease-in-out infinite;

  &::before {
    content: '?';
    position: absolute;
    font-size: 16px;
    top: -15px;
    right: 5px;
    opacity: 0.7;
    animation: ${zzz} 3s ease-in-out infinite;
    animation-delay: 0.5s;
  }

  &::after {
    content: '?';
    position: absolute;
    font-size: 12px;
    top: -25px;
    right: 10px;
    opacity: 0.4;
    animation: ${zzz} 3s ease-in-out infinite;
    animation-delay: 1s;
  }
`;

const Message = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color);
  text-align: center;
  max-width: 80%;
`;

const MainText = styled.div`
  font-size: 1.5rem;
  font-weight: 500;
`;

const SubText = styled.div`
  font-size: 1rem;
  color: var(--text-secondary);
  opacity: 0.8;
`;

const ActionButton = styled.button`
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: var(--radius);
  font-weight: 500;
  font-size: 1rem;
  cursor: pointer;
  transition: all var(--transition-normal);
  
  &:hover {
    background: var(--primary-light);
    transform: var(--hover-transform);
  }
  
  &:active {
    background: var(--primary-dark);
    transform: var(--active-transform);
  }
`;

const WebSocketHandler: React.FC = () => {
  const dispatch = useAppDispatch();
  const { 
    isConnected,
    isAway,
    updateLastActivity
  } = useWebSocketConnection();

  // Обработка системных сообщений и уведомлений
  React.useEffect(() => {
    if (!isConnected) return;

    const handleSystemMessage = (data: any) => {
      if (data.isSystem) {
        logger.log('📢 Системное сообщение:', data.text);
        dispatch(addNotification({
          id: `system-${Date.now()}`,
          title: 'Системное сообщение',
          message: data.text,
          type: NotificationTypes.INFO
        }));
      }
    };

    socketService.on('message', handleSystemMessage);
    return () => {
      socketService.off('message');
    };
  }, [isConnected, dispatch]);

  const handleActivate = () => {
    updateLastActivity();
    tooltipManager.show('Вы снова активны', 'success');
  };

  // Рендерим оверлей только когда пользователь неактивен
  if (!isAway) return null;

  return (
    <Overlay $isVisible={isAway}>
      <ContentContainer>
        <IconContainer>
          <Icon />
          <Zzz>?</Zzz>
        </IconContainer>
        <Message>
          <MainText>
            Вы отошли?
          </MainText>
          <SubText>
            Хорошо, я пока оптимизирую нагрузку на сервер
          </SubText>
        </Message>
        <ActionButton onClick={handleActivate}>
          Я здесь
        </ActionButton>
      </ContentContainer>
    </Overlay>
  );
};

export default WebSocketHandler; 