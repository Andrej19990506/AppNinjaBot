import React, { useEffect, useRef, useState, memo, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Fab from '@mui/material/Fab';
import type { HistoryRecord } from '../../types/inventory';
import { fetchItemHistory, clearItemHistory } from '../../store/slices/inventorySlice';
import styles from './ItemHistory.module.css';

// Форматирование даты
const formatDate = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'd MMMM yyyy HH:mm', { locale: ru });
};

interface ItemHistoryProps {
    itemId: string;
    itemName: string;
    category: string;
    className?: string;
}

const ItemHistory: React.FC<ItemHistoryProps> = memo(({ itemId, itemName, category, className = '' }) => {
    const dispatch = useAppDispatch();
    const history = useAppSelector(state => state.inventory.history.records[itemId] || []);
    const isLoading = useAppSelector(state => state.inventory.history.isLoading);
    const error = useAppSelector(state => state.inventory.history.error);
    const selectedChatId = useAppSelector(state => state.inventory.selectedChatId);
    const lastUpdate = useAppSelector(state => state.inventory.history.lastUpdate);

    const [selectedDate, setSelectedDate] = useState<string>('all');
    const [hasNewHistory, setHasNewHistory] = useState<boolean>(false);
    const prevHistoryLength = useRef<number>(history.length);
    const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    
    // Функция для обнаружения мобильного устройства
    const checkIsMobile = useCallback(() => {
        const mobile = window.innerWidth <= 768;
        console.log('🔍 Проверка размера экрана:', window.innerWidth, 'Мобильный:', mobile);
        setIsMobile(mobile);
        
        // Принудительно вызываем reflow для FAB при изменении размера экрана
        if (mobile) {
            setTimeout(() => {
                const fabElements = document.querySelectorAll('[class*="ItemHistory_historyFab"]');
                fabElements.forEach(element => {
                    console.log('🔍 Найден элемент FAB, обновляем стили:', element);
                });
            }, 100);
        }
    }, []);
    
    // Настраиваем прослушиватель изменения размера экрана
    useEffect(() => {
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, [checkIsMobile]);

    // Открытие и закрытие модального окна
    const openModal = useCallback(() => {
        console.log('🔍 Открытие модального окна истории');
        setIsModalOpen(true);
        // Блокируем скролл основного контента
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        
        // Скролл модального окна наверх при открытии
        setTimeout(() => {
            const modalContent = document.querySelector(`.${styles.modalContent}`);
            if (modalContent) {
                modalContent.scrollTop = 0;
            }
        }, 100);
    }, []);

    const closeModal = useCallback(() => {
        console.log('🔍 Закрытие модального окна истории');
        setIsModalOpen(false);
        // Разблокируем скролл основного контента
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }, []);

    useEffect(() => {
        return () => {
            // Разблокируем скролл при размонтировании компонента
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, []);

    // Функция для мобильного отображения даты в формате "дд.мм"
    const formatMobileDate = (date: string | Date): string => {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return format(dateObj, 'd MMM', { locale: ru });
    };

    // Получаем короткие версии дат для мобильного отображения
    const mobileAvailableDates = React.useMemo(() => {
        const dates = history.map(record => {
            const date = new Date(record.timestamp);
            return {
                full: format(date, 'dd.MM.yyyy', { locale: ru }),
                short: format(date, 'd MMM', { locale: ru })
            };
        });
        
        // Удаляем дубликаты, сохраняя оба формата даты
        const uniqueDates = Array.from(new Set(dates.map(d => d.full)))
            .map(fullDate => {
                const date = dates.find(d => d.full === fullDate);
                return { full: fullDate, short: date?.short || '' };
            });
            
        return [{ full: 'all', short: 'Все' }, ...uniqueDates];
    }, [history]);

    // Получаем уникальные даты из истории
    const availableDates = React.useMemo(() => {
        const dates = history.map(record => {
            const date = new Date(record.timestamp);
            return format(date, 'dd.MM.yyyy', { locale: ru });
        });
        return ['all', ...Array.from(new Set(dates))];
    }, [history]);

    // Фильтруем историю по выбранной дате
    const filteredHistory = React.useMemo(() => {
        if (selectedDate === 'all') return history;
        
        return history.filter(record => {
            const date = new Date(record.timestamp);
            const formattedDate = format(date, 'dd.MM.yyyy', { locale: ru });
            return formattedDate === selectedDate;
        });
    }, [history, selectedDate]);

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const item = event.currentTarget;
        const rect = item.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        item.style.setProperty('--mouse-x', `${x}px`);
        item.style.setProperty('--mouse-y', `${y}px`);
    };

    // Загрузка истории при монтировании
    useEffect(() => {
        console.log('=== 📜 Загрузка истории ===');
        console.log('🏠 Чат:', selectedChatId);
        console.log('📦 Товар:', itemName);
        console.log('📑 Категория:', category);
        console.log('🆔 ID товара:', itemId);
        
        if (selectedChatId && itemId) {
            dispatch(fetchItemHistory({ 
                chatId: selectedChatId, 
                itemId,
                category,
                itemName
            }))
            .unwrap()
            .then((result) => {
                console.log('✅ История успешно загружена:', result);
            })
            .catch((error) => {
                console.error('❌ Ошибка загрузки истории:', error);
            });
        }

        return () => {
            dispatch(clearItemHistory());
        };
    }, [dispatch, selectedChatId, itemId, category, itemName]);

    // Отслеживание новых записей
    useEffect(() => {
        console.log('=== 📊 Проверка обновлений истории ===');
        console.log('📦 Товар:', itemName);
        console.log('📈 Текущая длина:', history.length);
        console.log('📉 Предыдущая длина:', prevHistoryLength.current);
        
        if (history.length > prevHistoryLength.current) {
            console.log('✨ Обнаружены новые записи');
            setHasNewHistory(true);
            if (pulseTimeoutRef.current) {
                clearTimeout(pulseTimeoutRef.current);
            }
            pulseTimeoutRef.current = setTimeout(() => {
                setHasNewHistory(false);
            }, 3000);
        }
        prevHistoryLength.current = history.length;

        return () => {
            if (pulseTimeoutRef.current) {
                clearTimeout(pulseTimeoutRef.current);
            }
        };
    }, [history.length, itemName]);

    // Форматирование действия
    const formatAction = (action: string, type: string): string => {
        switch (action) {
            case 'add':
                return 'добавил(а)';
            case 'remove':
                return 'убрал(а)';
            case 'update':
                return 'изменил(а)';
            case 'add_option':
                return 'добавил(а) полуфабрикат';
            case 'remove_option':
                return 'удалил(а) полуфабрикат';
            default:
                return action;
        }
    };

    // Получаем более короткий формат для текста типа
    const getTypeText = (type: string, mobile: boolean): string => {
        if (mobile) {
            return type === 'raw' ? 'сырья' : 'п/ф';
        }
        return type === 'raw' ? 'сырья' : 'полуфабрикатов';
    };

    // Компонент для отображения контента истории
    const HistoryContent = () => (
        <>
            <motion.div 
                className={styles.header}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className={styles.titleContainer}>
                    <FormControl size={isMobile ? "small" : "medium"} className={styles.dateSelect}>
                        <InputLabel>Дата</InputLabel>
                        <Select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value as string)}
                            label="Дата"
                            MenuProps={{
                                anchorOrigin: {
                                    vertical: 'bottom',
                                    horizontal: 'center',
                                },
                                transformOrigin: {
                                    vertical: 'top',
                                    horizontal: 'center',
                                },
                                PaperProps: {
                                    style: {
                                        maxHeight: 300
                                    }
                                }
                            }}
                        >
                            <MenuItem value="all">
                                {isMobile ? "Все даты" : "Все даты"}
                            </MenuItem>
                            {mobileAvailableDates.filter(date => date.full !== 'all').map(date => (
                                <MenuItem key={date.full} value={date.full}>
                                    {isMobile ? date.short : date.full}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>
                {lastUpdate && (
                    <span className={styles.lastUpdate}>
                        Обновлено: {isMobile ? formatMobileDate(lastUpdate) : formatDate(lastUpdate)}
                    </span>
                )}
            </motion.div>

            <div className={styles.timeline}>
                <AnimatePresence mode="popLayout">
                    {filteredHistory.map((record: HistoryRecord, index) => (
                        <motion.div
                            key={`${record.id}-${record.timestamp}`}
                            className={styles.historyItem}
                            initial={{ opacity: 0, x: isMobile ? 0 : -20, y: isMobile ? -10 : 0 }}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            exit={{ opacity: 0, x: isMobile ? 0 : 20, y: isMobile ? 10 : 0 }}
                            transition={{ 
                                type: "spring",
                                stiffness: 500,
                                damping: 30,
                                delay: index * 0.05 // Добавляем небольшую задержку для каскадной анимации
                            }}
                            onMouseMove={!isMobile ? handleMouseMove : undefined}
                            whileHover={!isMobile ? { x: 8 } : undefined}
                        >
                            <div className={styles.authorInfo}>
                                {record.author?.photo_url && (
                                    <motion.img 
                                        src={record.author.photo_url} 
                                        alt={record.author.first_name}
                                        className={styles.authorPhoto}
                                        whileHover={!isMobile ? { scale: 1.1 } : undefined}
                                        transition={{ type: "spring", stiffness: 400 }}
                                    />
                                )}
                                <span className={styles.authorName}>
                                    {record.author?.first_name || 'Система'}
                                </span>
                            </div>
                            <div className={styles.actionInfo}>
                                <span className={`${styles.action} ${styles[record.action]}`}>
                                    {formatAction(record.action, record.type)}
                                </span>
                                {record.action !== 'add_option' && record.action !== 'remove_option' && (
                                    <>
                                        <span className={styles.quantity}>
                                            {Math.abs((record.newQuantity ?? 0) - (record.oldQuantity ?? 0))}
                                        </span>
                                        <span className={styles.type}>
                                            {getTypeText(record.type, isMobile)}
                                        </span>
                                    </>
                                )}
                            </div>
                            <motion.div 
                                className={styles.quantityChange}
                                whileHover={!isMobile ? { scale: 1.05 } : undefined}
                            >
                                <span className={styles.oldQuantity}>
                                    {record.oldQuantity ?? 0}
                                </span>
                                <span className={styles.arrow}>→</span>
                                <span className={styles.newQuantity}>
                                    {record.newQuantity ?? 0}
                                </span>
                            </motion.div>
                            <time className={styles.timestamp}>
                                {isMobile ? formatMobileDate(record.timestamp) : formatDate(record.timestamp)}
                            </time>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {/* Добавляем пустой элемент в конце для обеспечения корректной прокрутки */}
                <div style={{ height: '80px', width: '100%' }} />
                {filteredHistory.length === 0 && (
                    <motion.div 
                        className={styles.emptyFilterMessage}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        {selectedDate !== 'all' ? (
                            <>
                                <p>Нет записей за {selectedDate}</p>
                                <button 
                                    className={styles.resetFilterButton}
                                    onClick={() => setSelectedDate('all')}
                                >
                                    Показать все записи
                                </button>
                            </>
                        ) : (
                            <p>Нет доступных записей</p>
                        )}
                    </motion.div>
                )}
            </div>
        </>
    );

    // Компонент для пустой истории
    const EmptyHistory = () => (
        <motion.div 
            className={styles.emptyState}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 15, -15, 10, -10, 0] }}
                transition={{
                    duration: 2,
                    times: [0, 0.2, 0.4, 0.6, 0.8, 1],
                    ease: "easeInOut",
                    repeat: isMobile ? 0 : Infinity,
                    repeatDelay: 3
                }}
            >
                <HistoryIcon className={styles.emptyIcon} />
            </motion.div>
            <motion.h3 
                className={styles.emptyTitle}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                {isMobile ? 'История пуста' : 'Здесь будет история изменений'}
            </motion.h3>
            <motion.p 
                className={styles.emptyText}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 0.5 }}
            >
                {isMobile ? 
                    'Изменения количества товара будут отображаться здесь' : 
                    'Все изменения количества товара будут отображаться в этом разделе'
                }
            </motion.p>
        </motion.div>
    );

    if (isLoading) {
        if (isMobile) {
            return (
                <Tooltip title="Загрузка истории..." arrow>
                    <Fab 
                        color="primary" 
                        size="medium" 
                        className={styles.historyFab}
                        disabled
                    >
                        <HistoryIcon />
                    </Fab>
                </Tooltip>
            );
        }
        
        return (
            <motion.div 
                className={`${styles.container} ${styles.loadingContainer}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <div className={styles.loadingSpinner} />
                <p>Загрузка истории...</p>
            </motion.div>
        );
    }

    if (error) {
        if (isMobile) {
            return (
                <Tooltip title="Ошибка загрузки истории" arrow>
                    <Fab 
                        color="secondary" 
                        size="medium" 
                        className={styles.historyFab}
                        onClick={() => {
                            if (selectedChatId) {
                                dispatch(fetchItemHistory({ chatId: selectedChatId, itemId, category, itemName }));
                            }
                        }}
                    >
                        <HistoryIcon />
                    </Fab>
                </Tooltip>
            );
        }
        
        return (
            <motion.div 
                className={`${styles.container} ${styles.errorContainer}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <p className={styles.errorMessage}>{error}</p>
                <button 
                    className={styles.retryButton}
                    onClick={() => {
                        if (selectedChatId) {
                            dispatch(fetchItemHistory({ chatId: selectedChatId, itemId, category, itemName }));
                        }
                    }}
                >
                    Повторить загрузку
                </button>
            </motion.div>
        );
    }

    // Для мобильных устройств - кнопка и модальное окно
    if (isMobile) {
        const hasItems = history && history.length > 0;
        
        console.log('🔍 Рендеринг мобильной версии ItemHistory, hasItems:', hasItems);
        
        return (
            <>
                {hasItems ? (
                    <Tooltip title="История изменений" arrow>
                        <Fab 
                            color="primary" 
                            size="medium" 
                            className={`${styles.historyFab} ${hasNewHistory ? styles.hasNewHistory : ''}`}
                            onClick={openModal}
                        >
                            <HistoryIcon />
                            <span className={styles.historyCount}>{history.length}</span>
                        </Fab>
                    </Tooltip>
                ) : (
                    <Tooltip title="История пуста" arrow>
                        <div 
                            className={styles.emptyHistoryBadge}
                            onClick={openModal}
                            role="button"
                            tabIndex={0}
                            aria-label="Открыть пустую историю"
                        >
                            <HistoryIcon />
                            <span>Нет истории</span>
                        </div>
                    </Tooltip>
                )}

                <AnimatePresence>
                    {isModalOpen && (
                        <motion.div 
                            className={styles.modalOverlay}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeModal} // Закрытие по клику на затемнённую область
                        >
                            <motion.div 
                                className={styles.modalContainer}
                                initial={{ y: '100%', opacity: 0.5 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие по клику на содержимое
                            >
                                <div className={styles.modalHeader}>
                                    <h3 className={styles.modalTitle}>
                                        <HistoryIcon className={styles.historyIcon} /> 
                                        История изменений
                                    </h3>
                                    <IconButton 
                                        className={styles.closeButton} 
                                        onClick={closeModal}
                                        aria-label="Закрыть"
                                    >
                                        <CloseIcon />
                                    </IconButton>
                                </div>
                                
                                <div className={styles.modalContent}>
                                    {!history || history.length === 0 ? (
                                        <EmptyHistory />
                                    ) : (
                                        <>
                                            <HistoryContent />
                                            
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </>
        );
    }

    // Для десктопов - обычное отображение
    if (!history || history.length === 0) {
        return (
            <motion.div 
                className={`${styles.container} ${styles.emptyContainer} ${className}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <EmptyHistory />
            </motion.div>
        );
    }

    console.log('=== 📜 Рендер истории ===');
    console.log('📦 Товар:', itemName);
    console.log('📊 Количество записей:', history.length);
    console.log('📝 Последняя запись:', history[0]);

    return (
        <motion.div 
            className={`${styles.container} ${className} ${hasNewHistory ? styles.hasNewHistory : ''}`}
            initial={{ opacity: 0, x: isMobile ? 0 : 20, y: isMobile ? 20 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <HistoryContent />
        </motion.div>
    );
});

ItemHistory.displayName = 'ItemHistory';

export default ItemHistory; 