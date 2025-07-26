import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Confetti from 'react-confetti';
import styles from './InventoryCompleteDrawer.module.css';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import CancelIcon from '@mui/icons-material/Cancel';
import CircularProgress from '@mui/material/CircularProgress';
import { triggerExcelReportGeneration, resetChatInventory } from '@features/Inventory/services/inventoryApi';
import { useAppDispatch } from '@/shared/store/hooks';
import { addNotification } from '@shared/store/notificationSlice/notificationSlice';
import { NotificationTypes } from '@shared/store/notificationSlice/notificationTypes';
import { receiveItemUpdate } from '@/store/slices/inventorySlice';

interface InventoryItem {
    raw: {
        quantity: number;
        filled: boolean;
        isOutOfStock?: boolean;
    };
    semifinished?: {
        quantity: number;
        filled: boolean;
    } | null;
}

interface InventoryData {
    inventory: {
        [category: string]: {
            [itemId: string]: InventoryItem;
        };
    };
    metadata?: {
        lastUpdated: string;
        progress: number;
        chat_id: string;
    };
}

interface InventoryCompleteDrawerProps {
    inventoryData: InventoryData;
    chatId: string;
    onClose: () => void;
}

export const InventoryCompleteDrawer: React.FC<InventoryCompleteDrawerProps> = ({ 
    inventoryData, 
    chatId,
    onClose
}) => {
    const [isSending, setIsSending] = useState(false);
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const dispatch = useAppDispatch();

    const handleSendReport = async () => {
        if (!chatId) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR, 
                message: 'Не удалось определить ID чата.'
            }));
            return;
        }

        setIsSending(true);
        dispatch(addNotification({
            type: NotificationTypes.INFO,
            message: 'Пожалуйста, подождите, генерируем и отправляем отчет в группу...',
            duration: 4000
        }));

        try {
            const result = await triggerExcelReportGeneration(chatId);

            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Отчет успешно отправлен в группу! Скоро он там появится.'
            }));

        } catch (error: unknown) {
            console.error('Error sending report:', error);
            let errorMessage = 'Не удалось отправить отчет. Пожалуйста, попробуйте еще раз.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: errorMessage
            }));
        } finally {
            setIsSending(false);
        }
    };

    const executeReset = async () => {
        if (!chatId) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR, 
                message: 'Не удалось определить ID чата для сброса.'
            }));
            return;
        }
        
        setIsResetting(true);
        dispatch(addNotification({
            type: NotificationTypes.INFO,
            message: 'Сбрасываем данные инвентаризации...'
        }));

        try {
            await resetChatInventory(chatId);
            dispatch(receiveItemUpdate({
                chatId: chatId,
                type: 'inventory_reset',
                metadata: {
                    progress: 0,
                    lastUpdated: new Date().toISOString(),
                    chat_id: chatId
                }
            }));
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Инвентаризация успешно сброшена!'
            }));
            onClose();
        } catch (error: any) {
            console.error("Ошибка при сбросе инвентаризации:", error);
            dispatch(addNotification({
                type: NotificationTypes.ERROR, 
                message: `Ошибка сброса: ${error.message || 'Неизвестная ошибка'}` 
            }));
        } finally {
            setIsResetting(false);
        }
    };

    const handleStartNewInventory = async () => {
        setIsConfirmingReset(true);
    };

    const handleCancelReset = () => {
        setIsConfirmingReset(false);
    };

    // Получаем размеры окна для конфетти
    const [windowSize, setWindowSize] = React.useState({ width: window.innerWidth, height: window.innerHeight });
    React.useEffect(() => {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className={styles.container}>
            {/* Салют (только если не подтверждение сброса) */}
            {!isConfirmingReset && (
                <Confetti
                    width={windowSize.width}
                    height={windowSize.height}
                    numberOfPieces={180}
                    recycle={false}
                    gravity={0.25}
                    initialVelocityY={12}
                    tweenDuration={5000}
                />
            )}
            {/* Заголовок */}
            <div className={styles.header}>
                <motion.div 
                    className={styles.successIcon}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring" }}
                >
                    <CheckCircleIcon />
                </motion.div>
                <h2 className={styles.title}>
                    Инвентаризация завершена!
                </h2>
            </div>

            {/* Контент */}
            <div className={styles.content}>
                {!isConfirmingReset ? (
                    <>
                        <motion.div 
                            className={styles.messageSection}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <p className={styles.message}>
                                Все товары успешно подсчитаны. Теперь вы можете отправить отчет в группу или начать новую инвентаризацию.
                            </p>
                        </motion.div>

                        <motion.div 
                            className={styles.actionsSection}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <motion.button
                                className={styles.sendButton}
                                onClick={handleSendReport}
                                disabled={isSending}
                                whileHover={{ scale: isSending ? 1 : 1.02 }}
                                whileTap={{ scale: isSending ? 1 : 0.98 }}
                            >
                                <DownloadIcon className={styles.buttonIcon} />
                                {isSending ? 'Отправка...' : 'Отправить отчет в группу'}
                            </motion.button>

                            <motion.button
                                className={styles.newInventoryButton}
                                onClick={handleStartNewInventory}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <ReplayIcon className={styles.buttonIcon} />
                                Начать новую инвентаризацию
                            </motion.button>
                        </motion.div>
                    </>
                ) : (
                    <motion.div 
                        className={styles.confirmationSection}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                        <h4 className={styles.confirmationTitle}>Подтвердите действие</h4>
                        <p className={styles.confirmationText}>
                            Вы уверены, что хотите сбросить текущую инвентаризацию? Все введенные данные (количество, статус 'нет в наличии') будут обнулены. Это действие нельзя отменить.
                        </p>
                        <div className={styles.confirmationButtons}>
                            <motion.button
                                className={`${styles.confirmButton} ${styles.confirmResetButton}`}
                                onClick={executeReset}
                                disabled={isResetting}
                                whileHover={{ scale: isResetting ? 1 : 1.02 }}
                                whileTap={{ scale: isResetting ? 1 : 0.98 }}
                            >
                                {isResetting ? (
                                    <CircularProgress size={20} color="inherit" className={styles.spinner} /> 
                                ) : (
                                    <>
                                        <CheckCircleIcon className={styles.buttonIcon} />
                                        Да, сбросить
                                    </>
                                )}
                            </motion.button>
                            <motion.button
                                className={`${styles.confirmButton} ${styles.cancelResetButton}`}
                                onClick={handleCancelReset}
                                disabled={isResetting}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <CancelIcon className={styles.buttonIcon} />
                                Отмена
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}; 