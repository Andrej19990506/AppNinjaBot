import React, { useState, useCallback, useEffect, useRef } from 'react';
import styles from '@features/Inventory/ItemEdit.module.css';
import { InventoryItem } from '@/types/inventoryTypes';
import { socketService } from '@shared/services/socketService';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import { updateInventoryItem, updateInventoryStructure, updateProgress, fetchItemHistory, selectHistoryRecordsForItem } from '@/store/slices/inventorySlice';

interface ItemEditProps {
    category: string;
    itemId: string;
    item: InventoryItem;
    onClose: () => void;
    onUpdate: () => void;
    chatId: string;
    onDelete?: () => void;
    onCancel?: () => void;
    onSave?: (updatedItem: InventoryItem) => void;
    onShowAnalytics?: () => void; // Добавляем новый пропс
    onOutOfStockConfirm?: (category: string, itemId: string, itemName: string, type: 'raw' | 'semifinished', onConfirm: () => void) => void; // Новый пропс для подтверждения с коллбэком
}

const ItemEdit: React.FC<ItemEditProps> = ({ 
    category, 
    itemId, 
    item: initialItem, 
    onClose, 
    onUpdate, 
    chatId, 
    onDelete, 
    onCancel, 
    onSave, 
    onShowAnalytics,
    onOutOfStockConfirm
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [_isAddingItem, _setIsAddingItem] = useState(false);
    const [_error, setError] = useState<string | null>(null);
    const [item, setItem] = useState<InventoryItem>(initialItem);
    const [isOutOfStock, setIsOutOfStock] = useState(initialItem.raw?.isOutOfStock || false);
    const [currentActiveItem, setCurrentActiveItem] = useState<{ type: 'raw' | 'semifinished', operation: 'add' | 'subtract' } | null>(null);
    const [currentInputValue, setCurrentInputValue] = useState('');
    const [isExiting, setIsExiting] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isCardExiting, setIsCardExiting] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const _currentTypes = ['raw', item.semifinished ? 'semifinished' : null].filter(Boolean) as ('raw' | 'semifinished')[];
    
    // Получаем данные истории товара из Redux
    const historyData = useAppSelector(selectHistoryRecordsForItem(itemId));
    
    const dispatch = useAppDispatch();
    const currentUser = useAppSelector(state => state.user.user);
    const currentInventory = useAppSelector(state => state.inventory.selectedChat?.inventory || {});

    useEffect(() => {
        const currentItem = currentInventory[category]?.[itemId];
        if (currentItem && JSON.stringify(currentItem) !== JSON.stringify(item)) {
            setItem(currentItem);
            setIsOutOfStock(currentItem.raw?.isOutOfStock || false);
        }
    }, [currentInventory, category, itemId, item]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // --- Индикатор редактирования: при открытии/закрытии модалки шлём статус ---
    useEffect(() => {
        const userInfo = currentUser ? {
            userId: currentUser.id,
            first_name: currentUser.first_name,
            photo_url: currentUser.photo_url
        } : undefined;
        try {
            socketService.emit('item_editing', {
                chat_id: chatId,
                category,
                item_id: itemId,
                editing: true,
                user_info: userInfo
            });
        } catch {}
        return () => {
            try {
                socketService.emit('item_editing', {
                    chat_id: chatId,
                    category,
                    item_id: itemId,
                    editing: false
                });
            } catch {}
        };
    }, [chatId, category, itemId, currentUser]);

    const _handleQuantityChange = useCallback(async (type: 'raw' | 'semifinished', action: 'increment' | 'decrement') => {
        try {
            const currentTimestamp = new Date().toISOString();
            const newItem = { 
                ...item, 
                lastUpdated: currentTimestamp // Добавляем timestamp для отслеживания изменений
            };
            
            if (type === 'raw' && newItem.raw) {
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

            // 🚨 OPTIMISTIC UPDATE с защитой от конфликтов
            const previousItem = { ...item };
            setItem(newItem);
            
            try {
                // Обновляем инвентарь и прогресс
                const updateResult = await dispatch(updateInventoryItem({
                    chatId,
                    category,
                    itemId,
                    item: newItem
                })).unwrap();

                // 🔄 CONFLICT RESOLUTION: проверяем что сервер вернул
                if (updateResult && updateResult.inventory) {
                    const serverItem = updateResult.inventory[category]?.[itemId];
                    if (serverItem && serverItem.lastUpdated !== currentTimestamp) {
                        console.warn(`⚠️ [Conflict] Сервер вернул другой timestamp для ${category}/${itemId}:`, {
                            expected: currentTimestamp,
                            server: serverItem.lastUpdated,
                            serverItem
                        });
                        // Применяем данные с сервера (последняя запись побеждает)
                        setItem(serverItem);
                    }
                }

                // Явно вызываем обновление прогресса
                dispatch(updateProgress());

                // ✅ Только после успешного API запроса отправляем веб-сокет
                const updateData = {
                    source: 'client',
                    data: {
                        metadata: {
                            lastUpdated: currentTimestamp,
                            chat_id: chatId
                        },
                        type: 'item_update',
                        category,
                        itemId,
                        item: newItem
                    }
                };

                socketService.emit('inventory_update', updateData);
                onUpdate();

            } catch (error) {
                console.error('Ошибка при обновлении количества:', error);
                // 🚨 ROLLBACK: возвращаем предыдущее состояние при ошибке
                setItem(previousItem);
                throw error; // Re-throw для обработки выше
            }
        } catch (error) {
            console.error('Критическая ошибка при обновлении:', error);
        }
    }, [chatId, category, itemId, item, dispatch, onUpdate]);

    const handleAddSemifinished = async () => {
        try {
            setIsLoading(true);
            setError(null);
            setIsExiting(true);

            // Ждем завершения анимации исчезновения кнопки
            await new Promise(resolve => setTimeout(resolve, 200));

            const newItem: InventoryItem = {
                ...item,
                semifinished: {
                    quantity: 0,
                    filled: false // Структура добавлена, но количество не внесено -> не считаем в прогресс
                },
                lastUpdated: new Date().toISOString() // Добавляем timestamp
            };

            setItem(newItem);
            await dispatch(updateInventoryStructure({
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

            socketService.emit('inventory_update', updateData);
            onUpdate();
        } catch (error) {
            setError('Ошибка при добавлении полуфабриката');
            setItem(initialItem);
        } finally {
            setIsLoading(false);
            setIsExiting(false);
        }
    };

    const _handleRemoveSemifinished = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const newItem: InventoryItem = {
                ...item,
                semifinished: undefined,
                lastUpdated: new Date().toISOString() // Добавляем timestamp
            };

            setItem(newItem);
            await dispatch(updateInventoryStructure({
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

            socketService.emit('inventory_update', updateData);
            onUpdate();
        } catch (error) {
            setError('Ошибка при удалении полуфабриката');
            setItem(initialItem);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOutOfStock = async (type: 'raw' | 'semifinished') => {
        // Если товар уже помечен как "нет в наличии", сразу восстанавливаем
        if (isOutOfStock) {
            await confirmOutOfStock(type);
            return;
        }
        
        // Иначе показываем подтверждение через родительский компонент
        if (onOutOfStockConfirm) {
            onOutOfStockConfirm(category, itemId, itemId, type, () => confirmOutOfStock(type));
        }
    };

    const confirmOutOfStock = async (type: 'raw' | 'semifinished') => {
        try {
            const newItem = { 
                ...item, 
                lastUpdated: new Date().toISOString()
            };
            
            if (type === 'raw' && newItem.raw) {
                const newOutOfStockState = !isOutOfStock;
                setIsOutOfStock(newOutOfStockState);
                
                if (newOutOfStockState) {
                    newItem.raw = {
                        ...newItem.raw,
                        quantity: 0,
                        isOutOfStock: true,
                        filled: true
                    };
                    // Полуфабрикат не трогаем - он может существовать независимо от сырья
                } else {
                    newItem.raw = {
                        ...newItem.raw,
                        quantity: 0,
                        isOutOfStock: false,
                        filled: false
                    };
                }
            }

            setItem(newItem);
            
            // Создаем специальный payload для случая "нет в наличии"
            const isMarkingOutOfStock = type === 'raw' && !isOutOfStock && newItem.raw?.isOutOfStock;
            
            if (isMarkingOutOfStock) {
                // Используем специальный action для пометки "нет в наличии"
                await dispatch(updateInventoryItem({
                    chatId,
                    category,
                    itemId,
                    item: newItem,
                    customAction: 'out_of_stock' // Добавляем специальный флаг
                })).unwrap();
            } else {
                // Обычное обновление
                await dispatch(updateInventoryItem({
                    chatId,
                    category,
                    itemId,
                    item: newItem
                })).unwrap();
            }

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

            socketService.emit('inventory_update', updateData);
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
        if (!currentActiveItem) return;

        const { type, operation } = currentActiveItem;
        const value = parseInt(currentInputValue, 10);

        if (isNaN(value) || value < 0) {
            console.error('Некорректное значение в поле ввода');
            setCurrentInputValue('');
            setCurrentActiveItem(null); // Сбрасываем активное состояние
            return;
        }

        try {
            setIsLoading(true);
            // <<< УДАЛЯЕМ ЗАДЕРЖКУ >>>
            // await new Promise(resolve => setTimeout(resolve, 4000)); 

            const currentQuantity = item[type]?.quantity ?? 0;
            const newQuantity = operation === 'add' ? currentQuantity + value : Math.max(0, currentQuantity - value);

            const newItem = { 
                ...item, 
                lastUpdated: new Date().toISOString() // Добавляем timestamp
            };
            if (type === 'raw' && newItem.raw) {
                newItem.raw = {
                    ...newItem.raw,
                    quantity: newQuantity,
                    filled: newQuantity > 0,
                    isOutOfStock: false // Сбрасываем isOutOfStock при ручном вводе
                };
            } else if (type === 'semifinished' && newItem.semifinished) {
                newItem.semifinished = {
                    ...newItem.semifinished,
                    quantity: newQuantity,
                    filled: newQuantity > 0
                };
            }

            setItem(newItem); // Обновляем локальное состояние
            
            // Обновляем инвентарь и ждем завершения
            await dispatch(updateInventoryItem({
                chatId,
                category,
                itemId: itemId,
                item: newItem
            })).unwrap();

            // <<< ОБНОВЛЯЕМ ИСТОРИЮ ПОСЛЕ УСПЕШНОГО СОХРАНЕНИЯ >>>
            dispatch(fetchItemHistory({
                chatId: chatId,
                category: category,
                itemId: itemId,
                itemName: itemId
            }));

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
                    itemId: itemId,
                    item: newItem
                }
            };

            socketService.emit('inventory_update', updateData);
            onUpdate(); // Вызываем коллбэк обновления

        } catch (error) {
            console.error('Ошибка при обновлении количества:', error);
            // В случае ошибки можно откатить локальное состояние
            // setItem(initialItem); 
            setError('Не удалось обновить товар');
        } finally {
            setIsLoading(false);
            setCurrentActiveItem(null);
            setCurrentInputValue('');
        }
    };

    const renderItemCard = (type: 'raw' | 'semifinished') => {
        const itemData = type === 'raw' ? item.raw : item.semifinished;
        if (!itemData && type === 'semifinished') return null;

        const value = itemData?.quantity ?? 0;
        const _isFilled = itemData?.filled ?? false;
        const showOutOfStock = type === 'raw' && isOutOfStock;

        return (
            <div key={type} className={`${styles.item} ${isVisible ? styles.visible : ''} ${type === 'semifinished' && isCardExiting ? styles.exit : ''}`}>
                {type === 'semifinished' && (
                    <button
                        className={styles.deleteButton}
                        onClick={_handleRemoveSemifinished}
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
                    </button>
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
                                disabled={isLoading}
                            >
                                {isLoading ? <div className={styles.spinner}></div> : 'OK'}
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

    // SVG иконка графика
    const ChartIcon = (props: React.SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
            <path d="M4 18L10 12L14 16L20 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor" />
            <circle cx="10" cy="12" r="1.5" fill="currentColor" />
            <circle cx="14" cy="16" r="1.5" fill="currentColor" />
            <circle cx="20" cy="8" r="1.5" fill="currentColor" />
        </svg>
    );

    return (
        <div className={styles.container}>
            {/* Иконка графика над карточкой сырья */}
            <div 
                className={styles.chartIconWrapper}
                onClick={() => onShowAnalytics?.()}
                style={{ cursor: 'pointer' }}
            >
                <ChartIcon className={styles.chartIcon} />
                <span className={styles.chartLabel}>График</span>
            </div>
            {renderCards}
            
            {!item.semifinished && (
                <button
                    className={`${styles.addSemifinishedButton} ${isVisible ? styles.visible : ''} ${isExiting ? styles.exit : ''}`}
                    onClick={handleAddSemifinished}
                    disabled={isLoading}
                >
                    <div className={styles.plusIcon}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path
                                d="M12 5v14M5 12h14"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    Добавить полуфабрикат
                </button>
            )}

        </div>
    );
};

export default ItemEdit; 