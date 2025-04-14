import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Footer.module.css';
import { motion } from 'framer-motion';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AnimatePresence } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
// import { Chat } from '../../types/chat'; // <<< Удаляем неиспользуемый импорт
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DescriptionIcon from '@mui/icons-material/Description';
import AnimatePresenceWrapper from '../common/AnimatePresenceWrapper';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// <<< Определяем тип здесь >>>
interface FooterChatInfo {
  id: string;
  name: string;
}

interface ChatButtonProps {
    selectedChat: FooterChatInfo | null;
    onClick: () => void;
}

const ChatButton: React.FC<ChatButtonProps> = ({ selectedChat, onClick }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setShowTooltip(false);
            }
        };

        if (showTooltip) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showTooltip]);

    if (!selectedChat) return null;

    return (
        <motion.button 
            className={styles.chatButton}
            onClick={() => setShowTooltip(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            <div className={styles.chatInfo}>
                <motion.svg 
                    className={styles.chatIcon} 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none"
                    whileHover={{ rotate: [0, -10, 10, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                >
                    <motion.path 
                        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.663 3.04094 17.0829 4.73812 18.875L2.72681 21.1705C2.44361 21.4937 2.67314 22 3.10288 22H12Z" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                    />
                    <motion.g
                        animate={{ 
                            scale: [1, 1.2, 1],
                            y: [0, -2, 0]
                        }}
                        transition={{ 
                            duration: 1.5,
                            repeat: Infinity,
                            repeatDelay: 2
                        }}
                    >
                        <circle cx="8" cy="12" r="1" fill="currentColor" />
                        <circle cx="12" cy="12" r="1" fill="currentColor" />
                        <circle cx="16" cy="12" r="1" fill="currentColor" />
                    </motion.g>
                </motion.svg>

                <AnimatePresenceWrapper>
                    {showTooltip && (
                        <motion.div 
                            ref={tooltipRef}
                            className={styles.chatTooltip}
                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.8 }}
                            transition={{ type: "spring", damping: 20 }}
                        >
                            <div className={styles.tooltipContent}>
                                <button 
                                    className={styles.tooltipClose}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowTooltip(false);
                                    }}
                                >
                                    ✕
                                </button>
                                <div className={styles.tooltipText}>
                                    {selectedChat.name}
                                </div>
                                <motion.button 
                                    className={styles.changeButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClick();
                                        setShowTooltip(false);
                                    }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Выбрать другой чат
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresenceWrapper>
            </div>
        </motion.button>
    );
};

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
}

const Footer: React.FC<FooterProps> = ({ 
    selectedChat,
    selectedCategory,
    selectedItem,
    onBack,
    onChatSelect,
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
    showModalSteps = true
}) => {
    const navigate = useNavigate();
    const [isTextOverflow, setIsTextOverflow] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);

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

    return (
        <motion.div 
            className={styles.footer}
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
        >
            <div className={`${styles.container} ${showModalActions ? styles.modalActionsActive : ''}`}>
                
                {showModalActions ? (
                    // --- Секция кнопок и шагов модального окна --- 
                    <>
                        {/* --- Левая кнопка (Назад или Отмена) --- */}
                        <motion.button
                            className={`${styles.iconButton} ${(showModalSteps && modalCurrentStep && modalCurrentStep > 1) ? styles.modalBackButton : styles.modalCancelButton}`}
                            onClick={(showModalSteps && modalCurrentStep && modalCurrentStep > 1) ? onModalBack : onModalCancel}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {(showModalSteps && modalCurrentStep && modalCurrentStep > 1) ? 
                                <ArrowBackIcon className={styles.icon} /> : 
                                <CloseIcon className={styles.icon} />
                            }
                        </motion.button>

                        {/* --- Центральный элемент (Индикатор шагов) --- */}
                        <div className={styles.stepIndicatorContainer}>
                            {showModalSteps && modalTotalSteps && modalTotalSteps > 1 && modalCurrentStep && (
                                <span className={styles.stepIndicatorText}>
                                    Шаг {modalCurrentStep} из {modalTotalSteps}
                                </span>
                            )}
                        </div>

                        {/* --- Правая кнопка (Далее или Сохранить) --- */}
                        <motion.button
                            className={`${styles.iconButton} ${(showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? styles.modalNextButton : styles.modalSaveButton} ${((showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? isModalNextDisabled : isModalSaveDisabled) ? styles.disabled : ''}`}
                            onClick={(showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? onModalNext : onModalSave}
                            disabled={(showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? isModalNextDisabled : isModalSaveDisabled}
                            whileHover={!((showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? isModalNextDisabled : isModalSaveDisabled) ? { scale: 1.05 } : {}}
                            whileTap={!((showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? isModalNextDisabled : isModalSaveDisabled) ? { scale: 0.95 } : {}}
                        >
                            {(showModalSteps && modalTotalSteps && modalCurrentStep && modalCurrentStep < modalTotalSteps) ? 
                                <ArrowForwardIcon className={styles.icon} /> : 
                                <CheckIcon className={styles.icon} />
                            }
                        </motion.button>
                    </>
                ) : (
                    // --- Обычные кнопки футера --- 
                    <>
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

                        {/* Кнопка Назад (если есть категория/предмет) */} 
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
                        
                        {/* Контейнер для правых иконок (Настройки, Чат) */} 
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
    
                            {/* Кнопка Чата (если есть) */} 
                            {selectedChat && onChatSelect && (
                                <ChatButton 
                                    selectedChat={selectedChat}
                                    onClick={onChatSelect}
                                />
                            )}
                        </div>
                        
                         {/* Кнопка Создать/Акт (если нужно) - возможно, ее позиционирование нужно будет пересмотреть */} 
                         {showCreateButton && (
                              <motion.div
                                  className={styles.createButtonWrapper}
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                  whileHover={{ scale: isCreateButtonActive ? 1.03 : 1 }}
                                  whileTap={{ scale: isCreateButtonActive ? 0.97 : 1 }}
                              >
                                  <Button
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
                                              e.currentTarget.appendChild(ripple);
                                              
                                              setTimeout(() => {
                                                  ripple.remove();
                                              }, 600);
                                          }
                                          if (onCreateClick) onCreateClick(e);
                                      }}
                                      variant="contained"
                                      disableElevation
                                      sx={{
                                          textTransform: 'none', 
                                          fontWeight: 600,
                                          borderRadius: (theme) => theme.shape.borderRadius * 2,
                                          position: 'relative',
                                          overflow: 'hidden'
                                      }}
                                  >
                                      {createButtonText}
                                  </Button>
                              </motion.div>
                          )}
                         {showGenerateDocButton && hasWriteOffItems && (
                              <motion.div
                                  className={styles.generateDocButtonWrapper}
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                  whileHover={{ scale: hasWriteOffItems ? 1.03 : 1 }}
                                  whileTap={{ scale: hasWriteOffItems ? 0.97 : 1 }}
                              >
                                  <Button
                                      className={`${styles.generateDocButton} ${hasWriteOffItems ? styles.generateDocButtonActive : styles.generateDocButtonDisabled}`}
                                      startIcon={isGeneratingDocument ? 
                                          <CircularProgress size={18} className={styles.generatingSpinner} /> : 
                                          <DescriptionIcon />}
                                      disabled={!hasWriteOffItems || isGeneratingDocument}
                                      onClick={onGenerateDocClick}
                                      variant="contained"
                                      disableElevation
                                      sx={{
                                          textTransform: 'none', 
                                          fontWeight: 600,
                                          borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                                          position: 'relative',
                                          overflow: 'hidden',
                                          backgroundColor: 'var(--success-color)',
                                          '&:hover': {
                                              backgroundColor: 'var(--success-color)'
                                          }
                                      }}
                                  >
                                      {isGeneratingDocument ? 'Создание...' : 'Сформировать акт'}
                                  </Button>
                              </motion.div>
                          )}
                    </>
                )}
            </div>
        </motion.div>
    );
};

Footer.displayName = 'Footer';

export default Footer; 