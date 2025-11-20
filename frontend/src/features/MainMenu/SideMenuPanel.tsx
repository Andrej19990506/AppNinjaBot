import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import CloseIcon from '@mui/icons-material/Close';
import SchoolIcon from '@mui/icons-material/School';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppSelector, useAppDispatch } from '@/shared/store/hooks';
import { RootState } from '@/shared/store/store';
import { clearUserData } from '@/shared/store/userSlice/userSlice';
import { setAuthToken } from '@/shared/api/api';
import { socketService } from '@/shared/services/socketService';

// Стилизуем контейнер как боковую панель
const SidePanelContainer = styled.div<{ $isOpen: boolean; }>`
    padding-top: 60px;    
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0; 
    width: 40%;
    max-width: 450px;
    min-width: 300px;
    background: radial-gradient(circle at top right, var(--orange-dark) 0%, var(--orange-primary) 100%);
    box-shadow: -5px 0px 15px rgba(0, 0, 0, 0.15);
    z-index: 1100;
    border-left: 1px solid var(--border-color);
    transform: translateX(${props => props.$isOpen ? '0' : '100%'});
    transition: transform 0.2s ease-out;
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom, 0);

    @media (max-width: 768px) {
        width: 60%;
    }

    @media (max-width: 480px) {
        width: 100%;
        max-width: none;
        min-width: 0;
    }
`;

const PanelHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color-on-primary, rgba(255, 255, 255, 0.2));
    background: transparent;
    position: sticky;
    top: 0;
    z-index: 1;
`;

const PanelTitle = styled.h3`
    margin: 0;
    color: var(--text-color-on-primary);
    font-size: 1.2rem;
    font-weight: 600;
`;

const ThemeToggleButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: var(--text-color-on-primary);
    cursor: pointer;
    transition: all var(--transition-normal);
    backdrop-filter: blur(10px);

    &:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
        border-color: rgba(255, 255, 255, 0.4);
    }
    
    & svg {
        font-size: 20px;
    }
`;

const CloseButton = styled.button`
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-color-on-primary);
    cursor: pointer;
    padding: 0;
    border-radius: 50%;
    transition: all var(--transition-normal);
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    backdrop-filter: blur(10px);

    &:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
        border-color: rgba(255, 255, 255, 0.4);
    }
    
    & svg {
        font-size: 32px;
    }
`;

const PanelContent = styled.div`
    padding: 24px;
    flex-grow: 1; 
    overflow-y: auto; 
    padding-bottom: 80px;
`;

const UserSection = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 32px;
    padding: 20px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
`;

const UserPhoto = styled.img`
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 12px;
    background-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border: 3px solid rgba(255, 255, 255, 0.3);
`;

const UserPhotoPlaceholder = styled(AccountCircleIcon)`
    width: 80px !important;
    height: 80px !important;
    border-radius: 50%;
    color: var(--text-color-on-primary);
    margin-bottom: 12px;
    background-color: rgba(255, 255, 255, 0.2);
    border: 3px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
`;

const UserName = styled.span`
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-on-primary);
    text-align: center;
`;

const MenuOption = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color var(--transition-normal), transform var(--transition-fast);
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border-color-on-primary, rgba(255, 255, 255, 0.1));

    &:last-child {
        margin-bottom: 0;
        border-bottom: none;
    }

    &:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateX(3px);
    }
`;

const OptionLabel = styled.span`
    color: var(--text-color-on-primary);
    font-size: 1rem;
    font-weight: 500;
`;

const OptionIcon = styled.span`
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 16px;
    color: var(--text-color-on-primary);
`;

const PanelFooter = styled.div`
    padding: 16px 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
`;

const NativeAppCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(12px);
    margin-top: 28px;
`;

const NativeAppTitle = styled.span`
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-color-on-primary);
`;

const NativeAppDescription = styled.span`
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.45;
`;

const NativeAppButton = styled.button<{ $disabled?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 18px;
    border-radius: var(--radius-md);
    background: ${props => props.$disabled ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.35)'};
    color: ${props => props.$disabled ? 'rgba(255, 255, 255, 0.5)' : 'var(--text-color-on-primary)'};
    font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.25);
    cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
    transition: transform var(--transition-fast), background-color var(--transition-normal), border-color var(--transition-normal);
    opacity: ${props => props.$disabled ? 0.6 : 1};

    &:hover {
        ${props => !props.$disabled && `
            transform: translateY(-1px);
            background: rgba(0, 0, 0, 0.45);
            border-color: rgba(255, 255, 255, 0.4);
        `}
    }
`;

const LogoutButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 18px;
    border-radius: var(--radius-md);
    background: rgba(220, 38, 38, 0.2);
    color: var(--text-color-on-primary);
    font-weight: 600;
    border: 1px solid rgba(220, 38, 38, 0.4);
    cursor: pointer;
    transition: transform var(--transition-fast), background-color var(--transition-normal), border-color var(--transition-normal);
    width: 100%;

    &:hover {
        transform: translateY(-1px);
        background: rgba(220, 38, 38, 0.3);
        border-color: rgba(220, 38, 38, 0.6);
    }
`;



interface SideMenuPanelProps { 
    isOpen: boolean;
    onClose: () => void;
}

const SideMenuPanel: React.FC<SideMenuPanelProps> = ({ 
    isOpen, 
    onClose
}) => {
    const [hasMounted, setHasMounted] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);
    const [isWinterAnimationEnabled, setIsWinterAnimationEnabled] = useState<boolean>(() => {
        const stored = localStorage.getItem('flowix-winter-decor-enabled');
        return stored !== null ? stored === 'true' : true;
    });
    const { theme, toggleTheme } = useTheme();
    const { user } = useAppSelector((state: RootState) => state.user);
    const dispatch = useAppDispatch();
    
    // Проверяем, находимся ли мы в браузере (не в Telegram Mini App)
    const isBrowser = !window.Telegram?.WebApp;

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Синхронизируем внутренний стейт с внешним
    useEffect(() => {
        if (isOpen) {
            setInternalOpen(true);
        }
    }, [isOpen]);

    const showAlert = (message: string) => {
        const webApp = window.Telegram?.WebApp;
        const nativeAlert = (webApp as any)?.showAlert;
        if (typeof nativeAlert === 'function') {
            nativeAlert(message);
        } else {
            alert(message);
        }
    };

    const handleLogout = () => {
        // Очищаем токены
        setAuthToken(null, null);
        
        // Очищаем данные пользователя из Redux
        dispatch(clearUserData());
        
        // Отключаем WebSocket
        if (socketService.isConnected() || socketService.isInitialized()) {
            try {
                socketService.disconnect();
            } catch (error) {
                console.error('[SideMenuPanel] Ошибка отключения WebSocket:', error);
            }
        }
        
        // Очищаем localStorage (кроме настроек темы и декора)
        const winterDecorEnabled = localStorage.getItem('flowix-winter-decor-enabled');
        const theme = localStorage.getItem('theme');
        localStorage.clear();
        if (winterDecorEnabled) {
            localStorage.setItem('flowix-winter-decor-enabled', winterDecorEnabled);
        }
        if (theme) {
            localStorage.setItem('theme', theme);
        }
        
        // Перезагружаем страницу для повторной авторизации
        window.location.reload();
    };

    const handleTutorialClick = () => {
        // Сразу показываем обучающие материалы под панелью
        window.dispatchEvent(new CustomEvent('startTutorialTransition'));
        
        // Запускаем анимацию закрытия панели
        setInternalOpen(false);
        
        // Ждем завершения анимации закрытия панели
        setTimeout(() => {
            // Закрываем панель окончательно
            onClose();
            // Сигнализируем что переход завершен
            window.dispatchEvent(new CustomEvent('openTutorialMaterials'));
        }, 200);
    };

    const handleCloseClick = () => {
        // Запускаем анимацию закрытия панели
        setInternalOpen(false);
        // Ждем завершения анимации
        setTimeout(() => {
            onClose();
        }, 200);
    };

    const handleThemeToggle = () => {
        toggleTheme();
    };

    const handleWinterToggle = () => {
        const next = !isWinterAnimationEnabled;
        setIsWinterAnimationEnabled(next);
        localStorage.setItem('flowix-winter-decor-enabled', String(next));
        window.dispatchEvent(new CustomEvent('winterDecorToggle', { detail: { enabled: next } }));
    };

    useEffect(() => {
        const syncHandler = (event: CustomEvent<{ enabled: boolean }>) => {
            setIsWinterAnimationEnabled(event.detail.enabled);
            localStorage.setItem('flowix-winter-decor-enabled', String(event.detail.enabled));
        };

        const listener = syncHandler as EventListener;
        window.addEventListener('winterDecorStateChanged', listener);

        return () => {
            window.removeEventListener('winterDecorStateChanged', listener);
        };
    }, []);

    if (!hasMounted && !isOpen) {
        return null;
    }

    // Не рендерим компонент если панель закрыта и анимация завершена
    if (!isOpen && !internalOpen) {
        return null;
    }

    return (
        <SidePanelContainer $isOpen={internalOpen}>
            <PanelHeader>
                <PanelTitle>Меню</PanelTitle>
                <ThemeToggleButton onClick={handleThemeToggle} aria-label="Сменить тему">
                    {theme === 'dark' ? <LightModeIcon fontSize="inherit" /> : <DarkModeIcon fontSize="inherit" />}
                </ThemeToggleButton>
            </PanelHeader>

            <PanelContent>
                {/* Секция пользователя */}
                <UserSection>
                    {user?.photo_url ? (
                        <UserPhoto src={user.photo_url} alt="User" />
                    ) : (
                        <UserPhotoPlaceholder />
                    )}
                    <UserName>
                        {user?.first_name || user?.username || 'Пользователь'}
                    </UserName>
                </UserSection>

                {/* Опции меню */}
                <MenuOption onClick={handleTutorialClick}>
                    <OptionLabel>Обучающие материалы</OptionLabel>
                    <OptionIcon><SchoolIcon fontSize="inherit" /></OptionIcon>
                </MenuOption>
                <MenuOption onClick={handleWinterToggle}>
                    <OptionLabel>
                        {isWinterAnimationEnabled ? 'Выключить зимнюю анимацию' : 'Включить зимнюю анимацию'}
                    </OptionLabel>
                    <OptionIcon><AcUnitIcon fontSize="inherit" /></OptionIcon>
                </MenuOption>

                <NativeAppCard>
                    <NativeAppTitle>Flowix App для Android / iOS</NativeAppTitle>
                    <NativeAppDescription>
                        Продолжайте работу в нативном приложении: быстрый QR-сканер, офлайн-режим и мгновенный вход через Telegram.
                    </NativeAppDescription>
                    <NativeAppButton $disabled={true} disabled>
                        В разработке
                    </NativeAppButton>
                </NativeAppCard>
                
                {/* Кнопка выхода только для браузера */}
                {isBrowser && (
                    <MenuOption onClick={handleLogout} style={{ marginTop: '24px', background: 'rgba(220, 38, 38, 0.1)', borderColor: 'rgba(220, 38, 38, 0.3)' }}>
                        <OptionLabel style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Выйти из аккаунта</OptionLabel>
                        <OptionIcon><LogoutIcon fontSize="inherit" /></OptionIcon>
                    </MenuOption>
                )}
                {/* <MenuOption onClick={handleCompetitionsClick}>
                    <OptionLabel>Конкурсы</OptionLabel>
                    <OptionIcon><EventIcon fontSize="inherit" /></OptionIcon>
                </MenuOption> */}
            </PanelContent>

            <PanelFooter>
                <CloseButton onClick={handleCloseClick} aria-label="Закрыть панель">
                    <CloseIcon fontSize="inherit" />
                </CloseButton>
            </PanelFooter>
        </SidePanelContainer>
    );
};

export default SideMenuPanel; 