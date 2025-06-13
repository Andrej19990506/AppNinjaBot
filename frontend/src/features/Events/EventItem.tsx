import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { format } from 'date-fns';
import { addMinutes } from 'date-fns/addMinutes';
import { ru } from 'date-fns/locale';
import styled, { css, keyframes } from 'styled-components';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddAlertIcon from '@mui/icons-material/AddAlert';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MessageIcon from '@mui/icons-material/Message';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EditIcon from '@mui/icons-material/Edit';
import RepeatIcon from '@mui/icons-material/Repeat';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Button from '@mui/material/Button';
import { EventRead, RepeatSettings, EventCreate, NotificationCreate } from '../../types/event';
import type { EventNotification } from '../../types/event';
import TextField from '@mui/material/TextField';
import { useAppSelector, useAppDispatch } from '../../shared/store/hooks';
import { selectUser, selectActiveRole } from '@shared/store/userSlice/userSelectors';
import type { User, Group } from '@/types/user';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { openAtoModal, setAtoCreateMode } from '@/store/slices/atoModalSlice';

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
    onAddNotificationClick?: (eventId: number, notificationId?: string, initialData?: Partial<ExtendedNotificationCreate>) => void;
    isSaveLoading?: boolean;
    onAtoModalOpen?: (isOpen: boolean, isCreateMode: boolean) => void;
}

// Расширяем тип для уведомлений с дополнительными полями
interface ExtendedEventNotification extends EventNotification {
    // Добавляем новые поля для управления временем уведомления
    use_absolute_time?: boolean;  // Если true, используем absolute_time вместо time (минут до события)
    absolute_time?: string;       // ISO строка с абсолютным временем для уведомления
    send_now?: boolean;           // Если true, отправляем уведомление немедленно
}

// Расширяем тип для создания уведомлений
interface ExtendedNotificationCreate extends NotificationCreate {
    use_absolute_time?: boolean;
    absolute_time?: string;
    send_now?: boolean;
}

// Анимации для новых компонентов
const pulseAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(var(--primary-rgb), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0); }
`;

const breatheAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
`;

const shineAnimation = keyframes`
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
`;

// Стили для комментариев перенесены в компонент AtoCommentsModal

// Стилизованная кнопка для создания уведомления
const EnhancedNotificationButton = styled(Button)`
  && {
    margin-top: 16px !important;
    margin-bottom: 16px !important;
    padding: 10px 16px !important;
    border-radius: var(--radius) !important;
    background: var(--gradient-primary) !important;
    box-shadow: var(--shadow-sm) !important;
    transition: transform var(--transition-normal), box-shadow var(--transition-normal) !important;
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 50%;
      height: 100%;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.3) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: ${shineAnimation} 3s infinite linear;
    }
    
    &:hover {
      transform: translateY(-2px) !important;
      box-shadow: var(--shadow-md) !important;
    }
    
    &:active {
      transform: translateY(0) !important;
    }
  }
`;

const ActionButtonsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  gap: 16px;
`;

const ActionButton = styled(Button)`
  && {
    padding: 10px 16px !important;
    border-radius: var(--radius) !important;
    transition: transform var(--transition-normal), box-shadow var(--transition-normal) !important;
    
    &:hover {
      transform: translateY(-2px) !important;
      box-shadow: var(--shadow-sm) !important;
    }
    
    &:active {
      transform: translateY(0) !important;
    }
  }
`;

const SelectionSummary = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  background-color: var(--card-background);
  border-radius: var(--radius);
  border-left: 4px solid var(--primary-color);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-normal);
  
  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
`;

const SummaryTitle = styled.div`
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-color);
`;

const SummaryDetail = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  
  svg {
    color: var(--primary-color);
  }
`;

// Стили для диалогов удалены, т.к. теперь используем AtoCommentsModal

// Анимационные варианты для компонентов
const commentCardVariants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95
  },
  visible: (i: number) => ({ 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { 
      delay: i * 0.05,
      duration: 0.3,
      ease: "easeOut"
    }
  }),
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

const commentContentVariants = {
  collapsed: { 
    height: 0, 
    opacity: 0,
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 }
    }
  },
  expanded: { 
    height: "auto", 
    opacity: 1,
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.3, delay: 0.1 }
    }
  }
};

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

// НОВЫЙ STYLED COMPONENT ДЛЯ ТЕГА
const StyledAtoTag = styled.span<{$isActive: boolean}>`
    display: inline-block;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
    border: 1px solid transparent;
    user-select: none;

    ${(props: { $isActive: boolean }) => 
        props.$isActive 
        ? css`
            background-color: var(--primary-color);
            color: var(--text-color-on-primary, #fff);
            border-color: var(--primary-dark);
        ` 
        : css`
            background-color: var(--gray-200);
            color: var(--text-secondary);
            border-color: var(--gray-300);

            [data-theme="dark"] & {
                background-color: var(--gray-700);
                color: var(--text-secondary);
                border-color: var(--gray-600);
            }
        `
    }

    &:hover {
        ${(props: { $isActive: boolean }) => 
            props.$isActive 
            ? css`
                background-color: var(--primary-dark);
            ` 
            : css`
                background-color: var(--gray-300);
                border-color: var(--gray-400);
                [data-theme="dark"] & {
                    background-color: var(--gray-600);
                    border-color: var(--gray-500);
                }
            `
        }
    }
`;

// Обновляем стили для иконки АТО и счетчика замечаний
const AtoIconContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: 12px;
`;

const AtoIcon = styled(motion.div)`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 50%;
    background: var(--gradient-primary);
    color: white;
    position: relative;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    animation: ${pulseAnimation} 2s infinite;
    
    &::after {
        content: "Показать";
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 8px;
        opacity: 0;
        transition: opacity 0.2s;
        white-space: nowrap;
        color: var(--text-secondary);
    }
    
    &:hover {
        transform: translateY(-2px) scale(1.1);
        box-shadow: var(--shadow-md);
        
        &::after {
            opacity: 1;
        }
    }
    
    &:active {
        transform: translateY(0) scale(0.95);
    }
`;

const CommentCount = styled.div`
    background-color: var(--orange-dark);
    color: white;
    font-size: 10px;
    font-weight: bold;
    border-radius: 10px;
    padding: 2px 6px;
    min-width: 18px;
    text-align: center;
    position: absolute;
    top: -6px;
    right: -6px;
    border: 2px solid var(--card-background);
    box-shadow: var(--shadow-sm);
`;

// Обновляем стили для бейджа процента выполнения АТО
const AtoScoreBadge = styled(motion.div)<{ $percentage?: number }>`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    min-width: 60px;
    border-radius: 14px;
    padding: 0 10px;
    font-size: 14px;
    font-weight: 700;
    color: white;
    background-color: ${props => {
        const percentage = props.$percentage || 0;
        if (percentage >= 90) return 'var(--orange-primary)';  // Оранжевый для высокого процента
        if (percentage >= 70) return 'var(--orange-light)';    // Светло-оранжевый для среднего
        return 'var(--orange-dark)';                          // Темно-оранжевый для низкого
    }};
    box-shadow: var(--shadow-sm);
    user-select: none;
    
    // Градиентная обводка для бейджа
    position: relative;
    &::before {
        content: "";
        position: absolute;
        inset: -1px;
        border-radius: inherit;
        padding: 1px;
        background: linear-gradient(
            45deg,
            transparent,
            rgba(255, 255, 255, 0.5),
            transparent
        );
        -webkit-mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
        mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
    }
`;

// Стили для компонентов работы с комментариями удалены, т.к. теперь используем AtoCommentsModal

// Прежние компоненты диалога удалены, теперь используем AtoCommentsModal

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
    isSaveLoading,
    onAtoModalOpen
}) => {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [isAtoCategory, setIsAtoCategory] = useState(false);
    const [selectedAtoChatId, setSelectedAtoChatId] = useState<number | ''>('');

    const user: User | null = useAppSelector(selectUser);
    const dispatch = useAppDispatch();
    const groupType = useAppSelector(selectActiveRole);

    // Эти состояния нужны для других функций
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

    const atoPrefix = "[АТО] ";

    // Получаем доступные чаты пользователя (для выбора чата АТО)
    const availableChats = useMemo(() => {
        const u: User | null = user;
        return u?.groups
            ?.filter((g: Group) => g.group_type === groupType && g.chat_id)
            ?.map((g: Group) => ({ id: Number(g.chat_id), name: g.title || `Чат ${g.chat_id}` }))
            || [];
    }, [user, groupType]);

    // Эффект для обновления описания при изменении isAtoCategory
    useEffect(() => {
        if (isCreating) { // Применяем только в режиме создания
            setInputValue(currentDescription => {
                const hasPrefix = currentDescription.startsWith(atoPrefix);
                if (isAtoCategory && !hasPrefix) {
                    return atoPrefix + currentDescription;
                } else if (!isAtoCategory && hasPrefix) {
                    return currentDescription.substring(atoPrefix.length);
                }
                return currentDescription;
            });
        }
    }, [isAtoCategory, isCreating]);

    // Сбрасываем isAtoCategory и inputValue при смене event или выходе из isCreating
    useEffect(() => {
        if (isCreating) {
            inputRef.current?.focus();
            const initialDescription = event.description || '';
            setInputValue(initialDescription);
            setInputDate(event.date ? new Date(event.date) : new Date());
            const initialIsAto = event.event_type === 'ato' || initialDescription.startsWith(atoPrefix);
            setIsAtoCategory(initialIsAto);
            
            if (initialIsAto && event.chat_ids && event.chat_ids.length > 0 && typeof event.chat_ids[0] === 'number') {
                setSelectedAtoChatId(event.chat_ids[0]);
            } else {
                setSelectedAtoChatId('');
            }
        } else {
            setIsAtoCategory(event.event_type === 'ato');
            setInputValue(event.description || '');
            setSelectedAtoChatId( (event.event_type === 'ato' && event.chat_ids && event.chat_ids.length > 0 && typeof event.chat_ids[0] === 'number') ? event.chat_ids[0] : ''); 
        }
    }, [isCreating, event.description, event.date, event.event_type, event.chat_ids, atoPrefix]);

    const handleSave = () => {
        if (!onSaveCreating || !inputDate) return;
        let valueToSave = inputValue.trim();
        
        const hasPrefix = valueToSave.startsWith(atoPrefix);
        if (isAtoCategory && !hasPrefix) {
            valueToSave = atoPrefix + valueToSave;
        } else if (!isAtoCategory && hasPrefix) {
            valueToSave = valueToSave.substring(atoPrefix.length);
        }

        if (!valueToSave || (isAtoCategory && valueToSave === atoPrefix.trim())) { 
            console.warn("Описание не может быть пустым");
            return;
        }

        // Для АТО событий находим group_telegram_id по выбранному chat_id
        let groupTelegramId: number | undefined;
        if (isAtoCategory && selectedAtoChatId !== '') {

            
            // Ищем группу с выбранным chat_id в группах пользователя
            const selectedGroup = user?.groups?.find((g: Group) => g.chat_id === String(selectedAtoChatId));
            console.log("Найденная группа:", selectedGroup);
            
            if (selectedGroup?.group_id) {
                // group_id и есть telegram_id группы
                groupTelegramId = selectedGroup.group_id;
                console.log("Найден group_telegram_id:", groupTelegramId);
            } else {
                // Если не нашли по chat_id, то попробуем получить из selectedAtoChatId напрямую
                // Т.к. в некоторых случаях chat_id может совпадать с group_id
                groupTelegramId = Number(selectedAtoChatId);
                console.log("Использую selectedAtoChatId как group_telegram_id:", groupTelegramId);
            }
        }

        const dataToSave: EventCreate = {
            description: valueToSave,
            date: inputDate.toISOString(),
            event_type: isAtoCategory ? 'ato' : 'manual',
            ...(isAtoCategory && selectedAtoChatId !== '' && { 
                chat_ids: [Number(selectedAtoChatId)],
                group_telegram_id: groupTelegramId
            }),
            ...(groupType && { group_type: groupType })
        };
        
        // Отладка: выводим итоговые данные для сохранения
        console.log("Данные для сохранения события:", dataToSave);
        
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

    const isSaveButtonDisabled = !inputValue?.trim() || !inputDate || isSaveLoading || (isAtoCategory && selectedAtoChatId === '');

    const getNotificationTriggerTime = (eventDateStr: string | Date, timeBefore: number): Date | null => {
        try {
            const eventDate = new Date(eventDateStr);
            return addMinutes(eventDate, -timeBefore); 
        } catch (e) {
            console.error("Invalid event date for notification:", eventDateStr);
            return null;
        }
    };

    const userChats = useMemo(() => {
        const chatMap = new Map<number, string>();
        user?.groups?.forEach((g: Group) => {
            if (g.chat_id) {
                chatMap.set(
                    Number(g.chat_id),
                    g.chat_title || g.title || `Чат ${g.chat_id}`
                );
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

    // Форматируем комментарии для более удобного отображения
    const formattedComments = useMemo(() => {
        // Проверяем, что event существует
        if (!event) return [];
        
        // Подробное логирование оригинальных данных
        console.log('EVENT DATA (retailiqa_detailed_violations):', JSON.stringify(event.retailiqa_detailed_violations, null, 2));
        
        // Если есть детализированные нарушения с привязанными фотографиями
        if (event.retailiqa_detailed_violations && Array.isArray(event.retailiqa_detailed_violations)) {
            // Логируем количество нарушений
            console.log(`EventItem.tsx: Всего ${event.retailiqa_detailed_violations.length} нарушений`);
            
            // Считаем нарушения с фотографиями
            let violationsWithPhotos = 0;
            let totalPhotos = 0;
            
            event.retailiqa_detailed_violations.forEach((violation, idx) => {
                if (violation.photos && Array.isArray(violation.photos) && violation.photos.length > 0) {
                    violationsWithPhotos++;
                    totalPhotos += violation.photos.length;
                    console.log(`EventItem.tsx: Нарушение #${idx+1} (${violation.title}) имеет ${violation.photos.length} фото:`, violation.photos);
                }
            });
            
            console.log(`EventItem.tsx: ИТОГО ${violationsWithPhotos} нарушений с фотографиями, всего ${totalPhotos} фотографий`);
            
            // Преобразуем детализированные нарушения в формат AtoComment
            const formattedViolations = event.retailiqa_detailed_violations.map((violation) => {
                // Определяем тип нарушения на основе штрафных баллов
                const commentType = violation.penalty > 0 ? 'нарушение' : 'замечание';
                
                // Проверяем наличие фотографий в нарушении и их валидность
                let photos: string[] = [];
                if (violation.photos && Array.isArray(violation.photos)) {
                    photos = violation.photos.filter(url => 
                        typeof url === 'string' && url.trim() !== '' && url.startsWith('http')
                    );
                }
                
                
                return {
                    id: `${violation.title}-${Date.now()}-${Math.random()}`.replace(/\s+/g, '-'),
                    title: violation.title,
                    text: violation.text || '',
                    type: violation.type || commentType,
                    penaltyPoints: violation.penalty || 0,
                    photos: photos
                };
            });
            
            return formattedViolations;
        }
        
        // Если нет детализированных нарушений, возвращаем пустой массив
        return [];
    }, [event]);
    
    const totalComments = Array.isArray(event.retailiqa_comments) ? event.retailiqa_comments.length : 0;
    
    // Вычисляем процент выполнения проверки
    const scorePercentage = useMemo(() => {
        // Если есть прямое указание процента в данных события
        if (event.retailiqa_score_percentage !== undefined) {
            return event.retailiqa_score_percentage;
        }
        
        // Если есть максимальные и заработанные баллы, вычисляем процент
        if (event.retailiqa_max_points && event.retailiqa_earned_points) {
            return (event.retailiqa_earned_points / event.retailiqa_max_points) * 100;
        }
        
        return undefined;
    }, [event.retailiqa_score_percentage, event.retailiqa_max_points, event.retailiqa_earned_points]);
    
    const handleOpenAtoModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Открываем модальное окно через Redux
        if (event.retailiqa_comments && event.retailiqa_comments.length > 0) {
            // Удаляем логирование общего массива фотографий
            console.log('EventItem.tsx - formattedComments:', formattedComments);
            
            // Добавляем детальное логирование для проверки фотографий в нарушениях
            if (event.retailiqa_detailed_violations && Array.isArray(event.retailiqa_detailed_violations)) {
                console.log('EventItem.tsx - Детальный анализ нарушений и их фотографий:');
                event.retailiqa_detailed_violations.forEach((violation: any, index) => {
                    console.log(`Нарушение #${index}: ${violation.title}`);
                    console.log(`  - Фотографии:`, violation.photos || 'отсутствуют');
                    
                    // Проверяем, есть ли фотографии у нарушения
                    if (!violation.photos || !Array.isArray(violation.photos) || violation.photos.length === 0) {
                        console.log(`  - ВНИМАНИЕ: У нарушения отсутствуют фотографии или массив некорректен`);
                    }
                });
                
                // Проверяем, корректно ли перенесены фотографии в formattedComments
                formattedComments.forEach((comment: any, index) => {
                    console.log(`Проверка formattedComment #${index}: ${comment.title}`);
                    console.log(`  - Фотографии в formattedComment:`, comment.photos || 'отсутствуют');
                    
                    // Находим соответствующее нарушение в retailiqa_detailed_violations
                    if (event.retailiqa_detailed_violations && Array.isArray(event.retailiqa_detailed_violations)) {
                        const originalViolation = event.retailiqa_detailed_violations.find(
                            (v: any) => v.title === comment.title
                        );
                        
                        if (originalViolation) {
                            const originalPhotos = originalViolation.photos || [];
                            const formattedPhotos = comment.photos || [];
                            
                            if (originalPhotos.length !== formattedPhotos.length) {
                                console.log(`  - ОШИБКА: Количество фотографий не совпадает! Оригинал: ${originalPhotos.length}, Отформатировано: ${formattedPhotos.length}`);
                            }
                        }
                    }
                });
            }
            
            dispatch(openAtoModal({
                comments: formattedComments,
                penaltyPoints: event.retailiqa_penalty_points,
                objectName: event.retailiqa_insp_obj_name,
                scorePercentage: scorePercentage,
                maxPoints: event.retailiqa_max_points,
                earnedPoints: event.retailiqa_earned_points
            }));
        }
        
        // Для обратной совместимости сохраняем вызов колбэка
        if (onAtoModalOpen) onAtoModalOpen(true, false);
    };
    
    const handleCloseAtoModal = () => {
        if (onAtoModalOpen) onAtoModalOpen(false, false);
    };
    
    const handleToggleAtoCreateMode = () => {
        dispatch(setAtoCreateMode(true));
        if (onAtoModalOpen) onAtoModalOpen(true, true);
    };

    const handleCreateAtoNotification = (data: {
        selectedComments: string[];
        selectedCommentTexts: string[];
        formattedMessage: string;
    }) => {
        // Получаем chat_ids из события
        const chatIds: number[] = [];
        if (event && event.event_type === 'ato' && event.chat_ids && event.chat_ids.length > 0) {
            event.chat_ids.forEach(id => {
                if (typeof id === 'number') {
                    chatIds.push(id);
                }
            });
        }
        
        // Проверяем, есть ли eventId для создания уведомления
        if (!eventIdForNotificationCallback) {
            console.error("ID события не найден, невозможно создать уведомление");
            return;
        }

        // Открываем форму с предзаполненными данными
        const notificationData: Partial<ExtendedNotificationCreate> = {
            message: data.formattedMessage,
            chat_ids: chatIds,
            requires_confirmation: true,
            // Для немедленной отправки установим time=0 и send_now=true
            time: 0,
            repeat: { type: 'none' },
            send_now: true
        };
        
        // Открываем форму создания уведомления
        if (onAddNotificationClick) {
            onAddNotificationClick(eventIdForNotificationCallback, undefined, notificationData);
        }
    };

    // Форматируем информацию о времени уведомления для отображения
    const formatNotificationTime = (notif: EventNotification, eventDate: string | Date): string => {
        // Приводим к расширенному типу
        const notification = notif as ExtendedEventNotification;
        
        if (notification.send_now) {
            return 'Отправлено сразу';
        } else if (notification.use_absolute_time && notification.absolute_time) {
            const absTime = new Date(notification.absolute_time);
            return `${format(absTime, 'dd MMM HH:mm', { locale: ru })} (абсолютное время)`;
        } else {
            const triggerTime = getNotificationTriggerTime(eventDate, notification.time);
            return triggerTime 
                ? `${format(triggerTime, 'dd MMM HH:mm', { locale: ru })} (за ${notification.time} мин)`
                : 'Неверная дата события';
        }
    };
    

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
                                <div style={{ marginTop: '15px', marginBottom: '10px', alignSelf: 'flex-start' }}>
                                    <StyledAtoTag 
                                        $isActive={isAtoCategory} 
                                        onClick={() => !isSaveLoading && setIsAtoCategory(!isAtoCategory)}
                                        title={isAtoCategory ? "Выключить категорию АТО" : "Включить категорию АТО"}
                                    >
                                        АТО
                                    </StyledAtoTag>
                                </div>
                                {isAtoCategory && (
                                    <FormControl fullWidth required disabled={isSaveLoading} size="small">
                                        <InputLabel id="ato-chat-select-label">Чат для АТО</InputLabel>
                                        <Select
                                            labelId="ato-chat-select-label"
                                            value={selectedAtoChatId}
                                            label="Чат для АТО"
                                            onChange={(e: SelectChangeEvent<string | number>) => setSelectedAtoChatId(e.target.value as (number | ''))}
                                        >
                                            <MenuItem value="">
                                                <em>Не выбран</em>
                                            </MenuItem>
                                            {availableChats.map((chat: { id: number; name: string }) => (
                                                <MenuItem key={chat.id} value={chat.id}>
                                                    {chat.name}
                                                </MenuItem>
                                            ))}
                                            {availableChats.length === 0 && (
                                                <MenuItem disabled>Нет доступных чатов "chef"</MenuItem>
                                            )}
                                        </Select>
                                        {isSaveButtonDisabled && selectedAtoChatId === '' && isAtoCategory && <p style={{ color: 'red', fontSize: '0.8em', margin: '3px 14px 0' }}>Выберите чат для АТО</p>}
                                    </FormControl>
                                )}
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
                                    {(event.event_type === 'ato' || event.event_type === 'АТО') && (
                                        <EventDetailsRow style={{ marginTop: '8px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <StyledAtoTag $isActive={true} style={{ cursor: 'default' }}>АТО</StyledAtoTag>
                                                
                                                {event.chat_ids && event.chat_ids.length > 0 && typeof event.chat_ids[0] === 'number' && availableChats.length > 0 && (
                                                    <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>
                                                        ({availableChats.find((c: { id: number; name: string }) => c.id === Number(event.chat_ids![0]))?.name || `ID: ${event.chat_ids![0]}`})
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {Array.isArray(event.retailiqa_comments) && event.retailiqa_comments.length > 0 && (
                                                <AtoIconContainer>
                                                    {/* Бейдж с процентом выполнения - не открывает модальное окно */}
                                                    {scorePercentage !== undefined && (
                                                        <AtoScoreBadge 
                                                            $percentage={scorePercentage}
                                                            whileHover={{ y: -2, boxShadow: "var(--shadow-md)" }}
                                                            whileTap={{ y: 0, boxShadow: "var(--shadow-sm)" }}
                                                        >
                                                            {scorePercentage !== null ? Math.round(scorePercentage) : '0'}%
                                                        </AtoScoreBadge>
                                                    )}
                                                    
                                                    {/* Иконка и счетчик комментариев - открывает модальное окно */}
                                                    <AtoIcon
                                                        onClick={handleOpenAtoModal}
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                    >
                                                        <ErrorOutlineIcon style={{ fontSize: '18px' }} />
                                                        <CommentCount>{event.retailiqa_comments.length}</CommentCount>
                                                    </AtoIcon>
                                                </AtoIconContainer>
                                            )}
                                        </EventDetailsRow>
                                    )}
                                </EventInfoContainer>

                                <div className="actions">
                                    {!notification ? (
                                        // Показываем кнопку "Добавить уведомление" только для НЕ-АТО событий
                                        event.event_type !== 'ato' && event.event_type !== 'АТО' ? (
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
                                        ) : null // Для АТО событий не показываем промпт
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
                                                    {formatNotificationTime(notification, event.date)}
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
                        <div>
                          {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                          {/* @ts-ignore */}
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
                        </div>
                    )}
                </StyledEventItem>
            )}
        </AnimatePresence>
    );
};

EventItem.displayName = 'EventItem';
export default memo(EventItem);