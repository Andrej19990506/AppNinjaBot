import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
    fetchInventory, 
    selectChat, 
    clearSelectedChat, 
    initializeFromTelegram, 
    fetchChatInventory,
    setSelectedItem
} from '../../store/slices/inventorySlice';
import { useWebSocket } from '../../hooks/useWebSocket';
import ChatList from './ChatList';
import ChatModal from './ChatModal';
import CategoryGrid from './CategoryGrid';
import ItemList from './ItemList';
import ItemHistory from '../ItemHistory/ItemHistory';
import ItemEdit from './ItemEdit';
import InventoryCompleteDialog from '../InventoryCompleteDialog';
import styles from './Inventory.module.css';
import { Inventory as InventoryType, ChatInventory, InventoryItem } from '../../types/inventory';
import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';
import Header from './Header';
import Footer from './Footer';
import Skeleton from '../common/Skeleton';
import InventorySearch, { normalizeString } from './InventorySearch';
import SearchResultsDropdown from './SearchResultsDropdown';

// Интерфейс для результатов поиска
interface SearchResult {
  category: string;
  itemId: string;
  item: InventoryItem;
  matches: {
    field: string;
    value: string;
  }[];
}

const Inventory: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { chatId } = useParams<{ chatId?: string }>();
    const { items, isLoading: isInventoryLoading, error, selectedChat, currentUser } = useAppSelector(state => state.inventory);
    const isInitialized = useRef<boolean>(false);
    const location = useLocation();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [itemHistory, setItemHistory] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<Array<{ id: string; type: string; message?: string; title?: string }>>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    
    // Состояние для глобального поиска
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    
    // Новые состояния для поддержки выпадающего списка поиска и истории
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        // Загружаем историю поиска из localStorage при инициализации
        try {
            const savedHistory = localStorage.getItem('inventorySearchHistory');
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch (e) {
            console.error('Ошибка загрузки истории поиска:', e);
            return [];
        }
    });
    
    // Сохраняем историю поиска в localStorage при её изменении
    useEffect(() => {
        try {
            localStorage.setItem('inventorySearchHistory', JSON.stringify(searchHistory));
        } catch (e) {
            console.error('Ошибка сохранения истории поиска:', e);
        }
    }, [searchHistory]);
    
    // Получаем список категорий
    const categories = useMemo(() => {
        if (!selectedChat?.inventory) return [];
        return Object.keys(selectedChat.inventory);
    }, [selectedChat?.inventory]);

    // Получаем инвентарь
    const inventory = useMemo(() => {
        return selectedChat?.inventory || {};
    }, [selectedChat?.inventory]);

    // Определяем, находимся ли мы на странице списка чатов
    const isListPage = useMemo(() => location.pathname === '/inventory', [location.pathname]);
    
    // Получаем WebSocket методы
    const { joinRoom, leaveRoom } = useWebSocket();

    // Мемоизируем обработчики
    const handleChatClick = useCallback((chatId: string, chat: ChatInventory) => {
        if (isListPage) {
            dispatch(selectChat(chatId));
        }
    }, [dispatch, isListPage]);

    const handleCloseModal = useCallback(() => {
        sessionStorage.removeItem('wasKickedFromInventory');
        dispatch(clearSelectedChat());
    }, [dispatch]);

    const handleStartInventory = useCallback(() => {
        if (selectedChat && currentUser.isAdmin) {
            navigate(`/inventory/${selectedChat.chat_id}`);
        }
    }, [navigate, selectedChat, currentUser.isAdmin]);

    const handleCategorySelect = (category: string) => {
        console.log('Category selected:', category);
        console.log('Inventory data:', selectedChat?.inventory);
        setSelectedCategory(category);
        setSelectedItem(null);
    };

    const handleItemSelect = (itemId: string) => {
        console.log('Item selected:', itemId);
        setSelectedItem(itemId);
    };

    // Эффект для инициализации приложения
    useEffect(() => {
        let isMounted = true;

        const initializeApp = async () => {
            if (!isInitialized.current) {
                console.debug('🔍 Inventory Debug - Начало инициализации:', {
                    timestamp: new Date().toISOString(),
                    chatId,
                    isInitialized: isInitialized.current,
                    currentUserId: currentUser.id
                });

                try {
                    // Инициализируем пользователя
                    await dispatch(initializeFromTelegram()).unwrap();
                    console.debug('🔍 Inventory Debug - Пользователь инициализирован:', {
                        currentUser
                    });

                    // Загружаем инвентарь
                    if (isMounted) {
                        console.debug('🔍 Inventory Debug - Загрузка списка чатов');
                        const inventory = await dispatch(fetchInventory()).unwrap();
                        console.debug('🔍 Inventory Debug - Список чатов загружен:', {
                            chatsCount: inventory.length
                        });

                        if (chatId && isMounted) {
                            console.debug('🔍 Inventory Debug - Проверка доступа к чату:', {
                                chatId,
                                foundChat: inventory.find(c => c.chat_id === chatId)
                            });

                            const chat = inventory.find(c => c.chat_id === chatId);
                            if (!chat || !chat.admins.some(admin => admin.user_id === currentUser.id)) {
                                console.debug('🔍 Inventory Debug - Нет доступа к чату, возврат к списку');
                                dispatch(selectChat(chatId));
                                navigate('/inventory');
                                return;
                            }

                            console.debug('🔍 Inventory Debug - Загрузка инвентаря чата:', chatId);
                            await dispatch(fetchChatInventory(chatId)).unwrap();
                            dispatch(selectChat(chatId));
                        }

                        isInitialized.current = true;
                        console.debug('🔍 Inventory Debug - Инициализация завершена');
                    }
                } catch (error) {
                    console.error('🔍 Inventory Debug - Ошибка при инициализации:', {
                        error,
                        chatId,
                        currentUser
                    });
                }
            }
        };

        initializeApp();

        return () => {
            console.debug('🔍 Inventory Debug - Компонент размонтирован');
            isMounted = false;
        };
    }, [dispatch, chatId, currentUser.id, navigate]);

    // Эффект для отслеживания изменений currentUser и selectedChat
    useEffect(() => {
        if (!currentUser.id) return;

        // Если мы на странице инвентаризации и пользователь потерял права админа
        if (chatId && !currentUser.isAdmin) {
            console.debug('⚠️ Потеря прав администратора в инвентаризации:', {
                chatId,
                currentPath: location.pathname
            });

            // Сохраняем ID чата для отображения уведомления
            sessionStorage.setItem('wasKickedFromInventory', chatId);

            // Если мы находимся на странице инвентаризации, возвращаемся к списку
            if (location.pathname.includes(`/inventory/${chatId}`)) {
                dispatch(selectChat(chatId));
                navigate('/inventory');
            }
            return;
        }

        // Если нет выбранного чата, выходим
        if (!selectedChat) return;

        const userInfo = {
            id: currentUser.id,
            first_name: currentUser.first_name,
            photo_url: currentUser.photo_url,
            isAdmin: selectedChat.admins.some(admin => admin.user_id === currentUser.id)
        };

        joinRoom(selectedChat.chat_id, userInfo);

        return () => {
            leaveRoom(selectedChat.chat_id, {
                ...userInfo,
                isAdmin: currentUser.isAdmin
            });
        };
    }, [currentUser.id, currentUser.isAdmin, selectedChat, chatId, joinRoom, leaveRoom, dispatch, navigate, location.pathname]);

    // Эффект для загрузки инвентаря
    useEffect(() => {
        if (chatId && currentUser.id) {
            console.log('=== LOADING INVENTORY ===');
            console.log('Chat ID:', chatId);
            console.log('Current User:', currentUser);
            
            dispatch(fetchChatInventory(chatId))
                .unwrap()
                .then(result => {
                    console.log('Inventory loaded successfully:', result);
                })
                .catch(error => {
                    console.error('Failed to load inventory:', error);
                });
        }
    }, [chatId, currentUser.id, dispatch]);

    // Периодическое обновление списка чатов
    useEffect(() => {
        if (!isInitialized.current) return;

        const updateInterval = setInterval(() => {
            if (!chatId) { // Обновляем только если не находимся в инвентаре
                dispatch(fetchInventory());
            }
        }, 30000);

        return () => clearInterval(updateInterval);
    }, [dispatch, chatId]);

    // Эффект для отслеживания прогресса инвентаризации
    useEffect(() => {
        if (selectedChat?.metadata?.progress === 100 && chatId) {
            setShowCompleteDialog(true);
        }
    }, [selectedChat?.metadata?.progress, chatId]);

    // Функция для получения заголовка
    const getHeaderTitle = useCallback(() => {
        if (!selectedChat) return 'Инвентарь';
        if (!selectedCategory) return selectedChat.chat_title;
        if (!selectedItem) return `${selectedChat.chat_title} - ${selectedCategory}`;
        return `${selectedChat.chat_title} - ${selectedItem}`;
    }, [selectedChat, selectedCategory, selectedItem]);

    // Функция для закрытия уведомления
    const handleNotificationClose = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setHasUnreadNotifications(false);
    }, []);

    // Обработчик возврата назад
    const handleBack = useCallback(() => {
        if (selectedItem) {
            setSelectedItem(null);
            dispatch({ type: 'inventory/setSelectedItem', payload: null });
        } else if (selectedCategory) {
            setSelectedCategory(null);
        }
    }, [selectedItem, selectedCategory, dispatch]);

    const handleCloseCompleteDialog = useCallback(() => {
        setShowCompleteDialog(false);
    }, []);

    // Функция для глобального поиска по инвентарю
    const handleSearch = useCallback((query: string) => {
        if (!selectedChat?.inventory || query.length < 2) {
            setSearchResults([]);
            return;
        }
        
        setIsSearching(true);
        setSearchQuery(query); // Устанавливаем значение поискового запроса
        
        console.log('🔍 Начинаем поиск по запросу:', query);
        
        setTimeout(() => {
            const normalizedQuery = normalizeString(query);
            const results: SearchResult[] = [];
            
            // Поиск по всем категориям и товарам
            Object.entries(selectedChat.inventory).forEach(([category, items]) => {
                Object.entries(items).forEach(([itemId, item]) => {
                    const matches: { field: string; value: string }[] = [];
                    
                    // Поиск в названии товара
                    if (normalizeString(itemId).includes(normalizedQuery)) {
                        matches.push({ field: 'name', value: itemId });
                        console.log(`✅ Найдено совпадение в названии: "${itemId}" в категории "${category}"`);
                    }
                    
                    // Поиск в описании товара, если оно есть
                    if (item.raw.description) {
                        const description = item.raw.description;
                        if (normalizeString(description).includes(normalizedQuery)) {
                            matches.push({ field: 'description', value: description });
                            console.log(`✅ Найдено совпадение в описании товара "${itemId}"`);
                        }
                    }
                    
                    // Если есть совпадения, добавляем в результаты
                    if (matches.length > 0) {
                        results.push({
                            category,
                            itemId,
                            item,
                            matches
                        });
                    }
                });
            });
            
            console.log(`🔎 Результаты поиска: найдено ${results.length} совпадений`);
            if (results.length > 0) {
                console.log('📋 Первый результат:', {
                    category: results[0].category,
                    itemId: results[0].itemId,
                    matches: results[0].matches
                });
            }
            
            setSearchResults(results);
            setIsSearching(false);
            
            // Добавляем запрос в историю поиска, если его там еще нет и есть результаты
            if (results.length > 0 && !searchHistory.includes(query)) {
                setSearchHistory(prev => [query, ...prev].slice(0, 5)); // Ограничиваем историю 5 элементами
                console.log('📝 Запрос добавлен в историю поиска');
            }
        }, 300); // Небольшая задержка для улучшения UX
    }, [selectedChat?.inventory, searchHistory]);
    
    // Очистка поиска
    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
    }, []);
    
    // Функция для обработки изменения состояния фокуса поиска
    const handleSearchFocusChange = useCallback((isFocused: boolean) => {
        console.log(`🔍 Изменение состояния фокуса поиска: ${isFocused ? 'в фокусе' : 'не в фокусе'}`);
        setIsSearchFocused(isFocused);
        
        // Если фокус пропал и есть поисковый запрос, сохраняем результаты для выпадающего списка,
        // но очищаем для основного списка
        if (!isFocused && searchQuery) {
            console.log('🔍 Фокус снят, сохраняем результаты только для выпадающего списка');
        }
    }, [searchQuery]);
    
    // Функция для перехода к товару из результатов поиска
    const handleSearchResultSelect = useCallback((category: string, itemId: string) => {
        console.log(`🔍 Выбран результат поиска: ${itemId} в категории ${category}`);
        setSelectedCategory(category);
        setSelectedItem(itemId);
        setIsSearchFocused(false); // Скрываем выпадающий список после выбора
        handleClearSearch();
    }, []);
    
    // Функция для работы с историей поиска
    const handleHistoryItemSelect = useCallback((query: string) => {
        handleSearch(query);
    }, [handleSearch]);

    if (isInventoryLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingWrapper}>
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                        <div key={item} className={styles.skeletonItem}>
                            <Skeleton 
                                variant="rectangular" 
                                className={styles.skeletonHeader}
                                animation="wave"
                            />
                            <div className={styles.skeletonContent}>
                                <Skeleton 
                                    variant="text" 
                                    className={styles.skeletonText}
                                    animation="wave"
                                />
                                <Skeleton 
                                    variant="text" 
                                    className={styles.skeletonText}
                                    animation="wave"
                                />
                                <Skeleton 
                                    variant="text" 
                                    className={styles.skeletonText}
                                    animation="wave"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.errorWrapper}>
                    <p className={styles.errorMessage}>{error}</p>
                    <button className={styles.retryButton} onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Если мы на странице инвентаризации
    if (chatId && selectedChat) {
        console.log('=== ИНВЕНТАРЬ ===');
        console.log(`Чат: ${selectedChat.chat_title} (${chatId})`);
        if (selectedChat.inventory) {
            console.log(`Категорий: ${Object.keys(selectedChat.inventory).length}`);
            if (selectedCategory) {
                const items = selectedChat.inventory[selectedCategory] || {};
                console.log(`Выбрана категория: ${selectedCategory} (${Object.keys(items).length} товаров)`);
                if (selectedItem) {
                    const item = items[selectedItem];
                    console.log(`Выбран товар: ${selectedItem}`);
                    console.log(`- Сырье: ${item.raw.quantity} ${item.raw.filled ? '(заполнено)' : '(не заполнено)'}`);
                    if (item.semifinished) {
                        console.log(`- Полуфабрикат: ${item.semifinished.quantity} ${item.semifinished.filled ? '(заполнено)' : '(не заполнено)'}`);
                    }
                }
            }
        } else {
            console.log('Инвентарь пуст');
        }
        console.log('================');

        // Проверяем, что inventory существует и не пустой
        const hasValidInventory = selectedChat.inventory && 
            typeof selectedChat.inventory === 'object' && 
            Object.keys(selectedChat.inventory).length > 0;

        return (
            <div className={styles.container}>
                <Header 
                    title={getHeaderTitle()}
                    progress={selectedChat?.metadata?.progress || 0}
                    notifications={notifications}
                    hasUnreadNotifications={hasUnreadNotifications}
                    onNotificationClose={handleNotificationClose}
                />
                <div className={styles.content}>
                    {hasValidInventory ? (
                        <motion.div 
                            className={styles.mainSection}
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30,
                                mass: 0.8
                            }}
                        >
                            {!selectedItem && (
                                <div className={`${styles.searchContainer} ${isSearchFocused ? styles.searchActive : ''}`}>
                                    <InventorySearch 
                                        onSearch={handleSearch}
                                        isSearching={isSearching}
                                        searchResults={searchResults}
                                        onClearSearch={handleClearSearch}
                                        onFocusChange={handleSearchFocusChange}
                                    />
                                    
                                    <SearchResultsDropdown
                                        isVisible={isSearchFocused}
                                        searchQuery={searchQuery}
                                        searchResults={searchResults}
                                        isSearching={isSearching}
                                        searchHistory={searchHistory}
                                        onSelectResult={handleSearchResultSelect}
                                        onSelectHistoryItem={handleHistoryItemSelect}
                                    />
                                </div>
                            )}
                            
                            {/* Отображаем контент всегда, чтобы выпадающий список накладывался поверх */}
                            <div className={isSearchFocused && searchQuery ? styles.contentBlurred : ''} style={{ overflow: 'visible', minHeight: '60vh' }}>
                                {!selectedCategory ? (
                                    <CategoryGrid
                                        key="categories"
                                        categories={categories}
                                        onSelect={handleCategorySelect}
                                        inventory={inventory}
                                        selectedCategory={selectedCategory}
                                    />
                                ) : !selectedItem ? (
                                    <ItemList
                                        key="items"
                                        category={selectedCategory}
                                        items={inventory[selectedCategory] || {}}
                                        onSelect={handleItemSelect}
                                        chatId={selectedChat.chat_id}
                                        searchQuery={searchQuery}
                                        searchResults={searchResults}
                                        onSearchResultSelect={handleSearchResultSelect}
                                    />
                                ) : (
                                    <motion.div
                                        key={`${selectedCategory}-${selectedItem}`}
                                        className={styles.itemEditContainer}
                                        initial={{ opacity: 0, y: 50 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 50 }}
                                    >
                                        
                                            <ItemEdit
                                                category={selectedCategory}
                                                itemId={selectedItem}
                                                item={inventory[selectedCategory][selectedItem]}
                                                onClose={() => {
                                                    setSelectedCategory(null);
                                                    dispatch({ type: 'inventory/setSelectedItem', payload: null });
                                                }}
                                                onUpdate={() => {
                                                    console.log('Item updated');
                                                }}
                                                chatId={selectedChat.chat_id}
                                            />
                                            
                                            {/* Блок истории рендерится всегда, но на мобильных скрыт через CSS и отображается как FAB */}
                                        
                                                <ItemHistory
                                                    itemId={selectedItem}
                                                    itemName={selectedItem}
                                                    category={selectedCategory}
                                                    className={styles.itemHistory}
                                                />
                                            
                                        
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <div className={styles.loadingWrapper}>
                            <div className={styles.loadingSpinner} />
                            <p>Loading inventory data...</p>
                        </div>
                    )}
                </div>
                <Footer 
                    selectedChat={selectedChat}
                    selectedCategory={selectedCategory || undefined}
                    selectedItem={selectedItem || undefined}
                    onBack={handleBack}
                    onChatSelect={() => navigate('/inventory')}
                />
                <InventoryCompleteDialog
                    isOpen={showCompleteDialog}
                    onClose={handleCloseCompleteDialog}
                    inventoryData={selectedChat}
                    chatId={selectedChat.chat_id}
                />
            </div>
        );
    }

    // Иначе показываем список чатов
    return (
        <div className={styles.container}>
            <ChatList 
                chats={items}
                onChatSelect={handleChatClick}
            />
            {isListPage && selectedChat && (
                <ChatModal
                    chat={selectedChat}
                    open={selectedChat !== null}
                    onClose={handleCloseModal}
                    onStartInventory={handleStartInventory}
                    isAdmin={currentUser.isAdmin}
                    wasKickedFromInventory={sessionStorage.getItem('wasKickedFromInventory') === selectedChat.chat_id}
                />
            )}
        </div>
    );
};

export default Inventory; 