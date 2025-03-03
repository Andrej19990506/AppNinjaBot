import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import styles from './ItemEdit.module.css';
import { InventoryItem } from '../../types/inventory';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateInventoryItem, updateProgress } from '../../store/slices/inventorySlice';

interface ItemEditProps {
    category: string;
    itemId: string;
    item: InventoryItem;
    onClose: () => void;
    onUpdate: () => void;
    chatId: string;
}

const ItemEdit: React.FC<ItemEditProps> = ({ 
    category, 
    itemId, 
    item: initialItem, 
    onClose, 
    onUpdate, 
    chatId 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [item, setItem] = useState<InventoryItem>(initialItem);
    const [isOutOfStock, setIsOutOfStock] = useState(initialItem.raw.isOutOfStock || false);
    const [currentActiveItem, setCurrentActiveItem] = useState<{ type: 'raw' | 'semifinished', operation: 'add' | 'subtract' } | null>(null);
    const [currentInputValue, setCurrentInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const currentTypes = ['raw', item.semifinished ? 'semifinished' : null].filter(Boolean) as ('raw' | 'semifinished')[];
    
    const { socket } = useWebSocket();
    const dispatch = useAppDispatch();
    const currentInventory = useAppSelector(state => state.inventory.selectedChat?.inventory || {});

    useEffect(() => {
        const currentItem = currentInventory[category]?.[itemId];
        if (currentItem && JSON.stringify(currentItem) !== JSON.stringify(item)) {
            setItem(currentItem);
            setIsOutOfStock(currentItem.raw.isOutOfStock || false);
        }
    }, [currentInventory, category, itemId, item]);

    const handleQuantityChange = useCallback(async (type: 'raw' | 'semifinished', action: 'increment' | 'decrement') => {
        try {
            const newItem = { ...item };
            
            if (type === 'raw') {
                const currentValue = newItem.raw.quantity;
                const newValue = action === 'increment' ? currentValue + 1 : Math.max(0, currentValue - 1);
                newItem.raw = {
                    ...newItem.raw,
                    quantity: newValue,
                    filled: newValue > 0,
                    isOutOfStock: newItem.raw.isOutOfStock
                };
            } else if (type === 'semifinished' && newItem.semifinished) {
                const currentValue = newItem.semifinished.quantity;
                const newValue = action === 'increment' ? currentValue + 1 : Math.max(0, currentValue - 1);
                newItem.semifinished = {
                    ...newItem.semifinished,
                    quantity: newValue,
                    filled: newValue > 0
                };
            }

            setItem(newItem);
            
            // Обновляем инвентарь и прогресс
            await dispatch(updateInventoryItem({
                chatId,
                category,
                itemId,
                item: newItem
            })).unwrap();

            // Явно вызываем обновление прогресса
            dispatch(updateProgress());

            const updateData = {
                source: 'client',
                data: {
                    metadata: {
                        lastUpdated: new Date().toISOString(),
                        chat_id: chatId
                    },
                    type: 'item_update',
                    category,
                    itemId,
                    item: newItem
                }
            };

            socket?.emit('inventory_update', updateData);
            onUpdate();

        } catch (error) {
            console.error('Ошибка при обновлении количества:', error);
            setItem(item);
        }
    }, [chatId, category, itemId, item, socket, dispatch, onUpdate]);

    const handleAddSemifinished = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const newItem: InventoryItem = {
                ...item,
                semifinished: {
                    quantity: 0,
                    filled: true
                }
            };

            setItem(newItem);
            await dispatch(updateInventoryItem({
                chatId,
                category,
                itemId,
                item: newItem
            })).unwrap();

            const updateData = {
                source: 'client',
                data: {
                    metadata: {
                        lastUpdated: new Date().toISOString(),
                        progress: 0,
                        chat_id: chatId
                    },
                    type: 'item_update',
                    category,
                    itemId,
                    item: newItem
                }
            };

            socket?.emit('inventory_update', updateData);
            onUpdate();
        } catch (error) {
            setError('Ошибка при добавлении полуфабриката');
            setItem(initialItem);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveSemifinished = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const newItem: InventoryItem = {
                ...item,
                semifinished: null
            };

            setItem(newItem);
            await dispatch(updateInventoryItem({
                chatId,
                category,
                itemId,
                item: newItem
            })).unwrap();

            const updateData = {
                source: 'client',
                data: {
                    metadata: {
                        lastUpdated: new Date().toISOString(),
                        progress: 0,
                        chat_id: chatId
                    },
                    type: 'item_update',
                    category,
                    itemId,
                    item: newItem
                }
            };

            socket?.emit('inventory_update', updateData);
            onUpdate();
        } catch (error) {
            setError('Ошибка при удалении полуфабриката');
            setItem(initialItem);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOutOfStock = async (type: 'raw' | 'semifinished') => {
        try {
            const newItem = { ...item };
            
            if (type === 'raw') {
                const newOutOfStockState = !isOutOfStock;
                setIsOutOfStock(newOutOfStockState);
                
                if (newOutOfStockState) {
                    newItem.raw = {
                        ...newItem.raw,
                        quantity: 0,
                        isOutOfStock: true,
                        filled: true
                    };

                    if (newItem.semifinished) {
                        newItem.semifinished = null;
                    }
                } else {
                    newItem.raw = {
                        ...newItem.raw,
                        quantity: 1,
                        isOutOfStock: false,
                        filled: true
                    };
                }
            }

            setItem(newItem);
            await dispatch(updateInventoryItem({
                chatId,
                category,
                itemId,
                item: newItem
            })).unwrap();

            const updateData = {
                source: 'client',
                data: {
                    metadata: {
                        lastUpdated: new Date().toISOString(),
                        progress: 0,
                        chat_id: chatId
                    },
                    type: 'item_update',
                    category,
                    itemId,
                    item: newItem
                }
            };

            socket?.emit('inventory_update', updateData);
            onUpdate();
        } catch (error) {
            console.error('Error updating out of stock status:', error);
            setItem(item);
            setIsOutOfStock(!isOutOfStock);
        }
    };

    const handlePlusClick = (type: 'raw' | 'semifinished') => {
        setCurrentActiveItem({ type, operation: 'add' });
        setCurrentInputValue('');
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleMinusClick = (type: 'raw' | 'semifinished') => {
        setCurrentActiveItem({ type, operation: 'subtract' });
        setCurrentInputValue('');
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setCurrentInputValue(value);
        }
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleSubmit = async () => {
        if (!currentActiveItem || !currentInputValue) return;

        const value = parseInt(currentInputValue);
        if (isNaN(value)) return;

        const newItem = { ...item };
        const { type, operation } = currentActiveItem;

        if (type === 'raw') {
            const currentValue = newItem.raw.quantity;
            const newQuantity = operation === 'add' ? 
                currentValue + value : 
                Math.max(0, currentValue - value);
            
            newItem.raw = {
                ...newItem.raw,
                quantity: newQuantity,
                filled: newQuantity > 0,
                isOutOfStock: newItem.raw.isOutOfStock
            };
        } else if (type === 'semifinished' && newItem.semifinished) {
            const currentValue = newItem.semifinished.quantity;
            const newQuantity = operation === 'add' ? 
                currentValue + value : 
                Math.max(0, currentValue - value);
            
            newItem.semifinished = {
                ...newItem.semifinished,
                quantity: newQuantity,
                filled: newQuantity > 0
            };
        }

        try {
            setItem(newItem);
            await dispatch(updateInventoryItem({
                chatId,
                category,
                itemId,
                item: newItem
            })).unwrap();

            // Явно вызываем обновление прогресса
            dispatch(updateProgress());

            const updateData = {
                source: 'client',
                data: {
                    metadata: {
                        lastUpdated: new Date().toISOString(),
                        chat_id: chatId
                    },
                    type: 'item_update',
                    category,
                    itemId,
                    item: newItem
                }
            };

            socket?.emit('inventory_update', updateData);
            onUpdate();
            setCurrentActiveItem(null);
            setCurrentInputValue('');
        } catch (error) {
            console.error('Ошибка при обновлении количества:', error);
            setItem(item);
        }
    };

    const handleDeleteSemifinished = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const newItem: InventoryItem = {
                ...item,
                semifinished: null
            };

            setItem(newItem);
            await dispatch(updateInventoryItem({
                chatId,
                category,
                itemId,
                item: newItem
            })).unwrap();

            const updateData = {
                source: 'client',
                data: {
                    metadata: {
                        lastUpdated: new Date().toISOString(),
                        progress: 0,
                        chat_id: chatId
                    },
                    type: 'item_update',
                    category,
                    itemId,
                    item: newItem
                }
            };

            socket?.emit('inventory_update', updateData);
            onUpdate();
        } catch (error) {
            setError('Ошибка при удалении полуфабриката');
            setItem(initialItem);
        } finally {
            setIsLoading(false);
        }
    };

    const renderItemCard = (type: 'raw' | 'semifinished') => {
        const itemData = type === 'raw' ? item.raw : item.semifinished;
        if (!itemData && type === 'semifinished') return null;

        const value = itemData?.quantity ?? 0;
        const isFilled = itemData?.filled ?? false;
        const showOutOfStock = type === 'raw' && isOutOfStock;

        return (
            <div key={type} className={styles.item}>
                {type === 'semifinished' && (
                    <motion.button
                        className={styles.deleteButton}
                        onClick={() => handleDeleteSemifinished()}
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        >
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </motion.button>
                )}
                <div className={styles.label}>
                    {type === 'semifinished' ? 'Полуфабрикат' : 'Сырье'}
                </div>
                <div className={styles.content}>
                    {showOutOfStock ? (
                        <div className={styles.outOfStockStatus}>
                            Нет в наличии
                        </div>
                    ) : (
                        <div className={`${styles.value} ${value > 0 ? styles.hasValue : ''}`}>
                            <span className={styles.quantity}>{value}</span>
                            {value > 0 && (
                                <div className={styles.indicator}>
                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path 
                                            d="M5 13l5 5L20 7" 
                                            stroke="currentColor" 
                                            strokeWidth="2" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>
                            )}
                        </div>
                    )}
                    {currentActiveItem?.type === type ? (
                        <div className={styles.inputGroup}>
                            <input
                                ref={inputRef}
                                type="number"
                                className={styles.input}
                                value={currentInputValue}
                                onChange={handleInputChange}
                                onFocus={handleInputFocus}
                                placeholder={`Введите число для ${currentActiveItem.operation === 'add' ? 'добавления' : 'вычитания'}`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSubmit();
                                    }
                                }}
                                autoFocus
                            />
                            <button 
                                className={styles.okButton}
                                onClick={handleSubmit}
                            >
                                OK
                            </button>
                        </div>
                    ) : (
                        <div className={styles.buttons}>
                            {type === 'raw' && (
                                <button 
                                    className={`${styles.outOfStockButton} ${isOutOfStock ? styles.active : ''}`}
                                    onClick={() => handleOutOfStock(type)}
                                >
                                    {isOutOfStock ? 'Восстановить' : 'Нет в наличии'}
                                </button>
                            )}
                            {(type === 'semifinished' || !isOutOfStock) && (
                                <>
                                    <button 
                                        className={styles.button}
                                        onClick={() => handlePlusClick(type)}
                                    >
                                        +
                                    </button>
                                    <button 
                                        className={styles.button}
                                        onClick={() => handleMinusClick(type)}
                                    >
                                        -
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderCards = (
        <>
            {renderItemCard('raw')}
            {renderItemCard('semifinished')}
        </>
    );

    return (
        <div className={styles.container}>
            {renderCards}
            
            {!item.semifinished && (
                <motion.button
                    className={styles.addSemifinishedButton}
                    onClick={handleAddSemifinished}
                    disabled={isLoading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <motion.div
                        className={styles.plusIcon}
                        animate={isLoading ? { rotate: 180 } : { rotate: 0 }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <motion.path
                                d="M12 5v14M5 12h14"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.5 }}
                            />
                        </svg>
                    </motion.div>
                    Добавить полуфабрикат
                </motion.button>
            )}
        </div>
    );
};

export default ItemEdit; 