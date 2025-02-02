import React, { useReducer, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import SmartSuggestions from './SmartSuggestions';
import SystemNotification from './notifications/SystemNotification/SystemNotification';
import styles from './Search.module.css';
import { 
    isSimilar, 
    calculateRelevance, 
    checkTypos, 
    learnFromSuccessfulSearch, 
    loadDictionaries,
    updateDictionariesFromInventory 
} from '../utils/searchUtils';

// Начальное состояние
const initialState = {
    query: '',
    suggestions: [],
    matchedCategories: [],
    isLoading: false,
    correctedQuery: '',
    originalQuery: '',
    notification: null
};

// Редьюсер для управления состоянием
function searchReducer(state, action) {
    console.log('=== searchReducer ===');
    console.log('Action:', action.type, action.payload);
    
    switch (action.type) {
        case 'SET_QUERY':
            return { ...state, query: action.payload };
        case 'SET_SUGGESTIONS':
            return { ...state, suggestions: action.payload };
        case 'SET_MATCHED_CATEGORIES':
            return { ...state, matchedCategories: action.payload };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_CORRECTED_QUERY':
            return { 
                ...state, 
                correctedQuery: action.payload.corrected,
                originalQuery: action.payload.original 
            };
        case 'SET_NOTIFICATION':
            return { ...state, notification: action.payload };
        case 'RESET':
            return { ...initialState };
        default:
            return state;
    }
}

export default function Search({ 
    value = '', 
    onChange, 
    placeholder = 'Поиск по инвентарю...', 
    inventory,
    selectedCategory,
    onCategoryMatch,
    onCategorySelect,
    onItemSelect,
    onSearchResults,
    onSuggestionSelect,
    showSuggestions = true
}) {
    const [state, dispatch] = useReducer(searchReducer, initialState);
    const searchTimeout = useRef(null);
    const [currentCategory, setCurrentCategory] = useState(selectedCategory);

    // Синхронизируем локальное состояние с пропсами
    useEffect(() => {
        setCurrentCategory(selectedCategory);
    }, [selectedCategory]);

    // Эффект для обработки внешнего значения
    useEffect(() => {
        if (value !== state.query) {
            dispatch({ type: 'SET_QUERY', payload: value });
        }
    }, [value]);

    // Эффект для инициализации словарей при первом рендере
    useEffect(() => {
        if (inventory) {
            console.log('=== Инициализация словарей ===');
            updateDictionariesFromInventory(inventory);
        }
    }, [inventory]);

    // Функция для обработки изменения поискового запроса
    const handleSearchChange = (e) => {
        const newQuery = e.target.value;
        dispatch({ type: 'SET_QUERY', payload: newQuery });
        onChange?.(newQuery);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        if (!newQuery.trim()) {
            dispatch({ type: 'RESET' });
            onCategoryMatch?.([]);
            onSearchResults?.([]);
            return;
        }

        searchTimeout.current = setTimeout(() => {
            performSearch(newQuery);
        }, 150);
    };

    // Функция для выполнения поиска
    const performSearch = (searchQuery) => {
        console.log('=== performSearch ===');
        console.log('Словари:', loadDictionaries());
        console.log('Поисковый запрос:', searchQuery);
        dispatch({ type: 'SET_LOADING', payload: true });

        try {
            const suggestions = [];
            const matchedCategories = new Set();

            if (searchQuery.length < 2) {
                console.log('Запрос слишком короткий');
                dispatch({ type: 'SET_SUGGESTIONS', payload: [] });
                dispatch({ type: 'SET_MATCHED_CATEGORIES', payload: [] });
                onCategoryMatch?.([]);
                onSearchResults?.([]);
                return;
            }

            // Проверяем опечатки
            const correctedQuery = checkTypos(searchQuery, inventory);
            if (correctedQuery && correctedQuery !== searchQuery) {
                dispatch({
                    type: 'SET_CORRECTED_QUERY',
                    payload: {
                        corrected: correctedQuery,
                        original: searchQuery
                    }
                });
            }

            // Ищем по всему инвентарю с учетом схожести
            Object.entries(inventory || {}).forEach(([category, items]) => {
                Object.entries(items).forEach(([itemName, itemData]) => {
                    if (isSimilar(itemName, searchQuery, inventory)) {
                        const relevance = calculateRelevance(itemName, searchQuery, inventory);
                        suggestions.push({
                            category,
                            item: itemName,
                            relevance,
                            data: itemData,
                            inCurrentCategory: category === currentCategory
                        });
                        matchedCategories.add(category);
                    }
                });
            });

            // Сортируем результаты по релевантности и категории
            suggestions.sort((a, b) => {
                if (a.inCurrentCategory !== b.inCurrentCategory) {
                    return a.inCurrentCategory ? -1 : 1;
                }
                return b.relevance - a.relevance;
            });

            console.log('Всего найдено:', suggestions.length);
            console.log('Найденные категории:', Array.from(matchedCategories));
            console.log('Финальные результаты:', suggestions);

            dispatch({ type: 'SET_SUGGESTIONS', payload: suggestions });
            dispatch({ type: 'SET_MATCHED_CATEGORIES', payload: Array.from(matchedCategories) });
            onCategoryMatch?.(Array.from(matchedCategories));
            onSearchResults?.(suggestions);

        } catch (error) {
            console.error('Ошибка при поиске:', error);
            dispatch({ 
                type: 'SET_NOTIFICATION', 
                payload: {
                    message: 'Ошибка при поиске',
                    type: 'error'
                }
            });
            onSearchResults?.([]);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    // Обработка выбора предложения
    const handleSuggestionSelect = (suggestion) => {
        console.log('=== Search: handleSuggestionSelect ===');
        console.log('Получен suggestion:', suggestion);
        console.log('Текущий запрос:', state.query);
        console.log('Исправленный запрос:', state.correctedQuery);
        
        // Если есть исправление опечатки и это не прямой клик по исправлению
        if (state.correctedQuery && state.correctedQuery !== state.query && !suggestion.isTypoCorrection) {
            console.log('Применяем исправление опечатки при выборе товара');
            dispatch({ type: 'SET_QUERY', payload: state.correctedQuery });
            onChange?.(state.correctedQuery);
        }

        // Если это прямое исправление опечатки
        if (suggestion.isTypoCorrection) {
            console.log('Применяем прямое исправление опечатки');
            const correctedQuery = suggestion.item;
            
            dispatch({ type: 'SET_QUERY', payload: correctedQuery });
            onChange?.(correctedQuery);
            performSearch(correctedQuery);
            return;
        }

        // Обучаемся на успешном поиске
        if (suggestion.item) {
            const learningResult = learnFromSuccessfulSearch(
                state.correctedQuery || state.query, // Используем исправленный запрос если есть
                suggestion.item, 
                inventory
            );
            if (learningResult) {
                console.log('Результат обучения:', learningResult);
            }
        }

        // Если выбран элемент с категорией
        if (suggestion.category) {
            console.log('У элемента есть категория:', suggestion.category);
            
            // Если выбран товар из другой категории
            if (suggestion.item && suggestion.category !== currentCategory) {
                console.log('Это товар из другой категории');
                console.log('Товар:', suggestion.item);
                console.log('Категория товара:', suggestion.category);
                console.log('Текущая категория:', currentCategory);
                console.log('Пытаемся перейти в категорию товара:', suggestion.category);
                console.log('Текущий поисковый запрос:', state.query);
                
                // Переходим в категорию товара с сохранением поискового запроса
                try {
                    onCategorySelect?.(suggestion.category, state.query);
                    console.log('Вызов onCategorySelect выполнен с поисковым запросом');
                } catch (error) {
                    console.error('Ошибка при переходе в категорию:', error);
                }
                
                // Не очищаем поиск при переходе в другую категорию
                console.log('=== Конец обработки выбора ===');
                return;
            }
            
            // Если выбрана просто категория или товар из текущей категории
            if (!suggestion.item) {
                console.log('Выбрана просто категория:', suggestion.category);
                console.log('Текущий поисковый запрос:', state.query);
                onCategorySelect?.(suggestion.category, state.query);
                // Не очищаем поиск при выборе категории
            } else {
                console.log('Выбран товар из текущей категории:', suggestion.item);
                onSuggestionSelect?.(suggestion);
            }
        }
        
        // Очищаем подсказки после выбора
        dispatch({ type: 'RESET' });
    };

    // Очистка поля поиска
    const handleClear = () => {
        dispatch({ type: 'RESET' });
        onChange?.('');
    };

    return (
        <div className={styles.searchWrapper}>
            <div className={styles.searchContainer}>
                <input
                    type="text"
                    className={styles.searchInput}
                    value={state.query}
                    onChange={handleSearchChange}
                    placeholder={placeholder}
                />
                {state.query && (
                    <motion.button
                        className={styles.clearButton}
                        onClick={handleClear}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{
                            duration: 0.2,
                            ease: "easeInOut"
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 4L4 12M4 4L12 12" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </motion.button>
                )}
            </div>

            <SmartSuggestions
                suggestions={state.suggestions}
                onSelect={handleSuggestionSelect}
                isVisible={showSuggestions && state.query.length > 0}
                matchedCategories={state.matchedCategories}
                originalQuery={state.originalQuery}
                correctedQuery={state.correctedQuery}
            />

            <SystemNotification
                message={state.notification?.message}
                type={state.notification?.type}
            />
        </div>
    );
} 