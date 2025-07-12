import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import CategoryIcon from '@mui/icons-material/Category';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { WriteOffApi, InventoryItem } from '@/features/WriteOff/services/writeOffApi';
import styles from './ProductSearch.module.css';

interface ProductSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onProductSelect: (productName: string) => void;
    groupId: string;
    selectedProduct?: string;
}

const ProductSearch: React.FC<ProductSearchProps> = ({
    isOpen,
    onClose,
    onProductSelect,
    groupId,
    selectedProduct
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [allProducts, setAllProducts] = useState<InventoryItem[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    // Загрузка товаров из шаблона
    useEffect(() => {
        if (isOpen && allProducts.length === 0) {
            loadProducts();
        }
    }, [isOpen]);

    const loadProducts = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            console.log('🔄 [ProductSearch] Загрузка товаров из шаблона...');
            const response = await WriteOffApi.getInventoryTemplate(groupId);
            
            if (response.success && response.items) {
                setAllProducts(response.items);
                setFilteredProducts(response.items);
                console.log('✅ [ProductSearch] Загружено товаров:', response.items.length);
            } else {
                throw new Error(response.error || 'Не удалось загрузить товары');
            }
        } catch (err: any) {
            console.error('❌ [ProductSearch] Ошибка загрузки товаров:', err);
            setError(err.message || 'Ошибка загрузки товаров');
        } finally {
            setIsLoading(false);
        }
    };

    // Фильтрация товаров по поиску и категории
    useEffect(() => {
        let filtered = allProducts;

        // Фильтр по категории
        if (selectedCategory) {
            filtered = filtered.filter(product => product.category === selectedCategory);
        }

        // Фильтр по поисковому запросу
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(query) ||
                product.category.toLowerCase().includes(query)
            );
        }

        setFilteredProducts(filtered);
    }, [searchQuery, selectedCategory, allProducts]);

    // Получение уникальных категорий
    const categories = useMemo(() => {
        const categorySet = new Set(allProducts.map(product => product.category));
        return Array.from(categorySet).sort();
    }, [allProducts]);

    const handleProductSelect = useCallback((product: InventoryItem) => {
        console.log('✅ [ProductSearch] Выбран товар:', product.name);
        onProductSelect(product.name);
        onClose();
    }, [onProductSelect, onClose]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    }, []);

    const handleCategorySelect = useCallback((category: string) => {
        setSelectedCategory(selectedCategory === category ? '' : category);
    }, [selectedCategory]);

    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSelectedCategory('');
    }, []);

    if (!isOpen) return null;

    return (
        <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className={styles.modal}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <h3 className={styles.title}>Выберите товар для списания</h3>
                    <button className={styles.closeButton} onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>

                <div className={styles.searchContainer}>
                    <div className={styles.searchInputContainer}>
                        <SearchIcon className={styles.searchIcon} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Поиск товара..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                        {searchQuery && (
                            <button className={styles.clearButton} onClick={clearSearch}>
                                <CloseIcon />
                            </button>
                        )}
                    </div>
                </div>

                {isLoading && (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <span>Загрузка товаров...</span>
                    </div>
                )}

                {error && (
                    <div className={styles.error}>
                        <span>{error}</span>
                        <button onClick={loadProducts}>Повторить</button>
                    </div>
                )}

                {!isLoading && !error && (
                    <>
                        {/* Категории */}
                        <div className={styles.categoriesContainer}>
                            <div className={styles.categoriesHeader}>
                                <CategoryIcon className={styles.categoryIcon} />
                                <span>Категории</span>
                            </div>
                            <div className={styles.categories}>
                                {categories.map(category => (
                                    <button
                                        key={category}
                                        className={`${styles.categoryButton} ${
                                            selectedCategory === category ? styles.selected : ''
                                        }`}
                                        onClick={() => handleCategorySelect(category)}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Список товаров */}
                        <div className={styles.productsContainer}>
                            <div className={styles.productsHeader}>
                                <span>
                                    Найдено товаров: {filteredProducts.length}
                                    {selectedCategory && ` в категории "${selectedCategory}"`}
                                </span>
                            </div>
                            
                            <div className={styles.productsList}>
                                <AnimatePresence>
                                    {filteredProducts.map((product, index) => (
                                        <motion.div
                                            key={`${product.category}-${product.name}`}
                                            className={`${styles.productItem} ${
                                                selectedProduct === product.name ? styles.selectedProduct : ''
                                            }`}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => handleProductSelect(product)}
                                        >
                                            <div className={styles.productInfo}>
                                                <div className={styles.productName}>{product.name}</div>
                                                <div className={styles.productCategory}>{product.category}</div>
                                            </div>
                                            {selectedProduct === product.name && (
                                                <CheckIcon className={styles.selectedIcon} />
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            {filteredProducts.length === 0 && searchQuery && (
                                <div className={styles.noResults}>
                                    <span>Товары не найдены</span>
                                    <button onClick={clearSearch}>Очистить поиск</button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
};

export default ProductSearch; 