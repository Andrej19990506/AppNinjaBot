import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
    fetchEvents, 
    selectAllEvents, 
    selectEventsLoading, 
    selectEventsError, 
    addEvent, 
    removeEvent, 
    deleteEventThunk, 
    createEventThunk, 
    selectEventCreateLoading,
    selectEventCreateError 
} from '../../store/slices/eventsSlice';
import { EventRead, EventCreate } from '../../types/event';
import EventItem from './EventItem';
import EmptyEventList from './EmptyEventList';
import styled, { keyframes } from 'styled-components';
import Footer from '../Inventory/Footer';
import { AnimatePresence, motion } from 'framer-motion';
import SlidingDrawer from '../common/SlidingDrawer/SlidingDrawer';
import CreateNotificationForm from './CreateNotificationForm';

// <<< ДОБАВЛЕНО: Тип для состояния формы >>>
interface FormState {
    submit: (() => Promise<void>) | null;
    isValid: boolean;
    isLoading: boolean;
}

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
    box-sizing: border-box;
`;

// Обновляем EventsGrid, чтобы принимал проп $isCentering
const EventsGrid = styled(motion.div)<{ $isCentering?: boolean }>`
    display: grid;
    gap: 15px;
    padding: 15px;
    flex-grow: 1;
    min-height: 0;
    align-content: ${props => props.$isCentering ? 'center' : 'start'};
    padding-bottom: 75px;
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

// Стили для Оверлея
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

const Overlay = styled(motion.div)`
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(3px);
    z-index: 1000;
`;

// Стили для контейнера центральной карточки
const CenteredItemContainer = styled(motion.div)`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1001;
    width: calc(100% - 30px);
    max-width: 500px;
    box-shadow: var(--shadow-lg);
`;

const EventList = () => {
    const dispatch = useAppDispatch();
    const events = useAppSelector(selectAllEvents);
    const loadingStatus = useAppSelector(selectEventsLoading);
    const error = useAppSelector(selectEventsError);
    const isCreateLoading = useAppSelector(selectEventCreateLoading) === 'pending';
    const createError = useAppSelector(selectEventCreateError);
    
    const [creatingEventId, setCreatingEventId] = useState<number | null>(null);
    const [justSavedId, setJustSavedId] = useState<number | null>(null);
    const [isCreatingInCenter, setIsCreatingInCenter] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [eventIdToEditNotification, setEventIdToEditNotification] = useState<number | null>(null);
    // <<< ДОБАВЛЕНО: ID уведомления для редактирования >>>
    const [notificationIdToEdit, setNotificationIdToEdit] = useState<string | null>(null);
    // <<< ДОБАВЛЕНО: Состояние для данных из формы >>>
    const [formState, setFormState] = useState<FormState>({ 
        submit: null, 
        isValid: false, 
        isLoading: false 
    });

    useEffect(() => {
        if (loadingStatus === 'idle') {
            dispatch(fetchEvents());
        }
    }, [loadingStatus, dispatch]);

    const eventBeingCreated = events.find(e => e.id === creatingEventId);

    const handleDelete = (id: number) => {
        dispatch(deleteEventThunk(id))
            .unwrap()
            .then(() => {
                console.log(`Событие ${id} успешно удалено (через thunk)`);
                if (id === creatingEventId) {
                    setCreatingEventId(null);
                    setJustSavedId(null);
                    setIsCreatingInCenter(false);
                }
            })
            .catch((err) => {
                console.error(`Ошибка при удалении события ${id}:`, err);
            });
    };

    const handleStartCreate = () => {
        const tempId = Date.now();
        const newEventPlaceholder: EventRead = {
            id: tempId, 
            description: '',
            date: new Date().toISOString(),
            notifications: [], 
            scheduling_status: { active: false }, 
        };
        dispatch(addEvent(newEventPlaceholder));
        setCreatingEventId(tempId);
        if (events.length > 0) {
            setIsCreatingInCenter(true);
        } else {
            setIsCreatingInCenter(false); 
        }
    };
    
    const handleSaveCreating = async (id: number, data: { description: string; date: string }) => {
        const tempId = creatingEventId;
        if (!tempId || tempId !== id) {
            console.error("Ошибка: Попытка сохранить событие с неверным ID.");
            return;
        }
        
        const { description, date } = data;
        if (!description.trim()) {
            handleCancelCreating(tempId);
            return;
        }

        const eventData: EventCreate = { description: description.trim(), date };

        try {
            const createdEvent = await dispatch(createEventThunk(eventData)).unwrap();
            console.log('Событие успешно создано на бэке:', createdEvent);

            dispatch(removeEvent(tempId));

            setCreatingEventId(null);
            setIsCreatingInCenter(false);
            setJustSavedId(createdEvent.id);
            setTimeout(() => {
                setJustSavedId(null);
            }, 500);

        } catch (err) {
            console.error('Ошибка при создании события:', err);
        }
    };

    const handleCancelCreating = (id: number) => {
        if (creatingEventId === id) {
            dispatch(removeEvent(id));
        }
        setCreatingEventId(null);
        setIsCreatingInCenter(false);
        setJustSavedId(null);
    };

    // <<< ИЗМЕНЕНО: Принимаем notificationId опционально >>>
    const handleAddNotificationClick = (eventId: number, notificationId?: string) => {
        setEventIdToEditNotification(eventId);
        setNotificationIdToEdit(notificationId || null); // Сохраняем ID уведомления или null
        setIsDrawerOpen(true);
    };

    // <<< ДОБАВЛЕНО: Функция закрытия шторки (для ясности) >>>
    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setEventIdToEditNotification(null);
        setNotificationIdToEdit(null); // Сбрасываем ID уведомления
        // Сбрасываем состояние формы при закрытии
        setFormState({ submit: null, isValid: false, isLoading: false }); 
    };

    // <<< ДОБАВЛЕНО: Обработчик изменения состояния формы >>>
    const handleFormStateChange = (newState: FormState) => {
        setFormState(newState);
    };

    const renderContent = () => {
        if ((loadingStatus === 'pending' || loadingStatus === 'idle') && events.length === 0 && !creatingEventId) {
            return <PlaceholderWrapper>Загрузка событий...</PlaceholderWrapper>;
        }
        if (loadingStatus === 'failed' && events.length === 0 && !creatingEventId) {
             return <PlaceholderWrapper>Ошибка загрузки: {error || 'Неизвестная ошибка'}</PlaceholderWrapper>;
        }
        
        if (events.length === 0 && !creatingEventId && !isCreatingInCenter) {
            return (
                <EmptyStateWrapper>
                    <EmptyEventList onIconClick={handleStartCreate} />
                </EmptyStateWrapper>
            );
        }

        const eventsForGrid = events.filter(e => 
            !isCreatingInCenter || e.id !== creatingEventId
        );

        const isCenteringGrid = events.length === 1 && events[0].id === creatingEventId && !isCreatingInCenter;

        return (
            // @ts-ignore // Known issue with framer-motion types
            <AnimatePresence>
                <EventsGrid $isCentering={isCenteringGrid} layout>
                    {eventsForGrid.map((event) => (
                        <EventItem 
                            key={event.id}
                            event={event}
                            onDelete={() => handleDelete(event.id)}
                            isCreating={creatingEventId === event.id}
                            onSaveCreating={handleSaveCreating}
                            onCancelCreating={handleCancelCreating}
                            isJustSaved={justSavedId === event.id}
                            onAddNotificationClick={() => handleAddNotificationClick(event.id, event.notifications[0]?.id)}
                        />
                    ))}
                </EventsGrid>
            </AnimatePresence>
        );
    };

    return (
        <EventListContainer>
            {/* @ts-ignore // Known issue with framer-motion types */}
            <AnimatePresence>
                {isCreatingInCenter && eventBeingCreated && (
                    <Overlay 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => handleCancelCreating(eventBeingCreated.id)}
                    />
                )}
            </AnimatePresence>

            {/* @ts-ignore // Known issue with framer-motion types */}
            <AnimatePresence>
                {isCreatingInCenter && eventBeingCreated && (
                    <CenteredItemContainer
                        layoutId={`event-card-${eventBeingCreated.id}`}
                        initial={{ y: "-50%", x: "-50%", scale: 0.8, opacity: 0.8 }}
                        animate={{ y: "-50%", x: "-50%", scale: 1, opacity: 1 }}
                        exit={{ 
                            y: "-50%", x: "-50%",
                            scale: 0.8, opacity: 0, 
                            transition: { duration: 0.2 }
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                         <EventItem 
                            event={eventBeingCreated}
                            onDelete={() => handleDelete(eventBeingCreated.id)}
                            isCreating={true}
                            onSaveCreating={handleSaveCreating}
                            onCancelCreating={() => handleCancelCreating(eventBeingCreated.id)}
                            isJustSaved={false}
                            onAddNotificationClick={() => {}}
                        />
                    </CenteredItemContainer>
                )}
            </AnimatePresence>
            
            {renderContent()}

            {/* Футер */} 
            <Footer 
                onBack={() => {}}
                showCreateEventButton={!creatingEventId && !isCreatingInCenter && events.length > 0}
                onCreateEventClick={handleStartCreate}
                showModalActions={isDrawerOpen}
                onModalSave={formState.submit || undefined}
                isModalSaveDisabled={!formState.isValid || formState.isLoading}
                onModalCancel={handleCloseDrawer}
                showModalSteps={false}
            />

            {/* Шторка для создания/редактирования уведомлений */}
            {isDrawerOpen && (
                 <SlidingDrawer onClose={handleCloseDrawer}>
                     {eventIdToEditNotification !== null && (
                        <CreateNotificationForm 
                            key={`${eventIdToEditNotification}-${notificationIdToEdit || 'new'}`}
                            eventId={eventIdToEditNotification}
                            notificationId={notificationIdToEdit}
                            onClose={handleCloseDrawer} 
                            onStateChange={handleFormStateChange}
                        />
                    )}
                </SlidingDrawer>
            )}
        </EventListContainer>
    );
};

export default EventList;
