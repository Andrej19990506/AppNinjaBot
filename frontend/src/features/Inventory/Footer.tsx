import React, { useRef, useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Footer.module.css';
import { motion } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { 
    toggleShiftDialogMode,
} from '@/features/courierSchedule/store/shiftsSlice/shiftsSlice'; 
import { 
    selectIsShiftDialogOpen, 
    selectShiftDialogMode 
} from '@/features/courierSchedule/store/shiftsSlice/shiftsSelectors'; 
// <<< Определяем тип здесь >>>
interface FooterChatInfo {
  id: string;
  name: string;
}

interface ChatButtonProps {
    selectedChat: FooterChatInfo | null;
    onClick: () => void;
}


// --- Создаем стилизованный компонент для кнопки "Создать событие" --- 
const StyledCreateEventButton = styled(Button)`
    background-color: var(--primary-color) !important;
    color: var(--text-color-on-primary);
    text-transform: none;
    font-weight: 600;
    border-radius: 16px; 

    &:hover {
        background-color: var(--primary-dark) !important;
    }
`;

// --- Создаем стилизованный компонент для кнопки "Сформировать акт" ---
const StyledGenerateDocButton = styled(Button)`
    text-transform: none;
    font-weight: 600;
    border-radius: 12px; // << Фиксированное значение 
    position: relative;
    overflow: hidden;
    background-color: var(--success-color) !important; // Используем CSS переменную
    color: var(--text-color-on-primary);

    &:hover {
        background-color: var(--success-dark) !important;
    }

    &.Mui-disabled { // Стили для неактивного состояния
        background-color: var(--disabled-bg-color) !important;
        color: var(--disabled-text-color);
        cursor: not-allowed;
        // Убираем spinner в disabled состоянии, если он в startIcon
        .MuiCircularProgress-root {
            display: none;
        }
    }
    
    // Стили для спиннера, если он нужен ВНУТРИ кнопки, а не в startIcon
    .generatingSpinner { 
        color: var(--text-color-on-primary);
    }
`;

// --- Создаем стилизованный компонент для ОБЩЕЙ кнопки "Создать/Обновить" ---
const StyledGenericCreateButton = styled(Button)`
    text-transform: none;
    font-weight: 600;
    border-radius: 16px; // Используем то же фиксированное значение, что и для Event
    position: relative;
    overflow: hidden;
    // Добавляем базовые цвета, если нужно (можно переопределить классами)
    background-color: var(--primary-color) !important;
    color: var(--text-color-on-primary);

    &:hover {
        background-color: var(--primary-dark) !important;
    }

    // Стили для disabled состояния (пример)
    &.Mui-disabled {
        background-color: var(--disabled-bg-color) !important;
        color: var(--disabled-text-color);
    }

    // Специфичные стили для "Обновить" можно добавить через класс updateButton,
    // который добавляется в className ниже
    &.updateButton {
        background-color: var(--warning-color) !important; // Пример цвета для Обновить
        &:hover {
            background-color: var(--warning-dark) !important;
        }
    }

    // Стили для ripple эффекта, если нужно
    .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.7);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none; /* Чтобы не мешал кликам */
    }

    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;

interface FooterProps {
    selectedChat?: FooterChatInfo;
    selectedCategory?: string;
    selectedItem?: string;
    onBack: () => void;
    onChatSelect?: () => void;
    showCreateButton?: boolean;
    isCreateButtonActive?: boolean;
    onCreateClick?: (e?: React.MouseEvent) => void;
    createButtonText?: string;
    showGenerateDocButton?: boolean;
    onGenerateDocClick?: () => void;
    isGeneratingDocument?: boolean;
    hasWriteOffItems?: boolean;
    showSettingsButton?: boolean;
    onSettingsClick?: () => void;
    showModalActions?: boolean;
    onModalSave?: () => void;
    isModalSaveDisabled?: boolean;
    onModalCancel?: () => void;
    modalCurrentStep?: number;
    modalTotalSteps?: number;
    onModalBack?: () => void;
    onModalNext?: () => void;
    isModalNextDisabled?: boolean;
    showModalSteps?: boolean;
    showInventorySearchButton?: boolean;
    onInventorySearchClick?: () => void;
    isSearchOpen?: boolean;
    showCreateEventButton?: boolean;
    onCreateEventClick?: () => void;
    modalSaveText?: string;
    modalCancelText?: string;
    showMiddleButton?: boolean;
    onMiddleButtonClick?: () => void;
    middleButtonText?: string;
    rightElement?: React.ReactNode;
    // Новые пропсы для аналитики
    isAnalyticsOpen?: boolean;
    onAnalyticsClose?: () => void;
    // Новые пропсы для активных пользователей
    showActiveUsersButton?: boolean;
    onActiveUsersClick?: () => void;
    activeUsersCount?: number;
    isActiveUsersOpen?: boolean;
    // Новые пропсы для завершения инвентаризации
    showCompleteButton?: boolean;
    onCompleteClick?: () => void;
    isCompleteOpen?: boolean;
}

const Footer: React.FC<FooterProps> = ({ 
    selectedCategory,
    selectedItem,
    onBack,
    showCreateButton = false,
    isCreateButtonActive = false,
    onCreateClick,
    createButtonText = 'Создать',
    showGenerateDocButton = false,
    onGenerateDocClick,
    isGeneratingDocument = false,
    hasWriteOffItems = false,
    showSettingsButton = false,
    onSettingsClick,
    showModalActions = false,
    onModalSave,
    isModalSaveDisabled = false,
    onModalCancel,
    modalCurrentStep = 1,
    modalTotalSteps = 1,
    onModalBack,
    onModalNext,
    isModalNextDisabled = false,
    showModalSteps = true,
    showInventorySearchButton = false,
    onInventorySearchClick,
    isSearchOpen = false,
    showCreateEventButton = false,
    onCreateEventClick,
    modalSaveText,
    modalCancelText,
    showMiddleButton,
    onMiddleButtonClick,
    middleButtonText,
    rightElement,
    isAnalyticsOpen = false,
    onAnalyticsClose,
    showActiveUsersButton = false,
    onActiveUsersClick,
    activeUsersCount = 0,
    isActiveUsersOpen = false,
    showCompleteButton = false,
    onCompleteClick,
    isCompleteOpen = false
}) => {
    const navigate = useNavigate();
    const [isTextOverflow, setIsTextOverflow] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);
    
    // <<< ИЗМЕНЕНИЕ: Получаем состояние из Redux >>>
    const dispatch = useAppDispatch();
    const isShiftDialogOpen = useAppSelector(selectIsShiftDialogOpen);
    const shiftDialogMode = useAppSelector(selectShiftDialogMode);

    // <<< ДОБАВЛЯЕМ ЛОГ >>>
    console.log('[Footer] Rendering. isShiftDialogOpen from Redux:', isShiftDialogOpen);

    // Проверяем переполнение текста
    useEffect(() => {
        const checkOverflow = () => {
            if (textRef.current) {
                const isOverflow = textRef.current.scrollWidth > textRef.current.clientWidth;
                setIsTextOverflow(isOverflow);
            }
        };

        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [selectedCategory, selectedItem]);

    // <<< ИЗМЕНЕНИЕ: Возвращаем тип event, но используем стандартный MouseEvent >>>
    const handleShiftModeToggle = (event: React.MouseEvent) => { 
        event.stopPropagation(); // <<< ОСТАВЛЯЕМ ОСТАНОВКУ ВСПЛЫТИЯ
        dispatch(toggleShiftDialogMode());
    };

    return (
        <motion.div 
            id="app-footer"
            className={styles.footer}
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
        >
            <div className={`${styles.container} ${showModalActions ? styles.modalActionsActive : ''}`}>
                {/* Абсолютно центрированная кнопка Создать событие */}
                {showCreateEventButton && (
                    <div className={styles.absoluteCenterButtonWrapper}>
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <StyledCreateEventButton 
                                className={styles.createButton}
                                startIcon={<AddIcon />}
                                onClick={onCreateEventClick}
                                variant="contained"
                                disableElevation
                                disableRipple
                            >
                                Создать
                            </StyledCreateEventButton>
                        </motion.div>
                    </div>
                )}
                
                {showModalActions ? (
                    // --- Секция кнопок и шагов модального окна --- 
                    <>
                        {/* --- Левая кнопка (Назад или Отмена) --- */}
                        <motion.button
                            className={`${styles.iconButton} ${(showModalSteps && modalCurrentStep && modalCurrentStep > 1) ? styles.modalBackButton : styles.modalCancelButton}`}
                            onClick={(event) => {
                                console.log("[Footer] Нажата кнопка Закрыть/Отмена в модальном окне");
                                event.stopPropagation();
                                if (showModalSteps && modalCurrentStep && modalCurrentStep > 1) {
                                    onModalBack && onModalBack();
                                } else {
                                    onModalCancel && onModalCancel();
                                }
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {(showModalSteps && modalCurrentStep && modalCurrentStep > 1) ? 
                                <ArrowBackIcon className={styles.icon} /> : 
                                <CloseIcon className={styles.icon} />
                            }
                        </motion.button>

                        {/* --- Центральный элемент (Индикатор шагов или Средняя кнопка) --- */}
                        <div className={styles.stepIndicatorContainer}>
                            {showModalSteps && modalTotalSteps && modalTotalSteps > 1 && modalCurrentStep && (
                                <span className={styles.stepIndicatorText}>
                                    Шаг {modalCurrentStep} из {modalTotalSteps}
                                </span>
                            )}
                            {/* Добавляем среднюю кнопку, если она нужна */}
                            {showMiddleButton && onMiddleButtonClick && middleButtonText && (
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    onClick={(event) => {
                                        console.log("[Footer] Нажата средняя кнопка в модальном окне");
                                        event.stopPropagation();
                                        onMiddleButtonClick();
                                    }}
                                    style={{ margin: '0 auto' }}
                                >
                                    {middleButtonText}
                                </Button>
                            )}
                        </div>

                        {/* --- Правая кнопка (Далее или Сохранить) --- */}
                        <motion.button
                            className={`${styles.iconButton} ${(showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? styles.modalNextButton : styles.modalSaveButton} ${((showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? isModalNextDisabled : isModalSaveDisabled) ? styles.disabled : ''}`}
                            onClick={(event) => {
                                console.log("[Footer] Нажата кнопка Далее/Сохранить в модальном окне");
                                event.stopPropagation();
                                if (showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) {
                                    onModalNext && onModalNext();
                                } else {
                                    onModalSave && onModalSave();
                                }
                            }}
                            disabled={(showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? isModalNextDisabled : isModalSaveDisabled}
                            whileHover={!((showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? isModalNextDisabled : isModalSaveDisabled) ? { scale: 1.05 } : {}}
                            whileTap={!((showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? isModalNextDisabled : isModalSaveDisabled) ? { scale: 0.95 } : {}}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                padding: modalSaveText === "Создать уведомление" ? '12px' : undefined
                            }}
                        >
                            {(showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? 
                                <ArrowForwardIcon className={styles.icon} /> : 
                                <CheckIcon className={styles.icon} style={{ fontSize: '24px' }} />
                            }
                            {/* Добавляем текст для кнопки сохранения, если предоставлен */}
                            {modalSaveText && modalSaveText !== "Создать уведомление" && modalSaveText !== "Сохранить" && <span style={{ marginLeft: "4px" }}>{modalSaveText}</span>}
                        </motion.button>
                    </>
                ) : (
                    // --- Обычные кнопки футера --- 
                    <>
                        {/* --- Левая часть --- */}
                        <div className={styles.leftSide}> 
                            {/* Кнопка Домой */} 
                            <motion.button 
                                className={styles.iconButton} 
                                onClick={() => navigate('/')} 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                 <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                 </svg>
                            </motion.button>
                        </div>

                        {/* --- Центральная часть --- */}
                        <div className={styles.centerSide}>
                            {/* <<< Кнопка Назад >>> */}
                            {(selectedCategory || selectedItem) && (
                                <motion.button
                                    className={styles.backButton}
                                    onClick={onBack}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <span className={styles.backArrow}>←</span>
                                    <div className={`${styles.textContainer} ${isTextOverflow ? styles.textOverflow : ''}`}>
                                        <div 
                                            ref={textRef}
                                            className={isTextOverflow ? styles.scrollingText : ''}
                                        >
                                            {selectedItem ? selectedCategory : 'Категории'}
                                        </div>
                                    </div>
                                </motion.button>
                            )}
                            
                            {/* <<< Кнопка Смены/Резерв >>> */}
                            {isShiftDialogOpen && (
                                <motion.button
                                    className={styles.shiftModeButton} 
                                    onClick={handleShiftModeToggle} 
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    {shiftDialogMode === 'shifts' ? 'Резерв' : 'Смены'}
                                </motion.button>
                            )}
                        </div>

                        {/* --- Правая часть --- */}
                        <div className={styles.rightSide}> 
                            {/* Контейнер для правых иконок (Настройки, Чат, Поиск) */} 
                            <div className={styles.rightIconsContainer}> 
                                {/* Кнопка Настройки (если нужно) */} 
                                {showSettingsButton && (
                                    <motion.button
                                        className={`${styles.iconButton} ${styles.settingsButton}`}
                                        onClick={onSettingsClick}
                                        whileHover={{ scale: 1.05, rotate: 45 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <SettingsIcon className={styles.icon} />
                                    </motion.button>
                                )}
        

                                {/* --- НОВАЯ Кнопка Поиска для Инвентаря / Закрытия Аналитики --- */}
                                {(showInventorySearchButton && !isAnalyticsOpen) && (
                                    <motion.button
                                        className={`${styles.iconButton} ${styles.searchInventoryButton}`}
                                        onClick={onInventorySearchClick}
                                        whileHover={{ scale: 1.05, rotate: isSearchOpen ? -5 : 5 }}
                                        whileTap={{ scale: 0.95 }}
                                        title={isSearchOpen ? "Закрыть поиск" : "Поиск по инвентарю"}
                                    >
                                        {isSearchOpen ? 
                                            <CloseIcon className={styles.icon} /> : 
                                            <SearchIcon className={styles.icon} />
                                        }
                                    </motion.button>
                                )}
                                
                                {/* --- Кнопка Активных Пользователей --- */}
                                {(showActiveUsersButton && !isAnalyticsOpen) && (
                                    <motion.button
                                        className={`${styles.iconButton} ${styles.activeUsersButton}`}
                                        onClick={onActiveUsersClick}
                                        whileHover={{ scale: 1.05, rotate: 5 }}
                                        whileTap={{ scale: 0.95 }}
                                        title={isActiveUsersOpen ? 'Закрыть панель активных пользователей' : `Активные пользователи (${activeUsersCount})`}
                                    >
                                        <div className={styles.activeUsersIconWrapper}>
                                            {isActiveUsersOpen ? (
                                                <CloseIcon className={styles.icon} />
                                            ) : (
                                                <PeopleIcon className={styles.icon} />
                                            )}
                                            {activeUsersCount > 0 && !isActiveUsersOpen && (
                                                <span className={styles.activeUsersCount}>
                                                    {activeUsersCount}
                                                </span>
                                            )}
                                        </div>
                                    </motion.button>
                                )}
                                
                                {/* --- Кнопка Завершения Инвентаризации --- */}
                                {(showCompleteButton && !isAnalyticsOpen) && (
                                    <motion.button
                                        className={`${styles.iconButton} ${isCompleteOpen ? styles.closeCompleteButton : styles.completeButton}`}
                                        onClick={onCompleteClick}
                                        whileHover={{ scale: 1.05, rotate: isCompleteOpen ? -5 : 5 }}
                                        whileTap={{ scale: 0.95 }}
                                        title={isCompleteOpen ? 'Закрыть панель завершения' : 'Инвентаризация завершена!'}
                                    >
                                        {isCompleteOpen ? (
                                            <CloseIcon className={styles.icon} />
                                        ) : (
                                            <CheckCircleIcon className={styles.icon} />
                                        )}
                                    </motion.button>
                                )}
                                
                                {/* --- Кнопка Закрытия Аналитики --- */}
                                {isAnalyticsOpen && onAnalyticsClose && (
                                    <motion.button
                                        className={`${styles.iconButton} ${styles.closeAnalyticsButton}`}
                                        onClick={onAnalyticsClose}
                                        whileHover={{ scale: 1.05, rotate: -5 }}
                                        whileTap={{ scale: 0.95 }}
                                        title="Закрыть аналитику"
                                    >
                                        <CloseIcon className={styles.icon} />
                                    </motion.button>
                                )}
                                {/* --- КОНЕЦ Кнопок Поиска/Аналитики --- */}
                            </div>
                            
                            {rightElement && (
                                <div style={{ marginLeft: 12 }}>{rightElement}</div>
                            )}

                            {/* Абсолютно центрированная кнопка Создать/Обновить */}
                            {showCreateButton && (
                                <div className={styles.absoluteCenterButtonWrapper}>
                                    <motion.div
                                        className={styles.createButtonWrapper}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                        whileHover={{ scale: isCreateButtonActive ? 1.03 : 1 }}
                                        whileTap={{ scale: isCreateButtonActive ? 0.97 : 1 }}
                                    >
                                        <StyledGenericCreateButton 
                                            className={`${styles.createButton} ${isCreateButtonActive ? styles.createButtonActive : styles.createButtonDisabled} ${createButtonText === 'Обновить' ? 'updateButton' : ''}`}
                                            startIcon={createButtonText === 'Обновить' ? <RefreshIcon /> : <AddIcon />}
                                            disabled={!isCreateButtonActive}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isCreateButtonActive) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const x = e.clientX - rect.left;
                                                    const y = e.clientY - rect.top;
                                                    const ripple = document.createElement('span');
                                                    ripple.classList.add('ripple-effect');
                                                    ripple.style.left = `${x}px`;
                                                    ripple.style.top = `${y}px`;
                                                    const buttonElement = e.currentTarget as HTMLButtonElement;
                                                    buttonElement.appendChild(ripple);
                                                    setTimeout(() => {
                                                        ripple.remove();
                                                    }, 600);
                                                }
                                                if (onCreateClick) onCreateClick(e);
                                            }}
                                            variant="contained" 
                                            disableElevation 
                                        >
                                            {createButtonText}
                                        </StyledGenericCreateButton>
                                    </motion.div>
                                </div>
                            )}
                            {/* Кнопка Сформировать акт */} 
                            {showGenerateDocButton && hasWriteOffItems && (
                                <motion.div
                                    className={styles.generateDocButtonWrapper}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                    whileHover={{ scale: hasWriteOffItems && !isGeneratingDocument ? 1.03 : 1 }} // Условие для hover
                                    whileTap={{ scale: hasWriteOffItems && !isGeneratingDocument ? 0.97 : 1 }}   // Условие для tap
                                >
                                    {/* Используем стилизованный компонент для акта */}
                                    <StyledGenerateDocButton
                                        className={`${styles.generateDocButton} ${hasWriteOffItems ? styles.generateDocButtonActive : styles.generateDocButtonDisabled}`} // Добавляем классы для доп. стилей если нужно
                                        startIcon={isGeneratingDocument ? 
                                            <CircularProgress size={18} className={styles.generatingSpinner} /> : 
                                            <DescriptionIcon />}
                                        disabled={!hasWriteOffItems || isGeneratingDocument}
                                        onClick={onGenerateDocClick}
                                        variant="contained" // variant можно оставить или убрать, если стили покрывают все
                                        disableElevation // disableElevation можно оставить или убрать
                                        // Убираем sx проп, так как стили теперь в StyledGenerateDocButton
                                    >
                                        {isGeneratingDocument ? 'Создание...' : 'Сформировать акт'}
                                    </StyledGenerateDocButton>
                                </motion.div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};

Footer.displayName = 'Footer';

// Оборачиваем экспорт в React.memo
export default memo(Footer); 