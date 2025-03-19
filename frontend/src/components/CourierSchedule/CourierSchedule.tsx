import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import CourierProfile from '../CourierProfile/CourierProfile';
import CourierProfileDialog from './CourierProfileDialog';
import CourierCalendar from './CourierCalendar';
import { updateCourierProfile } from '../../services/api';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';
import { updateUser } from '../../store/slices/userSlice';
import { bookShift } from '../../store/slices/shiftsSlice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { format } from 'date-fns';

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

const CourierSchedule: React.FC = () => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [showCalendar, setShowCalendar] = useState(false);
    
    // Временные данные для демонстрации (замените на реальные данные с API)
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

    useEffect(() => {
        if (user && (!user.first_name?.trim() || !user.last_name?.trim())) {
            setIsProfileDialogOpen(true);
        }
    }, [user]);

    const handleProfileSave = async (data: { firstName: string; lastName: string }) => {
        if (!user?.id) return;

        try {
            const result = await updateCourierProfile(user.id, data);
            
            dispatch(updateUser({
                ...user,
                first_name: data.firstName,
                last_name: data.lastName
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
            
            // Извлекаем сообщение об ошибке из ответа сервера
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

    return (
        <Container>
            <Header>
                <Title>Запись на смену</Title>
                <Subtitle>Выберите удобную дату для работы</Subtitle>
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
                    />
                </ScheduleSection>
            ) : (
                <CourierProfile 
                    onRegisterClick={() => setShowCalendar(true)}
                />
            )}

            <CourierProfileDialog
                isOpen={isProfileDialogOpen}
                onClose={() => setIsProfileDialogOpen(false)}
                onSave={handleProfileSave}
            />
        </Container>
    );
};

export default CourierSchedule; 