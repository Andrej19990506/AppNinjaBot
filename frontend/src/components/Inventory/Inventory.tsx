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
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { chatId } = useParams<{ chatId?: string }>();
    const { error: reduxError, selectedChat, items } = useAppSelector(state => state.inventory);
    const currentUser = useAppSelector(state => state.user.user);
    
    // Все состояния
    const [notifications, setNotifications] = useState<Array<{ id: string; type: string; message?: string; title?: string }>>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedChatForModal, setSelectedChatForModal] = useState<ChatItem | null>(null);
    
    // Все хуки должны быть вызваны до любых условных операторов
    const {
        isLoading: isInventoryLoading,
        error: loaderError,
        loadingProgress
    } = useInventoryLoader({
        chatId: chatId,
        currentUserId: currentUser?.id || null,
        isAdmin: currentUser?.isAdmin || false
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

    // Объединяем все ошибки
    const error = loaderError || reduxError;

    // Эффект для загрузки списка чатов
    useEffect(() => {
        if (!currentUser?.id) {
            console.log('⚠️ Пользователь не инициализирован');
            return;
        }

        if (!selectedChat && !isInventoryLoading) {
            console.log('📥 Загрузка списка чатов');
            dispatch(fetchInventory());
        }
    }, [currentUser?.id, selectedChat, isInventoryLoading, dispatch]);

    useEffect(() => {
        if (!selectedChat || !currentUser?.id) return;
        
        const userInfo = {
            id: currentUser.id,
            first_name: currentUser.first_name,
            photo_url: currentUser.photo_url
        };
        
        // TODO: Восстановить функционал присоединения к комнате после реализации WebSocket
        console.log('Должны подключиться к комнате:', selectedChat.chat_id, userInfo);
        
        return () => {
            // TODO: Восстановить функционал отключения от комнаты после реализации WebSocket
            console.log('Должны отключиться от комнаты:', selectedChat.chat_id, userInfo);
        };
    }, [currentUser?.id, currentUser?.isAdmin, currentUser?.first_name, currentUser?.photo_url, selectedChat]);

    useEffect(() => {
        if (selectedChat?.metadata?.progress === 100 && chatId) {
            setShowCompleteDialog(true);
        }
    }, [selectedChat?.metadata?.progress, chatId]);

    // Все callback функции
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

    const handleChatSelect = useCallback((chatId: string, chat: ChatItem) => {
        if (!currentUser?.id) return;

        // Проверяем права администратора
        dispatch(checkAdminRights({
            userId: currentUser.id,
            chatId: chatId,
            admins: chat.admins,
            context: 'inventory'
        })).unwrap()
        .then((adminData: { isAdmin: boolean }) => {
            if (adminData.isAdmin) {
                // Для админа сразу показываем модальное окно
                setSelectedChatForModal(chat);
                setShowChatModal(true);
            } else {
                // Для обычного пользователя просто выбираем чат
                dispatch(selectChat(chatId));
                navigate(`/inventory/${chatId}`);
            }
        })
        .catch((error: Error) => {
            console.error('❌ Ошибка при проверке прав администратора:', error);
        });
    }, [dispatch, navigate, currentUser]);

    const handleStartInventory = useCallback(async () => {
        if (!selectedChatForModal) return;

        try {
            console.log('🚀 Запуск процесса инвентаризации...');
            
            // Выбираем чат и делаем навигацию
            await dispatch(selectChat(selectedChatForModal.chat_id)).unwrap();
            navigate(`/inventory/${selectedChatForModal.chat_id}`, { replace: true });
            
            // Закрываем модалку
            setShowChatModal(false);
            setSelectedChatForModal(null);
            
            console.log('✅ Процесс инвентаризации запущен');
        } catch (error) {
            console.error('❌ Ошибка при запуске инвентаризации:', error);
            throw error;
        }
    }, [dispatch, navigate, selectedChatForModal]);

    const handleResetInventory = useCallback(async (chatId: string): Promise<void> => {
        try {
            // Отправляем запрос на сброс инвентаризации
            await axios.post(`${config.API_URL}/inventory/${chatId}/reset`);
            
            // После успешного сброса обновляем данные инвентаря
            await dispatch(fetchChatInventory(chatId));
        } catch (error) {
            console.error('Ошибка при сбросе инвентаризации:', error);
            throw error;
        }
    }, [dispatch]);

    // Преобразование данных
    const chatForFooter: Chat | null = selectedChat ? {
        id: selectedChat.chat_id,
        name: selectedChat.chat_title,
        type: 'group',
        created_at: selectedChat.metadata?.lastUpdated || '',
        updated_at: selectedChat.metadata?.lastUpdated || ''
    } : null;

    // Рендеринг компонента
    if (isInventoryLoading) {
        return (
            <div className={styles.container}>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
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
                    <button className={styles.retryButton} onClick={() => window.location.reload()}>
                        Повторить
                    </button>
                </div>
            </div>
        );
    }

    if (chatId && selectedChat) {
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
                                </div>
                            )}
                            
                            <div className={isSearchFocused && searchQuery ? styles.contentBlurred : ''} style={{ overflow: 'visible', minHeight: '60vh' }}>
                                {currentView}
                            </div>
                        </motion.div>
                    ) : (
                        <div className={styles.inventoryLoadingWrapper}>
                            <div className={styles.loadingSpinner} />
                            <p>Loading inventory data...</p>
                        </div>
                    )}
                </div>
                <Footer 
                    selectedChat={chatForFooter!}
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
    }

    return (
        <div className={styles.container}>
            <ChatSelector
                chats={items.map(chat => ({
                    chat_id: chat.chat_id,
                    chat_title: chat.chat_title,
                    admins: chat.admins.map(admin => ({
                        ...admin,
                        is_bot: false,
                        can_manage_chat: admin.status === 'creator' || admin.status === 'administrator',
                        can_delete_messages: admin.status === 'creator' || admin.status === 'administrator',
                        can_manage_voice_chats: admin.status === 'creator' || admin.status === 'administrator',
                        can_restrict_members: admin.status === 'creator' || admin.status === 'administrator',
                        can_promote_members: admin.status === 'creator',
                        can_change_info: admin.status === 'creator' || admin.status === 'administrator',
                        can_invite_users: admin.status === 'creator' || admin.status === 'administrator',
                        can_pin_messages: admin.status === 'creator' || admin.status === 'administrator'
                    })),
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
            />

            {selectedChatForModal && (
                <ChatModal
                    chat={selectedChatForModal}
                    open={showChatModal}
                    onClose={() => {
                        setShowChatModal(false);
                        setSelectedChatForModal(null);
                    }}
                    onStartAction={handleStartInventory}
                    mode="inventory"
                    title="Подтверждение инвентаризации"
                    actionButtonText="Приступить к инвентаризации"
                />
            )}
        </div>
    );
};

export default Inventory; 