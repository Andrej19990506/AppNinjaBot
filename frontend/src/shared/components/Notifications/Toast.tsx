import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

interface TooltipProps {
  message: string;
  type: 'info' | 'success' | 'error';
  duration?: number;
  onClose?: () => void;
}

interface TooltipState {
  message: string;
  type: 'info' | 'success' | 'error';
  isVisible: boolean;
}

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const StyledTooltip = styled.div<{ type: 'info' | 'success' | 'error'; isVisible: boolean }>`
  position: relative;
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: ${({ isVisible }) => isVisible ? slideIn : slideOut} 0.3s ease-out;
  z-index: 1000;
  max-width: 300px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background-color: ${({ type }) => 
    type === 'info' ? '#3498db' : 
    type === 'success' ? '#2ecc71' : 
    '#e74c3c'};
  pointer-events: auto;
  margin-bottom: 10px;
`;

const TooltipMessage = styled.span`
  flex-grow: 1;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  margin: 0;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`;

const TooltipContainerStyled = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  z-index: 9999;
  pointer-events: auto;
`;

const Tooltip: React.FC<TooltipProps> = ({ message, type, duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 300); // Ждем завершения анимации исчезновения
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <StyledTooltip type={type} isVisible={isVisible}>
      <TooltipMessage>{message}</TooltipMessage>
      <CloseButton onClick={() => {
        setIsVisible(false);
        setTimeout(() => {
          onClose?.();
        }, 300);
      }}>×</CloseButton>
    </StyledTooltip>
  );
};

// Менеджер уведомлений
class TooltipManager {
  private static instance: TooltipManager;
  private tooltips: TooltipState[] = [];
  private listeners: Set<(tooltips: TooltipState[]) => void> = new Set();

  private constructor() {}

  static getInstance(): TooltipManager {
    if (!TooltipManager.instance) {
      TooltipManager.instance = new TooltipManager();
    }
    return TooltipManager.instance;
  }

  subscribe(callback: (tooltips: TooltipState[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.tooltips));
  }

  show(message: string, type: 'info' | 'success' | 'error') {
    console.log('🔔 [TooltipManager] Показываем уведомление:', { message, type });
    
    const tooltip: TooltipState = {
      message,
      type,
      isVisible: true
    };
    this.tooltips.push(tooltip);
    console.log('🔔 [TooltipManager] Добавлено уведомление в список. Всего уведомлений:', this.tooltips.length);
    this.notify();

    setTimeout(() => {
      this.tooltips = this.tooltips.filter(t => t !== tooltip);
      console.log('🔔 [TooltipManager] Удалено уведомление из списка. Осталось:', this.tooltips.length);
      this.notify();
    }, 5000); // Увеличиваем с 3000 до 5000 мс
  }

  clear() {
    console.log('🔔 [TooltipManager] Очищаем все уведомления');
    this.tooltips = [];
    this.notify();
  }
}

// Компонент-контейнер для всех уведомлений
export const TooltipContainer: React.FC = () => {
  const [tooltips, setTooltips] = useState<TooltipState[]>([]);

  useEffect(() => {
    console.log('🔔 [TooltipContainer] Компонент инициализирован');
    const manager = TooltipManager.getInstance();
    const unsubscribe = manager.subscribe((newTooltips) => {
      console.log('🔔 [TooltipContainer] Получены новые уведомления:', newTooltips);
      setTooltips(newTooltips);
    });
    return unsubscribe;
  }, []);

  console.log('🔔 [TooltipContainer] Рендерим компонент с уведомлениями:', tooltips);

  return (
    <TooltipContainerStyled>
      {tooltips.map((tooltip, index) => (
        <Tooltip
          key={index}
          message={tooltip.message}
          type={tooltip.type}
          onClose={() => {
            const manager = TooltipManager.getInstance();
            manager.clear();
          }}
        />
      ))}
    </TooltipContainerStyled>
  );
};

export const tooltipManager = TooltipManager.getInstance();
export default Tooltip; 