import React, { useState, useRef, useEffect } from 'react';
import styles from './ItemList.module.css';
import { InventoryItem } from '@/types/inventoryTypes';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { removeInventoryItem } from '@/store/slices/inventorySlice';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { socketService } from '@shared/services/socketService';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import CircularProgress from '@mui/material/CircularProgress';

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
    const [_selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [isLoading, _setIsLoading] = useState(false);
    const [_error, _setError] = useState<string | null>(null);
    const { selectedChat } = useAppSelector(state => state.inventory);
    const dispatch = useAppDispatch();
    const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
    // Для отслеживания долгого нажатия
    const longPressRef = useRef<{
        timerId: NodeJS.Timeout | null; 
        itemId: string | null; 
        animationControls: any;
        startPosition: {x: number; y: number} | null;
    }>({
        timerId: null,
        itemId: null,
        animationControls: null,
        startPosition: null
    });
    // Состояние для отслеживания текущего нажимаемого элемента
    const [pressingItemId, setPressingItemId] = useState<string | null>(null);
    // Значение для анимации прогресса
    const pressProgress = useMotionValue(0);
    // Порог движения для отмены долгого нажатия (в пикселях)
    const MOVEMENT_THRESHOLD = 10;
    
    // Эффект для обработки вертикального скролла и преобразования его в горизонтальный
    useEffect(() => {
        const grid = listRef.current;
        if (!grid) return;
        
        const handleWheel = (e: WheelEvent) => {
            // Предотвращаем стандартное поведение скролла
            e.preventDefault();
            
            // Определяем скорость и направление скролла
            const scrollAmount = e.deltaY || e.deltaX;
            
            // Прокручиваем горизонтально
            grid.scrollLeft += scrollAmount;
        };
        
        // Добавляем обработчик события
        grid.addEventListener('wheel', handleWheel, { passive: false });
        
        // Очищаем обработчик при размонтировании
        return () => {
            grid.removeEventListener('wheel', handleWheel);
        };
    }, []);
    
    // Добавляем обработчик для сенсорных жестов для скролла на мобильных
    useEffect(() => {
        const listElement = listRef.current;
        if (!listElement) return;
        
        let touchStartX = 0;
        let touchStartY = 0;
        let lastY = 0;
        let isScrolling = false;
        
        const handleTouchStart = (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            lastY = touchStartY;
            isScrolling = false;
        };
        
        const handleTouchMove = (e: TouchEvent) => {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            
            // Вычисляем дельты
            const deltaX = Math.abs(touchStartX - currentX);
            const deltaY = Math.abs(touchStartY - currentY);
            
            // Определяем направление свайпа
            const direction = currentY > lastY ? 'down' : 'up';
            
            // Мгновенное изменение по Y (для определения скорости)
            const instantDeltaY = lastY - currentY;
            lastY = currentY;
            
            // Начинаем горизонтальный скролл если:
            // 1. Вертикальное движение больше определенного порога ИЛИ
            // 2. Мы уже находимся в режиме скроллинга
            if ((deltaY > 10 && deltaY > deltaX * 0.8) || isScrolling) {
                isScrolling = true;
                
                // Преобразуем вертикальный свайп в горизонтальный скролл
                // Коэффициент преобразования должен быть достаточно высоким
                const scrollFactor = direction === 'up' ? 1.5 : 1.5;
                const scrollAmount = instantDeltaY * scrollFactor;
                
                // Применяем скролл немедленно
                listElement.scrollLeft += scrollAmount;
                
                // Предотвращаем стандартный скролл страницы
                e.preventDefault();
            }
        };
        
        listElement.addEventListener('touchstart', handleTouchStart as EventListener, { passive: false });
        listElement.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
        
        return () => {
            listElement.removeEventListener('touchstart', handleTouchStart as EventListener);
            listElement.removeEventListener('touchmove', handleTouchMove as EventListener);
        };
    }, []);
    
    // Определяем статус товара (заполнен/пуст/нет в наличии)
    const getItemStatus = (item: InventoryItem) => {
        if (!item.raw) return '';
      
        // Самый высокий приоритет — не используется
        if (item.raw.isUnused) return 'unused';
      
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
      const aStatus = getItemStatus(a);
      const bStatus = getItemStatus(b);

      // Новые товары показываем первыми
      const aIsNew = a.raw?.isNew || a.semifinished?.isNew;
      const bIsNew = b.raw?.isNew || b.semifinished?.isNew;
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
  
      // "Не используется" всегда в самом конце
      if (a.raw?.isUnused) return 1;
      if (b.raw?.isUnused) return -1;
  
      // Дальше как было: outOfStock в конец, но перед "не используется"
      if (aStatus === 'outOfStock' && bStatus !== 'outOfStock') return 1;
      if (aStatus !== 'outOfStock' && bStatus === 'outOfStock') return -1;
  
      // Если оба outOfStock — по алфавиту
      if (aStatus === 'outOfStock' && bStatus === 'outOfStock') {
        return a.id.localeCompare(b.id);
      }
  
      // Пустые перед заполненными
      if (aStatus === '' && bStatus === 'filled') return -1;
      if (aStatus === 'filled' && bStatus === '') return 1;
  
      // Остальные — по алфавиту
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
    
    // Filter results for the CURRENT category (for highlighting)
    const currentCategoryResults = searchQuery && searchResults ? 
        searchResults.filter(result => result.category === category) : [];
    
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
    
    // Обработчики долгого нажатия для удаления
    const handleLongPressStart = (itemId: string, event: React.PointerEvent) => {
        // Сохраняем начальную позицию касания
        longPressRef.current.startPosition = {
            x: event.clientX,
            y: event.clientY
        };
        
        // Очищаем предыдущий таймер, если есть
        if (longPressRef.current.timerId) {
            clearTimeout(longPressRef.current.timerId);
            if (longPressRef.current.animationControls) {
                longPressRef.current.animationControls.stop();
            }
        }
        
        setPressingItemId(itemId);
        pressProgress.set(0);
        
        // Запускаем анимацию прогресса
        const animation = animate(pressProgress, 1, {
            duration: 1, // Уменьшаем до 1 секунды
            ease: "linear"
        });
        
        longPressRef.current.animationControls = animation;
        
        // Устанавливаем новый таймер
        longPressRef.current.itemId = itemId;
        longPressRef.current.timerId = setTimeout(() => {
            handleDeleteStart(itemId, itemId);
            // Сбрасываем состояние долгого нажатия
            setPressingItemId(null);
            longPressRef.current = { 
                timerId: null, 
                itemId: null, 
                animationControls: null,
                startPosition: null
            };
        }, 1000); // Уменьшаем до 1000мс (1 секунда)
    };
    
    const handlePointerMove = (event: React.PointerEvent) => {
        // Если нет активного таймера или начальной позиции, ничего не делаем
        if (!longPressRef.current.timerId || !longPressRef.current.startPosition) {
            return;
        }
        
        // Вычисляем перемещение
        const deltaX = Math.abs(event.clientX - longPressRef.current.startPosition.x);
        const deltaY = Math.abs(event.clientY - longPressRef.current.startPosition.y);
        
        // Если перемещение больше порога, отменяем долгое нажатие
        if (deltaX > MOVEMENT_THRESHOLD || deltaY > MOVEMENT_THRESHOLD) {
            handleLongPressEnd();
        }
    };
    
    const handleLongPressEnd = () => {
        // Если пользователь отпустил жест до истечения таймера, отменяем действие
        if (longPressRef.current.timerId) {
            clearTimeout(longPressRef.current.timerId);
            if (longPressRef.current.animationControls) {
                longPressRef.current.animationControls.stop();
            }
            setPressingItemId(null);
            pressProgress.set(0);
            longPressRef.current = { 
                timerId: null, 
                itemId: null, 
                animationControls: null,
                startPosition: null 
            };
        }
    };
    
    // Очистка таймера при размонтировании компонента
    useEffect(() => {
        return () => {
            if (longPressRef.current.timerId) {
                clearTimeout(longPressRef.current.timerId);
            }
            if (longPressRef.current.animationControls) {
                longPressRef.current.animationControls.stop();
            }
        };
    }, []);
    
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
    
    // Анимации для карточек
    const itemVariants = {
        hidden: { 
            opacity: 0,
            y: 20,
            scale: 0.95
        },
        show: { 
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 25
            }
        },
        exit: {
            opacity: 0,
            scale: 0.9,
            transition: {
                duration: 0.2
            }
        }
    };
    
    return (
        <div className={`${styles.container} ${searchQuery ? styles.searchModeActive : ''}`}>
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
                <motion.div 
                    ref={listRef}
                    className={styles.list}
                    initial="hidden"
                    animate="show"
                    variants={{
                        show: {
                            transition: {
                                staggerChildren: 0.05,
                                delayChildren: 0.1
                            }
                        }
                    }}
                >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {/* @ts-ignore */}
                    <AnimatePresence mode="sync">
                        {itemsArray.map(({ id: itemId, ...item }) => {
                            const status = getItemStatus(item);
                            const isSearchResult = currentCategoryResults.some(
                                result => result.itemId === itemId
                            );
                            const isPressing = pressingItemId === itemId;
                            const [isEditing, setIsEditing] = useState(false);
                            const [editorAvatar, setEditorAvatar] = useState<string | null>(null);

                            useEffect(() => {
                                const unsubscribe = socketService.onItemEditingUpdate((data: any) => {
                                    if (data?.chat_id !== chatId) return;
                                    if (data?.category !== category) return;
                                    if (data?.item_id !== itemId) return;
                                    setIsEditing(Boolean(data?.editing));
                                    setEditorAvatar(data?.user_info?.photo_url || null);
                                });
                                return () => unsubscribe();
                            }, [chatId, category, itemId]);
                            
                            const isNew =
                                item.raw?.isNew ||
                                // поддерживаем snake_case из бэка
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (item.raw as any)?.is_new ||
                                item.semifinished?.isNew ||
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (item.semifinished as any)?.is_new;

                            return (
                                <motion.div
                                    key={itemId}
                                    className={`${styles.itemCard} ${styles[status]} ${status === 'unused' ? styles.unused : ''} ${isSearchResult ? styles.searchResult : ''} ${isPressing ? styles.pressing : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleItemClick(itemId);
                                    }}
                                    onPointerDown={(e) => handleLongPressStart(itemId, e)}
                                    onPointerMove={handlePointerMove} 
                                    onPointerUp={handleLongPressEnd}
                                    onPointerLeave={handleLongPressEnd}
                                    onPointerCancel={handleLongPressEnd}
                                    variants={itemVariants}
                                    whileHover={{ 
                                        scale: 1.02,
                                        y: -5,
                                        transition: { duration: 0.2 }
                                    }}
                                    whileTap={{ scale: 0.98 }}
                                    layout
                                >
                                    {isNew && (
                                        <div className={styles.newBadge}>
                                            NEW
                                        </div>
                                    )}
                                    <h3 className={styles.itemTitle}>
                                        {isSearchResult ? 
                                            highlightMatch(itemId, searchQuery) : itemId
                                        }
                                    </h3>
                                    
                                    {status === 'filled' && (
                                        <motion.div 
                                            className={styles.filledBadge}
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 500,
                                                damping: 30
                                            }}
                                        />
                                    )}

                                    {/* Индикатор редактирования */}
                                    {isEditing && (
                                        <div className={styles.editingBadge}>
                                            <span className={styles.editingDot} />
                                            <span>Редактирует</span>
                                            {editorAvatar && <img className={styles.editingAvatar} src={editorAvatar} alt="editor" />}
                                        </div>
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
                                    
                                    {/* Прогресс долгого нажатия */}
                                    {isPressing && (
                                        <motion.div 
                                            className={styles.pressProgress}
                                            initial={{ scaleX: 0 }}
                                            animate={{ scaleX: 1 }}
                                            transition={{ duration: 1, ease: "linear" }}
                                        />
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
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