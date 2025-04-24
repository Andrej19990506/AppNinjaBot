import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { InventoryItem } from '../../types/inventoryTypes';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import { motion } from 'framer-motion';
import styled, { css, keyframes } from 'styled-components';
import AnimatePresenceWrapper from '../common/AnimatePresenceWrapper';

// --- Styled Components --- 

const spinAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const SearchWrapper = styled(motion.div)`
  position: relative;
  width: 100%;
  z-index: 101; /* Выше, чем у дропдауна, если он позиционируется от другого родителя */
`;

const SearchContainerStyled = styled(motion.div)<{ $isFocused?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background: linear-gradient(90deg, var(--background-color) 0%, var(--card-background) 100%);
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-200);
  transition: all var(--transition-normal);
  height: 56px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;

  ${({ $isFocused }) =>
    $isFocused &&
    css`
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px var(--primary-transparent), var(--shadow-md);
      /* transform: translateY(-2px); // Можно вернуть, если нужно */
    `}
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--primary-transparent), transparent);
    opacity: ${({ $isFocused }) => ($isFocused ? 0.15 : 0)};
    transition: opacity var(--transition-normal);
    pointer-events: none;
  }

  [data-theme="dark"] & {
    background: linear-gradient(90deg, var(--card-background) 0%, var(--gray-900) 100%);
    border-color: var(--gray-800);
  }

  @media (max-width: 768px) {
    height: 48px;
    border-radius: var(--radius);
  }
  @media (max-width: 480px) {
    height: 44px;
  }
`;

const IconWrapper = styled(motion.div)<{ $isFocused?: boolean }>`
  margin: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all var(--transition-normal);
  font-size: 24px;

  ${({ $isFocused }) =>
    $isFocused &&
    css`
      color: var(--primary-color);
      transform: scale(1.1);
    `}
  
  @media (max-width: 768px) {
    font-size: 20px;
    margin: 0 12px;
  }
  @media (max-width: 480px) {
    font-size: 18px;
    margin: 0 8px;
  }
`;

const SearchInputStyled = styled.input`
  flex-grow: 1;
  background-color: var(--background-color);
  border: none;
  outline: none;
  padding: 12px 10px;
  color: var(--text-color);
  font-size: 16px;
  transition: all var(--transition-fast);
  height: 100%;
  font-weight: 500;

  &::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
    transition: opacity var(--transition-fast);
    font-style: italic;
  }

  &:focus::placeholder {
    opacity: 0.4;
  }

  @media (max-width: 768px) {
    font-size: 15px;
    padding: 10px 5px;
  }
  @media (max-width: 480px) {
    font-size: 14px;
    padding: 8px 4px;
  }
`;

const ClearButtonStyled = styled(motion.button)`
  background-color: var(--background-color);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin-right: 12px;
  border-radius: 50%;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  width: 32px;
  height: 32px;
  flex-shrink: 0; // Чтобы кнопка не сжималась

  &:hover {
    background-color: var(--primary-color);
    transform: scale(1.15) rotate(90deg);
  }

  &:active {
    transform: scale(0.9);
  }

  svg {
    color: var(--primary-color);
    font-size: 18px;
    transition: all var(--transition-fast);
  }

  &:hover svg {
    color: var(--text-color);
  }
  
  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
    svg { font-size: 16px; }
  }
  @media (max-width: 480px) {
    width: 24px;
    height: 24px;
    margin-right: 8px;
    svg { font-size: 14px; }
  }
`;

const SpinnerContainerStyled = styled(motion.div)`
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    animation: ${spinAnimation} 1.5s linear infinite;
    color: var(--primary-color) !important;
  }
`;

// --- Компонент InventorySearch --- 

interface SearchResult {
  category: string;
  itemId: string;
  item: InventoryItem;
  matches: {
    field: string;
    value: string;
  }[];
}

export interface InventorySearchProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  searchResults: SearchResult[];
  searchQuery: string;
  isFocused: boolean;
  onClearSearch: () => void;
  onSelectResult: (category: string, itemId: string) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
};

const InventorySearch: React.FC<InventorySearchProps> = ({
  onSearch,
  isSearching,
  searchResults,
  searchQuery,
  isFocused,
  onClearSearch,
  onFocusChange,
  onSelectResult
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setLocalQuery(query);
    if (query.length >= 2) {
      onSearch(query);
    } else if (query.length === 0) {
      onClearSearch();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      clearSearch();
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  };

  const clearSearch = () => {
    setLocalQuery('');
    onClearSearch();
    searchInputRef.current?.focus();
  };

  const handleFocus = () => {
    if (!isFocused) {
        console.log('🔍 Фокус на поле поиска');
        if (onFocusChange) {
            onFocusChange(true);
        }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
     // Simpler blur logic might be needed depending on how focus is managed with the new dropdown
     // Original logic relied on specific dropdown structure
     // For now, just call onFocusChange(false) if focus moves outside the input
     // setTimeout(() => {
     //   if (document.activeElement !== searchInputRef.current) {
     //     console.log('🔍 Потеря фокуса с поля поиска');
     //     if (onFocusChange) {
     //       onFocusChange(false);
     //     }
     //   }
     // }, 150); 
     // Let parent handle blur logic for now if needed
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown as any);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown as any);
    };
  }, []);

  console.log('🔍 Рендеринг InventorySearch, parent isFocused:', isFocused);

  // Replace styled components with basic HTML elements + inline styles
  return (
    <div // Replace SearchContainerStyled
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        // Basic styling - use CSS vars for theme support
        backgroundColor: 'var(--card-background)', 
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${isFocused ? 'var(--primary-color)' : 'var(--gray-200)'}`, // Dynamic border based on focus
        transition: 'border-color var(--transition-normal), box-shadow var(--transition-normal)',
        height: '56px',
        boxShadow: isFocused ? `0 0 0 3px var(--primary-transparent), var(--shadow-md)` : 'var(--shadow-sm)', // Dynamic shadow
        overflow: 'hidden'
      }}
    >
      <div // Replace IconWrapper
        style={{
          margin: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isFocused ? 'var(--primary-color)' : 'var(--text-secondary)', // Dynamic color
          transition: 'color var(--transition-normal)',
          fontSize: '24px'
        }}
      >
        <SearchIcon />
      </div>
      
      <input // Replace SearchInputStyled
        ref={searchInputRef}
        type="text"
        placeholder="Поиск товаров по всем категориям..."
        value={localQuery}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        // onBlur={handleBlur} // Temporarily commented out as well
        style={{
          flexGrow: 1,
          backgroundColor: 'transparent', // Keep transparent for container background
          border: 'none',
          outline: 'none',
          padding: '12px 10px',
          color: 'var(--text-color)',
          fontSize: '16px',
          height: '100%',
          fontWeight: 500
        }}
      />
      
      <AnimatePresenceWrapper>
        {localQuery && (
          <motion.button // Replace ClearButtonStyled
            onClick={clearSearch}
            aria-label="Очистить поиск"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
            style={{
              background: 'var(--primary-transparent)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              marginRight: '12px',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              flexShrink: 0
            }}
          >
            <CloseIcon style={{ color: 'var(--primary-color)', fontSize: '18px' }} />
          </motion.button>
        )}
      </AnimatePresenceWrapper>
      
      <AnimatePresenceWrapper>
        {isSearching && (
          <motion.div // Replace SpinnerContainerStyled
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            style={{
              marginRight: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <CircularProgress size={24} style={{ color: 'var(--primary-color)' }} /> 
          </motion.div>
        )}
      </AnimatePresenceWrapper>
    </div>
  );
};

export default InventorySearch; 