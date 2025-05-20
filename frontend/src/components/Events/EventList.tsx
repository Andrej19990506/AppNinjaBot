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
import { EventRead, EventCreate, EventNotification, NotificationCreate } from '../../types/event';
import EventItem from './EventItem';
import EmptyEventList from './EmptyEventList';
import styled from 'styled-components';
import Footer from '../Inventory/Footer';
import { AnimatePresence, motion } from 'framer-motion';
import CreateNotificationForm from './CreateNotificationForm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { 
    closeAtoModal, 
    setAtoCreateMode, 
    selectAtoModalOpen, 
    selectAtoCreateMode,
    selectIsAtoSelectionValid,
    resetSelection,
} from '../../store/slices/atoModalSlice';
import AtoCommentsModal from './AtoCommentsModal';

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

// Импортируем тип из EventItem
interface ExtendedNotificationCreate extends NotificationCreate {
    use_absolute_time?: boolean;
    absolute_time?: string;
    send_now?: boolean;
}

const EventList: React.FC = () => {
    const dispatch = useAppDispatch();
    const realEvents = useAppSelector(selectAllEvents);
    const loadingStatus = useAppSelector(selectEventsLoading);
    const error = useAppSelector(selectEventsError);
    const isCreateThunkLoading = useAppSelector(selectEventCreateLoading) === 'pending';
    
    // Состояния для модального окна ATO из Redux
    const isAtoModalOpen = useAppSelector(selectAtoModalOpen);
    const isAtoCreateMode = useAppSelector(selectAtoCreateMode);
    const isAtoSelectionValid = useAppSelector(selectIsAtoSelectionValid);

    const [creatingEventId, setCreatingEventId] = useState<string | null>(null);
    const [tempEventData, setTempEventData] = useState<Partial<EventRead>>({});
    const [justSavedId, setJustSavedId] = useState<number | null>(null);
    const [isCreatingInCenter, setIsCreatingInCenter] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [eventIdToEditNotification, setEventIdToEditNotification] = useState<number | null>(null);
    const [notificationIdToEdit, setNotificationIdToEdit] = useState<string | null>(null);
    const [initialNotificationData, setInitialNotificationData] = useState<Partial<ExtendedNotificationCreate> | undefined>(undefined);
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

    const handleAddOrEditNotificationClick = useCallback((eventId: number, notificationId?: string, initialData?: Partial<ExtendedNotificationCreate>) => {
        logger.log(`[EventList] Клик на добавление/редактирование уведомления для события ${eventId}, уведомление ${notificationId || 'новое'}`);
        setEventIdToEditNotification(eventId);
        setNotificationIdToEdit(notificationId || null); 
        setIsDrawerOpen(true);
        
        // Если есть initialData (предварительные данные для уведомления), сохраняем их
        if (initialData) {
            logger.log(`[EventList] Получены предварительные данные для уведомления:`, initialData);
            setInitialNotificationData(initialData);
        } else {
            setInitialNotificationData(undefined);
        }
    }, []);

    const handleSaveCreatingEvent = useCallback(async (eventData: EventCreate) => { 
        const tempId = creatingEventId;
        if (!tempId) return;

        logger.log(`[EventList] Сохранение создаваемого события (tempId: ${tempId})`, eventData);
        
        try {
            const result = await dispatch(createEventThunk(eventData)).unwrap();
            
            // Проверяем, если результат - массив, берем первый элемент
            // Если не массив, используем как есть
            const createdEvent = Array.isArray(result) ? result[0] : result;
            
            logger.log('[EventList] Событие успешно создано на бэке:', createdEvent);
            
            setCreatingEventId(null);
            setIsCreatingInCenter(false);
            setTempEventData({});
            
            if (createdEvent && typeof createdEvent.id === 'number') {
                setJustSavedId(createdEvent.id); 
                setTimeout(() => setJustSavedId(null), 500);
            }

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
        setInitialNotificationData(undefined);
        setFormState({ isValid: false, isLoading: false, submit: null }); 
    }, []);

    const handleAtoModalStateChange = useCallback((isOpen: boolean, isCreateMode: boolean) => {
        logger.log(`[EventList] Изменение состояния модального окна АТО: isOpen=${isOpen}, isCreateMode=${isCreateMode}`);
        
        // Это метод теперь только для обратной совместимости, 
        // основное управление через Redux в EventItem.tsx
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
                                onAtoModalOpen={handleAtoModalStateChange}
                            />
                        );
                    })}
                </EventsGrid>
            </AnimatePresence>
        );
    };

    const footerProps = useMemo(() => ({
        onBack: () => {}, 
        showCreateEventButton: !creatingEventId && !isCreatingInCenter && !isDrawerOpen && !isAtoModalOpen && realEvents.length > 0,
        onCreateEventClick: handleCreateEventFromFooter,
        showModalActions: isDrawerOpen || isAtoModalOpen,
        
        // Кнопка "Сохранить" или "Создать уведомление" в правой части футера
        onModalSave: isAtoModalOpen 
            ? isAtoCreateMode
                // В режиме создания уведомлений вызываем документальное событие для создания уведомления
                ? () => {
                    // Находим текущее открытое событие ATO
                    logger.log("[EventList] Всего событий в realEvents:", realEvents.length);
                    
                    // Логируем все типы событий
                    const eventTypes = realEvents.map(e => e.event_type);
                    logger.log("[EventList] Типы событий в realEvents:", eventTypes);
                    
                    // Изменяем проверку типа события - учитываем и 'ato', и 'АТО'
                    const isAtoEvent = (e: any) => 
                        e.event_type === 'ato' || e.event_type === 'АТО';
                    
                    // Логируем события ATO
                    const atoEvents = realEvents.filter(isAtoEvent);
                    logger.log("[EventList] События типа 'ato'/'АТО':", atoEvents.length);
                    
                    // Логируем события ATO с комментариями
                    const atoEventsWithComments = realEvents.filter(e => 
                        isAtoEvent(e) && 
                        e.retailiqa_comments && 
                        e.retailiqa_comments.length > 0
                    );
                    logger.log("[EventList] События типа 'ato'/'АТО' с комментариями:", atoEventsWithComments.length);
                    
                    // Для первого ATO события логируем подробную информацию
                    if (atoEvents.length > 0) {
                        const firstAto = atoEvents[0];
                        logger.log("[EventList] Первое событие ATO:", {
                            id: firstAto.id,
                            type: firstAto.event_type,
                            has_comments: !!firstAto.retailiqa_comments,
                            comments_length: firstAto.retailiqa_comments?.length || 0,
                            has_violation_count: !!firstAto.retailiqa_violation_count,
                            violation_count: firstAto.retailiqa_violation_count || 0
                        });
                    }
                    
                    const atoEvent = realEvents.find(e => 
                        isAtoEvent(e) && 
                        e.retailiqa_comments && 
                        e.retailiqa_comments.length > 0
                    );
                    
                    if (!atoEvent) {
                        // Ослабляем условия поиска - ищем любое событие типа 'ato' или 'АТО'
                        const anyAtoEvent = realEvents.find(isAtoEvent);
                        
                        if (anyAtoEvent) {
                            logger.log(`[EventList] Найдено событие ATO без комментариев, используем его ID=${anyAtoEvent.id}`);
                            // Вызываем глобальное событие для передачи в AtoCommentsModal с ID события
                            document.dispatchEvent(new CustomEvent('ato:create-notification', {
                                detail: { eventId: anyAtoEvent.id }
                            }));
                            return;
                        }
                        
                        logger.error('Не найдено событие ATO для создания уведомления');
                        return;
                    }
                    
                    logger.log(`[EventList] Вызываем create notification через глобальное событие для события ID=${atoEvent.id}`);
                    // Вызываем глобальное событие для передачи в AtoCommentsModal с ID события
                    document.dispatchEvent(new CustomEvent('ato:create-notification', {
                        detail: { eventId: atoEvent.id }
                    }));
                }
                // В режиме просмотра правая кнопка не используется
                : undefined
            : handleModalSave,
        
        // Кнопка "Отмена" или "Закрыть" в левой части футера
        onModalCancel: isAtoModalOpen 
            ? () => {
                logger.log(`[EventList] Нажата кнопка Закрыть/Отмена в футере для ATO modal. isAtoCreateMode=${isAtoCreateMode}`);
                // Используем Redux вместо глобальных методов
                if (isAtoCreateMode) {
                    logger.log(`[EventList] Вызываем cancelAtoSelection через Redux`);
                    dispatch(resetSelection());
                    dispatch(setAtoCreateMode(false));
                } else {
                    logger.log(`[EventList] Закрываем ATO modal через Redux`);
                    dispatch(closeAtoModal());
                }
            }
            : handleModalCancel,
        
        // Проверка, активна ли кнопка "Сохранить" или "Создать уведомление" через Redux
        isModalSaveDisabled: isAtoModalOpen && isAtoCreateMode
            ? !isAtoSelectionValid 
            : (!formState.isValid || formState.isLoading),
        
        isLoadingModalSave: formState.isLoading,
        showModalSteps: false,
        
        // Кастомизация текстов для кнопок
        modalSaveText: isAtoModalOpen 
            ? (isAtoCreateMode ? "Создать уведомление" : undefined) 
            : isDrawerOpen ? "Сохранить" : undefined,
        modalCancelText: isAtoModalOpen 
            ? (isAtoCreateMode ? "Отмена" : "Закрыть") 
            : undefined,
        
        // В режиме просмотра АТО показываем среднюю кнопку для создания уведомления
        showMiddleButton: isAtoModalOpen && !isAtoCreateMode,
        onMiddleButtonClick: isAtoModalOpen && !isAtoCreateMode 
            ? () => {
                logger.log("[EventList] Переключаемся в режим создания уведомления через Redux");
                dispatch(setAtoCreateMode(true));
            } 
            : undefined,
        middleButtonText: isAtoModalOpen && !isAtoCreateMode ? "Создать уведомление" : "",
    }), [
        creatingEventId, isCreatingInCenter, isDrawerOpen, handleCreateEventFromFooter, 
        handleModalSave, handleModalCancel, formState.isValid, formState.isLoading, 
        realEvents.length, isAtoModalOpen, isAtoCreateMode, isAtoSelectionValid, dispatch
    ]);

    // Обработчик для создания уведомлений на основе выбранных комментариев из AtoCommentsModal
    const handleCreateAtoNotificationFromModal = useCallback((data: {
        selectedComments: string[];
        selectedCommentTexts: string[];
        formattedMessage: string;
        eventId?: number;
    }) => {
        let eventId = data.eventId;
        logger.log(`[EventList:handleCreateAtoNotificationFromModal] Получен eventId=${eventId}, selectedComments=${data.selectedComments.length}, selectedCommentTexts=${data.selectedCommentTexts.length}`);

        // Функция для проверки типа события ATO (и латиницей, и кириллицей)
        const isAtoEvent = (e: any) => e.event_type === 'ato' || e.event_type === 'АТО';

        // Если eventId не передан, находим событие ATO (для обратной совместимости)
        if (!eventId) {
            // Находим текущее открытое событие ATO - сначала с комментариями
            const eventsWithComments = realEvents.filter(e => 
                isAtoEvent(e) && 
                e.retailiqa_comments && 
                e.retailiqa_comments.length > 0
            );
            
            // Если нет событий с комментариями, ищем любые ATO события
            if (!eventsWithComments.length) {
                const anyAtoEvents = realEvents.filter(isAtoEvent);
                if (!anyAtoEvents.length) {
                    logger.error('Не найдено событие ATO для создания уведомления');
                    return;
                }
                logger.log(`[EventList] Не найдено ATO событие с комментариями, используем первое ATO событие ${anyAtoEvents[0].id}`);
                eventId = anyAtoEvents[0].id;
            } else {
                logger.log(`[EventList] Найдено ATO событие с комментариями: ${eventsWithComments[0].id}`);
                eventId = eventsWithComments[0].id;
            }
        }

        const event = realEvents.find(e => e.id === eventId);
        if (!event) {
            logger.error(`Событие с ID=${eventId} не найдено`);
            return;
        }
        
        logger.log(`[EventList] Найдено событие с ID=${eventId}, тип=${event.event_type}`);
        
        // Получаем chat_ids из события
        const chatIds: number[] = [];
        if (event && event.chat_ids && event.chat_ids.length > 0) {
            event.chat_ids.forEach(id => {
                if (typeof id === 'number') {
                    chatIds.push(id);
                }
            });
        }
        
        logger.log(`[EventList] Собрано ${chatIds.length} ID чатов для уведомления`);
        
        // Создаем форматированное сообщение, если его нет
        let message = data.formattedMessage;
        if (!message && event.retailiqa_detailed_violations) {
            // Если нет формата сообщения, но есть детальные нарушения, создаем базовое сообщение
            message = `<b>🔵✓ ЗАМЕЧАНИЯ АТО:</b>\n\n`;
            
            if (event.retailiqa_detailed_violations.length > 0) {
                message += "<b>Список нарушений:</b>\n";
                event.retailiqa_detailed_violations.forEach((violation, index) => {
                    message += `${index + 1}. <b>${violation.title}</b>`;
                    if (violation.text) {
                        message += `: ${violation.text}`;
                    }
                    if (violation.penalty && violation.penalty > 0) {
                        message += ` (Штраф: ${violation.penalty})`;
                    }
                    message += "\n\n";
                });
            } else {
                message += "<i>Нет доступных данных о нарушениях. Пожалуйста, добавьте текст вручную.</i>";
            }
        }
        
        // Создаем предварительные данные для уведомления
        const notificationData: Partial<ExtendedNotificationCreate> = {
            message: message,
            chat_ids: chatIds,
            requires_confirmation: true,
            time: 0,
            repeat: { type: 'none' },
            send_now: true
        };
        
        // Открываем форму создания уведомления
        handleAddOrEditNotificationClick(eventId, undefined, notificationData);
        
        // Закрываем модальное окно ATO
        dispatch(closeAtoModal());
    }, [realEvents, dispatch, handleAddOrEditNotificationClick]);

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
                            onAtoModalOpen={handleAtoModalStateChange}
                        />
                    </CenteredItemContainer>
                )}
            </AnimatePresence>
            
            {renderContent()}

            <Footer {...footerProps} />

            {/* Рендерим форму добавления/редактирования уведомления напрямую, без SlidingDrawer */}
            <div>
              {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
              {/* @ts-ignore */}
              <AnimatePresence>
                {isDrawerOpen && eventIdToEditNotification && (
                    <CreateNotificationForm 
                        eventId={eventIdToEditNotification}
                        notificationId={notificationIdToEdit}
                        onClose={handleModalCancel}
                        onStateChange={handleNotificationFormStateChange}
                        initialData={initialNotificationData}
                    />
                )}
              </AnimatePresence>
            </div>
            
            {/* Центральное модальное окно ATO - добавляем его здесь вместо отдельных экземпляров в EventItem */}
            <AtoCommentsModal 
                onCreateNotification={handleCreateAtoNotificationFromModal}
            />
        </EventListContainer>
    );
};

export default EventList;
