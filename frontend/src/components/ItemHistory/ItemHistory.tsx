import React, { useEffect, useRef, useState, memo, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Fab from '@mui/material/Fab';
import type { HistoryRecord } from '../../types/inventory';
import { fetchItemHistory, clearItemHistory } from '../../store/slices/inventorySlice';
import styles from './ItemHistory.module.css';
import { useHistoryAnimations } from './hooks/useHistoryAnimations';
import Modal from '@mui/material/Modal';

// Расширяем тип HistoryRecord
interface ExtendedHistoryRecord extends HistoryRecord {
    newQuantity: number;
    oldQuantity: number;
}

interface ItemHistoryProps {
    itemId: string;
    itemName: string;
    category: string;
    className?: string;
}

interface DateFormat {
    full: string;
    short: string;
}

// Анимационные варианты для элементов истории
const historyItemVariants = {
    hidden: { opacity: 0, x: -20, scale: 0.95 },
    visible: (index: number) => ({
        opacity: 1, 
        x: 0, 
        scale: 1,
        transition: { 
            type: "spring",
            stiffness: 500,
            damping: 30,
            delay: index * 0.05
        }
    }),
    exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

// Анимационные варианты для модального окна
const modalVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
};

const modalContentVariants = {
    hidden: { y: '100%', opacity: 0.5 },
    visible: { 
        y: 0, 
        opacity: 1,
        transition: { 
            type: 'spring', 
            damping: 25, 
            stiffness: 300 
        }
    },
    exit: { 
        y: '100%', 
        opacity: 0,
        transition: { 
            type: 'spring', 
            damping: 25, 
            stiffness: 300,
            duration: 0.3
        }
    }
};

// Форматирование даты
const formatDate = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'd MMMM yyyy HH:mm', { locale: ru });
};

// Функция для получения начальной даты
const getInitialDate = (history: ExtendedHistoryRecord[]): string => {
    if (!history.length) return 'all';
    
    const today = format(new Date(), 'dd.MM.yyyy', { locale: ru });
    
    // Проверяем, есть ли записи за сегодня
    const hasRecordsToday = history.some(record => {
        const recordDate = format(new Date(record.timestamp), 'dd.MM.yyyy', { locale: ru });
        return recordDate === today;
    });

    if (hasRecordsToday) {
        return today;
    }

    // Если нет записей за сегодня, берем дату последней записи
    const lastRecord = history[0]; // История отсортирована по убыванию
    return format(new Date(lastRecord.timestamp), 'dd.MM.yyyy', { locale: ru });
};

// Обновляем компонент HistoryContent для правильной проверки наличия истории
const HistoryContent = ({ hasItems, onOpenModal, historyCount }: { 
    hasItems: boolean; 
    onOpenModal: () => void;
    historyCount: number;
}) => {
    console.log('🔍 Отображение контента истории:', { hasItems, historyCount });
    return (
        <div 
            className={`${styles.emptyHistoryContainer} ${hasItems ? styles.hasItems : ''}`} 
            onClick={hasItems ? onOpenModal : undefined}
        >
            <div className={styles.emptyHistoryIcon}>
                {hasItems && <span className={styles.historyCount}>{historyCount}</span>}
                <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    className={hasItems ? styles.historyIconSvg : styles.emptyIconSvg}
                >
                    {hasItems ? (
                        <g className={styles.rotatingGroup}>
                            <path 
                                d="M12 7v5l3 3" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className={styles.clockHands}
                            />
                            <path 
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className={styles.circlePathFilled}
                            />
                            <path
                                d="M16 12l-2 2m0 0l-2 2m2-2l2 2m-2-2l-2-2"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={styles.historyDots}
                            />
                        </g>
                    ) : (
                        <g className={styles.pulsingGroup}>
                            <path 
                                d="M12 7v5l2.5 2.5" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className={styles.clockHandsEmpty}
                            />
                            <path 
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className={styles.circlePathEmpty}
                            />
                            <circle
                                cx="12"
                                cy="12"
                                r="3"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={styles.centerDot}
                            />
                        </g>
                    )}
                </svg>
            </div>
            <h3 className={styles.emptyHistoryTitle}>
                {hasItems ? 'История' : 'История пуста'}
            </h3>
            <p className={styles.emptyHistoryText}>
                {hasItems 
                    ? 'Кликните на иконку, чтобы посмотреть историю изменений'
                    : 'Здесь будут отображаться изменения количества сырья и полуфабрикатов'
                }
            </p>
        </div>
    );
};

// Компонент для отображения истории
const ItemHistory: React.FC<ItemHistoryProps> = memo(({ itemId, itemName, category, className = '' }) => {
    const dispatch = useAppDispatch();
    const history = useAppSelector(state => state.inventory.history.records[itemId] || []) as ExtendedHistoryRecord[];
    const isLoading = useAppSelector(state => state.inventory.history.isLoading);
    const error = useAppSelector(state => state.inventory.history.error);
    const selectedChatId = useAppSelector(state => state.inventory.selectedChatId);
    const lastUpdate = useAppSelector(state => state.inventory.history.lastUpdate);

    const [selectedDate, setSelectedDate] = useState<string>(() => getInitialDate(history));
    const [hasNewHistory, setHasNewHistory] = useState<boolean>(false);
    const prevHistoryLength = useRef<number>(history.length);
    const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const modalRef = useRef<HTMLDivElement>(null);
    
    // Получаем рефы и функции анимаций
    const {
        headerRef,
        timelineRef,
        filterRef,
        animateNewHistoryItem,
        animateHistoryItemUpdate,
        animateHistoryItemRemoval,
        animateFilterChange
    } = useHistoryAnimations();

    // Определяем функции открытия и закрытия модального окна в начале компонента
    const closeModal = useCallback(() => {
        console.log('🔍 Закрытие модального окна истории');
        setIsModalOpen(false);
        // Разблокируем скролл основного контента
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }, []);

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

    // Обработчик клика вне модального окна
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            // Проверяем, является ли клик по селектору или его выпадающему списку
            const isSelectClick = target.closest('.MuiSelect-root') || 
                                target.closest('.MuiPopover-root');
            
            // Закрываем модальное окно только если клик был не по селектору
            if (isModalOpen && modalRef.current && 
                !modalRef.current.contains(event.target as Node) && 
                !isSelectClick) {
                closeModal();
            }
        };

        if (isModalOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isModalOpen, closeModal]);

    // Обработчик клавиши ESC для закрытия модального окна
    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isModalOpen) {
                closeModal();
            }
        };

        if (isModalOpen) {
            document.addEventListener('keydown', handleEscKey);
        } else {
            document.removeEventListener('keydown', handleEscKey);
        }

        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isModalOpen]);

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
        return format(dateObj, 'd MMM HH:mm', { locale: ru });
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

    // Фильтруем историю, исключая add_option и remove_option
    const filteredHistory = React.useMemo(() => {
        const relevantHistory = history.filter(record => 
            !['add_option', 'remove_option'].includes(record.action)
        );
        
        if (selectedDate === 'all') return relevantHistory;
        
        return relevantHistory.filter(record => {
            const date = new Date(record.timestamp);
            const formattedDate = format(date, 'dd.MM.yyyy', { locale: ru });
            return formattedDate === selectedDate;
        });
    }, [history, selectedDate]);

    // Обновляем проверку наличия истории
    const hasValidHistory = React.useMemo(() => {
        return history.some(record => !['add_option', 'remove_option'].includes(record.action));
    }, [history]);

    // Получаем количество записей в истории только за текущий день
    const historyCount = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return history.filter(record => {
            if (['add_option', 'remove_option'].includes(record.action)) {
                return false;
            }
            const recordDate = new Date(record.timestamp);
            recordDate.setHours(0, 0, 0, 0);
            return recordDate.getTime() === today.getTime();
        }).length;
    }, [history]);

    // Обработчик движения мыши для эффекта свечения
    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        if (isMobile) return; // Пропускаем эффект на мобильных устройствах
        
        const item = event.currentTarget;
        const rect = item.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        item.style.setProperty('--mouse-x', `${x}px`);
        item.style.setProperty('--mouse-y', `${y}px`);
    };

    // Обработчик изменения фильтра
    const handleFilterChange = (event: SelectChangeEvent<string>) => {
        const newDate = event.target.value;
        setSelectedDate(newDate);

        // Анимируем изменение фильтра
        const historyItems = document.querySelectorAll('.history-item');
        animateFilterChange(Array.from(historyItems) as HTMLElement[]);
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

    // Обновляем выбранную дату при изменении истории
    useEffect(() => {
        if (history.length > prevHistoryLength.current) {
            // Если появились новые записи
            const initialDate = getInitialDate(history);
            setSelectedDate(initialDate);
            setHasNewHistory(true);
            
            if (pulseTimeoutRef.current) {
                clearTimeout(pulseTimeoutRef.current);
            }
            
            pulseTimeoutRef.current = setTimeout(() => {
                setHasNewHistory(false);
            }, 2000);
        }
        prevHistoryLength.current = history.length;
    }, [history]);

    // Очистка таймера
    useEffect(() => {
        return () => {
            if (pulseTimeoutRef.current) {
                clearTimeout(pulseTimeoutRef.current);
            }
        };
    }, []);

    // Форматирование действия
    const formatAction = (action: string, type: string): string => {
        const itemType = type === 'raw' ? 'сырья' : 'полуфабриката';
        
        switch (action) {
            case 'add':
                return `добавил(а) ${itemType}`;
            case 'remove':
                return `убрал(а) ${itemType}`;
            case 'update':
                return `изменил(а) количество ${itemType}`;
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

    // Обновляем рендер для мобильной версии
    if (isMobile) {
        return (
            <>
                <motion.div 
                    className={`${styles.container} ${className}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <HistoryContent 
                        hasItems={hasValidHistory} 
                        onOpenModal={openModal}
                        historyCount={historyCount}
                    />
                </motion.div>

                <Modal
                    open={isModalOpen}
                    onClose={closeModal}
                    className={styles.modalOverlay}
                >
                    <div className={styles.modalContainer} ref={modalRef}>
                        <div className={styles.modalHeader}>
                            <div className={styles.titleContainer}>
                                <HistoryIcon className={styles.historyIcon} />
                                <h2 className={styles.title}>История изменений</h2>
                            </div>
                            <IconButton 
                                className={styles.closeButton}
                                onClick={closeModal}
                                size="small"
                                aria-label="Закрыть"
                            >
                                <CloseIcon />
                            </IconButton>
                        </div>

                        <div className={styles.filterSection}>
                            <FormControl variant="outlined" size="small" fullWidth>
                                <Select
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value as string)}
                                    className={styles.dateSelect}
                                    displayEmpty
                                    renderValue={(value) => (
                                        <div className={styles.selectValue}>
                                            {value === 'all' ? 'Все даты' : value}
                                        </div>
                                    )}
                                    MenuProps={{
                                        anchorOrigin: {
                                            vertical: 'bottom',
                                            horizontal: 'left',
                                        },
                                        transformOrigin: {
                                            vertical: 'top',
                                            horizontal: 'left',
                                        },
                                        PaperProps: {
                                            className: styles.selectMenu
                                        }
                                    }}
                                >
                                    <MenuItem value="all">
                                        Все даты
                                    </MenuItem>
                                    {mobileAvailableDates.filter(date => date.full !== 'all').map(date => (
                                        <MenuItem key={date.full} value={date.full}>
                                            {isMobile ? date.short : date.full}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </div>
                        
                        <div className={styles.modalContent}>
                            {!history || history.length === 0 ? (
                                <HistoryContent 
                                    hasItems={false} 
                                    onOpenModal={openModal}
                                    historyCount={0}
                                />
                            ) : (
                                <div ref={timelineRef} className={styles.timeline}>
                                    <AnimatePresence mode="popLayout">
                                        {filteredHistory
                                            .filter(record => !['add_option', 'remove_option'].includes(record.action))
                                            .map((record: ExtendedHistoryRecord, index: number) => (
                                            <motion.div
                                                key={`${record.id}-${record.timestamp}`}
                                                className={`${styles.historyItem} history-item`}
                                                variants={historyItemVariants}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                                custom={index}
                                                onMouseMove={handleMouseMove}
                                                data-history-id={record.id}
                                                layoutId={`history-${record.id}`}
                                            >
                                                <div className={styles.leftContent}>
                                                    <div className={styles.authorInfo}>
                                                        {record.author && record.author.first_name ? (
                                                            <>
                                                                {record.author.photo_url !== undefined && record.author.photo_url !== null && (
                                                                    <img 
                                                                        src={record.author.photo_url} 
                                                                        alt={record.author.first_name}
                                                                        className={styles.authorPhoto}
                                                                        onError={(e) => {
                                                                            console.log('❌ Ошибка загрузки фото автора:', record.author?.photo_url);
                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                        }}
                                                                        onLoad={() => {
                                                                            console.log('✅ Фото автора успешно загружено:', record.author?.photo_url);
                                                                        }}
                                                                    />
                                                                )}
                                                                <span className={styles.authorName}>
                                                                    {record.author.first_name}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className={styles.authorName}>
                                                                Система
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className={styles.actionInfo}>
                                                        <span className={`${styles.action} ${styles[record.action]}`}>
                                                            {formatAction(record.action, record.type)}
                                                        </span>
                                                        <span className={styles.quantity}>
                                                            {Math.abs((record.newQuantity ?? 0) - (record.oldQuantity ?? 0))}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={styles.rightContent}>
                                                    <div className={styles.quantityChange}>
                                                        <span className={styles.oldQuantity}>
                                                            {record.oldQuantity ?? 0}
                                                        </span>
                                                        <span className={styles.arrow}>→</span>
                                                        <span className={styles.newQuantity}>
                                                            {record.newQuantity ?? 0}
                                                        </span>
                                                    </div>
                                                    <time className={styles.timestamp}>
                                                        {isMobile ? formatMobileDate(record.timestamp) : formatDate(record.timestamp)}
                                                    </time>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    {filteredHistory.length === 0 && (
                                        <motion.div 
                                            className={styles.emptyFilterMessage}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4 }}
                                        >
                                            {selectedDate !== 'all' ? (
                                                <>
                                                    <p>Нет записей за {selectedDate}</p>
                                                    <motion.button 
                                                        className={styles.resetFilterButton}
                                                        onClick={() => setSelectedDate('all')}
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                    >
                                                        Показать все записи
                                                    </motion.button>
                                                </>
                                            ) : (
                                                <p>Нет доступных записей</p>
                                            )}
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            </>
        );
    }

    // Обновляем рендер для десктопной версии
    if (!hasValidHistory) {
        console.log('🔍 История пуста:', { history });
        return (
            <motion.div 
                className={`${styles.container} ${styles.emptyContainer} ${className}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <HistoryContent 
                    hasItems={false} 
                    onOpenModal={openModal}
                    historyCount={0}
                />
            </motion.div>
        );
    }

    console.log('=== 📜 Рендер истории ===');
    console.log('📦 Товар:', itemName);
    console.log('📊 Количество записей:', history.length);
    console.log('📝 Последняя запись:', history[0]);

    return (
        <>
            <motion.div 
                className={`${styles.container} ${className}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <HistoryContent 
                    hasItems={true} 
                    onOpenModal={openModal}
                    historyCount={historyCount}
                />
            </motion.div>

            <Modal
                open={isModalOpen}
                onClose={closeModal}
                className={styles.modalOverlay}
            >
                <div className={styles.modalContainer} ref={modalRef}>
                    <div className={styles.modalHeader}>
                        <div className={styles.titleContainer}>
                            <HistoryIcon className={styles.historyIcon} />
                            <h2 className={styles.title}>История изменений</h2>
                        </div>
                        <IconButton 
                            className={styles.closeButton}
                            onClick={closeModal}
                            size="small"
                            aria-label="Закрыть"
                        >
                            <CloseIcon />
                        </IconButton>
                    </div>

                    <div className={styles.filterSection}>
                        <FormControl variant="outlined" size="small" fullWidth>
                            <Select
                                value={selectedDate}
                                onChange={handleFilterChange}
                                className={styles.dateSelect}
                                displayEmpty
                            >
                                <MenuItem value="all">Все даты</MenuItem>
                                {availableDates.filter(date => date !== 'all').map(date => (
                                    <MenuItem key={date} value={date}>
                                        {date}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>

                    <div className={styles.modalContent}>
                        <div ref={timelineRef} className={styles.timeline}>
                            <AnimatePresence mode="popLayout">
                                {filteredHistory
                                    .filter(record => !['add_option', 'remove_option'].includes(record.action))
                                    .map((record: ExtendedHistoryRecord, index: number) => (
                                    <motion.div
                                        key={`${record.id}-${record.timestamp}`}
                                        className={`${styles.historyItem} history-item`}
                                        variants={historyItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="exit"
                                        custom={index}
                                    >
                                        <div className={styles.leftContent}>
                                            <div className={styles.authorInfo}>
                                                {record.author && record.author.first_name ? (
                                                    <>
                                                        {record.author.photo_url !== undefined && record.author.photo_url !== null && (
                                                            <img 
                                                                src={record.author.photo_url} 
                                                                alt={record.author.first_name}
                                                                className={styles.authorPhoto}
                                                                onError={(e) => {
                                                                    console.log('❌ Ошибка загрузки фото автора:', record.author?.photo_url);
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                                onLoad={() => {
                                                                    console.log('✅ Фото автора успешно загружено:', record.author?.photo_url);
                                                                }}
                                                            />
                                                        )}
                                                        <span className={styles.authorName}>
                                                            {record.author.first_name}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className={styles.authorName}>
                                                        Система
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.actionInfo}>
                                                <span className={`${styles.action} ${styles[record.action]}`}>
                                                    {formatAction(record.action, record.type)}
                                                </span>
                                                <span className={styles.quantity}>
                                                    {Math.abs((record.newQuantity ?? 0) - (record.oldQuantity ?? 0))}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.rightContent}>
                                            <div className={styles.quantityChange}>
                                                <span className={styles.oldQuantity}>
                                                    {record.oldQuantity ?? 0}
                                                </span>
                                                <span className={styles.arrow}>→</span>
                                                <span className={styles.newQuantity}>
                                                    {record.newQuantity ?? 0}
                                                </span>
                                            </div>
                                            <time className={styles.timestamp}>
                                                {isMobile ? formatMobileDate(record.timestamp) : formatDate(record.timestamp)}
                                            </time>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
});

ItemHistory.displayName = 'ItemHistory';

export default ItemHistory; 