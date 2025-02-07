import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ItemList.module.css';
import Search from '../Search';
import { ArrowBack, Delete, VolumeUp, VolumeOff } from '@mui/icons-material';
import config from '../../config';
import deleteSound from '../../assets/sounds/deleteModal.mp3';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

const containerVariants = {
    hidden: { 
        y: '100%',
        opacity: 0
    },
    visible: {
        y: '0%',
        opacity: 1,
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 200,
            staggerChildren: 0.05
        }
    },
    exit: {
        y: '100%',
        opacity: 0,
        transition: {
            duration: 0.3,
            ease: 'easeInOut'
        }
    }
};

const itemVariants = {
    hidden: { 
        opacity: 0,
        x: -20
    },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.3,
            ease: 'easeOut'
        }
    }
};

const ItemList = ({ 
    items, 
    onSelect, 
    highlightedItem: propHighlightedItem, 
    filledItems = [], 
    inventory, 
    selectedCategory, 
    onCategorySelect,
    searchQuery: propSearchQuery,
    onSearchChange,
    onDeleteItem
}) => {
    const [isTopReached, setIsTopReached] = useState(true);
    const [isBottomReached, setIsBottomReached] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState(propSearchQuery || '');
    const [filteredItems, setFilteredItems] = useState(items);
    const [localHighlightedItem, setLocalHighlightedItem] = useState(null);
    const scrollRef = useRef(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState(null);
    const [swipedItem, setSwipedItem] = useState(null);
    const [deletionInfo, setDeletionInfo] = useState(null);
    const [isSoundPlaying, setIsSoundPlaying] = useState(true);
    const audioRef = useRef(new Audio(deleteSound));
    const [showVolumeWarning, setShowVolumeWarning] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [countdown, setCountdown] = useState(5);
    const countdownRef = useRef(null);

    // Используем либо проп, либо локальное состояние для подсветки
    const highlightedItem = propHighlightedItem || localHighlightedItem;
    const setHighlightedItem = (item) => setLocalHighlightedItem(item);

    // Синхронизируем локальное состояние с пропсами
    useEffect(() => {
        if (propSearchQuery !== undefined && propSearchQuery !== localSearchQuery) {
            setLocalSearchQuery(propSearchQuery);
            handleSearchChange(propSearchQuery);
        }
    }, [propSearchQuery]);

    // Эффект для воспроизведения звука при открытии модального окна
    useEffect(() => {
        if (deleteConfirmation && isSoundPlaying) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
            setShowVolumeWarning(true);
            setTimeout(() => setShowVolumeWarning(false), 5000);
        } else {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setShowVolumeWarning(false);
        }
    }, [deleteConfirmation, isSoundPlaying]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        setIsTopReached(scrollTop === 0);
        setIsBottomReached(Math.abs(scrollHeight - clientHeight - scrollTop) < 1);
    };

    const handleSearchChange = (query) => {
        console.log('=== handleSearchChange ===');
        console.log('Поисковый запрос:', query);
        setLocalSearchQuery(query);
        onSearchChange?.(query);
        
        // Сортируем весь список, поднимая наверх совпадающие элементы
        if (query.trim()) {
            console.log('Начинаем сортировку списка');
            console.log('Все товары:', items);
            
            const lowerQuery = query.toLowerCase();
            
            // Проверяем, есть ли совпадения в текущей категории
            const hasMatches = items.some(item => 
                item.toLowerCase().includes(lowerQuery)
            );
            
            // Показываем подсказки только если нет совпадений в текущей категории
            setShowSuggestions(!hasMatches);
            console.log('Показывать подсказки:', !hasMatches);
            
            if (hasMatches) {
                // Сортируем весь список
                const sorted = [...items].sort((a, b) => {
                    const aIncludes = a.toLowerCase().includes(lowerQuery);
                    const bIncludes = b.toLowerCase().includes(lowerQuery);
                    
                    // Если оба элемента содержат запрос, сортируем по точности совпадения
                    if (aIncludes && bIncludes) {
                        const aStartsWith = a.toLowerCase().startsWith(lowerQuery);
                        const bStartsWith = b.toLowerCase().startsWith(lowerQuery);
                        if (aStartsWith && !bStartsWith) return -1;
                        if (!aStartsWith && bStartsWith) return 1;
                        return 0;
                    }
                    
                    // Если только один элемент содержит запрос, он идет вверх
                    if (aIncludes) return -1;
                    if (bIncludes) return 1;
                    return 0;
                });
                
                console.log('Отсортированный список:', sorted);
                setFilteredItems(sorted);

                // Находим первый совпадающий элемент для подсветки
                const matchingItem = sorted.find(item => 
                    item.toLowerCase().includes(lowerQuery)
                );
                
                if (matchingItem) {
                    console.log('Подсвечиваем найденный товар:', matchingItem);
                    setHighlightedItem(matchingItem);
                }
            } else {
                // Если нет совпадений, оставляем список как есть
                setFilteredItems(items);
                setHighlightedItem(null);
            }
        } else {
            console.log('Пустой запрос, показываем обычный список');
            setFilteredItems(items);
            setHighlightedItem(null);
            setShowSuggestions(false);
        }
        console.log('=== Конец handleSearchChange ===');
    };

    // При изменении items обновляем filteredItems и применяем поиск
    useEffect(() => {
        console.log('=== useEffect [items] ===');
        console.log('Обновление списка товаров:', items);
        
        // Если есть активный поиск, сразу применяем его к новому списку
        if (localSearchQuery.trim()) {
            console.log('Применяем существующий поисковый запрос:', localSearchQuery);
            handleSearchChange(localSearchQuery);
        } else {
            setFilteredItems(items);
        }
    }, [items]);

    // Обновляем отфильтрованные элементы при изменении результатов поиска
    const handleSearchResults = (suggestions) => {
        console.log('=== handleSearchResults ===');
        console.log('Полученные предложения:', suggestions);
        console.log('Текущая категория:', selectedCategory);
        
        // Проверяем, есть ли совпадения в текущей категории
        const currentCategoryMatches = suggestions.filter(s => s.category === selectedCategory);
        console.log('Совпадения в текущей категории:', currentCategoryMatches);
        
        if (currentCategoryMatches.length > 0) {
            console.log('Найдены совпадения в текущей категории');
            // Получаем список товаров для сортировки
            const matchedItems = currentCategoryMatches.map(s => s.item);
            
            // Сортируем весь список, поднимая наверх совпадающие элементы
            const sorted = [...items].sort((a, b) => {
                const aMatched = matchedItems.includes(a);
                const bMatched = matchedItems.includes(b);
                if (aMatched && !bMatched) return -1;
                if (!aMatched && bMatched) return 1;
                return 0;
            });
            
            console.log('Отсортированный список:', sorted);
            setFilteredItems(sorted);
            
            // Подсвечиваем первый найденный товар
            if (matchedItems.length > 0) {
                console.log('Подсвечиваем первый найденный товар:', matchedItems[0]);
                setHighlightedItem(matchedItems[0]);
            }
        } else {
            // Если нет совпадений в текущей категории, показываем подсказки
            setShowSuggestions(true);
            setFilteredItems(items);
            setHighlightedItem(null);
        }
        console.log('=== Конец handleSearchResults ===');
    };

    const isItemFilled = (item) => {
        return filledItems.includes(item);
    };

    // Функция для проверки, соответствует ли товар поисковому запросу
    const isItemHighlighted = (item) => {
        if (!localSearchQuery.trim()) return false;
        return item.toLowerCase().includes(localSearchQuery.toLowerCase());
    };

    const handleSwipe = (item, info) => {
        const swipe = info.offset.x;
        if (swipe < -100) { // Если свайп достаточно длинный влево
            setSwipedItem(item);
            setDeleteConfirmation(item);
        }
    };

    const startDeletion = () => {
        setIsDeleting(true);
        // Останавливаем звук
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        // Запускаем таймер
        setCountdown(5);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current);
                    handleDeleteConfirm();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const cancelDeletion = () => {
        clearInterval(countdownRef.current);
        setIsDeleting(false);
        setCountdown(5);
    };

    const handleDeleteConfirm = async () => {
        try {
            // Проверяем статус удаления товара
            const response = await fetch(`${config.API_URL}/check_item_deletion_status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: selectedCategory,
                    item: deleteConfirmation
                })
            });

            const data = await response.json();

            if (data.has_active_request) {
                setDeletionInfo({
                    branch_name: data.request_info.branch_name,
                    chat_id: data.request_info.chat_id
                });
                return;
            }

            // Если нет активных запросов, удаляем товар
            await onDeleteItem(selectedCategory, deleteConfirmation);
            setDeleteConfirmation(null);
            setSwipedItem(null);
        } catch (error) {
            console.error('Error during deletion:', error);
            if (error.response?.status === 409 || error.status === 409) {
                const errorData = error.response?.data || error.data;
                setDeletionInfo({
                    branch_name: errorData.branch_name,
                    chat_id: errorData.chat_id
                });
                return;
            }
            alert('Произошла ошибка при удалении товара. Пожалуйста, попробуйте еще раз.');
        } finally {
            setIsDeleting(false);
            setCountdown(5);
        }
    };

    // Очищаем таймер при размонтировании
    useEffect(() => {
        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
            }
        };
    }, []);

    const handleOpenChat = () => {
        if (deletionInfo?.chat_id) {
            try {
                // Форматируем ID группового чата, убирая префикс '-100'
                const chatId = deletionInfo.chat_id.toString();
                const formattedChatId = chatId.startsWith('-100') ? chatId.slice(4) : chatId;
                
                // Открываем групповой чат
                window.Telegram.WebApp.openLink(`https://t.me/c/${formattedChatId}`);
            } catch (error) {
                console.error('Error opening chat:', error);
                window.Telegram.WebApp.showAlert('Не удалось открыть чат. Пожалуйста, попробуйте позже.');
            }
        }
    };

    const toggleSound = () => {
        setIsSoundPlaying(!isSoundPlaying);
        if (isSoundPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        }
    };

    return (
        <>
            <motion.div 
                className={styles.container}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <div className={styles.searchWrapper}>
                    <Search
                        value={localSearchQuery}
                        onChange={handleSearchChange}
                        placeholder="Поиск товара..."
                        showSuggestions={showSuggestions}
                        inventory={inventory}
                        selectedCategory={selectedCategory}
                        onItemSelect={(item) => {
                            console.log('=== onItemSelect ===');
                            console.log('Выбран товар:', item);
                            onSelect(item);
                        }}
                        onCategoryMatch={() => {}}
                        onSearchResults={handleSearchResults}
                        onCategorySelect={onCategorySelect}
                    />
                </div>

                <div 
                    ref={scrollRef}
                    className={`${styles.scrollContainer} ${isTopReached ? styles.atTop : ''} ${isBottomReached ? styles.atBottom : ''}`}
                    onScroll={handleScroll}
                >
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item) => {
                            const isFilled = isItemFilled(item);
                            const isHighlighted = isItemHighlighted(item);
                            
                            return (
                                <motion.div
                                    key={item}
                                    className={`${styles.item} ${isHighlighted ? styles.highlighted : ''} ${isFilled ? styles.filled : ''}`}
                                    variants={itemVariants}
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    dragElastic={0.7}
                                    onDragEnd={(e, info) => handleSwipe(item, info)}
                                    animate={{ 
                                        x: swipedItem === item ? -100 : 0 
                                    }}
                                    whileHover={{ 
                                        x: 8,
                                        backgroundColor: 'var(--color-background-hover)'
                                    }}
                                    whileTap={{ cursor: 'grabbing' }}
                                >
                                    <div className={styles.content} onClick={() => onSelect(item)}>
                                        <h3 className={styles.title}>{item}</h3>
                                        <div className={styles.actions}>
                                            {isFilled && (
                                                <div className={styles.checkmark}>
                                                    <svg viewBox="0 0 24 24" fill="none">
                                                        <path 
                                                            d="M20 7L9 18L4 13"
                                                            strokeWidth="2.5"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                    </svg>
                                                </div>
                                            )}
                                            <div className={styles.arrow}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                    <path 
                                                        d="M9 18L15 12L9 6" 
                                                        stroke="currentColor" 
                                                        strokeWidth="2" 
                                                        strokeLinecap="round" 
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.deleteAction}>
                                        <Delete />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Уведомление о громкости */}
            <AnimatePresence>
                {showVolumeWarning && (
                    <motion.div 
                        className={styles.volumeWarning}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className={styles.volumeWarningContent}>
                            <div className={styles.volumeIcon}>
                                {[1, 2, 3].map((i) => (
                                    <motion.span
                                        key={i}
                                        animate={{
                                            opacity: [0.3, 1, 0.3],
                                            scale: [1, 1.2, 1]
                                        }}
                                        transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                            delay: i * 0.2
                                        }}
                                    />
                                ))}
                            </div>
                            <span>Сделайте звук погромче для лучшего восприятия</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Модальное окно подтверждения удаления */}
            <AnimatePresence>
                {(deleteConfirmation || deletionInfo) && (
                    <motion.div 
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div 
                            className={styles.modal}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                        >
                            <div className={styles.modalHeader}>
                                <h3>Удаление товара</h3>
                                <motion.div 
                                    className={styles.soundIcon}
                                    onClick={toggleSound}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    {isSoundPlaying ? (
                                        <div className={styles.soundWaves}>
                                            {[1, 2, 3, 4].map((i) => (
                                                <motion.span
                                                    key={i}
                                                    initial={{ height: '30%' }}
                                                    animate={{ 
                                                        height: ['30%', '90%', '30%'],
                                                        opacity: [0.3, 1, 0.3]
                                                    }}
                                                    transition={{
                                                        duration: 1,
                                                        repeat: Infinity,
                                                        delay: i * 0.2,
                                                        ease: "easeInOut"
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={styles.soundWavesMuted}>
                                            {[1, 2, 3, 4].map((i) => (
                                                <span key={i} />
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            </div>
                            {isDeleting ? (
                                <div className={styles.loadingContainer}>
                                    <div className={styles.countdownWrapper}>
                                        <motion.div 
                                            className={styles.countdownProgress}
                                            initial={{ strokeDashoffset: 0 }}
                                            animate={{ strokeDashoffset: 188 * (1 - countdown / 5) }}
                                            transition={{ duration: 1, ease: "linear" }}
                                        >
                                            <svg viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="45" />
                                            </svg>
                                            <span className={styles.countdownNumber}>{countdown}</span>
                                        </motion.div>
                                    </div>
                                    <p className={styles.deletingText}>Удаление товара через {countdown} сек...</p>
                                    <button 
                                        className={styles.cancelButton}
                                        onClick={cancelDeletion}
                                    >
                                        Отменить
                                    </button>
                                </div>
                            ) : deletionInfo ? (
                                <>
                                    <p>
                                        Этот товар уже находится в процессе удаления.
                                        Запрос был инициирован филиалом "{deletionInfo.branch_name}".
                                    </p>
                                    <div className={styles.modalButtons}>
                                        <button 
                                            className={styles.cancelButton}
                                            onClick={() => {
                                                setDeleteConfirmation(null);
                                                setSwipedItem(null);
                                                setDeletionInfo(null);
                                            }}
                                        >
                                            Закрыть
                                        </button>
                                        <button 
                                            className={styles.deleteButton}
                                            onClick={handleOpenChat}
                                        >
                                            Перейти в чат
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p>Вы уверены, что хотите удалить товар "{deleteConfirmation}"?</p>
                                    <p className={styles.warning}>
                                        Внимание! После удаления этот товар не будет отображаться 
                                        в следующих инвентаризациях ни на одном филиале.
                                    </p>
                                    <div className={styles.modalButtons}>
                                        <button 
                                            className={styles.cancelButton}
                                            onClick={() => {
                                                setDeleteConfirmation(null);
                                                setSwipedItem(null);
                                            }}
                                            disabled={isDeleting}
                                        >
                                            Отмена
                                        </button>
                                        <button 
                                            className={styles.deleteButton}
                                            onClick={startDeletion}
                                            disabled={isDeleting}
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ItemList; 