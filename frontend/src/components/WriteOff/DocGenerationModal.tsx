// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircularProgress from '@mui/material/CircularProgress';
import GetAppIcon from '@mui/icons-material/GetApp';
import DoneIcon from '@mui/icons-material/Done';
import styles from './DocGenerationModal.module.css';

interface DocGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentUrl: string | null;
    documentName: string;
    isLoading: boolean;
    onError?: () => void;
}

const DocGenerationModal: React.FC<DocGenerationModalProps> = ({
    isOpen,
    onClose,
    documentUrl,
    documentName,
    isLoading,
    onError
}) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadSuccess, setDownloadSuccess] = useState(false);

    // Показываем анимацию успеха после загрузки
    useEffect(() => {
        if (documentUrl && !isLoading) {
            setShowSuccessAnimation(true);
            const timer = setTimeout(() => {
                setShowSuccessAnimation(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [documentUrl, isLoading]);
    
    // Сбрасываем состояние скачивания при закрытии
    useEffect(() => {
        if (!isOpen) {
            setIsDownloading(false);
            setDownloadSuccess(false);
        }
    }, [isOpen]);

    // Функция для скачивания документа
    const handleDownload = async () => {
        console.log('🔽 [handleDownload] Начинаем скачивание документа. URL:', documentUrl);
        setIsDownloading(true);
        setDownloadSuccess(false);
        setHasError(false);
        
        try {
            // Получаем данные формы из глобального объекта
            const formData = (window as any).__writeOffFormData || {};
            console.log('🔽 [handleDownload] Данные формы:', formData);
            
            if (!documentUrl) {
                throw new Error('URL документа отсутствует');
            }
            
            // Проверяем, запущено ли приложение в Telegram WebApp
            const isTelegramWebApp = !!(window as any).Telegram?.WebApp;
            console.log('🔽 [handleDownload] Выполняется в Telegram WebApp:', isTelegramWebApp);
            
            // Создаем URL для прямого скачивания через GET
            const params = new URLSearchParams();
            
            // Добавляем все необходимые параметры
            Object.entries(formData).forEach(([key, value]) => {
                params.append(key, value as string);
            });
            
            // Принудительно добавляем параметры скачивания
            params.append('download', 'true');
            params.append('force_download', 'true');
            params.append('_t', Date.now().toString()); // Предотвращаем кэширование
            
            // Создаем полный URL
            const downloadUrl = `${documentUrl}?${params.toString()}`;
            console.log('🔽 [handleDownload] Прямой URL для скачивания:', downloadUrl);
            
            // В Telegram WebApp используем специальный метод
            if (isTelegramWebApp) {
                console.log('🔽 [handleDownload] Используем Telegram WebApp.openLink для скачивания');
                (window as any).Telegram.WebApp.openLink(downloadUrl);
                
                // Показываем уведомление пользователю
                (window as any).Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Документ готов к скачиванию',
                    buttons: [{
                        type: 'ok',
                        text: 'OK'
                    }]
                });
            } else {
                console.log('🔽 [handleDownload] Используем стандартное перенаправление браузера');
                window.location.href = downloadUrl;
            }
            
            // Отмечаем успешное скачивание с небольшой задержкой
            setTimeout(() => {
                setIsDownloading(false);
                setDownloadSuccess(true);
                
                // Сбрасываем индикатор успеха через 3 секунды
                setTimeout(() => {
                    setDownloadSuccess(false);
                }, 3000);
            }, 2000);
            
        } catch (error: any) {
            console.error('❌ [handleDownload] Ошибка при скачивании:', error);
            setIsDownloading(false);
            setHasError(true);
            
            // Показываем ошибку в интерфейсе Telegram WebApp, если доступно
            if ((window as any).Telegram?.WebApp) {
                (window as any).Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: `Не удалось скачать документ: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
                    buttons: [{
                        type: 'ok',
                        text: 'OK'
                    }]
                });
            } else {
                // Обычное уведомление для браузера
                alert(`Ошибка при скачивании документа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}. Пожалуйста, попробуйте еще раз.`);
            }
        }
    };

    // Альтернативный способ скачивания через POST форму
    const handleAlternativeDownload = () => {
        console.log('🔽 [handleAlternativeDownload] Используем альтернативный метод скачивания через POST форму');
        setIsDownloading(true);
        setDownloadSuccess(false);
        setHasError(false);
        
        try {
            if (!documentUrl) {
                throw new Error('URL документа отсутствует');
            }
            
            // Получаем данные формы
            const formData = (window as any).__writeOffFormData || {};
            
            // Создаем форму для POST запроса
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = documentUrl;
            form.target = '_blank';
            form.style.display = 'none';
            
            // Добавляем все параметры из формы
            Object.entries(formData).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value as string;
                form.appendChild(input);
            });
            
            // Явно добавляем параметры скачивания
            const downloadInput = document.createElement('input');
            downloadInput.type = 'hidden';
            downloadInput.name = 'download';
            downloadInput.value = 'true';
            form.appendChild(downloadInput);
            
            const forceDownloadInput = document.createElement('input');
            forceDownloadInput.type = 'hidden';
            forceDownloadInput.name = 'force_download';
            forceDownloadInput.value = 'true';
            form.appendChild(forceDownloadInput);
            
            const timestampInput = document.createElement('input');
            timestampInput.type = 'hidden';
            timestampInput.name = '_t';
            timestampInput.value = Date.now().toString();
            form.appendChild(timestampInput);
            
            // Добавляем форму в DOM и отправляем
            document.body.appendChild(form);
            console.log('🔽 [handleAlternativeDownload] Отправляем POST форму...');
            form.submit();
            
            // Удаляем форму из DOM
            setTimeout(() => {
                document.body.removeChild(form);
            }, 100);
            
            // Отмечаем успешное скачивание
            setTimeout(() => {
                setIsDownloading(false);
                setDownloadSuccess(true);
                
                setTimeout(() => {
                    setDownloadSuccess(false);
                }, 3000);
            }, 2000);
            
        } catch (error: any) {
            console.error('❌ [handleAlternativeDownload] Ошибка при альтернативном скачивании:', error);
            setIsDownloading(false);
            setHasError(true);
            alert(`Ошибка при скачивании документа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}. Пожалуйста, попробуйте еще раз.`);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onClose={isLoading ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            className={styles.dialog}
            PaperProps={{
                className: styles.dialogPaper
            }}
        >
            <DialogTitle className={styles.dialogTitle}>
                {isLoading ? 'Формирование документа...' : 'Документ сформирован'}
                <IconButton 
                    aria-label="close" 
                    onClick={onClose}
                    disabled={isLoading}
                    className={styles.closeButton}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent className={styles.dialogContent}>
                {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={styles.loadingContainer}
                        >
                            <CircularProgress color="primary" size={60} />
                            <p className={styles.loadingText}>Идет формирование акта списания...</p>
                        </motion.div>
                    ) : (
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
                                Акт списания успешно сформирован
                            </motion.h3>
                            
                            <motion.div
                                className={styles.documentPreview}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <div className={styles.previewIcon}>
                                    <DescriptionIcon fontSize="large" />
                                </div>
                                <div className={styles.previewInfo}>
                                    <p className={styles.documentName}>{documentName}</p>
                                    <p className={styles.documentType}>Документ Microsoft Word (.docx)</p>
                                </div>
                            </motion.div>
                            
                            <motion.p
                                className={styles.successMessage}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                Вы можете скачать документ или закрыть это окно.
                            </motion.p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
            
            <DialogActions className={styles.dialogActions}>
                <Button 
                    onClick={onClose} 
                    color="secondary" 
                    disabled={isLoading}
                    className={styles.cancelButton}
                >
                    Закрыть
                </Button>
                
                {hasError && (
                    <Button 
                        startIcon={<CloudDownloadIcon />}
                        onClick={onError || handleAlternativeDownload} 
                        color="warning"
                        variant="outlined"
                        disabled={isLoading}
                        className={styles.downloadButton}
                    >
                        Альтернативное скачивание
                    </Button>
                )}
                
                <Button 
                    startIcon={isDownloading ? <CircularProgress size={20} color="inherit" /> : 
                             downloadSuccess ? <DoneIcon /> : <GetAppIcon />}
                    onClick={handleDownload} 
                    color={downloadSuccess ? "success" : "primary"}
                    variant="contained"
                    disabled={isLoading || !documentUrl || isDownloading}
                    className={styles.downloadButton}
                >
                    {isDownloading ? 'Скачивание...' : 
                     downloadSuccess ? 'Скачано' : 'Скачать'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DocGenerationModal; 