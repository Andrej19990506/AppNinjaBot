import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CategoriesList from './CategoryGrid';
import ItemEdit from './ItemEdit';
import ItemList from './ItemList';
import styles from './Inventory.module.css';
import { InventoryItem } from '@/types/inventoryTypes';
import SearchBar from './SearchBar';
import CloseIcon from '@mui/icons-material/Close';
import { SearchResult } from '@/types/search';
import ItemHistory from './ItemHistory/ItemHistory';

interface DesktopLayoutProps {
    categories: string[];
    inventory: Record<string, Record<string, InventoryItem>>;
    selectedCategory: string | null;
    selectedItem: { category: string; itemId: string; item: InventoryItem } | null;
    searchQuery: string;
    searchResults: SearchResult[] | null;
    isSearching: boolean;
    isSearchFocused: boolean;
    searchHistory: string[];
    chatId: string;
    onCategorySelect: (category: string) => void;
    onItemSelect: (itemId: string) => void;
    onSearch: (query: string) => void;
    onClearSearch: () => void;
    onSearchFocusChange: (isFocused: boolean) => void;
    onSearchResultSelect: (category: string, itemId: string) => void;
    onHistoryItemSelect: (query: string) => void;
    onItemClose: () => void;
    onItemUpdate: () => void;
    isLoading: boolean;
    error: string | null;
    onCategoryClick: (category: string) => void;
    onItemClick: (category: string, itemId: string) => void;
    onBackToCategories: () => void;
    onSearchChange: (query: string) => void;
    onSearchItems: (query: string) => void;
    onUpdateItem?: (category: string, itemId: string, item: InventoryItem) => void;
    onAddItem?: (category: string, item: InventoryItem) => void;
    onDeleteItem?: (category: string, itemId: string) => void;
}

// Определяем варианты анимации
const filterVariants = {
    closed: {
        opacity: 0,
        y: -10,
        height: 0,
        transition: {
            duration: 0.2
        }
    },
    open: {
        opacity: 1,
        y: 0,
        height: 'auto',
        transition: {
            duration: 0.3,
            type: "spring",
            stiffness: 300,
            damping: 25
        }
    }
};

// Варианты анимации для элементов
const itemVariants = {
    initial: { 
        opacity: 0, 
        x: 20 
    },
    animate: { 
        opacity: 1, 
        x: 0,
        transition: {
            duration: 0.3,
            type: "spring",
            stiffness: 300,
            damping: 25
        }
    },
    exit: { 
        opacity: 0, 
        x: -20,
        transition: {
            duration: 0.2
        }
    }
};

const DesktopLayout: React.FC<DesktopLayoutProps> = ({
    categories,
    inventory,
    selectedCategory,
    selectedItem,
    searchQuery,
    searchResults,
    isSearching,
    isSearchFocused,
    searchHistory,
    chatId,
    onCategorySelect,
    onItemSelect,
    onSearch,
    onClearSearch,
    onSearchFocusChange,
    onSearchResultSelect,
    onHistoryItemSelect,
    onItemClose,
    onItemUpdate,
    isLoading,
    error,
    onCategoryClick,
    onItemClick,
    onBackToCategories,
    onSearchChange,
    onSearchItems,
    onUpdateItem,
    onAddItem,
    onDeleteItem
}) => {
    const [prevCategory, setPrevCategory] = useState<string | null>(null);
    const [direction, setDirection] = useState<number>(1);
    const [showHistory, setShowHistory] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'quantity'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [navHistory, setNavHistory] = useState<Array<string>>([]);
    const [hasExpandedCategory, setHasExpandedCategory] = useState(false);

    useEffect(() => {
        if (selectedCategory !== prevCategory) {
            if (selectedCategory && !prevCategory) {
                setDirection(1);
            } else if (!selectedCategory && prevCategory) {
                setDirection(-1);
            }
            setPrevCategory(selectedCategory);
        }
    }, [selectedCategory, prevCategory]);

    useEffect(() => {
        if (selectedCategory && !navHistory.includes(selectedCategory)) {
            setNavHistory(prev => [...prev, selectedCategory]);
        }
    }, [selectedCategory, navHistory]);

    useEffect(() => {
        const dropdownElement = document.querySelector(`.${styles.itemsDropdown}`);
        setHasExpandedCategory(!!dropdownElement);
    }, [selectedCategory]);

    const containerVariants = {
        initial: { 
            opacity: 0,
            scale: 0.98
        },
        animate: { 
            opacity: 1,
            scale: 1,
            transition: { 
                duration: 0.3,
                ease: "easeOut"
            }
        },
        exit: { 
            opacity: 0,
            scale: 0.98,
            transition: { 
                duration: 0.2,
                ease: "easeIn"
            }
        }
    };
    
    const contentVariants = {
        initial: (direction: number) => ({
            x: direction * 50,
            opacity: 0
        }),
        animate: {
            x: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 1
            }
        },
        exit: (direction: number) => ({
            x: direction * -50,
            opacity: 0,
            transition: {
                duration: 0.2
            }
        })
    };
    
    const historyVariants = {
        initial: { 
            x: '100%',
            opacity: 0,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 25
            }
        },
        animate: { 
            x: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 25
            }
        },
        exit: { 
            x: '100%',
            opacity: 0,
            transition: {
                duration: 0.3,
                ease: "easeIn"
            }
        }
    };
    
    const handleBackToCategory = () => {
        setDirection(-1);
        onItemClose();
    };

    const handleSortChange = (type: 'name' | 'quantity') => {
        if (sortBy === type) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(type);
            setSortOrder('asc');
        }
    };

    const handleCategorySelect = (category: string) => {
        onCategorySelect(category);
    };

    const handleSearchResultSelect = (category: string, itemId: string) => {
        onSearchResultSelect(category, itemId);
    };

    const handleItemSelect = (itemId: string) => {
        if (selectedCategory) {
            onItemClick(selectedCategory, itemId);
        }
    };

    return (
        <div className={styles.desktopContainer}>
            <div className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <h3 className={styles.sidebarTitle}>Категории</h3>
                </div>
                <div className={styles.searchContainer}>
                    <SearchBar
                        onSearch={onSearchItems}
                        searchResults={searchResults || []}
                        searchQuery={searchQuery}
                        onClear={onClearSearch}
                        onResultSelect={handleSearchResultSelect}
                        isLoading={isLoading}
                    />
                </div>
                <CategoriesList
                    categories={categories}
                    inventory={inventory}
                    selectedCategory={selectedCategory}
                    onSelect={handleCategorySelect}
                />
            </div>

            <div className={`${styles.contentArea} ${hasExpandedCategory ? styles.contentWithDropdown : ''}`}>
                {selectedItem ? (
                    <div className={styles.itemEditContainer}>
                        <ItemEdit
                            item={selectedItem.item}
                            category={selectedItem.category}
                            itemId={selectedItem.itemId}
                            onSave={(updatedItem) => {
                                if (onUpdateItem) {
                                    onUpdateItem(selectedItem.category, selectedItem.itemId, updatedItem);
                                }
                            }}
                            onDelete={() => {
                                if (onDeleteItem) {
                                    onDeleteItem(selectedItem.category, selectedItem.itemId);
                                }
                            }}
                            onCancel={() => onItemSelect('')}
                            onClose={() => onItemSelect('')}
                            onUpdate={onItemUpdate}
                            chatId={chatId}
                        />
                    </div>
                ) : selectedCategory ? (
                    <div className={styles.itemsContainer}>
                        <ItemList
                            category={selectedCategory}
                            items={inventory[selectedCategory] || {}}
                            onSelect={handleItemSelect}
                            chatId={chatId}
                            searchQuery={searchQuery}
                            searchResults={searchResults ? searchResults.filter(r => r.category === selectedCategory) : undefined}
                        />
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyStateText}>
                            Выберите категорию слева или воспользуйтесь поиском
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showHistory && (
                    <motion.div 
                        className={styles.historyPanel}
                        variants={historyVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        <div className={styles.historyHeader}>
                            <h3>История изменений</h3>
                            <motion.button 
                                className={styles.closeHistoryButton}
                                onClick={() => setShowHistory(false)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <CloseIcon fontSize="small" />
                            </motion.button>
                        </div>
                        {selectedItem ? (
                            <ItemHistory 
                                itemId={selectedItem.itemId}
                                itemName={selectedItem.item.name}
                                category={selectedItem.category}
                                className={styles.itemHistory}
                            />
                        ) : (
                            <div className={styles.noItemSelected}>
                                <p>Выберите элемент для просмотра истории изменений</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DesktopLayout; 