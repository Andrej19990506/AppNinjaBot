import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircularProgress from '@mui/material/CircularProgress';
import SendIcon from '@mui/icons-material/Send';
import DescriptionIcon from '@mui/icons-material/Description';
import styles from './DocGenerationModal.module.css';
import { WriteOffApi } from './services/writeOffApi';

interface DocGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
}

const DocGenerationModal: React.FC<DocGenerationModalProps> = ({
    isOpen,
    onClose,
    groupId
}) => {
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setIsSending(false);
            setSendSuccess(false);
            setSendError(null);
        }
    }, [isOpen]);

    const handleSendToChat = async () => {
        setIsSending(true);
        setSendSuccess(false);
        setSendError(null);
        try {
            await WriteOffApi.sendWriteOffReport(groupId);
            setSendSuccess(true);
        } catch (e: any) {
            setSendError(e.message || 'Не удалось отправить документ');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onClose={isSending ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            className={styles.dialog}
            PaperProps={{
                className: styles.dialogPaper
            }}
        >
            <DialogTitle className={styles.dialogTitle}>
                {isSending ? 'Отправка документа...' : sendSuccess ? 'Документ отправлен' : 'Отправить акт списания в чат'}
                <IconButton 
                    aria-label="close" 
                    onClick={onClose}
                    disabled={isSending}
                    className={styles.closeButton}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent className={styles.dialogContent}>
                <AnimatePresence mode="wait">
                    {isSending ? (
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={styles.loadingContainer}
                        >
                            <CircularProgress color="primary" size={60} />
                            <p className={styles.loadingText}>Документ отправляется в чат...</p>
                        </motion.div>
                    ) : sendSuccess ? (
                        <motion.div 
                            key="success"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={styles.successContainer}
                        >
                            <motion.div 
                                className={styles.successIconContainer}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <CheckCircleIcon className={styles.successIcon} />
                            </motion.div>
                            <motion.h3
                                className={styles.successTitle}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                Документ успешно отправлен в чат
                            </motion.h3>
                            <motion.p
                                className={styles.successMessage}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                Вы можете закрыть это окно.
                            </motion.p>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="ready"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={styles.successContainer}
                        >
                            <motion.div 
                                className={styles.successIconContainer}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <DescriptionIcon fontSize="large" />
                            </motion.div>
                            <motion.h3
                                className={styles.successTitle}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                Сформировать акт списания и отправить в чат
                            </motion.h3>
                            <motion.p
                                className={styles.successMessage}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                Нажмите кнопку ниже, чтобы отправить документ в Telegram-группу.
                            </motion.p>
                            {sendError && (
                                <motion.p className={styles.errorMessage} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    {sendError}
                                </motion.p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
            <DialogActions className={styles.dialogActions}>
                <Button 
                    onClick={onClose} 
                    color="secondary" 
                    disabled={isSending}
                    className={styles.cancelButton}
                >
                    Закрыть
                </Button>
                {!sendSuccess && (
                    <Button
                        startIcon={isSending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                        onClick={handleSendToChat}
                        color={sendSuccess ? "success" : "primary"}
                        variant="contained"
                        disabled={isSending}
                        className={styles.downloadButton}
                    >
                        {isSending ? 'Отправка...' : 'Отправить в чат'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default DocGenerationModal; 