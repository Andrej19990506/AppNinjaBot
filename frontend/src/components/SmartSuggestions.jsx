import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './SmartSuggestions.module.css';

const containerVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { 
            duration: 0.2,
            ease: 'easeOut'
        }
    },
    exit: { 
        opacity: 0, 
        y: -10,
        transition: { 
            duration: 0.15,
            ease: 'easeIn'
        }
    }
};

const groupVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
        opacity: 1,
        x: 0,
        transition: {
            delay: i * 0.05,
            duration: 0.3,
            ease: 'easeOut'
        }
    })
};

const itemVariants = {
    hidden: { opacity: 0, x: -10, y: 10 },
    visible: (i) => ({
        opacity: 1,
        x: 0,
        y: 0,
        transition: {
            delay: i * 0.03,
            duration: 0.2,
            ease: 'easeOut'
        }
    }),
    hover: { 
        x: 10,
        transition: {
            duration: 0.2,
            ease: 'easeOut'
        }
    },
    tap: { 
        scale: 0.98,
        transition: {
            duration: 0.1
        }
    }
};

const typoHintVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 25
        }
    }
};

// Функция для подсветки различий между оригинальным и исправленным текстом
function highlightDifferences(original, corrected) {
    console.log('=== highlightDifferences ===');
    console.log('Оригинал:', original);
    console.log('Исправлено:', corrected);
    
    const diff = [];
    let i = 0;
    
    while (i < Math.max(original.length, corrected.length)) {
        if (original[i] !== corrected[i]) {
            // Найдено различие
            let diffLength = 1;
            while (
                i + diffLength < Math.max(original.length, corrected.length) && 
                original[i + diffLength] !== corrected[i + diffLength]
            ) {
                diffLength++;
            }
            
            // Подсвечиваем группу различий
            diff.push(
                <motion.span 
                    key={`diff-${i}`}
                    className={styles.highlighted}
                    initial={{ backgroundColor: '#ffeb3b' }}
                    animate={{ backgroundColor: '#fff176' }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                >
                    {corrected.slice(i, i + diffLength)}
                </motion.span>
            );
            i += diffLength;
        } else {
            diff.push(
                <span key={`same-${i}`}>
                    {corrected[i] || ''}
                </span>
            );
            i++;
        }
    }
    
    return diff;
}

const SmartSuggestions = ({ suggestions, onSelect, isVisible, matchedCategories = [], originalQuery = '', correctedQuery = '' }) => {
    if (!isVisible) return null;

    const handleSuggestionSelect = (suggestion) => {
        console.log('=== SmartSuggestions: handleSuggestionSelect ===');
        console.log('Получен suggestion:', suggestion);
        console.log('correctedQuery:', correctedQuery);
        console.log('Это исправление опечатки?', suggestion.item === correctedQuery);

        // Если это клик по исправлению опечатки
        if (suggestion.item === correctedQuery) {
            console.log('Отправляем запрос на исправление опечатки');
            onSelect({
                item: correctedQuery,
                isTypoCorrection: true
            });
            return;
        }

        console.log('Отправляем обычный запрос выбора');
        onSelect({
            ...suggestion,
            action: 'highlight',
            timestamp: Date.now()
        });
    };

    if ((!suggestions || suggestions.length === 0) && matchedCategories.length === 0) {
        return (
            <motion.div 
                className={styles.noResults}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                Ничего не найдено
            </motion.div>
        );
    }

    // Группируем результаты по категориям
    const groupedSuggestions = suggestions.reduce((acc, suggestion) => {
        const category = suggestion.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(suggestion);
        return acc;
    }, {});

    return (
        <AnimatePresence>
            <motion.div 
                className={styles.container}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                {correctedQuery && correctedQuery !== originalQuery && (
                    <motion.div
                        className={styles.typoHint}
                        variants={typoHintVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        Возможно, вы имели в виду:
                        <motion.span 
                            className={styles.correctedText}
                            onClick={() => handleSuggestionSelect({ item: correctedQuery })}
                            whileHover={{ x: 5 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {highlightDifferences(originalQuery, correctedQuery)}
                        </motion.span>
                    </motion.div>
                )}

                {Object.entries(groupedSuggestions).map(([category, categoryItems], index) => {
                    const isFromOtherCategory = !categoryItems[0]?.inCurrentCategory;
                    
                    return (
                        <motion.div
                            key={category}
                            className={styles.suggestionGroup}
                            variants={groupVariants}
                            custom={index}
                            initial="hidden"
                            animate="visible"
                        >
                            <div className={`${styles.categoryName} ${isFromOtherCategory ? styles.otherCategory : ''}`}>
                                {isFromOtherCategory ? 'Найдено в другой категории' : category}
                            </div>
                            {categoryItems.map((suggestion, itemIndex) => (
                                <motion.button
                                    key={`${suggestion.category}-${suggestion.item}`}
                                    className={styles.suggestionItem}
                                    onClick={() => handleSuggestionSelect(suggestion)}
                                    variants={itemVariants}
                                    custom={itemIndex}
                                    initial="hidden"
                                    animate="visible"
                                    whileHover="hover"
                                    whileTap="tap"
                                >
                                    <div className={styles.suggestionContent}>
                                        <span className={styles.suggestionText}>
                                            {suggestion.item || suggestion.category}
                                        </span>
                                        {!suggestion.inCurrentCategory && suggestion.item && (
                                            <span className={styles.categoryBadge}>
                                                {suggestion.category}
                                            </span>
                                        )}
                                    </div>
                                </motion.button>
                            ))}
                        </motion.div>
                    );
                })}
            </motion.div>
        </AnimatePresence>
    );
};

export default SmartSuggestions; 