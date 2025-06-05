import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { SearchResult } from '../../types/search';
import styles from './SearchBar.module.css';
import { AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  onSearch: (query: string) => void;
  searchResults?: SearchResult[];
  searchQuery: string;
  isLoading?: boolean;
  onClear: () => void;
  onResultSelect: (category: string, itemId: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  searchResults = [],
  searchQuery,
  isLoading = false,
  onClear,
  onResultSelect,
}) => {
  const [query, setQuery] = useState(searchQuery);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update internal query when external searchQuery changes
  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  // Show results dropdown when there are results
  useEffect(() => {
    if (searchResults.length > 0 && query) {
      setShowResults(true);
    }
  }, [searchResults, query]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    if (newQuery.trim().length >= 2) {
      onSearch(newQuery);
    } else if (newQuery.length === 0) {
      onClear();
    }
  };

  const handleClear = () => {
    setQuery('');
    onClear();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowResults(false);
    } else if (e.key === 'Enter' && query.trim()) {
      onSearch(query);
      // Don't hide results on Enter - we want to show the search results
    }
  };

  const handleFocus = () => {
    if (searchResults.length > 0 && query) {
      setShowResults(true);
    }
  };

  // Highlight matching text in search results
  const highlightMatches = (text: string, matches: string[]) => {
    if (!matches || matches.length === 0) return text;
    
    // Simple implementation: if any match is found in the text, wrap it with a highlight span
    // For a more complex implementation, you'd need to analyze exact positions of matches
    let result = text;
    
    matches.forEach(match => {
      const regex = new RegExp(match, 'gi');
      result = result.replace(regex, (matchedText) => 
        `<span class="${styles.resultMatch}">${matchedText}</span>`
      );
    });
    
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  // Group results by category
  const groupedResults = searchResults.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className={styles.searchContainer}>
      <SearchIcon className={styles.searchIcon} />
      <input
        ref={inputRef}
        type="text"
        className={styles.searchInput}
        placeholder="Поиск в инвентаре..."
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      />
      <AnimatePresence>
        {query && (
          <motion.button
            className={`${styles.clearButton} ${query ? styles.clearButtonVisible : ''}`}
            onClick={handleClear}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            aria-label="Очистить поиск"
          >
            <CloseIcon />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResults && (
          <motion.div
            ref={dropdownRef}
            className={styles.resultsDropdown}
            initial={{ opacity: 0, y: -10, scaleY: 0.8 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -10, scaleY: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            {isLoading ? (
              <div className={styles.loadingIndicator}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <SearchIcon />
                </motion.div>
              </div>
            ) : searchResults.length > 0 ? (
              Object.entries(groupedResults).map(([category, results]) => (
                <div key={category} className={styles.resultGroup}>
                  <div className={styles.resultGroupHeader}>
                    <CategoryIcon />
                    {category}
                  </div>
                  {results.map((result) => (
                    <div
                      key={result.itemId}
                      className={styles.resultItem}
                      onClick={() => {
                        onResultSelect(result.category, result.itemId);
                        setShowResults(false);
                      }}
                    >
                      <div className={styles.resultItemTitle}>
                        {highlightMatches(result.item.name, 
                          result.matches
                            .filter(match => match.field === 'name')
                            .map(match => match.value)
                        )}
                      </div>
                      <div className={styles.resultItemSubtitle}>
                        <Inventory2OutlinedIcon />
                        {highlightMatches(
                          `${result.item.raw?.quantity} ${result.item.unit || 'шт'}`,
                          result.matches
                            .filter(match => match.field === 'quantity' || match.field === 'unit')
                            .map(match => match.value)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : query ? (
              <div className={styles.emptyResults}>
                Ничего не найдено по запросу "{query}"
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar; 