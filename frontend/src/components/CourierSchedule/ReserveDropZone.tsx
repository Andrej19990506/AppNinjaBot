import React from 'react';
import styled from 'styled-components';
// @ts-ignore // <<< Добавляем ignore для dnd-kit
import { useDroppable } from '@dnd-kit/core';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline'; // Using check icon for confirmation
import CircularProgress from '@mui/material/CircularProgress'; // Import spinner
import { motion, AnimatePresence } from 'framer-motion'; 
import defaultAvatar from '../../assets/images/Ninja.jpg'; 
// <<< Импорты для кнопок подтверждения >>>
import CheckIcon from '@mui/icons-material/Check'; 
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// Re-use the same type from ShiftSelectionDialog
interface ConfirmedCourierInfo {
    id: string;
    name: string;
    avatar: string | null;
}

// <<< ОБНОВЛЕННЫЙ ИНТЕРФЕЙС ПРОПСОВ >>>
interface ReserveDropZoneProps {
  isOver: boolean;
  isProcessing: boolean;
  isConfirming: boolean;
  confirmedCourierData: ConfirmedCourierInfo | null; // Данные для подтверждения (галочка)
  courierAwaitingActionData: ConfirmedCourierInfo | null; // Данные для обработки или ожидания
  isAwaitingConfirmation: boolean; // Флаг ожидания подтверждения
  onConfirm: () => void; // Обработчик подтверждения
  onCancel: () => void; // Обработчик отмены
}

// <<< ОБНОВЛЯЕМ СТИЛИ И ТИПЫ ДЛЯ DropZoneContainer >>>
const DropZoneContainer = styled(motion.div)<{ 
    $isOver: boolean; 
    $isProcessing: boolean; 
    $isConfirming: boolean;
    $isAwaitingConfirmation: boolean; // Добавлено
}>` 
  display: flex;
  flex: 1; 
  align-items: center;
  justify-content: center;
  padding: 12px; 
  margin: 0 4px 24px 4px; 
  // Adjust styles based on processing/confirming/awaiting
  border: 2px ${props => 
    props.$isProcessing ? 'dashed var(--primary-color)' : 
    props.$isConfirming ? 'solid transparent' : 
    props.$isAwaitingConfirmation ? 'dashed var(--orange-primary)' : // Как в DeleteDropZone
    props.$isOver ? 'solid var(--primary-color)' : 'dashed var(--primary-color)' 
  };
  background-color: ${props => 
    props.$isConfirming ? 'transparent' : 
    props.$isAwaitingConfirmation ? 'var(--primary-transparent)' : // Как в DeleteDropZone
    props.$isOver && !props.$isProcessing && !props.$isAwaitingConfirmation ? 'var(--primary-transparent)' : 'transparent' 
  };
  // Set color for processing/awaiting state
  color: ${props => 
    props.$isProcessing ? 'var(--primary-color)' : 
    props.$isAwaitingConfirmation ? 'var(--orange-dark)' : // Как в DeleteDropZone
    'var(--primary-color)'
  };
  transition: background-color 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s;
  border-radius: var(--radius-md, 6px);
  min-height: 48px; 
  box-sizing: border-box;
  text-align: center;
  // Обновляем cursor и opacity
  cursor: ${props => (props.$isProcessing || props.$isConfirming || props.$isAwaitingConfirmation) ? 'default' : 'grabbing'};
  opacity: ${props => (props.$isProcessing || props.$isAwaitingConfirmation) ? 0.9 : 1};
  overflow: hidden; 
`;

// Re-use content wrapper styles (or define separately if needed)
const ContentWrapper = styled(motion.div)`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
`;

const DefaultContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    svg {
        margin-right: 6px;
    }
    span {
        font-size: 0.9em;
    }
`;

const SmallAvatar = styled.img`
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
`;

// Re-use combined content for processing or confirmation
const ProcessingOrConfirmationContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
`;

// <<< Стили для панели подтверждения (скопированы из DeleteDropZone) >>>
const AwaitingConfirmationContent = styled(Box)`
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 6px;
`;

const ConfirmationText = styled(Typography)`
    font-size: 0.85em;
    flex-grow: 1;
    text-align: left;
    margin-left: 4px;
    margin-right: 4px;
`;

const ConfirmationActions = styled(Box)`
    display: flex;
    align-items: center;
`;

export const RESERVE_DROP_ZONE_ID = 'reserve-drop-zone';

// <<< ОБНОВЛЯЕМ КОМПОНЕНТ >>>
const ReserveDropZone: React.FC<ReserveDropZoneProps> = ({ 
    isOver, 
    isProcessing, 
    isConfirming, 
    confirmedCourierData, // Используем новые пропсы
    courierAwaitingActionData,
    isAwaitingConfirmation,
    onConfirm,
    onCancel,
}) => {
  const { setNodeRef } = useDroppable({
    id: RESERVE_DROP_ZONE_ID,
    disabled: isProcessing || isConfirming, 
    data: { 
      type: 'reserve-zone' 
    }
  });

  const contentVariants = {
      initial: { opacity: 0, scale: 0.7 },
      animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
      exit: { opacity: 0, scale: 0.7, transition: { duration: 0.15, ease: "easeIn" } }
  };
  
  // Определяем, какие данные показывать в зависимости от состояния
  const displayDataForProcessing = isProcessing ? courierAwaitingActionData : null;
  const displayDataForConfirmation = isConfirming ? confirmedCourierData : null;
  const displayDataForAwaiting = isAwaitingConfirmation ? courierAwaitingActionData : null;

  return (
    <DropZoneContainer 
        ref={setNodeRef} 
        $isOver={isOver} 
        $isProcessing={isProcessing}
        $isConfirming={isConfirming}
        $isAwaitingConfirmation={isAwaitingConfirmation} // Передаем проп
        layout
    >
        {/* @ts-ignore */}
        <AnimatePresence initial={false} mode="wait"> 
            {/* <<< ДОБАВЛЯЕМ БЛОК ДЛЯ isAwaitingConfirmation >>> */}
            {isAwaitingConfirmation && displayDataForAwaiting ? (
                 <ContentWrapper 
                    key="awaiting-confirmation-reserve"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                 >
                    <AwaitingConfirmationContent>
                        <SmallAvatar src={displayDataForAwaiting.avatar || defaultAvatar} alt={displayDataForAwaiting.name} />
                        <ConfirmationText variant="body2">
                            Резерв: <strong>{displayDataForAwaiting.name}</strong>?
                        </ConfirmationText>
                        <ConfirmationActions>
                            <IconButton onClick={onConfirm} size="small" color="success" aria-label="Подтвердить перемещение в резерв">
                                <CheckIcon />
                            </IconButton>
                            <IconButton onClick={onCancel} size="small" color="error" aria-label="Отменить перемещение в резерв">
                                <CloseIcon />
                            </IconButton>
                        </ConfirmationActions>
                    </AwaitingConfirmationContent>
                 </ContentWrapper>
            )
            /* <<< Существующий блок для isProcessing || isConfirming >>> */
            : (isProcessing || isConfirming) && (displayDataForProcessing || displayDataForConfirmation) ? (
                 <ContentWrapper 
                    key="processing-confirming-reserve"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                 >
                    <ProcessingOrConfirmationContent>
                         <SmallAvatar 
                            src={(displayDataForProcessing?.avatar || displayDataForConfirmation?.avatar) || defaultAvatar} 
                            alt={(displayDataForProcessing?.name || displayDataForConfirmation?.name) || 'Courier'} 
                         />
                         {isProcessing && (
                             <CircularProgress size={24} color="inherit" />
                         )}
                         {isConfirming && (
                             <CheckCircleIcon />
                         )}
                    </ProcessingOrConfirmationContent>
                 </ContentWrapper>
            )
            /* <<< Существующий блок Default Content >>> */
            : (
                <ContentWrapper
                    key="default-reserve"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    <DefaultContent>
                        <ArchiveOutlinedIcon />
                        <span>Переместить в резерв</span>
                    </DefaultContent>
                </ContentWrapper>
            )}
        </AnimatePresence>
    </DropZoneContainer>
  );
};

export default ReserveDropZone; 