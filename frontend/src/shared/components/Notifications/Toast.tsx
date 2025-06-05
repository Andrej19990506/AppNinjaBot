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

const StyledTooltip = styled.div<{ type: 'info' | 'success' | 'error' }>`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: ${slideIn} 0.3s ease-out;
  z-index: 1000;
  max-width: 300px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background-color: ${({ type }) => 
    type === 'info' ? '#3498db' : 
    type === 'success' ? '#2ecc71' : 
    '#e74c3c'};
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
  pointer-events: none;
`;

const Tooltip: React.FC<TooltipProps> = ({ message, type, duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <StyledTooltip type={type}>
      <TooltipMessage>{message}</TooltipMessage>
      <CloseButton onClick={() => setIsVisible(false)}>×</CloseButton>
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
    const tooltip: TooltipState = {
      message,
      type,
      isVisible: true
    };
    this.tooltips.push(tooltip);
    this.notify();

    setTimeout(() => {
      this.tooltips = this.tooltips.filter(t => t !== tooltip);
      this.notify();
    }, 3000);
  }

  clear() {
    this.tooltips = [];
    this.notify();
  }
}

// Компонент-контейнер для всех уведомлений
export const TooltipContainer: React.FC = () => {
  const [tooltips, setTooltips] = useState<TooltipState[]>([]);

  useEffect(() => {
    const manager = TooltipManager.getInstance();
    return manager.subscribe(setTooltips);
  }, []);

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