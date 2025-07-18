import React, { useEffect, useRef, useState, useCallback } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircle from '@mui/icons-material/CheckCircle';
import PlayCircle from '@mui/icons-material/PlayCircle';
import PendingActions from '@mui/icons-material/PendingActions';
import Refresh from '@mui/icons-material/Refresh';
import AccessTime from '@mui/icons-material/AccessTime';
import HomeIcon from '@mui/icons-material/Home';
import People from '@mui/icons-material/People';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import styles from './ChatSelector.module.css';
import { ChatListSkeleton } from '@shared/components/Skeleton/Skeleton';
import ConfirmDialog from '@features/Inventory/ConfirmDialog';
import { SingleSystemNotification } from '@shared/components/Notifications/SystemNotification';
import { checkAdminRights } from '@shared/store/userSlice/userThunks';
import { RootState } from '@shared/store/store';
import ChatModal from '@shared/components/ChatAccessModal/ChatAccessModal';
import { setSelectedChat, setContext } from '@shared/store/chatSlice/chatSlice';
import { selectWriteOffChat } from '@features/WriteOff/store/writeOffThunks';
import { resetWriteOffState } from '@features/WriteOff/store/writeOffSlice';
import { Admin } from '@/types/inventoryTypes';
import { ChatContext } from '@/shared/store/chatSlice/chatTypes';
import { MembersModal } from '@shared/components/MembersModal/MembersModal';
import { userPermissionsApi } from '@shared/api/userPermissionsApi';


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
    onChatSelect?: (chatIds: string[]) => void;
    onResetInventory?: (chatId: string) => Promise<void>;
    mode: ChatContext;
    title?: string;
    onHomeClick?: () => void;
    selectedChats?: string[];
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
    onHomeClick,
    selectedChats = []
}) => {
    const dispatch = useAppDispatch();
    const currentUser = useAppSelector((state: RootState) => state.user.user);
    const selectedDate = useAppSelector((state: RootState) => state.writeOff.selectedDate);
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
    const [error, setError] = useState<string | null>(null);
    const cardsContainerRef = useRef<HTMLDivElement>(null);
    const isProcessingClickRef = useRef(false);
    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [selectedChatForMembers, setSelectedChatForMembers] = useState<ChatItem | null>(null);

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

    const handleHomeClick = useCallback(() => {
        // Очищаем состояние списаний при переходе на главную
        dispatch(resetWriteOffState());
        
        if (onHomeClick) {
            onHomeClick();
        } else {
            navigate('/');
        }
    }, [onHomeClick, navigate, dispatch]);

            // Функция для проверки временного доступа
    const checkTemporaryPermissions = useCallback(async (userId: number, chatId: string, mode: ChatContext): Promise<boolean> => {
        try {
            const permissionType = mode === 'inventory' ? 'inventory' : 
                                 mode === 'writeoff' ? 'writeoff' : 'events';
            
            const response = await userPermissionsApi.checkPermission(
                userId,
                parseInt(chatId),
                permissionType
            );
            
                            console.log(`ChatSelector: Временный доступ для пользователя ${userId} в чате ${chatId} (${permissionType}):`, response);
            
            return response.has_permission;
        } catch (error) {
                            console.log(`ChatSelector: Ошибка проверки временного доступа:`, error);
            return false;
        }
    }, []);

    const handleChatClick = useCallback(async (chat: ChatItem) => {
        // 1. Prevent double clicks
        if (isProcessingClickRef.current) {
            console.warn('ChatSelector: handleChatClick - prevented double execution via ref');
            return;
        }
        isProcessingClickRef.current = true;

        // 2. Check user ID
        if (!currentUser?.id) {
            console.error('ChatSelector: User ID not found.');
            setSystemNotification({
                message: 'Ошибка: ID пользователя не найден',
                type: 'error'
            });
            isProcessingClickRef.current = false; // Reset flag
            return;
        }

        try {
            console.log(`ChatSelector: handleChatClick - Processing chat ${chat.chat_id}, user ${currentUser.id}, mode ${mode}`);

            // --- ИЗМЕНЕНИЕ: Пропускаем проверку прав для режима 'events' ---
            if (mode !== 'events') {
                console.log(`ChatSelector: Mode is '${mode}', checking permissions...`);
                
                // Сначала проверяем временный доступ
                const hasTemporaryPermissions = await checkTemporaryPermissions(currentUser.id, chat.chat_id, mode);
                
                if (hasTemporaryPermissions) {
                    console.log(`ChatSelector: Временный доступ найден для пользователя ${currentUser.id} в чате ${chat.chat_id}`);
                } else {
                                          console.log(`ChatSelector: Временного доступа нет, проверяем права администратора...`);
                                          // Если временного доступа нет, проверяем права администратора
                    await dispatch(checkAdminRights({
                        userId: currentUser.id,
                        chatId: chat.chat_id,
                        admins: chat.admins,
                        context: mode
                    })).unwrap();
                    console.log(`ChatSelector: Admin rights OK for chat ${chat.chat_id}`);
                }

                // 4. If rights OK, set state to show modal (for inventory/writeoff)
                setSelectedChatLocal(chat);
                setShowModal(true);
                console.log(`ChatSelector: Modal will be shown for chat ${chat.chat_id}`);
            
            } else {
                // 3b. Mode is 'events', skip admin check and call onChatSelect directly
                console.log(`ChatSelector: Mode is 'events', skipping admin check. Calling onChatSelect...`);
                if (onChatSelect) {
                    // Используем пропс selectedChats вместо несуществующего selectedChatsInternal
                    const isSelected = selectedChats.includes(chat.chat_id); 
                    // Формируем новый массив ID на основе пропса selectedChats
                    const newSelectedChats = isSelected
                        ? selectedChats.filter((id: string) => id !== chat.chat_id) // Добавляем тип для id
                        : [...selectedChats, chat.chat_id];
                    
                    // Вызываем onChatSelect с новым массивом, вместо setSelectedChatsInternal
                    onChatSelect(newSelectedChats); 
                    console.log(`ChatSelector: onChatSelect called with IDs: ${newSelectedChats.join(', ')}`);
                } else {
                    console.warn('ChatSelector: Mode is \'events\' but onChatSelect prop is missing.');
                }
            }

        } catch (error: any) {
            // 5. Handle rights error or other errors (only relevant if admin check was performed)
            if (mode !== 'events') { // Only show error if it came from admin check
                console.error('ChatSelector: Admin rights check failed or other error:', error);
                setSystemNotification({
                    message: typeof error === 'string' ? error : error?.message || 'Ошибка при проверке прав или другое действие',
                    type: 'error'
                });
            }
            // Optionally set component-level error state if needed
            // setError('Failed to process chat selection.');
        } finally {
            // 6. Reset processing flag
            isProcessingClickRef.current = false;
            console.log('ChatSelector: handleChatClick finished processing.');
        }
    }, [
        // Dependencies for the logic above
        currentUser?.id,
        dispatch,
        mode,
        setSystemNotification,
        onChatSelect, // Added dependency
        selectedChats, // Added dependency
        // setError, // Only if using component-level error state
        setSelectedChatLocal,
        setShowModal,
        checkTemporaryPermissions // Added dependency
    ]);

    const handleStartAction = useCallback(async () => {
        if (!selectedChatLocal || isNavigating) {
            console.warn(`ChatSelector: handleStartAction called but no selected chat or already navigating. Selected: ${selectedChatLocal?.chat_id}, Navigating: ${isNavigating}`);
            return;
        }

        setIsNavigating(true);
        setShowModal(false); // Close modal immediately
        console.log(`ChatSelector: handleStartAction for ${selectedChatLocal.chat_id}. Modal closed, navigating...`);

        try {
            // 1. Dispatch Redux actions
            dispatch(setContext(mode));
            if (mode === 'writeoff') {
                // Для writeoff используем специальный thunk с текущей датой
                console.log(`ChatSelector: Calling selectWriteOffChat with date: ${selectedDate}`);
                await dispatch(selectWriteOffChat({ 
                    chatId: selectedChatLocal.chat_id, 
                    date: selectedDate 
                })).unwrap();
                console.log(`ChatSelector: WriteOff chat selected for ${selectedChatLocal.chat_id}`);
            } else {
                // Для inventory используем обычный setSelectedChat
                dispatch(setSelectedChat(selectedChatLocal.chat_id));
                console.log(`ChatSelector: Redux context/chat set for ${selectedChatLocal.chat_id}`);
            }

            // 2. Navigate
            let targetUrl;
            if (mode === 'writeoff') {
                targetUrl = '/chef/write-off';
            } else {
                targetUrl = `/inventory/${selectedChatLocal.chat_id}`;
            }
            const currentUrl = window.location.pathname;
            if (currentUrl === targetUrl) {
                console.log('ChatSelector: Already on target page, updating state without reload');
                // Не делаем reload, просто завершаем функцию - Redux состояние уже обновлено
                return;
            }
            navigate(targetUrl, { replace: true });
            console.log(`ChatSelector: Navigation to ${targetUrl} completed`);

        } catch (error) {
            console.error('ChatSelector: Error during navigation/redux dispatch:', error);
            setError('Произошла ошибка при переходе к инвентаризации');
        } finally {
            // Reset navigation state and selected chat
            setIsNavigating(false);
            setSelectedChatLocal(null);
            console.log('ChatSelector: Navigation state reset');
        }
    }, [
        selectedChatLocal,
        isNavigating,
        navigate,
        dispatch,
        mode,
        setIsNavigating,
        setShowModal,
        setError, // setError is used in catch block
        setSelectedChatLocal
    ]);

    const handleModalClose = useCallback(() => {
        console.log('ChatSelector: handleModalClose called, isNavigating:', isNavigating);
        if (!isNavigating) { 
            setShowModal(false);
            setSelectedChatLocal(null);
            console.log('ChatSelector: handleModalClose - selected chat reset');
        }
    }, [isNavigating, setShowModal, setSelectedChatLocal]);

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
                                                {mode === 'inventory' && chat.metadata?.progress !== undefined && chat.metadata.progress > 0 && (
                                                    <span className={`${styles.statusBadge} ${styles[getInventoryStatus(chat)]}`}>
                                                        {getStatusText(getInventoryStatus(chat))}
                                                    </span>
                                                )}
                                            </h3>
                                        </div>
                                        <div className={styles.chatActions}>
                                            {/* Иконка участников */}
                                            <button
                                                className={styles.membersButton}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedChatForMembers(chat);
                                                    setMembersModalOpen(true);
                                                }}
                                                title={`Участники (${(chat.members?.length || 0) + (chat.admins?.length || 0)})`}
                                            >
                                                <People className={styles.icon} />
                                                <span className={styles.membersCount}>
                                                    {(chat.members?.length || 0) + (chat.admins?.length || 0)}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {mode === 'inventory' && chat.metadata?.progress !== undefined && (
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
                                                        {chat.metadata.progress}%
                                                    </span>
                                                </div>
                                                <div className={styles.progressActions}>
                                                    {(chat.metadata.progress || 0) > 0 && onResetInventory && (
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
                                                value={chat.metadata.progress || 0}
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

            {showModal && (
                <ChatModal
                    open={showModal}
                    onClose={handleModalClose}
                    chat={selectedChatLocal}
                    onStartAction={handleStartAction}
                    mode={mode}
                />
            )}

            {membersModalOpen && selectedChatForMembers && (
                <MembersModal
                    isOpen={membersModalOpen}
                    onClose={() => {
                        setMembersModalOpen(false);
                        setSelectedChatForMembers(null);
                    }}
                    chatId={selectedChatForMembers.chat_id}
                    chatTitle={selectedChatForMembers.chat_title}
                    admins={selectedChatForMembers.admins}
                    members={selectedChatForMembers.members}
                    currentUserId={currentUser?.id}
                    onGrantPermission={async (userId, permission, duration) => {
                        console.log('Открыть доступ:', { userId, permission, duration });
                        if (!currentUser) {
                            console.error('❌ Пользователь не авторизован');
                            return;
                        }
                        try {
                            await userPermissionsApi.grantPermission(
                                {
                                    user_id: userId,
                                    group_id: parseInt(selectedChatForMembers.chat_id),
                                    permission_type: permission,
                                    duration_hours: duration
                                },
                                currentUser!.id
                            );
                            console.log('✅ Доступ успешно открыт');
                            // TODO: Добавить уведомление пользователю
                        } catch (error) {
                            console.error('❌ Ошибка при выдаче прав:', error);
                            // TODO: Добавить уведомление об ошибке
                        }
                    }}
                    onRevokePermission={async (userId, permission) => {
                        console.log('Отозвать доступ:', { userId, permission });
                        if (!currentUser) {
                            console.error('❌ Пользователь не авторизован');
                            return;
                        }
                        try {
                            await userPermissionsApi.revokePermission(
                                {
                                    user_id: userId,
                                    group_id: parseInt(selectedChatForMembers.chat_id),
                                    permission_type: permission
                                },
                                currentUser!.id
                            );
                            console.log('✅ Доступ успешно отозван');
                            // TODO: Добавить уведомление пользователю
                        } catch (error) {
                            console.error('❌ Ошибка при отзыве прав:', error);
                            // TODO: Добавить уведомление об ошибке
                        }
                    }}
                    onInviteUser={() => {
                        console.log('Fallback для регистрации пользователя');
                        // Основная логика регистрации через Telegram Web App API теперь в MembersModal
                    }}
                />
            )}
        </div>
    );
};

export default ChatSelector; 