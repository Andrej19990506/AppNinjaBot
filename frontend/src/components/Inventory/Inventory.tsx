import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
    fetchInventory, 
    fetchChatInventory,
    selectChat
} from '../../store/slices/inventorySlice';
import { checkAdminRights } from '../../store/slices/adminSlice';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { socketService } from '../../services/socket';
import ChatSelector, { ChatItem } from '../common/ChatSelector/ChatSelector';
import ChatModal from '../common/ChatModal/ChatModal';
import CategoryGrid from './CategoryGrid';
import ItemList from './ItemList';
import ItemHistory from '../ItemHistory/ItemHistory';
import ItemEdit from './ItemEdit';
import InventoryCompleteDialog from '../InventoryCompleteDialog';
import Header from './Header';
import styles from './Inventory.module.css';
import { InventoryItem } from '../../types/inventory';
import { motion } from 'framer-motion';
import Footer from './Footer';
import { ChatListSkeleton } from '../common/Skeleton';
import InventorySearch from './InventorySearch';
import SearchResultsDropdown from './SearchResultsDropdown';
import axios from 'axios';
import config from '../../config';

// Импортируем необходимые хуки
import { useInventoryLoader } from '../../hooks/useInventoryLoader';
import { useInventoryNavigation } from '../../hooks/useInventoryNavigation';
import { useInventorySearch } from '../../hooks/useInventorySearch';
import { useInventoryView } from '../../hooks/useInventoryView';

// Добавляем интерфейс для преобразования ChatInventory в Chat
interface Chat {
    id: string;
    name: string;
    type: 'group' | 'supergroup' | 'private';
    created_at: string;
    updated_at: string;
}

const Inventory: React.FC = () => {
    // --- 1. Инициализация хуков React и Router ---
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { chatId } = useParams<{ chatId?: string }>();

    // --- 2. Инициализация селекторов Redux ---
    const { error: reduxError, selectedChat, items } = useAppSelector(state => state.inventory);
    const currentUser = useAppSelector(state => state.user.user);
    
    // --- 3. Инициализация состояния компонента (useState) ---
    const [notifications, setNotifications] = useState<Array<{ id: string; type: string; message?: string; title?: string }>>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedChatForModal, setSelectedChatForModal] = useState<ChatItem | null>(null);
    
    // --- 4. Инициализация кастомных хуков ---
    const {
        isLoading: isInventoryLoading,
        error: loaderError,
        loadingProgress
    } = useInventoryLoader({
        chatId: chatId,
        currentUserId: currentUser?.id || null,
        isAdmin: currentUser?.isAdmin || false,
        role: null // TODO: Определить, как получать активную роль
    });
    
    const {
        selectedCategory,
        selectedItem,
        handleCategorySelect,
        handleItemSelect,
        handleBack
    } = useInventoryNavigation({
        onNavigate: (category, item) => {
            console.log('Navigation:', { category, item });
        }
    });
    
    const {
        searchQuery,
        isSearching,
        searchResults,
        isSearchFocused,
        searchHistory,
        handleSearch,
        handleClearSearch,
        handleSearchFocusChange,
        handleSearchResultSelect,
        handleHistoryItemSelect
    } = useInventorySearch({
        inventory: selectedChat?.inventory,
        onSelectResult: (category, itemId) => {
            handleCategorySelect(category);
            handleItemSelect(itemId);
        }
    });
    
    const { 
        currentView, 
        hasValidInventory
    } = useInventoryView({
        selectedCategory,
        selectedItem,
        inventory: selectedChat?.inventory || {},
        searchActive: isSearchFocused && !!searchQuery,
        isLoading: isInventoryLoading,
        renderCategories: () => (
            <CategoryGrid
                key="categories"
                categories={Object.keys(selectedChat?.inventory || {})}
                onSelect={handleCategorySelect}
                inventory={selectedChat?.inventory || {}}
                selectedCategory={selectedCategory}
            />
        ),
        renderItems: (category) => (
            <ItemList
                key={`items-${category}`}
                category={category}
                items={selectedChat?.inventory?.[category] || {}}
                onSelect={handleItemSelect}
                chatId={selectedChat?.chat_id || ''}
                searchQuery={searchQuery}
                searchResults={searchResults}
                onSearchResultSelect={handleSearchResultSelect}
            />
        ),
        renderItemDetail: (category, itemId) => (
            <motion.div
                key={`${category}-${itemId}`}
                className={styles.itemEditContainer}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30
                }}
            >
                <ItemEdit
                    category={category}
                    itemId={itemId}
                    item={selectedChat?.inventory?.[category]?.[itemId] || {} as InventoryItem}
                    onClose={handleBack}
                    onUpdate={() => {
                        console.log('Item updated');
                    }}
                    chatId={selectedChat?.chat_id || ''}
                />
                
                <ItemHistory
                    itemId={itemId}
                    itemName={itemId}
                    category={category}
                    className={styles.itemHistory}
                />
            </motion.div>
        ),
        renderSearch: () => (
            <SearchResultsDropdown
                isVisible={true}
                searchQuery={searchQuery}
                searchResults={searchResults}
                isSearching={isSearching}
                searchHistory={searchHistory}
                onSelectResult={handleSearchResultSelect}
                onSelectHistoryItem={handleHistoryItemSelect}
            />
        )
    });

    // --- 5. Инициализация useEffect хуков ---
    useEffect(() => {
        // Эффект для показа диалога завершения
        if (selectedChat?.metadata?.progress === 100 && chatId) {
            setShowCompleteDialog(true);
        }
    }, [selectedChat?.metadata?.progress, chatId]);

    // --- 6. Инициализация useCallback хуков ---
    const getHeaderTitle = useCallback(() => {
        if (!selectedChat) return 'Инвентарь';
        if (!selectedCategory) return selectedChat.chat_title;
        if (!selectedItem) return selectedCategory;
        return selectedItem;
    }, [selectedChat, selectedCategory, selectedItem]);

    const handleNotificationClose = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setHasUnreadNotifications(false);
    }, []);

    const handleCloseCompleteDialog = useCallback(() => {
        setShowCompleteDialog(false);
    }, []);

    const handleChatSelect = useCallback((chatIdParam: string, chat: ChatItem) => {
        if (!currentUser?.id) return;
        console.log(`[Inventory] handleChatSelect вызван для chatId: ${chatIdParam}`);
        const currentUrlChatId = chatId; // Текущий chatId из URL

        // Убираем немедленную навигацию. Логика показа модального окна
        // и последующей навигации должна быть в ChatSelector.
        if (!currentUrlChatId) {
            console.log(`[Inventory] Выбран чат ${chatIdParam} в ChatSelector. Модальное окно должно открыться там.`);
            // navigate(`/inventory/${chatIdParam}`); // <-- КОММЕНТИРУЕМ ИЛИ УДАЛЯЕМ ЭТО
        } else {
            // Логика для случая, когда клик происходит УЖЕ на странице инвентаря
            // Возможно, здесь тоже нужно показывать модальное окно?
            // Пока оставим как есть, но основная проблема была в блоке if.
            console.log(`[Inventory] handleChatSelect вызван на странице /inventory/${currentUrlChatId}`);
            dispatch(checkAdminRights({
                userId: currentUser.id,
                chatId: chatIdParam,
                admins: chat.admins,
                context: 'inventory'
            })).unwrap()
            .then((adminData: { isAdmin: boolean }) => {
                if (adminData.isAdmin) {
                    // Показываем модальное окно из Inventory.tsx
                    // (убедитесь, что оно есть и настроено)
                    setSelectedChatForModal(chat);
                    setShowChatModal(true);
                } else {
                    console.warn("[Inventory] Попытка выбрать чат, находясь уже на странице инвентаря - действие проигнорировано для не-админа.");
                }
            })
            .catch((error: Error) => {
                console.error('❌ Ошибка при проверке прав администратора:', error);
            });
        }
    }, [dispatch, /* navigate, */ currentUser, chatId]); // Убираем navigate из зависимостей, если он больше не используется напрямую

    const handleStartInventory = useCallback(async () => {
        if (!selectedChatForModal) return;
        try {
            console.log('🚀 Запуск процесса инвентаризации...');
            await dispatch(selectChat(selectedChatForModal.chat_id)).unwrap();
            navigate(`/inventory/${selectedChatForModal.chat_id}`, { replace: true });
            setShowChatModal(false);
            setSelectedChatForModal(null);
            console.log('✅ Процесс инвентаризации запущен');
        } catch (error) {
            console.error('❌ Ошибка при запуске инвентаризации:', error);
            throw error;
        }
    }, [dispatch, navigate, selectedChatForModal]);

    const handleResetInventory = useCallback(async (chatIdParam: string): Promise<void> => {
        try {
            await axios.post(`${config.API_URL}/inventory/${chatIdParam}/reset`);
            await dispatch(fetchChatInventory(chatIdParam));
        } catch (error) {
            console.error('Ошибка при сбросе инвентаризации:', error);
            throw error;
        }
    }, [dispatch]);

    // --- 7. Прочие переменные и вычисления ---
    const error = loaderError || reduxError; // Объединяем ошибки
    const chatForFooter: Chat | null = selectedChat ? { // Данные для футера
        id: selectedChat.chat_id,
        name: selectedChat.chat_title,
        type: 'group',
        created_at: selectedChat.metadata?.lastUpdated || '',
        updated_at: selectedChat.metadata?.lastUpdated || ''
    } : null;

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
                    chats={items.map(chat => ({
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
                    }))}
                    onChatSelect={handleChatSelect}
                    onResetInventory={handleResetInventory}
                    mode="inventory"
                    onHomeClick={() => navigate('/')}
                />
                {/* Модальное окно из Inventory.tsx для случая клика на чат, УЖЕ находясь на странице инвентаря */}
                {selectedChatForModal && (
                    <ChatModal
                        chat={selectedChatForModal}
                        open={showChatModal}
                        onClose={() => {
                            setShowChatModal(false);
                            setSelectedChatForModal(null);
                        }}
                        onStartAction={handleStartInventory} // Эта кнопка должна навигировать
                        mode="inventory"
                        title="Подтверждение инвентаризации"
                        actionButtonText="Перейти к инвентаризации"
                    />
                )}
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
    
    // Убираем проверку (!selectedChat || selectedChat.chat_id !== chatId)
    // Вместо этого проверяем hasValidInventory
    if (!hasValidInventory) {
        // Показываем состояние загрузки/ожидания, пока useInventoryView не скажет, что инвентарь валиден
        console.log(`[Inventory] Показываем заглушку загрузки для chatId: ${chatId}, т.к. hasValidInventory=false`);
        // Можно использовать тот же скелетон или просто текст
        return <div className={styles.container}><ChatListSkeleton loadingProgress={loadingProgress} /></div>;
        // return <div className={styles.container}><p>Подготовка данных инвентаря...</p></div>;
    }

    // --- 9. Финальный рендеринг (детали инвентаря) --- 
    // Сюда мы попадаем, только если chatId есть, нет загрузки/ошибки, и hasValidInventory = true
    console.log(`[Inventory] Рендерим ПОЛНЫЕ детали инвентаря для chatId: ${chatId}, selectedChat: ${selectedChat?.chat_id}`);
    // Добавляем проверку, что selectedChat действительно загружен, на всякий случай
    if (!selectedChat) {
        console.error(`[Inventory] ОШИБКА РЕНДЕРИНГА: selectedChat is null/undefined, хотя hasValidInventory=true! chatId=${chatId}`);
        return <div className={styles.container}><p>Произошла внутренняя ошибка.</p></div>;
    }
    
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
                 {/* Убираем дублирующую проверку hasValidInventory здесь, она уже сделана выше */}
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
                        </div>
                    )}
                    
                    <div className={isSearchFocused && searchQuery ? styles.contentBlurred : ''} style={{ overflow: 'visible', minHeight: '60vh' }}>
                        {currentView} 
                    </div>
                </motion.div>
            </div>
            <Footer 
                selectedChat={chatForFooter!} // selectedChat здесь уже не null
                selectedCategory={selectedCategory || undefined}
                selectedItem={selectedItem || undefined}
                onBack={handleBack}
                onChatSelect={() => navigate('/inventory')}
            />
            <InventoryCompleteDialog
                isOpen={showCompleteDialog}
                onClose={handleCloseCompleteDialog}
                inventoryData={selectedChat as any}
                chatId={selectedChat?.chat_id || ''}
            />
        </div>
    );
};

export default Inventory; 