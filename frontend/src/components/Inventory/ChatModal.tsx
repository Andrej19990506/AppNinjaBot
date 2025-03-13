import React, { useEffect, useState, useRef, forwardRef } from 'react';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { createPortal } from 'react-dom';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import { ChatInventory } from '../../types/inventory';
import { useAppSelector } from '../../store/hooks';
import AdminProfile from './AdminProfile';
import styles from './ChatModal.module.css';
import Modal from '@mui/material/Modal';
import SystemNotification from '../notifications/SystemNotification';

interface AdminRights {
    status: string;
    can_manage_chat?: boolean;
}

interface User {
    id: number | null;
    isAdmin: boolean;
    adminRights: AdminRights | null;
    photo_url?: string;
    first_name?: string;
}

interface ChatModalProps {
    chat?: ChatInventory;
    open: boolean;
    onClose: () => void;
    onStartInventory: () => void;
    isAdmin: boolean;
    wasKickedFromInventory?: boolean;
    mode?: 'inventory' | 'write-off';
}

const ChatModal = forwardRef<HTMLDivElement, ChatModalProps>(({
    chat,
    open,
    onClose,
    onStartInventory,
    isAdmin,
    wasKickedFromInventory = false,
    mode = 'inventory'
}, ref) => {
    // Проверка на null для chat
    if (!chat) {
        return null;
    }

    console.log('=== 🔍 ChatModal Props ===', {
        chatTitle: chat.chat_title,
        isAdmin,
        mode,
        admins: chat.admins
    });

    const { currentUser } = useAppSelector(state => state.inventory) as { currentUser: User };
    const [prevIsAdmin, setPrevIsAdmin] = useState<boolean | undefined>(undefined);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
    const isClosing = useRef(false);
    
    const isCreator = currentUser.adminRights && currentUser.adminRights.status === 'creator';
    const canManageInventory = currentUser.adminRights && (
        isCreator || currentUser.adminRights.can_manage_chat
    );
    
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            isClosing.current = false;
            if (prevIsAdmin === undefined) {
                setPrevIsAdmin(isAdmin);
            }

            if (wasKickedFromInventory) {
                setNotificationMessage("У вас забрали права администратора во время инвентаризации. Вы больше не можете проводить инвентаризацию в этом чате");
                setNotificationType('error');
                setShowNotification(true);
            }
        }
        return () => {
            document.body.style.overflow = 'unset';
            setPrevIsAdmin(undefined);
        };
    }, [open, isAdmin, wasKickedFromInventory]);

    // Отслеживаем изменение прав администратора
    useEffect(() => {
        if (!open || isClosing.current) return;

        // Показываем уведомление только если:
        // 1. Есть предыдущее значение прав
        // 2. Права изменились или пользователь был выкинут
        if (prevIsAdmin !== undefined && (isAdmin !== prevIsAdmin || wasKickedFromInventory)) {
            let message = '';
            let type: 'success' | 'error' = 'success';

            if (wasKickedFromInventory) {
                message = "У вас забрали права администратора во время инвентаризации. Вы больше не можете проводить инвентаризацию в этом чате";
                type = 'error';
            } else if (isAdmin && !prevIsAdmin) {
                message = "Вам были выданы права администратора в этом чате";
                type = 'success';
            } else if (!isAdmin && prevIsAdmin) {
                message = "Вы больше не являетесь администратором в этом чате";
                type = 'error';
            }

            if (message) {
                setNotificationMessage(message);
                setNotificationType(type);
                setShowNotification(true);
            }
        }

        // Обновляем prevIsAdmin только если окно не закрывается
        setPrevIsAdmin(isAdmin);
    }, [isAdmin, prevIsAdmin, open, wasKickedFromInventory]);

    const handleClose = () => {
        isClosing.current = true;
        setShowNotification(false);
        onClose();
    };

    const getNoAccessMessage = () => {
        if (wasKickedFromInventory) {
            return mode === 'inventory' 
                ? "У вас забрали права администратора. Вы больше не можете проводить инвентаризацию в этом чате"
                : "У вас забрали права администратора. Вы больше не можете проводить списание в этом чате";
        }
        return mode === 'inventory'
            ? "У вас нет прав для проведения инвентаризации в этом чате"
            : "У вас нет прав для проведения списания в этом чате";
    };

    if (!chat || !open) return null;

    const getFallbackPhotoUrl = (admin: any) => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.first_name)}&background=FF5F1F&color=fff&size=200&bold=true&font-size=0.5`;
    };

    const handleAdminClick = (admin: any) => {
        try {
            if (admin.username && window.Telegram?.WebApp) {
                window.Telegram.WebApp.openLink(`https://t.me/${admin.username}`);
            } else if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Невозможно открыть чат',
                    message: `К сожалению, администратор ${admin.first_name} скрыл свои контактные данные.`,
                    buttons: [{
                        type: 'close',
                        text: 'Понятно'
                    }]
                });
            }
        } catch (error) {
            console.error('Error opening chat:', error);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

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

                    {!isAdmin ? (
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
                                                        <AdminProfile 
                                                            admin={{
                                                                user_id: admin.user_id,
                                                                first_name: admin.first_name,
                                                                last_name: admin.last_name || undefined,
                                                                username: admin.username || undefined,
                                                                photo_url: admin.photo_url
                                                            }} 
                                                        />
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
                                        src={currentUser.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.first_name || 'A')}&background=FF5F1F&color=fff&size=200&bold=true&font-size=0.5`}
                                        alt={currentUser.first_name || 'Администратор'}
                                    />
                                </div>
                                <div className={styles.welcomeMessage}>
                                    <h3>Добро пожаловать!</h3>
                                    <p>
                                        {mode === 'inventory' 
                                            ? 'Вы можете начать инвентаризацию'
                                            : 'Вы можете начать списание'
                                        }
                                    </p>
                                </div>
                            </div>
                            {onStartInventory && (
                                <motion.button 
                                    className={styles.inventoryButton}
                                    onClick={onStartInventory}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {mode === 'inventory' 
                                        ? 'Приступить к инвентаризации'
                                        : 'Приступить к списанию'
                                    }
                                </motion.button>
                            )}
                        </motion.div>
                    )}
                </motion.div>
            </motion.div>

            <AnimatePresence>
                {showNotification && (
                    <SystemNotification
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

export default ChatModal; 