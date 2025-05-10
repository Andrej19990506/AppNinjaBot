import React, { useState, useRef, useCallback } from 'react';
import styles from './ItemList.module.css';
import { InventoryItem } from '../../types/inventory';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchChatInventory, removeInventoryItem, addInventoryItem, updateInventoryItem } from '../../store/slices/inventorySlice';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useWebSocket } from '../../hooks/useWebSocket';
import axios from 'axios';
import config from '../../config';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';

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

interface ItemListProps {
    category: string;
    items: Record<string, InventoryItem>;
    onSelect: (itemId: string) => void;
    chatId: string;
    searchQuery?: string;
    searchResults?: SearchResult[];
    onSearchResultSelect?: (category: string, itemId: string) => void;
}

const ItemList: React.FC<ItemListProps> = ({ 
    category, 
    items, 
    onSelect, 
    chatId, 
    searchQuery = '', 
    searchResults = [], 
    onSearchResultSelect 
}) => {
    const listRef = useRef<HTMLDivElement>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { selectedChat } = useAppSelector(state => state.inventory);
    const dispatch = useAppDispatch();
    const { socket } = useWebSocket();
    const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Определяем статус товара (заполнен/пуст/нет в наличии)
    const getItemStatus = (item: InventoryItem) => {
        if (!item.raw) return '';
        
        if (item.raw.isOutOfStock) return 'outOfStock';
        
        const isRawFilled = item.raw.filled || item.raw.quantity > 0;
        const hasSemifinished = Boolean(item.semifinished);
        const isSemifinishedFilled = hasSemifinished && 
            (item.semifinished?.filled || (item.semifinished?.quantity ?? 0) > 0);
        
        if (isRawFilled && (!hasSemifinished || isSemifinishedFilled)) {
            return 'filled';
        }
        
        return '';
    };
    
    // Получаем массив товаров и сортируем его
    const itemsArray = Object.entries(items)
        .map(([itemId, item]) => ({
            id: itemId,
            ...item
        }))
        .sort((a, b) => {
            // Определяем заполненность для каждого элемента
            const aStatus = getItemStatus(a);
            const bStatus = getItemStatus(b);
            
            // Если один из элементов заполнен, а другой нет
            if (aStatus === 'filled' && !bStatus) return 1;
            if (!aStatus && bStatus === 'filled') return -1;
            
            // Если оба элемента имеют одинаковый статус, сортируем по алфавиту
            return a.id.localeCompare(b.id);
        });
    
    // Функция для выделения совпадений в тексте
    const highlightMatch = (text: string, query: string) => {
        if (!query || !text) return text;
        
        const normalizedText = text.toLowerCase();
        const normalizedQuery = query.toLowerCase();
        
        if (!normalizedText.includes(normalizedQuery)) return text;
        
        const parts = normalizedText.split(normalizedQuery);
        const result = [];
        let lastIndex = 0;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const partEndIndex = lastIndex + part.length;
            
            // Добавляем текст до совпадения
            if (part) {
                result.push(text.substring(lastIndex, partEndIndex));
            }
            
            // Добавляем выделенное совпадение, если это не последняя часть
            if (i < parts.length - 1) {
                const matchStartIndex = partEndIndex;
                const matchEndIndex = matchStartIndex + normalizedQuery.length;
                const matchText = text.substring(matchStartIndex, matchEndIndex);
                
                result.push(<span key={`match-${i}`} className={styles.highlight}>{matchText}</span>);
                
                lastIndex = matchEndIndex;
            }
        }
        
        return result;
    };
    
    // Получаем результаты поиска из текущей категории
    const currentCategoryResults = searchQuery && searchResults ? 
        searchResults.filter(result => result.category === category) : [];
    
    // Получаем результаты поиска из других категорий
    const otherCategoryResults = searchQuery && searchResults ? 
        searchResults.filter(result => result.category !== category) : [];
    
    // Обработка клика по товару
    const handleItemClick = (itemId: string) => {
        console.log(`Клик по товару: ${itemId}`);
        
        // Устанавливаем выбранный товар и вызываем onSelect с небольшой задержкой
        // для более надежной обработки клика
        setTimeout(() => {
            setSelectedItemId(itemId);
            onSelect(itemId);
            console.log(`Выбран товар: ${itemId}`);
        }, 10);
    };
    
    // Показать форму добавления товара
    const handleShowAddForm = () => {
        setShowAddForm(true);
        setNewItemName('');
        // Фокус на инпуте после отображения формы
        setTimeout(() => {
            inputRef.current?.focus();
        }, 10);
    };
    
    // Скрыть форму добавления товара
    const handleCancelAdd = () => {
        setShowAddForm(false);
    };
    
    // Обработка ввода имени нового товара
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewItemName(e.target.value);
    };
    
    // Обработка нажатия Enter в поле ввода
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newItemName.trim()) {
            handleAddItem();
        } else if (e.key === 'Escape') {
            handleCancelAdd();
        }
    };
    
    // Функция для добавления нового товара
    const handleAddItem = () => {
        if (newItemName.trim()) {
            dispatch(addInventoryItem({ chatId, category, itemId: newItemName.trim() }));
            setShowAddForm(false);
            setNewItemName('');
        }
    };
    
    // Функция для обработки удаления товара
    const handleDelete = async (itemId: string) => {
        if (!selectedChat) return;
        
        try {
            await dispatch(removeInventoryItem({ 
                chatId: selectedChat.chat_id, 
                category, 
                itemId 
            })).unwrap();
            setDeleteItem(null);
        } catch (error) {
            console.error('Ошибка при удалении товара:', error);
        }
    };
    
    // Функция для начала процесса удаления
    const handleDeleteStart = (itemId: string, itemName: string) => {
        setDeleteItem({ id: itemId, name: itemName });
    };
    
    // Функция для отмены удаления
    const handleDeleteCancel = () => {
        setDeleteItem(null);
    };
    
    // Обработчик свайпа
    const handleDragEnd = (info: PanInfo, itemId: string) => {
        if (info.offset.x < -100) { // Если свайп влево больше 100px
            handleDeleteStart(itemId, itemId);
        }
    };
    
    return (
        <div className={`${styles.container} ${searchQuery ? styles.searchModeActive : ''}`}>
            {showAddForm ? (
                <div className={styles.addItemForm}>
                    <input
                        ref={inputRef}
                        type="text"
                        className={styles.addItemInput}
                        placeholder="Введите название товара..."
                        value={newItemName}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                    />
                    <div className={styles.addItemButtons}>
                        <button 
                            className={styles.okButton} 
                            onClick={handleAddItem}
                            disabled={!newItemName.trim()}
                        >
                            ОК
                        </button>
                        <button 
                            className={styles.cancelButton} 
                            onClick={handleCancelAdd}
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            ) : (
                <button onClick={handleShowAddForm} className={styles.addItemButton}>
                    <AddIcon style={{ marginRight: '8px' }} />
                    Добавить новый товар
                </button>
            )}
            
            {isLoading ? (
                <div className={styles.searchingState}>
                    <CircularProgress size={24} className={styles.searchingSpinner} />
                    <p>Загрузка товаров...</p>
                </div>
            ) : Object.keys(items).length === 0 ? (
                <div className={styles.emptyState}>
                    <p>В этой категории нет товаров</p>
                </div>
            ) : (
                <div ref={listRef} className={styles.list}>
                    <AnimatePresence>
                        {itemsArray.map(({ id: itemId, ...item }) => {
                            const status = getItemStatus(item);
                            const isSearchResult = searchQuery && currentCategoryResults.some(
                                result => result.itemId === itemId
                            );
                            
                            return (
                                <motion.div
                                    key={itemId}
                                    className={`${styles.itemCard} ${styles[status]} ${isSearchResult ? styles.searchResult : ''}`}
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    onDragEnd={(_, info) => handleDragEnd(info, itemId)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleItemClick(itemId);
                                    }}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 30,
                                        mass: 1
                                    }}
                                    layout
                                >
                                    <h3 className={styles.itemTitle}>
                                        {searchQuery && isSearchResult ? 
                                            highlightMatch(itemId, searchQuery) : itemId
                                        }
                                    </h3>
                                    
                                    {status === 'filled' && (
                                        <motion.div 
                                            className={styles.filledBadge}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    
                                    {status === 'outOfStock' && (
                                        <motion.div 
                                            className={styles.outOfStockBadge}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        >
                                            Нет в наличии
                                        </motion.div>
                                    )}
                                    
                                    <div className={styles.deleteIndicator}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path 
                                                d="M19 7l-7 7-7-7" 
                                                strokeWidth="2" 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
            
            {/* Отображение результатов из других категорий */}
            {searchQuery && otherCategoryResults.length > 0 && (
                <div className={styles.otherResultsSection}>
                    <h3 className={styles.otherResultsTitle}>Результаты из других категорий:</h3>
                    <div className={styles.otherResultsList}>
                        {otherCategoryResults.map((result) => {
                            const { category: resultCategory, itemId, item } = result;
                            const status = getItemStatus(item);
                            
                            return (
                                <motion.div
                                    key={`${resultCategory}-${itemId}`}
                                    className={`${styles.itemCard} ${styles[status]} ${styles.searchResult}`}
                                    onClick={() => onSearchResultSelect?.(resultCategory, itemId)}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 30,
                                        mass: 1
                                    }}
                                    layout
                                >
                                    <div className={styles.categoryLabel}>{resultCategory}</div>
                                    <h3 className={styles.itemTitle}>
                                        {highlightMatch(itemId, searchQuery)}
                                    </h3>
                                    
                                    {status === 'filled' && (
                                        <motion.div 
                                            className={styles.filledBadge}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    
                                    {status === 'outOfStock' && (
                                        <motion.div 
                                            className={styles.outOfStockBadge}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        >
                                            Нет в наличии
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <DeleteConfirmationModal
                isOpen={!!deleteItem}
                itemName={deleteItem?.name || ''}
                category={category}
                onConfirm={() => deleteItem && handleDelete(deleteItem.id)}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
};

export default ItemList; 