import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useDroppable } from '@dnd-kit/core';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CircularProgress from '@mui/material/CircularProgress';
import { motion, AnimatePresence } from 'framer-motion';
import defaultAvatar from '@shared/assets/images/Ninja.jpg';
import CheckIcon from '@mui/icons-material/Check';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { CourierInfo } from '@features/courierSchedule/types/courierScheduleTypes';

interface ConfirmedCourierInfo {
    id: string;
    name: string;
    avatar: string | null;
}

type ConfirmationDataSource = 
    | { type: 'assignment', data: CourierInfo }
    | { type: 'delete', data: ConfirmedCourierInfo }
    | null;


interface DeleteDropZoneProps {
  isOver: boolean;
  isProcessing: boolean; 
  isConfirming: boolean; 
  courierData: ConfirmedCourierInfo | null; 
  confirmationDataSource: ConfirmationDataSource;
  isAwaitingConfirmation: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmationType: 'delete' | 'assignment';
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
  padding: 16px;
  margin: 0 8px 24px 8px;
  border: 2px solid ${props => 
    props.$isProcessing ? 'var(--error-color)' :
    props.$isConfirming ? 'transparent' :
    props.$isAwaitingConfirmation ? 'var(--orange-primary)' :
    props.$isOver ? 'var(--orange-light)' : 'var(--border-color)'
  };
  background: ${props => 
    props.$isConfirming ? 'transparent' :
    props.$isAwaitingConfirmation ? 'linear-gradient(135deg, var(--card-background) 0%, rgba(255, 95, 31, 0.08) 100%)' : 
    'linear-gradient(135deg, var(--card-background) 0%, rgba(255, 95, 31, 0.03) 100%)'
  };
  color: ${props => 
    props.$isProcessing ? 'var(--error-color)' :
    props.$isAwaitingConfirmation ? 'var(--text-color)' :
    'var(--text-secondary)'
  };
  transition: all var(--transition-normal);
  border-radius: var(--radius-lg);
  min-height: 56px;
  box-sizing: border-box;
  text-align: center;
  cursor: ${props => (props.$isProcessing || props.$isConfirming || props.$isAwaitingConfirmation) ? 'default' : 'grabbing'};
  opacity: ${props => (props.$isProcessing || props.$isAwaitingConfirmation) ? 0.95 : 1};
  overflow: hidden;
  box-shadow: none;
  
  &:hover {
    transform: ${props => (props.$isProcessing || props.$isConfirming || props.$isAwaitingConfirmation) ? 'none' : 'translateY(-2px)'};
    box-shadow: none;
  }
  
  /* Мобильная адаптация */
  @media (max-width: 768px) {
    margin: 0 4px 16px 4px;
    padding: 12px;
    min-height: 48px;
  }
  
  @media (max-width: 480px) {
    margin: 0 2px 12px 2px;
    padding: 8px;
    min-height: 44px;
  }
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
    gap: 12px;
    padding: 16px 20px;
    background: linear-gradient(135deg, var(--card-background) 0%, rgba(255, 95, 31, 0.12) 100%);
    border-radius: var(--radius-lg);
    border: 2px solid var(--orange-primary);
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(10px);
    position: relative;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(255, 95, 31, 0.05) 0%, transparent 50%);
        border-radius: var(--radius-lg);
        pointer-events: none;
    }
    
    /* Мобильная адаптация */
    @media (max-width: 768px) {
        flex-direction: column;
        gap: 16px;
        padding: 16px;
        text-align: center;
    }
    
    @media (max-width: 480px) {
        padding: 12px;
        gap: 12px;
    }
`;

const ConfirmationText = styled(Typography)`
    font-size: 1.04em;
    font-weight: 600;
    flex-grow: 1;
    text-align: left;
    margin-left: 10px;
    margin-right: 10px;
    color: var(--text-color);
    line-height: 1.5;
    letter-spacing: 0.2px;
    word-break: break-word;
    hyphens: auto;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    
    /* Мобильная адаптация */
    @media (max-width: 768px) {
        text-align: center;
        margin: 0;
        font-size: 0.95em;
        line-height: 1.4;
    }
    
    @media (max-width: 480px) {
        font-size: 0.9em;
        line-height: 1.3;
    }
`;


const DefaultContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    svg {
        margin-right: 6px;
        font-size: 18px;
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

const SuccessCheckContent = styled(motion.div)`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 0;
    background: transparent;
    border: none;
    position: relative;
    width: auto;
    max-width: none;
`;

const SuccessCheckIcon = styled(motion.div)`
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--orange-primary) 0%, var(--orange-light) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(255, 95, 31, 0.3);
    border: 2px solid var(--orange-primary);
    z-index: 1;
    position: relative;
    flex-shrink: 0;
`;

const SuccessAvatar = styled.img`
    width: 46px;
    height: 46px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--orange-primary);
    box-shadow: 0 4px 12px rgba(255, 95, 31, 0.2);
    z-index: 1;
    position: relative;
    flex-shrink: 0;
`;

const SmallAvatar = styled.img`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--orange-primary);
    box-shadow: var(--shadow-md);
    z-index: 1;
    transition: all var(--transition-normal);
    
    &:hover {
        transform: scale(1.06);
        box-shadow: var(--shadow-lg);
    }
`;





export const DELETE_DROP_ZONE_ID = 'delete-drop-zone';

const DeleteDropZone: React.FC<DeleteDropZoneProps> = ({ 
    isOver, 
    isProcessing, 
    isConfirming, 
    courierData, 
    confirmationDataSource, 
    isAwaitingConfirmation,
    confirmationType,
}) => {
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);
  
  const { setNodeRef } = useDroppable({
    id: DELETE_DROP_ZONE_ID,
    disabled: isProcessing || isConfirming,
    data: { 
      type: 'delete-zone' 
    }
  });

  // Показываем галочку на 2 секунды после подтверждения
  useEffect(() => {
    if (isConfirming) {
      setShowSuccessCheck(true);
      const timer = setTimeout(() => {
        setShowSuccessCheck(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      // Сбрасываем состояние при смене других состояний
      setShowSuccessCheck(false);
    }
  }, [isConfirming]);

  const contentVariants = {
      initial: { opacity: 0, scale: 0.7 },
      animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
      exit: { opacity: 0, scale: 0.7, transition: { duration: 0.15, ease: "easeIn" } }
  };
  
  const getDisplayInfo = (source: ConfirmationDataSource) => {
    if (!source) return { name: '', avatar: null };
    if (source.type === 'assignment') {
        return {
            name: `${source.data.first_name || ''} ${source.data.last_name || ''}`.trim() || 'Курьер',
            avatar: source.data.photo_url || null
        };
    } else { // type === 'delete'
        return {
            name: source.data.name || 'Курьер',
            avatar: source.data.avatar || null
        };
    }
  };
  const displayInfo = getDisplayInfo(confirmationDataSource);
  const displayProcessingOrWaitingData = (isAwaitingConfirmation || isProcessing) ? confirmationDataSource : null;
  const displayConfirmedData = isConfirming ? courierData : null;


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
            {isAwaitingConfirmation && displayProcessingOrWaitingData ? (
                <ContentWrapper
                    key="awaiting-confirmation"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    <AwaitingConfirmationContent>
                        <SmallAvatar src={displayInfo.avatar || defaultAvatar} alt={displayInfo.name} />
                        <ConfirmationText variant="body2">
                            {confirmationType === 'assignment' ? 'Назначить' : 'Удалить'} <strong>{displayInfo.name}</strong>?
                        </ConfirmationText>
                    </AwaitingConfirmationContent>
                </ContentWrapper>
            )
            : showSuccessCheck ? (
                <ContentWrapper
                    key="success-check"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    <SuccessCheckContent>
                        <SuccessCheckIcon
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ 
                                type: "spring", 
                                stiffness: 200, 
                                damping: 15,
                                duration: 0.6 
                            }}
                        >
                            <CheckIcon style={{ fontSize: '24px', color: 'white' }} />
                        </SuccessCheckIcon>
                        <SuccessAvatar 
                            src={courierData?.avatar || defaultAvatar} 
                            alt={courierData?.name || 'Курьер'}
                        />
                    </SuccessCheckContent>
                </ContentWrapper>
            )
            : isProcessing && (displayProcessingOrWaitingData || displayConfirmedData) ? (
                 <ContentWrapper
                    key="processing"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                 >
                    <ProcessingOrConfirmationContent>
                         <SmallAvatar 
                            src={displayInfo.avatar || defaultAvatar} 
                            alt={displayInfo.name || 'Курьер'} 
                         />
                         <CircularProgress size={24} color="inherit" />
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