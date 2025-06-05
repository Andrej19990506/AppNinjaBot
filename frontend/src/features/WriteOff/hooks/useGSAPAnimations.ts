import { useEffect, useRef, useCallback } from 'react';

/**
 * Хук для управления анимациями в компоненте WriteOff
 */
const useAnimations = () => {
    const headerRef = useRef<HTMLDivElement | null>(null);
    const listContainerRef = useRef<HTMLDivElement | null>(null);
    const footerRef = useRef<HTMLDivElement | null>(null);

    // Функция для анимации появления нового элемента
    const animateNewItem = useCallback((element: HTMLElement) => {
        if (!element) return;
        
        // Добавляем класс с анимацией
        element.classList.add('animate-new-item');
        
        // Удаляем класс после окончания анимации
        setTimeout(() => {
            element.classList.remove('animate-new-item');
        }, 1000);
    }, []);

    // Функция для анимации обновления элемента
    const animateItemUpdate = useCallback((element: HTMLElement) => {
        if (!element) return;
        
        // Добавляем класс с анимацией
        element.classList.add('animate-update-item');
        
        // Удаляем класс после окончания анимации
        setTimeout(() => {
            element.classList.remove('animate-update-item');
        }, 1000);
    }, []);

    // Функция для анимации удаления элемента
    const animateItemRemoval = useCallback((element: HTMLElement) => {
        if (!element) return;
        
        // Добавляем класс с анимацией
        element.classList.add('animate-remove-item');
        
        // Удаляем элемент после окончания анимации
        setTimeout(() => {
            element.classList.add('hidden');
        }, 300);
    }, []);

    // Эффект для запуска анимаций при монтировании компонента
    useEffect(() => {
        const header = headerRef.current;
        const listContainer = listContainerRef.current;
        
        return () => {
            // Очистка, если необходимо
        };
    }, []);

    return {
        headerRef,
        listContainerRef,
        footerRef,
        animateNewItem,
        animateItemUpdate,
        animateItemRemoval
    };
};

export default useAnimations; 