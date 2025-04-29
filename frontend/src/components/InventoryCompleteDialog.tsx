// @ts-nocheck
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './InventoryCompleteDialog.module.css';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { triggerExcelReportGeneration } from '../services/inventoryApi';
import { HotTable } from '@handsontable/react';
import 'handsontable/dist/handsontable.full.css';
import { useAppDispatch } from '../store/hooks';
import { addNotification, NotificationTypes } from '../store/slices/notificationSlice';

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

interface InventoryCompleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryData: InventoryData;
    chatId: string;
}

const InventoryCompleteDialog: React.FC<InventoryCompleteDialogProps> = ({ 
    isOpen, 
    onClose, 
    inventoryData, 
    chatId 
}) => {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
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

    const handlePreviewClick = async () => {
        try {
            const tableData = [];
            const inventory = inventoryData.inventory || {};

            const tableHeaders = ['Категория', 'Товар', 'Статус', 'Сырье (шт.)', 'Полуфабрикаты (шт.)'];
            setHeaders(tableHeaders);

            for (const [category, items] of Object.entries(inventory)) {
                for (const [itemName, itemData] of Object.entries(items)) {
                    const status = itemData.raw?.isOutOfStock ? 'Нет в наличии' : '';
                    tableData.push([
                        category,
                        itemName,
                        status,
                        itemData.raw?.quantity || 0,
                        itemData.semifinished?.quantity || 0
                    ]);
                }
            }

            setPreviewData(tableData);
            setIsPreviewOpen(true);
        } catch (error) {
            console.error('Error preparing preview:', error);
            window.Telegram?.WebApp?.showPopup({
                title: 'Ошибка',
                message: 'Ошибка при подготовке предпросмотра',
                buttons: [{
                    type: 'ok',
                    text: 'OK'
                }]
            });
        }
    };

    const tableSettings = {
        stretchH: 'all' as 'all',
        autoWrapRow: true,
        autoWrapCol: true,
        manualColumnResize: true,
        manualRowResize: true,
        rowHeaders: true,
        colHeaders: headers,
        height: '350px',
        width: '100%',
        readOnly: true,
        licenseKey: 'non-commercial-and-evaluation',
        filters: true,
        multiColumnSorting: true,
        columns: [
            { // Категория
                width: 200,
                className: 'htLeft'
            },
            { // Товар
                width: 250,
                className: 'htLeft'
            },
            { // Статус
                width: 120,
                className: 'htLeft'
            },
            { // Сырье
                width: 120,
                className: 'htCenter'
            },
            { // Полуфабрикаты
                width: 120,
                className: 'htCenter'
            }
        ]
    };

    const handleStartNewInventory = async () => {
        try {
            const response = await fetch(`${config.API_URL}/inventory/${chatId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to reset inventory');
            }

            onClose();
            window.location.reload();
        } catch (error) {
            console.error('Error starting new inventory:', error);
            window.Telegram?.WebApp?.showPopup({
                title: 'Ошибка',
                message: 'Произошла ошибка при начале новой инвентаризации',
                buttons: [{
                    type: 'ok',
                    text: 'OK'
                }]
            });
        }
    };

    return (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    className={styles.overlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div 
                        className={styles.dialog}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                        <div className={styles.header}>
                            <motion.div 
                                className={styles.successIcon}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring" }}
                            >
                                <CheckCircleIcon />
                            </motion.div>
                            <h2>Инвентаризация завершена!</h2>
                            <motion.button
                                className={styles.closeButton}
                                onClick={onClose}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <CloseIcon />
                            </motion.button>
                        </div>

                        <div className={styles.content}>
                            <p>Все товары успешно подсчитаны. Теперь вы можете скачать отчет в формате Excel или просмотреть его.</p>

                            <motion.div 
                                className={styles.excelPreview}
                                onClick={handlePreviewClick}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <motion.div 
                                    className={styles.excelIcon}
                                    animate={{ 
                                        rotateY: [0, 360],
                                    }}
                                    transition={{ 
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                >
                                    <DescriptionIcon />
                                </motion.div>
                                <span>Просмотреть отчет</span>
                            </motion.div>

                            <motion.button
                                className={styles.downloadButton}
                                onClick={handleSendReport}
                                disabled={isSending}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <DownloadIcon />
                                {isSending ? 'Отправка...' : 'Отправить отчет в группу'}
                            </motion.button>

                            <motion.button
                                className={styles.startNewButton}
                                onClick={handleStartNewInventory}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Начать новую инвентаризацию
                            </motion.button>
                        </div>
                    </motion.div>

                    {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                    <AnimatePresence>
                        {isPreviewOpen && (
                            <motion.div 
                                className={styles.previewOverlay}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <motion.div 
                                    className={styles.previewContainer}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                >
                                    <div className={styles.previewHeader}>
                                        <h3>Предпросмотр отчета</h3>
                                        <motion.button
                                            onClick={() => setIsPreviewOpen(false)}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            <CloseIcon />
                                        </motion.button>
                                    </div>
                                    <div className={styles.previewContent}>
                                        <HotTable
                                            data={previewData}
                                            settings={tableSettings}
                                        />
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default InventoryCompleteDialog; 