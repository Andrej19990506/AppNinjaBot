import React, { useState, useRef, useEffect, useCallback, useMemo, Profiler } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CheckIcon from '@mui/icons-material/Check';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import styles from './CreateWriteOffModal.module.css';
import Tooltip from '@mui/material/Tooltip';
import { 
    setModalName, 
    setModalReason, 
    setModalQuantity, 
    setModalDescription,
    setModalUnitType,
    setModalSubmitting,
    resetModal
} from '../../../store/slices/writeOffSlice';
import { WriteOffReason } from '../../../types/writeOff';
import { RootState } from '../../../store';
import { store } from '../../../store';
import { AnyAction } from '@reduxjs/toolkit';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import CircularProgress from '@mui/material/CircularProgress';
import Modal from '@mui/material/Modal';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

// Импорт хуков
import { 
  useDeviceDetection,
  useTouchHandling,
  useAnimationVariants,
  usePerformanceOptimization
} from './hooks';
import { useWriteOffForm } from './hooks/useWriteOffForm';

// Импорт компонентов
import {
  InfoModal,
  ReasonSelectionMode,
  DescriptionModal,
  SuccessNotification,
  NormalMode
} from './components';

// Константы
import { writeOffReasons } from './utils/constants';

// Расширяем тип для использования в компоненте
interface ReasonInfo extends WriteOffReason {
  description: string;
}

// Интерфейс для пропсов компонента
interface CreateWriteOffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, reason: WriteOffReason | null, quantity: number, description: string, unitType: 'шт' | 'гр') => void;
    onNameChange?: (name: string) => void;
    onReasonChange?: (reason: WriteOffReason) => void;
    onQuantityChange?: (quantity: number) => void;
    onDescriptionChange?: (description: string) => void;
    onUnitTypeChange?: (unitType: 'шт' | 'гр') => void;
    initialName?: string;
    initialReason?: WriteOffReason | null;
    initialQuantity?: number;
    initialDescription?: string;
    initialUnitType?: 'шт' | 'гр';
    isEditMode?: boolean; // Новый параметр для определения режима редактирования
}

// Добавляем функцию для профилирования производительности
const onRenderCallback = (
    id: string,
    phase: "mount" | "update" | "nested-update",
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
) => {
    // Логируем только если время рендеринга превышает порог (например, 16 мс для 60 FPS)
    if (actualDuration > 16) {
        console.log(`[Profiler] ${id} (${phase}):`, {
            actualDuration,
            baseDuration,
            startTime,
            commitTime,
        });
    }
};

// Функция для скрытия кнопок в футере с использованием setTimeout
const hideFooterButtons = () => {
    // Используем setTimeout, чтобы гарантировать, что DOM полностью загружен
    setTimeout(() => {
        console.log('🔍 Запуск скрытия кнопок в основном футере. Модальные кнопки не должны затрагиваться.');
        
        // Ищем футер по всем возможным классам и атрибутам
        const footerElements = document.querySelectorAll('.footer, [class*="Footer_footer"], [class*="footer"]');
        
        console.log(`🔍 Найдено футеров: ${footerElements.length}`);
        
        footerElements.forEach((footer, index) => {
            // Проверяем, что футер не находится внутри модального окна
            if (footer.closest('.customModalContainer') || 
                footer.closest('[class*="NormalModeDesktop"]') || 
                footer.closest('[class*="NormalModeMobile"]')) {
                console.log(`⚠️ Пропускаем футер #${index+1} внутри модального окна`);
                return;
            }
            
            // Находим все кнопки внутри футера
            const allButtons = footer.querySelectorAll('button, a.MuiButton-root');
            
            console.log(`🔍 В футере #${index+1} найдено кнопок: ${allButtons.length}`);
            
            // Отображаем только кнопки чата и иконки
            allButtons.forEach((button, btnIndex) => {
                if (button instanceof HTMLElement) {
                    // Проверяем, что кнопка не находится внутри модального окна
                    if (button.closest('.customModalContainer') || 
                        button.closest('[class*="NormalModeDesktop"]') || 
                        button.closest('[class*="NormalModeMobile"]')) {
                        console.log(`⚠️ Пропускаем кнопку #${btnIndex+1} внутри модального окна`);
                        return;
                    }
                    
                    // Проверяем классы кнопки
                    const buttonClasses = button.className;
                    
                    // Если это кнопка чата или иконка - оставляем видимой
                    if (buttonClasses.includes('chatButton') || buttonClasses.includes('iconButton')) {
                        console.log(`✅ Оставляем видимой кнопку #${btnIndex+1}: ${buttonClasses.substring(0, 30)}...`);
                        return;
                    }
                    
                    // Скрываем остальные кнопки
                    console.log(`❌ Скрываем кнопку #${btnIndex+1}: ${buttonClasses.substring(0, 30)}...`);
                    button.style.display = 'none';
                    button.style.opacity = '0';
                    button.style.visibility = 'hidden';
                    button.style.pointerEvents = 'none';
                }
            });
        });
        
        // Особый случай: явно не скрываем кнопки внутри модального окна
        const modalButtons = document.querySelectorAll(
            '.customModalContainer button, ' + 
            '.customModalContainer .MuiButton-root, ' + 
            '[class*="NormalModeDesktop"] button, ' + 
            '[class*="NormalModeDesktop"] .MuiButton-root'
        );
        
        console.log(`🔍 Найдено кнопок в модальном окне: ${modalButtons.length}`);
        modalButtons.forEach((button, index) => {
            if (button instanceof HTMLElement) {
                console.log(`✅ Гарантируем видимость модальной кнопки #${index+1}`);
                button.style.display = '';
                button.style.opacity = '';
                button.style.visibility = '';
                button.style.pointerEvents = '';
            }
        });
    }, 100); // Небольшая задержка для гарантии загрузки DOM
};

// Функция для показа кнопок в футере
const showFooterButtons = () => {
    // Используем setTimeout для гарантии работы с DOM
    setTimeout(() => {
        console.log('🔍 Запуск восстановления видимости кнопок в основном футере');
        
        // Ищем футер по всем возможным классам и атрибутам
        const footerElements = document.querySelectorAll('.footer, [class*="Footer_footer"], [class*="footer"]');
        
        console.log(`🔍 Найдено футеров для восстановления: ${footerElements.length}`);
        
        footerElements.forEach((footer, index) => {
            // Проверяем, что футер не находится внутри модального окна
            if (footer.closest('.customModalContainer') || 
                footer.closest('[class*="NormalModeDesktop"]') || 
                footer.closest('[class*="NormalModeMobile"]')) {
                console.log(`⚠️ Пропускаем футер #${index+1} внутри модального окна при восстановлении видимости`);
                return;
            }
            
            // Находим все кнопки в футере
            const allButtons = footer.querySelectorAll('button, a.MuiButton-root');
            
            console.log(`🔍 В футере #${index+1} найдено кнопок для восстановления: ${allButtons.length}`);
            
            // Возвращаем видимость всем кнопкам
            allButtons.forEach((button, btnIndex) => {
                if (button instanceof HTMLElement) {
                    // Проверяем, что кнопка не находится внутри модального окна
                    if (button.closest('.customModalContainer') || 
                        button.closest('[class*="NormalModeDesktop"]') || 
                        button.closest('[class*="NormalModeMobile"]')) {
                        console.log(`⚠️ Пропускаем кнопку #${btnIndex+1} внутри модального окна при восстановлении видимости`);
                        return;
                    }
                    
                    console.log(`✅ Восстанавливаем видимость кнопки #${btnIndex+1} в основном футере`);
                    button.style.display = '';
                    button.style.opacity = '';
                    button.style.visibility = '';
                    button.style.pointerEvents = '';
                }
            });
        });
    }, 100);
};

export const CreateWriteOffModal: React.FC<CreateWriteOffModalProps> = ({ 
    isOpen, 
    onClose,
    onSubmit,
    onNameChange,
    onReasonChange,
    onQuantityChange,
    onDescriptionChange,
    onUnitTypeChange,
    initialName = '',
    initialReason = null,
    initialQuantity = 0,
    initialDescription = '',
    initialUnitType = 'шт',
    isEditMode = false
}) => {
    // Получаем информацию о типе устройства
    const { isMobile, isDesktop, windowWidth } = useDeviceDetection();
    const { 
        drawerVariants,
        overlayVariants,
        mobileDrawerVariants, 
        desktopDrawerVariants,
        mobileOverlayVariants,
        desktopOverlayVariants,
        infoModalVariants, 
        cardVariants, 
        titleVariants, 
        closeButtonVariants,
        _isMobile,
        _windowWidth
    } = useAnimationVariants();

    // Явно вычисляем текущий тип устройства внутри компонента
    const isCurrentlyMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
    
    // Применяем оптимизации для мобильных устройств
    usePerformanceOptimization(isOpen, isCurrentlyMobile);
    
    // Логируем для отладки
    console.log(`[CreateWriteOffModal] Информация о устройстве:`);
    console.log(`  - useDeviceDetection: isMobile=${isMobile}, isDesktop=${isDesktop}, width=${windowWidth}`);
    console.log(`  - useAnimationVariants: _isMobile=${_isMobile}, _windowWidth=${_windowWidth}`);
    console.log(`  - Компонент: isCurrentlyMobile=${isCurrentlyMobile}, window.innerWidth=${typeof window !== 'undefined' ? window.innerWidth : 'N/A'}`);

    // Выбираем актуальные варианты анимаций на основе текущей ширины окна
    const actualDrawerVariants = isCurrentlyMobile ? mobileDrawerVariants : desktopDrawerVariants;
    const actualOverlayVariants = isCurrentlyMobile ? mobileOverlayVariants : desktopOverlayVariants;
    
    const { 
        handleTouchStart, 
        handleTouchMove, 
        handleTouchEnd, 
        isDragging,
        setIsDragging 
    } = useTouchHandling({ onClose });
    
    // Инициализируем dispatch
    const dispatch = useAppDispatch();

    const { 
        writeOffName, 
        selectedReason, 
        quantity, 
        writeOffDescription,
        isSubmitting,
        unitType,
        isSuccess,
        handleNameChange,
        handleReasonSelect,
        handleQuantityChange,
        handleDescriptionChange,
        handleUnitToggle,
        handleStartSubmitting,
        handleResetForm
    } = useWriteOffForm({
        onNameChange,
        onReasonChange,
        onQuantityChange,
        onDescriptionChange,
        onUnitTypeChange
    });

    // Локальные состояния
    const [infoModalOpen, setInfoModalOpen] = useState<string | null>(null);
    const [showDescriptionModal, setShowDescriptionModal] = useState<boolean>(false);
    const [isQuantityInputOpen, setIsQuantityInputOpen] = useState<boolean>(false);
    const [tempQuantity, setTempQuantity] = useState<string>(quantity.toString());
    const [showDescriptionHint, setShowDescriptionHint] = useState<boolean>(true);
    const [showUnitToggle, setShowUnitToggle] = useState<boolean>(false);
    const [showSuccessNotification, setShowSuccessNotification] = useState(false);
    const [notificationType, setNotificationType] = useState<'create' | 'update'>('create');
    const [isReasonSelectionMode, setIsReasonSelectionMode] = useState<boolean>(false);
    const [isGeneratingDocument, setIsGeneratingDocument] = useState<boolean>(false);
    const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState<boolean>(false);
    
    // Refs
    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const quantityInputRef = useRef<HTMLInputElement>(null);

    // Состояние для отслеживания процесса закрытия
    const [isClosing, setIsClosing] = useState(false);

    // Состояние для отслеживания процесса закрытия успешного уведомления
    const [isSuccessClosing, setIsSuccessClosing] = useState(false);

    // Оптимизируем обработчик закрытия модального окна с подсказкой
    const handleCloseInfoModal = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) {
            // Всегда останавливаем всплытие для предотвращения взаимодействия с основным модальным окном
            e.stopPropagation();
            console.log('🔍 [handleCloseInfoModal] - закрытие окна информации', { eventType: e.type });
            
            // Предотвращаем действие по умолчанию только для событий мыши
            if (e.type === 'click' || e.type === 'mousedown') {
                e.preventDefault();
            }
        }
        // Немедленно закрываем модальное окно
        setInfoModalOpen(null);
    }, []);

    // Обработчик открытия ввода количества
    const handleOpenQuantityInput = useCallback(() => {
        setIsQuantityInputOpen(true);
        setTempQuantity(quantity > 0 ? quantity.toString() : '');
    }, [quantity]);

    // Обработчик изменения текстового поля количества
    const handleQuantityInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const value = e.target.value;
        
        // Разрешаем пустую строку или числа
        if (value === '' || /^\d*$/.test(value)) {
            console.log('🔄 [handleQuantityChange] - установка tempQuantity:', value);
            setTempQuantity(value);
            
            // Если строка пустая, устанавливаем количество в 0
            if (value === '') {
                handleQuantityChange(0);
                return;
            }
            
            // Преобразуем строку в число
            const numValue = parseInt(value, 10);
            
            // Проверяем, что число положительное
            if (!isNaN(numValue) && numValue >= 0) {
                handleQuantityChange(numValue);
                
                // Показываем переключатель единиц измерения всегда
                setShowUnitToggle(true);
            }
        }
    }, [handleQuantityChange]);

    // Обработчик подтверждения ввода количества
    const handleConfirmQuantityInput = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Если строка пустая, устанавливаем 0
        if (tempQuantity === '') {
            handleQuantityChange(0);
            setIsQuantityInputOpen(false);
            return;
        }
        
        // Парсим введенное значение
        const numValue = parseInt(tempQuantity, 10);
        
        // Проверяем, что значение валидное
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 999999) {
            handleQuantityChange(numValue);
            
            // Показываем переключатель единиц измерения всегда
            setShowUnitToggle(true);
        } else {
            // Если значение невалидное, возвращаем предыдущее значение
            setTempQuantity(quantity.toString());
        }
        
        // Закрываем поле ввода
        setIsQuantityInputOpen(false);
    }, [handleQuantityChange, tempQuantity, quantity]);

    // Обработчик отмены ввода количества
    const handleCancelQuantityInput = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Сбрасываем значение в 0
        handleQuantityChange(0);
        setTempQuantity('0');
        
        // Закрываем поле ввода
        setIsQuantityInputOpen(false);
    }, [handleQuantityChange]);

    // Оптимизируем обработчик сохранения описания с помощью useCallback
    const handleSaveDescription = useCallback(() => {
        setIsDescriptionModalOpen(false);
    }, []);

    // Оптимизируем обработчик открытия модального окна для добавления описания с помощью useCallback
    const handleOpenDescriptionModal = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDescriptionModalOpen(true);
    }, []);

    // Оптимизируем обработчик закрытия модального окна для добавления описания с помощью useCallback
    const handleCloseDescriptionModal = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) {
            e.stopPropagation(); // Предотвращаем всплытие события
        }
        setIsDescriptionModalOpen(false);
    }, []);

    // Обработчик касания для текстовой области описания
    const handleTextareaTouch = useCallback((e: React.TouchEvent<HTMLTextAreaElement>) => {
        // Предотвращаем всплытие события, чтобы не закрылось модальное окно
        e.stopPropagation();
        
        // Предотвращаем масштабирование при двойном нажатии
        e.preventDefault();
    }, []);

    // Обработчик подтверждения формы
    const handleSubmit = useCallback(() => {
        console.log('🔄 [handleSubmit] Отправка формы списания с данными:', {
            writeOffName,
            selectedReason: selectedReason ? `${selectedReason.id} - ${selectedReason.title}` : 'null',
            quantity,
            writeOffDescription,
            unitType,
            isEditMode
        });
        
        // Проверка валидности данных перед отправкой
        if (!writeOffName || !selectedReason) {
            console.error('❌ [handleSubmit] Ошибка валидации данных:', {
                hasName: !!writeOffName,
                hasReason: !!selectedReason
            });
            return;
        }
        
        handleStartSubmitting();
        onSubmit(writeOffName, selectedReason, quantity, writeOffDescription, unitType);
        
        console.log('✅ [handleSubmit] Форма успешно отправлена');
    }, [handleStartSubmitting, onSubmit, writeOffName, selectedReason, quantity, writeOffDescription, unitType, isEditMode]);

    // Обработчик закрытия модального окна
    const handleClose = useCallback(() => {
        console.log('🔄 [handleClose] Закрытие модального окна');
        
        // Устанавливаем состояние закрытия для запуска анимации
        setIsClosing(true);
        
        // Если уведомление показывается, сначала закрываем его
        if (showSuccessNotification) {
            // Устанавливаем состояние закрытия уведомления
            setIsSuccessClosing(true);
            
            // Запускаем анимацию закрытия уведомления
            setTimeout(() => {
                setShowSuccessNotification(false);
                setIsSuccessClosing(false);
                
                // Затем с задержкой закрываем модальное окно и сбрасываем состояние
                setTimeout(() => {
                    onClose();
                    handleResetForm();
                    setIsClosing(false);
                }, 400); // Задержка для анимации закрытия модального окна
            }, 400); // Задержка для анимации закрытия уведомления
        } else {
            // Добавляем задержку для завершения анимации
            setTimeout(() => {
                onClose();
                handleResetForm();
                setIsClosing(false);
            }, 400); // Задержка должна быть больше, чем длительность анимации выхода (0.35с)
        }
    }, [onClose, showSuccessNotification, handleResetForm]);

    // Обработчик для кнопки OK в уведомлении
    const handleSuccessConfirm = useCallback(() => {
        console.log('🔄 [handleSuccessConfirm] Пользователь нажал OK');
        
        // Активируем анимацию закрытия успешного уведомления
        setIsSuccessClosing(true);
        
        // Даем время для анимации закрытия уведомления
        setTimeout(() => {
            setShowSuccessNotification(false);
            setIsSuccessClosing(false);
            
            // Инициируем закрытие всего модального окна после завершения анимации
            setTimeout(() => {
                handleClose();
            }, 100);
        }, 300);
    }, [handleClose]);

    // Обработчик для открытия модального окна с описанием
    const handleShowDescription = useCallback(() => {
        setShowDescriptionModal(true);
    }, []);
    
    // Обработчик для открытия модального окна выбора причины
    const handleOpenReasonModal = useCallback(() => {
        setIsReasonSelectionMode(true);
    }, []);
    
    // Обработчик для закрытия модального окна выбора причины
    const handleCloseReasonModal = useCallback(() => {
        setIsReasonSelectionMode(false);
    }, []);
    
    // Меняем логику работы с уведомлением
    useEffect(() => {
        // Показываем уведомление при отправке запроса (isSubmitting)
        if (isSubmitting && isOpen) {
            console.log('🔄 [Effect] Начало отправки запроса, показываем уведомление загрузки');
            setShowSuccessNotification(true);
            setNotificationType(isEditMode ? 'update' : 'create');
        }
        // Когда получен успешный ответ, уведомление уже показано, просто обновляем его состояние
        else if (isSuccess && isOpen && showSuccessNotification) {
            console.log('✅ [Effect] Запрос успешно завершен, обновляем уведомление');
        }
    }, [isSubmitting, isSuccess, isOpen, isEditMode, showSuccessNotification]);

    // Инициализация начальных значений и синхронизация с родительским компонентом
    useEffect(() => {
        if (!isOpen) return; // Пропускаем если модальное окно закрыто
        
        console.log('🔄 [Effect] Инициализация модального окна, isSuccess:', isSuccess);
        console.log('🔄 [Effect] Начальные значения:', {
            initialName,
            initialReason: initialReason ? `${initialReason.id} - ${initialReason.title}` : 'null',
            initialQuantity,
            initialDescription,
            initialUnitType,
            isEditMode
        });
        console.log('🔄 [Effect] Текущие значения в Redux:', {
            writeOffName,
            selectedReason: selectedReason ? `${selectedReason.id} - ${selectedReason.title}` : 'null',
            quantity,
            writeOffDescription,
            unitType
        });

        // В режиме редактирования или при открытии модального окна всегда обновляем Redux
        console.log('🔄 [Effect] Обновление значений в Redux');
            
        // Обновляем состояние в Redux через действия
        dispatch(setModalName(initialName));
        
        if (initialReason) {
            dispatch(setModalReason(initialReason));
        }
        
        dispatch(setModalQuantity(initialQuantity));
        dispatch(setModalDescription(initialDescription));
        dispatch(setModalUnitType(initialUnitType));
        
        console.log('✅ [Effect] Значения Redux обновлены при инициализации');
        
        // Обновляем также локальное состояние для количества
        setTempQuantity(initialQuantity.toString());
    }, [isOpen, initialName, initialReason, initialQuantity, initialDescription, initialUnitType, isEditMode, dispatch]);

    // Обновляем tempQuantity при изменении quantity из Redux
    useEffect(() => {
        // Явно проверяем, что модальное окно открыто
        if (!isOpen) {
            console.log('🔄 [Effect] Синхронизация пропущена: модальное окно закрыто');
            return;
        }
        
        console.log('🔄 [Effect] Синхронизация с Redux:', {
            reduxQuantity: quantity,
            currentTempQuantity: tempQuantity,
            isQuantityInputOpen,
            isOpen
        });
        
        // Используем setTimeout для обеспечения правильного порядка обновлений
        setTimeout(() => {
            if (!isOpen) {
                console.log('🔄 [Effect] Синхронизация отменена: модальное окно было закрыто');
                return;
            }
            setTempQuantity(quantity.toString());
        }, 0);
    }, [quantity, isOpen, tempQuantity, isQuantityInputOpen]);

    // Сбрасываем локальное состояние при закрытии модального окна
    useEffect(() => {
        if (!isOpen) {
            console.log('🔄 [Effect] Сброс локального состояния при закрытии модального окна');
            setTempQuantity('1');
            setIsQuantityInputOpen(false);
        }
    }, [isOpen]);

    // Фокусируемся на поле ввода названия при открытии модального окна
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                if (nameInputRef.current) {
                    nameInputRef.current.focus();
                }
            }, 100);
        }
    }, [isOpen]);

    // Обновляем обработчик handleClickOutside с useCallback
    const handleClickOutside = useCallback((event: MouseEvent) => {
        // На мобильных устройствах не закрываем окно при клике вне него
        if (isMobile) {
            // Проверяем, был ли клик по явной кнопке закрытия или отмены
            const target = event.target as HTMLElement;
            const isCloseButton = 
                target.closest('[aria-label="Закрыть"]') || 
                target.closest('.cancelDescriptionButton');

            // Если это не кнопка закрытия - не закрываем окно
            if (!isCloseButton) {
                return;
            }
        }

        // Проверяем, что клик был не по модальному окну с подсказкой
        const target = event.target as HTMLElement;
        const isInfoModalClick = target.closest(`.${styles.infoModal}`) || 
                                target.closest(`.${styles.infoModalOverlay}`);
        
        // Проверяем, что клик был не по футеру или кнопке обновления
        const footerClick = 
            target.closest('[class*="Footer_footer"]') || 
            target.closest('[class*="Footer_createButton"]') || 
            target.closest('[class*="Footer_chatButton"]') || 
            target.closest('[class*="Footer_iconButton"]') || 
            target.closest('[class*="Footer_backButton"]') || 
            target.closest('[data-footer-element="true"]') || 
            target.closest('.footer');
        
        if (modalRef.current && !modalRef.current.contains(event.target as Node) && !isInfoModalClick && !footerClick) {
            console.log('🔄 [handleClickOutside] - пользователь кликнул вне модального окна');
            // Вызываем только внешний обработчик закрытия
            onClose();
        }
    }, [isMobile, onClose, modalRef, styles.infoModal, styles.infoModalOverlay]);

    // Добавляем useEffect для подключения обработчика handleClickOutside
    useEffect(() => {
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, handleClickOutside, isMobile]);

    // Обновляем эффект для управления видимостью кнопок в футере с использованием MutationObserver
    useEffect(() => {
        // Добавляем класс к body при открытии модального окна
        if (isOpen) {
            document.body.classList.add('modal-open');
            
            // Если десктопная версия, добавляем класс для скрытия кнопок в футере
            if (!isMobile) {
                document.body.classList.add('desktop-modal-open');
                
                // Принудительно скрываем кнопки через JS
                hideFooterButtons();
                
                // Создаем MutationObserver для отслеживания изменений в DOM
                const observer = new MutationObserver((mutations) => {
                    // При любых изменениях повторно вызываем функцию скрытия кнопок
                    hideFooterButtons();
                });
                
                // Наблюдаем за изменениями в body (включая все дочерние элементы)
                observer.observe(document.body, {
                    childList: true, // отслеживаем добавление/удаление элементов
                    subtree: true, // включая все дочерние элементы
                    attributes: true, // отслеживаем изменения атрибутов
                    attributeFilter: ['class', 'style'] // только для классов и стилей
                });
                
                // Очищаем observer при размонтировании
                return () => {
                    observer.disconnect();
                    showFooterButtons();
                    document.body.classList.remove('modal-open');
                    document.body.classList.remove('desktop-modal-open');
                };
            }
        } else {
            document.body.classList.remove('modal-open');
            document.body.classList.remove('desktop-modal-open');
            // Показываем кнопки обратно
            showFooterButtons();
        }
        
        return () => {
            document.body.classList.remove('modal-open');
            document.body.classList.remove('desktop-modal-open');
            // Показываем кнопки при размонтировании
            showFooterButtons();
        };
    }, [isOpen, isMobile]);

    return (
        <Profiler id="CreateWriteOffModal" onRender={onRenderCallback}>
            <AnimatePresence mode="wait">
                {(isOpen || isClosing) && (
                    <div className={styles.customModalContainer}>
                        <motion.div 
                            className={styles.modalOverlay}
                            variants={actualOverlayVariants}
                            initial="hidden"
                            animate={isClosing ? "exit" : "visible"}
                            exit="exit"
                            onClick={(e) => {
                                const target = e.target as HTMLElement;
                                
                                // Проверяем, не был ли клик по футеру или его элементам
                                const footerClick = 
                                    target.closest('[class*="Footer_footer"]') || 
                                    target.closest('[class*="Footer_createButton"]') || 
                                    target.closest('[class*="Footer_chatButton"]') || 
                                    target.closest('[class*="Footer_iconButton"]') || 
                                    target.closest('[class*="Footer_backButton"]') || 
                                    target.closest('[data-footer-element="true"]') || 
                                    target.closest('.footer');
                                
                                // Если клик был по футеру, игнорируем его
                                if (footerClick) {
                                    e.stopPropagation();
                                    return;
                                }
                                
                                if (target.classList.contains(styles.modalOverlay) && !showSuccessNotification) {
                                    handleClose();
                                }
                            }}
                        />

                        {/* Добавляем прозрачный оверлей для футера только в мобильной версии */}
                        {isCurrentlyMobile && (
                            <div className={styles.footerOverlay} onClick={(e) => e.stopPropagation()} />
                        )}
                        
                        <motion.div 
                            className={`${styles.drawerContainer} ${!isCurrentlyMobile ? styles.desktopDrawerContainer : ''}`}
                            variants={actualDrawerVariants}
                            initial="hidden"
                            animate={isClosing ? "exit" : "visible"}
                            exit="exit"
                            ref={modalRef}
                            drag={isCurrentlyMobile ? "y" : false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.2}
                            dragTransition={{ 
                                bounceStiffness: 300,
                                bounceDamping: 30 
                            }}
                            onDragStart={() => setIsDragging(true)}
                            onDragEnd={(e, info) => {
                                setIsDragging(false);
                                const velocity = info.velocity.y;
                                const offset = info.offset.y;
                                
                                if (offset > 150 || (offset > 50 && velocity > 500)) {
                                    handleClose();
                                }
                            }}
                            data-dragging={isDragging}
                            layoutId="modal-container"
                            style={{ 
                                touchAction: 'none',
                                y: isDragging ? undefined : 0,
                                // Аппаратное ускорение и оптимизации для плавной анимации
                                ...(isCurrentlyMobile ? {
                                    willChange: "transform",
                                    translateZ: 0,
                                    backfaceVisibility: "hidden" as "hidden"
                                } : {})
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={`${styles.drawerHandle} ${!isCurrentlyMobile ? styles.desktopDrawerHandle : ''}`}>
                                {isCurrentlyMobile ? (
                                    <div className={styles.handleBar} />
                                ) : (
                                    <motion.h2 
                                        className={styles.desktopModalTitle}
                                        variants={titleVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="exit"
                                    >
                                        {isEditMode ? "Редактирование списания" : "Списание товара"}
                                    </motion.h2>
                                )}
                                <motion.div
                                    variants={closeButtonVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                >
                                    <IconButton 
                                        className={styles.closeButton} 
                                        onClick={handleClose}
                                        aria-label="Закрыть"
                                    >
                                        <CloseIcon />
                                    </IconButton>
                                </motion.div>
                            </div>
                            
                            {/* Показываем либо форму создания, либо уведомление об успехе с улучшенными анимациями */}
                            <AnimatePresence mode="wait">
                                {(showSuccessNotification || isSuccessClosing) ? (
                                    <SuccessNotification
                                        key="success-notification"
                                        isSubmitting={isSubmitting}
                                        isSuccess={isSuccess}
                                        type={notificationType}
                                        onConfirm={handleSuccessConfirm}
                                    />
                                ) : isReasonSelectionMode ? (
                                    <ReasonSelectionMode
                                        key="reason-selection"
                                        reasons={writeOffReasons}
                                        selectedReason={selectedReason}
                                        onReasonSelect={handleReasonSelect}
                                        onInfoClick={setInfoModalOpen}
                                        onClose={handleCloseReasonModal}
                                        cardVariants={cardVariants}
                                    />
                                ) : (
                                    <motion.div 
                                        key="normal-mode"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ 
                                          opacity: 1, 
                                          y: 0,
                                          transition: {
                                            type: "spring",
                                            damping: 25,
                                            stiffness: 300
                                          }
                                        }}
                                        exit={{ 
                                          opacity: 0, 
                                          y: -20,
                                          transition: {
                                            duration: 0.35,
                                            ease: "easeInOut"
                                          }
                                        }}
                                        layoutId="form-container"
                                    >
                                        <NormalMode
                                            writeOffName={writeOffName}
                                            handleNameChange={handleNameChange}
                                            writeOffDescription={writeOffDescription}
                                            showDescriptionHint={showDescriptionHint}
                                            setShowDescriptionHint={setShowDescriptionHint}
                                            handleOpenDescriptionModal={handleOpenDescriptionModal}
                                            
                                            quantity={quantity}
                                            unitType={unitType}
                                            handleQuantityChange={handleQuantityChange}
                                            isQuantityInputOpen={isQuantityInputOpen}
                                            tempQuantity={tempQuantity}
                                            handleOpenQuantityInput={handleOpenQuantityInput}
                                            handleQuantityInputChange={handleQuantityInputChange}
                                            handleConfirmQuantityInput={handleConfirmQuantityInput}
                                            handleCancelQuantityInput={handleCancelQuantityInput}
                                            handleUnitToggle={handleUnitToggle}
                                            
                                            selectedReason={selectedReason as ReasonInfo}
                                            handleOpenReasonModal={handleOpenReasonModal}
                                            setInfoModalOpen={setInfoModalOpen}
                                            
                                            nameInputRef={nameInputRef}
                                            quantityInputRef={quantityInputRef}
                                            
                                            onClose={handleClose}
                                            onSubmit={handleSubmit}
                                            isSubmitting={isSubmitting}
                                            isEditMode={isEditMode}
                                            
                                            // Дополнительные параметры для интегрированного подхода в десктопной версии
                                            writeOffReasons={writeOffReasons}
                                            handleReasonSelect={handleReasonSelect}
                                            handleDescriptionChange={handleDescriptionChange}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* Модальное окно с подсказкой сохраняем для отображения информации о причинах,
                            но только для мобильной версии */}
                        <AnimatePresence mode="popLayout">
                                {infoModalOpen && !isDesktop && (
                                    <InfoModal
                                        reason={writeOffReasons.find((r: WriteOffReason) => r.id === infoModalOpen)}
                                        onClose={handleCloseInfoModal}
                                        variants={infoModalVariants}
                                        onRenderCallback={onRenderCallback}
                                    />
                                )}
                        </AnimatePresence>

                        {/* В десктопной версии редактирование описания и выбор причин интегрированы в основное окно */}
                        {isMobile && (
                            <>
                        {/* Модальное окно для добавления подробного описания */}
                        <AnimatePresence mode="popLayout">
                                        {isDescriptionModalOpen && (
                                            <DescriptionModal
                                                description={writeOffDescription}
                                                onChange={handleDescriptionChange}
                                                onClose={handleCloseDescriptionModal}
                                                onSave={handleSaveDescription}
                                                onTouchStart={handleTouchStart}
                                                onTouchMove={handleTouchMove}
                                                onTouchEnd={handleTouchEnd}
                                                onTextareaTouch={handleTextareaTouch}
                                                onRenderCallback={onRenderCallback}
                                            />
                                        )}
                        </AnimatePresence>
                            </>
                        )}
                    </div>
                )}
            </AnimatePresence>
        </Profiler>
    );
};

// Оптимизируем экспорт компонента с помощью React.memo
export default React.memo(CreateWriteOffModal, (prevProps, nextProps) => {
    // Оптимизированное сравнение пропсов для предотвращения ненужных перерендеров
    return prevProps.isOpen === nextProps.isOpen;
}); 