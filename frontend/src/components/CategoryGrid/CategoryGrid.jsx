import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CategoryGrid.module.css';
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
        scale: 0.8
    },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.3,
            ease: 'easeOut'
        }
    }
};

const CategoryGrid = ({ categories, onSelect, matchedCategories = [], inventory }) => {
    const scrollRef = useRef(null);
    const [isTopReached, setIsTopReached] = useState(true);
    const [isBottomReached, setIsBottomReached] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredCategories, setFilteredCategories] = useState(categories);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        setIsTopReached(scrollTop === 0);
        setIsBottomReached(Math.abs(scrollHeight - clientHeight - scrollTop) < 1);
    };

    const handleSearchChange = (query) => {
        console.log('=== handleSearchChange ===');
        console.log('Поисковый запрос:', query);
        setSearchQuery(query);
        
        if (!query.trim()) {
            console.log('Пустой запрос, возвращаем исходный список категорий');
            setFilteredCategories(categories);
            setShowSuggestions(false);
            return;
        }

        const queryLower = query.toLowerCase();
        console.log('Поиск по запросу:', queryLower);
        console.log('Текущие категории:', categories);
        
        // Проверяем, есть ли совпадения в категориях
        const hasMatches = categories.some(category => 
            category.toLowerCase().includes(queryLower)
        );
        console.log('Есть совпадения в категориях:', hasMatches);

        if (hasMatches) {
            // Сортируем категории, перемещая совпадающие наверх
            const sorted = [...categories].sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                
                // Точное совпадение в начале
                const aStartsWith = aLower.startsWith(queryLower);
                const bStartsWith = bLower.startsWith(queryLower);
                
                // Частичное совпадение
                const aIncludes = aLower.includes(queryLower);
                const bIncludes = bLower.includes(queryLower);
                
                console.log(`\nСравниваем: "${a}" и "${b}"`);
                console.log('Начинается с запроса:', { a: aStartsWith, b: bStartsWith });
                console.log('Содержит запрос:', { a: aIncludes, b: bIncludes });
                
                if (aStartsWith && !bStartsWith) {
                    console.log(`"${a}" начинается с запроса, перемещаем вверх`);
                    return -1;
                }
                if (!aStartsWith && bStartsWith) {
                    console.log(`"${b}" начинается с запроса, перемещаем вверх`);
                    return 1;
                }
                if (aIncludes && !bIncludes) {
                    console.log(`"${a}" содержит запрос, перемещаем вверх`);
                    return -1;
                }
                if (!aIncludes && bIncludes) {
                    console.log(`"${b}" содержит запрос, перемещаем вверх`);
                    return 1;
                }
                
                const originalOrder = categories.indexOf(a) - categories.indexOf(b);
                console.log('Сохраняем оригинальный порядок:', originalOrder);
                return originalOrder;
            });
            
            console.log('Отсортированный список:', sorted);
            setFilteredCategories(sorted);
            setShowSuggestions(false);
        } else {
            console.log('Нет совпадений в категориях, показываем подсказки');
            setFilteredCategories(categories);
            setShowSuggestions(true);
        }
        console.log('=== Конец handleSearchChange ===\n');
    };

    // Обработчик результатов поиска
    const handleSearchResults = (suggestions) => {
        console.log('=== handleSearchResults ===');
        console.log('Полученные предложения:', suggestions);
        
        if (!suggestions || suggestions.length === 0) {
            console.log('Нет предложений, пропускаем обновление списка');
            setShowSuggestions(false);
            return;
        }

        // Получаем уникальные категории из найденных товаров
        const matchedCategories = [...new Set(suggestions.map(s => s.category))];
        console.log('Найденные категории:', matchedCategories);
        
        if (matchedCategories.length > 0) {
            // Показываем подсказки только если нет совпадений в текущих категориях
            const hasDirectMatches = filteredCategories.some(category => 
                category.toLowerCase().includes(searchQuery.toLowerCase())
            );
            
            console.log('Есть прямые совпадения в категориях:', hasDirectMatches);
            setShowSuggestions(!hasDirectMatches);
        }
        console.log('=== Конец handleSearchResults ===\n');
    };

    // Функция для определения, нужно ли подсвечивать категорию
    const isCategoryHighlighted = (category) => {
        if (!searchQuery.trim()) return false;
        const query = searchQuery.toLowerCase();
        const categoryLower = category.toLowerCase();
        
        // Проверяем и полное совпадение, и частичное
        return categoryLower.includes(query) || query.includes(categoryLower);
    };

    const isCategoryFilled = (category) => {
        if (!inventory || !inventory[category]) return false;
        
        // Получаем все товары в категории
        const items = inventory[category];
        
        // Проверяем, есть ли товары
        if (Object.keys(items).length === 0) return false;
        
        // Проверяем каждый товар
        return Object.values(items).every(item => {
            // Проверяем, есть ли опции у товара
            if (!item || Object.keys(item).length === 0) return false;
            
            // Проверяем все опции товара
            return Object.values(item).every(option => 
                option && 
                option.quantity > 0 && 
                option.filled === true
            );
        });
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
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Поиск категории..."
                    showSuggestions={showSuggestions}
                    inventory={inventory}
                    onCategorySelect={(category, query) => {
                        console.log('Выбрана категория:', category);
                        console.log('Поисковый запрос:', query);
                        onSelect(category, query || searchQuery);
                    }}
                    onCategoryMatch={() => {}}
                    onSearchResults={handleSearchResults}
                />
            </div>
            
            <div 
                ref={scrollRef}
                className={`${styles.scrollContainer} ${isTopReached ? styles.atTop : ''} ${isBottomReached ? styles.atBottom : ''}`}
                onScroll={handleScroll}
            >
                <div className={styles.grid}>
                    {filteredCategories.map((category) => {
                        const isFilled = isCategoryFilled(category);
                        const isHighlighted = isCategoryHighlighted(category);
                        
                        return (
                            <motion.div
                                key={category}
                                className={`${styles.item} ${isHighlighted ? styles.highlighted : ''}`}
                                onClick={() => {
                                    console.log('Клик по категории:', category);
                                    onSelect(category, searchQuery);
                                }}
                                layout="position"
                                initial={false}
                                animate={{ 
                                    scale: isHighlighted ? 1.02 : 1,
                                    transition: { duration: 0.2 }
                                }}
                                whileHover={{ 
                                    scale: 1.05,
                                    backgroundColor: isHighlighted ? 'var(--orange-primary-hover)' : 'rgb(28, 28, 28)'
                                }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <h3 className={styles.title}>{category}</h3>
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
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
};

export default CategoryGrid; 