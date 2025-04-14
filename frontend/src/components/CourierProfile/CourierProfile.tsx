import React, { useCallback, memo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { registerForShift, selectIsRegistered, selectIsLoading } from '../../store/slices/courierSlice';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';
import defaultAvatar from '../../assets/images/Ninja.jpg';


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
    z-index: 2;
    border: 3px solid var(--card-background);
    
    &::before {
        content: '⭐';
        font-size: 20px;
        line-height: 1;
    }
`;

interface CourierProfileProps {
    onRegisterClick: () => void;
    isSeniorCourier?: boolean;
    isLoadingSettings?: boolean;
}

// Используем memo для предотвращения лишних рендеров
const CourierProfile = memo(({ 
    onRegisterClick, 
    isSeniorCourier,
}: CourierProfileProps) => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const isRegistered = useAppSelector(selectIsRegistered);
    const isLoading = useAppSelector(selectIsLoading);

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

    console.log('CourierProfile рендерится');

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
                    {isSeniorCourier && (
                        <SeniorCourierBadge />
                    )}
                </AvatarWrapper>
                <CourierName>
                    {user?.first_name} {user?.last_name}
                </CourierName>
                <StatusText $isRegistered={isRegistered}>
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
        </>
    );
});

export default CourierProfile; 