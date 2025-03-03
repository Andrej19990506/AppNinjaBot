import React, { useState } from 'react';
import { useAppDispatch } from '../../store/hooks';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContentText from '@mui/material/DialogContentText';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { acceptItemSuggestion, rejectItemSuggestion, Notification } from '../../store/slices/notificationSlice';
import styles from './ItemSuggestionNotification.module.css';

interface ItemSuggestionNotificationProps {
    notification: Notification;
    onClose: () => void;
}

const ItemSuggestionNotification: React.FC<ItemSuggestionNotificationProps> = ({ notification, onClose }) => {
    const dispatch = useAppDispatch();
    const [isAccepting, setIsAccepting] = React.useState(false);
    const [isRejecting, setIsRejecting] = React.useState(false);
    const [confirmReject, setConfirmReject] = useState(false);

    if (!notification.payload) {
        return null;
    }

    const { source, item } = notification.payload;

    // Проверка на наличие необходимых данных
    if (!source || !source.userName || !source.chatTitle || !item || !item.itemId || !item.category) {
        console.error('Ошибка: отсутствуют необходимые данные в уведомлении', {
            notification,
            missing: {
                source: !source,
                userName: source && !source.userName,
                chatTitle: source && !source.chatTitle,
                item: !item,
                itemId: item && !item.itemId,
                category: item && !item.category
            }
        });
        return (
            <Dialog
                open={true}
                onClose={onClose}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>
                    Ошибка отображения уведомления
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Невозможно отобразить предложение товара из-за отсутствия необходимых данных. 
                        Пожалуйста, сообщите администратору о проблеме.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} color="primary">
                        Закрыть
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    const handleAccept = async () => {
        setIsAccepting(true);
        try {
            console.log('🔄 Начинаем процесс принятия предложения товара');
            console.log('📋 Данные уведомления:', notification);
            
            // Используем ID из уведомления или из payload.notificationId
            const notificationId = notification.id || notification.payload?.notificationId;
            
            console.log(`🆔 ID уведомления: ${notificationId}`);
            
            // Добавляем ID уведомления в payload для явного указания, какое уведомление нужно удалить
            const payloadWithId = {
                ...notification.payload,
                notificationId: notificationId
            };
            
            console.log('📤 Отправляем payload с ID:', payloadWithId);
            
            // @ts-ignore - игнорируем ошибку типизации для thunk
            const result = await dispatch(acceptItemSuggestion(payloadWithId));
            console.log('✅ Результат принятия предложения:', result);
            onClose();
        } catch (error) {
            console.error('❌ Ошибка при принятии предложения:', error);
        } finally {
            setIsAccepting(false);
        }
    };

    const handleReject = () => {
        // Показываем диалог подтверждения
        setConfirmReject(true);
    };

    const handleConfirmReject = () => {
        setIsRejecting(true);
        try {
            console.log('🔄 Начинаем процесс отклонения предложения товара');
            console.log('📋 Данные уведомления:', notification);
            
            // Используем ID из уведомления или из payload.notificationId
            const notificationId = notification.id || notification.payload?.notificationId;
            
            console.log(`🆔 ID уведомления для отклонения: ${notificationId}`);
            
            // @ts-ignore - игнорируем ошибку типизации для thunk
            dispatch(rejectItemSuggestion(notificationId));
            setConfirmReject(false);
            onClose();
        } catch (error) {
            console.error('❌ Ошибка при отклонении предложения:', error);
        } finally {
            setIsRejecting(false);
        }
    };

    const handleCancelReject = () => {
        setConfirmReject(false);
    };

    return (
        <>
            <Dialog
                open={!confirmReject}
                onClose={onClose}
                aria-labelledby="item-suggestion-dialog-title"
                aria-describedby="item-suggestion-dialog-description"
                maxWidth="xs"
                fullWidth
                PaperProps={{ className: styles.dialogPaper }}
            >
                <DialogTitle id="item-suggestion-dialog-title" className={styles.dialogTitle}>
                    <NotificationsActiveIcon />
                    Предложение добавить товар
                    <Button 
                        className={styles.closeButton} 
                        onClick={onClose}
                        size="small"
                        aria-label="Закрыть"
                    >
                        <CloseIcon fontSize="small" />
                    </Button>
                </DialogTitle>
                <DialogContent className={styles.dialogContent}>
                    <Typography variant="body1" component="div" className={styles.dialogText}>
                        Пользователь <span className={styles.highlight}>{source.userName}</span> из чата <span className={styles.highlight}>{source.chatTitle}</span> предлагает добавить товар:
                    </Typography>
                    <Paper elevation={0} className={styles.itemBox}>
                        <Typography variant="subtitle1" className={styles.itemName}>
                            {item.itemId}
                        </Typography>
                        <Box className={styles.chipsContainer}>
                            <Chip 
                                icon={<CategoryIcon fontSize="small" />}
                                label={`Категория: ${item.category}`} 
                                size="small" 
                                color="primary" 
                                variant="outlined" 
                            />
                            {item.has_semifinished && (
                                <Chip 
                                    label="С полуфабрикатом" 
                                    size="small" 
                                    color="secondary" 
                                    variant="outlined" 
                                />
                            )}
                        </Box>
                    </Paper>
                </DialogContent>
                <DialogActions className={styles.dialogActions}>
                    <Button 
                        onClick={handleReject} 
                        disabled={isAccepting || isRejecting}
                        className={styles.rejectButton}
                        startIcon={<ScheduleIcon fontSize="small" />}
                    >
                        {isRejecting ? 'Отложение...' : 'Отложить'}
                    </Button>
                    <Button 
                        onClick={handleAccept} 
                        variant="contained" 
                        autoFocus
                        disabled={isAccepting || isRejecting}
                        className={styles.acceptButton}
                        startIcon={<AddCircleOutlineIcon />}
                    >
                        {isAccepting ? 'Добавление...' : 'Добавить товар'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог подтверждения отклонения */}
            <Dialog
                open={confirmReject}
                onClose={handleCancelReject}
                aria-labelledby="reject-confirm-dialog-title"
                maxWidth="xs"
                PaperProps={{ className: styles.confirmDialogPaper }}
            >
                <DialogTitle 
                    id="reject-confirm-dialog-title" 
                    className={styles.confirmDialogTitle}
                >
                    Отложить предложение?
                </DialogTitle>
                <DialogContent className={styles.confirmDialogContent}>
                    <DialogContentText style={{ color: 'inherit' }}>
                        Предложение о добавлении товара "{item.itemId}" не будет удалено, а сохранится в списке уведомлений. Вы сможете добавить товар позже.
                    </DialogContentText>
                </DialogContent>
                <DialogActions className={styles.confirmDialogActions}>
                    <Button 
                        onClick={handleCancelReject} 
                        className={styles.cancelButton}
                    >
                        Отмена
                    </Button>
                    <Button 
                        onClick={handleConfirmReject} 
                        variant="contained"
                        autoFocus
                        className={styles.confirmButton}
                    >
                        Подтвердить
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default ItemSuggestionNotification; 