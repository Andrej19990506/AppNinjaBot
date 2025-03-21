import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { registerForShift, selectIsRegistered, selectIsLoading, selectError } from '../../store/slices/courierSlice';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import CourierCalendar from '../CourierSchedule/CourierCalendar';
import {
    ProfileContainer,
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
    background: var(--primary-color);
    color: white;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 4px;

    &::before {
        content: '⭐';
        font-size: 10px;
    }
`;

interface CourierProfileProps {
    onRegisterClick: () => void;
    isSeniorCourier?: boolean;
}

const CourierProfile: React.FC<CourierProfileProps> = ({ onRegisterClick, isSeniorCourier }) => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const isRegistered = useAppSelector(selectIsRegistered);
    const isLoading = useAppSelector(selectIsLoading);
    const error = useAppSelector(selectError);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Временные данные для демонстрации (замените на реальные данные из API)
    const [shifts] = useState([
        {
            userId: 1,
            firstName: "Иван",
            lastName: "Петров",
            date: "2024-03-15",
            avatarUrl: undefined
        },
        {
            userId: 2,
            firstName: "Анна",
            lastName: "Сидорова",
            date: "2024-03-15",
            avatarUrl: undefined
        }
    ]);

    const handleRegisterClick = async () => {
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
    };

    const handleShiftSelect = async (date: Date, shiftType: 'day' | 'night', slotIndex: number) => {
        console.log('[CourierProfile] handleShiftSelect called:', { date, shiftType, slotIndex });
        try {
            console.log('[CourierProfile] Dispatching registerForShift');
            await dispatch(registerForShift()).unwrap();
            console.log('[CourierProfile] registerForShift success');
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: `Вы успешно записались на ${shiftType === 'day' ? 'дневную' : 'вечернюю'} смену ${date.toLocaleDateString()}`,
                duration: 3000
            }));
        } catch (error) {
            console.error('[CourierProfile] Error in handleShiftSelect:', error);
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: error instanceof Error ? error.message : 'Ошибка при записи на смену',
                duration: 5000
            }));
        }
    };

    return (
        <>
            <ProfileContainer>
                <AvatarContainer>
                    <Avatar 
                        src={user?.photo_url || defaultAvatar} 
                        alt={`${user?.first_name} ${user?.last_name}`} 
                    />
                    {isSeniorCourier && (
                        <SeniorCourierBadge>Старший курьер</SeniorCourierBadge>
                    )}
                    {isLoading && (
                        <LoadingOverlay>
                            <LoadingSpinner />
                        </LoadingOverlay>
                    )}
                </AvatarContainer>
                <CourierName>
                    {user?.first_name} {user?.last_name}
                    {isSeniorCourier && ' ⭐'}
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

            {isCalendarOpen && (
                <CourierCalendar
                    onShiftSelect={handleShiftSelect}
                    currentUserId={String(user?.id || 0)}
                    currentUserAvatar={user?.photo_url || undefined}
                    currentUserName={`${user?.first_name} ${user?.last_name}`}
                    onClose={() => setIsCalendarOpen(false)}
                />
            )}
        </>
    );
};

export default CourierProfile; 