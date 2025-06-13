import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../shared/store/hooks';
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
import { logger } from '../../shared/utils/logger';
import { 
    closeAtoModal, 
    setAtoCreateMode, 
    selectAtoModalOpen, 
    selectAtoCreateMode,
    selectIsAtoSelectionValid,
    resetSelection,
} from '../../store/slices/atoModalSlice';
import AtoCommentsModal from './AtoCommentsModal';
import { selectActiveRole, selectUser } from '../../shared/store/userSlice/userSelectors';
import GroupFilterDropdown from './GroupFilterDropdown';

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
    height: 100vh;
    box-sizing: border-box;
`;

// Новый скроллируемый контейнер для списка событий
const ScrollWrapper = styled.div`
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    width: 100%;
    padding-bottom: 80px; /* чтобы контент не уходил под футер */
`;

// Фиксируем Footer
const FixedFooter = styled(Footer)`
    position: fixed !important;
    left: 0;
    bottom: 0;
    width: 100vw;
    z-index: 100;
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

const ChatTagsBar = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px 16px 0 16px;
  overflow-x: auto;
  background: var(--background-color);
  position: sticky;
  top: 0;
  z-index: 10;
`;

const ChatTag = styled.button<{ $active?: boolean }>`
  border: none;
  background: ${({ $active }) => $active ? 'var(--primary-color)' : 'var(--gray-200)'};
  color: ${({ $active }) => $active ? 'var(--text-color-on-primary)' : 'var(--text-secondary)'};
  border-radius: 16px;
  padding: 6px 16px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
  &:hover {
    background: var(--primary-dark);
    color: var(--text-color-on-primary);
  }
`;

// --- Новый компонент: Анимированная стрелка ---
const FilterArrowIcon = ({ open }: { open: boolean }) => (
  <motion.span
    style={{ display: 'inline-block', marginLeft: 8 }}
    animate={{ rotate: open ? 180 : 0 }}
    transition={{ duration: 0.25 }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  </motion.span>
);

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

    const activeRole = useAppSelector(selectActiveRole);
    const user = useAppSelector(selectUser);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

    // Добавляем состояние для фильтра групп
    const [isGroupFilterOpen, setIsGroupFilterOpen] = useState(false);
    const [groupFilterAnchor, setGroupFilterAnchor] = useState<null | HTMLElement>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    const groupFilterButtonRef = useRef<HTMLButtonElement>(null);

    const [isScrolled, setIsScrolled] = useState(false);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);

    const filterButtonFixedStyle: React.CSSProperties = {
      position: 'fixed',
      top: 50,
      left: '50%',
      zIndex: 2100,
      background: 'var(--card-background)',
      border: '1.5px solid var(--border-color)',
      boxShadow: isScrolled ? '0 12px 40px rgba(0,0,0,0.22), var(--shadow-lg)' : 'var(--shadow-lg)',
      borderRadius: 20,
      padding: 0,
      margin: 0,
      transform: isScrolled ? 'translateY(-8px)' : 'none',
      transition: 'box-shadow 0.18s, background 0.18s, border 0.18s, transform 0.18s',
      // Можно добавить backdropFilter для эффекта стекла:
      // backdropFilter: 'blur(4px)',
    };

    useEffect(() => {
        dispatch(fetchEvents(activeRole || undefined));
    }, [dispatch, activeRole]);

    useEffect(() => {
      const handleScroll = () => {
        if (scrollWrapperRef.current) {
          setIsScrolled(scrollWrapperRef.current.scrollTop > 0);
        }
      };
      const el = scrollWrapperRef.current;
      if (el) el.addEventListener('scroll', handleScroll);
      return () => { if (el) el.removeEventListener('scroll', handleScroll); };
    }, []);

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
            group_type: activeRole || undefined,
        }); 
        setIsCreatingInCenter(true);
    }, [activeRole]);

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
            const result = await dispatch(createEventThunk({ ...eventData, group_type: activeRole || undefined })).unwrap();
            
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
    }, [dispatch, creatingEventId, activeRole]);

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

    // Получаем только нужные группы пользователя
    const filteredUserGroups = useMemo(() => {
      if (!user?.groups) return [];
      if (!activeRole) return user.groups.filter(g => g.chat_id);
      return user.groups.filter(g => g.chat_id && g.group_type === activeRole);
    }, [user, activeRole]);

    // Кнопка фильтра групп (fixed)
    const groupFilterButton = (
      <motion.button
        ref={groupFilterButtonRef}
        style={{
          ...filterButtonFixedStyle,
          display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card-background)',
          border: '1.5px solid var(--border-color)', borderRadius: 20, padding: '6px 18px', cursor: 'pointer', fontWeight: 500,
        }}
        initial={{ x: '-50%' }}
        animate={{ x: '-50%' }}
        onClick={e => {
          setGroupFilterAnchor(groupFilterButtonRef.current);
          setIsGroupFilterOpen(v => !v);
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M6 12h12M10 18h4" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round"/></svg>
        <span>{selectedGroupId ? (filteredUserGroups.find(g => String(g.chat_id) === selectedGroupId)?.chat_title || filteredUserGroups.find(g => String(g.chat_id) === selectedGroupId)?.title || `Чат ${selectedGroupId}`) : 'Все группы'}</span>
        <FilterArrowIcon open={isGroupFilterOpen} />
      </motion.button>
    );

    const filteredItemsToRender = useMemo(() => {
      if (!selectedGroupId) return allItemsToRender;
      const filtered = allItemsToRender.filter(ev => {
        let ids: string[] = [];
        if (Array.isArray(ev.chat_ids) && ev.chat_ids.length > 0) {
          ids = ev.chat_ids.map(id => String(id));
        } else if (Array.isArray(ev.notifications)) {
          ev.notifications.forEach(n => {
            if (Array.isArray(n.chat_ids)) {
              ids.push(...n.chat_ids.map(id => String(id)));
            }
          });
        }

        if (
          ids.length === 0 &&
          (ev.event_type === 'ato' || ev.event_type === 'АТО') &&
          ((ev as any).group_telegram_id || (ev as any).group_id)
        ) {
          ids = [String((ev as any).group_telegram_id || (ev as any).group_id)];
        }
        const match = ids.includes(String(selectedGroupId));
        // Отладка:
        console.log('[ФИЛЬТР] chat_ids события:', ids, 'selectedGroupId:', selectedGroupId, 'match:', match);
        return match;
      });
      return filtered;
    }, [allItemsToRender, selectedGroupId]);

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
        if (filteredItemsToRender.length === 0) {
            return (
                <EmptyStateWrapper>
                    Нет событий для выбранной группы
                </EmptyStateWrapper>
            );
        }

        const isCenteringGrid = filteredItemsToRender.length === 1 && typeof filteredItemsToRender[0].id === 'string' && !isCreatingInCenter;

        return (
            <>
              <AnimatePresence>
                <EventsGrid $isCentering={isCenteringGrid} layout={!isCreatingInCenter}>
                  {filteredItemsToRender.map((item) => {
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
            </>
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
        realEvents.length, isAtoModalOpen, isAtoCreateMode, isAtoSelectionValid, dispatch, activeRole
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
            
            {/* --- Кнопка фильтрации групп теперь fixed сверху --- */}
            {groupFilterButton}

            {/* СКРОЛЛИРУЕМЫЙ БЛОК */}
            <ScrollWrapper ref={scrollWrapperRef}>
                {renderContent()}
            </ScrollWrapper>

            <GroupFilterDropdown
              open={isGroupFilterOpen}
              anchorEl={groupFilterButtonRef.current}
              groups={filteredUserGroups}
              selectedGroupId={selectedGroupId}
              onSelect={id => {
                setSelectedGroupId(id);
                setIsGroupFilterOpen(false);
              }}
              onClose={() => setIsGroupFilterOpen(false)}
            />
            <FixedFooter {...footerProps} />

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
