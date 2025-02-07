import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Inventory.module.css';
import { getChats } from '../../services/api';
import inventoryService from '../../services/inventoryService';
import ChatSelector from '../../components/ChatSelector';
import Footer from '../../components/Footer';
import CategoryGrid from '../../components/CategoryGrid/CategoryGrid';
import ItemList from '../../components/ItemList/ItemList';
import ItemOptions from '../../components/ItemOptions/ItemOptions';
import { getCategories, getItems, getTypes, calculateProgress } from '../../utils/inventoryUtils';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import config from '../../config';

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
    const [types, setTypes] = useState(['raw']);

    // Отслеживаем монтирование компонента
    useEffect(() => {
        console.log('=== Компонент Inventory смонтирован ===');
        return () => {
            console.log('=== Компонент Inventory размонтирован ===');
        };
    }, []);

    // Отслеживаем изменение состояний
    useEffect(() => {
        console.log('Состояние компонента:', {
            hasChats: chats.length > 0,
            selectedChat: selectedChat?.chat_id,
            hasInventory: !!inventory,
            isLoading,
            error
        });
    }, [chats, selectedChat, inventory, isLoading, error]);

    // Получаем список категорий из инвентаря
    const categories = useMemo(() => {
        if (!inventory) return [];
        // Исключаем служебные поля и получаем только реальные категории
        return Object.keys(inventory).filter(key => 
            key !== 'metadata' && 
            typeof inventory[key] === 'object' && 
            inventory[key] !== null
        );
    }, [inventory]);

    // Загрузка списка чатов
    useEffect(() => {
        const loadChats = async () => {
            try {
                console.log('=== Загрузка чатов ===');
                setIsLoading(true);
                
                const data = await getChats();
                console.log('Полученные данные:', data);
                
                if (!Array.isArray(data)) {
                    console.error('Неверный формат данных:', data);
                    setError('Неверный формат данных');
                    return;
                }

                // Проверяем наличие инвентаризации в каждом чате
                const chatsWithValidInventory = data.map(chat => {
                    console.log('Обработка чата:', chat.chat_title);
                    console.log('Исходные данные чата:', chat);
                    
                    // Если инвентарь отсутствует, создаем пустую структуру
                    if (!chat.inventory) {
                        console.log(`Добавляем пустую инвентаризацию для чата ${chat.chat_id}`);
                        return {
                            ...chat,
                            inventory: {
                                inventory: {},
                                metadata: {
                                    lastUpdated: null,
                                    progress: 0
                                }
                            }
                        };
                    }
                    
                    // Проверяем структуру данных
                    const hasWrapper = 'inventory' in chat.inventory;
                    console.log('Проверка структуры:', { hasWrapper });
                    
                    if (hasWrapper) {
                        // Если данные уже в правильном формате, используем как есть
                        console.log('Данные уже в правильном формате');
                        return chat;
                    } else {
                        // Если нет обертки, добавляем её и сохраняем существующие данные
                        console.log('Добавляем обертку к данным инвентаря');
                        
                        // Создаем глубокую копию данных инвентаря
                        const existingInventory = JSON.parse(JSON.stringify(chat.inventory));
                        
                        // Проверяем и сохраняем существующие значения для каждого товара
                        Object.keys(existingInventory).forEach(category => {
                            if (typeof existingInventory[category] === 'object') {
                                Object.keys(existingInventory[category]).forEach(item => {
                                    ['raw', 'semifinished'].forEach(type => {
                                        const itemData = existingInventory[category][item][type];
                                        if (itemData) {
                                            // Сохраняем существующие значения
                                            itemData.quantity = Number(itemData.quantity) || 0;
                                            itemData.filled = itemData.filled === true || itemData.quantity > 0;
                                            console.log(`Сохранение данных [${category}][${item}][${type}]:`, {
                                                quantity: itemData.quantity,
                                                filled: itemData.filled
                                            });
                                        } else {
                                            // Инициализируем новые данные
                                            existingInventory[category][item][type] = {
                                                quantity: 0,
                                                filled: false
                                            };
                                        }
                                    });
                                });
                            }
                        });
                        
                        // Возвращаем обновленную структуру с сохраненными данными
                        return {
                            ...chat,
                            inventory: {
                                inventory: existingInventory,
                                metadata: chat.metadata || {
                                    lastUpdated: new Date().toISOString(),
                                    progress: 0
                                }
                            }
                        };
                    }
                });

                console.log('Чаты с проверенной инвентаризацией:', chatsWithValidInventory);
                setChats(chatsWithValidInventory);
            } catch (error) {
                console.error('Ошибка при загрузке списка чатов:', error);
                setError('Ошибка при загрузке списка чатов');
            } finally {
                setIsLoading(false);
            }
        };

        loadChats();
    }, []); // Запускаем только при монтировании компонента

    // Загрузка инвентаря при выборе чата
    const handleChatSelect = async (chat) => {
        console.log('=== handleChatSelect вызван ===');
        console.log('Параметры:', { chat });
        
        if (!chat || !chat.chat_id) {
            console.error('Ошибка: chat или chat_id отсутствует', { chat });
            return;
        }

        // Сразу устанавливаем выбранный чат
        console.log('Устанавливаем выбранный чат:', chat.chat_id);
        setSelectedChat(chat);
        setShowChatSelector(false);
        setSearchQuery('');
        setMatchedCategories([]);
        
        try {
            console.log('Начинаем загрузку инвентаря для чата:', chat.chat_id);
            setIsLoading(true);
            setError(null);
            
            const response = await inventoryService.getInventory(chat.chat_id);
            console.log('Получен ответ от сервиса:', response);
            
            if (response.inventory) {
                const inventoryData = response.inventory;
                const progress = await calculateProgress(inventoryData);
                setProgress(progress);
                setInventory(inventoryData);
            } else {
                console.error('Ошибка: неверный формат данных инвентаря', { response });
                setError('Ошибка при загрузке инвентаря: неверный формат данных');
                setInventory(null);
            }
        } catch (error) {
            console.error('Ошибка при загрузке инвентаря:', error);
            console.error('Стек ошибки:', error.stack);
            setError('Ошибка при загрузке инвентаря: ' + (error.message || 'неизвестная ошибка'));
            setInventory(null);
        } finally {
            console.log('Завершение обработки выбора чата');
            setIsLoading(false);
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

    // Эффект для обновления типов при изменении выбранного товара
    useEffect(() => {
        const fetchTypes = async () => {
            if (selectedCategory && selectedItem) {
                const result = await getTypes(inventory, selectedCategory, selectedItem);
                setTypes(result);
            }
        };
        fetchTypes();
    }, [inventory, selectedCategory, selectedItem]);

    // Эффект сохранения инвентаря
    useEffect(() => {
        if (!selectedChat?.chat_id || !inventory) {
            return;
        }

        const saveInventoryData = async () => {
            try {
                const currentProgress = await calculateProgress(inventory);
                
                const inventoryData = {
                    inventory: inventory,
                    metadata: {
                        lastUpdated: new Date().toISOString(),
                        progress: currentProgress
                    }
                };
                
                await inventoryService.saveInventory(selectedChat.chat_id, inventoryData);
                setProgress(currentProgress);
            } catch (error) {
                console.error('Ошибка при сохранении:', error);
                setError('Ошибка при сохранении инвентаря: ' + (error.message || 'неизвестная ошибка'));
            }
        };

        const debounceTimer = setTimeout(saveInventoryData, 300);
        return () => clearTimeout(debounceTimer);
    }, [inventory, selectedChat]);

    // Обработчик изменения количества
    const handleQuantityChange = async (type, value) => {
        if (!selectedCategory || !selectedItem) {
            console.error('Категория или товар не выбраны');
            return;
        }

        const quantity = parseInt(value) || 0;
        console.log('=== Изменение количества ===');
        console.log('Категория:', selectedCategory);
        console.log('Товар:', selectedItem);
        console.log('Тип:', type);
        console.log('Новое количество:', quantity);
        
        // Создаем новый объект инвентаря
        const newInventory = {
            ...inventory,
            [selectedCategory]: {
                ...inventory[selectedCategory],
                [selectedItem]: {
                    ...inventory[selectedCategory][selectedItem]
                }
            }
        };

        if (quantity === 0 && type === 'semifinished') {
            // Если количество 0 и это полуфабрикат - удаляем его
            delete newInventory[selectedCategory][selectedItem].semifinished;
            
            // Сбрасываем кэш шаблона при удалении полуфабриката
            await inventoryService.getTemplate(true);
        } else {
            // Иначе обновляем значение
            newInventory[selectedCategory][selectedItem][type] = {
                quantity: quantity,
                filled: quantity > 0
            };
        }
        
        // Обновляем инвентарь
        setInventory(newInventory);
        
        // Сразу обновляем типы после изменения инвентаря
        const newTypes = await getTypes(newInventory, selectedCategory, selectedItem);
        console.log('Новые типы после изменения:', newTypes);
        setTypes(newTypes);
        
        // Обновляем прогресс
        const newProgress = await calculateProgress(newInventory);
        console.log('Новый прогресс:', newProgress);
        setProgress(newProgress);
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

    const handleDeleteItem = async (category, item) => {
        try {
            console.log('=== Начало процесса удаления товара ===');
            console.log('Категория:', category);
            console.log('Товар:', item);

            const updatedInventory = JSON.parse(JSON.stringify(inventory));
            
            if (updatedInventory[category] && updatedInventory[category][item]) {
                delete updatedInventory[category][item];
                
                if (Object.keys(updatedInventory[category]).length === 0) {
                    delete updatedInventory[category];
                }
            }

            const progress = await calculateProgress(updatedInventory);
            
            const inventoryData = {
                inventory: updatedInventory,
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    progress: progress
                }
            };

            await inventoryService.saveInventory(selectedChat.chat_id, inventoryData);
            setInventory(updatedInventory);
        } catch (error) {
            console.error('Ошибка при удалении товара:', error);
            throw error;
        }
    };

    if (isLoading) {
        // Если чат не выбран, значит загружаем список чатов
        if (!selectedChat) {
            return <LoadingSpinner text="Загрузка списка чатов..." />;
        }
        // Если чат выбран, значит загружаем данные инвентаризации
        return <LoadingSpinner text="Загрузка данных инвентаризации..." />;
    }

    return (
        <AnimatePresence mode="wait">
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
                {!selectedChat ? (
                    <>
                        <ChatSelector 
                            chats={chats} 
                            onSelect={handleChatSelect} 
                            isLoading={isLoading}
                        />
                        {error && (
                            <motion.div 
                                className={styles.error}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                {error}
                            </motion.div>
                        )}
                    </>
                ) : (
                    <motion.div 
                        className={styles.inventoryContent}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                    >
                        <motion.div 
                            className={styles.header}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <motion.h2 
                                className={styles.headerTitle}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                data-text={getHeaderTitle()}
                            >
                                {getHeaderTitle()}
                            </motion.h2>
                            <motion.div 
                                className={styles.progress}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <motion.div 
                                    className={styles.progressBar}
                                    style={{ width: `${progress}%` }}
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                >
                                    {progress}%
                                </motion.span>
                            </motion.div>
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {!selectedCategory ? (
                                <CategoryGrid
                                    key="categories"
                                    categories={categories}
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
                                    onDeleteItem={handleDeleteItem}
                                />
                            ) : (
                                <ItemOptions
                                    key="options"
                                    types={types}
                                    values={inventory[selectedCategory][selectedItem]}
                                    onChange={handleQuantityChange}
                                    selectedCategory={selectedCategory}
                                    selectedItem={selectedItem}
                                />
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {selectedChat && (
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
                        animate={{
                            y: [100, 0],
                            opacity: [0, 1]
                        }}
                        transition={{ 
                            type: "spring",
                            stiffness: 300,
                            damping: 30
                        }}
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default Inventory; 