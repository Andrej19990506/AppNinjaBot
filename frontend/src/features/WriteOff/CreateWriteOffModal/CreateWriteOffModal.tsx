import React, { useState, useRef, useEffect, useCallback, Profiler } from 'react';
import { useAppDispatch } from '@/shared/store/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import styles from '@/features/WriteOff/CreateWriteOffModal/CreateWriteOffModal.module.css';
import { 
    setModalName, 
    setModalReason, 
    setModalQuantity, 
    setModalDescription,
    setModalUnitType,
} from '@/features/WriteOff/store/writeOffSlice';
import { WriteOffReason } from '@/types/writeOff';
import { 
  useDeviceDetection,
  useTouchHandling,
  useAnimationVariants,
} from '@/features/WriteOff/CreateWriteOffModal/hooks';
import { useWriteOffForm } from '@/features/WriteOff/CreateWriteOffModal/hooks/useWriteOffForm';
import {
  InfoModal,
  ReasonSelectionMode,
  DescriptionModal,
  SuccessNotification,
  NormalMode
} from '@/features/WriteOff/CreateWriteOffModal/components';
import { writeOffReasons } from '@/features/WriteOff/CreateWriteOffModal/utils/constants';
import InventorySearch from '@/features/Inventory/InventorySearch';
import SearchResultsDropdown from '@/features/Inventory/SearchResultsDropdown';

interface ReasonInfo extends WriteOffReason {
  description: string;
}

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
    isEditMode?: boolean;
    onRenderCallback: (id: string, phase: string, actualDuration: number, baseDuration: number, startTime: number) => void;
}

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
    isEditMode = false,
    onRenderCallback
}) => {
    const { isMobile, isDesktop, windowWidth } = useDeviceDetection();
    const dispatch = useAppDispatch();
    
    const { 
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

    const isCurrentlyMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
    


    const actualDrawerVariants = isCurrentlyMobile ? mobileDrawerVariants : desktopDrawerVariants;
    const actualOverlayVariants = isCurrentlyMobile ? mobileOverlayVariants : desktopOverlayVariants;
    
    const { 
        handleTouchStart, 
        handleTouchMove, 
        handleTouchEnd, 
        isDragging,
    } = useTouchHandling({ onClose });
    
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
    const [isInventorySearchOpen, setIsInventorySearchOpen] = useState(false);
    const [inventorySearchQuery, setInventorySearchQuery] = useState('');
    const [inventorySearchResults, setInventorySearchResults] = useState([]);
    const [isInventorySearching, setIsInventorySearching] = useState(false);
    
    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const quantityInputRef = useRef<HTMLInputElement>(null);

    const [isClosing, setIsClosing] = useState(false);
    const [isSuccessClosing, setIsSuccessClosing] = useState(false);

    const wasInitialized = useRef(false);

    const handleCloseInfoModal = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) {
            e.stopPropagation();
            if (e.type === 'click' || e.type === 'mousedown') {
                e.preventDefault();
            }
        }
        setInfoModalOpen(null);
    }, []);

    const handleOpenQuantityInput = useCallback(() => {
        setIsQuantityInputOpen(true);
        setTempQuantity(quantity > 0 ? quantity.toString() : '');
    }, [quantity]);

    const handleQuantityInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const value = e.target.value;
        
        if (value === '' || /^\d*$/.test(value)) {
            setTempQuantity(value);
            
            if (value === '') {
                handleQuantityChange(0);
                return;
            }
            
            const numValue = parseInt(value, 10);
            
            if (!isNaN(numValue) && numValue >= 0) {
                handleQuantityChange(numValue);
                
                setShowUnitToggle(true);
            }
        }
    }, [handleQuantityChange]);

    const handleConfirmQuantityInput = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (tempQuantity === '') {
            handleQuantityChange(0);
            setIsQuantityInputOpen(false);
            return;
        }
        
        const numValue = parseInt(tempQuantity, 10);
        
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 999999) {
            handleQuantityChange(numValue);
            
            setShowUnitToggle(true);
        } else {
            setTempQuantity(quantity.toString());
        }
        
        setIsQuantityInputOpen(false);
    }, [handleQuantityChange, tempQuantity, quantity]);

    const handleCancelQuantityInput = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        
        handleQuantityChange(0);
        setTempQuantity('0');
        
        setIsQuantityInputOpen(false);
    }, [handleQuantityChange]);

    const handleSaveDescription = useCallback(() => {
        setIsDescriptionModalOpen(false);
    }, []);

    const handleOpenDescriptionModal = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDescriptionModalOpen(true);
    }, []);

    const handleCloseDescriptionModal = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) {
            e.stopPropagation();
        }
        setIsDescriptionModalOpen(false);
    }, []);

    const handleTextareaTouch = useCallback((e: React.TouchEvent<HTMLTextAreaElement>) => {
        e.stopPropagation();
        
        e.preventDefault();
    }, []);

    const handleSubmit = useCallback(() => {
        
        
        if (!writeOffName || !selectedReason) {
            return;
        }
        
        handleStartSubmitting();
        onSubmit(writeOffName, selectedReason, quantity, writeOffDescription, unitType);
        
        console.log('✅ [handleSubmit] Форма успешно отправлена');
    }, [handleStartSubmitting, onSubmit, writeOffName, selectedReason, quantity, writeOffDescription, unitType, isEditMode]);

    const handleClose = useCallback(() => {
        
        setIsClosing(true);
        
        if (showSuccessNotification) {
            setIsSuccessClosing(true);
            
            setTimeout(() => {
                setShowSuccessNotification(false);
                setIsSuccessClosing(false);
                
                setTimeout(() => {
                    onClose();
                    handleResetForm();
                    setIsClosing(false);
                }, 400);
            }, 400);
        } else {
            setTimeout(() => {
                onClose();
                handleResetForm();
                setIsClosing(false);
            }, 400);
        }
    }, [onClose, showSuccessNotification, handleResetForm]);

    const handleSuccessConfirm = useCallback(() => {
        
        setIsSuccessClosing(true);
        
        setTimeout(() => {
            setShowSuccessNotification(false);
            setIsSuccessClosing(false);
            
            setTimeout(() => {
                handleClose();
            }, 100);
        }, 300);
    }, [handleClose]);

    const handleShowDescription = useCallback(() => {
        setShowDescriptionModal(true);
    }, []);
    
    const handleOpenReasonModal = useCallback(() => {
        setIsReasonSelectionMode(true);
    }, []);
    
    const handleCloseReasonModal = useCallback(() => {
        setIsReasonSelectionMode(false);
    }, []);
    
    useEffect(() => {
        if (isSubmitting && isOpen) {
            setShowSuccessNotification(true);
            setNotificationType(isEditMode ? 'update' : 'create');
        }
        else if (isSuccess && isOpen && showSuccessNotification) {
        }
    }, [isSubmitting, isSuccess, isOpen, isEditMode, showSuccessNotification]);

    useEffect(() => {
        if (isOpen && !wasInitialized.current) {
            dispatch(setModalName(initialName));
            dispatch(setModalReason(initialReason));
            dispatch(setModalQuantity(initialQuantity));
            dispatch(setModalDescription(initialDescription));
            dispatch(setModalUnitType(initialUnitType));
            wasInitialized.current = true;
        }
        if (!isOpen) {
            wasInitialized.current = false;
        }
    }, [isOpen, initialName, initialReason, initialQuantity, initialDescription, initialUnitType, dispatch]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        
        
        
        setTimeout(() => {
            if (!isOpen) {
                return;
            }
            setTempQuantity(quantity.toString());
        }, 0);
    }, [quantity, isOpen, tempQuantity, isQuantityInputOpen]);

    useEffect(() => {
        if (!isOpen) {
            setTempQuantity('1');
            setIsQuantityInputOpen(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                if (nameInputRef.current) {
                    nameInputRef.current.focus();
                }
            }, 100);
        }
    }, [isOpen]);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (isMobile) {
            const target = event.target as HTMLElement;
            const isCloseButton = 
                target.closest('[aria-label="Закрыть"]') || 
                target.closest('.cancelDescriptionButton');

            if (!isCloseButton) {
                return;
            }
        }

        const target = event.target as HTMLElement;
        const isInfoModalClick = target.closest(`.${styles.infoModal}`) || 
                                target.closest(`.${styles.infoModalOverlay}`);
        
        const footerClick = 
            target.closest('[class*="Footer_footer"]') || 
            target.closest('[class*="Footer_createButton"]') || 
            target.closest('[class*="Footer_chatButton"]') || 
            target.closest('[class*="Footer_iconButton"]') || 
            target.closest('[class*="Footer_backButton"]') || 
            target.closest('[data-footer-element="true"]') || 
            target.closest('.footer');
        
        if (modalRef.current && !modalRef.current.contains(event.target as Node) && !isInfoModalClick && !footerClick) {
            onClose();
        }
    }, [isMobile, onClose, modalRef]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, handleClickOutside, isMobile]);

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
            
            if (!isMobile) {
                document.body.classList.add('desktop-modal-open');
                
                hideFooterButtons();
                
                const observer = new MutationObserver((mutations) => {
                    hideFooterButtons();
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
                
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
            showFooterButtons();
        }
        
        return () => {
            document.body.classList.remove('modal-open');
            document.body.classList.remove('desktop-modal-open');
            showFooterButtons();
        };
    }, [isOpen, isMobile]);

    // Функции для работы с футером
    const hideFooterButtons = () => {
        // Используем setTimeout, чтобы гарантировать, что DOM полностью загружен
        setTimeout(() => {  
            const footerElements = document.querySelectorAll('.footer, [class*="Footer_footer"], [class*="footer"]');
            footerElements.forEach((footer, index) => {
                if (footer.closest('.customModalContainer') || 
                    footer.closest('[class*="NormalModeDesktop"]') || 
                    footer.closest('[class*="NormalModeMobile"]')) {
                    return;
                }
                const allButtons = footer.querySelectorAll('button, a.MuiButton-root');
                allButtons.forEach((button) => {
                    if (button instanceof HTMLElement) {
                        if (button.closest('.customModalContainer') || 
                            button.closest('[class*="NormalModeDesktop"]') || 
                            button.closest('[class*="NormalModeMobile"]')) {
                            return;
                        }
                        const buttonClasses = button.className;
                        if (buttonClasses.includes('chatButton') || buttonClasses.includes('iconButton')) {
                            return;
                        }
                        button.style.display = 'none';
                        button.style.opacity = '0';
                        button.style.visibility = 'hidden';
                        button.style.pointerEvents = 'none';
                    }
                });
            });
        }, 100);
    };

    const showFooterButtons = () => {
        setTimeout(() => {
            const footerElements = document.querySelectorAll('.footer, [class*="Footer_footer"], [class*="footer"]');
            footerElements.forEach((footer) => {
                if (footer.closest('.customModalContainer') || 
                    footer.closest('[class*="NormalModeDesktop"]') || 
                    footer.closest('[class*="NormalModeMobile"]')) {
                    return;
                }
                const allButtons = footer.querySelectorAll('button, a.MuiButton-root');
                allButtons.forEach((button) => {
                    if (button instanceof HTMLElement) {
                        if (button.closest('.customModalContainer') || 
                            button.closest('[class*="NormalModeDesktop"]') || 
                            button.closest('[class*="NormalModeMobile"]')) {
                            return;
                        }
                        button.style.display = '';
                        button.style.opacity = '';
                        button.style.visibility = '';
                        button.style.pointerEvents = '';
                    }
                });
            });
        }, 100);
    };

    // Открыть модалку поиска
    const handleOpenInventorySearch = useCallback(() => {
        setIsInventorySearchOpen(true);
        setInventorySearchQuery('');
        setInventorySearchResults([]);
    }, []);
    // Закрыть модалку поиска
    const handleCloseInventorySearch = useCallback(() => {
        setIsInventorySearchOpen(false);
    }, []);
    // Выбор товара из шаблона
    const handleSelectInventoryItem = useCallback((category: string, itemId: string) => {
        // itemId = название товара из шаблона
        handleNameChange(itemId);
        setIsInventorySearchOpen(false);
    }, [handleNameChange]);
    // Поиск по шаблону (заглушка, потом подключим реальный поиск)
    const handleInventorySearch = useCallback((query: string) => {
        setInventorySearchQuery(query);
        setIsInventorySearching(true);
        // TODO: здесь будет реальный поиск по шаблону
        setTimeout(() => {
            // Пример: ищем по inventory_template.json (заглушка)
            setInventorySearchResults([]); // сюда подставить результаты
            setIsInventorySearching(false);
        }, 500);
    }, []);

    // Корректный сброс поиска
    const handleClearInventorySearch = useCallback(() => {
        setInventorySearchQuery('');
        setInventorySearchResults([]);
    }, []);

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
                                
                                const footerClick = 
                                    target.closest('[class*="Footer_footer"]') || 
                                    target.closest('[class*="Footer_createButton"]') || 
                                    target.closest('[class*="Footer_chatButton"]') || 
                                    target.closest('[class*="Footer_iconButton"]') || 
                                    target.closest('[class*="Footer_backButton"]') || 
                                    target.closest('[data-footer-element="true"]') || 
                                    target.closest('.footer');
                                
                                if (footerClick) {
                                    e.stopPropagation();
                                    return;
                                }
                                
                                if (target.classList.contains(styles.modalOverlay) && !showSuccessNotification) {
                                    handleClose();
                                }
                            }}
                        />

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
                            data-dragging={isDragging}
                            layoutId="modal-container"
                            style={{ 
                                touchAction: 'none',
                                y: isDragging ? undefined : 0,
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
                                            
                                            writeOffReasons={writeOffReasons}
                                            handleReasonSelect={handleReasonSelect}
                                            handleDescriptionChange={handleDescriptionChange}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {/* --- Модалка поиска товара из шаблона --- */}
                            <AnimatePresence>
                                {isInventorySearchOpen && (
                                    <div className={styles.infoModalOverlay}>
                                        <motion.div
                                            className={styles.infoModal}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 30 }}
                                            transition={{ duration: 0.3 }}
                                            style={{ maxWidth: 500, width: '95vw', maxHeight: '90vh', overflow: 'hidden' }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <div className={styles.infoModalHeader}>
                                                <h3 className={styles.infoModalTitle}>Выбор товара из шаблона</h3>
                                                <IconButton className={styles.infoModalCloseButton} onClick={handleCloseInventorySearch} aria-label="Закрыть">
                                                    <CloseIcon />
                                                </IconButton>
                                            </div>
                                            <div className={styles.infoModalContent} style={{ padding: 0 }}>
                                                <InventorySearch
                                                    searchQuery={inventorySearchQuery}
                                                    onSearch={handleInventorySearch}
                                                    isFocused={true}
                                                    isSearching={isInventorySearching}
                                                    searchResults={inventorySearchResults}
                                                    onClearSearch={handleClearInventorySearch}
                                                    onSelectResult={handleSelectInventoryItem}
                                                />
                                                {/* Можно добавить SearchResultsDropdown, если нужен отдельный дропдаун */}
                                            </div>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>
                        </motion.div>

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

                        {isMobile && (
                            <>
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

export default React.memo(CreateWriteOffModal, (prevProps, nextProps) => {
    return prevProps.isOpen === nextProps.isOpen;
}); 