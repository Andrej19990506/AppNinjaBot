import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ItemList.module.css';
import Search from '../Search';

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
    onSearchChange
}) => {
    const [isTopReached, setIsTopReached] = useState(true);
    const [isBottomReached, setIsBottomReached] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState(propSearchQuery || '');
    const [filteredItems, setFilteredItems] = useState(items);
    const [localHighlightedItem, setLocalHighlightedItem] = useState(null);
    const scrollRef = useRef(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

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

    return (
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
                                className={`${styles.item} ${isHighlighted ? styles.highlighted : ''}`}
                                onClick={() => onSelect(item)}
                                variants={itemVariants}
                                whileHover={{ 
                                    x: 8,
                                    backgroundColor: 'var(--color-background-hover)'
                                }}
                                whileTap={{ scale: 0.98 }}
                                layout
                            >
                                <div className={styles.content}>
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
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default ItemList; 