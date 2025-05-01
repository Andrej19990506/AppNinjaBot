import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { format } from 'date-fns';
import { addMinutes } from 'date-fns/addMinutes';
import { ru } from 'date-fns/locale';
import styled from 'styled-components';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddAlertIcon from '@mui/icons-material/AddAlert';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MessageIcon from '@mui/icons-material/Message';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import EditIcon from '@mui/icons-material/Edit';
import RepeatIcon from '@mui/icons-material/Repeat';
import { EventRead, EventNotification, RepeatSettings, EventCreate } from '../../types/event';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import { useAppSelector } from '../../store/hooks';
import { selectUser } from '../../store/slices/userSlice';
import CircularProgress from '@mui/material/CircularProgress';

// Определяем типы пропсов
interface EventItemProps {
    event: EventRead & { id: number | string };
    onDeleteClick?: (id: number | string) => void;
    layoutId?: string;
    layout?: boolean;
    isCreating?: boolean;
    onSaveCreating?: (data: EventCreate) => void | Promise<void>;
    onCancelCreating?: () => void;
    isJustSaved?: boolean;
    onAddNotificationClick?: (eventId: number, notificationId?: string) => void;
    isSaveLoading?: boolean;
}

// --- Обновляем Styled Component для EventItem --- 
const StyledEventItem = styled(motion.div)`
    /* --- Стили из CreatorContainer --- */
    background-color: var(--card-background); 
    padding: 15px; 
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-color);
    overflow: hidden; 
    /* --- Стили, специфичные для EventItem --- */
    position: relative; // Для позиционирования внутренних элементов (как deleteBackground)
    cursor: grab; // Намек на возможность перетаскивания
    &:active {
        cursor: grabbing;
    }

    // Убедись, что глобальные стили для .eventItem (если были) удалены или не конфликтуют
`;

// --- Styled Components для режима создания (похожие на InlineEventCreator) ---
const CreatorInput = styled.input`
    flex-grow: 1;
    padding: 8px 12px;
    border: 1px solid var(--input-border, var(--border-color));
    border-radius: var(--radius-sm);
    background-color: var(--input-background, var(--background-color));
    color: var(--input-text, var(--text-color));
    font-size: 1rem;
    outline: none;
    transition: border-color var(--transition-fast);

    &:focus {
        border-color: var(--primary-color);
    }

    &::placeholder {
        color: var(--input-placeholder, var(--text-secondary));
        opacity: 0.7;
    }
`;

const CreatorActions = styled.div`
    display: flex;
    align-items: center;
    gap: 5px; // Небольшой отступ между кнопками
`;

const CreatorButton = styled(motion.button)`
    background-color: transparent;
    border: none;
    padding: 5px;
    cursor: pointer;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color var(--transition-fast), color var(--transition-fast);

    &:hover:not(:disabled) {
        background-color: var(--hover-overlay);
    }

    &:disabled {
        opacity: var(--disabled-opacity, 0.5);
        cursor: not-allowed;
    }

    &.save:hover:not(:disabled) {
        color: var(--success-color, green);
    }

    &.cancel:hover:not(:disabled) {
        color: var(--error-color, red);
    }

    svg {
        width: 22px;
        height: 22px;
    }
`;

// --- Варианты анимации для контента режима создания ---
const creatorContentVariants = {
    hidden: { x: '-50%', opacity: 0 },
    visible: { 
        x: 0, 
        opacity: 1,
        transition: { 
            // type: 'spring', // Можно использовать spring для упругости
            // stiffness: 300,
            // damping: 30,
            duration: 0.3 // Или просто duration
        }
    },
    // exit не нужен, т.к. контент меняется, а не исчезает
};

// --- Новые Styled Components для Свайпа и Подтверждения ---
const DeleteBackground = styled(motion.div)`
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 25px;
    border-radius: inherit;
    pointer-events: none; // Оставляем
    // Фон задается инлайн
`;

const DeleteIconWrapper = styled(motion.div)`
    color: var(--text-color-on-error, #fff); // Цвет иконки на красном фоне
`;

const ConfirmContainer = styled(motion.div)`
    position: absolute;
    inset: 0;
    background-color: rgba(var(--overlay-rgb, 0, 0, 0), 0.75); // Полупрозрачный темный фон (добавить --overlay-rgb?)
    border-radius: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-color-on-dark, #fff); // Светлый текст
    padding: 15px;
    text-align: center;
    z-index: 10; // Поверх остального
    backdrop-filter: blur(4px); // Добавим размытие фона для стиля (если браузер поддерживает)
`;

const ConfirmText = styled.h3`
    margin: 0 0 15px 0; // Увеличим отступ снизу
    font-size: 1.1rem;
    font-weight: 600;
    color: inherit; // Наследуем светлый цвет
`;

const ConfirmButtonWrapper = styled.div`
    display: flex;
    gap: 15px;
`;

const ConfirmButton = styled(motion.button)`
    padding: 8px 20px; // Увеличим горизонтальный паддинг
    border-radius: var(--radius-md, 6px);
    border: none; // Убираем рамку по умолчанию
    cursor: pointer;
    font-weight: 600; // Сделаем жирнее
    transition: transform 0.1s ease-out, background-color 0.1s ease-out, color 0.1s ease-out;

    &.delete {
        // --- Стиль кнопки Удалить ---
        background-color: var(--error-color); 
        color: var(--text-color-on-error, #fff); 
        border: 1px solid var(--error-color);
    }

    &.cancel {
        // --- Стиль кнопки Отмена ---
        background-color: var(--gray-600, #4b5563); // Нейтральный темный фон
        color: var(--text-color-on-dark, #fff); // Светлый текст
        border: 1px solid var(--gray-600, #4b5563);
        /* Или можно сделать ее менее заметной */
        /* background-color: transparent; */
        /* color: var(--text-secondary-on-dark, #ccc); */ 
        /* border: 1px solid var(--text-secondary-on-dark, #ccc); */
    }

    &:hover {
        transform: scale(1.03);
    }
    &:active {
        transform: scale(0.97);
    }
`;

const CheckCircle = styled(motion.div)`
    display: flex;
    align-items: center;
    justify-content: center;
    // Стили для кружка с галочкой (можно оставить как есть или доработать)
`;

const AddNotificationPrompt = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0; // Добавим немного вертикального отступа
    margin-top: 8px; // Отступ сверху от описания
    border-top: 1px solid var(--border-color); // Разделитель

    .addAlertIcon {
        color: var(--primary-color);
        font-size: 24px; // Размер иконки
    }
`;

const PromptText = styled.div`
    flex-grow: 1;
    font-size: 0.9rem;
    color: var(--text-secondary);
`;

const AddNotificationButton = styled(motion.button)`
    padding: 6px 12px;
    background-color: var(--primary-transparent);
    color: var(--primary-color);
    border: 1px solid var(--primary-color);
    border-radius: var(--radius);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
        background-color: var(--primary-color);
        color: var(--text-color-on-primary, #fff);
    }
`;

// <<< Добавляем стили для обертки иконки >>>
const AddAlertIconWrapper = styled(motion.div)`
    display: flex; // Чтобы иконка была нормально выровнена
    align-items: center;
    justify-content: center;
    color: var(--primary-color);
`;

// <<< Добавляем Styled Components для отображения деталей уведомления >>>
const NotificationDetailsContainer = styled.div`
    display: flex;
    align-items: flex-start; // Выравниваем по верху, если текст будет в несколько строк
    gap: 12px;
    padding: 10px 0;
    margin-top: 8px;
    border-top: 1px solid var(--border-color);
`;

const NotificationIconWrapper = styled.div`
    color: var(--success-color, green); // Зеленый цвет для активного уведомления
    margin-top: 2px; // Небольшой сдвиг вниз для лучшего выравнивания
`;

const NotificationInfo = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.9rem;
    color: var(--text-color);
`;

const NotificationDetailLine = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-secondary);
    font-size: 0.85rem;

    svg {
        width: 16px;
        height: 16px;
        margin-right: 4px;
    }
`;

const EditNotificationButton = styled(motion.button)`
    background: none;
    border: none;
    padding: 0;
    margin-left: auto; // Прижимаем к правому краю
    cursor: pointer;
    color: var(--text-secondary); // Сделаем ее менее яркой
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;
    
    &:hover {
        color: var(--primary-color);
    }

    svg {
        width: 20px; // Чуть меньше плюса
        height: 20px;
    }
`;

// <<< Обновляем стили для "шапки" >>>
const EventInfoContainer = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 6px; // Отступ между описанием и деталями
`;

const EventDescription = styled.div`
    font-weight: 600;
    font-size: 1.05rem; // Чуть крупнее
    color: var(--text-color);
    line-height: 1.4;
    // Можно добавить ограничение по строкам, если нужно
    // display: -webkit-box;
    // -webkit-line-clamp: 3;
    // -webkit-box-orient: vertical;  
    // overflow: hidden;
`;

const EventDetailsRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 4px; // Небольшой отступ сверху

    svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0; // Чтобы иконка не сжималась
    }

    .status-active {
        color: var(--success-color, green);
    }
`;

// <<< Стили для тегов чатов >>>
const ChatTagsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
`;

const ChatTag = styled.span`
    background-color: var(--primary-transparent, rgba(0,0,0,0.05));
    color: var(--primary-dark, var(--primary-color));
    padding: 3px 8px;
    border-radius: var(--radius-sm, 4px);
    font-size: 0.75rem; // Мелкий шрифт
    font-weight: 500;
    white-space: nowrap;
`;

const EventItem: React.FC<EventItemProps> = ({ 
    event, 
    onDeleteClick,
    layoutId, 
    layout, 
    isCreating, 
    onSaveCreating, 
    onCancelCreating, 
    isJustSaved, 
    onAddNotificationClick, 
    isSaveLoading
}) => {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const x = useMotionValue(0);
    const opacity = useTransform(x, [0, 100], [0, 1]);
    const backgroundGradient = useTransform(
        x, 
        [0, 100, 150], 
        [
            `linear-gradient(to left, rgba(var(--error-rgb, 239, 68, 68), 0), rgba(var(--error-rgb, 239, 68, 68), 0) 0%)`,
            `linear-gradient(to left, rgba(var(--error-rgb, 239, 68, 68), 0.7), rgba(var(--error-rgb, 239, 68, 68), 0) 80%)`,
            `linear-gradient(to left, rgba(var(--error-rgb, 239, 68, 68), 0.85), rgba(var(--error-rgb, 239, 68, 68), 0.1) 70%)`
        ]
    );
    const iconScale = useTransform(x, [0, 60, 100], [0.4, 1, 1.1]);
    const iconOpacity = useTransform(x, [0, 50], [0, 1]);

    const vibrate = (pattern: VibratePattern) => {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    };

    const handleDragEnd = (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (isCreating) return; // Нельзя свайпать в режиме создания
        if (info.offset.x > 100) {
            setIsConfirming(true);
            vibrate(30);
        } else {
            x.set(0);
            vibrate(10);
        }
    };

    const handleConfirmDelete = async () => {
        if (!onDeleteClick) return;
        vibrate(30);
        setIsDeleting(true);
        try {
            setIsVisible(false);
            await new Promise(resolve => setTimeout(resolve, 300));
            await onDeleteClick(event.id);
        } catch (error) {
            console.error("Ошибка при удалении события:", error);
            setIsDeleting(false);
            setIsConfirming(false);
            setIsVisible(true);
            x.set(0);
        }
    };

    const handleCancelDelete = () => {
        vibrate(10);
        setIsConfirming(false);
        x.set(0);
    };

    useEffect(() => {
        const unsubscribe = x.onChange((latest: number) => {
            // Убрали вибрацию при движении
        });
        return () => unsubscribe();
    }, [x]);

    const isActive = event.scheduling_status?.active;
    const notificationCount = event.notifications?.length || 0;
    const loading = false;
    const chatNames: { [key: string | number]: string | undefined } = {}; 

    const isEventIncomplete = notificationCount === 0;

    const [inputValue, setInputValue] = useState(event.description || '');
    const [inputDate, setInputDate] = useState<Date | null>(event.date ? new Date(event.date) : new Date());
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isCreating) {
            inputRef.current?.focus();
            setInputValue(event.description || '');
            setInputDate(event.date ? new Date(event.date) : new Date());
        }
    }, [isCreating, event.description, event.date]);

    const handleSave = () => {
        if (!onSaveCreating || !inputDate) return;
        const valueToSave = inputValue.trim();
        if (!valueToSave) {
            handleCancel();
            return;
        }
        const dataToSave: EventCreate = {
            description: valueToSave,
            date: inputDate.toISOString() 
        };
        onSaveCreating(dataToSave);
    };

    const handleCancel = () => {
        if (!onCancelCreating) return;
        onCancelCreating();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const isSaveButtonDisabled = !inputValue?.trim() || !inputDate || isSaveLoading;

    const getNotificationTriggerTime = (eventDateStr: string | Date, timeBefore: number): Date | null => {
        try {
            const eventDate = new Date(eventDateStr);
            return addMinutes(eventDate, -timeBefore); 
        } catch (e) {
            console.error("Invalid event date for notification:", eventDateStr);
            return null;
        }
    };

    const user = useAppSelector(selectUser);
    const userChats = useMemo(() => {
        const chatMap = new Map<number, string>();
        user?.groups?.forEach(g => {
            if (g.chat_id && g.title) {
                chatMap.set(g.chat_id, g.title);
            }
        });
        return chatMap;
    }, [user]);

    const formatRepeatType = (type: RepeatSettings['type']): string => {
        switch (type) {
            case 'daily': return 'Ежедневно';
            case 'weekly': return 'Еженедельно';
            case 'monthly': return 'Ежемесячно';
            default: return 'Никогда';
        }
    };

    const formatWeekdays = (days?: number[]): string => {
        if (!days || days.length === 0) return '';
        const dayMap: { [key: number]: string } = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 0: 'Вс' };
        const sortedDays = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
        return `(${sortedDays.map(d => dayMap[d]).join(', ')})`;
    };

    const formatMonthDay = (day?: number): string => {
        if (!day) return '';
        return `(${day} число)`;
    };

    const formatRepeatDetails = (repeat: RepeatSettings): string => {
        const typeStr = formatRepeatType(repeat.type);
        let detailsStr = '';
        if (repeat.type === 'weekly') {
            detailsStr = formatWeekdays(repeat.weekdays);
        } else if (repeat.type === 'monthly') {
            detailsStr = formatMonthDay(repeat.month_day);
        }
        return `${typeStr} ${detailsStr}`.trim();
    };

    const notification = event.notifications?.[0];
    const eventIdForNotificationCallback = typeof event.id === 'number' ? event.id : undefined;

    return (
        // @ts-ignore // Known issue with framer-motion types
        <AnimatePresence>
            {isVisible && (
                <StyledEventItem 
                    layout={layout}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ 
                        opacity: 1, 
                        y: isJustSaved ? -15 : 0,
                        scale: isJustSaved ? 1.03 : 1, 
                    }}
                    exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                >
                    {!isCreating && (
                        <DeleteBackground style={{ background: backgroundGradient }}>
                            <DeleteIconWrapper style={{ scale: iconScale, opacity: iconOpacity }}>
                                <DeleteIcon />
                            </DeleteIconWrapper>
                        </DeleteBackground>
                    )}
                    <motion.div 
                        className="content"
                        layout={!isCreating ? true : undefined} 
                        drag={isCreating ? undefined : "x"}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.5}
                        onDragEnd={handleDragEnd}
                        style={{ x }}
                    >
                        {isCreating ? (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '24px',
                                    width: '100%' 
                                }}
                            >
                                <TextField
                                    inputRef={inputRef}
                                    label="Описание события"
                                    variant="outlined"
                                    size="small"
                                    multiline
                                    rows={2}
                                    placeholder="Новое событие..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    fullWidth
                                    disabled={isSaveLoading}
                                    InputProps={{ onKeyDown: handleKeyDown }}
                                />
                                <TextField
                                    label="Дата и время события"
                                    type="datetime-local"
                                    size="small"
                                    value={inputDate ? format(inputDate, "yyyy-MM-dd'T'HH:mm") : ''}
                                    onChange={(e) => setInputDate(e.target.value ? new Date(e.target.value) : null)}
                                    required
                                    fullWidth
                                    disabled={isSaveLoading}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <CreatorActions style={{ alignSelf: 'flex-end' }}>
                                    <CreatorButton
                                        className="save"
                                        onClick={handleSave}
                                        disabled={isSaveButtonDisabled}
                                        whileHover={{ scale: !isSaveButtonDisabled ? 1.1 : 1 }}
                                        whileTap={{ scale: !isSaveButtonDisabled ? 0.9 : 1 }}
                                        title={isSaveButtonDisabled ? "" : "Сохранить (Enter)"}
                                    >
                                        {isSaveLoading ? (
                                            <motion.div 
                                                style={{ width: '22px', height: '22px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%'}}
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            />
                                        ) : <CheckIcon />}
                                    </CreatorButton>
                                    <CreatorButton
                                        className="cancel"
                                        onClick={handleCancel}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        title="Отменить (Escape)"
                                        disabled={isSaveLoading}
                                    >
                                        <CloseIcon />
                                    </CreatorButton>
                                </CreatorActions>
                            </motion.div>
                        ) : (
                            <>
                                <EventInfoContainer>
                                    <EventDescription>{event.description || "Без описания"}</EventDescription>
                                    <EventDetailsRow>
                                        <EventAvailableIcon />
                                        <span>
                                            {event.date ? format(new Date(event.date), 'dd MMM yyyy HH:mm', { locale: ru }) : 'Дата не задана'}
                                        </span>
                                    </EventDetailsRow>
                                </EventInfoContainer>

                                <div className="actions">
                                    {!notification ? (
                                        <AddNotificationPrompt>
                                            <motion.div
                                                animate={{
                                                    scale: [1, 1.1, 1],
                                                    rotate: [0, -5, 5, -5, 0]
                                                }}
                                                transition={{
                                                    scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                                    rotate: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }
                                                }}
                                            >
                                                <AddAlertIcon className="addAlertIcon" />
                                            </motion.div>
                                            <PromptText>Добавить уведомление?</PromptText>
                                            <AddNotificationButton 
                                                onClick={() => eventIdForNotificationCallback && onAddNotificationClick && onAddNotificationClick(eventIdForNotificationCallback, undefined)}
                                                disabled={!eventIdForNotificationCallback}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                + Добавить 
                                            </AddNotificationButton>
                                        </AddNotificationPrompt>
                                    ) : (
                                        <NotificationDetailsContainer>
                                            <NotificationIconWrapper><NotificationsActiveIcon /></NotificationIconWrapper>
                                            <NotificationInfo>
                                                <NotificationDetailLine title={notification.message}>
                                                    <MessageIcon /> 
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                                        {notification.message}
                                                    </span>
                                                </NotificationDetailLine>
                                                <NotificationDetailLine>
                                                    <AccessTimeIcon />
                                                    {(() => {
                                                        const triggerTime = getNotificationTriggerTime(event.date, notification.time);
                                                        return triggerTime 
                                                               ? `${format(triggerTime, 'dd MMM HH:mm', { locale: ru })} (за ${notification.time} мин)`
                                                               : 'Неверная дата события';
                                                    })()}
                                                </NotificationDetailLine>
                                                {notification.repeat && notification.repeat.type !== 'none' && (
                                                    <NotificationDetailLine>
                                                        <RepeatIcon />
                                                        {formatRepeatDetails(notification.repeat)}
                                                    </NotificationDetailLine>
                                                )}
                                                {notification.chat_ids && notification.chat_ids.length > 0 && (
                                                    <ChatTagsContainer>
                                                        {notification.chat_ids.map(chatId => (
                                                            <ChatTag key={chatId}>
                                                                {userChats.get(chatId) || `ID: ${chatId}`}
                                                            </ChatTag>
                                                        ))}
                                                    </ChatTagsContainer>
                                                )}
                                            </NotificationInfo>
                                            <EditNotificationButton
                                                onClick={() => eventIdForNotificationCallback && notification && onAddNotificationClick && onAddNotificationClick(eventIdForNotificationCallback, notification.id)}
                                                disabled={!eventIdForNotificationCallback}
                                                whileHover={{ scale: 1.1 }} 
                                                whileTap={{ scale: 0.9 }}
                                                title="Редактировать уведомление"
                                            >
                                                <EditIcon />
                                            </EditNotificationButton>
                                        </NotificationDetailsContainer>
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                    {!isCreating && (
                        // @ts-ignore // Known issue with framer-motion types
                        <AnimatePresence>
                            {isConfirming && (
                                <ConfirmContainer 
                                    key="confirm-delete"
                                    initial={{ opacity: 0, scale: 0.9 }} 
                                    animate={{ opacity: 1, scale: 1 }} 
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                >
                                    {isDeleting ? (
                                        <CheckCircle>
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </CheckCircle>
                                    ) : (
                                        <>
                                            <ConfirmText>Удалить событие?</ConfirmText>
                                            <ConfirmButtonWrapper>
                                                <ConfirmButton className="delete" onClick={handleConfirmDelete}>Удалить</ConfirmButton>
                                                <ConfirmButton className="cancel" onClick={handleCancelDelete}>Отмена</ConfirmButton>
                                            </ConfirmButtonWrapper>
                                        </>
                                    )}
                                </ConfirmContainer>
                            )}
                        </AnimatePresence>
                    )}
                </StyledEventItem>
            )}
        </AnimatePresence>
    );
};

EventItem.displayName = 'EventItem';
export default memo(EventItem);