import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InventoryItem } from '../../types/inventoryTypes';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import InventorySearch from './InventorySearch';
import styled, { css, keyframes } from 'styled-components';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CircularProgress from '@mui/material/CircularProgress';

// --- Styled Components --- 

const shimmerAnimation = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const glowPulse = keyframes`
  0% { box-shadow: 0 0 5px 0px var(--primary-transparent); }
  50% { box-shadow: 0 0 15px 2px var(--primary-color); }
  100% { box-shadow: 0 0 5px 0px var(--primary-transparent); }
`;

const floatAnimation = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
  100% { transform: translateY(0px); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const spinAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const SearchDropdownStyled = styled(motion.div)`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--card-background);
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.2), 0 -5px 15px var(--primary-transparent);
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  border: 1px solid var(--border-color);
  border-bottom: none;
  transform-origin: bottom center;
  backdrop-filter: blur(15px);
  will-change: transform, opacity;
  max-height: 80vh;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100px;
    height: 5px;
    background-color: var(--gray-400);
    border-radius: 3px;
    margin-top: 8px;
    opacity: 0.5;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: linear-gradient(to bottom, 
      var(--card-background) 0%, 
      rgba(255,255,255,0) 100%);
    pointer-events: none;
    z-index: 1;
    opacity: 0.8;
    border-top-left-radius: inherit;
    border-top-right-radius: inherit;
  }

  [data-theme="dark"] & {
    border-color: var(--gray-800);
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.4), 0 -5px 15px var(--primary-transparent);
    
    &::before {
      background-color: var(--gray-600);
    }
    
    &::after {
      background: linear-gradient(to bottom, 
        var(--card-background) 0%, 
        rgba(0,0,0,0) 100%);
    }
  }
`;

const SearchDropdownHeader = styled.div`
  padding: 20px 20px 10px;
  position: relative;
  z-index: 5;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, 
      transparent 0%, 
      var(--primary-color) 50%, 
      transparent 100%);
    opacity: 0.3;
  }
`;

const SearchDropdownContentStyled = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  padding: 15px 20px 30px;
  scrollbar-width: thin;
  scrollbar-color: var(--primary-color) transparent;
  overscroll-behavior: contain;
  position: relative;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--primary-color);
    border-radius: 10px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--primary-light);
  }
`;

const ResultListBase = styled.div`
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  margin: 0;
  gap: 12px;
`;

const SearchResultsListStyled = styled(ResultListBase)``;
const SearchHistoryListStyled = styled(ResultListBase)``;

const ResultItemBase = styled(motion.div)`
  padding: 16px;
  background: linear-gradient(120deg, 
    var(--card-background) 0%, 
    var(--background-color) 50%,
    var(--card-background) 100%);
  background-size: 200% 100%;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--text-color);
  box-shadow: var(--shadow-sm);
  will-change: transform, box-shadow, background-position;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 3px;
    background: var(--primary-color);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, 
      transparent 0%, 
      var(--primary-transparent) 50%, 
      transparent 100%);
    background-size: 200% 100%;
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
  }

  &:hover {
    background-position: right center;
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 10px 25px -5px var(--primary-transparent), var(--shadow-md);
    border-color: var(--primary-transparent);
    z-index: 2;
    
    &::before {
      opacity: 1;
    }
    
    &::after {
      opacity: 1;
      animation: ${shimmerAnimation} 2s infinite linear;
    }
  }

  &:active {
    transform: translateY(1px) scale(0.99);
    box-shadow: var(--shadow-sm);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

    
    &::after {
      background: linear-gradient(120deg, 
        transparent 0%, 
        rgba(255, 95, 31, 0.08) 50%, 
        transparent 100%);
    }
  }
`;

const SearchResultItemStyled = styled(ResultItemBase)``;

const SearchHistoryItemStyled = styled(ResultItemBase)`
  padding: 12px 16px;
  color: var(--text-secondary);

  &:hover {
    color: var(--primary-color);
  }
  
  [data-theme="dark"] & {
    /* Forcing dark theme styles with !important for debugging */
    color: var(--text-secondary) !important;
  }
`;

const ResultItemIconContainerStyled = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  color: var(--text-color);
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex-shrink: 0;
  position: relative;
  transition: all var(--transition-fast);
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, transparent 30%, rgba(255,255,255,0.2) 70%, transparent 100%);
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  ${SearchResultItemStyled}:hover & {
    transform: scale(1.1) rotate(5deg);
    box-shadow: 0 0 15px 1px var(--primary-transparent);
    animation: ${glowPulse} 2s infinite;
    
    &::after {
      opacity: 1;
    }
  }

  svg {
    font-size: 22px !important;
    transition: transform var(--transition-fast);
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));
  }

  ${SearchResultItemStyled}:hover & svg {
    animation: ${floatAnimation} 2s ease-in-out infinite;
  }
  
  [data-theme="dark"] & {
    filter: brightness(1.1);
    color: #E0E0E0;
    
    &::after {
      background: radial-gradient(circle at center, transparent 30%, rgba(255,255,255,0.15) 70%, transparent 100%);
    }
  }
`;

const ResultItemInfoStyled = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-grow: 1;
  min-width: 0; /* Для text-overflow */
`;

const ResultItemTitleStyled = styled.h4`
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.3s ease;

  ${SearchResultItemStyled}:hover & {
    color: var(--primary-color);
  }
`;

const ResultItemCategoryStyled = styled.span`
  font-size: 12px;
  color: var(--text-secondary);
  background-color: var(--gray-100);
  padding: 4px 10px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: fit-content;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, 
      transparent, 
      rgba(255,255,255,0.2), 
      transparent);
    transform: translateX(-100%);
    transition: transform 0.5s ease;
  }

  ${SearchResultItemStyled}:hover & {
    background-color: var(--primary-transparent);
    color: var(--primary-color);
    box-shadow: 0 0 10px var(--primary-transparent);
    
    &::after {
      transform: translateX(100%);
    }
  }

  [data-theme="dark"] & {
    background-color: var(--gray-800);
    
    &::after {
      background: linear-gradient(90deg, 
        transparent, 
        rgba(255,255,255,0.1), 
        transparent);
    }
  }

  svg {
    color: var(--primary-color);
    font-size: 14px !important;
    margin-right: 4px;
    transition: all var(--transition-fast);
  }
  
  ${SearchResultItemStyled}:hover & svg {
    transform: rotate(15deg);
  }
`;

const ResultItemStatusStyled = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
`;

const StatusBadgeBase = styled.span`
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
  transition: all var(--transition-fast);
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, 
      transparent, 
      rgba(255,255,255,0.2), 
      transparent);
    transform: translateX(-100%);
  }

  ${SearchResultItemStyled}:hover &::after {
    transform: translateX(100%);
    transition: transform 0.5s ease;
  }
  
  [data-theme="dark"] & {
    &::after {
      background: linear-gradient(90deg, 
        transparent, 
        rgba(255,255,255,0.1), 
        transparent);
    }
  }
`;

const QuantityStatusStyled = styled(StatusBadgeBase)`
  background-color: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);

  ${SearchResultItemStyled}:hover & {
    background-color: var(--primary-transparent);
    color: var(--primary-color);
    border-color: var(--primary-color);
    box-shadow: 0 0 8px var(--primary-transparent);
  }

  [data-theme="dark"] & {
    background-color: var(--gray-800);
    border-color: var(--gray-700);
    color: var(--gray-400);
  }
`;

const FilledStatusStyled = styled(StatusBadgeBase)`
  background-color: var(--success-background);
  color: var(--success-color);
  
  ${SearchResultItemStyled}:hover & {
    box-shadow: 0 0 8px var(--success-background);
  }
`;

const OutOfStockStatusStyled = styled(StatusBadgeBase)`
  background-color: var(--error-background);
  color: var(--error-color);
  
  ${SearchResultItemStyled}:hover & {
    box-shadow: 0 0 8px var(--error-background);
  }
`;

const SearchHistorySectionStyled = styled.div`
  margin-top: 30px;
  padding: 20px 0 10px 0;
  position: relative;
  animation: ${fadeIn} 0.5s ease;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, 
      transparent 0%, 
      var(--primary-color) 50%, 
      transparent 100%);
    opacity: 0.3;
  }
`;

const SearchHistoryTitleStyled = styled.h3`
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
  margin: 0 0 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  
  &::after {
    content: '';
    flex-grow: 1;
    height: 1px;
    background: linear-gradient(90deg, 
      var(--primary-transparent) 0%, 
      transparent 100%);
    margin-left: 10px;
  }

  svg {
    font-size: 18px !important;
    color: var(--primary-color);
  }
`;

const HistoryItemIconStyled = styled(HistoryIcon)`
  color: var(--text-secondary);
  font-size: 16px !important;
  margin-right: 8px;
  transition: all var(--transition-normal);

  ${SearchHistoryItemStyled}:hover & {
    color: var(--primary-color);
    transform: rotate(-15deg) scale(1.1);
  }
  
  [data-theme="dark"] & {
    /* Forcing dark theme styles with !important for debugging */
    color: var(--text-secondary) !important;
    ${SearchHistoryItemStyled}:hover & {
       color: var(--primary-color) !important; /* Also force hover color */
    }
  }
`;

const SearchHistoryItemTextStyled = styled.span`
  font-size: 14px;
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--transition-fast);
  [data-theme="dark"] & {
    /* Forcing dark theme styles with !important for debugging */
    color: var(--text-secondary) !important;
    ${SearchHistoryItemStyled}:hover & {
      color: var(--primary-color) !important; /* Also force hover color */
    }
  }
`;

const NoResultsMessageStyled = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 30px;
  text-align: center;
  gap: 20px;
  background-color: var(--background-color);
  border-radius: var(--radius-lg);
  margin: 20px 0;
  border: 1px dashed var(--primary-transparent);
  position: relative;
  overflow: hidden;
  color: var(--text-color);
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, var(--primary-transparent) 0%, transparent 70%);
    opacity: 0.2;
  }

  [data-theme="dark"] & {
    /* Forcing dark theme styles with !important for debugging */
    background-color: var(--gray-900) !important;
    border-color: var(--gray-700) !important;
    color: var(--text-color) !important;
    
    &::before {
       background: radial-gradient(circle at center, rgba(255, 95, 31, 0.1) 0%, transparent 70%);
       opacity: 0.3;
    }
  }
`;

const NoResultsIconStyled = styled.div`
  font-size: 60px !important;
  color: var(--gray-400);
  opacity: 0.7;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  ${NoResultsMessageStyled}:hover & {
    transform: scale(1.15);
    color: var(--primary-color);
    opacity: 0.9;
  }

  &::after {
    content: '';
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    background: radial-gradient(circle at center, var(--primary-transparent) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  ${NoResultsMessageStyled}:hover &::after {
    opacity: 1;
  }

  svg {
    display: block;
    filter: drop-shadow(0 3px 5px rgba(0,0,0,0.2));
  }
  
  [data-theme="dark"] & {
    /* Forcing dark theme styles with !important for debugging */
    color: var(--gray-600) !important;
    
    ${NoResultsMessageStyled}:hover & {
      color: var(--primary-color) !important;
    }
  }
`;

const SpinnerStyled = styled(CircularProgress)`
  animation: ${spinAnimation} 1.5s linear infinite;
  color: var(--primary-color) !important;
  margin-bottom: 10px;
  filter: drop-shadow(0 2px 4px var(--primary-transparent));
`;

const HighlightStyled = styled.span`
  color: var(--primary-color);
  font-weight: 700;
  background-color: var(--primary-transparent);
  padding: 2px 5px;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, 
      transparent, 
      rgba(255,255,255,0.5), 
      transparent);
    transform: translateX(-100%);
  }
  
  ${ResultItemBase}:hover &::after {
    transform: translateX(100%);
    transition: transform 0.5s ease;
  }
  
  [data-theme="dark"] & {
    background-color: rgba(255, 95, 31, 0.15);
    
    &::after {
      background: linear-gradient(90deg, 
        transparent, 
        rgba(255,255,255,0.2), 
        transparent);
    }
  }
`;

// --- Компонент SearchResultsDropdown --- 

interface SearchResult {
  category: string;
  itemId: string;
  item: InventoryItem;
  matches: {
    field: string;
    value: string;
  }[];
}

interface SearchResultsDropdownProps {
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  isFocused: boolean;
  searchHistory?: string[];
  onSelectResult: (category: string, itemId: string) => void;
  onSelectHistoryItem?: (query: string) => void;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onFocusChange: (focused: boolean) => void;
}

const highlightMatch = (text: string, query: string) => {
  return text; // Placeholder - no highlighting without styled component
};

const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = ({
  searchQuery,
  searchResults,
  isSearching,
  isFocused,
  searchHistory = [],
  onSelectResult,
  onSelectHistoryItem,
  onSearch,
  onClearSearch,
  onFocusChange
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    console.log('🔍 Состояние SearchResultsDropdown рендерится (видимость управляется родителем):');
    console.log(`🔍 Текущий поисковый запрос: "${searchQuery}"`);
    console.log(`🔍 Количество результатов: ${searchResults.length}`);
    console.log(`🔍 Идет поиск: ${isSearching}`);
    console.log(`🔍 История поиска: ${searchHistory.length} записей`);
  }, [searchQuery, searchResults, isSearching, searchHistory]);

  const handleResultClick = (e: React.MouseEvent, category: string, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`🔍 Клик по результату: ${itemId} в категории ${category}`);
    setTimeout(() => {
      console.log(`🔍 Вызов onSelectResult для ${itemId} в категории ${category}`);
      onSelectResult(category, itemId);
    }, 100);
  };

  const handleHistoryClick = (e: React.MouseEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`🔍 Клик по истории поиска: "${query}"`);
    setTimeout(() => {
      console.log(`🔍 Вызов onSelectHistoryItem для "${query}"`);
      onSelectHistoryItem?.(query);
    }, 100);
  };

  const handleClose = () => {
    onFocusChange(false);
    onClearSearch();
  };

  // Variants for framer-motion animations
  const dropdownVariants = {
    hidden: { 
      y: "100%", 
      opacity: 0,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }
    },
    visible: { 
      y: "0%", 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30, 
        duration: 0.4 
      }
    },
    exit: { 
      y: "100%", 
      opacity: 0,
      transition: { 
        type: "spring", 
        stiffness: 500, 
        damping: 30, 
        duration: 0.3 
      }
    }
  };

  return (
    <motion.div 
      ref={dropdownRef}
      data-dropdown-id="search-results" 
      variants={dropdownVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        backgroundColor: 'var(--card-background)',
        borderTop: '1px solid var(--border-color)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div 
        style={{ 
          padding: '80px 20px 10px',
          position: 'relative', 
          zIndex: 5 
        }}
      >
        <InventorySearch
          searchQuery={searchQuery}
          onSearch={onSearch}
          isFocused={isFocused}
          isSearching={isSearching}
          searchResults={searchResults}
          onClearSearch={onClearSearch}
          onFocusChange={onFocusChange}
          onSelectResult={onSelectResult}
        />
      </div>

      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '15px 20px 30px' }}>
        {isSearching ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 30px', textAlign: 'center', gap: '20px', backgroundColor: 'var(--background-color)', borderRadius: 'var(--radius-lg)', margin: '20px 0', border: '1px dashed var(--primary-transparent)', color: 'var(--text-color)' }}>
            <CircularProgress size={50} style={{ color: 'var(--primary-color)' }} /> 
            <p>Выполняется поиск...</p>
          </div>
        ) : searchQuery && searchResults.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', margin: 0, gap: '12px' }}>
            {searchResults.map((result, index) => (
              <motion.div 
                key={`${result.category}-${result.itemId}-${index}`}
                onClick={(e) => handleResultClick(e, result.category, result.itemId)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 30,
                  delay: index * 0.05
                }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ y: 1, scale: 0.99 }}
                style={{
                  padding: '16px',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-background)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-dark))', color: 'var(--text-color)', width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0 }}>
                  <ArticleOutlinedIcon style={{ fontSize: '22px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-color)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {highlightMatch(result.itemId, searchQuery)} 
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--gray-100)', padding: '4px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: 'fit-content' }}>
                    <LocalOfferOutlinedIcon style={{ fontSize: '14px', color: 'var(--primary-color)', marginRight: '4px' }} />
                    {result.category}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginLeft: 'auto', flexShrink: 0 }}>
                  {result.item.raw?.quantity !== undefined && (
                    <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', backgroundColor: 'var(--gray-100)', color: 'var(--gray-700)', border: '1px solid var(--gray-200)' }}>
                      {result.item.raw.quantity} {result.item.unit || 'шт'}
                    </span>
                  )}
                  {result.item.raw?.filled && (
                    <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', backgroundColor: 'var(--success-background)', color: 'var(--success-color)' }}>
                      Заполнен
                    </span>
                  )}
                  {result.item.raw?.isOutOfStock && (
                    <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', backgroundColor: 'var(--error-background)', color: 'var(--error-color)' }}>
                      Нет в наличии
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : searchQuery && searchResults.length === 0 ? (
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 30px',
              textAlign: 'center',
              gap: '25px',
              background: `linear-gradient(145deg, var(--background-color), var(--card-background))`,
              borderRadius: 'var(--radius-lg)',
              margin: '20px 0',
              border: '1px solid var(--primary-transparent)',
              color: 'var(--text-color)',
              boxShadow: 'inset 0 0 15px rgba(var(--primary-rgb), 0.1)',
              overflow: 'hidden'
            }}
          >
            <motion.div 
              style={{ 
                fontSize: '100px',
                color: 'var(--primary-color)',
                opacity: 0.8,
                lineHeight: 1
              }}
              animate={{ 
                scale: [1, 1.08, 1],
                y: [0, -6, 0]
              }}
              transition={{
                duration: 3,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.5
              }}
            >
              <SearchOffIcon />
            </motion.div>
            <p style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-color)',
              margin: 0
            }}>
              Ничего не найдено
            </p>
            {searchQuery && <p style={{fontSize: '14px', color: 'var(--text-secondary)'}}>По запросу: "{searchQuery}"</p>}
          </div>
        ) : !searchQuery && searchResults.length === 0 ? (
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 30px',
              textAlign: 'center',
              gap: '25px',
              background: `linear-gradient(145deg, var(--background-color), var(--card-background))`, 
              borderRadius: 'var(--radius-lg)',
              margin: '20px 0',
              border: '1px solid var(--primary-transparent)',
              color: 'var(--text-color)',
              boxShadow: 'inset 0 0 15px rgba(var(--primary-rgb), 0.1)',
              overflow: 'hidden'
            }}
          >
            <motion.div 
              style={{ 
                fontSize: '100px',
                color: 'var(--primary-color)',
                opacity: 0.8,
                lineHeight: 1
              }}
              animate={{ 
                scale: [1, 1.08, 1],
                y: [0, -6, 0]
              }}
              transition={{
                duration: 3,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.5
              }}
            >
              <SearchIcon />
            </motion.div>
            <p style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-color)',
              margin: 0
            }}>
              Введите название товара для поиска
            </p>
            {searchHistory.length > 0 && 
              <p style={{fontSize: '14px', color: 'var(--text-secondary)', margin: 0}}>
                Или выберите из истории
              </p>
            }
          </div>
        ) : null }

        {searchHistory.length > 0 && (
          <div style={{ marginTop: '30px', padding: '20px 0 10px 0', position: 'relative', paddingBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HistoryIcon style={{ fontSize: '18px', color: 'var(--primary-color)' }} />
              История поиска
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', padding: '10px 0', margin: 0, gap: '8px' }}>
              {searchHistory.map((query, index) => {
                return (
                  <motion.div 
                    key={`history-${index}`}
                    onClick={(e) => handleHistoryClick(e, query)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 300, 
                      damping: 30, 
                      delay: index * 0.05 
                    }}
                    whileHover={{
                      y: -2, 
                      scale: 1.01, 
                      backgroundColor: 'var(--primary-color)',
                      color: 'var(--text-color)',
                      borderColor: 'var(--primary-color)'
                    }}
                    whileTap={{ y: 1, scale: 0.99 }}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid var(--primary-transparent)',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--primary-transparent)',
                      flexShrink: 0,
                      width: 'auto',
                      transition: 'background-color 0.2s, color 0.2s, border-color 0.2s'
                    }}
                  >
                    <HistoryIcon style={{ fontSize: '16px' }} />
                    <span style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
                      {query}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SearchResultsDropdown; 