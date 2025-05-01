import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchEvents, selectAllEvents, selectEventsLoading, selectEventsError/*, addEventOptimistic*/ } from '../../store/slices/eventsSlice'; // TODO: Нужен будет экшн добавления
import EventItem from './EventItem';
import EmptyEventList from './EmptyEventList';
import styled from 'styled-components';
import Footer from '../Inventory/Footer';
import InlineEventCreator from './InlineEventCreator';
import { AnimatePresence } from 'framer-motion';

// Styled component для обертки пустого состояния
const EmptyStateWrapper = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    flex-grow: 1;
    min-height: 0;
    padding: 20px;
`;

// Основной контейнер для EventList
const EventListContainer = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding-bottom: 75px;
    box-sizing: border-box;
`;

// Стили для основного списка (пример)
const EventsGrid = styled.div<{ hasEvents: boolean }>`
    display: grid;
    gap: 15px;
    padding: 15px;
    flex-grow: 1;
    min-height: 0;
    /* Центрируем контент (креэтор), только если нет других событий */
    align-content: ${props => !props.hasEvents ? 'center' : 'start'};
`;

// Стили для заглушек загрузки/ошибки (пример)
const PlaceholderWrapper = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    flex-grow: 1;
    min-height: 0;
    padding: 20px;
    color: var(--text-secondary);
`;

const EventList = () => {
    const dispatch = useAppDispatch();
    const events = useAppSelector(selectAllEvents);
    const loadingStatus = useAppSelector(selectEventsLoading);
    const error = useAppSelector(selectEventsError);
    
    // Новое состояние
    const [showCreator, setShowCreator] = useState(false);
    const [creatorValue, setCreatorValue] = useState('');
    const [isSaving, setIsSaving] = useState(false); // Для блокировки кнопки

    useEffect(() => {
        if (loadingStatus === 'idle') {
            dispatch(fetchEvents());
        }
    }, [loadingStatus, dispatch]);

    const handleDelete = async (id) => {
        console.warn('handleDelete needs to be updated for Redux state management');
    };

    // Хендлеры для Inline Creator
    const handleStartInlineCreate = () => setShowCreator(true);
    
    const handleCancelInline = () => {
        setShowCreator(false);
        setCreatorValue('');
    };
    
    const handleSaveInline = async () => {
        const descriptionToSave = creatorValue.trim();
        if (!descriptionToSave || isSaving) return;

        setIsSaving(true);
        try {
            console.log('TODO: Отправить API запрос на создание:', descriptionToSave);
            // Имитация API
            await new Promise(resolve => setTimeout(resolve, 500)); 
            const newEventFromServer = { id: Date.now(), description: descriptionToSave /* ...другие поля с сервера? */ };
            
            // TODO: Заменить на реальный диспатч в Redux для добавления события
            // dispatch(addEventOptimistic(newEventFromServer)); // Пример
            console.log('TODO: Dispatch Redux action to add event', newEventFromServer);

            // Очищаем инпут, но оставляем креэтор видимым
            setCreatorValue(''); 
            // Не скрываем креэтор: setShowCreator(false); 

        } catch (err) {
            console.error("Ошибка сохранения события:", err);
            // TODO: Показать ошибку пользователю
        } finally {
            setIsSaving(false);
        }
    };

    const renderContent = () => {
        if (loadingStatus === 'pending' || loadingStatus === 'idle' && !showCreator) { // Не показываем загрузку, если креэтор открыт
            return <PlaceholderWrapper>Загрузка событий...</PlaceholderWrapper>;
        }
        if (loadingStatus === 'failed') {
             return <PlaceholderWrapper>Ошибка загрузки: {error || 'Неизвестная ошибка'}</PlaceholderWrapper>;
        }
        
        const hasEvents = events && events.length > 0;

        // Если список пуст и НЕ показываем креэтор
        if (!showCreator && !hasEvents) {
            return (
                <EmptyStateWrapper>
                    <EmptyEventList onIconClick={handleStartInlineCreate} />
                </EmptyStateWrapper>
            );
        }

        // Показываем грид (даже если пустой, но креэтор открыт)
        return (
            // Передаем hasEvents в грид для стилизации
            <EventsGrid hasEvents={hasEvents}>
                <AnimatePresence>
                    {showCreator && (
                        <InlineEventCreator 
                            value={creatorValue}        // Передаем текущее значение
                            onChange={setCreatorValue}   // Передаем функцию обновления
                            onSave={handleSaveInline}    // Функция сохранения
                            onCancel={handleCancelInline} // Функция отмены/скрытия
                            isSaving={isSaving}          // Передаем статус сохранения
                        />
                    )}
                </AnimatePresence>

                {/* Показываем существующие события */} 
                {events && events.map((event) => (
                    <EventItem
                        key={event.id}
                        event={event}
                        onDelete={handleDelete}
                    />
                ))}
            </EventsGrid>
        );
    };

    return (
        <EventListContainer>
            {renderContent()}
            <Footer onBack={() => {}} /> {/* Убираем лишние пропсы */}
        </EventListContainer>
    );
};

export default EventList;
