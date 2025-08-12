import React, { useCallback, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import styles from './CategoryGrid.module.css';
import { socketService } from '@shared/services/socketService';
import { logger } from '@shared/utils/logger';
import { Inventory } from '@/types/inventoryTypes';

interface CategoryGridProps {
    categories: string[];
    onSelect: (category: string) => void;
    inventory: Inventory;
    selectedCategory: string | null;
    chatId: string;
}

const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, onSelect, inventory, selectedCategory, chatId }) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const [focusingUsers, setFocusingUsers] = useState<Record<string, Array<{ userId: string; firstName: string; category: string; photoUrl?: string }>>>({});
    type TooltipState = { key: string; text?: string; name?: string; category?: string; x: number; y: number; sticky?: boolean } | null;
    const [tooltip, setTooltip] = useState<TooltipState>(null);
    const hideTimerRef = useRef<number | null>(null);
    const autoCloseTimerRef = useRef<number | null>(null);
    const lastTouchTsRef = useRef<number>(0);
    const openTouchTsRef = useRef<number>(0);
    
    // Слушаем фокус категории и отображаем аватарки
    useEffect(() => {
        const unsub = socketService.onCategoryFocusUpdate((data: any) => {
            const { chat_id, category, focusing, user_info } = data || {};
            if (!category) return;
            
            const baseURL = (window as any).APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
            const uid = user_info?.userId || user_info?.user_id;
            const firstName = user_info?.first_name || user_info?.firstName;
            const apiBase = baseURL?.includes('/api') ? baseURL : `${baseURL}/api`;
            const photo = uid ? `${apiBase}/v1/users/${uid}/photo` : undefined;
            
            console.log('🔍 [CategoryGrid] Получено событие category_focus_update:', { category, focusing, uid, firstName });
            
            setFocusingUsers(prev => {
                const list = prev[category] ? [...prev[category]] : [];
                const existsIdx = list.findIndex(u => String(u.userId) === String(uid));
                
                if (focusing) {
                    // Пользователь вошел в категорию
                    if (existsIdx === -1 && uid) {
                        console.log('🔍 [CategoryGrid] Добавляем пользователя в категорию:', { category, uid, firstName });
                        list.push({ userId: uid, firstName, category, photoUrl: photo });
                    } else if (existsIdx !== -1) {
                        console.log('🔍 [CategoryGrid] Пользователь уже в категории, обновляем информацию:', { category, uid, firstName });
                        // Обновляем информацию о пользователе
                        list[existsIdx] = { userId: uid, firstName, category, photoUrl: photo };
                    }
                } else {
                    // Пользователь вышел из категории
                    if (existsIdx !== -1) {
                        console.log('🔍 [CategoryGrid] Убираем пользователя из категории:', { category, uid, firstName });
                        list.splice(existsIdx, 1);
                        
                        // 🔍 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Логируем сколько пользователей осталось в категории
                        console.log('🔍 [CategoryGrid] В категории', category, 'осталось пользователей:', list.length);
                    }
                }
                
                const newState = { ...prev, [category]: list };
                console.log('🔍 [CategoryGrid] Новое состояние focusingUsers для категории', category, ':', list);
                return newState;
            });
        });
        return () => unsub();
    }, []);

    // 🔧 НОВОЕ: Запрашиваем текущие статусы сотрудников по категориям при инициализации
    useEffect(() => {
        if (!chatId) {
            console.log('🔍 [CategoryGrid] ChatId не передан, пропускаем запрос статусов');
            return;
        }

        console.log('🔍 [CategoryGrid] Запрашиваем текущие статусы сотрудников для chatId:', chatId);
        
        // Запрашиваем текущий список пользователей в комнате инвентаризации
        socketService.emit('get_room_users', { room: `inventory_${chatId}` });
        
        // Обрабатываем ответ с текущими пользователями
        const handleRoomUsers = (data: any) => {
            if (data.room === `inventory_${chatId}`) {
                console.log('🔍 [CategoryGrid] Получен список пользователей комнаты:', data.users);
                
                // Группируем пользователей по категориям (если у них есть информация о текущей категории)
                const usersByCategory: Record<string, Array<{ userId: string; firstName: string; category: string; photoUrl?: string }>> = {};
                
                data.users.forEach((user: any) => {
                    // Если у пользователя есть информация о текущей категории
                    if (user.current_category) {
                        const category = user.current_category;
                        const baseURL = (window as any).APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                        const apiBase = baseURL?.includes('/api') ? baseURL : `${baseURL}/api`;
                        const photo = user.userId ? `${apiBase}/v1/users/${user.userId}/photo` : undefined;
                        
                        if (!usersByCategory[category]) {
                            usersByCategory[category] = [];
                        }
                        
                        const userInfo = {
                            userId: user.userId || user.user_id || user.sid,
                            firstName: user.first_name || 'Сотрудник',
                            category: category,
                            photoUrl: photo
                        };
                        
                        // Проверяем, нет ли уже такого пользователя в категории
                        const existingUserIndex = usersByCategory[category].findIndex(u => String(u.userId) === String(userInfo.userId));
                        if (existingUserIndex === -1) {
                            usersByCategory[category].push(userInfo);
                            console.log('🔍 [CategoryGrid] Добавлен пользователь в категорию:', { category, userInfo });
                        } else {
                            // Обновляем информацию о существующем пользователе
                            usersByCategory[category][existingUserIndex] = userInfo;
                            console.log('🔍 [CategoryGrid] Обновлен пользователь в категории:', { category, userInfo });
                        }
                    }
                });
                
                console.log('🔍 [CategoryGrid] Сгруппированные пользователи по категориям:', usersByCategory);
                
                // 🔧 НОВОЕ: Обновляем состояние, сохраняя существующих пользователей
                setFocusingUsers(prev => {
                    const newState = { ...prev };
                    
                    // Обновляем только те категории, для которых получили данные
                    Object.keys(usersByCategory).forEach(category => {
                        newState[category] = usersByCategory[category];
                    });
                    
                    console.log('🔍 [CategoryGrid] Обновленное состояние focusingUsers:', newState);
                    return newState;
                });
            }
        };
        
        // Подписываемся на ответ
        const unsubscribe = socketService.subscribe('room_users_list', handleRoomUsers);
        
        // Повторный запрос через 2 секунды для надежности
        const retryTimeout = setTimeout(() => {
            console.log('🔍 [CategoryGrid] Повторный запрос статусов сотрудников');
            socketService.emit('get_room_users', { room: `inventory_${chatId}` });
        }, 2000);
        
        return () => {
            unsubscribe();
            clearTimeout(retryTimeout);
        };
    }, [chatId]);

    // Хелперы для показа тултипа через портал
    const cancelHide = () => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };

    const scheduleHide = () => {
        cancelHide();
        // Если закреплен (sticky), не скрываем по уходу курсора
        if (tooltip?.sticky) return;
        // Во время мобильного автозакрытия не прячем по mouseleave
        if (autoCloseTimerRef.current) { console.debug('[CategoryGrid] scheduleHide ignored (autoClose active)'); return; }
        // Если недавно открывали тачем — игнорируем
        if (openTouchTsRef.current && Date.now() - openTouchTsRef.current < 3200) {
            console.debug('[CategoryGrid] scheduleHide ignored (touch window active)');
            return;
        }
        // logger.debug('[CategoryGrid] scheduleHide start (1000ms)');
        hideTimerRef.current = window.setTimeout(() => {
            // logger.debug('[CategoryGrid] scheduleHide fired');
            setTooltip(prev => (prev?.sticky ? prev : null));
        }, 1000);
    };

    const showTooltip = (key: string, text: string, el: HTMLElement, name?: string, categoryName?: string) => {
        const rect = el.getBoundingClientRect();
        setTooltip({ key, text, name, category: categoryName, x: rect.left + rect.width / 2, y: rect.top - 8, sticky: false });
    };
    const hideTooltip = () => {
        // logger.info('[CategoryGrid] Tooltip close by hideTooltip');
        setTooltip(null);
    };
    const toggleTooltip = (key: string, text: string, el: HTMLElement, name?: string, categoryName?: string) => {
        setTooltip(prev => {
            // Клик по той же аватарке — снимаем закрепление и скрываем
            if (prev?.key === key && prev?.sticky) return null;
            const rect = el.getBoundingClientRect();
            // Устанавливаем закрепленный тултип (клик-режим)
            return { key, text, name, category: categoryName, x: rect.left + rect.width / 2, y: rect.top - 8, sticky: true };
        });
    };

    const startAutoClose = (ms: number) => {
        if (autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = null;
        }
        autoCloseTimerRef.current = window.setTimeout(() => {
            // Минимальная гарантия отображения 2.5 сек при мобильном тапе
            const sinceOpen = Date.now() - openTouchTsRef.current;
            if (openTouchTsRef.current && sinceOpen < 2500) {
                const rest = 2500 - sinceOpen;
                console.debug('[CategoryGrid] autoClose postpone', { rest });
                autoCloseTimerRef.current = window.setTimeout(() => setTooltip(prev => (prev?.sticky ? prev : null)), rest);
                return;
            }
            setTooltip(prev => (prev?.sticky ? prev : null));
        }, ms);
        console.debug('[CategoryGrid] autoClose set', { ms });
    };

    useEffect(() => {
        const onScrollOrResize = () => {
            // Во время мобильного автозакрытия не прячем от скролла/resize
            if (autoCloseTimerRef.current) {
                // logger.debug('[CategoryGrid] scroll/resize ignored (autoClose active)');
                return;
            }
            // logger.info('[CategoryGrid] Tooltip close by scroll/resize');
            setTooltip(prev => (prev?.sticky ? prev : null));
        };
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, []);

    // Закрытие незакрепленного тултипа по тапу вне (мобилки)
    useEffect(() => {
        if (!tooltip || tooltip.sticky) return;
        const onDocTouch = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            // Проверяем путь события: пропускаем, если тап внутри тултипа или аватарки
            const path = (e.composedPath ? e.composedPath() : []) as (EventTarget & { dataset?: DOMStringMap })[];
            const touchesTooltip = path.some((el) => (el as HTMLElement)?.dataset?.tooltipPortal === '1');
            const touchesAvatar = path.some((el) => (el as HTMLElement)?.dataset?.avatar === '1');
            if (touchesTooltip || touchesAvatar) return;
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current);
                autoCloseTimerRef.current = null;
            }
            // logger.info('[CategoryGrid] Tooltip close by touchOutside');
            setTooltip(null);
        };
        document.addEventListener('touchstart', onDocTouch as any, { passive: true } as any);
        return () => {
            document.removeEventListener('touchstart', onDocTouch as any);
        };
    }, [tooltip]);

    // Закрытие закрепленного тултипа по клику вне/ESC
    useEffect(() => {
        if (!tooltip?.sticky) return;
        const handleDocClick = () => { setTooltip(null); };
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setTooltip(null); } };
        document.addEventListener('click', handleDocClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('click', handleDocClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [tooltip?.sticky]);
    const controls = useAnimation();
    
    // Эффект для анимации при монтировании
    useEffect(() => {
        controls.start("show");
    }, [controls]);
    
    // Обработчик колесика мыши для горизонтального скролла
    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;
        
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const scrollAmount = e.deltaY || e.deltaX;
            grid.scrollLeft += scrollAmount;
        };
        
        grid.addEventListener('wheel', handleWheel, { passive: false });
        
        return () => {
            grid.removeEventListener('wheel', handleWheel);
        };
    }, []);
    
    // Добавляем обработчик для сенсорных жестов
    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;
        
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
                grid.scrollLeft += scrollAmount;
                
                // Предотвращаем стандартный скролл страницы
                e.preventDefault();
            }
        };
        
        grid.addEventListener('touchstart', handleTouchStart as EventListener, { passive: false });
        grid.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
        
        return () => {
            grid.removeEventListener('touchstart', handleTouchStart as EventListener);
            grid.removeEventListener('touchmove', handleTouchMove as EventListener);
        };
    }, []);
    
    // Проверяем заполненность категории
    const isCategoryFilled = useCallback((category: string) => {
        const items = inventory[category] || {};
        return Object.values(items).every(item => {
            // Если товар помечен как "нет в наличии", он считается заполненным
            if (item.raw?.isOutOfStock) {
                return true;
            }

            // Проверяем заполненность сырья (должно быть filled === true ИЛИ quantity > 0)
            const isRawFilled = item.raw?.filled === true || (item.raw?.quantity ?? 0) > 0;
            
            // Проверяем наличие и заполненность полуфабриката
            const hasSemifinished = Boolean(item.semifinished);
            const isSemifinishedFilled = hasSemifinished ? 
                (item.semifinished?.filled === true || (item.semifinished?.quantity ?? 0) > 0) : 
                true;
            
            // Товар считается заполненным если:
            // - сырье заполнено (filled === true ИЛИ quantity > 0) И
            // - (либо нет полуфабриката, либо полуфабрикат тоже заполнен)
            return isRawFilled && (!hasSemifinished || isSemifinishedFilled);
        });
    }, [inventory]);

    if (!categories.length) {
        return (
            <motion.div 
                className={styles.placeholder}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <p>Нет доступных категорий</p>
            </motion.div>
        );
    }

    const handleCategoryClick = (category: string) => {
        console.log('Category clicked:', category);
        console.log('Inventory for category:', inventory[category]);
        onSelect(category);
    };

    // Сортируем категории: незаполненные вверху
    const sortedCategories = [...categories].sort((a, b) => {
        const aFilled = isCategoryFilled(a);
        const bFilled = isCategoryFilled(b);
        
        if (aFilled && !bFilled) return 1;
        if (!aFilled && bFilled) return -1;
        return a.localeCompare(b);
    });

    // Анимация для контейнера
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1
            }
        }
    };

    // Анимация для отдельных карточек
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
        }
    };

    return (
        <motion.div 
            className={styles.container}
            variants={containerVariants}
            initial="hidden"
            animate={controls}
        >
            <motion.div 
                className={styles.grid}
                ref={gridRef}
            >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {/* @ts-ignore */}
                <AnimatePresence mode="sync">
                    {sortedCategories.map((category, index) => {
                        const isFilled = isCategoryFilled(category);
                        return (
                            <motion.div
                                key={category}
                                className={`${styles.item} ${isFilled ? styles.filled : ''}`}
                                onClick={() => handleCategoryClick(category)}
                                variants={itemVariants}
                                whileHover={{ 
                                    scale: 1.02,
                                    y: -5,
                                    transition: { duration: 0.2 }
                                }}
                                whileTap={{ scale: 0.98 }}
                                layout
                            >
                                <h3 className={styles.title}>{category}</h3>
                                {focusingUsers[category]?.length ? (
                                    <div className={styles.categoryUsersFooter}>
                                        {focusingUsers[category].map(u => {
                                            const key = `${category}_${String(u.userId)}`;
                                            const text = `${u.firstName ?? 'Сотрудник'} работает с категорией ${category}`;
                                            const isVisible = tooltip?.key === key;
                                            return (
                                                <div key={key} className={styles.avatarWrapper} data-avatar="1"
                                                     onPointerEnter={(e) => { 
                                                         if ((e as any).pointerType === 'touch') return; 
                                                         cancelHide(); 
                                                         showTooltip(key, text, e.currentTarget as HTMLElement, u.firstName ?? 'Сотрудник', category); 
                                                     }}
                                                     onPointerLeave={(e) => {
                                                         if ((e as any).pointerType === 'touch') { console.debug('[CategoryGrid] pointerLeave ignored (touch)'); return; }
                                                         scheduleHide();
                                                     }}
                                                     onClick={(e) => { 
                                                         e.stopPropagation(); 
                                                         // Игнорируем click, если только что был touch (мобильный Tap генерит click)
                                                         if (Date.now() - lastTouchTsRef.current < 500) return;
                                                         toggleTooltip(key, text, e.currentTarget as HTMLElement, u.firstName ?? 'Сотрудник', category); 
                                                     }}
                                                     onMouseDown={(e) => { e.stopPropagation(); }}
                                                      onTouchStart={(e) => { 
                                                          e.stopPropagation();
                                                          // e.preventDefault(); // избегаем ошибки внутри passive listener
                                                          lastTouchTsRef.current = Date.now();
                                                          openTouchTsRef.current = lastTouchTsRef.current;
                                                          cancelHide();
                                                          showTooltip(key, text, e.currentTarget as HTMLElement, u.firstName ?? 'Сотрудник', category);
                                                          startAutoClose(3000);
                                                      }}>
                                                    <img src={u.photoUrl}
                                                         className={styles.categoryUserAvatar}
                                                         alt={text}
                                                          data-avatar="1"
                                                          onClick={(e) => e.stopPropagation()}
                                                          onMouseDown={(e) => e.stopPropagation()}
                                                          onTouchStart={(e) => { 
                                                              e.stopPropagation();
                                                              // e.preventDefault(); // избегаем ошибки внутри passive listener
                                                              lastTouchTsRef.current = Date.now();
                                                              openTouchTsRef.current = lastTouchTsRef.current;
                                                              cancelHide();
                                                              const wrapper = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
                                                              showTooltip(key, text, wrapper, u.firstName ?? 'Сотрудник', category);
                                                              startAutoClose(3000);
                                                          }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}
                                {isFilled && (
                                    <motion.div 
                                        className={styles.checkmark}
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 500,
                                            damping: 30,
                                            delay: 0.1 + index * 0.05
                                        }}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <motion.path 
                                                d="M20 7L9 18L4 13"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ 
                                                    duration: 0.5,
                                                    delay: 0.2 + index * 0.05
                                                }}
                                            />
                                        </svg>
                                    </motion.div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </motion.div>
            {tooltip && (
                <TooltipPortal text={tooltip.text} x={tooltip.x} y={tooltip.y}
                               name={tooltip.name} category={tooltip.category}
                               onPointerEnter={cancelHide}
                               onPointerLeave={scheduleHide}
                               onClickInside={() => cancelHide()} />
            )}
        </motion.div>
    );
};

export default CategoryGrid; 

// Портальный тултип для аватарок
const TooltipPortal: React.FC<{ text?: string; name?: string; category?: string; x: number; y: number; onPointerEnter?: () => void; onPointerLeave?: () => void; onClickInside?: () => void }>
  = ({ text, name, category, x, y, onPointerEnter, onPointerLeave, onClickInside }) => {
    const portalRoot = typeof document !== 'undefined' ? document.body : null;
    if (!portalRoot) return null;
    const style: React.CSSProperties = {
      position: 'fixed',
      top: y - 8,
      left: x,
      transform: 'translate(-50%, -100%)',
      background: 'var(--card-bg, #1f1f1f)',
      color: 'var(--text-primary, #fff)',
      padding: 0,
      borderRadius: 10,
      fontSize: 12,
      lineHeight: 1.25,
      width: 180,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      zIndex: 9999
    };
    const arrowStyle: React.CSSProperties = {
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 0,
      height: 0,
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
      borderBottom: '6px solid var(--card-bg, #1f1f1f)'
    } as React.CSSProperties;
    const headerStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(var(--primary-rgb), 0.12)',
      borderTopLeftRadius: 10, borderTopRightRadius: 10,
      padding: '8px 10px', color: 'var(--text-primary, #fff)'
    };
    const dotStyle: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: 'rgb(var(--primary-rgb))' };
    const bodyStyle: React.CSSProperties = { padding: '8px 10px', color: 'var(--text-secondary, #ddd)' };
    return createPortal(
      <div style={style}
           onClick={(e) => { e.stopPropagation(); onClickInside?.(); }}
           onMouseDown={(e) => e.stopPropagation()}
           onPointerEnter={onPointerEnter}
           onPointerLeave={onPointerLeave}
           data-tooltip-portal="1">
        <div style={headerStyle}><span style={dotStyle} /> {name ?? 'Сотрудник'}</div>
        <div style={bodyStyle}>{text ?? (category ? `Работает с категорией ${category}` : '')}</div>
        <div style={arrowStyle} />
      </div>,
      portalRoot
    );
};