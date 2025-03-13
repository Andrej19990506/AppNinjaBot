import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import styles from './SearchBar.module.css';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    onFocus?: () => void;
    onBlur?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChange,
    placeholder = 'Поиск...',
    className = '',
    onFocus,
    onBlur
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Анимации для иконок
    const iconVariants = {
        initial: { 
            scale: 0.8, 
            opacity: 0.8 
        },
        animate: { 
            scale: 1, 
            opacity: 1,
            transition: {
                duration: 0.2
            }
        },
        exit: { 
            scale: 0.8, 
            opacity: 0,
            transition: {
                duration: 0.1
            }
        },
        tap: { 
            scale: 0.9 
        }
    };

    // Обработчики событий
    const handleFocus = () => {
        setIsFocused(true);
        if (onFocus) onFocus();
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (onBlur) onBlur();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const handleClear = () => {
        onChange('');
        inputRef.current?.focus();
    };

    return (
        <div className={`${styles.searchBar} ${className} ${isFocused ? styles.focused : ''} ${value ? styles.hasValue : ''}`}>
            <motion.div 
                className={styles.searchIcon}
                variants={iconVariants}
                initial="initial"
                animate="animate"
                whileTap="tap"
            >
                <SearchIcon />
            </motion.div>
            
            <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
            />
            
            {value && (
                <motion.button
                    className={styles.clearButton}
                    onClick={handleClear}
                    variants={iconVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    whileHover={{ scale: 1.1 }}
                    whileTap="tap"
                    aria-label="Очистить поиск"
                >
                    <CloseIcon fontSize="small" />
                </motion.button>
            )}
        </div>
    );
};

export default SearchBar; 