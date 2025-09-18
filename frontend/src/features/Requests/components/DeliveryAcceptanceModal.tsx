import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector } from '@shared/store/hooks';
import { selectUser } from '@shared/store/userSlice/userSelectors';
import { tooltipManager } from '@shared/components/Notifications/Toast';

// 🎨 Брендовые SVG иконки
const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      fill="var(--primary-color)" 
      stroke="var(--primary-color)" 
      strokeWidth="2"
    />
    <path 
      d="M9 12L11 14L15 10" 
      stroke="white" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const CloseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M18 6L6 18M6 6L18 18" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const PackageIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M7 21L7 8L21 8V21C21 21.5523 20.5523 22 20 22L8 22C7.44772 22 7 21.5523 7 21Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M3 8V6C3 4.89543 3.89543 4 5 4H19C20.1046 4 21 4.89543 21 6V8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M12 8V6" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <circle cx="10" cy="14" r="1" fill="currentColor"/>
    <circle cx="14" cy="14" r="1" fill="currentColor"/>
    <circle cx="10" cy="18" r="1" fill="currentColor"/>
    <circle cx="14" cy="18" r="1" fill="currentColor"/>
  </svg>
);

const NoteIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M14 2V8H20" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M16 13H8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M16 17H8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M10 9H8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// 🎨 Брендовые анимации
const slideUpAnimation = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const pulseAnimation = keyframes`
  0% { 
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.4);
  }
  70% { 
    box-shadow: 0 0 0 6px rgba(var(--primary-rgb), 0);
  }
  100% { 
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0);
  }
`;

const shineAnimation = keyframes`
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
`;

// 🎨 Стилизованные компоненты
const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden; /* Блокируем скролл */
  
  @media (max-width: 768px) {
    align-items: flex-end;
  }
  
  @media (min-width: 769px) {
    align-items: center;
  }
`;

const ModalContainer = styled(motion.div)`
  background: var(--card-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-color);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  position: relative;
  
  @media (max-width: 768px) {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 95vh;
    padding-bottom: 80px;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(var(--primary-rgb), 0.05),
      transparent
    );
    animation: ${css`${shineAnimation} 3s infinite`};
    pointer-events: none;
  }
`;

const ModalHeader = styled.div`
  padding: 24px 32px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(135deg, var(--card-background), rgba(var(--primary-rgb), 0.02));
  position: relative;
  z-index: 1;
  
  @media (max-width: 768px) {
    padding: 20px 24px;
  }
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const HeaderIcon = styled(motion.div)`
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
`;

const HeaderText = styled.div`
  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 4px 0;
    background: var(--gradient-primary);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
  }
`;

const CloseButton = styled(motion.button)`
  background: rgba(var(--primary-rgb), 0.1);
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: var(--radius);
  color: var(--primary-color);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(var(--primary-rgb), 0.15);
    border-color: rgba(var(--primary-rgb), 0.3);
    transform: scale(1.05);
  }
`;

const ModalContent = styled.div`
  padding: 24px 32px;
  max-height: 60vh;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    padding: 20px 24px;
    max-height: 65vh;
  }
  
  /* Кастомный скроллбар */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: var(--gray-100);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--primary-color);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: var(--primary-dark);
  }
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ItemCard = styled(motion.div)<{ $checked: boolean }>`
  background: ${props => props.$checked 
    ? 'rgba(var(--primary-rgb), 0.05)' 
    : 'var(--card-background)'};
  border: 1px solid ${props => props.$checked 
    ? 'rgba(var(--primary-rgb), 0.2)' 
    : 'var(--border-color)'};
  border-radius: var(--radius-lg);
  padding: 16px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
    border-color: ${props => props.$checked 
      ? 'rgba(var(--primary-rgb), 0.3)' 
      : 'var(--primary-color)'};
  }
  
  ${props => props.$checked && `
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--gradient-primary);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }
  `}
`;

const ItemHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`;

const Checkbox = styled(motion.div)<{ $checked: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid ${props => props.$checked 
    ? 'var(--primary-color)' 
    : 'var(--border-color)'};
  background: ${props => props.$checked 
    ? 'var(--primary-color)' 
    : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
  
  ${props => props.$checked && css`
    animation: ${pulseAnimation} 0.6s ease-out;
  `}
`;

const ItemName = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
  flex: 1;
`;

const ItemDetails = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const DetailBadge = styled.span<{ $type: 'quantity' | 'unit' | 'category' }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  
  ${props => {
    switch (props.$type) {
      case 'quantity':
        return `
          background: rgba(var(--primary-rgb), 0.1);
          color: var(--primary-color);
          border: 1px solid rgba(var(--primary-rgb), 0.2);
        `;
      case 'unit':
        return `
          background: var(--gray-100);
          color: var(--text-secondary);
          border: 1px solid var(--gray-200);
        `;
      case 'category':
        return `
          background: rgba(var(--primary-rgb), 0.05);
          color: var(--text-secondary);
          border: 1px solid rgba(var(--primary-rgb), 0.1);
        `;
    }
  }}
`;

const NotesSection = styled.div<{ $hasNotes: boolean }>`
  margin-top: 12px;
  padding: 12px;
  background: ${props => props.$hasNotes 
    ? 'rgba(var(--primary-rgb), 0.05)' 
    : 'var(--gray-50)'};
  border-radius: var(--radius);
  border-left: 3px solid ${props => props.$hasNotes 
    ? 'var(--primary-color)' 
    : 'var(--border-color)'};
  transition: all 0.3s ease;
`;

const NotesLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const NotesTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 0.9rem;
  background: var(--card-background);
  color: var(--text-color);
  resize: vertical;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
  }
  
  &::placeholder {
    color: var(--text-secondary);
  }
`;

const ModalFooter = styled.div`
  padding: 20px 32px;
  border-top: 1px solid var(--border-color);
  background: linear-gradient(135deg, var(--card-background), rgba(var(--primary-rgb), 0.02));
  position: relative;
  z-index: 1;
  
  @media (max-width: 768px) {
    padding: 16px 24px;
  }
`;

const ProgressSection = styled.div`
  margin-bottom: 16px;
`;

const ProgressLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color);
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: var(--gray-200);
  border-radius: 4px;
  overflow: hidden;
`;

const ProgressFill = styled(motion.div)<{ $progress: number }>`
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
`;

const FooterActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ActionButton = styled(motion.button)<{ $variant: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  border-radius: var(--radius-lg);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  justify-content: center;
  
  ${props => props.$variant === 'primary' ? `
    background: var(--gradient-primary);
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
    
    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(var(--primary-rgb), 0.4);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.2);
    }
  ` : `
    background: var(--card-background);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    
    &:hover {
      background: var(--gray-100);
      color: var(--text-color);
      border-color: var(--primary-color);
      transform: translateY(-1px);
    }
  `}
  
  &:active {
    transform: translateY(0);
  }
`;

// Типы
interface DeliveryItem {
  name: string;
  category: string;
  unit: string;
  quantity: number;
  price: number;
}

interface CheckedItems {
  [key: string]: boolean;
}

interface ItemNotes {
  [key: string]: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onCancel: () => void;
  supplier: string;
  items: DeliveryItem[];
  checkedItems: CheckedItems;
  itemNotes: ItemNotes;
  onItemToggle: (index: number) => void;
  onNoteChange: (index: number, note: string) => void;
  isSubmitting?: boolean;
}

const DeliveryAcceptanceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onAccept,
  onCancel,
  supplier,
  items,
  checkedItems,
  itemNotes,
  onItemToggle,
  onNoteChange,
  isSubmitting = false
}) => {
  const user = useAppSelector(selectUser);
  const modalRef = useRef<HTMLDivElement>(null);

  // 👤 Функция для получения данных пользователя
  const getCurrentUserData = () => {
    const firstName = user?.first_name || '';
    const lastName = user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Пользователь';
    
    const getUserInitials = (name: string): string => {
      return name
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2);
    };
    
    const initials = getUserInitials(fullName);
    
    // URL фото пользователя через API endpoint
    const photoUrl = user?.id 
      ? `${window.APP_CONFIG?.API_URL || 'http://localhost:8000/api'}/v1/users/${user.id}/photo`
      : undefined;
    
    return {
      name: fullName,
      initials: initials,
      user_id: user?.id,
      photo_url: photoUrl
    };
  };

  // Блокировка скролла при открытии модалки
  useEffect(() => {
    if (isOpen) {
      // Блокируем скролл body
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      // Восстанавливаем скролл body
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    // Очистка при размонтировании
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Обработка клика по товару
  const handleItemClick = (index: number) => {
    onItemToggle(index);
  };

  // Обработка изменения заметки
  const handleNoteChange = (index: number, note: string) => {
    onNoteChange(index, note);
  };

  // Расчет прогресса
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  // Закрытие по клику на overlay
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleOverlayClick}
        >
          <ModalContainer
            ref={modalRef}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ 
              type: 'spring', 
              damping: 25, 
              stiffness: 300,
              duration: 0.4 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <HeaderContent>
                <HeaderLeft>
                  <HeaderIcon
                    animate={{ 
                      rotate: [0, 5, -5, 0],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 3
                    }}
                  >
                    <PackageIcon size={24} />
                  </HeaderIcon>
                  <HeaderText>
                    <h2 className="title">Приемка поставки</h2>
                    <p className="subtitle">Отметьте принятые товары</p>
                  </HeaderText>
                </HeaderLeft>
              </HeaderContent>
            </ModalHeader>

            <ModalContent>
              <ItemsList>
                {items.map((item, index) => {
                  const itemKey = `${supplier}-${index}`;
                  const isChecked = checkedItems[itemKey] || false;
                  const note = itemNotes[itemKey] || '';

                  return (
                    <ItemCard
                      key={index}
                      $checked={isChecked}
                      onClick={() => handleItemClick(index)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <ItemHeader>
                        <Checkbox $checked={isChecked}>
                          {isChecked && <CheckIcon size={14} />}
                        </Checkbox>
                        <ItemName>{item.name}</ItemName>
                      </ItemHeader>

                      <ItemDetails>
                        <DetailBadge $type="quantity">
                          {item.quantity} {item.unit}
                        </DetailBadge>
                        <DetailBadge $type="category">
                          {item.category}
                        </DetailBadge>
                      </ItemDetails>

                      <NotesSection $hasNotes={!!note}>
                        <NotesLabel>
                          <NoteIcon size={14} />
                          Заметки к товару
                        </NotesLabel>
                        <NotesTextarea
                          value={note}
                          onChange={(e) => handleNoteChange(index, e.target.value)}
                          placeholder="Оставьте заметку, если есть проблемы с товаром..."
                          onClick={(e) => e.stopPropagation()}
                        />
                      </NotesSection>
                    </ItemCard>
                  );
                })}
              </ItemsList>
            </ModalContent>

            <ModalFooter>
              <ProgressSection>
                <ProgressLabel>
                  <span>Прогресс приемки</span>
                  <span>{checkedCount} из {totalCount}</span>
                </ProgressLabel>
                <ProgressBar>
                  <ProgressFill 
                    $progress={progress}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </ProgressBar>
              </ProgressSection>
            </ModalFooter>
          </ModalContainer>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

export default DeliveryAcceptanceModal;
