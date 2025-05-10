import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { registerForShift, selectIsRegistered, selectIsLoading, selectError } from '../../store/slices/courierSlice';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import SettingsTooltip from './SettingsTooltip';


import {
    ProfileContainer,
    AvatarWrapper,
    AvatarContainer,
    Avatar,
    CourierName,
    StatusText,
    RegisterButton,
    LoadingOverlay,
    LoadingSpinner
} from './CourierProfile.styles';
import styled from 'styled-components';

// Добавляем стили для значка старшего курьера
const SeniorCourierBadge = styled.div`
    position: absolute;
    top: -8px;
    right: -8px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.3);
    z-index: 5;
    border: 3px solid var(--card-background);
    
    &::before {
        content: '⭐';
        font-size: 20px;
        line-height: 1;
    }
`;

interface SettingsIconProps {
    isActive?: boolean;
    onClick: (e: React.MouseEvent) => void;
}

// Добавляем стили для значка настроек
const SettingsIconWrapper = styled.div<{ isActive?: boolean }>`
    position: absolute;
    top: -8px;
    right: -8px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${props => props.isActive ? 'var(--primary-dark)' : 'var(--primary-color)'};
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: ${props => props.isActive 
        ? '0 4px 12px rgba(var(--primary-rgb), 0.5)' 
        : '0 2px 8px rgba(var(--primary-rgb), 0.3)'};
    z-index: 5;
    border: 3px solid var(--card-background);
    cursor: pointer;
    transition: var(--transition-normal);
    transform: ${props => props.isActive ? 'rotate(45deg)' : 'rotate(0deg)'};
    
    &::before {
        content: '⚙️';
        font-size: 20px;
        line-height: 1;
    }

    &:hover {
        transform: rotate(45deg);
        background: var(--primary-dark);
        box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.5);
    }
    
    &:active {
        transform: rotate(90deg);
        background: var(--primary-dark);
    }
`;

const SettingsIcon = React.forwardRef<HTMLDivElement, SettingsIconProps>(
    ({ isActive, onClick }, ref) => {
        return (
            <SettingsIconWrapper 
                isActive={isActive} 
                onClick={onClick} 
                ref={ref}
            />
        );
    }
);

// Добавляем контейнер для тултипа
const TooltipWrapper = styled.div`
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1000;
`;

interface CourierProfileProps {
    onRegisterClick: () => void;
    isSeniorCourier?: boolean;
    onOpenShiftAccess?: () => void;
}

// Используем memo для предотвращения лишних рендеров
const CourierProfile = memo(({ 
    onRegisterClick, 
    isSeniorCourier,
    onOpenShiftAccess
}: CourierProfileProps) => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const isRegistered = useAppSelector(selectIsRegistered);
    const isLoading = useAppSelector(selectIsLoading);
    const error = useAppSelector(selectError);
    const [showSettings, setShowSettings] = useState(false);
    const [showAccessSettings, setShowAccessSettings] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    // Мемоизируем обработчик регистрации для предотвращения лишних рендеров
    const handleRegisterClick = useCallback(async () => {
        console.log('[CourierProfile] handleRegisterClick called');
        try {
            await dispatch(registerForShift()).unwrap();
            console.log('[CourierProfile] Calling onRegisterClick');
            onRegisterClick();
        } catch (error) {
            console.error('[CourierProfile] Error in handleRegisterClick:', error);
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: error instanceof Error ? error.message : 'Ошибка при записи на смену',
                duration: 5000
            }));
        }
    }, [dispatch, onRegisterClick]);

    // Мемоизируем обработчик клика по иконке настроек
    const handleSettingsClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowSettings(true);
    }, []);

    // Мемоизируем обработчик клика вне тултипа
    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
            setShowSettings(false);
        }
    }, []);

    // Эффект для обработки клика вне тултипа
    useEffect(() => {
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [handleClickOutside]);

    // Обработчик открытия модального окна настроек доступа
    const handleOpenShiftAccess = useCallback(() => {
        setShowSettings(false);
        if (onOpenShiftAccess) {
            onOpenShiftAccess();
        }
    }, [onOpenShiftAccess]);

    console.log('CourierProfile рендерится, showSettings =', showSettings);

    return (
        <>
            <ProfileContainer>
                <AvatarWrapper>
                    <AvatarContainer>
                        <Avatar 
                            src={user?.photo_url || defaultAvatar} 
                            alt={`${user?.first_name} ${user?.last_name}`}
                            onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.src = defaultAvatar;
                            }}
                        />
                        {isLoading && (
                            <LoadingOverlay>
                                <LoadingSpinner />
                            </LoadingOverlay>
                        )}
                    </AvatarContainer>
                    {isSeniorCourier ? (
                        <SettingsIcon 
                            onClick={handleSettingsClick}
                            isActive={showSettings}
                            ref={settingsRef}
                        />
                    ) : (
                        <SeniorCourierBadge />
                    )}
                </AvatarWrapper>
                <CourierName>
                    {user?.first_name} {user?.last_name}
                </CourierName>
                <StatusText isRegistered={isRegistered}>
                    {isRegistered 
                        ? '✅ Вы записаны на смену' 
                        : 'Вы еще не записались на смену'}
                </StatusText>
                {!isRegistered && (
                    <RegisterButton 
                        onClick={handleRegisterClick}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Регистрация...' : 'Записаться на смену'}
                    </RegisterButton>
                )}
            </ProfileContainer>

            {showSettings && (
                <TooltipWrapper>
                    <SettingsTooltip 
                        onClose={() => setShowSettings(false)}
                        onOpenShiftAccess={handleOpenShiftAccess}
                    />
                </TooltipWrapper>
            )}

        </>
    );
});

export default CourierProfile; 