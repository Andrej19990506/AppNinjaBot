import React from 'react';
import styled from 'styled-components';
// @ts-ignore // Игнорируем ошибку TS2307 для @dnd-kit/core
import { useDroppable } from '@dnd-kit/core';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import CircularProgress from '@mui/material/CircularProgress';
import { motion, AnimatePresence } from 'framer-motion';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

interface ConfirmedCourierInfo {
    id: string;
    name: string;
    avatar: string | null;
}

interface DeleteDropZoneProps {
  isOver: boolean;
  isProcessing: boolean;
  isConfirming: boolean;
  courierData: ConfirmedCourierInfo | null;
  processingCourierData: ConfirmedCourierInfo | null;
  isAwaitingConfirmation: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const DropZoneContainer = styled(motion.div)<{
    $isOver: boolean;
    $isProcessing: boolean;
    $isConfirming: boolean;
    $isAwaitingConfirmation: boolean;
}>`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 12px;
  margin: 0 4px 24px 4px;
  border: 2px ${props => 
    props.$isProcessing ? 'dashed var(--error-color)' :
    props.$isConfirming ? 'solid transparent' :
    props.$isAwaitingConfirmation ? 'dashed var(--orange-primary)' :
    props.$isOver ? 'solid var(--error-color)' : 'dashed var(--error-color)'
  };
  background-color: ${props => 
    props.$isConfirming ? 'transparent' :
    props.$isAwaitingConfirmation ? 'var(--primary-transparent)' :
    props.$isOver && !props.$isProcessing && !props.$isAwaitingConfirmation ? 'var(--error-background)' : 'transparent'
  };
  color: ${props => 
    props.$isProcessing ? 'var(--error-color)' :
    props.$isAwaitingConfirmation ? 'var(--orange-dark)' :
    'var(--error-color)'
  };
  transition: background-color 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s;
  border-radius: var(--radius-md, 6px);
  min-height: 48px;
  box-sizing: border-box;
  text-align: center;
  cursor: ${props => (props.$isProcessing || props.$isConfirming || props.$isAwaitingConfirmation) ? 'default' : 'grabbing'};
  opacity: ${props => (props.$isProcessing || props.$isAwaitingConfirmation) ? 0.9 : 1};
  overflow: hidden;
`;

const ContentWrapper = styled(motion.div)`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    gap: 8px;
`;

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

const ProcessingOrConfirmationContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
`;

const SmallAvatar = styled.img`
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
`;

export const DELETE_DROP_ZONE_ID = 'delete-drop-zone';

const DeleteDropZone: React.FC<DeleteDropZoneProps> = ({ 
    isOver, 
    isProcessing, 
    isConfirming, 
    courierData, 
    processingCourierData,
    isAwaitingConfirmation,
    onConfirm,
    onCancel,
}) => {
  const { setNodeRef } = useDroppable({
    id: DELETE_DROP_ZONE_ID,
    disabled: isProcessing || isConfirming,
    data: { 
      type: 'delete-zone' 
    }
  });

  const contentVariants = {
      initial: { opacity: 0, scale: 0.7 },
      animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
      exit: { opacity: 0, scale: 0.7, transition: { duration: 0.15, ease: "easeIn" } }
  };
  
  const displayProcessingOrWaitingData = isAwaitingConfirmation ? processingCourierData : (isProcessing ? processingCourierData : null);
  const displayConfirmedData = courierData;

  return (
    <DropZoneContainer 
        ref={setNodeRef} 
        $isOver={isOver} 
        $isProcessing={isProcessing}
        $isConfirming={isConfirming}
        $isAwaitingConfirmation={isAwaitingConfirmation}
        layout
    >
        {/* Outer AnimatePresence for scaling the whole content block */}
        {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
        {/* @ts-ignore */}
        <AnimatePresence initial={false} mode="wait">
            {isAwaitingConfirmation && displayProcessingOrWaitingData ? (
                <ContentWrapper
                    key="awaiting-confirmation"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    <AwaitingConfirmationContent>
                        <SmallAvatar src={displayProcessingOrWaitingData.avatar || defaultAvatar} alt={displayProcessingOrWaitingData.name} />
                        <ConfirmationText variant="body2">
                            Удалить <strong>{displayProcessingOrWaitingData.name}</strong>?
                        </ConfirmationText>
                        <ConfirmationActions>
                            <IconButton onClick={onConfirm} size="small" color="success" aria-label="Подтвердить удаление">
                                <CheckIcon />
                            </IconButton>
                            <IconButton onClick={onCancel} size="small" color="error" aria-label="Отменить удаление">
                                <CloseIcon />
                            </IconButton>
                        </ConfirmationActions>
                    </AwaitingConfirmationContent>
                </ContentWrapper>
            )
            : (isProcessing || isConfirming) && (displayProcessingOrWaitingData || displayConfirmedData) ? (
                 <ContentWrapper
                    key="processing-confirming"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                 >
                    <ProcessingOrConfirmationContent>
                         <SmallAvatar 
                            src={(isProcessing ? displayProcessingOrWaitingData?.avatar : displayConfirmedData?.avatar) || defaultAvatar} 
                            alt={(isProcessing ? displayProcessingOrWaitingData?.name : displayConfirmedData?.name) || 'Courier'} 
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
            : (
                <ContentWrapper
                    key="default-delete"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    <DefaultContent>
                        <DeleteIcon />
                        <span>Удалить со смены</span>
                    </DefaultContent>
                </ContentWrapper>
            )}
        </AnimatePresence>
    </DropZoneContainer>
  );
};

export default DeleteDropZone; 