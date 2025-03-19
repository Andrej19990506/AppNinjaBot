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

interface CourierProfileProps {
    onRegisterClick: () => void;
}

const CourierProfile: React.FC<CourierProfileProps> = ({ onRegisterClick }) => {
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
                    {isLoading && (
                        <LoadingOverlay>
                            <LoadingSpinner />
                        </LoadingOverlay>
                    )}
                </AvatarContainer>
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

            {isCalendarOpen && (
                <CourierCalendar
                    shifts={shifts}
                    onShiftSelect={handleShiftSelect}
                    currentUserId={user?.id || 0}
                    currentUserAvatar={user?.photo_url}
                    currentUserName={`${user?.first_name} ${user?.last_name}`}
                    onClose={() => setIsCalendarOpen(false)}
                />
            )}
        </>
    );
};

export default CourierProfile; 