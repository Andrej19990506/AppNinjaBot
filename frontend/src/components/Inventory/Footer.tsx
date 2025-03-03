import React, { useRef, useState, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Footer.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Chat } from '../../types/chat';

// Функция для получения инициалов из названия чата
const getChatInitials = (chatName: string): string => {
    if (!chatName) return '';
    
    const specialCases: Record<string, string> = {
        'словцова': 'СЛ',
        'баумана': 'БМ',
        'ленина': 'ЛН',
        'московская': 'МС',
        'республики': 'РП',
        'пушкина': 'ПШ',
        'горького': 'ГР',
        'гагарина': 'ГГ',
        'кирова': 'КР',
        'советская': 'СВ',
        'победы': 'ПБ',
        'мира': 'МР',
        'центральная': 'ЦТ',
        'заводская': 'ЗВ',
        'фабричная': 'ФБ',
        'школьная': 'ШК',
        'молодежная': 'МЛ',
        'набережная': 'НБ',
        'парковая': 'ПР',
        'садовая': 'СД'
    };

    const normalizedName = chatName.toLowerCase().trim();
    
    for (const [key, value] of Object.entries(specialCases)) {
        if (normalizedName.includes(key)) {
            return value;
        }
    }

    const words = chatName.split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    const firstLetter = chatName[0].toUpperCase();
    const consonants = 'БВГДЖЗКЛМНПРСТФХЦЧШЩ';
    for (let i = 1; i < chatName.length; i++) {
        const letter = chatName[i].toUpperCase();
        if (consonants.includes(letter)) {
            return firstLetter + letter;
        }
    }

    return chatName.substring(0, 2).toUpperCase();
};

interface ChatButtonProps {
    selectedChat: Chat | null;
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

                <AnimatePresence>
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
                </AnimatePresence>
            </div>
        </motion.button>
    );
};

interface FooterProps {
    selectedChat: Chat | null;
    selectedCategory?: string;
    selectedItem?: string;
    onBack?: () => void;
    onChatSelect?: () => void;
}

const Footer = memo<FooterProps>(({ 
    selectedChat,
    selectedCategory,
    selectedItem,
    onBack,
    onChatSelect
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
            <div className={styles.container}>
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
                <ChatButton 
                    selectedChat={selectedChat}
                    onClick={onChatSelect || (() => {})}
                />
            </div>
        </motion.div>
    );
});

Footer.displayName = 'Footer';

export default Footer; 