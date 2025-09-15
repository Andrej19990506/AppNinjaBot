import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { styled as muiStyled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import defaultAvatar from '@shared/assets/images/Ninja.jpg';
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

interface ConfirmationModalProps {
    isOpen: boolean;
    confirmationDataSource: ConfirmationDataSource;
    confirmationType: 'delete' | 'assignment';
    onConfirm: () => void;
    onCancel: () => void;
}

const ModalOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
    box-sizing: border-box;
`;

const ModalContent = styled(motion.div)`
    background: var(--card-background);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-xl);
    padding: 24px;
    min-width: 320px;
    max-width: 400px;
    width: 100%;
    position: relative;

    /* Мобильная адаптация */
    @media (max-width: 768px) {
        min-width: 280px;
        border-radius: var(--radius);
        padding: 20px;
    }
    
    @media (max-width: 480px) {
        min-width: 260px;
        margin: 0 16px;
        padding: 16px;
    }
    
    /* Темная тема */
    [data-theme="dark"] & {
        background: var(--card-background);
        border-color: var(--border-color);
        box-shadow: var(--shadow-xl);
    }
`;

const ConfirmationHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    
    @media (max-width: 480px) {
        gap: 12px;
        margin-bottom: 20px;
    }
`;

const CourierAvatar = styled.img`
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid var(--orange-primary);
    object-fit: cover;
    flex-shrink: 0;

    @media (max-width: 480px) {
        width: 48px;
        height: 48px;
    }
`;

const StatusIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--orange-primary);
    color: white;
    margin-left: auto;
    flex-shrink: 0;
    
    svg {
        font-size: 16px;
    }
    
    @media (max-width: 480px) {
        width: 28px;
        height: 28px;
        
        svg {
            font-size: 14px;
        }
    }
`;

const ConfirmationText = styled(Typography)`
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-color);
    line-height: 1.4;
    margin: 0;
    flex: 1;

    strong {
        color: var(--orange-primary);
        font-weight: 600;
    }

    @media (max-width: 480px) {
        font-size: 0.9rem;
    }
`;

const ConfirmationActions = styled(Box)`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 8px;
    
    @media (max-width: 480px) {
        gap: 12px;
    }
`;

const StyledConfirmButton = muiStyled(IconButton)(({ theme }) => ({
    background: 'var(--orange-primary)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    color: 'white',
    transition: 'var(--transition-normal)',

    '& svg': {
        fontSize: '18px',
    },

    '&:hover': {
        background: 'var(--orange-light)',
        transform: 'scale(1.05)',
    },

    '&:active': {
        transform: 'scale(0.95)',
    },

    // Мобильная адаптация
    [theme.breakpoints.down('sm')]: {
        width: '36px',
        height: '36px',
        '& svg': {
            fontSize: '16px',
        },
    }
}));

const StyledCancelButton = muiStyled(IconButton)(({ theme }) => ({
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    color: 'var(--text-color)',
    transition: 'var(--transition-normal)',

    '& svg': {
        fontSize: '18px',
    },

    '&:hover': {
        background: 'var(--gray-100)',
        transform: 'scale(1.05)',
    },

    '&:active': {
        transform: 'scale(0.95)',
    },

    // Мобильная адаптация
    [theme.breakpoints.down('sm')]: {
        width: '36px',
        height: '36px',
        '& svg': {
            fontSize: '16px',
        },
    }
}));

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    confirmationDataSource,
    confirmationType,
    onConfirm,
    onCancel
}) => {
    // Отладочная информация (только в development)
    if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [ConfirmationModal] isOpen:', isOpen);
        console.log('🔍 [ConfirmationModal] confirmationDataSource:', confirmationDataSource);
        console.log('🔍 [ConfirmationModal] confirmationType:', confirmationType);
    }
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

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { 
            opacity: 1,
            transition: { duration: 0.2 }
        },
        exit: { 
            opacity: 0,
            transition: { duration: 0.15 }
        }
    };

    const modalVariants = {
        hidden: { 
            opacity: 0, 
            scale: 0.9
        },
        visible: { 
            opacity: 1, 
            scale: 1,
            transition: { 
                duration: 0.2,
                ease: "easeOut"
            }
        },
        exit: { 
            opacity: 0, 
            scale: 0.9,
            transition: { 
                duration: 0.15
            }
        }
    };

    // Дополнительная отладка (только в development)
    if (process.env.NODE_ENV === 'development' && isOpen) {
        console.log('🎯 [ConfirmationModal] Рендерим модальное окно!');
        console.log('🎯 [ConfirmationModal] displayInfo:', displayInfo);
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <ModalOverlay
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={(e) => {
                        // Закрываем модальное окно только при клике именно по оверлею, а не по содержимому
                        if (e.target === e.currentTarget) {
                            e.stopPropagation();
                            onCancel();
                        }
                    }}
                    data-confirmation-modal="true"
                >
                    <ModalContent
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ConfirmationHeader>
                            <CourierAvatar 
                                src={displayInfo.avatar || defaultAvatar} 
                                alt={displayInfo.name} 
                            />
                            <ConfirmationText>
                                {confirmationType === 'assignment' ? 'Назначить' : 'Удалить'} <strong>{displayInfo.name}</strong>?
                            </ConfirmationText>
                            <StatusIcon>
                                <CheckIcon />
                            </StatusIcon>
                        </ConfirmationHeader>

                        <ConfirmationActions>
                            <StyledCancelButton 
                                onClick={onCancel} 
                                aria-label={confirmationType === 'assignment' ? "Отменить назначение" : "Отменить удаление"}
                            >
                                <CloseIcon />
                            </StyledCancelButton>
                            <StyledConfirmButton 
                                onClick={onConfirm} 
                                aria-label={confirmationType === 'assignment' ? "Подтвердить назначение" : "Подтвердить удаление"}
                            >
                                <CheckIcon />
                            </StyledConfirmButton>
                        </ConfirmationActions>
                    </ModalContent>
                </ModalOverlay>
            )}
        </AnimatePresence>
    );
};

export default ConfirmationModal;
