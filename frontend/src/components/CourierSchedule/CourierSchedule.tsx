import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import CourierProfile from '../CourierProfile/CourierProfile';
import CourierProfileDialog from './CourierProfileDialog';
import { CourierCalendar } from './CourierCalendar/index';
import { updateCourierProfile } from '../../services/courierApi';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';
import { updateUser } from '../../store/slices/userSlice';
import { bookShift } from '../../store/slices/shiftsSlice';
import { format } from 'date-fns';
import ShiftAccessModal from '../CourierProfile/ShiftAccessModal';

const Container = styled.div`
    padding: 20px;
    max-width: 1200px;
    margin: 80px auto 0 auto;
    color: var(--text-color);
`;

const Header = styled.div`
    margin-bottom: 24px;
    text-align: center;
`;

const Title = styled.h1`
    font-size: 2rem;
    margin: 0;
    color: var(--text-color);
    margin-bottom: 8px;
`;

const Subtitle = styled.p`
    color: var(--text-secondary);
    margin: 0;
    font-size: 1rem;
`;

const ScheduleSection = styled.div`
    margin-top: 32px;
`;

const SettingsButton = styled.button`
    display: flex;
    align-items: center;
    background: var(--primary-transparent);
    color: var(--primary-color);
    border: none;
    border-radius: var(--radius-lg);
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-normal);
    margin-left: auto;
    
    &:hover {
        background: var(--primary-light);
        transform: var(--hover-transform);
    }
    
    &:active {
        transform: var(--active-transform);
    }
`;

const SettingsIcon = styled.span`
    display: inline-block;
    width: 16px;
    height: 16px;
    margin-right: 8px;
    
    &::before {
        content: '⚙️';
        font-size: 16px;
    }
`;

const CourierSchedule: React.FC = () => {
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.user.user);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const [selectedDate] = useState<Date | undefined>(undefined);
    const [showCalendar, setShowCalendar] = useState(false);
    const [showShiftAccessSettings, setShowShiftAccessSettings] = useState(false);

    const courierChatId = useMemo(() => {
        const courierGroup = user?.groups?.find(g => g.group_type === 'courier');
        if (courierGroup) {
            return String(courierGroup.chat_id);
        } else {
            return undefined;
        }
    }, [user?.groups]);

    useEffect(() => {
        if (user && (!user.first_name?.trim() || !user.last_name?.trim())) {
            setIsProfileDialogOpen(true);
        }
    }, [user]);

    const handleProfileSave = async (data: { 
        firstName: string; 
        lastName: string; 
        isSeniorCourier?: boolean; 
        seniorPassword?: string;
    }) => {
        if (!user?.id) return;

        try {
            const chatId = user.groups && user.groups.length > 0 
                ? user.groups[0].chat_id : undefined;
                
            const result = await updateCourierProfile(user.id, {
                ...data,
                chatId
            });
            
            dispatch(updateUser({
                ...user,
                first_name: data.firstName,
                last_name: data.lastName,
                is_senior_courier: data.isSeniorCourier || false
            }));

            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Данные успешно сохранены',
                duration: 3000
            }));

            return result;
        } catch (error) {
            console.error('Ошибка при сохранении данных:', error);
            
            const errorMessage = error instanceof Error 
                ? error.message 
                : 'Произошла ошибка при сохранении данных';

            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: errorMessage,
                duration: 5000
            }));

            throw error;
        }
    };

    const handleShiftSelect = async (date: Date, shiftType: 'day' | 'night', slotIndex: number) => {
        console.log('Выбрана дата:', date);
        
        if (!user?.id) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Необходимо войти в систему для бронирования смены'
            }));
            return;
        }

        try {
            await dispatch(bookShift({
                date: format(date, 'yyyy-MM-dd'),
                shiftType,
                slotIndex,
                userId: String(user.id)
            })).unwrap();

            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Смена успешно забронирована'
            }));
        } catch (error: any) {
            console.log('Ошибка при бронировании смены:', error);
            
            let errorMessage = 'Не удалось забронировать смену';
            
            try {
                const errorData = JSON.parse(error.message.split('Failed to book shift: ')[1]);
                errorMessage = errorData.error || errorMessage;
            } catch {
                errorMessage = error.message || errorMessage;
            }

            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: errorMessage
            }));
        }
    };

    const handleOpenShiftAccessSettings = () => {
        console.log('Opening shift access settings');
        setShowShiftAccessSettings(true);
    };

    const handleCloseShiftAccessSettings = () => {
        console.log('Closing shift access settings');
        setShowShiftAccessSettings(false);
    };

    return (
        <Container>
            <Header>
                <Title>Запись на смену</Title>
                <Subtitle>Выберите удобную дату для работы</Subtitle>
                
                {user?.is_senior_courier && (
                    <SettingsButton onClick={handleOpenShiftAccessSettings}>
                        <SettingsIcon />
                        Настройки записи
                    </SettingsButton>
                )}
            </Header>

            {showCalendar ? (
                <ScheduleSection>
                    <CourierCalendar
                        onShiftSelect={handleShiftSelect}
                        selectedDate={selectedDate}
                        currentUserId={String(user?.id || '')}
                        currentUserAvatar={user?.photo_url || undefined}
                        currentUserName={`${user?.first_name || ''} ${user?.last_name || ''}`}
                        onClose={() => setShowCalendar(false)}
                        chatId={courierChatId}
                    />
                </ScheduleSection>
            ) : (
                <CourierProfile 
                    onRegisterClick={() => setShowCalendar(true)}
                    isSeniorCourier={user?.is_senior_courier}
                    onOpenShiftAccess={handleOpenShiftAccessSettings}
                />
            )}

            <CourierProfileDialog
                isOpen={isProfileDialogOpen}
                onClose={() => setIsProfileDialogOpen(false)}
                onSave={handleProfileSave}
            />

            <ShiftAccessModal 
                isOpen={showShiftAccessSettings}
                onClose={handleCloseShiftAccessSettings}
                chatId={courierChatId}
            />
        </Container>
    );
};

export default CourierSchedule; 