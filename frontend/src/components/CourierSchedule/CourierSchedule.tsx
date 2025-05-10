import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import CourierProfile from '../CourierProfile/CourierProfile';
import CourierProfileDialog from './CourierProfileDialog';
import { CourierCalendar } from './CourierCalendar/index';
import { updateCourierProfile } from '../../services/api';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';
import { updateUser } from '../../store/slices/userSlice';
import { bookShift, fetchShifts } from '../../store/slices/shiftsSlice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { format } from 'date-fns';
import config from '../../config';
import { updateSeniorCourierStatus } from '../../store/slices/userSlice';
import axios from 'axios';
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
    const { user } = useAppSelector((state) => state.user);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [showCalendar, setShowCalendar] = useState(false);
    const [showSeniorActions, setShowSeniorActions] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [showShiftAccessSettings, setShowShiftAccessSettings] = useState(false);
    
    // Функция для получения статуса старшего курьера
    const fetchCourierStatus = async () => {
        if (!user?.id) {
            console.log('❌ Нет ID пользователя для запроса статуса курьера');
            return;
        }
        
        try {
            const chatId = user.groups && user.groups.length > 0 
                ? user.groups[0].chat_id : undefined;
                
            if (!chatId) {
                console.log('❌ Нет chat_id для запроса статуса курьера');
                return;
            }
            
            // Используем относительный URL вместо полного
            const url = `/api/couriers/${user.id}/status?chat_id=${chatId}`;
            console.log('📡 Запрашиваем статус курьера при рендеринге CourierSchedule по URL:', url);
            console.log('👤 Текущий пользователь:', {
                id: user.id,
                name: `${user.first_name} ${user.last_name}`,
                isSeniorCourier: user.isSeniorCourier,
                groups: user.groups
            });
            
            // Используем axios вместо fetch для согласованности
            const response = await axios.get(url);
            console.log('✅ Получен ответ от API:', response.data);
            
            const data = response.data;
            
            if (data.is_senior_courier !== undefined && user.isSeniorCourier !== data.is_senior_courier) {
                console.log('📊 Обновляем статус старшего курьера:', {
                    old: user.isSeniorCourier,
                    new: data.is_senior_courier
                });
                
                // Используем специальный редьюсер для обновления статуса старшего курьера
                dispatch(updateSeniorCourierStatus(data.is_senior_courier));
                
                // Также нужно обновить весь объект пользователя для совместимости
                dispatch(updateUser({
                    ...user,
                    isSeniorCourier: data.is_senior_courier
                }));
            } else {
                console.log('ℹ️ Статус старшего курьера не изменился:', {
                    current: user.isSeniorCourier,
                    fromApi: data.is_senior_courier
                });
            }
            
            // Загружаем свежие данные о сменах
            dispatch(fetchShifts());
            
        } catch (error) {
            console.error('❌ Ошибка при получении статуса курьера:', error);
            // Не выбрасываем ошибку дальше, чтобы не блокировать UI
        }
    };
    
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

    // Получаем статус курьера при монтировании компонента и при изменении пользователя
    // Явно указываем зависимости, чтобы избежать предупреждений линтера
    useEffect(() => {
        if (user?.id && user.groups && user.groups.length > 0) {
            // Используем мемоизированную версию для избежания проблем с зависимостями
            const getCourierStatus = async () => {
                await fetchCourierStatus();
            };
            
            getCourierStatus();
        }
    }, [user, dispatch]);

    const handleProfileSave = async (data: { 
        firstName: string; 
        lastName: string; 
        isSeniorCourier?: boolean; 
        seniorPassword?: string;
    }) => {
        if (!user?.id) return;

        try {
            // Добавляем chat_id, если пользователь состоит в группе
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
                isSeniorCourier: data.isSeniorCourier || false
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

    // Обработчик для открытия модального окна настроек доступа к сменам
    const handleOpenShiftAccessSettings = () => {
        console.log('Opening shift access settings');
        setShowShiftAccessSettings(true);
    };

    // Обработчик для закрытия модального окна настроек доступа к сменам
    const handleCloseShiftAccessSettings = () => {
        console.log('Closing shift access settings');
        setShowShiftAccessSettings(false);
    };

    // Получаем chatId для передачи в компоненты
    const chatId = useMemo(() => {
        if (user?.groups && user.groups.length > 0) {
            const id = user.groups[0].chat_id;
            console.log('📱 Используем chat_id для настроек доступа:', id);
            return id;
        }
        console.log('⚠️ У пользователя нет chat_id для настроек доступа');
        return undefined;
    }, [user]);

    return (
        <Container>
            <Header>
                <Title>Запись на смену</Title>
                <Subtitle>Выберите удобную дату для работы</Subtitle>
                
                {user?.isSeniorCourier && (
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
                        chatId={chatId}
                    />
                </ScheduleSection>
            ) : (
                <CourierProfile 
                    onRegisterClick={() => setShowCalendar(true)}
                    isSeniorCourier={user?.isSeniorCourier}
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
                chatId={chatId}
            />
        </Container>
    );
};

export default CourierSchedule; 