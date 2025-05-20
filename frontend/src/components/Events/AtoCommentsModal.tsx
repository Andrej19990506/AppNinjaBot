import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import CommentIcon from '@mui/icons-material/Comment';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import FilterListIcon from '@mui/icons-material/FilterList';
import TuneIcon from '@mui/icons-material/Tune';
import Badge from '@mui/material/Badge';
// Импортируем хуки и действия Redux
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  closeAtoModal, 
  setAtoCreateMode, 
  selectAtoModalOpen, 
  selectAtoCreateMode,
  selectAtoComments,
  selectAtoPenaltyPoints,
  selectAtoObjectName,
  selectSelectedComments,
  selectSelectedCommentTexts,
  toggleCommentSelection,
  toggleCommentTextSelection,
  selectAllComments,
  selectAllCommentTexts,
  resetSelection,
  selectAtoScorePercentage,
  selectAtoMaxPoints,
  selectAtoEarnedPoints
} from '../../store/slices/atoModalSlice';

// Типы для комментариев АТО из Redux
interface AtoComment {
  title: string;
  text: string;
  penaltyPoints?: number; // Добавляем поле для штрафных баллов
}

// Типы для пропсов компонента
interface AtoCommentsModalProps {
    // Оставляем только необходимые пропсы для обратной совместимости
    onCreateNotification: (data: {
        selectedComments: string[];
        selectedCommentTexts: string[];
        formattedMessage: string;
        eventId?: number;
    }) => void;
}

// Анимации для компонентов
const pulseAnimation = `
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.4); }
    70% { box-shadow: 0 0 0 8px rgba(var(--primary-rgb), 0); }
    100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0); }
  }
`;

const breatheAnimation = `
  @keyframes breathe {
    0% { transform: scale(1); }
    50% { transform: scale(1.03); }
    100% { transform: scale(1); }
  }
`;

// Стилизованные компоненты
const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: flex-end;
`;

const ModalContainer = styled(motion.div)`
  background-color: var(--background-color);
  width: 100%;
  max-width: 800px;
  height: 85vh;
  border-radius: 0;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  will-change: transform;
  transform-origin: bottom center;
`;

const ModalHeader = styled.div`
  background: var(--gradient-primary);
  color: white;
  padding: 16px 24px;
  padding-top: 25px; /* Добавляем отступ сверху для ручки */
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 16px 16px 0 0; /* Добавляем скругление к шапке */
  
  h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    
    span {
      margin-left: 8px;
      font-weight: normal;
      font-size: 0.9rem;
      opacity: 0.8;
    }
  }
`;

const DragHandle = styled(motion.div)`
  width: 50px;
  height: 5px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  cursor: grab;
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.5);
  }
  
  &:active {
    cursor: grabbing;
    background-color: rgba(255, 255, 255, 0.7);
  }
`;

const ModalContent = styled.div`
  padding: 20px 24px;
  padding-bottom: 0px; /* Уменьшаем отступ снизу */
  overflow-y: hidden; /* Скрываем общий скролл */
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const EnhancedCommentCard = styled(motion.div)`
  position: relative;
  margin-bottom: 12px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: var(--card-background);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-normal);
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--gradient-primary);
    opacity: 0;
    transition: opacity var(--transition-normal);
  }
  
  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    
    &::before {
      opacity: 1;
    }
  }
`;

const CardHeader = styled.div<{ $hasComment?: boolean | null, $isExpanded?: boolean | null, $isSelected?: boolean | null }>`
  display: flex;
  padding: 12px 16px;
  align-items: center;
  background-color: ${props => 
    props.$isSelected 
      ? 'var(--primary-transparent)' 
      : 'var(--card-background)'};
  border-bottom: ${props => 
    (props.$hasComment && props.$isExpanded) 
      ? '1px solid var(--border-color)' 
      : 'none'};
  transition: background-color var(--transition-normal);
  
  &:hover {
    background-color: ${props => 
      props.$isSelected 
        ? 'var(--primary-transparent)' 
        : 'var(--hover-overlay)'};
  }
`;

const StyledCheckbox = styled(Checkbox)`
  && {
    color: var(--text-secondary);
    padding: 4px 8px 4px 0;
    transition: transform var(--transition-fast), color var(--transition-fast);
    
    &.Mui-checked {
      color: var(--primary-color);
    }
    
    &:hover {
      transform: scale(1.1);
    }
  }
`;

const CardTitle = styled.div`
  flex-grow: 1;
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CommentToggleButton = styled.div<{ $isSelected?: boolean | null }>`
  display: flex;
  align-items: center;
  cursor: pointer;
  color: ${props => props.$isSelected ? 'var(--primary-color)' : 'var(--text-secondary)'};
  margin-left: auto;
  padding: 4px;
  border-radius: 50%;
  transition: background-color var(--transition-fast), color var(--transition-fast), transform var(--transition-fast);
  
  &:hover {
    background-color: var(--hover-overlay);
    transform: scale(1.1);
  }
  
  svg {
    transition: transform var(--transition-normal);
  }
`;

// Совершенно новый подход к анимации комментариев
const CommentContentWrapper = styled(motion.div)`
  overflow: hidden;
  will-change: transform, opacity;
`;

const CommentContent = styled(motion.div)<{ $isSelected?: boolean | null }>`
  padding: 12px 16px 12px 42px;
  background-color: ${props => 
    props.$isSelected 
      ? 'rgba(var(--primary-rgb), 0.08)' 
      : 'transparent'};
  cursor: pointer;
  position: relative;
  border-left: ${props => 
    props.$isSelected 
      ? '3px solid var(--primary-color)' 
      : 'none'};
  transform-origin: top;
  will-change: transform, opacity, background-color;
  transition: background-color 0.15s ease, border-left 0.15s ease;
  
  &:hover {
    background-color: ${props => 
      props.$isSelected 
        ? 'rgba(var(--primary-rgb), 0.12)' 
        : 'var(--hover-overlay)'};
  }
  
  ${props => props.$isSelected && `
    &::after {
      content: '';
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: var(--primary-color);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 10px;
      animation: pulse 2s infinite;
    }
  `}
  
  ${pulseAnimation}
`;

const CommentIconAnimated = styled(CommentIcon)<{ $isActive?: boolean | null }>`
  && {
    margin-right: 4px;
    transition: transform var(--transition-normal), color var(--transition-normal);
    color: ${props => props.$isActive ? 'var(--primary-color)' : 'var(--text-secondary)'};
    
    ${props => props.$isActive && `
      animation: breathe 2s infinite ease-in-out;
    `}
  }
  
  ${breatheAnimation}
`;

const ExpandIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SelectionSummary = styled.div`
  margin-bottom: 16px;
  padding: 10px 12px;
  background-color: var(--card-background);
  border-radius: var(--radius);
  border-left: 4px solid var(--primary-color);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-normal);
  flex-shrink: 0;
  
  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
`;

const SummaryTitle = styled.div`
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text-color);
  font-size: 0.9rem;
`;

const SummaryDetail = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  
  svg {
    color: var(--primary-color);
    font-size: 14px;
  }
`;

const CommentSelectionContainer = styled.div`
  margin-top: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

// Новые варианты анимации с фокусом на производительность
const fastAnimationVariants = {
  collapsed: { 
    scaleY: 0,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: [0.4, 0.0, 0.2, 1] // Оптимизированная кривая Material Design
    }
  },
  expanded: { 
    scaleY: 1,
    opacity: 1,
    transition: {
      duration: 0.15,
      ease: [0.4, 0.0, 0.2, 1] // Оптимизированная кривая Material Design
    }
  }
};

// Анимационные варианты для модального окна
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.3, delay: 0.1 } }
};

const modalVariants = {
  hidden: { y: "100%" },
  visible: { 
    y: 0, 
    transition: { 
      type: "spring", 
      damping: 25, 
      stiffness: 300,
      mass: 0.8 // Добавляем меньшую массу для быстрого старта
    } 
  },
  exit: { 
    y: "100%", 
    transition: { 
      duration: 0.3,
      ease: "easeInOut" 
    } 
  }
};

// Добавляем новые стили для визуализации оценки
const ScoreSummaryContainer = styled(motion.div)`
  margin: 0 auto 20px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  padding: 16px;
  border-radius: var(--radius);
  background-color: var(--card-background);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
  transform-origin: right center;
`;

const ScoreHeader = styled.div`
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 16px;
  color: var(--text-color);
`;

const ScoreProgress = styled(motion.div)`
  position: relative;
  width: 140px;
  height: 140px;
  margin: 0 auto 16px;
`;

const ScoreCircle = styled(motion.div)<{$percentage: number}>`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    var(--primary-color) ${props => props.$percentage}%,
    var(--gray-200) ${props => props.$percentage}% 100%
  );
  box-shadow: var(--shadow-sm);
  
  [data-theme="dark"] & {
    background: conic-gradient(
      var(--primary-color) ${props => props.$percentage}%,
      var(--gray-700) ${props => props.$percentage}% 100%
    );
  }
`;

const ScoreInnerCircle = styled(motion.div)`
  position: absolute;
  top: 15px;
  left: 15px;
  width: calc(100% - 30px);
  height: calc(100% - 30px);
  border-radius: 50%;
  background-color: var(--card-background);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const ScoreValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-color);
`;

const ScoreLabel = styled.div`
  font-size: 0.9rem;
  color: var(--text-secondary);
`;

const ScoreDetails = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding: 0 16px;
  text-align: center;
`;

const ScoreDetailItem = styled.div`
  flex: 1;
`;

const ScoreDetailValue = styled.div<{$type: 'earned' | 'penalty' | 'max'}>`
  font-size: 1.2rem;
  font-weight: 600;
  color: ${props => 
    props.$type === 'earned' 
      ? 'var(--success-color)' 
      : props.$type === 'penalty' 
        ? 'var(--error-color)' 
        : 'var(--text-color)'};
`;

const ScoreDetailLabel = styled.div`
  font-size: 0.8rem;
  color: var(--text-secondary);
`;

// Компонент разделителя для групп замечаний
const CommentSectionDivider = styled.div`
  margin: 24px 0 16px;
  padding: 12px 16px;
  background-color: var(--card-background);
  border-radius: var(--radius);
  border-left: 4px solid var(--warning-color);
  box-shadow: var(--shadow-sm);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
`;

// Добавляем стили для контейнера, который будет анимированно меняться
const AnimatedContentContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow: hidden;
`;

const CommentsContainer = styled(motion.div)`
  overflow: auto;
  padding-right: 10px;
  flex: 1;
  margin-bottom: 0;
  padding-bottom: 60px;
  transform-origin: top center;
`;

// Добавляем стили для компонентов фильтрации
const FilterButton = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--card-background);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 6px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  
  &:hover {
    background-color: var(--hover-overlay);
    color: var(--text-color);
  }
  
  &.active {
    background-color: var(--primary-transparent);
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
`;

const FilterPanel = styled(motion.div)`
  background-color: var(--card-background);
  border-radius: var(--radius);
  border: 1px solid var(--border-color);
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
`;

const FilterOption = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FilterTitle = styled.div`
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 8px;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 6px;
`;

const FilterActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
`;

const FilterActionButton = styled(motion.button)`
  background-color: ${props => props.color === 'primary' ? 'var(--primary-transparent)' : 'var(--gray-200)'};
  color: ${props => props.color === 'primary' ? 'var(--primary-color)' : 'var(--text-secondary)'};
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-size: 0.75rem;
  cursor: pointer;
  margin-left: 6px;
  
  &:hover {
    background-color: ${props => props.color === 'primary' ? 'var(--primary-color)' : 'var(--gray-300)'};
    color: ${props => props.color === 'primary' ? 'white' : 'var(--text-color)'};
  }
`;

// Основной компонент
const AtoCommentsModal: React.FC<AtoCommentsModalProps> = ({ 
  onCreateNotification
}) => {
  // Получаем данные из Redux
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectAtoModalOpen);
  const isCreateNotificationMode = useAppSelector(selectAtoCreateMode);
  const comments = useAppSelector(selectAtoComments);
  const penaltyPoints = useAppSelector(selectAtoPenaltyPoints);
  const objectName = useAppSelector(selectAtoObjectName);
  const selectedComments = useAppSelector(selectSelectedComments);
  const selectedCommentTexts = useAppSelector(selectSelectedCommentTexts);
  
  const scorePercentage = useAppSelector(selectAtoScorePercentage);
  const maxPoints = useAppSelector(selectAtoMaxPoints);
  const earnedPoints = useAppSelector(selectAtoEarnedPoints);
  
  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const y = useMotionValue(0);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const overlayOpacity = useTransform(y, [0, 300], [0, 0.5]);
  const scrollY = useMotionValue(0);
  const commentsListRef = useRef<HTMLDivElement>(null);
  const firstAnimThreshold = 80;
  const secondAnimThreshold = 100;
  const scoreBlockX = useTransform(scrollY, [0, firstAnimThreshold], [0, 400]);
  const scoreBlockOpacity = useTransform(scrollY, [0, firstAnimThreshold * 0.8], [1, 0]);
  const scoreBlockHeight = useTransform(
    scrollY, 
    [0, firstAnimThreshold * 0.5, firstAnimThreshold], 
    ["auto", "auto", "0px"]
  );
  const baseCommentsHeight = 589;
  const expandedCommentsHeight = 809;
  const commentsMaxHeight = useTransform(
    scrollY, 
    [0, secondAnimThreshold, 150], 
    [`${baseCommentsHeight}px`, `${baseCommentsHeight}px`, `${expandedCommentsHeight}px`]
  );
  const commentsMarginTop = useTransform(
    scrollY, 
    [0, secondAnimThreshold, 150], 
    ["0px", "0px", "-20px"]
  );
  const scoreBottomMargin = useTransform(
    scoreBlockOpacity,
    [0, 1],
    ["0px", "20px"]
  );
  const scorePointerEvents = useTransform(
    scoreBlockOpacity,
    [0, 0.1],
    ["none", "auto"]
  );
  
  // Функция для форматирования сообщения (теперь только текстовый формат)
  const generateFormattedMessage = (): string => {
    if (selectedComments.length === 0 && selectedCommentTexts.length === 0) {
      return "<b>🔵✓ ЗАМЕЧАНИЯ АТО:</b>\n\n<i>Замечания и комментарии не выбраны</i>";
    }

    const itemsForMessage: Array<{ point: string; comment: string; penalty?: number }> = [];
    const commentsByTitle: { [title: string]: string } = {};
    const penaltyByTitle: { [title: string]: number } = {};

    comments.forEach(comment => {
      if (comment.text && selectedCommentTexts.includes(cleanCommentText(comment.text))) {
        commentsByTitle[comment.title] = cleanCommentText(comment.text);
      }
      if (comment.penaltyPoints !== undefined && comment.penaltyPoints > 0) {
        penaltyByTitle[comment.title] = comment.penaltyPoints;
      }
    });

    selectedComments.forEach(title => {
      itemsForMessage.push({
        point: title,
        comment: commentsByTitle[title] || "",
        penalty: penaltyByTitle[title]
      });
    });
    
    // Определяем, активны ли "чисто комментарийные" фильтры, чтобы изменить отображение пункта
    const isPurelyCommentWithPenaltyFilter = filters.commentWithPenaltyOnly && !filters.penaltyOnly;
    const isPurelyCommentWithoutPenaltyFilter = filters.commentWithoutPenaltyOnly && !filters.noPenaltyOnly;

    Object.entries(commentsByTitle).forEach(([title, text]) => {
      if (!selectedComments.includes(title)) { // Комментарий выбран по тексту, а не по заголовку пункта
        const originalPointData = comments.find(c => c.title === title);
        const hasPenalty = originalPointData && originalPointData.penaltyPoints && originalPointData.penaltyPoints > 0;
        
        let displayPoint = title; // По умолчанию используем оригинальный заголовок пункта

        // Если активен "чисто комментарийный" фильтр, заменяем название пункта на "Комментарий"
        if ((hasPenalty && isPurelyCommentWithPenaltyFilter) || (!hasPenalty && isPurelyCommentWithoutPenaltyFilter)) {
          displayPoint = "Комментарий";
        }

        itemsForMessage.push({
          point: displayPoint,
          comment: text,
          penalty: penaltyByTitle[title]
        });
      }
    });

    const totalPenalty = itemsForMessage.reduce((sum, item) => sum + (item.penalty || 0), 0);
    const scoreText = earnedPoints !== undefined && maxPoints !== undefined
      ? `${earnedPoints}/${maxPoints} (${scorePercentage !== undefined ? Math.round(scorePercentage) : 0}%)`
      : totalPenalty > 0 ? `Штраф: -${totalPenalty}` : '';

    let message = "<b>🔵✓ ЗАМЕЧАНИЯ АТО:</b>\n\n";
    if (scoreText) {
      message += `<b>ОЦЕНКА:</b> ${scoreText}\n\n`; // Оценка без <code> тегов
    }

    message += "<b>Детали замечаний:</b>\n\n";
    itemsForMessage.forEach((item, index) => {
      message += `${index + 1}. <b>${item.point}</b>`;
      if (item.penalty) {
        message += ` <i>(Штраф: -${item.penalty})</i>`;
      }
      if (item.comment) {
        message += `:\n<i>${item.comment}</i>`;
      }
      message += "\n\n";
    });
    message = message.trim(); // Убираем лишний \n в конце, если есть

    // Логика сокращения сообщения, если оно превышает 10000 символов
    if (message.length > 10000) {
      let shortMessage = "<b>🔵✓ ЗАМЕЧАНИЯ АТО:</b>\n\n";
      if (scoreText) {
        shortMessage += `<b>ОЦЕНКА:</b> ${scoreText}\n\n`;
      }
      // Добавляем уведомление, что детали были сокращены
      shortMessage += "<i>(Полные детали не поместились. Представлено сокращенное описание.)</i>\n\n";
      shortMessage += "<b>Детали замечаний (сокращено):</b>\n\n";
      
      // Бюджет для списка пунктов, оставляем 100 символов для финального "... и еще X пунктов"
      let remainingLengthBudget = 10000 - shortMessage.length - 100;

      for (let i = 0; i < itemsForMessage.length; i++) {
        const item = itemsForMessage[i];
        let itemSummary = `${i + 1}. <b>${item.point}</b>`;
        if (item.penalty) itemSummary += ` (-${item.penalty})`;
        
        // Рассчитываем доступную длину для комментария с учетом текущей длины itemSummary
        // и необходимости добавить ": " и "\n"
        const availableForComment = remainingLengthBudget - itemSummary.length - "\n".length - 2; // -2 для ": "

        if (item.comment) {
          if (item.comment.length <= availableForComment) {
            itemSummary += `: ${item.comment}`;
          } else if (availableForComment > 3) { // Если есть место хотя бы для "..."
            itemSummary += `: ${item.comment.substring(0, availableForComment - 3)}...`;
          } // Если места для комментария (даже сокращенного) нет, он не добавляется
        }
        itemSummary += "\n"; // Добавляем перенос строки после каждого пункта

        // Проверяем, поместится ли текущий пункт
        if (itemSummary.length > remainingLengthBudget && i < itemsForMessage.length - 1) {
          shortMessage += `\n<i>... и еще ${itemsForMessage.length - i} пунктов (список сокращен)</i>`;
          break; // Выходим из цикла, так как место закончилось
        }
        
        shortMessage += itemSummary;
        remainingLengthBudget -= itemSummary.length;

        // Дополнительная проверка на случай, если последний добавленный элемент исчерпал бюджет
        if (remainingLengthBudget <= 0 && i < itemsForMessage.length - 1) {
          shortMessage += `\n<i>... и еще ${itemsForMessage.length - (i + 1)} пунктов (список сокращен)</i>`;
          break;
        }
      }
      message = shortMessage.trim();
    }
    return message;
  };
  
  const updateScrollValue = () => {
    if (commentsListRef.current) {
      scrollY.set(commentsListRef.current.scrollTop);
    }
  };
  
  useEffect(() => {
    const listElement = commentsListRef.current;
    if (listElement) {
      listElement.addEventListener('scroll', updateScrollValue);
      return () => {
        listElement.removeEventListener('scroll', updateScrollValue);
      };
    }
  }, [isOpen]); // Пересоздаем эффект при изменении состояния isOpen
  
  // Обработчик начала перетаскивания
  const handleDragStart = () => {
    setIsDragging(true);
  };
  
  // Обработчик завершения перетаскивания  
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number } }) => {
    const threshold = 150; // Порог для закрытия модального окна
    // setIsDragging(false); // УДАЛЕНО ИЗ НАЧАЛА ФУНКЦИИ

    // Если перетащили вниз больше порогового значения, закрываем
    if (info.offset.y > threshold) {
      dispatch(closeAtoModal()); // Закрываем модальное окно
    } else {
      // Иначе возвращаем на место
      y.set(0);
    }
    setIsDragging(false); // ДОБАВЛЕНО В КОНЕЦ ФУНКЦИИ
  };
  
  // Переключение режима создания уведомления
  const handleCreateNotificationMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setAtoCreateMode(true));
  };
  
  const cancelCreateNotification = () => {
    dispatch(setAtoCreateMode(false));
    dispatch(resetSelection());
  };
  
  const handleToggleCommentSelection = (title: string) => {
    dispatch(toggleCommentSelection(title));
  };
  
  const handleToggleCommentTextSelection = (comment: { title: string, text: string }) => {
    // Очищаем текст комментария от метаданных
    const cleanedText = cleanCommentText(comment.text);
    dispatch(toggleCommentTextSelection(cleanedText));
  };
  
  const toggleCommentExpanded = (title: string) => {
    // Используем функциональный апдейт для гарантии актуальности состояния
    setExpandedComments(current => {
      // Если комментарий уже раскрыт, закрываем его
      if (current.includes(title)) {
        return current.filter(t => t !== title);
      }
      // Иначе раскрываем
      return [...current, title];
    });
  };
  
  const handleSelectAllComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(selectAllComments());
  };
  
  const handleSelectAllCommentTexts = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allCommentTexts = comments
      .filter(c => c.text && cleanCommentText(c.text).length > 0)
      .map(c => cleanCommentText(c.text));
    dispatch(selectAllCommentTexts(allCommentTexts));
    
    // Раскрыть все комментарии
    const allCommentTitles = comments
      .filter(c => c.text && cleanCommentText(c.text).length > 0)
      .map(c => c.title);
    setExpandedComments(allCommentTitles);
  };
  
  const handleResetSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(resetSelection());
  };
  
  // Функция вызывается из Footer
  const handleCreateNotification = (eventId?: number) => {
    // Создаем форматированное сообщение, включающее и пункты, и комментарии
    const formattedMessage = generateFormattedMessage();
    
    onCreateNotification({
      selectedComments,
      selectedCommentTexts,
      formattedMessage, // Добавляем форматированное сообщение
      eventId // Передаем eventId, если он был получен
    });
    dispatch(closeAtoModal());
  };

  // Добавляем эффект для прослушивания события
  useEffect(() => {
    const handleCreateEvent = (e: Event) => {
      if (isOpen && isCreateNotificationMode) {
        console.log('AtoCommentsModal: Получено событие ato:create-notification');
        // Получаем eventId из CustomEvent
        const customEvent = e as CustomEvent;
        const eventId = customEvent.detail?.eventId;
        
        if (!eventId) {
          console.error('Ошибка: Не получен ID события в событии ato:create-notification');
          return;
        }
        
        console.log(`AtoCommentsModal: Получен eventId = ${eventId}`);
        
        // Даже если нет выбранных комментариев, мы всё равно вызываем handleCreateNotification
        // чтобы пустые пункты могли быть обработаны
        if (selectedComments.length === 0 && selectedCommentTexts.length === 0) {
          console.log(`AtoCommentsModal: Нет выбранных комментариев, но создаем уведомление для события ${eventId}`);
        }
        
        handleCreateNotification(eventId);
      }
    };

    document.addEventListener('ato:create-notification', handleCreateEvent);
    
    return () => {
      document.removeEventListener('ato:create-notification', handleCreateEvent);
    };
  }, [isOpen, isCreateNotificationMode, selectedComments, selectedCommentTexts]);
  
  // Экспортируем функции через Redux вместо window
  // Функция для очистки текста комментария от метаданных и ответов
  const cleanCommentText = (text: string): string => {
    // Разбиваем текст на строки
    const lines = text.split('\n');
    let cleanedLines: string[] = [];
    
    // Обрабатываем каждую строку
    lines.forEach(line => {
      // Проверяем, содержит ли строка метаданные в формате [Имя Дата Время]
      const metadataRegex = /\[.*?\s\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}\]\s/;
      
      // Удаляем метаданные
      const cleanLine = line.replace(metadataRegex, '');
      
      // Если строка не является ответом (обычно начинается с имени автора)
      if (!metadataRegex.test(line) || cleanedLines.length === 0) {
        cleanedLines.push(cleanLine);
      }
    });
    
    return cleanedLines.join('\n');
  };
  
  // Добавляем состояние для фильтров
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    penaltyOnly: false,
    noPenaltyOnly: false,
    commentWithPenaltyOnly: false,
    commentWithoutPenaltyOnly: false
  });
  // УДАЛЯЕМ СОСТОЯНИЕ ДЛЯ ФОРМАТА УВЕДОМЛЕНИЯ
  // const [notificationFormat, setNotificationFormat] = useState<'table' | 'text'>('table');
  
  // Функция для подсчета активных фильтров
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;
  
  // Функция сброса фильтров
  const resetFilters = () => {
    setFilters({
      penaltyOnly: false,
      noPenaltyOnly: false,
      commentWithPenaltyOnly: false,
      commentWithoutPenaltyOnly: false
    });
  };
  
  // Обновляем функцию фильтрации комментариев с учетом фильтров
  const filteredComments = React.useMemo(() => {
    if (!comments || !comments.length) return { violations: [], notes: [] };

    let filteredViolations = comments.filter(comment => 
      comment.penaltyPoints !== undefined && comment.penaltyPoints > 0
    );
    
    let filteredNotes = comments.filter(comment => 
      comment.penaltyPoints === undefined || comment.penaltyPoints === 0
    );
    
    // Фильтр "Только пункты со штрафами"
    if (filters.penaltyOnly) {
      filteredNotes = []; 
    }
    
    // Фильтр "Только пункты без штрафов"
    if (filters.noPenaltyOnly) {
      filteredViolations = []; 
    }
    
    // Фильтр "Только комментарии со штрафами"
    // Применяется к уже отфильтрованным violations. Не должен влиять на notes напрямую.
    if (filters.commentWithPenaltyOnly) {
      filteredViolations = filteredViolations.filter(comment => comment.text && comment.text.trim() !== '');
      // Если активен ТОЛЬКО этот фильтр (и не активен общий penaltyOnly),
      // то пункты без штрафов (notes) нужно скрыть, чтобы показать только комменты со штрафами.
      if (!filters.penaltyOnly && !filters.noPenaltyOnly && !filters.commentWithoutPenaltyOnly) {
        filteredNotes = [];
      }
    }
    
    // Фильтр "Только комментарии без штрафов"
    // Применяется к уже отфильтрованным notes. Не должен влиять на violations напрямую.
    if (filters.commentWithoutPenaltyOnly) {
      filteredNotes = filteredNotes.filter(comment => comment.text && comment.text.trim() !== '');
      // Если активен ТОЛЬКО этот фильтр (и не активен общий noPenaltyOnly),
      // то пункты со штрафами (violations) нужно скрыть, чтобы показать только комменты без штрафов.
      if (!filters.noPenaltyOnly && !filters.penaltyOnly && !filters.commentWithPenaltyOnly) {
        filteredViolations = [];
      }
    }
    
    // Сортируем нарушения по величине штрафа (от большего к меньшему)
    filteredViolations.sort((a, b) => {
      const penaltyA = a.penaltyPoints || 0;
      const penaltyB = b.penaltyPoints || 0;
      return penaltyB - penaltyA;
    });
    
    return { violations: filteredViolations, notes: filteredNotes };
  }, [comments, filters]);
  
  // Заменяем прямое использование comments на filteredComments
  const hasViolations = filteredComments.violations && filteredComments.violations.length > 0;
  const hasNotes = filteredComments.notes && filteredComments.notes.length > 0;
  
  // Функция для обновления фильтров и автоматического выбора отфильтрованных элементов
  const updateFiltersAndSelection = (newFilters: typeof filters) => {
    // Сначала обновляем фильтры
    setFilters(newFilters);
    
    // Затем сбрасываем текущий выбор
    dispatch(resetSelection());
    
    // Определяем, какие элементы нужно выбрать в зависимости от новых фильтров
    const filteredViolations = comments.filter(comment => 
      comment.penaltyPoints !== undefined && comment.penaltyPoints > 0
    );
    
    const filteredNotes = comments.filter(comment => 
      comment.penaltyPoints === undefined || comment.penaltyPoints === 0
    );
    
    let itemsToSelect: string[] = [];
    let textsToSelect: string[] = [];
    
    // Применяем логику фильтрации для выбора элементов
    if (newFilters.penaltyOnly) {
      // Выбираем все пункты со штрафами
      itemsToSelect = filteredViolations.map(comment => comment.title);
    }
    
    if (newFilters.noPenaltyOnly) {
      // Выбираем все пункты без штрафов
      itemsToSelect = [...itemsToSelect, ...filteredNotes.map(comment => comment.title)];
    }
    
    if (newFilters.commentWithPenaltyOnly) {
      // Выбираем все комментарии со штрафами, которые имеют текст
      const commentsWithText = filteredViolations.filter(comment => comment.text && comment.text.trim() !== '');
      
      // Только тексты комментариев
      textsToSelect = commentsWithText
        .filter(comment => comment.text)
        .map(comment => cleanCommentText(comment.text));
    }
    
    if (newFilters.commentWithoutPenaltyOnly) {
      // Выбираем все комментарии без штрафов, которые имеют текст
      const commentsWithText = filteredNotes.filter(comment => comment.text && comment.text.trim() !== '');
      
      // Только тексты комментариев
      textsToSelect = [...textsToSelect, ...commentsWithText
        .filter(comment => comment.text)
        .map(comment => cleanCommentText(comment.text))];
    }
    
    // Если что-то было выбрано, применяем выбор
    if (itemsToSelect.length > 0) {
      // Выбираем все заголовки из фильтра
      itemsToSelect.forEach(title => {
        dispatch(toggleCommentSelection(title));
      });
    }
    
    if (textsToSelect.length > 0) {
      // Выбираем все тексты комментариев из фильтра
      textsToSelect.forEach(text => {
        // Правильный способ вызова toggleCommentTextSelection - передаем прямо текст
        dispatch(toggleCommentTextSelection(text));
      });
      
      // Также раскрываем соответствующие комментарии
      const commentTitles = comments
        .filter(c => c.text && textsToSelect.includes(cleanCommentText(c.text)))
        .map(c => c.title);
      
      setExpandedComments(commentTitles);
    }
  };

  // Обновляем обработчики фильтров, чтобы использовать новую функцию
  const handlePenaltyOnlyChange = () => {
    const newFilters = {
      ...filters,
      penaltyOnly: !filters.penaltyOnly,
      noPenaltyOnly: false,  // Отключаем противоположный фильтр
    };
    updateFiltersAndSelection(newFilters);
  };

  const handleNoPenaltyOnlyChange = () => {
    const newFilters = {
      ...filters,
      noPenaltyOnly: !filters.noPenaltyOnly,
      penaltyOnly: false,  // Отключаем противоположный фильтр 
    };
    updateFiltersAndSelection(newFilters);
  };

  const handleCommentWithPenaltyOnlyChange = () => {
    const newFilters = {
      ...filters,
      commentWithPenaltyOnly: !filters.commentWithPenaltyOnly,
      commentWithoutPenaltyOnly: false,  // Отключаем противоположный фильтр
    };
    updateFiltersAndSelection(newFilters);
  };

  const handleCommentWithoutPenaltyOnlyChange = () => {
    const newFilters = {
      ...filters,
      commentWithoutPenaltyOnly: !filters.commentWithoutPenaltyOnly,
      commentWithPenaltyOnly: false,  // Отключаем противоположный фильтр
    };
    updateFiltersAndSelection(newFilters);
  };

  return (
    <>
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      {/* @ts-ignore */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Статический оверлей для клика и основного отображения */}
            <motion.div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(2px)',
                zIndex: 1000
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                dispatch(closeAtoModal());
              }}
            />
            
            {/* Динамический оверлей для эффекта при перетаскивании */}
            <motion.div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(2px)',
                zIndex: 1000,
                opacity: overlayOpacity,
                pointerEvents: 'none'
              }}
            />
            
            {/* Контейнер модального окна с фиксированным позиционированием */}
            <ModalContainer
              ref={containerRef}
              style={{ 
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                margin: '0 auto',
                zIndex: 1001,
                y,
                boxShadow: isDragging 
                  ? '0 10px 25px rgba(0, 0, 0, 0.25)' 
                  : 'var(--shadow-lg)'
              }}
              initial={{ y: '100%' }}
              animate={{ 
                y: 0,
                transition: { 
                  type: "spring", 
                  damping: 25, 
                  stiffness: 300,
                  mass: 0.8
                }
              }}
              exit={{ 
                y: '100%',
                transition: { 
                  duration: 0.3,
                  ease: "easeInOut" 
                }
              }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <ModalHeader>
                <DragHandle 
                  initial={{ opacity: 0.7, x: "-50%" }}
                  animate={{ opacity: 1, x: "-50%" }}
                  whileHover={{ opacity: 1, x: "-50%", scale: 1.1 }}
                  whileTap={{ opacity: 1, x: "-50%", scale: 0.95 }}
                />
                <h2>
                  Замечания АТО
                  {objectName && <span>({objectName})</span>}
                </h2>
              </ModalHeader>
              
              <ModalContent>
                {isCreateNotificationMode ? (
                  <CommentSelectionContainer>
                    <SelectionSummary>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <SummaryTitle>
                          Что включить в уведомление:
                        </SummaryTitle>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Badge 
                            badgeContent={activeFiltersCount} 
                            color="primary"
                            invisible={activeFiltersCount === 0}
                            overlap="circular"
                            anchorOrigin={{
                              vertical: 'top',
                              horizontal: 'right',
                            }}
                          >
                            <FilterButton
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setShowFilters(!showFilters)}
                              className={showFilters ? 'active' : ''}
                            >
                              <TuneIcon style={{ fontSize: '16px' }} />
                              Фильтры
                            </FilterButton>
                          </Badge>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {selectedComments.length > 0 && (
                          <SummaryDetail>
                            <CheckIcon style={{ fontSize: '14px' }} />
                            {selectedComments.length} пунктов
                          </SummaryDetail>
                        )}
                        {selectedCommentTexts.length > 0 && (
                          <SummaryDetail>
                            <CommentIcon style={{ fontSize: '14px' }} />
                            {selectedCommentTexts.length} комментариев
                          </SummaryDetail>
                        )}
                        {selectedComments.length === 0 && selectedCommentTexts.length === 0 && (
                          <SummaryDetail style={{ fontStyle: 'italic', opacity: 0.7 }}>
                            Ничего не выбрано
                          </SummaryDetail>
                        )}
                      </div>
                    </SelectionSummary>
                    
                    {showFilters && (
                      <>
                        {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                        {/* @ts-ignore */}
                        <AnimatePresence>
                          {showFilters && (
                            <FilterPanel
                              initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <FilterTitle>
                                <FilterListIcon style={{ fontSize: '16px' }} />
                                Фильтрация пунктов
                              </FilterTitle>
                              
                              <FilterOption>
                                <Checkbox 
                                  size="small" 
                                  checked={filters.penaltyOnly} 
                                  onChange={handlePenaltyOnlyChange}
                                />
                                <Typography variant="body2">Только пункты со штрафами</Typography>
                              </FilterOption>
                              
                              <FilterOption>
                                <Checkbox 
                                  size="small" 
                                  checked={filters.noPenaltyOnly} 
                                  onChange={handleNoPenaltyOnlyChange}
                                />
                                <Typography variant="body2">Только пункты без штрафов</Typography>
                              </FilterOption>
                              
                              <FilterTitle style={{ marginTop: '12px' }}>
                                <CommentIcon style={{ fontSize: '16px' }} />
                                Фильтрация комментариев
                              </FilterTitle>
                              
                              <FilterOption>
                                <Checkbox 
                                  size="small" 
                                  checked={filters.commentWithPenaltyOnly} 
                                  onChange={handleCommentWithPenaltyOnlyChange}
                                />
                                <Typography variant="body2">Только комментарии со штрафами</Typography>
                              </FilterOption>
                              
                              <FilterOption>
                                <Checkbox 
                                  size="small" 
                                  checked={filters.commentWithoutPenaltyOnly} 
                                  onChange={handleCommentWithoutPenaltyOnlyChange}
                                />
                                <Typography variant="body2">Только комментарии без штрафов</Typography>
                              </FilterOption>
                              
                              <FilterActions>
                                <FilterActionButton
                                  color="secondary"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={resetFilters}
                                  disabled={activeFiltersCount === 0}
                                >
                                  Сбросить
                                </FilterActionButton>
                                
                                <FilterActionButton
                                  color="primary"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setShowFilters(false)}
                                >
                                  Применить
                                </FilterActionButton>
                              </FilterActions>
                            </FilterPanel>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                    
                    {/* Объединенный список пунктов с комментариями */}
                    <div style={{ 
                      flex: 1,
                      maxHeight: 'calc(589px - 40px)', // Уменьшаем высоту под кнопки выбора формата
                      overflow: 'auto',
                      paddingRight: '10px',
                      paddingBottom: '80px' // Увеличиваем отступ для единообразия, исправил ошибку с кавычкой в комментарии
                    }}>
                      {/* Удаляем отдельный блок с фильтрами, так как он теперь в SelectionSummary */}
                      
                      {/* Отображаем нарушения со штрафами */}
                      {hasViolations && filteredComments.violations.map((comment: AtoComment, index: number) => {
                        const isExpanded = expandedComments.includes(comment.title);
                        // Для пунктов со штрафами всегда разрешаем раскрытие и отображение
                        const hasComment = true;
                        
                        return (
                          <EnhancedCommentCard
                            key={`view-violation-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ 
                              opacity: 1, 
                              y: 0,
                              transition: { 
                                delay: index * 0.03,
                                duration: 0.2
                              }
                            }}
                          >
                            <CardHeader 
                              $hasComment={hasComment === true ? true : null} 
                              $isExpanded={isExpanded === true ? true : null}
                              $isSelected={selectedComments.includes(comment.title) ? true : null}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasComment) {
                                  toggleCommentExpanded(comment.title);
                                }
                              }}
                              style={{ cursor: hasComment ? 'pointer' : 'default' }}
                            >
                              {isCreateNotificationMode && (
                                <StyledCheckbox 
                                  checked={selectedComments.includes(comment.title)}
                                  onChange={() => handleToggleCommentSelection(comment.title)}
                                  onClick={(e) => e.stopPropagation()}
                                  color="primary"
                                  size="small"
                                />
                              )}
                              <CardTitle>
                                {comment.title}
                                {hasComment && (
                                  <CommentToggleButton $isSelected={isExpanded === true ? true : null}>
                                    <CommentIconAnimated 
                                      fontSize="small" 
                                      $isActive={isExpanded === true ? true : null}
                                    />
                                    <ExpandIcon>
                                      <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        <KeyboardArrowDownIcon />
                                      </motion.div>
                                    </ExpandIcon>
                                  </CommentToggleButton>
                                )}
                                {/* Отображаем штрафные баллы */}
                                {comment.penaltyPoints !== undefined && comment.penaltyPoints > 0 && (
                                  <div style={{ 
                                    marginLeft: '8px',
                                    backgroundColor: 'var(--error-color)',
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}>
                                    -{comment.penaltyPoints}
                                  </div>
                                )}
                              </CardTitle>
                            </CardHeader>
                            {hasComment && (
                              <div>
                                {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                                {/* @ts-ignore */}
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <CommentContentWrapper
                                      key={`comment-view-${comment.title}`}
                                      initial="collapsed"
                                      animate="expanded"
                                      exit="collapsed"
                                      variants={fastAnimationVariants}
                                    >
                                      {isCreateNotificationMode ? (
                                        <CommentContent 
                                          $isSelected={selectedCommentTexts.includes(cleanCommentText(comment.text || "")) ? true : null}
                                          onClick={() => handleToggleCommentTextSelection(comment)}
                                        >
                                          <Typography 
                                            variant="body2" 
                                            style={{ 
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.9rem'
                                            }}
                                          >
                                            {comment.text && cleanCommentText(comment.text).length > 0 
                                              ? cleanCommentText(comment.text)
                                              : <i>Комментарий отсутствует. При добавлении комментария в системе RetailiQA, он появится здесь автоматически при следующем обновлении.</i>}
                                            {comment.penaltyPoints !== undefined && comment.penaltyPoints > 0 && (
                                              <div style={{ 
                                                marginTop: '8px',
                                                color: 'var(--error-color)',
                                                fontWeight: 'bold'
                                              }}>
                                                Штраф: -{comment.penaltyPoints} баллов
                                              </div>
                                            )}
                                          </Typography>
                                        </CommentContent>
                                      ) : (
                                        <CommentContent>
                                          <Typography 
                                            variant="body2" 
                                            style={{ 
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.9rem'
                                            }}
                                          >
                                            {comment.text && cleanCommentText(comment.text).length > 0 
                                              ? cleanCommentText(comment.text)
                                              : <i>Комментарий отсутствует. При добавлении комментария в системе RetailiQA, он появится здесь автоматически при следующем обновлении.</i>}
                                            {comment.penaltyPoints !== undefined && comment.penaltyPoints > 0 && (
                                              <div style={{ 
                                                marginTop: '8px',
                                                color: 'var(--error-color)',
                                                fontWeight: 'bold'
                                              }}>
                                                Штраф: -{comment.penaltyPoints} баллов
                                              </div>
                                            )}
                                          </Typography>
                                        </CommentContent>
                                      )}
                                    </CommentContentWrapper>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </EnhancedCommentCard>
                        );
                      })}
                      
                      {/* Разделитель и замечания без штрафов */}
                      {hasNotes && (
                        <CommentSectionDivider>
                          <ErrorOutlineIcon style={{ fontSize: '18px', color: 'var(--warning-color)' }} />
                          Замечания без штрафных баллов
                        </CommentSectionDivider>
                      )}
                      
                      {hasNotes && filteredComments.notes.map((comment: AtoComment, index: number) => {
                        const isExpanded = expandedComments.includes(comment.title);
                        const hasComment = true; // Для всех замечаний также разрешаем раскрытие и отображение
                        
                        return (
                          <EnhancedCommentCard
                            key={`view-note-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ 
                              opacity: 1, 
                              y: 0,
                              transition: { 
                                delay: index * 0.03 + (hasViolations ? 0.2 : 0),
                                duration: 0.2
                              }
                            }}
                            style={{
                              borderLeft: '4px solid var(--warning-color)',
                              opacity: 0.9
                            }}
                          >
                            <CardHeader 
                              $hasComment={hasComment === true ? true : null} 
                              $isExpanded={isExpanded === true ? true : null}
                              // Добавляем $isSelected для заметок, если они выбраны
                              $isSelected={selectedComments.includes(comment.title) ? true : null}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasComment) {
                                  toggleCommentExpanded(comment.title);
                                }
                              }}
                              style={{ cursor: hasComment ? 'pointer' : 'default' }}
                            >
                              {/* ДОБАВЛЯЕМ ЧЕКБОКС ДЛЯ ВЫБОРА ПУНКТА (ЗАМЕТКИ) */}
                              {isCreateNotificationMode && (
                                <StyledCheckbox 
                                  checked={selectedComments.includes(comment.title)}
                                  onChange={() => handleToggleCommentSelection(comment.title)}
                                  onClick={(e) => e.stopPropagation()}
                                  color="primary"
                                  size="small"
                                />
                              )}
                              <CardTitle>
                                {comment.title}
                                {hasComment && (
                                  <CommentToggleButton $isSelected={isExpanded === true ? true : null}>
                                    <CommentIconAnimated 
                                      fontSize="small" 
                                      $isActive={isExpanded === true ? true : null}
                                    />
                                    <ExpandIcon>
                                      <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        <KeyboardArrowDownIcon />
                                      </motion.div>
                                    </ExpandIcon>
                                  </CommentToggleButton>
                                )}
                                {/* Убираем отображение штрафных баллов, т.к. это заметки без штрафов */}
                              </CardTitle>
                            </CardHeader>
                            
                            {hasComment && (
                              <div>
                                {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                                {/* @ts-ignore */}
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <CommentContentWrapper
                                      key={`comment-view-${comment.title}`}
                                      initial="collapsed"
                                      animate="expanded"
                                      exit="collapsed"
                                      variants={fastAnimationVariants}
                                    >
                                      {/* ДОБАВЛЯЕМ ЛОГИКУ ВЫБОРА ТЕКСТА КОММЕНТАРИЯ КАК У НАРУШЕНИЙ */}
                                      {isCreateNotificationMode ? (
                                        <CommentContent 
                                          $isSelected={selectedCommentTexts.includes(cleanCommentText(comment.text || "")) ? true : null}
                                          onClick={() => handleToggleCommentTextSelection(comment)}
                                        >
                                          <Typography 
                                            variant="body2" 
                                            style={{ 
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.9rem'
                                            }}
                                          >
                                            {comment.text && cleanCommentText(comment.text).length > 0 
                                              ? cleanCommentText(comment.text)
                                              : <i>Комментарий отсутствует. При добавлении комментария в системе RetailiQA, он появится здесь автоматически при следующем обновлении.</i>}
                                            {/* Штрафы здесь не отображаем, т.к. это заметки */}
                                          </Typography>
                                        </CommentContent>
                                      ) : (
                                        <CommentContent>
                                          <Typography 
                                            variant="body2" 
                                            style={{ 
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.9rem'
                                            }}
                                          >
                                            {comment.text && cleanCommentText(comment.text).length > 0 
                                              ? cleanCommentText(comment.text)
                                              : <i>Комментарий отсутствует. При добавлении комментария в системе RetailiQA, он появится здесь автоматически при следующем обновлении.</i>}
                                            {/* Штрафы здесь не отображаем, т.к. это заметки */}
                                          </Typography>
                                        </CommentContent>
                                      )}
                                    </CommentContentWrapper>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </EnhancedCommentCard>
                        );
                      })}
                    </div>
                  </CommentSelectionContainer>
                ) : comments.length > 0 ? (
                  <AnimatedContentContainer>
                    {/* Удаляем блок с фильтрами в режиме просмотра */}
                    
                    {/* Восстанавливаем оригинальную логику скрытия диаграммы */}
                    {scorePercentage !== undefined && (
                      <ScoreSummaryContainer
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ 
                          x: scoreBlockX,
                          opacity: scoreBlockOpacity,
                          height: scoreBlockHeight,
                          position: "relative", // Убедимся, что не нарушаем поток документа
                          marginBottom: scoreBottomMargin,
                          pointerEvents: scorePointerEvents
                        }}
                      >
                        <ScoreHeader>Результат проверки АТО</ScoreHeader>
                        <ScoreProgress>
                          <ScoreCircle 
                            $percentage={scorePercentage || 0}
                            initial={{ rotate: -90 }}
                            animate={{ 
                              background: [
                                `conic-gradient(var(--primary-color) 0%, var(--gray-200) 0% 100%)`,
                                `conic-gradient(var(--primary-color) ${scorePercentage}%, var(--gray-200) ${scorePercentage}% 100%)`
                              ]
                            }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                          <ScoreInnerCircle>
                            <ScoreValue>
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                              >
                                {scorePercentage !== undefined ? Math.round(scorePercentage) : 0}%
                              </motion.span>
                            </ScoreValue>
                            <ScoreLabel>Выполнение</ScoreLabel>
                          </ScoreInnerCircle>
                        </ScoreProgress>
                        
                        <ScoreDetails>
                          {maxPoints !== undefined && (
                            <ScoreDetailItem>
                              <ScoreDetailValue $type="max">
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.8, duration: 0.5 }}
                                >
                                  {maxPoints}
                                </motion.span>
                              </ScoreDetailValue>
                              <ScoreDetailLabel>Макс. баллы</ScoreDetailLabel>
                            </ScoreDetailItem>
                          )}
                          
                          {earnedPoints !== undefined && (
                            <ScoreDetailItem>
                              <ScoreDetailValue $type="earned">
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 1.0, duration: 0.5 }}
                                >
                                  {earnedPoints}
                                </motion.span>
                              </ScoreDetailValue>
                              <ScoreDetailLabel>Набрано</ScoreDetailLabel>
                            </ScoreDetailItem>
                          )}
                          
                          {penaltyPoints !== undefined && (
                            <ScoreDetailItem>
                              <ScoreDetailValue $type="penalty">
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 1.2, duration: 0.5 }}
                                >
                                  {penaltyPoints}
                                </motion.span>
                              </ScoreDetailValue>
                              <ScoreDetailLabel>Штрафы</ScoreDetailLabel>
                            </ScoreDetailItem>
                          )}
                        </ScoreDetails>
                      </ScoreSummaryContainer>
                    )}

                    {/* Затем увеличиваем высоту списка пунктов */}
                    <CommentsContainer
                      ref={commentsListRef}
                      style={{ 
                        maxHeight: commentsMaxHeight,
                        marginTop: commentsMarginTop
                      }}
                    >
                      {/* Отображаем нарушения со штрафами */}
                      {hasViolations && filteredComments.violations.map((comment: AtoComment, index: number) => {
                        const isExpanded = expandedComments.includes(comment.title);
                        // Для пунктов со штрафами всегда разрешаем раскрытие и отображение
                        const hasComment = true;
                        
                        return (
                          <EnhancedCommentCard
                            key={`view-violation-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ 
                              opacity: 1, 
                              y: 0,
                              transition: { 
                                delay: index * 0.03,
                                duration: 0.2
                              }
                            }}
                          >
                            <CardHeader 
                              $hasComment={hasComment === true ? true : null} 
                              $isExpanded={isExpanded === true ? true : null}
                              $isSelected={selectedComments.includes(comment.title) ? true : null}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasComment) {
                                  toggleCommentExpanded(comment.title);
                                }
                              }}
                              style={{ cursor: hasComment ? 'pointer' : 'default' }}
                            >
                              {isCreateNotificationMode && (
                                <StyledCheckbox 
                                  checked={selectedComments.includes(comment.title)}
                                  onChange={() => handleToggleCommentSelection(comment.title)}
                                  onClick={(e) => e.stopPropagation()}
                                  color="primary"
                                  size="small"
                                />
                              )}
                              <CardTitle>
                                {comment.title}
                                {hasComment && (
                                  <CommentToggleButton $isSelected={isExpanded === true ? true : null}>
                                    <CommentIconAnimated 
                                      fontSize="small" 
                                      $isActive={isExpanded === true ? true : null}
                                    />
                                    <ExpandIcon>
                                      <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        <KeyboardArrowDownIcon />
                                      </motion.div>
                                    </ExpandIcon>
                                  </CommentToggleButton>
                                )}
                                {/* Отображаем штрафные баллы */}
                                {comment.penaltyPoints !== undefined && comment.penaltyPoints > 0 && (
                                  <div style={{ 
                                    marginLeft: '8px',
                                    backgroundColor: 'var(--error-color)',
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}>
                                    -{comment.penaltyPoints}
                                  </div>
                                )}
                              </CardTitle>
                            </CardHeader>
                            
                            {hasComment && (
                              <div>
                                {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                                {/* @ts-ignore */}
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <CommentContentWrapper
                                      key={`comment-view-${comment.title}`}
                                      initial="collapsed"
                                      animate="expanded"
                                      exit="collapsed"
                                      variants={fastAnimationVariants}
                                    >
                                      {isCreateNotificationMode ? (
                                        <CommentContent 
                                          $isSelected={selectedCommentTexts.includes(cleanCommentText(comment.text || "")) ? true : null}
                                          onClick={() => handleToggleCommentTextSelection(comment)}
                                        >
                                          <Typography 
                                            variant="body2" 
                                            style={{ 
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.9rem'
                                            }}
                                          >
                                            {comment.text && cleanCommentText(comment.text).length > 0 
                                              ? cleanCommentText(comment.text)
                                              : <i>Комментарий отсутствует. При добавлении комментария в системе RetailiQA, он появится здесь автоматически при следующем обновлении.</i>}
                                            {comment.penaltyPoints !== undefined && comment.penaltyPoints > 0 && (
                                              <div style={{ 
                                                marginTop: '8px',
                                                color: 'var(--error-color)',
                                                fontWeight: 'bold'
                                              }}>
                                                Штраф: -{comment.penaltyPoints} баллов
                                              </div>
                                            )}
                                          </Typography>
                                        </CommentContent>
                                      ) : (
                                        <CommentContent>
                                          <Typography 
                                            variant="body2" 
                                            style={{ 
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.9rem'
                                            }}
                                          >
                                            {comment.text && cleanCommentText(comment.text).length > 0 
                                              ? cleanCommentText(comment.text)
                                              : <i>Комментарий отсутствует. При добавлении комментария в системе RetailiQA, он появится здесь автоматически при следующем обновлении.</i>}
                                            {comment.penaltyPoints !== undefined && comment.penaltyPoints > 0 && (
                                              <div style={{ 
                                                marginTop: '8px',
                                                color: 'var(--error-color)',
                                                fontWeight: 'bold'
                                              }}>
                                                Штраф: -{comment.penaltyPoints} баллов
                                              </div>
                                            )}
                                          </Typography>
                                        </CommentContent>
                                      )}
                                    </CommentContentWrapper>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </EnhancedCommentCard>
                        );
                      })}
                      
                      {/* Разделитель и замечания без штрафов */}
                      {hasNotes && (
                        <CommentSectionDivider>
                          <ErrorOutlineIcon style={{ fontSize: '18px', color: 'var(--warning-color)' }} />
                          Замечания без штрафных баллов
                        </CommentSectionDivider>
                      )}
                      
                      {hasNotes && filteredComments.notes.map((comment: AtoComment, index: number) => {
                        const isExpanded = expandedComments.includes(comment.title);
                        const hasComment = true; // Для всех замечаний также разрешаем раскрытие и отображение
                        
                        return (
                          <EnhancedCommentCard
                            key={`view-note-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ 
                              opacity: 1, 
                              y: 0,
                              transition: { 
                                delay: index * 0.03 + (hasViolations ? 0.2 : 0),
                                duration: 0.2
                              }
                            }}
                            style={{
                              borderLeft: '4px solid var(--warning-color)',
                              opacity: 0.9
                            }}
                          >
                            <CardHeader 
                              $hasComment={hasComment === true ? true : null} 
                              $isExpanded={isExpanded === true ? true : null}
                              // Добавляем $isSelected для заметок, если они выбраны
                              $isSelected={selectedComments.includes(comment.title) ? true : null}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasComment) {
                                  toggleCommentExpanded(comment.title);
                                }
                              }}
                              style={{ cursor: hasComment ? 'pointer' : 'default' }}
                            >
                              {/* ДОБАВЛЯЕМ ЧЕКБОКС ДЛЯ ВЫБОРА ПУНКТА (ЗАМЕТКИ) */}
                              {isCreateNotificationMode && (
                                <StyledCheckbox 
                                  checked={selectedComments.includes(comment.title)}
                                  onChange={() => handleToggleCommentSelection(comment.title)}
                                  onClick={(e) => e.stopPropagation()}
                                  color="primary"
                                  size="small"
                                />
                              )}
                              <CardTitle>
                                {comment.title}
                                {hasComment && (
                                  <CommentToggleButton $isSelected={isExpanded === true ? true : null}>
                                    <CommentIconAnimated 
                                      fontSize="small" 
                                      $isActive={isExpanded === true ? true : null}
                                    />
                                    <ExpandIcon>
                                      <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        <KeyboardArrowDownIcon />
                                      </motion.div>
                                    </ExpandIcon>
                                  </CommentToggleButton>
                                )}
                                {/* Убираем отображение штрафных баллов, т.к. это заметки без штрафов */}
                              </CardTitle>
                            </CardHeader>
                            
                            {hasComment && (
                              <div>
                                {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                                {/* @ts-ignore */}
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <CommentContentWrapper
                                      key={`comment-view-${comment.title}`}
                                      initial="collapsed"
                                      animate="expanded"
                                      exit="collapsed"
                                      variants={fastAnimationVariants}
                                    >
                                      {/* ДОБАВЛЯЕМ ЛОГИКУ ВЫБОРА ТЕКСТА КОММЕНТАРИЯ КАК У НАРУШЕНИЙ */}
                                      {isCreateNotificationMode ? (
                                        <CommentContent 
                                          $isSelected={selectedCommentTexts.includes(cleanCommentText(comment.text || "")) ? true : null}
                                          onClick={() => handleToggleCommentTextSelection(comment)}
                                        >
                                          <Typography 
                                            variant="body2" 
                                            style={{ 
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.9rem'
                                            }}
                                          >
                                            {comment.text && cleanCommentText(comment.text).length > 0 
                                              ? cleanCommentText(comment.text)
                                              : <i>Комментарий отсутствует. При добавлении комментария в системе RetailiQA, он появится здесь автоматически при следующем обновлении.</i>}
                                            {/* Штрафы здесь не отображаем, т.к. это заметки */}
                                          </Typography>
                                        </CommentContent>
                                      ) : (
                                        <CommentContent>
                                          <Typography 
                                            variant="body2" 
                                            style={{ 
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.9rem'
                                            }}
                                          >
                                            {comment.text && cleanCommentText(comment.text).length > 0 
                                              ? cleanCommentText(comment.text)
                                              : <i>Комментарий отсутствует. При добавлении комментария в системе RetailiQA, он появится здесь автоматически при следующем обновлении.</i>}
                                            {/* Штрафы здесь не отображаем, т.к. это заметки */}
                                          </Typography>
                                        </CommentContent>
                                      )}
                                    </CommentContentWrapper>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </EnhancedCommentCard>
                        );
                      })}
                    </CommentsContainer>
                  </AnimatedContentContainer>
                ) : (
                  <div style={{ 
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--card-background)',
                    borderRadius: 'var(--radius)',
                    border: '1px dashed var(--border-color)'
                  }}>
                    <ErrorOutlineIcon style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }} />
                    <Typography variant="body1">Нет замечаний</Typography>
                  </div>
                )}
              </ModalContent>
            </ModalContainer>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// Экспортируем компонент для возможности вызова метода createNotification
export { AtoCommentsModal };
// Экспортируем handleCreateNotification для вызова из других компонентов
export const handleCreateAtoNotification = () => {
  // Этот метод теперь используется - Redux вызывает глобальную функцию
  // которая затем использует внутренний handleCreateNotification компонента
  
  // Найдем экземпляр компонента и вызовем его метод
  // В реальном приложении можно использовать Redux для хранения 
  // selectedComments и selectedCommentTexts и обработки через middleware
  console.log("Внешний вызов handleCreateAtoNotification");
  
  // Имитация вызова действия в Redux - будет заменено на обработчик в EventList
  document.dispatchEvent(new CustomEvent('ato:create-notification'));
};

// Для обратной совместимости оставляем дефолтный экспорт
export default AtoCommentsModal; 