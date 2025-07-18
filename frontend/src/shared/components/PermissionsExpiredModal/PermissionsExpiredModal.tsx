import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { AnimatedIcon } from './AnimatedIcons';

interface PermissionsExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  notificationType: 'revoked_by_admin' | 'expired_automatically';
}

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(8px);
`;

const ModalContainer = styled.div`
  background: linear-gradient(135deg, 
    rgba(44, 44, 46, 0.95) 0%, 
    rgba(58, 58, 60, 0.95) 100%
  );
  border-radius: 20px;
  padding: 40px;
  width: 90%;
  max-width: 400px;
  animation: ${fadeIn} 0.3s ease-out;
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.3),
    0 10px 10px -5px rgba(0, 0, 0, 0.2);
`;

const IconContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
`;

// Убираем старый IconCircle - теперь используем AnimatedIcon

const Title = styled.h2`
  text-align: center;
  color: white;
  margin: 0 0 15px 0;
  font-size: 24px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const Message = styled.p`
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 30px 0;
  font-size: 16px;
  line-height: 1.5;
`;

const OkButton = styled.button`
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, 
    rgba(var(--primary-rgb), 0.9) 0%, 
    rgba(var(--primary-rgb), 0.7) 100%
  );
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);

  &:hover {
    background: linear-gradient(135deg, 
      rgba(var(--primary-rgb), 1) 0%, 
      rgba(var(--primary-rgb), 0.8) 100%
    );
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const PermissionsExpiredModal: React.FC<PermissionsExpiredModalProps> = ({
  isOpen,
  onClose,
  message,
  notificationType
}) => {
  const navigate = useNavigate();

  const handleOkClick = () => {
    onClose();
    
    // Переходим на главную страницу роли chef при потере прав
    navigate('/chef');
  };

  if (!isOpen) return null;

  const isRevoked = notificationType === 'revoked_by_admin';
  const title = isRevoked ? 'Права отозваны' : 'Доступ истек';
  const iconType = isRevoked ? 'revoked' : 'expired';

  return (
    <Overlay>
      <ModalContainer>
        <IconContainer>
          <AnimatedIcon type={iconType} />
        </IconContainer>
        
        <Title>{title}</Title>
        <Message>{message}</Message>
        
        <OkButton onClick={handleOkClick}>
          ОК
        </OkButton>
      </ModalContainer>
    </Overlay>
  );
}; 