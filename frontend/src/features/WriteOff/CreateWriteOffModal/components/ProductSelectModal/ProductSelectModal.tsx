import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { WriteOffApi } from '../../../services/writeOffApi';

interface ProductSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSelect: (productName: string) => void;
  groupId?: string;
}

interface InventoryItem {
  name: string;
  category: string;
}

export const ProductSelectModal: React.FC<ProductSelectModalProps> = ({
  isOpen,
  onClose,
  onProductSelect,
  groupId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Загружаем товары из шаблона
  useEffect(() => {
    if (isOpen && groupId) {
      loadInventoryTemplate();
    }
  }, [isOpen, groupId]);

  // Фильтруем товары по поисковому запросу
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const loadInventoryTemplate = async () => {
    try {
      setLoading(true);
      console.log('🔄 [ProductSelectModal] Загружаем шаблон для группы:', groupId);
      
      const response = await WriteOffApi.getInventoryTemplate(groupId!);
      
      if (response.success) {
        console.log('✅ [ProductSelectModal] Шаблон загружен:', response);
        setProducts(response.items || []);
      } else {
        console.error('❌ [ProductSelectModal] Ошибка загрузки шаблона:', response.error);
      }
    } catch (error) {
      console.error('❌ [ProductSelectModal] Исключение при загрузке шаблона:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (productName: string) => {
    console.log('🛒 [ProductSelectModal] Выбран товар:', productName);
    onProductSelect(productName);
    // Закрытие модалки происходит в родительском компоненте WriteOff.tsx
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="product-select-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 99999
        }}
      >
        <motion.div
          className="product-select-modal"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#1a1a1a',
            width: '100%',
            height: '100vh',
            maxHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)',
            border: 'none',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 24px 20px 24px',
            borderBottom: '2px solid #ea580c',
            background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)',
            position: 'relative'
          }}>
            <h2 style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#ffffff',
              margin: 0,
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}>Выбор товара</h2>
            <IconButton 
              onClick={onClose} 
              size="small"
              style={{
                color: '#ffffff',
                padding: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px'
              }}
            >
              <CloseIcon />
            </IconButton>
          </div>

          {/* Search */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #333333',
            backgroundColor: '#262626'
          }}>
            <div style={{ position: 'relative' }}>
              <SearchIcon style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#ea580c',
                fontSize: '22px'
              }} />
              <input
                type="text"
                placeholder="Поиск товара..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  paddingLeft: '52px',
                  paddingRight: '20px',
                  paddingTop: '16px',
                  paddingBottom: '16px',
                  border: '2px solid #404040',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#ffffff',
                  backgroundColor: '#1a1a1a',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#ea580c';
                  e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#404040';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Products List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: '#1a1a1a'
          }}>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 16px',
                color: '#888888',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Загрузка товаров...
              </div>
            ) : filteredProducts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredProducts.map((product, index) => (
                  <motion.button
                    key={index}
                    onClick={() => handleProductClick(product.name)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '18px 20px',
                      borderRadius: '16px',
                      border: '2px solid #333333',
                      backgroundColor: '#262626',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#333333';
                      e.currentTarget.style.borderColor = '#ea580c';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#262626';
                      e.currentTarget.style.borderColor = '#333333';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      fontWeight: '600',
                      color: '#ffffff',
                      fontSize: '16px',
                      marginBottom: product.category ? '6px' : '0',
                      lineHeight: '1.4'
                    }}>
                      {product.name}
                    </div>
                    {product.category && (
                      <div style={{
                        fontSize: '14px',
                        color: '#ea580c',
                        fontWeight: '500'
                      }}>
                        {product.category}
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            ) : searchQuery ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 16px',
                color: '#888888',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Товар не найден
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '48px 16px',
                color: '#888888',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Нет доступных товаров
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}; 