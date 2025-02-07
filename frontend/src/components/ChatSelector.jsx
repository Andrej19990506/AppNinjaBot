import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ChatSelector.module.css';
import ChatDialog from './ChatDialog';
import { LinearProgress } from '@mui/material';
import { formatDate } from '../utils/dateUtils';
import { calculateProgress } from '../utils/inventoryUtils';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';
import { 
    AccessTime, 
    CheckCircle,
    PlayCircle,
    PendingActions,
    Timeline
} from '@mui/icons-material';

const ChatSelector = ({ chats, onSelect, isLoading }) => {
    const [selectedChat, setSelectedChat] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [direction, setDirection] = useState(0); // -1 для влево, 1 для вправо
    
    // Добавляем подробное логирование при каждом рендере
    console.log('=== ChatSelector: Проверка входящих данных ===');
    console.log('Все чаты:', chats);
    if (chats && chats.length > 0) {
        console.log('Пример структуры первого чата:', {
            chat_id: chats[0].chat_id,
            chat_title: chats[0].chat_title,
            inventory: chats[0].inventory,
            inventory_structure: chats[0].inventory ? {
                has_wrapper: 'inventory' in chats[0].inventory,
                has_metadata: 'metadata' in chats[0].inventory,
                top_level_keys: Object.keys(chats[0].inventory)
            } : null
        });
    }
    
    if (isLoading) {
        return <LoadingSpinner text="Загрузка списка чатов..." />;
    }

    if (!Array.isArray(chats)) {
        return <div className={styles.error}>Ошибка загрузки чатов</div>;
    }

    if (chats.length === 0) {
        return <div className={styles.empty}>Нет доступных чатов</div>;
    }

    // Получаем прогресс инвентаризации
    const getInventoryProgress = (chat) => {
        console.log('=== Проверка прогресса инвентаризации ===');
        console.log('ID чата:', chat.chat_id);
        console.log('Название чата:', chat.chat_title);
        console.log('Структура данных чата:', {
            hasInventory: !!chat.inventory,
            hasWrapper: chat.inventory && 'inventory' in chat.inventory,
            hasMetadata: chat.inventory && 'metadata' in chat.inventory
        });
        
        // Проверяем наличие инвентаря
        if (!chat.inventory || !chat.inventory.inventory) {
            console.log('Инвентарь отсутствует или некорректного формата');
            return 0;
        }

        // Получаем данные инвентаря и метаданные
        const inventoryData = chat.inventory.inventory;
        const metadata = chat.inventory.metadata || {};
        
        console.log('Данные инвентаря:', {
            categories: Object.keys(inventoryData),
            metadata
        });
        
        // Если нет данных инвентаря, возвращаем 0
        if (!inventoryData || typeof inventoryData !== 'object') {
            console.log('Данные инвентаря некорректного формата');
            return 0;
        }

        // Проверяем наличие категорий
        const categories = Object.entries(inventoryData);
        console.log('Найденные категории:', categories.map(([key]) => key));

        if (categories.length === 0) {
            console.log('Нет категорий в инвентаре');
            return 0;
        }

        // Считаем прогресс
        let filledCount = 0;
        let totalCount = 0;

        categories.forEach(([category, items]) => {
            Object.entries(items).forEach(([itemName, itemData]) => {
                Object.entries(itemData).forEach(([type, data]) => {
                    if (type === 'raw' || type === 'semifinished') {
                        totalCount++;
                        const quantity = Number(data?.quantity || 0);
                        const filled = data?.filled || false;
                        
                        // Позиция считается заполненной, если quantity > 0 или filled === true
                        if (quantity > 0 || filled === true) {
                            filledCount++;
                            console.log(`[${category}][${itemName}][${type}] заполнено (quantity: ${quantity}, filled: ${filled})`);
                        } else {
                            console.log(`[${category}][${itemName}][${type}] не заполнено (quantity: ${quantity}, filled: ${filled})`);
                        }
                    }
                });
            });
        });

        // Получаем сохраненный прогресс из метаданных
        const savedProgress = Number(metadata.progress || 0);
        
        // Вычисляем текущий прогресс
        const calculatedProgress = totalCount > 0 ? 
            Math.round((filledCount / totalCount) * 100) : 0;
        
        // Используем максимальное значение между сохраненным и вычисленным прогрессом
        const progress = Math.max(savedProgress, calculatedProgress);
        
        console.log('Итоги расчета прогресса:', {
            totalCount,
            filledCount,
            savedProgress,
            calculatedProgress,
            finalProgress: progress,
            metadata
        });
        
        return progress;
    };

    const getLastInventoryDate = (chat) => {
        console.log('=== Проверка даты последней инвентаризации ===');
        console.log('Чат:', chat.chat_title);
        
        // Поддержка обоих форматов данных
        const lastUpdated = chat.inventory?.metadata?.lastUpdated || 
                          chat.inventory?.lastUpdated ||
                          chat.lastUpdated;
        
        if (!lastUpdated) {
            console.log('Нет даты последнего обновления');
            return null;
        }

        try {
            const formattedDate = formatDate(lastUpdated);
            console.log('Отформатированная дата:', formattedDate);
            return formattedDate;
        } catch (error) {
            console.error('Ошибка при форматировании даты:', error);
            return null;
        }
    };

    const handleChatButtonClick = (index) => {
        setDirection(index > activeIndex ? 1 : -1);
        setActiveIndex(index);
    };

    const handleChatClick = (chat) => {
        console.log('=== Выбор чата ===');
        console.log('Открываем диалог для чата:', chat);
        setSelectedChat(chat);
    };

    const handleClose = () => {
        setSelectedChat(null);
    };

    const handleStartInventory = () => {
        if (!selectedChat) return;
        console.log('=== Начало инвентаризации ===');
        console.log('Подтверждено начало инвентаризации для чата:', selectedChat);
        onSelect(selectedChat);
        setSelectedChat(null);
    };

    // Получаем статус инвентаризации
    const getInventoryStatus = (chat) => {
        const progress = getInventoryProgress(chat);
        console.log('=== Определение статуса инвентаризации ===');
        console.log('ID чата:', chat.chat_id);
        console.log('Название чата:', chat.chat_title);
        console.log('Прогресс:', progress);
        
        // Проверяем сохраненный статус в метаданных
        const savedStatus = chat.inventory?.metadata?.status;
        
        // Определяем статус на основе прогресса
        let calculatedStatus;
        if (progress === 100) {
            calculatedStatus = 'completed';
        } else if (progress > 0) {
            calculatedStatus = 'in-progress';
        } else {
            calculatedStatus = 'not-started';
        }
        
        console.log('Определение статуса:', {
            savedStatus,
            calculatedStatus,
            finalStatus: calculatedStatus
        });
        
        return calculatedStatus;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'var(--success-color)';
            case 'in-progress': return 'var(--warning-color)';
            default: return 'var(--error-color)';
        }
    };

    const getProgressColor = (progress) => {
        if (progress >= 100) return 'var(--success-color)';
        if (progress >= 50) return 'var(--warning-color)';
        if (progress > 0) return 'var(--primary-color)';
        return 'var(--gray-300)';
    };

    const getProgressStatus = (progress) => {
        console.log('Определение статуса по прогрессу:', progress);
        
        if (progress === 100) {
            return 'Завершено';
        }
        if (progress > 0) {
            return `В процессе (${progress}%)`;
        }
        return 'Не начато';
    };

    const renderStatusBadge = (status, progress) => {
        const icons = {
            'completed': <CheckCircle fontSize="small" />,
            'in-progress': <PlayCircle fontSize="small" />,
            'not-started': <PendingActions fontSize="small" />
        };

        return (
            <div className={`${styles.statusBadge} ${styles[status]}`}>
                {icons[status]}
                <span>{getProgressStatus(progress)}</span>
            </div>
        );
    };

    const renderProgressSection = (chat) => {
        const progress = getInventoryProgress(chat);
        const status = getInventoryStatus(chat);
        
        return (
            <div className={styles.progressSection}>
                <div className={styles.progressInfo}>
                    <div className={`${styles.progressStatus} ${styles[status]}`}>
                        <Timeline className={styles.icon} />
                        <span>{getProgressStatus(progress)}</span>
                    </div>
                    <div className={styles.progressText}>{progress}%</div>
                </div>
                <LinearProgress 
                    variant="determinate" 
                    value={progress} 
                    className={`${styles.progress} ${styles[status]}`}
                    classes={{
                        root: styles.progressRoot,
                        bar: styles.progressBar
                    }}
                />
            </div>
        );
    };

    const getInitials = (title) => {
        return title
            .split(' ')
            .map(word => word[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    };

    return (
        <motion.div 
            className={styles.container}
            initial={{ 
                opacity: 0,
                y: 50,
                scale: 0.95,
                filter: 'blur(10px)'
            }}
            animate={{ 
                opacity: 1,
                y: 0,
                scale: 1,
                filter: 'blur(0px)'
            }}
            exit={{ 
                opacity: 0,
                y: -50,
                scale: 0.95,
                filter: 'blur(10px)'
            }}
            transition={{
                duration: 0.5,
                type: "spring",
                stiffness: 100,
                damping: 15
            }}
        >
            <motion.h2 
                className={styles.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
            >
                Выберите чат для инвентаризации
            </motion.h2>
            
            <div className={styles.chatList}>
                <AnimatePresence mode="wait" initial={false}>
                    {chats.map((chat, index) => {
                        const progress = getInventoryProgress(chat);
                        const status = getInventoryStatus(chat);

                        return index === activeIndex ? (
                            <motion.div
                                key={chat.chat_id}
                                className={`${styles.chatItem} ${styles[status]}`}
                                initial={{ 
                                    opacity: 0,
                                    x: direction * 300,
                                    scale: 0.8,
                                    rotateY: direction * 45
                                }}
                                animate={{ 
                                    opacity: 1,
                                    x: 0,
                                    scale: 1,
                                    rotateY: 0
                                }}
                                exit={{ 
                                    opacity: 0,
                                    x: direction * -300,
                                    scale: 0.8,
                                    rotateY: direction * -45
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 200,
                                    damping: 20
                                }}
                                onClick={() => handleChatClick(chat)}
                            >
                                <div className={styles.chatHeader}>
                                    <div className={styles.chatInfo}>
                                        <h3>{chat.chat_title}</h3>
                                    </div>
                                    {renderStatusBadge(status, progress)}
                                </div>
                                
                                {progress > 0 && renderProgressSection(chat)}
                                
                                <div className={styles.chatFooter}>
                                    <div className={styles.lastInventory}>
                                        <AccessTime className={styles.icon} />
                                        <span>
                                            {getLastInventoryDate(chat) 
                                                ? `Последнее обновление: ${getLastInventoryDate(chat)}`
                                                : 'Нет данных об обновлениях'}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ) : null;
                    })}
                </AnimatePresence>
            </div>

            <motion.div 
                className={styles.chatNavigation}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
            >
                {chats.map((chat, index) => (
                    <motion.button
                        key={chat.chat_id}
                        className={`${styles.chatButton} ${index === activeIndex ? styles.active : ''}`}
                        onClick={() => handleChatButtonClick(index)}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.95, rotate: -5 }}
                        initial={false}
                        animate={{
                            scale: index === activeIndex ? 1.1 : 1,
                            y: index === activeIndex ? -5 : 0,
                            rotate: index === activeIndex ? 5 : 0
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30
                        }}
                    >
                        {getInitials(chat.chat_title)}
                    </motion.button>
                ))}
            </motion.div>
            
            <AnimatePresence>
                {selectedChat && (
                    <ChatDialog
                        chat={selectedChat}
                        onClose={handleClose}
                        onStartInventory={handleStartInventory}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ChatSelector; 