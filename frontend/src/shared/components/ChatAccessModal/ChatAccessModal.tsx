import React, { useEffect, useState, useRef, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useAppSelector } from '@shared/store/hooks';
import { RootState } from '@shared/store/store';
import AdminProfile from '@shared/components/AdminProfile/AdminProfile';
import { SingleSystemNotification } from '@shared/components/Notifications/SystemNotification';
import styles from '@shared/components/ChatAccessModal/ChatAccessModal.module.css';
import { ChatContext } from '@shared/store/chatSlice/chatTypes';
import { ChatItem } from '@shared/components/ChatSelector/ChatSelector';
import { userPermissionsApi, UserPermissionCheckResponse } from '@shared/api/userPermissionsApi';

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
    
    // Состояние для временного доступа
    const [permissionInfo, setPermissionInfo] = useState<UserPermissionCheckResponse | null>(null);
    const [loadingPermissions, setLoadingPermissions] = useState(false);

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

    // Функция для проверки временного доступа
    const checkUserPermissions = useCallback(async () => {
        if (!currentUser?.user?.id || !chat?.chat_id || !mode) return;
        
        setLoadingPermissions(true);
        try {
            const permissionType = mode === 'inventory' ? 'inventory' : 
                                 mode === 'writeoff' ? 'writeoff' : 'events';
            
            const response = await userPermissionsApi.checkPermission(
                currentUser.user.id,
                parseInt(chat.chat_id),
                permissionType
            );
            
            setPermissionInfo(response);
        } catch (error) {
            console.error('Ошибка проверки временного доступа:', error);
            setPermissionInfo(null);
        } finally {
            setLoadingPermissions(false);
        }
    }, [currentUser?.user?.id, chat?.chat_id, mode]);

    // Проверка временного доступа при открытии модального окна
    useEffect(() => {
        if (open && currentUser?.user?.id && chat?.chat_id) {
            checkUserPermissions();
        }
    }, [open, checkUserPermissions]);

    // Функция для форматирования времени окончания прав
    const formatExpiryTime = useCallback((expiresAt: string) => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry.getTime() - now.getTime();
        
        if (diff <= 0) {
            return "Истекло";
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `${days}д ${hours}ч ${minutes}м`;
        } else if (hours > 0) {
            return `${hours}ч ${minutes}м`;
        } else {
            return `${minutes}м`;
        }
    }, []);

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

    // Проверяем доступ: админ ИЛИ имеет административные права в группе ИЛИ имеет временный доступ
    const hasAccess = currentUser?.user?.isAdmin || 
                     (permissionInfo?.has_permission && permissionInfo?.permission_source === 'administrator') ||
                     (permissionInfo?.has_permission && permissionInfo?.permission_source === 'temporary');

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

                    {!hasAccess ? (
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
                                    
                                    {/* Информация о временном доступе */}
                                    {loadingPermissions && (
                                        <div className={styles.permissionInfo}>
                                            <span className={styles.permissionLoader}>Проверка прав...</span>
                                        </div>
                                    )}
                                    
                                    {permissionInfo && !loadingPermissions && (
                                        <div className={styles.permissionInfo}>
                                            {permissionInfo.is_admin ? (
                                                <div className={styles.adminRights}>
                                                    <span className={styles.adminBadge}>Права Администратора</span>
                                                </div>
                                            ) : permissionInfo.has_permission && permissionInfo.permission_source === 'temporary' ? (
                                                <div className={styles.temporaryRights}>
                                                    <span className={styles.temporaryBadge}>⏰ Временный доступ</span>
                                                    <span className={styles.expiryTime}>
                                                        Истекают: {permissionInfo.expires_at ? formatExpiryTime(permissionInfo.expires_at) : 'Неизвестно'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className={styles.noRights}>
                                                    <span className={styles.noRightsBadge}>❌ Нет прав доступа</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
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

const MemoizedChatModal = React.memo(ChatModal);
export default MemoizedChatModal;