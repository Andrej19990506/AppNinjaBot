import React, { useEffect, useRef, useState, useCallback } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircle from '@mui/icons-material/CheckCircle';
import PlayCircle from '@mui/icons-material/PlayCircle';
import PendingActions from '@mui/icons-material/PendingActions';
import Refresh from '@mui/icons-material/Refresh';
import AccessTime from '@mui/icons-material/AccessTime';
import HomeIcon from '@mui/icons-material/Home';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import styles from './ChatSelector.module.css';
import { ChatListSkeleton } from '../Skeleton';
import ConfirmDialog from '../../Inventory/ConfirmDialog';
import { SingleSystemNotification } from '../../notifications/SystemNotification';
import { checkAdminRights } from '../../../store/slices/userSlice';
import { RootState } from '../../../store/store';
import ChatModal from '../ChatModal/ChatModal';
import { setSelectedChat, setContext, ChatContext } from '../../../store/slices/chatSlice';
import { Admin } from '../../../types/inventory';



// Общий интерфейс для чата, который будет использоваться во всех режимах
export interface ChatItem {
    chat_id: string;
    chat_title: string;
    metadata?: {
        progress?: number;
        lastUpdated?: string;
        chat_id?: string;
        [key: string]: any;
    };
    admins: Admin[];
    members?: Array<{
        user_id: number;
        first_name: string;
        photo_url?: string;
    }>;
    inventory?: any;
    [key: string]: any;
}

// Интерфейс для уведомлений
interface SystemNotificationType {
    message: string;
    type: 'success' | 'error' | 'warning';
}

export interface ChatSelectorProps {
    chats: ChatItem[];
    onChatSelect: (chatId: string, chat: ChatItem) => void;
    onResetInventory?: (chatId: string) => Promise<void>;
    mode: ChatContext;
    title?: string;
    onHomeClick?: () => void;
}

// Константы для свайпа
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const swipeConfidenceThreshold = 10000;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
};

// Функция для определения заголовка в зависимости от режима
function getTitleByMode(mode: ChatContext): string {
    switch (mode) {
        case 'inventory':
            return 'Выберите чат для инвентаризации';
        case 'writeoff':
            return 'Выберите чат для списания';
        case 'events':
            return 'Выберите чат для просмотра событий';
        default:
            return 'Выберите чат';
    }
}

const ChatSelector: React.FC<ChatSelectorProps> = ({ 
    chats, 
    onChatSelect, 
    onResetInventory,
    mode = 'inventory',
    title = getTitleByMode(mode),
    onHomeClick
}) => {
    const dispatch = useAppDispatch();
    const currentUser = useAppSelector((state: RootState) => state.user.user);
    const [resetConfirmation, setResetConfirmation] = useState<{ chatId: string; button: HTMLButtonElement } | null>(null);
    const [systemNotification, setSystemNotification] = useState<SystemNotificationType>({ message: '', type: 'success' });
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [direction, setDirection] = useState(0);
    const [selectedChatLocal, setSelectedChatLocal] = useState<ChatItem | null>(null);
    const [showModal, setShowModal] = useState(false);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const [isNavigating, setIsNavigating] = useState(false);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [error, setError] = useState<string | null>(null);
    const cardsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        cardRefs.current = cardRefs.current.slice(0, chats.length);
    }, [chats.length]);

    const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const card = event.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    }, []);

    const getInventoryStatus = useCallback((chat: ChatItem): 'completed' | 'in-progress' | 'not-started' => {
        // Проверяем статус только для режима инвентаризации
        if (mode !== 'inventory') return 'not-started';
        
        const progress = chat.metadata?.progress || 0;
        if (progress === 100) return 'completed';
        if (progress > 0) return 'in-progress';
        return 'not-started';
    }, [mode]);

    const getStatusText = useCallback((status: 'completed' | 'in-progress' | 'not-started'): string => {
        // Показываем статус только для режима инвентаризации
        if (mode !== 'inventory') return '';
        
        switch (status) {
            case 'completed':
                return 'Завершено';
            case 'in-progress':
                return 'В процессе';
            case 'not-started':
                return 'Не начато';
        }
    }, [mode]);

    const handleResetInventory = useCallback(async (chatId: string, event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!onResetInventory) return;

        const chat = chats.find(c => c.chat_id === chatId);
        if (!chat || !currentUser?.id) {
            setSystemNotification({
                message: 'Ошибка: ID пользователя не найден',
                type: 'error'
            });
            return;
        }

        try {
            await dispatch(checkAdminRights({
                userId: currentUser.id,
                chatId: chat.chat_id,
                admins: chat.admins,
                context: mode
            })).unwrap();

            setResetConfirmation({
                chatId,
                button: event.currentTarget
            });
        } catch (error) {
            console.error('Ошибка при проверке прав:', error);
            setSystemNotification({
                message: error as string,
                type: 'error'
            });
        }
    }, [currentUser?.id, dispatch, mode, onResetInventory, chats]);

    const handleResetConfirm = useCallback(async () => {
        if (!resetConfirmation || !onResetInventory) return;

        try {
            resetConfirmation.button.classList.add(styles.rotating);
            await onResetInventory(resetConfirmation.chatId);
            
            setSystemNotification({
                message: 'Инвентаризация успешно сброшена',
                type: 'success'
            });
        } catch (error) {
            console.error('Ошибка при сбросе инвентаризации:', error);
            setSystemNotification({
                message: 'Ошибка при сбросе инвентаризации',
                type: 'error'
            });
        } finally {
            if (resetConfirmation.button) {
                resetConfirmation.button.classList.remove(styles.rotating);
            }
            setResetConfirmation(null);
        }
    }, [resetConfirmation, onResetInventory]);

    const handleChatClick = useCallback(async (chat: ChatItem) => {
        if (!currentUser?.id) {
            setSystemNotification({
                message: 'Ошибка: ID пользователя не найден',
                type: 'error'
            });
            return;
        }

        try {
            // Проверяем права администратора
            await dispatch(checkAdminRights({
                userId: currentUser.id,
                chatId: chat.chat_id,
                admins: chat.admins,
                context: mode
            })).unwrap();

            // Устанавливаем контекст и выбранный чат в Redux
            dispatch(setContext(mode));
            dispatch(setSelectedChat(chat.chat_id));
            
            // Вызываем колбэк выбора чата
            onChatSelect(chat.chat_id, chat);
            
            // Показываем модальное окно
            setSelectedChatLocal(chat);
            setShowModal(true);
            setSelectedChatId(chat.chat_id);
        } catch (error: any) {
            console.error('Ошибка при проверке прав:', error);
            setSystemNotification({
                message: typeof error === 'string' ? error : error?.message || 'Ошибка при проверке прав',
                type: 'error'
            });
            setError(null);
        }
    }, [currentUser?.id, dispatch, mode, onChatSelect]);

    const handleStartAction = useCallback(async () => {
        const selectedChat = chats.find(chat => chat.chat_id === selectedChatId);
        console.log('ChatSelector: handleStartAction called, selectedChat:', selectedChatId);
        console.log('ChatSelector: isNavigating:', isNavigating);

        if (!selectedChat || isNavigating) {
            console.log('ChatSelector: Действие отменено - чат не выбран или уже идет навигация');
            return;
        }

        try {
            setIsNavigating(true);
            console.log('ChatSelector: Setting isNavigating to true');

            // Проверяем текущий URL
            const targetUrl = `/inventory/${selectedChat.chat_id}`;
            const currentUrl = window.location.pathname;

            console.log('ChatSelector: Starting transition to inventory');
            
            if (currentUrl === targetUrl) {
                console.log('ChatSelector: Already on target page, forcing reload');
                window.location.reload();
                return;
            }

            // Устанавливаем выбранный чат в Redux перед навигацией
            dispatch(setContext('inventory'));
            dispatch(setSelectedChat(selectedChat.chat_id));
            console.log('ChatSelector: Chat selected in Redux');

            // Выполняем навигацию
            navigate(targetUrl, { replace: true });
            console.log('ChatSelector: Navigation completed');

            console.log('ChatSelector: Transition completed successfully');
        } catch (error) {
            console.error('ChatSelector: Error during transition:', error);
            setError('Произошла ошибка при переходе к инвентаризации');
        } finally {
            setIsNavigating(false);
            console.log('ChatSelector: Reset navigation state');
        }
    }, [selectedChatId, chats, isNavigating, dispatch, navigate]);

    const handleModalClose = useCallback(() => {
        console.log('ChatSelector: handleModalClose called, isNavigating:', isNavigating);
        if (!isNavigating) {
            setShowModal(false);
            setSelectedChatLocal(null);
            setIsNavigating(false);
        }
    }, [isNavigating]);

    const handleHomeClick = useCallback(() => {
        if (onHomeClick) {
            onHomeClick();
        } else {
            navigate('/');
        }
    }, [onHomeClick, navigate]);

    // Обработчик свайпов
    useEffect(() => {
        if (!cardsContainerRef.current) return;

        let startX = 0;
        let isDragging = false;

        const handleTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!isDragging) return;
            isDragging = false;

            const diff = e.changedTouches[0].clientX - startX;
            const shouldSwipe = Math.abs(diff) > window.innerWidth * 0.2;

            if (shouldSwipe) {
                const direction = diff > 0 ? -1 : 1;
                const newIndex = activeIndex + direction;

                if (newIndex >= 0 && newIndex < chats.length) {
                    setActiveIndex(newIndex);
                }
            }
        };

        const container = cardsContainerRef.current;
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: true });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [activeIndex, chats.length]);

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {(!currentUser || !chats || chats.length === 0) ? (
                    <div className={styles.skeletonWrapper}>
                        <ChatListSkeleton 
                            animation="shimmer"
                            theme="dark"
                        />
                    </div>
                ) : (
                    <div className={styles.contentWrapper}>
                        <h1 className={styles.title}>{title}</h1>

                        {systemNotification.message && (
                            <SingleSystemNotification 
                                message={systemNotification.message}
                                type={systemNotification.type}
                                duration={5000}
                                onClose={() => setSystemNotification({ message: '', type: 'success' })}
                            />
                        )}

                        <div className={styles.chatList} ref={cardsContainerRef}>
                            {chats.map((chat, index) => (
                                <div
                                    key={chat.chat_id}
                                    ref={el => cardRefs.current[index] = el}
                                    className={`${styles.chatItem} ${styles[getInventoryStatus(chat)]}`}
                                    style={{ 
                                        display: index === activeIndex ? 'block' : 'none'
                                    }}
                                    onClick={() => handleChatClick(chat)}
                                    onMouseMove={handleMouseMove}
                                >
                                    <div className={styles.chatHeader}>
                                        <div className={styles.chatInfo}>
                                            <h3 className={styles.chatTitle}>
                                                {chat.chat_title}
                                                {mode === 'inventory' && (
                                                    <span className={`${styles.statusBadge} ${styles[getInventoryStatus(chat)]}`}>
                                                        {getStatusText(getInventoryStatus(chat))}
                                                    </span>
                                                )}
                                            </h3>
                                        </div>
                                    </div>
                                    
                                    {mode === 'inventory' && (
                                        <div className={styles.progressSection}>
                                            <div className={styles.progressInfo}>
                                                <div className={styles.progressStatus}>
                                                    {getInventoryStatus(chat) === 'completed' ? (
                                                        <CheckCircle className={styles.icon} />
                                                    ) : getInventoryStatus(chat) === 'in-progress' ? (
                                                        <PlayCircle className={styles.icon} />
                                                    ) : (
                                                        <PendingActions className={styles.icon} />
                                                    )}
                                                    <span className={styles.progressText}>
                                                        {chat.metadata?.progress || 0}%
                                                    </span>
                                                </div>
                                                <div className={styles.progressActions}>
                                                    {(chat.metadata?.progress || 0) > 0 && onResetInventory && (
                                                        <button
                                                            className={styles.resetButton}
                                                            onClick={(e) => handleResetInventory(chat.chat_id, e)}
                                                        >
                                                            <Refresh className={styles.icon} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <LinearProgress 
                                                variant="determinate" 
                                                value={chat.metadata?.progress || 0}
                                                className={styles.progress}
                                                classes={{
                                                    bar: styles.progressBar
                                                }}
                                            />
                                        </div>
                                    )}

                                    <div className={styles.chatFooter}>
                                        <div className={styles.lastInventory}>
                                            <AccessTime className={styles.icon} />
                                            <span>
                                                {chat.metadata?.lastUpdated
                                                    ? `Последнее обновление: ${new Date(chat.metadata.lastUpdated).toLocaleString('ru-RU')}`
                                                    : 'Нет данных об обновлениях'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className={styles.buttonsContainer}>
                                <button
                                    className={`${styles.chatSelectorButton} ${styles.homeButton}`}
                                    onClick={handleHomeClick}
                                >
                                    <HomeIcon />
                                </button>

                                <button
                                    className={styles.chatSelectorButton}
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    aria-label="Открыть список чатов"
                                    aria-expanded={isDropdownOpen}
                                    aria-controls="chat-dropdown"
                                >
                                    <div className={styles.chatSelectorIcon}>
                                        <svg 
                                            width="24" 
                                            height="24" 
                                            viewBox="0 0 24 24" 
                                            fill="none" 
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M4 8h16" />
                                            <path d="M4 12h16" />
                                            <path d="M4 16h16" />
                                        </svg>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.chatSelectorContainer} ref={dropdownRef}>
                <div
                    id="chat-dropdown"
                    className={styles.chatDropdown}
                    style={{ display: isDropdownOpen ? 'block' : 'none' }}
                >
                    {chats.map((chat, index) => (
                        <button
                            key={chat.chat_id}
                            className={`${styles.chatOption} ${index === activeIndex ? styles.active : ''}`}
                            onClick={() => setActiveIndex(index)}
                        >
                            <span className={styles.chatTitle}>{chat.chat_title}</span>
                            {mode === 'inventory' && (
                                <span className={`${styles.chatProgress} ${styles[getInventoryStatus(chat)]}`}>
                                    {chat.metadata?.progress || 0}%
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {resetConfirmation && (
                <ConfirmDialog
                    isOpen={true}
                    title="Сброс инвентаризации"
                    message={
                        `⚠️ Внимание! Сброс инвентаризации приведет к следующим последствиям:\n\n` +
                        `• Все введенные количества товаров будут сброшены в 0\n` +
                        `• Все отметки о заполнении будут удалены\n` +
                        `• Прогресс инвентаризации будет сброшен\n` +
                        `• Структура категорий и товаров останется без изменений\n\n` +
                        `Это действие необратимо. Вы уверены, что хотите продолжить?`
                    }
                    onCancel={() => setResetConfirmation(null)}
                    onConfirm={handleResetConfirm}
                    confirmText="Сбросить"
                    type="danger"
                />
            )}

            {showModal && selectedChatLocal && (
                <ChatModal
                    open={showModal}
                    onClose={handleModalClose}
                    chat={selectedChatLocal}
                    onStartAction={handleStartAction}
                    mode={mode}
                />
            )}
        </div>
    );
};

export default ChatSelector; 