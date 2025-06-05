import React from 'react';
import styled from 'styled-components';
import { useDroppable } from '@dnd-kit/core';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import CircularProgress from '@mui/material/CircularProgress';
import { motion, AnimatePresence } from 'framer-motion'; 
import defaultAvatar from '@shared/assets/images/Ninja.jpg'; 
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

interface ReserveDropZoneProps {
  isOver: boolean;
  isProcessing: boolean;
  isConfirming: boolean;
  confirmedCourierData: ConfirmedCourierInfo | null; 
  courierAwaitingActionData: ConfirmedCourierInfo | null; 
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
    props.$isProcessing ? 'dashed var(--primary-color)' : 
    props.$isConfirming ? 'solid transparent' : 
    props.$isAwaitingConfirmation ? 'dashed var(--orange-primary)' : 
    props.$isOver ? 'solid var(--primary-color)' : 'dashed var(--primary-color)' 
  };
  background-color: ${props => 
    props.$isConfirming ? 'transparent' : 
    props.$isAwaitingConfirmation ? 'var(--primary-transparent)' : 
    props.$isOver && !props.$isProcessing && !props.$isAwaitingConfirmation ? 'var(--primary-transparent)' : 'transparent' 
  };
  color: ${props => 
    props.$isProcessing ? 'var(--primary-color)' : 
    props.$isAwaitingConfirmation ? 'var(--orange-dark)' : 
    'var(--primary-color)'
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

const ProcessingOrConfirmationContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
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

export const RESERVE_DROP_ZONE_ID = 'reserve-drop-zone';

const ReserveDropZone: React.FC<ReserveDropZoneProps> = ({ 
    isOver, 
    isProcessing, 
    isConfirming, 
    confirmedCourierData, 
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
  
  const displayDataForProcessing = isProcessing ? courierAwaitingActionData : null;
  const displayDataForConfirmation = isConfirming ? confirmedCourierData : null;
  const displayDataForAwaiting = isAwaitingConfirmation ? courierAwaitingActionData : null;

  return (
    <DropZoneContainer 
        ref={setNodeRef} 
        $isOver={isOver} 
        $isProcessing={isProcessing}
        $isConfirming={isConfirming}
        $isAwaitingConfirmation={isAwaitingConfirmation} 
        layout
    >
        <AnimatePresence initial={false} mode="wait"> 
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