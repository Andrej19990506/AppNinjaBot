import React, { useEffect, useState, useRef, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useAppSelector } from '../../../store/hooks';
import { RootState } from '../../../store/store';
import AdminProfile from '../AdminProfile/AdminProfile';
import { SingleSystemNotification } from '../../notifications/SystemNotification';
import styles from './ChatModal.module.css';
import { ChatContext } from '../../../store/slices/chatSlice';
import { ChatItem } from '../ChatSelector/ChatSelector';

export interface ChatModalProps {
    chat?: ChatItem | null;
    open: boolean;
    onClose: () => void;
    onStartAction: () => Promise<void>;
    mode?: ChatContext;
    title?: string;
    actionButtonText?: string;
}

const ChatModal = forwardRef<HTMLDivElement, ChatModalProps>(({
    chat,
    open,
    onClose,
    onStartAction,
    mode = 'inventory',
    title,
    actionButtonText
}, ref) => {
    const currentUser = useAppSelector((state: RootState) => state.user);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
    const [isLoading, setIsLoading] = useState(false);
    const isClosing = useRef(false);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        
        if (open) {
            console.log('ChatModal: Modal opened');
            document.body.style.overflow = 'hidden';
            isClosing.current = false;
            setIsLoading(false);
            setShowNotification(false);
        } else {
            console.log('ChatModal: Modal closing');
            // Добавляем задержку перед сбросом состояния при закрытии
            timeoutId = setTimeout(() => {
                setIsLoading(false);
                setShowNotification(false);
                document.body.style.overflow = 'unset';
            }, 300);
        }
        
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            document.body.style.overflow = 'unset';
            console.log('ChatModal: Cleanup effect');
        };
    }, [open]);

    const handleClose = useCallback(() => {
        console.log('ChatModal: handleClose called, isLoading:', isLoading);
        if (!isLoading) {
            isClosing.current = true;
            setShowNotification(false);
            onClose();
        } else {
            console.log('ChatModal: Close prevented - action in progress');
        }
    }, [isLoading, onClose]);

    const handleActionClick = useCallback(async () => {
        console.log('ChatModal: handleActionClick called, isLoading:', isLoading);
        if (isLoading) {
            console.log('ChatModal: Action prevented - already loading');
            return;
        }
        
        try {
            console.log('ChatModal: Setting isLoading to true');
            setIsLoading(true);
            console.log('ChatModal: Calling onStartAction');
            
            // Добавляем небольшую задержку перед выполнением действия
            await new Promise(resolve => setTimeout(resolve, 100));
            
            await onStartAction();
            console.log('ChatModal: onStartAction completed successfully');
            
            // Добавляем небольшую задержку после выполнения действия
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('ChatModal: Error during action:', error);
            setNotificationMessage('Произошла ошибка при запуске действия');
            setNotificationType('error');
            setShowNotification(true);
            throw error;
        } finally {
            console.log('ChatModal: Resetting loading state');
            setIsLoading(false);
        }
    }, [isLoading, onStartAction]);

    const getNoAccessMessage = () => {
        return `У вас нет прав для ${mode === 'inventory' ? 'инвентаризации' : mode === 'writeoff' ? 'списания' : 'просмотра событий'} в этом чате`;
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!currentUser || !chat || !open) return null;

    const dialogContent = (
        <LazyMotion features={domAnimation}>
            <motion.div 
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={handleOverlayClick}
            >
                <motion.div 
                    className={styles.dialog}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className={styles.header}>
                        <h2>{chat.chat_title}</h2>
                    </div>

                    {!currentUser?.user?.isAdmin ? (
                        <motion.div className={styles.fadeIn}>
                            <div className={styles.noAccessMessage}>
                                <svg 
                                    className={styles.lockIcon}
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path d="M12 1C8.676 1 6 3.676 6 7v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
                                </svg>
                                {getNoAccessMessage()}
                            </div>
                            <div className={styles.adminHint}>
                                Для получения доступа обратитесь к одному из активных администраторов:
                            </div>
                            <div className={styles.adminList}>
                                <div>
                                    {/* @ts-ignore: Ignoring type errors with AnimatePresence */}
                                    <AnimatePresence mode="sync">
                                        {chat.admins.length > 0 && (
                                            <React.Fragment key="admin-list">
                                                {chat.admins.map((admin, index) => (
                                                    <motion.div
                                                        key={admin.user_id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -20 }}
                                                        transition={{ 
                                                            duration: 0.3,
                                                            delay: index * 0.1
                                                        }}
                                                    >
                                                        <AdminProfile admin={admin} />
                                                    </motion.div>
                                                ))}
                                            </React.Fragment>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                            <motion.button 
                                className={styles.mainMenuButton}
                                onClick={handleClose}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Закрыть
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.div className={styles.fadeIn}>
                            <div className={styles.welcomeContainer}>
                                <div className={styles.adminPhotoContainer}>
                                    <img
                                        src={currentUser?.user?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.user?.first_name || 'A')}&background=FF5F1F&color=fff&size=200&bold=true&font-size=0.5`}
                                        alt={currentUser?.user?.first_name || 'Администратор'}
                                    />
                                </div>
                                <div className={styles.welcomeMessage}>
                                    <h3>Добро пожаловать!</h3>
                                    <p>
                                        {`Вы можете начать ${mode === 'inventory' ? 'инвентаризацию' : mode === 'writeoff' ? 'списание' : 'просмотр событий'}`}
                                    </p>
                                </div>
                            </div>
                            <motion.button 
                                className={`${styles.actionButton} ${isLoading ? styles.loading : ''}`}
                                onClick={handleActionClick}
                                whileHover={!isLoading ? { scale: 1.02 } : {}}
                                whileTap={!isLoading ? { scale: 0.98 } : {}}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Загрузка...' : (
                                    actionButtonText || (
                                        mode === 'inventory' ? 'Приступить к инвентаризации' : 
                                        mode === 'writeoff' ? 'Приступить к списанию' : 
                                        'Просмотреть события'
                                    )
                                )}
                            </motion.button>
                        </motion.div>
                    )}
                </motion.div>
            </motion.div>

            {/* @ts-ignore: Ignoring type errors with AnimatePresence */}
            <AnimatePresence>
                {showNotification && (
                    <SingleSystemNotification
                        message={notificationMessage}
                        type={notificationType}
                        onClose={() => setShowNotification(false)}
                    />
                )}
            </AnimatePresence>
        </LazyMotion>
    );

    return createPortal(dialogContent, document.body);
});

// Wrap ChatModal with React.memo
const MemoizedChatModal = React.memo(ChatModal);
export default MemoizedChatModal; 