import React, { useCallback, memo, useState, useEffect, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@/shared/store/hooks';
import { selectIsRegistered, selectIsLoading } from '@features/courierSchedule/store/courierSlice/courierSelectors';
import { selectUsersById } from '@shared/store/userSlice/userSelectors';
import { addNotification } from '@shared/store/notificationSlice/notificationSlice';
import defaultAvatar from '@/assets/images/Ninja.jpg';
import { registerForShift } from '@features/courierSchedule/store/courierSlice/courierThunks';
import CourierProfileDialog from '@/features/courierSchedule/components/CourierProfileDialog';

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
import { NotificationTypes } from '@/shared/store/notificationSlice/notificationTypes';

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
    const [showEditDialog, setShowEditDialog] = useState(false);

    // --- Корректно приводим targetUserId к числу ---
    const numericTargetUserId = targetUserId !== undefined && targetUserId !== null ? Number(targetUserId) : undefined;
    const isOwnProfile = numericTargetUserId === undefined || numericTargetUserId === user?.id;
    const profileData = isOwnProfile ? user : (numericTargetUserId !== undefined ? usersById[numericTargetUserId] : null);

    const displayFirstName = profileData?.first_name || '';
    const displayLastName = profileData?.last_name || '';
    const displayPhotoUrl = profileData?.photo_url || defaultAvatar;
    const displayName = `${displayFirstName} ${displayLastName}`.trim();

    // ЛОГ: выводим актуального пользователя из редакса
    console.log('[CourierProfile] user из редакса:', user);

    const handleRegisterClick = useCallback(async () => {
        if (!onRegisterClick || !user) return;
        console.log('[CourierProfile] handleRegisterClick called');
        try {
            await dispatch(registerForShift()).unwrap();
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

    const handleEditClick = useCallback(() => {
        setShowEditDialog(true);
    }, []);

    const handleCloseEditDialog = useCallback(() => {
        setShowEditDialog(false);
    }, []);

    // Заглушка для onSave (CourierProfileDialog сам обновляет профиль)
    const handleProfileSave = async () => {
        setShowEditDialog(false);
        return Promise.resolve();
    };

    if (isModal && !isOpen && !isClosing) {
        return null;
    }

    console.log('CourierProfile рендерится, isModal:', isModal, 'profileUserId:', numericTargetUserId);

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
            {isOwnProfile && (
                <ProfileButton onClick={handleEditClick} style={{ marginTop: 8, background: 'var(--button-secondary-bg)' }}>
                    Редактировать
                </ProfileButton>
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

    return (
        <>
            {profileContent}
            {showEditDialog && (
                <CourierProfileDialog
                    isOpen={showEditDialog}
                    onClose={handleCloseEditDialog}
                    chatId={user?.groups?.find(g => g.group_type === 'courier')?.chat_id?.toString()}
                    onSave={isOwnProfile ? handleProfileSave : undefined}
                />
            )}
        </>
    );
});

export default CourierProfile; 