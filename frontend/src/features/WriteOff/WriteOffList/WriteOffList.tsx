import React, { forwardRef, useImperativeHandle, useState, useCallback, memo } from 'react';
import { WriteOffItem } from '@/types/writeOff';
import { useWriteOffAnimations } from '@/features/WriteOff/WriteOffList/hooks/useWriteOffAnimations';
import { useIsMobile } from '@/features/WriteOff/WriteOffList/hooks/useMediaQuery';
import WriteOffListMobile from '@/features/WriteOff/WriteOffList/components/WriteOffListMobile';
import WriteOffListDesktop from '@/features/WriteOff/WriteOffList/components/WriteOffListDesktop';


// Интерфейс для ref
export interface WriteOffListRef {
  startRemoveAnimation: (id: string) => void;
  markItemAsPermanentlyRemoved: (id: string) => void;
  cancelRemoveAnimation: (id: string) => void;
  clearAllRemovingItems: () => void;
}

// Интерфейс для props
export interface WriteOffListProps {
  items: WriteOffItem[];
  onEdit: (item: WriteOffItem) => void;
  onDelete: (item: WriteOffItem) => void;
  onClone?: (item: WriteOffItem) => void;
  onAddNew?: () => void;
  mobileBreakpoint?: number;
}

/**
 * Компонент списка списаний, выбирающий между мобильной и десктопной версиями
 * в зависимости от размера экрана
 */
const WriteOffList = memo(forwardRef<WriteOffListRef, WriteOffListProps>((props, ref) => {
  const { items, onEdit, onDelete, onClone, onAddNew, mobileBreakpoint = 768 } = props;
  
  // Состояние для управления меню (только для мобильного)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // Используем кастомный хук для управления анимациями
  const { 
    removingItems, 
    removedItems,
    startRemoveAnimation,
    markItemAsPermanentlyRemoved,
    cancelRemoveAnimation,
    clearAllRemovingItems 
  } = useWriteOffAnimations(items);
  
  // Проверяем, является ли устройство мобильным
  const isMobile = useIsMobile(mobileBreakpoint);
  
  // Получение текущего выбранного элемента
  const selectedItem = selectedItemId 
    ? items.find(item => item.id === selectedItemId) || null
    : null;
  
  // Экспортируем методы через ref
  useImperativeHandle(ref, () => ({
    startRemoveAnimation,
    markItemAsPermanentlyRemoved,
    cancelRemoveAnimation,
    clearAllRemovingItems
  }));
  
  // Обработчики с использованием useCallback для предотвращения лишних ререндеров
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, itemId: string) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedItemId(itemId);
  }, []);
  
  const handleMenuClose = useCallback(() => {
    console.log('Закрытие меню');
    setMenuAnchorEl(null);
    setSelectedItemId(null);
  }, []);
  
  const handleEditClick = useCallback((item: WriteOffItem) => {
    console.log('WriteOffList: Редактирование элемента', item);
    handleMenuClose();
    onEdit(item);
  }, [onEdit, handleMenuClose]);
  
  const handleDeleteClick = useCallback((item: WriteOffItem) => {
    console.log('WriteOffList: Удаление элемента', item);
    handleMenuClose();
    onDelete(item);
  }, [onDelete, handleMenuClose]);
  
  const handleCloneClick = useCallback((item: WriteOffItem) => {
    if (!onClone) return;
    console.log('WriteOffList: Клонирование элемента', item);
    handleMenuClose();
    onClone(item);
  }, [onClone, handleMenuClose]);
  
  // Адаптеры для мобильной версии
  const adaptedHandleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, item: WriteOffItem) => {
    console.log('Адаптер: Открытие меню для элемента', item);
    handleMenuOpen(event, item.id);
  }, [handleMenuOpen]);
  
  const adaptedHandleEditClick = useCallback(() => {
    if (!selectedItem) return;
    console.log('Адаптер: Редактирование элемента', selectedItem);
    handleEditClick(selectedItem);
  }, [selectedItem, handleEditClick]);
  
  const adaptedHandleDeleteClick = useCallback(() => {
    if (!selectedItem) return;
    console.log('Адаптер: Удаление элемента', selectedItem);
    handleDeleteClick(selectedItem);
  }, [selectedItem, handleDeleteClick]);
  
  const adaptedHandleCloneClick = useCallback(() => {
    if (!selectedItem) return;
    console.log('Адаптер: Клонирование элемента', selectedItem);
    handleCloneClick(selectedItem);
  }, [selectedItem, handleCloneClick]);
  
  // Передаем все необходимые свойства и методы для мобильной версии
  const mobileProps = {
    items: items.filter(item => !Array.from(removedItems).includes(item.id)),
    selectedItem,
    menuAnchorEl,
    menuOpen: Boolean(menuAnchorEl),
    handleMenuOpen: adaptedHandleMenuOpen,
    handleMenuClose,
    handleEditClick: adaptedHandleEditClick,
    handleDeleteClick: adaptedHandleDeleteClick,
    handleCloneClick: adaptedHandleCloneClick,
    removingItems: Array.from(removingItems),
    removedItems: Array.from(removedItems),
    onAddNew: onAddNew || (() => {})
  };
  
  // Передаем все необходимые свойства и методы для десктопной версии
  const desktopProps = {
    items,
    removingItems: Array.from(removingItems),
    removedItems: Array.from(removedItems),
    onEdit,
    onDelete,
    onClone,
    onAddNew
  };
  
  // Выбираем версию в зависимости от размера экрана
  return isMobile 
    ? <WriteOffListMobile {...mobileProps} />
    : <WriteOffListDesktop {...desktopProps} />;
}));

// Добавляем отображаемое имя для DevTools
WriteOffList.displayName = 'WriteOffList';

export default WriteOffList; 