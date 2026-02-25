import React, { useState, useCallback, useEffect, useRef } from 'react';
import styles from '@features/Inventory/ItemEdit.module.css';
import { InventoryItem } from '@/types/inventoryTypes';
import { socketService } from '@shared/services/socketService';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import { updateInventoryItem, updateInventoryStructure, updateProgress, fetchItemHistory, selectHistoryRecordsForItem, saveItemNotes } from '@/store/slices/inventorySlice';
import { showToastNotification } from '@/shared/store/notificationSlice/notificationThunks';
import { NotificationTypes } from '@/shared/store/notificationSlice/notificationTypes';
import NotesModal from '@features/Inventory/components/NotesModal';


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
    onEditingStateChange?: (isEditing: boolean) => void;
    onUnusedConfirm?: (
        category: string,
        itemId: string,
        itemName: string,
        type: 'raw' | 'semifinished',
        onConfirm: () => void
      ) => void;
}

const ItemEdit: React.FC<ItemEditProps> = ({ 
    category, 
    itemId, 
    item: initialItem, 
    onUpdate, 
    chatId, 
    onOutOfStockConfirm,
    onAggressiveChange,
    onEditingStateChange,
    onUnusedConfirm
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [_isAddingItem, _setIsAddingItem] = useState(false);
    const [_error, setError] = useState<string | null>(null);
    const [item, setItem] = useState<InventoryItem>(initialItem);
    const [isOutOfStock, setIsOutOfStock] = useState(initialItem.raw?.isOutOfStock || false);
    const [isUnused, setIsUnused] = useState(
        initialItem.raw?.isUnused ?? false
      );
    const [currentActiveItem, setCurrentActiveItem] = useState<{ type: 'raw' | 'semifinished', operation: 'add' | 'subtract' } | null>(null);
    const [currentInputValue, setCurrentInputValue] = useState('');
    const [isExiting, setIsExiting] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isCardExiting, setIsCardExiting] = useState(false);
    const [notes, setNotes] = useState(item.raw?.notes || item.semifinished?.notes || '');
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isUnusedConfirmOpen, setIsUnusedConfirmOpen] = useState(false);

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
            setIsUnused(currentItem.raw?.isUnused ?? false);
            setNotes(currentItem.raw?.notes || currentItem.semifinished?.notes || '');
        }
    }, [currentInventory, category, itemId, item]);

    // Показываем тост для позиций с warning_unit / warningUnit
    useEffect(() => {
        const raw = item.raw;
        const hasWarningUnit =
            raw?.warningUnit ||
            // поддержка snake_case из бэка
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (raw as any)?.warning_unit;

        if (hasWarningUnit) {
            dispatch(
                showToastNotification(
                    NotificationTypes.WARNING,
                    `Для позиции "${itemId}" обязательно укажите количество в граммах. Например: 1 бутылка "Вода черноголовка 1.5л" = 1500 грамм.`
                )
            );
        }
    // хотим сработать при первом монтировании/смене товара
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, itemId]);

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

    // --- Отслеживание состояния редактирования для скрытия хедера ---
    useEffect(() => {
        const isCurrentlyEditing = isNotesModalOpen || currentActiveItem !== null;
        console.log('🔍 [ItemEdit] Состояние редактирования изменилось:', {
            isNotesModalOpen,
            currentActiveItem,
            isCurrentlyEditing,
            hasOnEditingStateChange: !!onEditingStateChange
        });
        setIsEditing(isCurrentlyEditing);
        
        // Уведомляем родительский компонент об изменении состояния редактирования
        if (onEditingStateChange) {
            onEditingStateChange(isCurrentlyEditing);
        }
    }, [isNotesModalOpen, currentActiveItem, onEditingStateChange]);

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
                    filled: false, // Структура добавлена, но количество не внесено -> не считаем в прогресс
                    notes: ''
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
                        filled: true,
                        notes: newItem.raw.notes || ''
                    };
                    // Полуфабрикат не трогаем - он может существовать независимо от сырья
                } else {
                    newItem.raw = {
                        ...newItem.raw,
                        quantity: 0,
                        isOutOfStock: false,
                        filled: false,
                        notes: newItem.raw.notes || ''
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

    const handleUnused = (type: 'raw' | 'semifinished') => {
        if (type !== 'raw') return;
    
        const willBeUnused = !isUnused;
    
        if (willBeUnused && onUnusedConfirm) {
            onUnusedConfirm(
                category,
                itemId,
                itemId,  // потом замени на item.name, если будет
                type,
                () => confirmUnused(type)
            );
        } else {
            confirmUnused(type);
        }
    };

    const confirmUnused = async (type: 'raw' | 'semifinished') => {
        if (type !== 'raw') return;
      
        try {
          const newUnusedState = !isUnused;
          const newItem: InventoryItem = {
            ...item,
            lastUpdated: new Date().toISOString(),
          };
      
          if (newItem.raw) {
            newItem.raw = {
              ...newItem.raw,
              isUnused: newUnusedState,
              isOutOfStock: newUnusedState ? false : newItem.raw.isOutOfStock, // ← сбрасываем отсутствие
              quantity: newUnusedState ? 0 : newItem.raw.quantity,
              filled: newUnusedState ? true : newItem.raw.filled,
            };
          }
      
          setItem(newItem);
          setIsUnused(newUnusedState);
          if (newUnusedState) setIsOutOfStock(false);
      
          await dispatch(updateInventoryItem({
            chatId,
            category,
            itemId,
            item: newItem,
            customAction: newUnusedState ? 'mark_unused' : 'unmark_unused'
          })).unwrap();
      
          socketService.emit('inventory_update', {
            source: 'client',
            data: {
              metadata: { lastUpdated: new Date().toISOString(), chat_id: chatId },
              type: 'item_update',
              category,
              itemId,
              item: newItem
            }
          });
      
          onUpdate();
        } catch (error) {
          console.error('Ошибка при изменении "Не используется":', error);
          setIsUnused(!isUnused);
          setItem(initialItem);
        }
    };

    const handlePlusClick = (type: 'raw' | 'semifinished') => {
        console.log('🔍 [ItemEdit] Нажата кнопка + для типа:', type);
        setCurrentActiveItem({ type, operation: 'add' });
        setCurrentInputValue('');
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleMinusClick = (type: 'raw' | 'semifinished') => {
        console.log('🔍 [ItemEdit] Нажата кнопка - для типа:', type);
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

    const handleNotesSave = async (newNotes: string) => {
        setNotes(newNotes);
        
        try {
            // Определяем, для какого типа товара сохраняем заметки
            const rawNotes = item.raw ? newNotes : undefined;
            const semifinishedNotes = item.semifinished ? newNotes : undefined;
            
            console.log('🔄 Prepared notes - rawNotes:', rawNotes, 'semifinishedNotes:', semifinishedNotes);
            
            // Используем Redux thunk для сохранения заметок
            const result = await dispatch(saveItemNotes({
                chatId,
                category,
                itemName: itemId,
                rawNotes,
                semifinishedNotes
            })).unwrap();
            
            
            // Обновляем локальное состояние
            const newItem = { 
                ...item, 
                lastUpdated: new Date().toISOString()
            };
            
            // Обновляем заметки для обоих типов товаров
            if (newItem.raw) {
                newItem.raw = {
                    ...newItem.raw,
                    notes: newNotes
                };
            }
            if (newItem.semifinished) {
                newItem.semifinished = {
                    ...newItem.semifinished,
                    notes: newNotes
                };
            }

            setItem(newItem);
            onUpdate();
        } catch (error) {
            console.error('❌ Ошибка при сохранении заметок:', error);
        }
    };

    const handleNotesDelete = async () => {
        console.log('🗑️ handleNotesDelete called - deleting notes');
        await handleNotesSave('');
    };

    const handleOpenNotesModal = () => {
        console.log('🔍 [ItemEdit] Открываем модалку заметок');
        setIsNotesModalOpen(true);
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
                isOutOfStock: false,
                notes: newItem.raw.notes || ''
            };
        } else if (type === 'semifinished' && newItem.semifinished) {
            newItem.semifinished = {
                ...newItem.semifinished,
                quantity: newQuantity,
                filled: newQuantity > 0,
                notes: newItem.semifinished.notes || ''
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
                isOutOfStock: newItem.raw.isOutOfStock,
                notes: newItem.raw.notes || ''
            };
        } else if (type === 'semifinished' && newItem.semifinished) {
            newItem.semifinished = {
                ...newItem.semifinished,
                quantity: newQuantity,
                filled: newQuantity > 0,
                notes: newItem.semifinished.notes || ''
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
                    ) : isUnused && type === 'raw' ? (   // ← добавили условие для isUnused
                        <div className={styles.unusedStatus}>
                        Не используется
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
                        // Поле ввода остаётся как есть — если пользователь уже начал редактировать
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
                            <>
                        {!isUnused && (
                            <button 
                            className={`${styles.outOfStockButton} ${isOutOfStock ? styles.active : ''}`}
                            onClick={() => handleOutOfStock(type)}
                            >
                            {isOutOfStock ? 'Восстановить' : 'Нет в наличии'}
                            </button>
                        )}

                        {type === 'raw' && (
                            <button 
                                className={`${styles.unusedButton} ${isUnused ? styles.active : ''}`}
                                onClick={() => handleUnused(type)}
                             >
                                {isUnused ? 'Возобновить' : 'Не используется'}
                                </button>
                            )}
                            </>
                        )}

                        {/* Кнопки +/- показываем ТОЛЬКО если НЕТ ни outOfStock, ни isUnused */}
                        {(type === 'semifinished' || (!isOutOfStock && !isUnused)) && (
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
        <div className={`${styles.container} ${isNotesModalOpen ? styles.modalOpen : ''}`}>
            {/* Секция заметок - скрывается при открытии модалки */}
            {!isNotesModalOpen && (
                <div className={`${styles.notesSection} ${isVisible ? styles.visible : ''}`}>
                    <div className={styles.notesHeader}>
                        <div className={styles.notesLabel}>
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
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14,2 14,8 20,8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10,9 9,9 8,9"/>
                            </svg>
                            Заметки
                        </div>
                        <button 
                            className={styles.notesButton}
                            onClick={handleOpenNotesModal}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            {notes ? 'Редактировать' : 'Добавить'}
                        </button>
                    </div>
                    
                    {notes && (
                        <div className={styles.notesDisplay}>
                            <div className={styles.notesContent}>
                                {notes}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Дополнительный контейнер для условного рендеринга */}
            <div className={styles.contentContainer}>
                {isNotesModalOpen ? (
                    /* Модальное окно заметок */
                    <NotesModal
                        isOpen={isNotesModalOpen}
                        onClose={() => setIsNotesModalOpen(false)}
                        notes={notes}
                        onSave={handleNotesSave}
                        onDelete={handleNotesDelete}
                        itemName={itemId}
                    />
                ) : (
                    /* Карточки товаров */
                    <>
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
                    </>
                )}
            </div>
        </div>
    );
};

export default ItemEdit; 