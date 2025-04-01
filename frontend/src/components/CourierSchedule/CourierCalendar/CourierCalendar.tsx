import React, { useEffect } from 'react';
import { CalendarProps } from './types';
import { addNotification, NotificationTypes } from '../../../store/slices/notificationSlice';
import { useAppDispatch } from '../../../store/hooks';

const CourierCalendar: React.FC<CalendarProps> = ({
    onShiftSelect,
    selectedDate,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onClose,
    chatId,
    accessSettings,
    refetchData
}) => {
    const dispatch = useAppDispatch();

    // Логирование инициализации компонента
    useEffect(() => {
        console.log('🔍 CourierCalendar инициализирован');
        console.log('🔍 ChatId:', chatId);
        console.log('🔍 SelectedDate:', selectedDate);
        console.log('🔍 CurrentUserId:', currentUserId);
        console.log('🔍 AccessSettings:', accessSettings);
        
        // Обновляем данные по запросу
        if (refetchData) {
            refetchData();
        }
    }, [chatId, selectedDate, currentUserId, accessSettings, refetchData]);

    console.log('=== 📅 CourierCalendar: Инициализация компонента ===');
    console.log('🔑 ChatId:', chatId);
    console.log('👤 CurrentUserId:', currentUserId);
    console.log('🌐 SelectedDate:', selectedDate);
    console.log('⚙️ AccessSettings:', accessSettings);

    // Временный JSX для отладки
    return (
        <div className="courier-calendar">
            <div className="debug-info" style={{ display: "none" }}>
                <h3>Отладочная информация:</h3>
                <p>ChatId: {chatId}</p>
                <p>SelectedDate: {selectedDate?.toString()}</p>
                <p>CurrentUserId: {currentUserId}</p>
            </div>
            {/* Здесь должен быть оригинальный JSX компонента */}
        </div>
    );
};

export default CourierCalendar; 