import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Button from '@mui/material/Button';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import styles from './ItemSuggestionNotification.module.css';
import { useDialogAnimations } from './hooks/useDialogAnimations';

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

interface ItemSuggestionNotificationProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
}

const ItemSuggestionNotification: React.FC<ItemSuggestionNotificationProps> = ({
    open,
    onClose,
    title = 'Уведомление',
    message = '',
    onConfirm,
    confirmText = 'Подтвердить',
    cancelText = 'Отмена'
}) => {
    const {
        dialogRef,
        titleRef,
        contentRef,
        actionsRef,
        animateClose
    } = useDialogAnimations();

    const handleClose = useCallback(async () => {
        await animateClose();
        onClose();
    }, [onClose, animateClose]);

    const handleConfirm = useCallback(async () => {
        await animateClose();
        onConfirm?.();
        onClose();
    }, [onConfirm, onClose, animateClose]);

    return (
        <AnimatePresence mode="wait">
            {open && (
                <Dialog
                    open={open}
                    onClose={handleClose}
                    maxWidth="xs"
                    fullWidth
                    TransitionComponent={Transition}
                    keepMounted={false}
                    disableEscapeKeyDown
                    classes={{
                        paper: styles.dialogPaper,
                        root: styles.dialogRoot
                    }}
                    PaperProps={{
                        elevation: 0,
                        ref: dialogRef
                    }}
                    slotProps={{
                        backdrop: {
                            style: {
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                backdropFilter: 'blur(12px)'
                            }
                        }
                    }}
                >
                    <div ref={titleRef}>
                        <DialogTitle className={styles.dialogTitle}>
                            <motion.div 
                                className={styles.dialogTitleText}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.1 }}
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 260,
                                        damping: 20,
                                        delay: 0.2
                                    }}
                                >
                                    <NotificationsIcon className={styles.titleIcon} />
                                </motion.div>
                                {title}
                            </motion.div>
                            <IconButton
                                className={styles.closeButton}
                                onClick={handleClose}
                                aria-label="close"
                            >
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                    </div>

                    <div ref={contentRef}>
                        <DialogContent className={styles.dialogContent}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ 
                                    duration: 0.4,
                                    delay: 0.3,
                                    ease: [0.4, 0, 0.2, 1]
                                }}
                            >
                                {message}
                            </motion.div>
                        </DialogContent>
                    </div>

                    <div ref={actionsRef}>
                        <DialogActions className={styles.dialogActions}>
                            <motion.div
                                style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end' }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ 
                                    duration: 0.4,
                                    delay: 0.4,
                                    ease: [0.4, 0, 0.2, 1]
                                }}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Button
                                        onClick={handleClose}
                                        className={styles.buttonOutlined}
                                    >
                                        {cancelText}
                                    </Button>
                                </motion.div>
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Button
                                        onClick={handleConfirm}
                                        className={styles.buttonContained}
                                    >
                                        {confirmText}
                                    </Button>
                                </motion.div>
                            </motion.div>
                        </DialogActions>
                    </div>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

export default ItemSuggestionNotification; 