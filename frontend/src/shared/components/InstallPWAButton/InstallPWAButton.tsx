import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallButton = styled.button<{ $isVisible: boolean }>`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  transition: all 0.3s ease;
  z-index: 1000;
  display: ${props => props.$isVisible ? 'flex' : 'none'};
  align-items: center;
  gap: 8px;
  opacity: ${props => props.$isVisible ? 1 : 0};
  transform: ${props => props.$isVisible ? 'translateY(0)' : 'translateY(20px)'};

  &:hover {
    background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
    box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
  }

  @media (max-width: 768px) {
    bottom: 80px;
    right: 16px;
    padding: 10px 20px;
    font-size: 13px;
  }
`;

const Icon = styled.svg`
  width: 20px;
  height: 20px;
  fill: currentColor;
`;

const InstallPWAButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Проверяем, установлено ли приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Проверяем, есть ли приложение в списке установленных
    if ((window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ Пользователь принял установку приложения');
      } else {
        console.log('❌ Пользователь отклонил установку приложения');
      }
      
      setDeferredPrompt(null);
      setIsVisible(false);
    } catch (error) {
      console.error('Ошибка при установке приложения:', error);
    }
  };

  if (isInstalled || !isVisible) {
    return null;
  }

  return (
    <InstallButton $isVisible={isVisible} onClick={handleInstallClick}>
      <Icon viewBox="0 0 24 24">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </Icon>
      Установить приложение
    </InstallButton>
  );
};

export default InstallPWAButton;

