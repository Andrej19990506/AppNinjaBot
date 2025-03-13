import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { ChatInventory } from '../../types/inventory';
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircle from '@mui/icons-material/CheckCircle';
import PlayCircle from '@mui/icons-material/PlayCircle';
import PendingActions from '@mui/icons-material/PendingActions';
import Refresh from '@mui/icons-material/Refresh';
import AccessTime from '@mui/icons-material/AccessTime';
import HomeIcon from '@mui/icons-material/Home';
import ChatModal from './ChatModal';
import ConfirmDialog from './ConfirmDialog';
import SystemNotification from '../notifications/SystemNotification';
import Skeleton from '../common/Skeleton';
import skeletonStyles from '../common/Skeleton.module.css';
import styles from './ChatList.module.css';
import config from '../../config';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchInventory } from '../../store/slices/inventorySlice';

interface ChatListProps {
    chats: ChatInventory[];
    onChatSelect: (chatId: string, chat: ChatInventory) => void;
    onResetInventory?: (chatId: string) => Promise<void>;
    mode: 'inventory' | 'write-off';
    title?: string;
    currentUser: {
        id: number | null;
        isAdmin: boolean;
        adminRights: any | null;
        photo_url: string | null;
        first_name: string | null;
    };
}

interface SystemNotificationType {
    message: string;
    type: 'success' | 'error';
}

// Константы для свайпа
const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
};

const ChatList: React.FC<ChatListProps> = ({ 
    chats, 
    onChatSelect, 
    onResetInventory,
    mode = 'inventory',
    title = mode === 'inventory' ? 'Выберите чат для инвентаризации' : 'Выберите чат для списания',
    currentUser
}) => {
    const { currentUser: appCurrentUser } = useAppSelector(state => state.inventory);
    const [resetConfirmation, setResetConfirmation] = useState<{ chatId: string; button: HTMLButtonElement } | null>(null);
    const [systemNotification, setSystemNotification] = useState<SystemNotificationType>({ message: '', type: 'success' });
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [direction, setDirection] = useState<'left' | 'right'>('right');
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const location = useLocation();

    // Определяем, находимся ли мы на странице инвентаризации
    const isInventoryPage = location.pathname === '/inventory';

    useEffect(() => {
        const shouldFetch = !chats || chats.length === 0;
        if (shouldFetch) {
            dispatch(fetchInventory())
                .then(() => {
                    setSystemNotification({
                        message: 'Данные успешно загружены',
                        type: 'success'
                    });
                })
                .catch(() => {
                    setSystemNotification({
                        message: 'Ошибка при загрузке данных',
                        type: 'error'
                    });
                });
        }
    }, [dispatch, chats]);

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

    const getInventoryStatus = useCallback((chat: ChatInventory): 'completed' | 'in-progress' | 'not-started' => {
        const progress = chat.metadata?.progress || 0;
        if (progress === 100) return 'completed';
        if (progress > 0) return 'in-progress';
        return 'not-started';
    }, []);

    const getStatusText = useCallback((status: 'completed' | 'in-progress' | 'not-started'): string => {
        if (mode === 'write-off') {
            return ''; // В режиме списания не показываем статус
        }
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
        if (!chat) return;

        if (!appCurrentUser.isAdmin) {
            setResetConfirmation({
                chatId,
                button: event.currentTarget
            });
        }
    }, [chats, appCurrentUser.isAdmin, onResetInventory]);

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

    const handleChatClick = useCallback((chat: ChatInventory) => {
        onChatSelect(chat.chat_id, chat);
    }, [onChatSelect]);

    const handleChatButtonClick = useCallback((index: number) => {
        setDirection(index > activeIndex ? 'right' : 'left');
        setActiveIndex(index);
        setIsDropdownOpen(false);
    }, [activeIndex]);

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

    const currentChat = useMemo(() => chats[activeIndex], [chats, activeIndex]);

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

    const handleHomeClick = () => {
        navigate('/');
    };

    if (!currentChat) {
        return (
            <div className={styles.container}>
                <motion.h1 
                    className={styles.title}
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                >
                    Загрузка чатов...
                </motion.h1>
                <div className={styles.chatList}>
                    {[1, 2, 3].map((index) => (
                        <Skeleton 
                            key={index}
                            className={`${skeletonStyles.flex} ${skeletonStyles.p16} ${skeletonStyles.rounded} ${skeletonStyles.glassBg} ${skeletonStyles.mb16}`}
                            animation="wave"
                        >
                            <div className={`${skeletonStyles.flex} ${skeletonStyles.gap12} ${skeletonStyles.mb16}`}>
                                <Skeleton variant="circular" width={40} height={40} />
                                <div className={`${skeletonStyles.flex} ${skeletonStyles.flexColumn} ${skeletonStyles.gap8}`}>
                                    <Skeleton variant="rectangular" width={200} height={24} />
                                    <Skeleton variant="rectangular" width={120} height={16} />
                                </div>
                            </div>
                            <Skeleton variant="rectangular" height={8} className={skeletonStyles.w100} />
                        </Skeleton>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <LazyMotion features={domAnimation}>
                <motion.h1 
                    className={styles.title}
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                >
                    {title}
                </motion.h1>

                <SystemNotification 
                    message={systemNotification.message}
                    type={systemNotification.type}
                />

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
                                            <span className={`${styles.statusBadge} ${styles[getInventoryStatus(currentChat)]}`}>
                                                {getStatusText(getInventoryStatus(currentChat))}
                                            </span>
                                        </h3>
                                    </div>
                                </div>
                                
                                <div className={styles.progressSection}>
                                    {mode === 'inventory' && (
                                        <>
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
                                        </>
                                    )}
                                </div>

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

                        <motion.button
                            className={`${styles.chatSelectorButton} ${styles.homeButton}`}
                            onClick={handleHomeClick}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            aria-label="Вернуться на главную"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <HomeIcon />
                        </motion.button>
                    </div>
                </div>

                <motion.div 
                    className={styles.chatSelectorContainer}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    ref={dropdownRef}
                    onKeyDown={handleKeyDown}
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
                                        <span className={`${styles.chatProgress} ${styles[getInventoryStatus(chat)]}`}>
                                            {chat.metadata?.progress || 0}%
                                        </span>
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
            </LazyMotion>
        </div>
    );
};

export default ChatList;