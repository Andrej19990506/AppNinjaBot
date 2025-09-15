import React, { useEffect, useRef, useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';

// Обновляем анимации
const slideUp = keyframes`
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
`;

const slideDown = keyframes`
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(8px);
  }
`;

const fadeOut = keyframes`
  from {
    opacity: 1;
    backdrop-filter: blur(8px);
  }
  to {
    opacity: 0;
    backdrop-filter: blur(0);
  }
`;

// Обновляем стили для Overlay
const Overlay = styled.div<{ $isOpen: boolean; $isClosing: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  visibility: ${props => props.$isOpen || props.$isClosing ? 'visible' : 'hidden'};
  animation: ${props => props.$isClosing ? fadeOut : fadeIn} 0.3s ease-in-out forwards;
  backdrop-filter: blur(8px);
`;

// Обновляем стили для DrawerContainer
const DrawerContainer = styled.div<{ $isOpen: boolean; $isClosing: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--card-background);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg);
  z-index: 1001;
  max-height: 90vh;
  overflow-y: auto;
  visibility: ${props => props.$isOpen || props.$isClosing ? 'visible' : 'hidden'};
  animation: ${props => props.$isClosing ? slideDown : slideUp} 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  border-top: 3px solid var(--orange-primary);
  will-change: transform;

  /* Стилизация скроллбара */
  scrollbar-width: thin;
  scrollbar-color: var(--primary-color) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--primary-color);
    border-radius: 20px;
    border: 2px solid var(--card-background);
  }

  /* Добавляем плавное затухание контента внизу */
  &::after {
    content: '';
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40px;
    background: linear-gradient(to top, var(--card-background), transparent);
    pointer-events: none;
  }
`;

const DrawerHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  background-color: var(--card-background);
  z-index: 2;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  backdrop-filter: blur(8px);
  
  /* Добавляем тень при скролле */
  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--gradient-primary);
    opacity: 0.5;
  }
`;

const DrawerTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.01em;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  transition: all var(--transition-normal);
  width: 32px;
  height: 32px;

  &:hover {
    background-color: var(--hover-overlay);
    color: var(--primary-color);
    transform: rotate(90deg);
  }

  &:active {
    background-color: var(--active-overlay);
    transform: rotate(90deg) scale(0.95);
  }

  svg {
    width: 20px;
    height: 20px;
    stroke-width: 2.5;
    transition: stroke var(--transition-normal);
  }

  &:hover svg {
    stroke: var(--primary-color);
  }
`;

// Обновляем стили для DrawerContent
const DrawerContent = styled.div<{ $isClosing: boolean }>`
  padding: 24px;
  min-height: 200px;
  position: relative;
  opacity: ${props => props.$isClosing ? 0 : 1};
  transform: translateY(${props => props.$isClosing ? '20px' : '0'});
  transition: all 0.3s ease-out;
  padding-bottom: 60px;
`;

interface BottomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  customHeader?: React.ReactNode;
}

const BottomDrawer: React.FC<BottomDrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  customHeader
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      onClose();
    }, 300); // Время равно длительности анимации
  }, [onClose]);

  // Обработка клика вне контейнера
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetElement = event.target as Node;
      const footerElement = document.getElementById('app-footer');
      const isClickInsideFooter = footerElement && footerElement.contains(targetElement);
      
      // Проверяем клик на элементах тултипа или профиля
      const tooltipElement = document.querySelector('[data-tooltip-portal="true"]');
      const profileButtonElement = document.querySelector('[data-profile-button="true"]');
      const confirmationModalElement = document.querySelector('[data-confirmation-modal="true"]');
      const isClickInsideTooltip = tooltipElement && tooltipElement.contains(targetElement);
      const isClickOnProfileButton = profileButtonElement && profileButtonElement.contains(targetElement);
      const isClickInsideConfirmationModal = confirmationModalElement && confirmationModalElement.contains(targetElement);
      
      // Не закрываем, если клик внутри тултипа, на кнопке профиля или в модальном окне подтверждения
      if (isClickInsideTooltip || isClickOnProfileButton || isClickInsideConfirmationModal) {
        return;
      }
      
      if (
        drawerRef.current && 
        !drawerRef.current.contains(targetElement) && 
        !isClickInsideFooter
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  // Предотвращение прокрутки body при открытом drawer
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Блокируем закрытие при клике на оверлей, если включен специальный атрибут
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [BottomDrawer handleOverlayClick] Клик по фону, target:', e.target);
    }
    
    // Проверяем, был ли клик на кнопку профиля
    const target = e.target as HTMLElement;
    const isProfileButton = target.id === 'open-profile-button' || 
                           target.getAttribute('data-profile-button') === 'true' ||
                           target.closest('[data-profile-button="true"]');
    
    if (isProfileButton) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [BottomDrawer handleOverlayClick] Клик по кнопке профиля, блокируем');
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    
    // Ищем открытые тултипы или профильные элементы
    const tooltipElement = document.querySelector('[data-tooltip-portal="true"]');
    const profileBtn = document.querySelector('[data-profile-button="true"]');
    
    if (tooltipElement || profileBtn) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [BottomDrawer handleOverlayClick] Найдены тултипы или профильные элементы, блокируем');
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    
    // Проверяем, был ли клик по модальному окну подтверждения
    const confirmationModal = target.closest('[data-confirmation-modal="true"]');
    if (confirmationModal) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [BottomDrawer handleOverlayClick] Клик по модальному окну подтверждения, блокируем');
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [BottomDrawer handleOverlayClick] Закрываем диалог');
    }
    handleClose();
  };

  // Обработка нажатия клавиши Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  if (!shouldRender) return null;

  return (
    <>
      <Overlay 
        $isOpen={isOpen} 
        $isClosing={isClosing} 
        onClick={handleOverlayClick}
      />
      <DrawerContainer 
        ref={drawerRef} 
        $isOpen={isOpen} 
        $isClosing={isClosing}
      >
        {customHeader || (
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <CloseButton onClick={handleClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </CloseButton>
          </DrawerHeader>
        )}
        <DrawerContent $isClosing={isClosing}>
          {children}
        </DrawerContent>
      </DrawerContainer>
    </>
  );
};

export default BottomDrawer; 