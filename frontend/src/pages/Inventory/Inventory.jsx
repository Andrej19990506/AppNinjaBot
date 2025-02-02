import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Inventory.module.css';
import { getChats, getInventory, saveInventory } from '../../services/api';
import ChatSelector from '../../components/ChatSelector';
import Footer from '../../components/Footer';
import CategoryGrid from '../../components/CategoryGrid/CategoryGrid';
import ItemList from '../../components/ItemList/ItemList';
import ItemOptions from '../../components/ItemOptions/ItemOptions';
import { getCategories, getItems, getTypes, calculateProgress } from '../../utils/inventoryUtils';
import inventoryTemplate from '../../data/inventoryTemplate.json';
import api from '../../services/api';

const Inventory = () => {
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [inventory, setInventory] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [showChatSelector, setShowChatSelector] = useState(false);
    const [matchedCategories, setMatchedCategories] = useState([]);
    const [highlightedItem, setHighlightedItem] = useState(null);
    const [filledItems, setFilledItems] = useState([]);

    // Загрузка списка чатов
    useEffect(() => {
        const loadChats = async () => {
            try {
                const data = await getChats();
                if (!Array.isArray(data)) {
                    setError('Неверный формат данных');
                    return;
                }
                setChats(data);
            } catch (error) {
                setError('Ошибка при загрузке списка чатов');
            } finally {
                setIsLoading(false);
            }
        };

        loadChats();
    }, []);

    // Загрузка инвентаря при выборе чата
    const handleChatSelect = async (chat) => {
        console.log('=== handleChatSelect ===');
        console.log('Выбран чат:', chat);
        
        try {
            setIsLoading(true);
            const savedInventory = await getInventory(chat.id);
            console.log('Загруженный инвентарь:', savedInventory);
            
            if (savedInventory) {
                console.log('Используем сохраненный инвентарь');
                setInventory(savedInventory);
            } else {
                console.log('Запрашиваем шаблон с сервера');
                const template = await getInventoryTemplate();
                setInventory(template);
            }
            setSelectedChat(chat);
            setShowChatSelector(false);
            setSearchQuery('');
            setMatchedCategories([]);
        } catch (error) {
            console.error('Ошибка при загрузке инвентаря:', error);
            setError('Ошибка при загрузке инвентаря');
        } finally {
            setIsLoading(false);
        }
    };

    // Обработчик изменения количества
    const handleQuantityChange = (type, value) => {
        const quantity = parseInt(value) || 0;
        
        setInventory(prev => ({
            ...prev,
            [selectedCategory]: {
                ...prev[selectedCategory],
                [selectedItem]: {
                    ...prev[selectedCategory][selectedItem],
                    [type]: {
                        quantity: quantity,
                        filled: quantity > 0
                    }
                }
            }
        }));

        setProgress(calculateProgress(inventory));
    };

    // Получаем заголовок в зависимости от текущего состояния
    const getHeaderTitle = () => {
        if (!selectedChat) return 'Выберите чат';
        if (!selectedCategory) return 'Инвентаризация';
        if (!selectedItem) return selectedCategory;
        return selectedItem;
    };

    // Обработчик изменения поискового запроса
    const handleSearchChange = (query) => {
        console.log('Изменение поискового запроса:', query);
        setSearchQuery(query);
        if (!query) {
            setMatchedCategories([]);
        }
    };

    // Обработчик совпадения категорий при поиске
    const handleCategoryMatch = (categories) => {
        setMatchedCategories(categories);
        if (categories.length === 0) {
            setSelectedCategory(null);
            setSelectedItem(null);
        }
    };

    // Обработчик выбора категории
    const handleCategorySelect = (category, searchQuery) => {
        console.log('Выбрана категория:', category);
        console.log('Поисковый запрос:', searchQuery);
        // Сбрасываем выбранный товар при смене категории
        setSelectedItem(null);
        // Устанавливаем новую категорию
        setSelectedCategory(category);
        // Если есть поисковый запрос, сохраняем его
        if (searchQuery) {
            setSearchQuery(searchQuery);
        }
    };

    // Обработчик выбора товара
    const handleItemSelect = (item) => {
        console.log('Выбран товар:', item, 'в категории:', selectedCategory);
        setSelectedItem(item);
        setHighlightedItem(item);
        setTimeout(() => setHighlightedItem(null), 2000);
    };

    // Обработчик выбора подсказки из поиска
    const handleSuggestionSelect = (suggestion) => {
        console.log('Обработка выбора подсказки:', suggestion);
        
        if (!suggestion.category) return;

        // Если выбран товар из другой категории
        if (suggestion.item && suggestion.category !== selectedCategory) {
            // Сначала меняем категорию
            handleCategorySelect(suggestion.category, suggestion.searchQuery);
            // Затем устанавливаем выбранный товар
            setTimeout(() => {
                handleItemSelect(suggestion.item);
            }, 100);
        } else {
            // Для остальных случаев оставляем старую логику
            handleCategorySelect(suggestion.category, suggestion.searchQuery);
            if (!suggestion.item) {
                setSearchQuery('');
            }
        }
    };

    // Обновляем состояние заполненных товаров при изменении инвентаря
    useEffect(() => {
        if (!inventory || !selectedCategory) return;

        const filled = Object.entries(inventory[selectedCategory]).reduce((acc, [itemName, itemData]) => {
            const allOptionsFilled = Object.values(itemData).every(option => 
                option.quantity > 0 && option.filled
            );
            if (allOptionsFilled) {
                acc.push(itemName);
            }
            return acc;
        }, []);

        setFilledItems(filled);
    }, [inventory, selectedCategory]);

    // Добавим эффект сохранения
    useEffect(() => {
        console.log('=== Сохранение инвентаря ===');
        console.log('Текущий чат:', selectedChat);
        console.log('Текущий инвентарь:', inventory);
        
        const saveInventoryData = async () => {
            if (selectedChat && inventory) {
                try {
                    // Добавляем метаданные
                    const inventoryData = {
                        ...inventory,
                        lastUpdated: new Date().toISOString(),
                        progress: calculateProgress(inventory)
                    };
                    
                    await saveInventory(selectedChat.id, inventoryData);
                    console.log('Инвентарь успешно сохранен');
                } catch (error) {
                    console.error('Ошибка при сохранении:', error);
                    setError('Ошибка при сохранении инвентаря');
                }
            }
        };

        const debounceTimer = setTimeout(saveInventoryData, 1000);
        return () => clearTimeout(debounceTimer);
    }, [inventory, selectedChat]);

    return (
        <div className={styles.container}>
            {!selectedChat || showChatSelector ? (
                <ChatSelector 
                    chats={chats} 
                    onSelect={handleChatSelect}
                    isLoading={isLoading}
                />
            ) : (
                <div className={styles.inventoryContent}>
                    <div className={styles.header}>
                        <h2 className={styles.headerTitle}>{getHeaderTitle()}</h2>
                        <div className={styles.progress}>
                            <div 
                                className={styles.progressBar}
                                style={{ width: `${progress}%` }}
                            />
                            <span>{progress}%</span>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {!selectedCategory ? (
                            <CategoryGrid
                                key="categories"
                                categories={getCategories(inventory)}
                                onSelect={handleCategorySelect}
                                matchedCategories={matchedCategories}
                                inventory={inventory}
                            />
                        ) : !selectedItem ? (
                            <ItemList
                                key="items"
                                items={getItems(inventory, selectedCategory)}
                                onSelect={handleItemSelect}
                                highlightedItem={highlightedItem}
                                filledItems={filledItems}
                                inventory={inventory}
                                selectedCategory={selectedCategory}
                                onCategorySelect={handleCategorySelect}
                                searchQuery={searchQuery}
                                onSearchChange={handleSearchChange}
                            />
                        ) : (
                            <ItemOptions
                                key="options"
                                types={getTypes(inventory, selectedCategory, selectedItem)}
                                values={inventory[selectedCategory][selectedItem]}
                                onChange={handleQuantityChange}
                            />
                        )}
                    </AnimatePresence>

                    <Footer 
                        selectedChat={selectedChat}
                        selectedCategory={selectedCategory}
                        selectedItem={selectedItem}
                        onBack={() => {
                            if (selectedItem) setSelectedItem(null);
                            else if (selectedCategory) setSelectedCategory(null);
                            else setShowChatSelector(true);
                        }}
                        onChatSelect={() => setShowChatSelector(true)}
                        isEditing={false}
                        inventory={inventory}
                        searchQuery={searchQuery}
                        onSearchChange={handleSearchChange}
                        onCategoryMatch={handleCategoryMatch}
                        onCategorySelect={handleCategorySelect}
                        onItemSelect={handleItemSelect}
                        onSearchResults={(results) => {
                            console.log('Результаты поиска:', results);
                        }}
                        onSuggestionSelect={handleSuggestionSelect}
                    />
                </div>
            )}
        </div>
    );
};

export default Inventory; 