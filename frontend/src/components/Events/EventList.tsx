import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
    fetchEvents, 
    selectAllEvents, 
    selectEventsLoading, 
    selectEventsError, 
    deleteEventThunk, 
    createEventThunk, 
    selectEventCreateLoading,
} from '../../store/slices/eventsSlice';
import { EventRead, EventCreate, EventNotification } from '../../types/event';
import EventItem from './EventItem';
import EmptyEventList from './EmptyEventList';
import styled from 'styled-components';
import Footer from '../Inventory/Footer';
import { AnimatePresence, motion } from 'framer-motion';
import SlidingDrawer from '../common/SlidingDrawer/SlidingDrawer';
import CreateNotificationForm from './CreateNotificationForm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

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
    margin-top: 80px;
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

const EventList: React.FC = () => {
    const dispatch = useAppDispatch();
    const realEvents = useAppSelector(selectAllEvents);
    const loadingStatus = useAppSelector(selectEventsLoading);
    const error = useAppSelector(selectEventsError);
    const isCreateThunkLoading = useAppSelector(selectEventCreateLoading) === 'pending';
    
    const [creatingEventId, setCreatingEventId] = useState<string | null>(null);
    const [tempEventData, setTempEventData] = useState<Partial<EventRead>>({});
    const [justSavedId, setJustSavedId] = useState<number | null>(null);
    const [isCreatingInCenter, setIsCreatingInCenter] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [eventIdToEditNotification, setEventIdToEditNotification] = useState<number | null>(null);
    const [notificationIdToEdit, setNotificationIdToEdit] = useState<string | null>(null);
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

    const handleCancelCreatingEvent = useCallback(() => { 
        const tempId = creatingEventId;
        if (tempId) {
             logger.log(`[EventList] Отмена создания временного события ${tempId}`);
             setCreatingEventId(null);
             setIsCreatingInCenter(false);
             setTempEventData({});
         }
    }, [creatingEventId]);

    const handleDeleteEvent = useCallback(async (eventId: number | string) => { 
        if (typeof eventId === 'string') {
            logger.log(`[EventList] Запрос на удаление временного события ${eventId} через handleDeleteEvent - вызываем отмену`);
            handleCancelCreatingEvent();
            return;
        }
        logger.log(`[EventList] Запрос на удаление реального события ${eventId}`);
        try {
            await dispatch(deleteEventThunk(eventId)).unwrap(); 
            logger.log(`[EventList] Событие ${eventId} успешно удалено (thunk завершен)`);
        } catch (err) { 
            logger.error(`[EventList] Ошибка при удалении события ${eventId}:`, err);
        }
    }, [dispatch, handleCancelCreatingEvent]);

    const handleCreateEventFromFooter = useCallback(() => {
        logger.log('[EventList] Создание события из футера...');
        const newEventId = uuidv4(); 
        setCreatingEventId(newEventId);
        setTempEventData({ 
            description: '', 
            date: new Date().toISOString(),
            notifications: [],
        }); 
        setIsCreatingInCenter(true);
    }, []);

    const handleAddOrEditNotificationClick = useCallback((eventId: number, notificationId?: string) => {
        logger.log(`[EventList] Клик на добавление/редактирование уведомления для события ${eventId}, уведомление ${notificationId || 'новое'}`);
        setEventIdToEditNotification(eventId);
        setNotificationIdToEdit(notificationId || null); 
        setIsDrawerOpen(true);
    }, []);

    const handleSaveCreatingEvent = useCallback(async (eventData: EventCreate) => { 
        const tempId = creatingEventId;
        if (!tempId) return;

        logger.log(`[EventList] Сохранение создаваемого события (tempId: ${tempId})`, eventData);
        
        try {
            const createdEvent = await dispatch(createEventThunk(eventData)).unwrap();
            logger.log('[EventList] Событие успешно создано на бэке:', createdEvent);
            
            setCreatingEventId(null);
            setIsCreatingInCenter(false);
            setTempEventData({});
            
            setJustSavedId(createdEvent.id); 
            setTimeout(() => setJustSavedId(null), 500);

        } catch (err) {
            logger.error(`[EventList] Ошибка при создании события (tempId: ${tempId}):`, err);
        }
    }, [dispatch, creatingEventId]);

    const handleNotificationFormStateChange = useCallback((newState: FormState) => {
        setFormState(newState); 
    }, []);

    const handleModalSave = useCallback(() => {
        if (formState.submit) {
            logger.log('[EventList] Вызов submit из формы уведомления через футер');
            formState.submit(); 
        }
    }, [formState.submit]);

    const handleModalCancel = useCallback(() => {
        logger.log('[EventList] Закрытие шторки уведомления');
        setIsDrawerOpen(false);
        setEventIdToEditNotification(null);
        setNotificationIdToEdit(null); 
        setFormState({ isValid: false, isLoading: false, submit: null }); 
    }, []);

    const temporaryEventItem: (EventRead & { id: string }) | null = useMemo(() => {
        if (!creatingEventId) return null;
        return {
            description: tempEventData.description || '',
            date: tempEventData.date || new Date().toISOString(),
            notifications: tempEventData.notifications || [],
            scheduling_status: { active: false },
            last_check: null,
            id: creatingEventId, 
            title: 'Временное событие',
            event_time: null,
            is_private: false,
            is_active: true,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            repeat: { type: 'none', weekdays: null, month_day: null },
            chat_ids: [],
        } as unknown as EventRead & { id: string };
    }, [creatingEventId, tempEventData]);

    const allItemsToRender = useMemo(() => {
        const baseList = isCreatingInCenter ? realEvents : [...realEvents];
        if (temporaryEventItem && !isCreatingInCenter) {
            return [temporaryEventItem, ...baseList];
        }
        return baseList;
    }, [realEvents, temporaryEventItem, isCreatingInCenter]);

    const renderContent = () => {
        if ((loadingStatus === 'pending' || loadingStatus === 'idle') && realEvents.length === 0 && !temporaryEventItem) {
            return <PlaceholderWrapper>Загрузка событий...</PlaceholderWrapper>;
        }
        if (loadingStatus === 'failed' && realEvents.length === 0 && !temporaryEventItem) {
             return <PlaceholderWrapper>Ошибка загрузки: {error || 'Неизвестная ошибка'}</PlaceholderWrapper>;
        }
        
        if (realEvents.length === 0 && !temporaryEventItem) {
            return (
                <EmptyStateWrapper>
                    <EmptyEventList onIconClick={handleCreateEventFromFooter} />
                </EmptyStateWrapper>
            );
        }

        const isCenteringGrid = allItemsToRender.length === 1 && typeof allItemsToRender[0].id === 'string' && !isCreatingInCenter;

        return (
            // @ts-ignore // Known issue with framer-motion types
            <AnimatePresence>
                <EventsGrid $isCentering={isCenteringGrid} layout={!isCreatingInCenter}>
                    {allItemsToRender.map((item) => {
                        const isTemp = typeof item.id === 'string';
                        const isJustSavedItem = !isTemp && justSavedId !== null && item.id === justSavedId;

                        return (
                            <EventItem 
                                key={item.id}
                                event={item as EventRead & { id: number | string }}
                                onDeleteClick={handleDeleteEvent}
                                onSaveCreating={isTemp ? handleSaveCreatingEvent : undefined}
                                onCancelCreating={isTemp ? handleCancelCreatingEvent : undefined}
                                onAddNotificationClick={isTemp ? undefined : handleAddOrEditNotificationClick}
                                isCreating={isTemp}
                                isJustSaved={isJustSavedItem}
                                isSaveLoading={isTemp && isCreateThunkLoading}
                            />
                        );
                    })}
                </EventsGrid>
            </AnimatePresence>
        );
    };

    const footerProps = useMemo(() => ({
        onBack: () => {}, 
        showCreateEventButton: !creatingEventId && !isCreatingInCenter && !isDrawerOpen && realEvents.length > 0,
        onCreateEventClick: handleCreateEventFromFooter, 
        showModalActions: isDrawerOpen,
        onModalSave: handleModalSave, 
        onModalCancel: handleModalCancel, 
        isModalSaveDisabled: !formState.isValid || formState.isLoading,
        isLoadingModalSave: formState.isLoading, 
        showModalSteps: false, 
    }), [
        creatingEventId, isCreatingInCenter, isDrawerOpen, handleCreateEventFromFooter, 
        handleModalSave, handleModalCancel, formState.isValid, formState.isLoading, 
        realEvents.length
    ]);

    return (
        <EventListContainer>
            {/* Оверлей */}
            {/* @ts-ignore // Known issue with framer-motion types */}
            <AnimatePresence>
                {isCreatingInCenter && temporaryEventItem && (
                    <Overlay 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCancelCreatingEvent} // Клик по оверлею = отмена
                    />
                )}
            </AnimatePresence>

            {/* Центральная карточка */}
            {/* @ts-ignore // Known issue with framer-motion types */}
            <AnimatePresence>
                {isCreatingInCenter && temporaryEventItem && (
                    <CenteredItemContainer
                        initial={{ x: "-100vw", y: "-50%", opacity: 0 }} 
                        animate={{ x: "-50%", y: "-50%", opacity: 1 }}
                        exit={{ x: "-100vw", y: "-50%", opacity: 0, transition: { duration: 0.2 } }} 
                        transition={{ type: "spring", stiffness: 200, damping: 25 }} 
                    >
                         <EventItem 
                            key={temporaryEventItem.id} 
                            event={temporaryEventItem as EventRead & { id: number | string }} 
                            onDeleteClick={handleDeleteEvent} 
                            onSaveCreating={handleSaveCreatingEvent}
                            onCancelCreating={handleCancelCreatingEvent} 
                            onAddNotificationClick={undefined} 
                            isCreating={true} 
                            isJustSaved={false}
                            isSaveLoading={isCreateThunkLoading} 
                            layout={false} 
                        />
                    </CenteredItemContainer>
                )}
            </AnimatePresence>
            
            {renderContent()}

            <Footer {...footerProps} />

            {isDrawerOpen && (
                 <SlidingDrawer onClose={handleModalCancel}>
                     {eventIdToEditNotification !== null && (
                        <CreateNotificationForm 
                            key={`${eventIdToEditNotification}-${notificationIdToEdit || 'new'}`}
                            eventId={eventIdToEditNotification}
                            notificationId={notificationIdToEdit}
                            onClose={handleModalCancel} 
                            onStateChange={handleNotificationFormStateChange}
                        />
                    )}
                </SlidingDrawer>
            )}
        </EventListContainer>
    );
};

export default EventList;
