import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { collectErrorReport, formatErrorReport, copyErrorReportToClipboard, saveErrorReportToStorage, ErrorReport } from '@shared/utils/errorReporter';

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

const ErrorIcon = styled.div`
  color: white;
  font-size: 36px;
  font-weight: 900;
  line-height: 1;
  z-index: 2;
  position: relative;
  animation: ${shake} 0.5s ease-in-out 0.5s;
`;

// Функция для получения иконки в зависимости от типа ошибки
const getErrorIcon = (errorType: ErrorType) => {
  switch (errorType) {
    case 'network':
      return '📡';
    case 'server':
      return '⚠️';
    case 'config':
      return '⚙️';
    case 'data':
      return '📊';
    default:
      return '!';
  }
};

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

const TechnicalButton = styled.button`
  background: var(--gray-100);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: var(--radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
  margin: 8px 4px;
  
  &:hover {
    background: var(--gray-200);
    border-color: var(--primary-color);
  }
`;

const CopyButton = styled(TechnicalButton)`
  background: var(--success-color);
  color: white;
  border-color: var(--success-color);
  
  &:hover {
    background: var(--success-dark);
    border-color: var(--success-dark);
  }
`;

const TechnicalDetailsContainer = styled.div`
  background: var(--gray-50);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin: 16px 0;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
`;

const SuccessMessage = styled.div`
  color: var(--success-color);
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 8px;
  text-align: center;
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

// Типы ошибок для лучшей классификации
type ErrorType = 'network' | 'server' | 'data' | 'config' | 'unknown';

interface ErrorDetails {
  type: ErrorType;
  title: string;
  message: string;
  technicalDetails: string;
  suggestedActions: string[];
}

// Функция для анализа и классификации ошибок
const analyzeError = (error: string | undefined): ErrorDetails => {
  if (!error) {
    return {
      type: 'unknown',
      title: 'Неизвестная ошибка',
      message: 'Произошла неизвестная ошибка при инициализации приложения.',
      technicalDetails: 'Ошибка не определена',
      suggestedActions: ['Обратитесь в техническую поддержку']
    };
  }

  const errorLower = error.toLowerCase();
  
  // Сетевые ошибки
  if (errorLower.includes('network error') || 
      errorLower.includes('failed to fetch') || 
      errorLower.includes('connection refused') ||
      errorLower.includes('timeout') ||
      errorLower.includes('сервер недоступен')) {
    return {
      type: 'network',
      title: 'Проблема с подключением',
      message: 'Не удается подключиться к серверу. Проверьте интернет-соединение.',
      technicalDetails: error,
      suggestedActions: [
        'Проверьте интернет-соединение',
        'Если проблема повторяется, обратитесь в поддержку'
      ]
    };
  }
  
  // Ошибки сервера (5xx)
  if (errorLower.includes('http 5') || 
      errorLower.includes('500') || 
      errorLower.includes('502') || 
      errorLower.includes('503') ||
      errorLower.includes('критическая ошибка проверки сервера')) {
    return {
      type: 'server',
      title: 'Ошибка сервера',
      message: 'На сервере произошла техническая ошибка. Мы работаем над исправлением.',
      technicalDetails: error,
      suggestedActions: [
        'Попробуйте через несколько минут',
        'Обратитесь в техническую поддержку'
      ]
    };
  }
  
  // Ошибки данных/конфигурации
  if (errorLower.includes('настройки группы не настроены') ||
      errorLower.includes('группа не найдена') ||
      errorLower.includes('пользователь не найден')) {
    return {
      type: 'config',
      title: 'Проблема с настройками',
      message: 'Обнаружена проблема с настройками вашего аккаунта или группы.',
      technicalDetails: error,
      suggestedActions: [
        'Обратитесь к администратору для настройки параметров',
        'Свяжитесь с технической поддержкой'
      ]
    };
  }
  
  // Ошибки данных
  if (errorLower.includes('ошибка инициализации') ||
      errorLower.includes('данные пользователя') ||
      errorLower.includes('профиль недоступен')) {
    return {
      type: 'data',
      title: 'Ошибка данных',
      message: 'Не удалось загрузить данные пользователя или группы.',
      technicalDetails: error,
      suggestedActions: [
        'Проверьте подключение к интернету',
        'Обратитесь в техническую поддержку'
      ]
    };
  }
  
  // Неизвестная ошибка
  return {
    type: 'unknown',
    title: 'Неизвестная ошибка',
    message: 'Произошла неожиданная ошибка при инициализации приложения.',
    technicalDetails: error,
    suggestedActions: [
      'Обратитесь в техническую поддержку с описанием проблемы'
    ]
  };
};

const ServerErrorModal: React.FC<ServerErrorModalProps> = ({ 
  isOpen, 
  onClose, 
  onRetry, 
  error 
}) => {
  const [errorReport, setErrorReport] = useState<ErrorReport | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Анализируем ошибку
  const errorDetails = analyzeError(error);
  
  // Собираем детальный отчет об ошибке
  React.useEffect(() => {
    if (isOpen && error) {
      const report = collectErrorReport(
        new Error(error),
        {
          user: null, // Можно передать из props если нужно
          reduxState: null, // Можно передать из props если нужно
        }
      );
      
      setErrorReport(report);
      saveErrorReportToStorage(report);
      
      console.error('🚨 [ServerErrorModal] Детальный отчет об ошибке:', report);
    }
  }, [isOpen, error]);

  if (!isOpen) return null;



  const handleSupportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.open('https://t.me/+Sc8qu36mX-IwM2My', '_blank', 'noopener,noreferrer');
  };

  const handleCopyErrorReport = async () => {
    if (!errorReport) return;
    
    const success = await copyErrorReportToClipboard(errorReport);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleToggleTechnicalDetails = () => {
    setShowTechnicalDetails(!showTechnicalDetails);
  };

  return (
    <Container onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <IconContainer>
          <CriticalErrorIcon>
            <IconCircle>
              <ErrorIcon>{getErrorIcon(errorDetails.type)}</ErrorIcon>
            </IconCircle>
          </CriticalErrorIcon>
        </IconContainer>
        
        <Title>{errorDetails.title}</Title>
        
        <Message>
          {errorDetails.message}
        </Message>
        
        {/* Рекомендуемые действия */}
        {errorDetails.suggestedActions.length > 0 && (
          <ErrorDetails>
            <strong>Рекомендуемые действия:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              {errorDetails.suggestedActions.map((action, index) => (
                <li key={index} style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  {action}
                </li>
              ))}
            </ul>
          </ErrorDetails>
        )}
        
        {/* Технические детали */}
        {errorDetails.technicalDetails && (
          <ErrorDetails>
            <strong>Технические детали ошибки:</strong>
            <span>{errorDetails.technicalDetails}</span>
          </ErrorDetails>
        )}

        {/* Кнопки для работы с отчетом об ошибке */}
        {errorReport && (
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <TechnicalButton onClick={handleToggleTechnicalDetails}>
              {showTechnicalDetails ? 'Скрыть' : 'Показать'} детальную информацию
            </TechnicalButton>
            <CopyButton onClick={handleCopyErrorReport}>
              📋 Копировать отчет об ошибке
            </CopyButton>
            {copySuccess && (
              <SuccessMessage>
                ✅ Отчет скопирован в буфер обмена!
              </SuccessMessage>
            )}
          </div>
        )}

        {/* Детальная техническая информация */}
        {showTechnicalDetails && errorReport && (
          <TechnicalDetailsContainer>
            {formatErrorReport(errorReport)}
          </TechnicalDetailsContainer>
        )}
        
        <ActionsContainer>
          {/* Кнопка поддержки - показываем всегда */}
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
