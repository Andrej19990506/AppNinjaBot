import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
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
import SystemNotification from '../../notifications/SystemNotification';
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
const swipeConfidenceThreshold = 10000;
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
    const currentUser = useAppSelector((state: RootState) => state.user);
    const [resetConfirmation, setResetConfirmation] = useState<{ chatId: string; button: HTMLButtonElement } | null>(null);
    const [systemNotification, setSystemNotification] = useState<SystemNotificationType>({ message: '', type: 'success' });
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [direction, setDirection] = useState<'left' | 'right'>('right');
    const [selectedChatLocal, setSelectedChatLocal] = useState<ChatItem | null>(null);
    const [showModal, setShowModal] = useState(false);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const [isNavigating, setIsNavigating] = useState(false);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

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

    const handleChatButtonClick = useCallback((index: number) => {
        setDirection(index > activeIndex ? 'right' : 'left');
        setActiveIndex(index);
        setIsDropdownOpen(false);
    }, [activeIndex]);

    const handleHomeClick = useCallback(() => {
        if (onHomeClick) {
            onHomeClick();
        } else {
            navigate('/');
        }
    }, [onHomeClick, navigate]);

    const variants = useMemo(() => ({
        enter: (direction: 'left' | 'right') => ({
            x: direction === 'right' ? 100 : -100,
            opacity: 0,
            scale: 0.5,
            rotateY: direction === 'right' ? 45 : -45
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            rotateY: 0
        },
        exit: (direction: 'left' | 'right') => ({
            x: direction === 'right' ? -100 : 100,
            opacity: 0,
            scale: 0.5,
            rotateY: direction === 'right' ? -45 : 45
        })
    }), []);

    // Обновляем currentChat только если есть чаты
    const currentChat = useMemo(() => 
        chats.length > 0 ? chats[Math.min(activeIndex, chats.length - 1)] : null, 
    [chats, activeIndex]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            setIsDropdownOpen(false);
        }
    }, []);

    // Обновляем условие загрузки
    return (
        <LazyMotion features={domAnimation}>
            <div className={styles.container}>
                <AnimatePresence mode="sync">
                    {(!currentUser || !chats || chats.length === 0) ? (
                        <motion.div
                            key="skeleton"
                            className={styles.skeletonWrapper}
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <ChatListSkeleton 
                                animation="shimmer"
                                theme="dark"
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="content"
                            className={styles.contentWrapper}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <motion.h1 
                                className={styles.title}
                                initial={{ opacity: 0, y: -50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                            >
                                {title}
                            </motion.h1>

                            {systemNotification.message && (
                                <SystemNotification 
                                    message={systemNotification.message}
                                    type={systemNotification.type}
                                    duration={5000}
                                    onClose={() => setSystemNotification({ message: '', type: 'success' })}
                                />
                            )}

                            <div className={styles.chatList}>
                                <AnimatePresence mode="sync" initial={false} custom={direction}>
                                    {currentChat && (
                                        <motion.div
                                            key={currentChat.chat_id}
                                            ref={el => cardRefs.current[activeIndex] = el}
                                            className={`${styles.chatItem} ${styles[getInventoryStatus(currentChat)]}`}
                                            onClick={() => handleChatClick(currentChat)}
                                            onMouseMove={handleMouseMove}
                                            variants={variants}
                                            custom={direction}
                                            initial="enter"
                                            animate="center"
                                            exit="exit"
                                            transition={{
                                                x: { type: "spring", stiffness: 500, damping: 30 },
                                                opacity: { duration: 0.2 },
                                                rotateY: { duration: 0.4 },
                                                scale: { duration: 0.3 }
                                            }}
                                            drag="x"
                                            dragConstraints={{ left: 0, right: 0 }}
                                            dragElastic={1}
                                            onDragEnd={(e, { offset, velocity }) => {
                                                const swipe = swipePower(offset.x, velocity.x);
                                                if (swipe < -swipeConfidenceThreshold) {
                                                    handleChatButtonClick(Math.min(activeIndex + 1, chats.length - 1));
                                                } else if (swipe > swipeConfidenceThreshold) {
                                                    handleChatButtonClick(Math.max(activeIndex - 1, 0));
                                                }
                                            }}
                                        >
                                            <div className={styles.chatHeader}>
                                                <div className={styles.chatInfo}>
                                                    <h3 className={styles.chatTitle}>
                                                        {currentChat.chat_title}
                                                        {mode === 'inventory' && (
                                                            <span className={`${styles.statusBadge} ${styles[getInventoryStatus(currentChat)]}`}>
                                                                {getStatusText(getInventoryStatus(currentChat))}
                                                            </span>
                                                        )}
                                                    </h3>
                                                </div>
                                            </div>
                                            
                                            {mode === 'inventory' && (
                                                <div className={styles.progressSection}>
                                                    <div className={styles.progressInfo}>
                                                        <div className={styles.progressStatus}>
                                                            {getInventoryStatus(currentChat) === 'completed' ? (
                                                                <CheckCircle className={styles.icon} />
                                                            ) : getInventoryStatus(currentChat) === 'in-progress' ? (
                                                                <PlayCircle className={styles.icon} />
                                                            ) : (
                                                                <PendingActions className={styles.icon} />
                                                            )}
                                                            <span className={styles.progressText}>
                                                                {currentChat.metadata?.progress || 0}%
                                                            </span>
                                                        </div>
                                                        <div className={styles.progressActions}>
                                                            {(currentChat.metadata?.progress || 0) > 0 && onResetInventory && (
                                                                <motion.button
                                                                    className={styles.resetButton}
                                                                    onClick={(e) => handleResetInventory(currentChat.chat_id, e)}
                                                                    whileHover={{ scale: 1.1, rotate: 180 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                >
                                                                    <Refresh className={styles.icon} />
                                                                </motion.button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <LinearProgress 
                                                        variant="determinate" 
                                                        value={currentChat.metadata?.progress || 0}
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
                                                        {currentChat.metadata?.lastUpdated
                                                            ? `Последнее обновление: ${new Date(currentChat.metadata.lastUpdated).toLocaleString('ru-RU')}`
                                                            : 'Нет данных об обновлениях'
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className={styles.buttonsContainer}>
                                    <motion.button
                                        className={`${styles.chatSelectorButton} ${styles.homeButton}`}
                                        onClick={handleHomeClick}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        aria-label="Вернуться на главную"
                                    >
                                        <HomeIcon />
                                    </motion.button>

                                    <motion.button
                                        className={styles.chatSelectorButton}
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        aria-label="Открыть список чатов"
                                        aria-expanded={isDropdownOpen}
                                        aria-controls="chat-dropdown"
                                    >
                                        <motion.div
                                            className={styles.chatSelectorIcon}
                                            animate={{ 
                                                rotate: isDropdownOpen ? 180 : 0,
                                                scale: isDropdownOpen ? 0.9 : 1
                                            }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <motion.svg 
                                                width="24" 
                                                height="24" 
                                                viewBox="0 0 24 24" 
                                                fill="none" 
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <motion.path
                                                    initial={{ d: "M4 8h16" }}
                                                    animate={{
                                                        d: isDropdownOpen ? "M6 18L18 6" : "M4 8h16"
                                                    }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                                <motion.path
                                                    initial={{ d: "M4 12h16", opacity: 1, scale: 1 }}
                                                    animate={{
                                                        opacity: isDropdownOpen ? 0 : 1,
                                                        scale: isDropdownOpen ? 0 : 1
                                                    }}
                                                    transition={{ duration: 0.2 }}
                                                />
                                                <motion.path
                                                    initial={{ d: "M4 16h16" }}
                                                    animate={{
                                                        d: isDropdownOpen ? "M6 6L18 18" : "M4 16h16"
                                                    }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </motion.svg>
                                        </motion.div>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div 
                    className={styles.chatSelectorContainer}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    ref={dropdownRef}
                >
                    <AnimatePresence>
                        {isDropdownOpen && (
                            <motion.div
                                id="chat-dropdown"
                                className={styles.chatDropdown}
                                initial={{ opacity: 0, y: 20, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: 20, height: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                role="menu"
                                aria-orientation="vertical"
                            >
                                {chats.map((chat, index) => (
                                    <motion.button
                                        key={chat.chat_id}
                                        className={`${styles.chatOption} ${index === activeIndex ? styles.active : ''}`}
                                        onClick={() => handleChatButtonClick(index)}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ 
                                            opacity: 1, 
                                            x: 0,
                                            transition: { delay: index * 0.05 }
                                        }}
                                        whileHover={{ scale: 1.02, x: 10 }}
                                        whileTap={{ scale: 0.98 }}
                                        role="menuitem"
                                        aria-current={index === activeIndex}
                                    >
                                        <span className={styles.chatTitle}>{chat.chat_title}</span>
                                        {mode === 'inventory' && (
                                            <span className={`${styles.chatProgress} ${styles[getInventoryStatus(chat)]}`}>
                                                {chat.metadata?.progress || 0}%
                                            </span>
                                        )}
                                    </motion.button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

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
        </LazyMotion>
    );
};

export default ChatSelector; 