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
    onOutOfStockConfirm?: (category: string, itemId: string, itemName: string, type: 'raw' | 'semifinished', onConfirm: () => void) => void;
    onAggressiveChange?: (
        category: string, 
        itemId: string, 
        itemName: string, 
        oldQuantity: number, 
        newQuantity: number, 
        changePercent: number, 
        changeType: 'increase' | 'decrease',
        onConfirm: () => void,
        onEdit: () => void,
        averageDailyAmount?: number,
        dailyChangesCount?: number,
        totalHistoryAmount?: number
    ) => void;
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
    onOutOfStockConfirm,
    onAggressiveChange
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

    // Интерфейс для данных агрессивного изменения
    interface AggressiveChangeData {
        oldQuantity: number;
        newQuantity: number;
        changeAmount: number;
        changePercent: number;
        changeType: 'increase' | 'decrease';
        averageDailyAmount: number;
        dailyChangesCount: number;
        totalHistoryAmount: number;
    }

    const inputRef = useRef<HTMLInputElement>(null);
    const _currentTypes = ['raw', item.semifinished ? 'semifinished' : null].filter(Boolean) as ('raw' | 'semifinished')[];
    
    // Получаем данные истории товара из Redux
    const historyData = useAppSelector(selectHistoryRecordsForItem(itemId));
    
    // Функция для анализа агрессивных изменений на основе истории по дням
    const analyzeAggressiveChange = useCallback((type: 'raw' | 'semifinished', newQuantity: number): AggressiveChangeData | null => {
        console.log('🔍 [AggressiveChange] Анализируем изменения для:', { type, newQuantity, historyDataLength: historyData?.length });
        
        if (!historyData || historyData.length === 0) {
            console.log('⚠️ [AggressiveChange] История пуста, пропускаем анализ');
            return null;
        }
        
        const currentQuantity = item[type]?.quantity ?? 0;
        
        // ИСПРАВЛЕНИЕ: Находим последнее значение из истории для сравнения
        const lastHistoryRecord = historyData
            .filter(record => record.type === type && record.new_quantity !== null)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        if (!lastHistoryRecord || lastHistoryRecord.new_quantity === null) {
            console.log('⚠️ [AggressiveChange] Нет предыдущего значения в истории, пропускаем анализ');
            return null;
        }
        
        const previousQuantity = lastHistoryRecord.new_quantity;
        const changeAmount = Math.abs(newQuantity - previousQuantity);
        
        console.log('📊 [AggressiveChange] Текущие данные:', { 
            currentQuantity, 
            previousQuantity, 
            newQuantity, 
            changeAmount 
        });
        
        // Группируем изменения по дням и суммируем их
        const dailyChanges = new Map<string, number>();
        
        historyData.forEach(record => {
            if (record.type === type && record.old_quantity !== null && record.new_quantity !== null) {
                const date = new Date(record.timestamp).toDateString(); // Группируем по дню
                const dayChange = Math.abs(record.new_quantity - record.old_quantity);
                const previousAmount = dailyChanges.get(date) || 0;
                dailyChanges.set(date, previousAmount + dayChange);
                console.log('📅 [AggressiveChange] Запись истории:', { date, oldQuantity: record.old_quantity, newQuantity: record.new_quantity, dayChange });
            }
        });
        
        console.log('📈 [AggressiveChange] Дневные изменения:', Object.fromEntries(dailyChanges));
        
        // Вычисляем среднее значение за все предыдущие дни
        if (dailyChanges.size === 0) {
            console.log('⚠️ [AggressiveChange] Нет дневных изменений, пропускаем анализ');
            return null;
        }
        
        const totalAmount = Array.from(dailyChanges.values()).reduce((sum, amount) => sum + amount, 0);
        const averageDailyAmount = totalAmount / dailyChanges.size;
        
        console.log('📊 [AggressiveChange] Статистика:', { totalAmount, averageDailyAmount, dailyChangesCount: dailyChanges.size });
        
        // ИСПРАВЛЕНИЕ: Сравниваем изменение с предыдущим значением со средним дневным изменением
        const changePercent = (changeAmount / averageDailyAmount) * 100;
        const isAggressiveChange = changePercent > 40;
        
        console.log('⚖️ [AggressiveChange] Результат анализа:', { changePercent, isAggressiveChange, threshold: 40 });
        
        if (isAggressiveChange) {
            const result: AggressiveChangeData = {
                oldQuantity: previousQuantity, // ИСПРАВЛЕНИЕ: используем предыдущее значение
                newQuantity,
                changeAmount,
                changePercent,
                changeType: newQuantity > previousQuantity ? 'increase' : 'decrease',
                averageDailyAmount: Math.round(averageDailyAmount),
                dailyChangesCount: dailyChanges.size,
                totalHistoryAmount: totalAmount
            };
            console.log('🚨 [AggressiveChange] Обнаружено агрессивное изменение:', result);
            return result;
        }
        
        console.log('✅ [AggressiveChange] Изменение в пределах нормы');
        return null;
    }, [historyData, item]);
    
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
            const currentQuantity = item[type]?.quantity ?? 0;
            const newQuantity = action === 'increment' ? currentQuantity + 1 : Math.max(0, currentQuantity - 1);
            
            // Проверяем на агрессивные изменения на основе истории
            const aggressiveChangeData = analyzeAggressiveChange(type, newQuantity);

            if (aggressiveChangeData && onAggressiveChange) {
                // Показываем модальное окно подтверждения
                onAggressiveChange(
                    category,
                    itemId,
                    itemId, // itemName
                    aggressiveChangeData.oldQuantity,
                    aggressiveChangeData.newQuantity,
                    aggressiveChangeData.changePercent,
                    aggressiveChangeData.changeType,
                    // onConfirm - выполняем обновление
                    async () => {
                        await performQuantityChangeUpdate(type, newQuantity, currentTimestamp);
                    },
                    // onEdit - ничего не делаем, пользователь может использовать поле ввода
                    () => {},
                    aggressiveChangeData.averageDailyAmount,
                    aggressiveChangeData.dailyChangesCount,
                    aggressiveChangeData.totalHistoryAmount
                );
                return;
            }

            // Если нет агрессивных изменений, выполняем обновление сразу
            await performQuantityChangeUpdate(type, newQuantity, currentTimestamp);

        } catch (error) {
            console.error('Критическая ошибка при обновлении:', error);
        }
    }, [chatId, category, itemId, item, dispatch, onUpdate, onAggressiveChange]);

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

            const currentQuantity = item[type]?.quantity ?? 0;
            const newQuantity = operation === 'add' ? currentQuantity + value : Math.max(0, currentQuantity - value);

            // Проверяем на агрессивные изменения на основе истории
            const aggressiveChangeData = analyzeAggressiveChange(type, newQuantity);

            if (aggressiveChangeData && onAggressiveChange) {
                // Показываем модальное окно подтверждения
                onAggressiveChange(
                    category,
                    itemId,
                    itemId, // itemName
                    aggressiveChangeData.oldQuantity,
                    aggressiveChangeData.newQuantity,
                    aggressiveChangeData.changePercent,
                    aggressiveChangeData.changeType,
                    // onConfirm - выполняем обновление
                    async () => {
                        await performQuantityUpdate(type, newQuantity);
                    },
                    // onEdit - закрываем модальное окно и возвращаемся к редактированию
                    () => {
                        setCurrentActiveItem(null);
                        setCurrentInputValue('');
                    },
                    aggressiveChangeData.averageDailyAmount,
                    aggressiveChangeData.dailyChangesCount,
                    aggressiveChangeData.totalHistoryAmount
                );
                return;
            }

            // Если нет агрессивных изменений, выполняем обновление сразу
            await performQuantityUpdate(type, newQuantity);

        } catch (error) {
            console.error('Ошибка при обновлении количества:', error);
            console.error('Не удалось обновить товар');
        } finally {
            setIsLoading(false);
            setCurrentActiveItem(null);
            setCurrentInputValue('');
        }
    };

    // Выносим логику обновления количества в отдельную функцию
    const performQuantityUpdate = async (type: 'raw' | 'semifinished', newQuantity: number) => {
        const newItem = { 
            ...item, 
            lastUpdated: new Date().toISOString()
        };
        
        if (type === 'raw' && newItem.raw) {
            newItem.raw = {
                ...newItem.raw,
                quantity: newQuantity,
                filled: newQuantity > 0,
                isOutOfStock: false
            };
        } else if (type === 'semifinished' && newItem.semifinished) {
            newItem.semifinished = {
                ...newItem.semifinished,
                quantity: newQuantity,
                filled: newQuantity > 0
            };
        }

        setItem(newItem);
        
        // Обновляем инвентарь и ждем завершения
        await dispatch(updateInventoryItem({
            chatId,
            category,
            itemId: itemId,
            item: newItem
        })).unwrap();

        // Обновляем историю после успешного сохранения
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
        onUpdate();
    };

    // Выносим логику обновления количества для кнопок +/- в отдельную функцию
    const performQuantityChangeUpdate = async (type: 'raw' | 'semifinished', newQuantity: number, timestamp: string) => {
        const newItem = { 
            ...item, 
            lastUpdated: timestamp
        };
        
        if (type === 'raw' && newItem.raw) {
            newItem.raw = {
                ...newItem.raw,
                quantity: newQuantity,
                filled: newQuantity > 0,
                isOutOfStock: newItem.raw.isOutOfStock
            };
        } else if (type === 'semifinished' && newItem.semifinished) {
            newItem.semifinished = {
                ...newItem.semifinished,
                quantity: newQuantity,
                filled: newQuantity > 0
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
                if (serverItem && serverItem.lastUpdated !== timestamp) {
                    console.warn(`⚠️ [Conflict] Сервер вернул другой timestamp для ${category}/${itemId}:`, {
                        expected: timestamp,
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
                        lastUpdated: timestamp,
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

    return (
        <div className={styles.container}>         
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