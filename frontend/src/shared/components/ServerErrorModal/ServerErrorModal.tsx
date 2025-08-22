import React from 'react';
import styled, { keyframes } from 'styled-components';

// Анимации
const fadeIn = keyframes`
  from { 
    opacity: 0; 
    transform: translateY(30px) scale(0.95); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0) scale(1); 
  }
`;

const slideIn = keyframes`
  from { transform: translateY(100%) scale(0.95); }
  to { transform: translateY(0) scale(1); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
`;

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--card-background-transparent);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  animation: ${fadeIn} 0.4s var(--transition-slow);
  
  @media (max-width: 768px) {
    padding: 0;
    align-items: flex-end;
  }
`;

const Modal = styled.div`
  background: var(--card-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  padding: 40px;
  max-width: 520px;
  width: 100%;
  text-align: center;
  animation: ${fadeIn} 0.5s var(--transition-slow);
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--gradient-primary);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  
  @media (max-width: 768px) {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-width: none;
    width: 100%;
    padding: 32px 24px 40px 24px;
    animation: ${slideIn} 0.5s var(--transition-slow);
  }
`;

const IconContainer = styled.div`
  margin-bottom: 32px;
  display: flex;
  justify-content: center;
  position: relative;
`;

const CriticalErrorIcon = styled.div`
  width: 80px;
  height: 80px;
  position: relative;
  animation: ${pulse} 2s ease-in-out infinite;
  
  &::before {
    content: '';
    position: absolute;
    top: -10px;
    left: -10px;
    right: -10px;
    bottom: -10px;
    background: radial-gradient(circle, var(--primary-transparent) 0%, transparent 70%);
    border-radius: 50%;
    animation: ${pulse} 2s ease-in-out infinite 0.5s;
  }
`;

const IconCircle = styled.div`
  width: 80px;
  height: 80px;
  background: var(--gradient-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 8px 32px var(--primary-transparent),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    right: 2px;
    bottom: 2px;
    background: var(--primary-dark);
    border-radius: 50%;
    z-index: 1;
  }
`;

const ExclamationMark = styled.div`
  color: white;
  font-size: 36px;
  font-weight: 900;
  line-height: 1;
  z-index: 2;
  position: relative;
  animation: ${shake} 0.5s ease-in-out 0.5s;
`;

const Title = styled.h2`
  color: var(--primary-color);
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 20px 0;
  line-height: 1.2;
  letter-spacing: -0.025em;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @media (max-width: 768px) {
    font-size: 1.75rem;
  }
`;

const Message = styled.p`
  color: var(--text-secondary);
  font-size: 1.125rem;
  line-height: 1.7;
  margin: 0 0 32px 0;
  font-weight: 500;
  
  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 28px;
  }
`;

const ErrorDetails = styled.div`
  background: var(--gray-50);
  border: 1px solid var(--border-color);
  padding: 20px;
  border-radius: var(--radius-lg);
  margin-bottom: 32px;
  text-align: left;
  box-shadow: var(--shadow-md);
  
  strong {
    color: var(--text-color);
    font-weight: 700;
    display: block;
    margin-bottom: 12px;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  span {
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    word-break: break-word;
    background: var(--gray-100);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    display: block;
  }
  
  @media (max-width: 768px) {
    padding: 16px;
    margin-bottom: 28px;
  }
`;

const ActionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  
  @media (max-width: 768px) {
    gap: 14px;
  }
`;

const Button = styled.button`
  background: var(--gradient-primary);
  color: var(--text-color-on-primary);
  border: none;
  padding: 16px 28px;
  border-radius: var(--radius-lg);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-slow);
  min-height: 56px;
  position: relative;
  overflow: hidden;
  letter-spacing: 0.025em;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }
  
  &:hover {
    background: var(--primary-dark);
    transform: var(--hover-transform);
    box-shadow: var(--shadow-lg);
  }
  
  &:hover::before {
    left: 100%;
  }
  
  &:active {
    transform: var(--active-transform);
  }
  
  @media (max-width: 768px) {
    padding: 18px 24px;
    min-height: 60px;
    font-size: 1.15rem;
  }
`;

const SecondaryButton = styled(Button)`
  background: var(--gray-50);
  color: var(--text-color);
  border: 2px solid var(--border-color);
  
  &:hover {
    background: var(--card-background);
    color: var(--text-color);
    box-shadow: var(--shadow-lg);
  }
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
  cursor: pointer;
  
  &:hover {
    background: var(--primary-dark);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px) scale(1.03);
  }
  
  @media (max-width: 768px) {
    padding: 18px 24px;
    min-height: 60px;
    font-size: 1.15rem;
  }
`;

const TelegramIcon = styled.div`
  width: 22px;
  height: 22px;
  
  svg {
    width: 100%;
    height: 100%;
  }
`;

const TelegramIconSVG = () => (
  <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="120" r="120" fill="#229ED9"/>
    <path d="M180.5 74.5L157.5 180.5C157.5 180.5 154.5 188.5 146.5 185.5L104.5 153.5L87.5 166.5C87.5 166.5 86 167.5 84.5 167.5L87.5 143.5L157.5 87.5C157.5 87.5 160.5 85.5 157.5 84.5C154.5 83.5 151.5 85.5 151.5 85.5L72.5 120.5C72.5 120.5 69.5 121.5 70.5 124.5C71.5 127.5 75.5 128.5 75.5 128.5L99.5 135.5L146.5 104.5C146.5 104.5 148.5 103.5 149.5 105.5C150.5 107.5 148.5 109.5 148.5 109.5L110.5 143.5L110.5 143.5" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface ServerErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  error?: string;
}

const ServerErrorModal: React.FC<ServerErrorModalProps> = ({ 
  isOpen, 
  onClose, 
  onRetry, 
  error 
}) => {
  if (!isOpen) return null;



  const handleRefresh = () => {
    window.location.reload();
  };

  const handleSupportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.open('https://t.me/+Sc8qu36mX-IwM2My', '_blank', 'noopener,noreferrer');
  };

  return (
    <Container onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <IconContainer>
          <CriticalErrorIcon>
            <IconCircle>
              <ExclamationMark>!</ExclamationMark>
            </IconCircle>
          </CriticalErrorIcon>
        </IconContainer>
        
        <Title>Критическая ошибка</Title>
        
        <Message>
          Произошла серьезная ошибка на нашей стороне.<br />
          Попробуйте перезапустить приложение.
        </Message>
        
        {error && (
          <ErrorDetails>
            <strong>Детали ошибки</strong>
            <span>{error}</span>
          </ErrorDetails>
        )}
        
        <ActionsContainer>
          
          <SecondaryButton onClick={handleRefresh}>
            Перезапустить приложение
          </SecondaryButton>
          
                     <SupportLink 
             href="https://t.me/+Sc8qu36mX-IwM2My" 
             target="_blank" 
             rel="noopener noreferrer"
             onClick={handleSupportClick}
           >
             <TelegramIcon>
               <TelegramIconSVG />
             </TelegramIcon>
             NinjaPizzaBot Тех. Поддержка
           </SupportLink>
        </ActionsContainer>
      </Modal>
    </Container>
  );
};

export default ServerErrorModal;
