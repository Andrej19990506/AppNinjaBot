import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import ChatSelector from '@shared/components/ChatSelector/ChatSelector';
import CategoryGrid from '@features/Inventory/CategoryGrid';
import ItemList from '@features/Inventory/ItemList';
import ItemHistory from '@features/Inventory/ItemHistory/ItemHistory';
import ItemEdit from '@features/Inventory/ItemEdit';
import OutOfStockConfirmModal from '@features/Inventory/OutOfStockConfirmModal';
import { InventoryCompleteDrawer } from '@features/Inventory/components/InventoryCompleteDrawer';
import TemplateChangesModal from '@features/Inventory/components/TemplateChangesModal';
import Header from '@features/Inventory/Header';
import styles from '@features/Inventory/Inventory.module.css';
import { InventoryItem } from '@/types/inventoryTypes';
import { motion, AnimatePresence } from 'framer-motion';
import Footer from '@features/Inventory/Footer';
import { ChatListSkeleton } from '@shared/components/Skeleton/Skeleton';
import SearchResultsDropdown from '@features/Inventory/SearchResultsDropdown';
import axios from 'axios';
import config from '@/config';
import { useInventoryWebSocketSync } from '@features/Inventory/hooks/useInventoryWebSocketSync';
import { socketService } from '@shared/services/socketService';
import styled from 'styled-components';

// Импортируем необходимые хуки
import { useInventoryLoader } from '@features/Inventory/hooks/useInventoryLoader';
import { useInventoryNavigation } from '@features/Inventory/hooks/useInventoryNavigation';
import { useInventorySearch } from '@features/Inventory/hooks/useInventorySearch';
import { useInventoryView } from '@features/Inventory/hooks/useInventoryView';
import { useUserActivity } from '@shared/hooks/useUserActivity';
import { fetchChatInventory, selectCategoriesForSelectedChat, selectHistoryRecordsForItem} from '@/store/slices/inventorySlice';
import ItemAnalytics from '@features/Inventory/components/ItemAnalytics/ItemAnalytics';
import { ActiveUsersDrawer } from '@features/Inventory/components/ActiveUsersPanel/ActiveUsersDrawer';
import SlidingDrawer from '@shared/components/SlidingDrawer/SlidingDrawer';
import { ConnectionStatusPanel } from '@shared/components/ConnectionStatusPanel';
import { inventoryNotificationService } from '@shared/services/inventoryNotificationService';

// Добавляем интерфейс для преобразования ChatInventory в Chat
interface Chat {
    id: string;
    name: string;
    type: 'group' | 'supergroup' | 'private';
    created_at: string;
    updated_at: string;
}

// Styled component для контейнера поиска
const SearchContainer = styled.div`
  position: relative; /* Ключевое свойство для позиционирования дропдауна */
  z-index: 1001; /* Выше основного контента, но ниже возможных модальных окон */
  margin-bottom: 16px; /* Отступ снизу */
`;

const Inventory: React.FC = () => {
    // --- 1. Инициализация хуков React и Router ---
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { chatId } = useParams<{ chatId?: string }>();

    // --- 2. Инициализация селекторов Redux ---
    const { items: inventoryItems, selectedChat } = useAppSelector(state => state.inventory);
    const currentUser = useAppSelector(state => state.user.user);
    const activeRole = useAppSelector(state => state.user.activeRole);
    const categories = useAppSelector(selectCategoriesForSelectedChat);
    
    // --- 3. Инициализация состояния компонента (useState) ---
    const [notifications, setNotifications] = useState<Array<{ id: string; type: string; message?: string; title?: string }>>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [analyticsData, setAnalyticsData] = useState<{category: string, itemId: string} | null>(null);
    const [isActiveUsersDrawerOpen, setIsActiveUsersDrawerOpen] = useState(false);
    const [activeUsersCount, setActiveUsersCount] = useState(0);
    const [showOutOfStockConfirm, setShowOutOfStockConfirm] = useState(false);
    const [pendingOutOfStockData, setPendingOutOfStockData] = useState<{
        category: string;
        itemId: string;
        itemName: string;
        type: 'raw' | 'semifinished';
        onConfirm: () => void;
    } | null>(null);
    
    // Селектор для данных истории (после инициализации analyticsData)
    const historyData = useAppSelector(state => 
        analyticsData ? selectHistoryRecordsForItem(analyticsData.itemId)(state) : []
    );
    
    // --- 4. Инициализация кастомных хуков ---
    const {
        isLoading: isInventoryLoading,
        error: loaderError,
        loadingProgress
    } = useInventoryLoader({
        chatId: chatId,
        currentUserId: currentUser?.id || null,
        role: activeRole
    });
    
    const {
        selectedCategory,
        selectedItem,
        handleCategorySelect,
        handleItemSelect,
        handleBack
    } = useInventoryNavigation({
        onNavigate: (category, item) => {
            // Navigation callback
        }
    });
    
    // <<< ВЫЗЫВАЕМ ХУК БЕЗ АРГУМЕНТА >>>
    const {
        templateChanges,
        isChangesModalOpen,
        closeChangesModal,
        checkForUnviewedTemplateChanges
    } = useInventoryWebSocketSync(); 

    // Хук для отслеживания активности пользователя (30 секунд неактивности)
    const userActivity = useUserActivity(30000);
    
    const {
        searchQuery,
        isSearching,
        searchResults,
        isSearchFocused,
        searchHistory,
        handleSearch,
        handleClearSearch,
        handleSearchFocusChange,
        handleSearchResultSelect: handleSearchResultSelectFromHook,
        handleHistoryItemSelect
    } = useInventorySearch({
        inventory: selectedChat?.inventory,
        onSelectResult: (category, itemId) => {
            handleCategorySelect(category);
            handleItemSelect(itemId);
            // handleSearchFocusChange будет доступен после вызова useInventorySearch
        }
    });
    
    // Мемоизируем callback для onSelectResult после получения handleSearchFocusChange
    const handleSearchResultSelect = useCallback((category: string, itemId: string) => {
        handleCategorySelect(category);
        handleItemSelect(itemId);
        handleSearchFocusChange(false);
    }, [handleCategorySelect, handleItemSelect, handleSearchFocusChange]);
    
    // Placeholder for useInventoryView - will be moved after function definitions
    let currentView: () => JSX.Element;
    let hasValidInventory: () => boolean;

    // --- 5. Инициализация useEffect хуков ---
    useEffect(() => {
        // Эффект для показа диалога завершения
        if (selectedChat?.metadata?.progress === 100 && chatId) {
            setShowCompleteDialog(true);
        }
    }, [selectedChat?.metadata?.progress, chatId]);

    // --- НОВЫЙ useEffect для обработки удаления редактируемого товара ---
    useEffect(() => {
        // Запускаем проверку только если выбран товар (т.е. мы в режиме редактирования/деталей)
        if (selectedCategory && selectedItem && selectedChat?.inventory) {
            const categoryExists = selectedChat.inventory[selectedCategory];
            const itemExists = categoryExists?.[selectedItem];

            // Если товар или даже категория исчезли из актуального инвентаря
            if (!categoryExists || !itemExists) {
                console.warn(`[Inventory Effect] Currently selected item ${selectedCategory}/${selectedItem} no longer exists in inventory. Navigating back.`);
                handleBack(); // Вызываем возврат к списку товаров
            }
        }
    }, [selectedItem, selectedCategory, selectedChat?.chat_id, handleBack]); // Используем chat_id вместо inventory
    // --- КОНЕЦ НОВОГО useEffect ---

    // --- useEffect для проверки непросмотренных изменений шаблона при загрузке ---
    useEffect(() => {
        if (selectedChat?.chat_id && !isInventoryLoading) {
            console.log('[Inventory Effect] Проверяем непросмотренные изменения шаблона для чата:', selectedChat.chat_id);
            checkForUnviewedTemplateChanges(selectedChat.chat_id);
        }
    }, [selectedChat?.chat_id, isInventoryLoading, checkForUnviewedTemplateChanges]);
    // --- КОНЕЦ useEffect для проверки изменений шаблона ---

    // Отправляем фокус категории при выборе/снятии
    useEffect(() => {
        if (!selectedChat?.chat_id) return;
        if (selectedCategory) {
            const user = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
            const userInfo = user ? { userId: user.id, first_name: user.first_name } : undefined;
            socketService.emit('category_focus', { chat_id: selectedChat.chat_id, category: selectedCategory, focusing: true, user_info: userInfo });
        }
        return () => {
            if (selectedChat?.chat_id && selectedCategory) {
                socketService.emit('category_focus', { chat_id: selectedChat.chat_id, category: selectedCategory, focusing: false });
            }
        };
    }, [selectedChat?.chat_id, selectedCategory]);

    // --- useEffect для отладки WebSocket соединения ---
    useEffect(() => {
        if (!chatId) return;

        const roomName = `inventory_${chatId}`;
        
        // Функция для проверки состояния WebSocket соединения
        const checkWebSocketStatus = () => {
            const isConnected = socketService.isConnected();
            console.log(`🔌 [WebSocket Debug] Состояние соединения:`, {
                isConnected,
                roomName,
                chatId,
                timestamp: new Date().toISOString()
            });
            
            if (isConnected) {
                // Запрашиваем информацию о комнате
                socketService.emit('get_room_users', { room: roomName });
            } else {
                console.warn(`⚠️ [WebSocket Debug] WebSocket не подключен для комнаты ${roomName}`);
            }
        };

        // Проверяем состояние при монтировании
        checkWebSocketStatus();
        
        // Проверяем каждые 30 секунд
        const interval = setInterval(checkWebSocketStatus, 30000);
        
        return () => {
            clearInterval(interval);
        };
    }, [chatId]);

    // --- useEffect для отслеживания активных пользователей ---
    useEffect(() => {
        if (!chatId) return;

        const handleRoomUsers = (data: any) => {
            if (data.room === `inventory_${chatId}`) {
                setActiveUsersCount(data.users.length);
                console.log(`👥 [Inventory] Активных пользователей в комнате: ${data.users.length}`, data.users);
            }
        };

        const handleUserJoined = (data: any) => {
            if (data.room === `inventory_${chatId}`) {
                setActiveUsersCount(prev => prev + 1);
                console.log(`👤 [Inventory] Пользователь присоединился: ${data.first_name} (${data.userId})`);
            }
        };

        const handleUserLeft = (data: any) => {
            if (data.room === `inventory_${chatId}`) {
                setActiveUsersCount(prev => Math.max(0, prev - 1));
                console.log(`👤 [Inventory] Пользователь покинул: ${data.first_name} (${data.userId})`);
            }
        };

        // Проверяем подключение к WebSocket комнате
        const checkWebSocketConnection = () => {
            const roomName = `inventory_${chatId}`;
            console.log(`🔍 [Inventory] Проверяем подключение к комнате: ${roomName}`);
            
            // Запрашиваем текущий список пользователей
            socketService.emit('get_room_users', { room: roomName });
            
            // Проверяем через 2 секунды еще раз для надежности
            setTimeout(() => {
                socketService.emit('get_room_users', { room: roomName });
            }, 2000);
        };

        // Подписываемся на события
        const unsubscribeRoomUsers = socketService.subscribe('room_users_list', handleRoomUsers);
        const unsubscribeUserJoined = socketService.subscribe('user_joined_room', handleUserJoined);
        const unsubscribeUserLeft = socketService.subscribe('user_left_room', handleUserLeft);

        // Инициализируем сервис уведомлений о входе/выходе пользователей
        inventoryNotificationService.init();

        // Проверяем подключение при монтировании
        checkWebSocketConnection();

        return () => {
            unsubscribeRoomUsers();
            unsubscribeUserJoined();
            unsubscribeUserLeft();
            inventoryNotificationService.destroy();
        };
    }, [chatId]);
    // --- КОНЕЦ useEffect для активных пользователей ---

    // --- 6. Инициализация useCallback хуков ---
    const getHeaderTitle = useCallback(() => {
        const chat = inventoryItems.find(item => item.chat_id === chatId);
        if (!chat) return 'Инвентарь';
        if (!selectedCategory) return chat.chat_title;
        if (!selectedItem) return selectedCategory;
        return selectedItem;
    }, [inventoryItems, chatId, selectedCategory, selectedItem]);

    const handleNotificationClose = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setHasUnreadNotifications(false);
    }, []);

    const handleCloseCompleteDialog = useCallback(() => {
        setShowCompleteDialog(false);
    }, []);

    const handleResetInventory = useCallback(async (chatIdParam: string): Promise<void> => {
        try {
            await axios.post(`${config.API_URL}/inventory/${chatIdParam}/reset`);
            await dispatch(fetchChatInventory(chatIdParam));
        } catch (error) {
            console.error('Ошибка при сбросе инвентаризации:', error);
            throw error;
        }
    }, [dispatch]);

    // Wrap onHomeClick in useCallback
    const handleHomeClick = useCallback(() => {
        navigate('/');
    }, [navigate]);

    const handleShowAnalytics = useCallback((category: string, itemId: string) => {
        setAnalyticsData({ category, itemId });
        setIsAnalyticsOpen(true);
    }, []);

    const handleCloseAnalytics = useCallback(() => {
        setIsAnalyticsOpen(false);
        setAnalyticsData(null);
    }, []);

    // Функции для управления модальным окном подтверждения "Нет в наличии"
    const handleOutOfStockConfirm = useCallback((category: string, itemId: string, itemName: string, type: 'raw' | 'semifinished', onConfirm: () => void) => {
        setPendingOutOfStockData({ category, itemId, itemName, type, onConfirm });
        setShowOutOfStockConfirm(true);
    }, []);

    const handleOutOfStockConfirmCancel = useCallback(() => {
        setShowOutOfStockConfirm(false);
        setPendingOutOfStockData(null);
    }, []);

    const handleOutOfStockConfirmSubmit = useCallback(() => {
        if (!pendingOutOfStockData) return;
        
        console.log('Подтверждено пометить товар как "нет в наличии":', pendingOutOfStockData);
        
        // Вызываем реальное действие
        pendingOutOfStockData.onConfirm();
        
        // Закрываем модальное окно
        setShowOutOfStockConfirm(false);
        setPendingOutOfStockData(null);
    }, [pendingOutOfStockData]);

    const handleActiveUsersClick = useCallback(() => {
        setIsActiveUsersDrawerOpen(prev => !prev);
    }, []);

    const handleCloseActiveUsersDrawer = useCallback(() => {
        setIsActiveUsersDrawerOpen(false);
    }, []);

    const handleCompleteClick = useCallback(() => {
        setShowCompleteDialog(prev => !prev);
    }, []);

    // --- 7. Инициализация useInventoryView после всех функций ---
    const { 
        currentView: currentViewFromHook, 
        hasValidInventory: hasValidInventoryFromHook
    } = useInventoryView({
        selectedCategory,
        selectedItem,
        inventory: selectedChat?.inventory || {},
        searchActive: false,
        isLoading: isInventoryLoading,
        renderCategories: useCallback(() => (
            <CategoryGrid
                key="categories"
                categories={categories as string[]}
                onSelect={handleCategorySelect}
                inventory={selectedChat?.inventory || {}}
                selectedCategory={selectedCategory}
            />
        ), [categories, handleCategorySelect, selectedChat?.inventory, selectedCategory]),
        renderItems: useCallback((category) => (
            <ItemList
                key={`items-${category}`}
                category={category}
                items={selectedChat?.inventory?.[category] || {}}
                onSelect={handleItemSelect}
                chatId={selectedChat?.chat_id || ''}
                searchQuery={searchQuery}
                searchResults={searchResults}
                onSearchResultSelect={(cat, item) => {
                    handleSearchResultSelect(cat, item);
                }}
            />
        ), [selectedChat?.inventory, selectedChat?.chat_id, handleItemSelect, searchQuery, searchResults, handleSearchResultSelect]),
        renderItemDetail: useCallback((category, itemId) => (
            <motion.div>
                <ItemEdit
                    category={category}
                    itemId={itemId}
                    item={selectedChat?.inventory?.[category]?.[itemId] || {} as InventoryItem}
                    onClose={handleBack}
                    onUpdate={() => {
                        console.log('Item updated');
                    }}
                    chatId={selectedChat?.chat_id || ''}
                    onShowAnalytics={() => handleShowAnalytics(category, itemId)}
                    onOutOfStockConfirm={handleOutOfStockConfirm}
                />
                
                <ItemHistory
                    itemId={itemId}
                    itemName={itemId}
                    category={category}
                    className={styles.itemHistory}
                />
            </motion.div>
        ), [selectedChat?.inventory, selectedChat?.chat_id, handleBack, handleShowAnalytics, handleOutOfStockConfirm])
    });

    // Assign the values to the variables declared earlier
    currentView = currentViewFromHook;
    hasValidInventory = hasValidInventoryFromHook;

    // --- 8. Прочие переменные и вычисления ---
    const error = loaderError; // Теперь error берется только из loader

    const memoizedChats = useMemo(() => {
        return inventoryItems.map(chat => ({
            chat_id: chat.chat_id,
            chat_title: chat.chat_title,
            admins: chat.admins || [],
            members: chat.members,
            inventory: chat.inventory,
            metadata: {
                progress: chat.metadata?.progress || 0,
                lastUpdated: chat.metadata?.lastUpdated || new Date().toISOString(),
                chat_id: chat.chat_id
            }
        }));
    }, [inventoryItems]);

    // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Добавляем очистку поиска при закрытии --- 
    const handleFooterSearchClick = useCallback(() => {
        if (isSearchFocused) {
            // Если клик происходит, когда поиск ОТКРЫТ (закрытие)
            handleSearchFocusChange(false);
            handleClearSearch(); // <<< Очищаем строку поиска
        } else {
            // Если клик происходит, когда поиск ЗАКРЫТ (открытие)
            handleSearchFocusChange(true);
        }
    }, [isSearchFocused, handleSearchFocusChange, handleClearSearch]);

    // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Обновляем условие для shouldShowSearch ---
    const shouldShowSearch = isSearchFocused; // Теперь видимость зависит ТОЛЬКО от фокуса

    // --- 8. Условный рендеринг (ранние возвраты) ---
    // Важно: Все хуки выше УЖЕ были вызваны к этому моменту

    // --- 8.1. Рендеринг для страницы выбора чата --- 
    if (!chatId) {
        if (isInventoryLoading) {
            return (
                <div className={styles.container}>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                        <ChatListSkeleton loadingProgress={loadingProgress} />
                    </motion.div>
                </div>
            );
        }
        if (error) {
             return (
                <div className={styles.container}>
                    <div className={styles.errorWrapper}>
                        <p className={styles.errorMessage}>{error}</p>
                        <button className={styles.retryButton} onClick={() => window.location.reload()}>Повторить</button>
                    </div>
                </div>
            );
        }
        // Рендеринг ChatSelector, если нет chatId и нет загрузки/ошибки
        console.log('[Inventory] Рендерим ChatSelector, так как chatId не найден в URL');
        return (
             <div className={styles.container}>
                <ChatSelector
                    chats={memoizedChats}
                    onResetInventory={handleResetInventory}
                    mode="inventory"
                    onHomeClick={handleHomeClick}
                />
            </div>
        );
    }

    // --- 8.2. Рендеринг для страницы ДЕТАЛЕЙ инвентаря (chatId есть) --- 
    if (isInventoryLoading) {
         console.log(`[Inventory] Показываем скелетон для chatId: ${chatId} (isInventoryLoading)`);
        return <div className={styles.container}><ChatListSkeleton loadingProgress={loadingProgress} /></div>;
    }
    if (error) {
        console.error(`[Inventory] Показываем ошибку для chatId: ${chatId}:`, error);
        return (
            <div className={styles.container}>
                <div className={styles.errorWrapper}>
                    <p className={styles.errorMessage}>{error}</p>
                    <button className={styles.retryButton} onClick={() => dispatch(fetchChatInventory(chatId))}>Повторить</button>
                </div>
            </div>
        );
    }
    

    const currentChatData = inventoryItems.find(item => item.chat_id === chatId);

    if (!currentChatData) {
        // Чат с таким ID еще не загружен или не существует в Redux store
        console.log(`[Inventory] Показываем заглушку: Чат ${chatId} не найден в inventoryItems. Ожидаем загрузки...`);
        // Показываем скелетон, пока данные для нужного чата не подгрузятся
        // useInventoryLoader должен был запустить fetchChatInventory
        return <div className={styles.container}><ChatListSkeleton loadingProgress={loadingProgress} /></div>;
    }

    // --- 9. Финальный рендеринг (детали инвентаря) --- 
    // Сюда мы попадаем, только если: chatId есть, загрузка завершена, ошибки нет,
    // currentChatData НАЙДЕН в inventoryItems, и hasValidInventory = true.
    
    if (!hasValidInventory()) {
        console.log(`[Inventory] Показываем заглушку: Чат ${currentChatData.chat_id} найден, но hasValidInventory=false (возможно, пустой инвентарь?).`);
        return <div className={styles.container}><p>Инвентарь для чата "{currentChatData.chat_title}" пуст или еще обрабатывается...</p></div>;
    }

    const chatForFooter = {
        id: currentChatData.chat_id,
        name: currentChatData.chat_title,
        type: 'group',
        created_at: currentChatData.metadata?.lastUpdated || '',
        updated_at: currentChatData.metadata?.lastUpdated || ''
    };

    return (
        <div className={styles.container}>
            <Header 
                title={getHeaderTitle()}
                progress={currentChatData.metadata?.progress || 0}
                notifications={notifications}
                hasUnreadNotifications={hasUnreadNotifications}
                onNotificationClose={handleNotificationClose}
            />
            

            
            <div className={styles.content}>
                {/* Контейнер для поиска, который будет позиционировать дропдаун */}
                <SearchContainer> 
                    <AnimatePresence>
                        {shouldShowSearch && (
                            <SearchResultsDropdown 
                                key="search-overlay" // Ключ важен для AnimatePresence
                                searchQuery={searchQuery} 
                                searchResults={searchResults} 
                                isSearching={isSearching} 
                                searchHistory={searchHistory} 
                                onSelectResult={handleSearchResultSelect} 
                                onSelectHistoryItem={handleHistoryItemSelect} 
                                
                                // Пропсы для внутреннего InventorySearch
                                onSearch={handleSearch}
                                isFocused={isSearchFocused} // Передаем управление фокусом
                                onClearSearch={handleClearSearch}
                                onFocusChange={handleSearchFocusChange}
                            />
                        )}
                    </AnimatePresence>
                </SearchContainer>

                {/* Основной контент рендерится всегда, но может быть под дропдауном */}
                <motion.div 
                    key="main-content" // Ключ все еще полезен для React
                    className={`${styles.mainSection} ${shouldShowSearch ? styles.contentBlurred : ''}`}
                    initial={false} // Отключаем initial анимацию для основного контента
                    animate={{ opacity: shouldShowSearch ? 0.6 : 1 }} // Приглушаем, если поиск активен
                    transition={{ duration: 0.2 }}
                >
                    <div className={styles.viewArea}> 
                        {currentView()} 
                    </div> 
                </motion.div>
            </div>
            <Footer 
                selectedChat={chatForFooter}
                selectedCategory={selectedCategory || undefined}
                selectedItem={selectedItem || undefined}
                onBack={handleBack}
                showInventorySearchButton={true} 
                onInventorySearchClick={handleFooterSearchClick} 
                isSearchOpen={isSearchFocused}
                isAnalyticsOpen={isAnalyticsOpen}
                onAnalyticsClose={handleCloseAnalytics}
                showActiveUsersButton={true}
                onActiveUsersClick={handleActiveUsersClick}
                activeUsersCount={activeUsersCount}
                isActiveUsersOpen={isActiveUsersDrawerOpen}
                showCompleteButton={currentChatData.metadata?.progress === 100}
                onCompleteClick={handleCompleteClick}
                isCompleteOpen={showCompleteDialog}
            />
                         {/* SlidingDrawer с завершением инвентаризации */}
             <AnimatePresence>
                 {showCompleteDialog && currentChatData.chat_id && (
                     <SlidingDrawer onClose={handleCloseCompleteDialog}>
                         <InventoryCompleteDrawer 
                             inventoryData={currentChatData as any}
                             chatId={currentChatData.chat_id}
                             onClose={handleCloseCompleteDialog}
                         />
                     </SlidingDrawer>
                 )}
             </AnimatePresence>
            
            {/* Модальное окно с изменениями шаблона */}
            {templateChanges && (
                <TemplateChangesModal
                    isOpen={isChangesModalOpen}
                    onClose={closeChangesModal}
                    changes={templateChanges}
                />
            )}
            
            {/* Модальное окно аналитики */}
            {analyticsData && (
                <ItemAnalytics
                    itemId={analyticsData.itemId}
                    itemName={analyticsData.itemId}
                    category={analyticsData.category}
                    history={historyData || []}
                    isOpen={isAnalyticsOpen}
                    onClose={handleCloseAnalytics}
                />
            )}
            
            {/* SlidingDrawer с активными пользователями */}
            <AnimatePresence>
                {isActiveUsersDrawerOpen && currentChatData.chat_id && (
                    <SlidingDrawer onClose={handleCloseActiveUsersDrawer}>
                        <ActiveUsersDrawer chatId={currentChatData.chat_id} />
                    </SlidingDrawer>
                )}
            </AnimatePresence>

            {/* Модальное окно подтверждения "Нет в наличии" */}
            <OutOfStockConfirmModal
                isOpen={showOutOfStockConfirm}
                itemName={pendingOutOfStockData?.itemName || ''}
                onConfirm={handleOutOfStockConfirmSubmit}
                onCancel={handleOutOfStockConfirmCancel}
            />
        </div>
    );
};

export default Inventory;