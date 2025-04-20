import React, { useCallback, memo, useState, useEffect, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { registerForShift, selectIsRegistered, selectIsLoading } from '../../store/slices/courierSlice';
import { selectUsersById } from '../../store/slices/userSlice';
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

// Добавляем стили для модального окна
const ModalOverlay = styled.div<{ $isOpen: boolean, $isClosing: boolean }>`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    opacity: ${props => props.$isClosing ? 0 : 1};
    transition: opacity 0.3s ease;
    backdrop-filter: blur(4px);
`;

const ModalContent = styled.div<{ $isClosing: boolean }>`
    background-color: var(--card-background);
    border-radius: var(--radius-lg);
    padding: 24px;
    width: 90%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
    opacity: ${props => props.$isClosing ? 0 : 1};
    transform: ${props => props.$isClosing ? 'translateY(20px)' : 'translateY(0)'};
    transition: all 0.3s ease;
`;

const CloseButton = styled.button`
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    font-size: 1.8rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    line-height: 1;

    &:hover {
        color: var(--text-color);
    }
`;

const ProfileButton = styled.button`
    padding: 12px 16px;
    border-radius: var(--radius);
    border: none;
    background: var(--gradient-primary);
    color: white;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    margin-top: 16px;
    width: 100%;
    transition: all var(--transition-fast);

    &:hover {
        transform: var(--hover-transform);
        box-shadow: var(--shadow-md);
    }

    &:active {
        transform: var(--active-transform);
    }
`;

interface CourierProfileProps {
    onRegisterClick?: () => void;
    isSeniorCourier?: boolean;
    isLoadingSettings?: boolean;
    targetUserId?: string | number | null;
    isOpen?: boolean;
    onClose?: () => void;
    isModal?: boolean;
    hideOwnStatus?: boolean;
}

const CourierProfile = memo(({ 
    onRegisterClick, 
    isSeniorCourier,
    isLoadingSettings,
    targetUserId,
    isOpen = false,
    onClose,
    isModal = false,
    hideOwnStatus = false
}: CourierProfileProps) => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const usersById = useAppSelector(selectUsersById);
    const isRegistered = useAppSelector(selectIsRegistered);
    const isLoadingProfile = useAppSelector(selectIsLoading);
    const [isClosing, setIsClosing] = useState(false);

    const profileUserId = useMemo(() => {
        const id = targetUserId ?? user?.id;
        if (typeof id === 'string') return parseInt(id, 10);
        return id ?? null;
    }, [targetUserId, user?.id]);

    const userInfoFromRedux = useMemo(() => 
        profileUserId ? usersById[profileUserId] : null, 
        [usersById, profileUserId]
    );

    const displayFirstName = userInfoFromRedux?.first_name ?? (profileUserId === user?.id ? user?.first_name : '?');
    const displayLastName = userInfoFromRedux?.last_name ?? (profileUserId === user?.id ? user?.last_name : '');
    const displayPhotoUrl = userInfoFromRedux?.photo_url ?? (profileUserId === user?.id ? user?.photo_url : defaultAvatar);
    const displayName = `${displayFirstName} ${displayLastName}`.trim();

    const handleRegisterClick = useCallback(async () => {
        if (!onRegisterClick || !user) return;
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
    }, [dispatch, onRegisterClick, user]);

    const handleClose = useCallback(() => {
        if (onClose) {
            setIsClosing(true);
            setTimeout(() => {
                onClose();
                setIsClosing(false);
            }, 300);
        }
    }, [onClose]);

    if (isModal && !isOpen && !isClosing) {
        return null;
    }

    console.log('CourierProfile рендерится, isModal:', isModal, 'profileUserId:', profileUserId);

    const profileContent = (
        <ProfileContainer>
            <AvatarWrapper>
                <AvatarContainer>
                    <Avatar 
                        src={displayPhotoUrl || defaultAvatar}
                        alt={displayName}
                        onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = defaultAvatar;
                        }}
                    />
                    {isLoadingProfile && (
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
                {displayName}
            </CourierName>
            {!hideOwnStatus && profileUserId === user?.id && (
                 <StatusText $isRegistered={isRegistered}>
                    {isRegistered 
                        ? '✅ Вы записаны на смену' 
                        : 'Вы еще не записались на смену'}
                 </StatusText>
            )}
            {!hideOwnStatus && !isRegistered && profileUserId === user?.id && (
                <RegisterButton 
                    onClick={handleRegisterClick}
                    disabled={isLoadingProfile}
                >
                    {isLoadingProfile ? 'Регистрация...' : 'Записаться на смену'}
                </RegisterButton>
            )}
        </ProfileContainer>
    );

    if (isModal) {
        return (
            <ModalOverlay $isOpen={isOpen} $isClosing={isClosing} onClick={handleClose}>
                <ModalContent $isClosing={isClosing} onClick={(e) => e.stopPropagation()}>
                    <CloseButton onClick={handleClose}>&times;</CloseButton>
                    {profileContent}
                    <ProfileButton onClick={handleClose}>
                        Закрыть
                    </ProfileButton>
                </ModalContent>
            </ModalOverlay>
        );
    }

    return profileContent;
});

export default CourierProfile; 