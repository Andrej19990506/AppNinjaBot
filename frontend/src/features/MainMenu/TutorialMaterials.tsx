import React, { useState, useEffect } from 'react';
import { useAppSelector } from '@/shared/store/hooks';
import styled from 'styled-components';
import CloseIcon from '@mui/icons-material/Close';
import SchoolIcon from '@mui/icons-material/School';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import LaunchIcon from '@mui/icons-material/Launch';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CommentIcon from '@mui/icons-material/Comment';
import SendIcon from '@mui/icons-material/Send';
import ReplyIcon from '@mui/icons-material/Reply';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion, AnimatePresence } from 'framer-motion';
import UpdatesPage from './UpdatesPage';
import { materialsApi, Comment as ApiComment, Reaction as ApiReaction } from '@shared/api/materialsApi';

// Функция для получения фото пользователя через API endpoint
const getUserPhotoUrl = (userId: number): string => {
    const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    return `${baseURL}/v1/users/${userId}/photo`;
};

// Типы для реакций и комментариев
interface UserReaction {
    userId: number;
    userName: string;
    photo_url?: string;
    emoji: string;
    timestamp: Date;
}

interface Comment {
    id: string;
    userId: number;
    author: string;
    author_photo?: string; // URL фото автора
    message: string;
    timestamp: Date;
    replyTo?: string; // ID комментария, на который отвечаем
    edited?: boolean; // Был ли комментарий отредактирован
}

interface MaterialData {
    reactions: UserReaction[];
    comments: Comment[];
}

interface MaterialReactions {
    [materialId: number]: MaterialData;
}

// Популярные эмодзи для реакций
const REACTION_EMOJIS = ['❤️', '👍', '👎', '🔥', '😍', '😮', '😢', '😠', '💯', '🎉'];

// Данные обучающих материалов
const tutorialMaterials = [
    {
        id: 1,
        title: "Временный доступ для сотрудников",
        description: "Полное руководство по новому функционалу временного доступа. Узнайте как выдавать права, приглашать сотрудников и управлять доступом.",
        type: "guide",
        icon: "📋",
        duration: "5 мин",
        url: "internal:updates", // Внутренняя страница
        isNew: true
    },
    {
        id: 2,
        title: "Основы работы с инвентаризацией",
        description: "Пошаговое видео-руководство по проведению инвентаризации, создании отчетов и работе с товарами.",
        type: "video",
        icon: "📦",
        duration: "12 мин",
        url: "#", // Заглушка для будущих материалов
        isNew: false
    },
    {
        id: 3,
        title: "Списания товаров",
        description: "Инструкция по оформлению списаний, фотографированию товаров и созданию актов списания.",
        type: "guide",
        icon: "🗑️",
        duration: "8 мин",
        url: "#",
        isNew: false
    },
    {
        id: 4,
        title: "Работа с курьерскими сменами",
        description: "Руководство по записи на смены, управлению расписанием и отслеживанию доступности.",
        type: "video",
        icon: "🚴‍♂️",
        duration: "15 мин",
        url: "#",
        isNew: false
    }
];

// Стилизуем контейнер как полноэкранную страницу
const PageContainer = styled.div<{ $isOpen: boolean; }>`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--background-color);
    z-index: 900; /* Ниже чем у SidePanel (1100) чтобы панель уезжала поверх */
    display: flex;
    flex-direction: column;
    opacity: ${props => props.$isOpen ? '1' : '0'};
    visibility: ${props => props.$isOpen ? 'visible' : 'hidden'};
    transition: opacity 0.3s ease-out, visibility 0.3s ease-out;
`;

const ContentContainer = styled.div<{ $isOpen: boolean; }>`
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    background: var(--card-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    height: calc(100vh - 40px);
    margin-top: 20px;
    margin-bottom: 20px;
    overflow: hidden;
    transform: ${props => props.$isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)'};
    transition: transform 0.3s ease-out;

    @media (max-width: 768px) {
        margin: 0;
        height: 100vh;
        border-radius: 0;
        box-shadow: none;
    }
`;

const PageHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 32px;
    padding-top: calc(80px + 24px); /* Отступ для кнопок Telegram + обычный отступ */
    border-bottom: 1px solid var(--border-color);
    background: var(--gradient-primary);
    color: white;

    @media (max-width: 768px) {
        padding: 20px 24px;
        padding-top: calc(80px + 20px); /* Отступ для кнопок Telegram + обычный отступ */
    }
`;

const PageTitle = styled.h2`
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 12px;

    @media (max-width: 768px) {
        font-size: 1.3rem;
    }
`;

const CloseButton = styled.button`
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-color-on-primary);
    cursor: pointer;
    padding: 0;
    border-radius: 50%;
    transition: all var(--transition-normal);
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    backdrop-filter: blur(10px);

    &:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
        border-color: rgba(255, 255, 255, 0.4);
    }
    
    & svg {
        font-size: 20px;
    }
`;

const PageContent = styled.div`
    padding: 32px;
    flex-grow: 1;
    overflow-y: auto;

    @media (max-width: 768px) {
        padding: 24px 20px;
    }
`;

const CardsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 24px;

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 16px;
    }
`;

const TutorialCard = styled.div<{ $isAvailable: boolean; }>`
    background: var(--card-background);
    border: 2px solid ${props => props.$isAvailable ? 'var(--border-color)' : 'var(--gray-400)'};
    border-radius: var(--radius-lg);
    padding: 24px;
    transition: all var(--transition-normal);
    position: relative;
    cursor: ${props => props.$isAvailable ? 'pointer' : 'not-allowed'};
    opacity: ${props => props.$isAvailable ? '1' : '0.6'};

    &:hover {
        ${props => props.$isAvailable && `
            transform: translateY(-5px);
            box-shadow: var(--shadow-lg);
            border-color: var(--primary-color);
        `}
    }

    ${props => props.$isAvailable && `
        &:active {
            transform: translateY(-2px);
        }
    `}
`;

const NewBadge = styled.div`
    position: absolute;
    top: -8px;
    right: -8px;
    background: var(--gradient-primary);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    box-shadow: var(--shadow-md);
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
`;

const CardIcon = styled.div`
    font-size: 2rem;
    line-height: 1;
`;

const CardTitleContainer = styled.div`
    flex: 1;
`;

const CardTitle = styled.h3`
    margin: 0 0 4px 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-color);
    line-height: 1.3;
`;

const CardMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.85rem;
    color: var(--text-secondary);
`;

const TypeBadge = styled.span<{ $type: string; }>`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    background: ${props => 
        props.$type === 'video' ? 'rgba(255, 0, 0, 0.1)' : 
        props.$type === 'guide' ? 'rgba(0, 123, 255, 0.1)' : 
        'rgba(108, 117, 125, 0.1)'
    };
    color: ${props => 
        props.$type === 'video' ? '#dc3545' : 
        props.$type === 'guide' ? '#007bff' : 
        '#6c757d'
    };
`;

const Duration = styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const CardDescription = styled.p`
    margin: 0 0 16px 0;
    color: var(--text-secondary);
    line-height: 1.5;
    font-size: 0.95rem;
`;

const CardFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
`;

const ActionButton = styled.button<{ $isAvailable: boolean; }>`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: ${props => props.$isAvailable ? 'var(--gradient-primary)' : 'var(--disabled-bg-color)'};
    color: ${props => props.$isAvailable ? 'var(--text-color-on-primary)' : 'var(--disabled-text-color)'};
    border: none;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: ${props => props.$isAvailable ? 'pointer' : 'not-allowed'};
    transition: all var(--transition-normal);

    ${props => props.$isAvailable && `
        &:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }
    `}
`;

const ComingSoonText = styled.span`
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-style: italic;
`;

// Стили для реакций и комментариев
const ReactionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
    position: relative;
    overflow: hidden; /* Предотвращаем выход за границы карточки */
`;

const ReactionsRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
`;

const ReactionsDisplay = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
`;

const ReactionChip = styled(motion.button)<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid ${props => props.$active ? 'var(--primary-color)' : 'var(--border-color)'};
    background: ${props => props.$active 
        ? 'var(--primary-color)'
        : 'var(--card-background)'
    };
    color: ${props => props.$active ? 'white' : 'var(--text-primary)'};
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.85rem;
    font-weight: 700;
    position: relative;
    overflow: hidden;
    box-shadow: ${props => props.$active ? '0 2px 8px rgba(var(--primary-color-rgb), 0.3)' : 'var(--shadow-sm)'};

    /* Эффект подсветки для активных чипов */
    ${props => props.$active && `
        &::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transform: translateX(-100%);
            transition: transform 0.3s ease;
        }
        
        &:hover::before {
            transform: translateX(100%);
        }
    `}

    &:hover {
        border-color: var(--primary-color);
        background: ${props => props.$active 
            ? 'var(--primary-color)'
            : 'rgba(var(--primary-color-rgb), 0.1)'
        };
        box-shadow: ${props => props.$active 
            ? '0 4px 12px rgba(var(--primary-color-rgb), 0.4)' 
            : '0 3px 8px rgba(var(--primary-color-rgb), 0.2)'
        };
        transform: translateY(-1px);
    }
    
    span:first-child {
        font-size: 1.05rem;
        line-height: 1;
        filter: grayscale(0) contrast(1.1) saturate(1.3);
    }
    
    span:last-child {
        background: ${props => props.$active ? 'rgba(255, 255, 255, 0.25)' : 'var(--primary-color)'};
        color: ${props => props.$active ? 'white' : 'white'};
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 0.7rem;
        font-weight: 800;
        min-width: 16px;
        text-align: center;
        box-shadow: ${props => props.$active ? 'inset 0 1px 2px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.2)'};
    }
`;

const ReactionPicker = styled(motion.div)`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px;
    background: var(--card-background);
    border: 1px solid var(--primary-color);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    margin: 8px 0;
    position: relative;
    max-width: 100%;
    justify-content: center;
    align-items: center;
`;

const EmojiButton = styled(motion.button)`
    font-size: 1.6rem;
    padding: 8px;
    border: none;
    border-radius: 12px;
    background: var(--card-background);
    border: 2px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    filter: contrast(1.1) saturate(1.2);

    &:hover {
        background: rgba(var(--primary-color-rgb), 0.1);
        border-color: var(--primary-color);
        box-shadow: 0 4px 12px rgba(var(--primary-color-rgb), 0.25);
        transform: scale(1.1) translateY(-1px);
        filter: contrast(1.2) saturate(1.3);
    }
    
    &:active {
        transform: scale(0.95);
    }
    
    /* Добавляем небольшой эффект свечения при hover */
    &::after {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 14px;
        background: linear-gradient(45deg, var(--primary-color), var(--primary-light));
        opacity: 0;
        z-index: -1;
        transition: opacity var(--transition-fast);
    }
    
    &:hover::after {
        opacity: 0.1;
    }
`;

const ActionButtons = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const ReactionToggleButton = styled(motion.button)`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 2px solid var(--border-color);
    border-radius: 24px;
    background: var(--card-background);
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);

    &:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
        background: rgba(var(--primary-color-rgb), 0.05);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(var(--primary-color-rgb), 0.2);
    }

    span {
        font-size: 1.1rem;
        filter: grayscale(0) contrast(1.1);
    }
`;

const CommentButton = styled(motion.button)`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 2px solid var(--border-color);
    border-radius: 24px;
    background: var(--card-background);
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);

    &:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
        background: rgba(var(--primary-color-rgb), 0.05);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(var(--primary-color-rgb), 0.2);
    }
`;

// Модальное окно комментариев
const CommentsModal = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1200;
    padding: 0;
`;

const CommentsContainer = styled(motion.div)`
    background: var(--card-background);
    border-radius: 24px 24px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    
    /* Добавляем handle для перетаскивания */
    &::before {
        content: '';
        position: absolute;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 4px;
        background: var(--text-secondary);
        border-radius: 2px;
        opacity: 0.3;
    }
`;

const CommentsHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 24px 16px 24px;
    border-bottom: 1px solid var(--border-color);
    position: relative;
    background: var(--card-background);
`;

const CommentsTitle = styled.h3`
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 12px;
    
    &::before {
        content: '💬';
        font-size: 1.4rem;
    }
`;

const CommentsBody = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 16px 10px;
    max-height: 50vh;
    min-height: 120px;
    
    /* Кастомный скроллбар */
    &::-webkit-scrollbar {
        width: 4px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
        background: var(--text-secondary);
        border-radius: 2px;
        opacity: 0.3;
    }
    
    &::-webkit-scrollbar-thumb:hover {
        opacity: 0.5;
    }
`;

const CommentItem = styled(motion.div)<{ $isOwn?: boolean }>`
    padding: 8px 0;
    display: flex;
    flex-direction: column;
    align-items: ${props => props.$isOwn ? 'flex-end' : 'flex-start'};
    margin-bottom: 12px;
    position: relative;
    cursor: ${props => props.$isOwn ? 'default' : 'grab'};
    touch-action: ${props => props.$isOwn ? 'auto' : 'pan-y'};

    &:last-child {
        margin-bottom: 0;
    }

    &:active {
        cursor: ${props => props.$isOwn ? 'default' : 'grabbing'};
    }
`;

const CommentBubble = styled.div<{ $isOwn?: boolean }>`
    max-width: 75%;
    min-width: 200px; /* Увеличиваем минимальную ширину */
    width: fit-content;
    padding: 14px 18px;
    border-radius: ${props => props.$isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
    background: ${props => props.$isOwn 
        ? 'var(--gradient-primary)' 
        : 'var(--card-background)'
    };
    color: ${props => props.$isOwn ? 'white' : 'var(--text-color)'};
    box-shadow: ${props => props.$isOwn 
        ? 'var(--shadow-lg)' 
        : 'var(--shadow-md)'
    };
    border: ${props => props.$isOwn ? 'none' : '1px solid var(--border-color)'};
    position: relative;
    transition: all var(--transition-normal);

    /* Хвостик комментария указывающий на аватарку */
    &::before {
        content: '';
        position: absolute;
        ${props => props.$isOwn ? 'right: -8px' : 'left: -8px'};
        bottom: 12px;
        width: 0;
        height: 0;
        border: 8px solid transparent;
        ${props => props.$isOwn 
            ? 'border-left-color: var(--orange-primary)' 
            : 'border-right-color: var(--card-background)'
        };
        filter: ${props => props.$isOwn ? 'none' : 'drop-shadow(-1px 1px 2px rgba(0,0,0,0.1))'};
        display: ${props => props.$isOwn ? 'block' : 'none'}; /* Хвостик только у своих комментариев */
    }

    &:hover {
        transform: ${props => props.$isOwn ? 'var(--hover-transform)' : 'translateX(-5px) var(--hover-transform)'};
        box-shadow: ${props => props.$isOwn 
            ? '0 8px 30px rgba(var(--primary-rgb), 0.4)' 
            : '0 8px 30px rgba(0,0,0,0.15)'
        };
    }
`;

// Контейнер для комментария с аватаркой
const CommentWithAvatar = styled.div<{ $isOwn?: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: ${props => props.$isOwn ? 'flex-end' : 'flex-start'};
    position: relative;
    padding-left: ${props => props.$isOwn ? '0' : '48px'}; /* Место для аватарки */
    margin-bottom: 16px;
`;


const CommentAvatar = styled.img<{ $isOwn?: boolean }>`
    position: absolute;
    bottom: -5px;
    left: ${props => props.$isOwn ? 'auto' : '-3px'};
    right: ${props => props.$isOwn ? '4px' : 'auto'};
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--card-background);
    background: var(--background-color);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 2;
    display: ${props => props.$isOwn ? 'none' : 'block'};
    
    &:hover {
        transform: scale(1.1);
        transition: transform 0.2s ease;
    }
`;

const CommentAvatarPlaceholder = styled.div<{ $isOwn?: boolean }>`
    position: absolute;
    bottom: 2px;
    left: ${props => props.$isOwn ? 'auto' : '4px'};
    right: ${props => props.$isOwn ? '4px' : 'auto'};
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary-color);
    display: ${props => props.$isOwn ? 'none' : 'flex'};
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 600;
    color: white;
    border: 2px solid var(--card-background);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 2;
    
    &:hover {
        transform: scale(1.1);
        transition: transform 0.2s ease;
    }
`;

const CommentAuthor = styled.div<{ $isOwn?: boolean }>`
    font-weight: 600;
    color: ${props => props.$isOwn ? 'var(--text-secondary)' : 'var(--orange-primary)'};
    margin-bottom: 6px;
    font-size: 0.85rem;
    display: ${props => props.$isOwn ? 'none' : 'block'};
    padding-left: 6px;
    letter-spacing: 0.3px;
`;

const CommentMessage = styled.div<{ $isOwn?: boolean }>`
    color: ${props => props.$isOwn ? 'white' : 'var(--text-color)'};
    line-height: 1.5;
    font-size: 0.95rem;
    margin-bottom: 8px;
    word-wrap: break-word;
    font-weight: 400;
`;

const CommentTimestamp = styled.div<{ $isOwn?: boolean }>`
    color: ${props => props.$isOwn ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)'};
    font-size: 0.75rem;
    opacity: 0.9;
    font-weight: 500;
    letter-spacing: 0.3px;
    margin: 0;
`;

const ReplyIndicator = styled.div<{ $isOwn?: boolean }>`
    position: absolute;
    right: ${props => props.$isOwn ? 'auto' : '8px'};
    left: ${props => props.$isOwn ? '8px' : 'auto'};
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    background: var(--text-secondary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.7rem;
    opacity: 0;
    transition: opacity var(--transition-fast);

    ${CommentItem}:hover & {
        opacity: ${props => props.$isOwn ? '0' : '0.6'};
    }

    &::after {
        content: '↩';
        font-size: 10px;
    }
`;

const ReplyPreview = styled.div`
    background: rgba(255,255,255,0.1);
    border-left: 3px solid rgba(255,255,255,0.3);
    padding: 8px 12px;
    margin-bottom: 8px;
    border-radius: 8px;
    font-size: 0.8rem;
    opacity: 0.9;
`;

const ReplyForm = styled(motion.div)<{ $isVisible?: boolean }>`
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: 12px 12px 0 0;
    padding: 12px 16px;
    display: ${props => props.$isVisible ? 'flex' : 'none'};
    align-items: center;
    gap: 12px;
    position: relative;
    border-bottom: none;

    &::before {
        content: '';
        position: absolute;
        left: 16px;
        top: 0;
        width: 3px;
        height: 100%;
        background: var(--primary-color);
        border-radius: 2px;
    }
`;

const ReplyInfo = styled.div`
    flex: 1;
    margin-left: 8px;
`;

const ReplyAuthor = styled.div`
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 2px;
`;

const ReplyMessage = styled.div`
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
`;

const CloseReplyButton = styled(motion.button)`
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: var(--text-secondary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.8rem;
    transition: background var(--transition-fast);

    &:hover {
        background: var(--primary-color);
    }
`;

// Тултип для действий с комментарием (fixed позиционирование поверх всего)
const CommentTooltip = styled(motion.div)<{ 
    $isOwn?: boolean; 
    $position?: { side: 'left' | 'right'; top: number; left: number } 
}>`
    position: fixed;
    top: ${props => props.$position?.top || 0}px;
    left: ${props => props.$position?.left || 0}px;
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    z-index: 2000; /* Поверх всего */
    min-width: 180px;
    overflow: hidden;
    backdrop-filter: blur(10px);
    
    /* Стрелочка тултипа */
    &::before {
        content: '';
        position: absolute;
        top: 16px;
        ${props => (props.$position?.side || 'right') === 'left' ? 'right: -6px' : 'left: -6px'};
        width: 12px;
        height: 12px;
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-left: ${props => (props.$position?.side || 'right') === 'left' ? 'none' : '1px solid var(--border-color)'};
        border-top: ${props => (props.$position?.side || 'right') === 'left' ? 'none' : '1px solid var(--border-color)'};
        border-right: ${props => (props.$position?.side || 'right') === 'left' ? '1px solid var(--border-color)' : 'none'};
        border-bottom: ${props => (props.$position?.side || 'right') === 'left' ? '1px solid var(--border-color)' : 'none'};
        transform: rotate(45deg);
        z-index: -1;
    }
`;

const TooltipAction = styled.button<{ $danger?: boolean }>`
    width: 100%;
    padding: 14px 16px;
    border: none;
    background: transparent;
    color: ${props => props.$danger ? '#ff4757' : 'var(--text-color)'};
    font-size: 0.9rem;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    gap: 12px;

    svg {
        color: ${props => props.$danger ? '#ff4757' : 'var(--text-secondary)'};
        transition: color var(--transition-fast);
    }

    &:hover {
        background: ${props => props.$danger ? 'rgba(255, 71, 87, 0.1)' : 'var(--hover-overlay)'};
        
        svg {
            color: ${props => props.$danger ? '#ff4757' : 'var(--orange-primary)'};
        }
    }

    &:first-child {
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
    }

    &:last-child {
        border-bottom-left-radius: 12px;
        border-bottom-right-radius: 12px;
    }
`;

const EditedMark = styled.span`
    font-size: 0.7rem;
    opacity: 0.7;
    font-style: italic;
    color: var(--text-secondary);
    margin: 0;
`;

const DeleteConfirmModal = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    backdrop-filter: blur(4px);
`;

const DeleteConfirmDialog = styled(motion.div)`
    background: var(--card-background);
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color);
`;

const DeleteConfirmTitle = styled.h3`
    margin: 0 0 12px 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
`;

const DeleteConfirmText = styled.p`
    margin: 0 0 24px 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.4;
`;

const DeleteConfirmActions = styled.div`
    display: flex;
    gap: 12px;
    justify-content: flex-end;
`;

const DeleteConfirmButton = styled.button<{ $secondary?: boolean; $danger?: boolean }>`
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    
    ${props => props.$secondary && `
        background: var(--background-secondary);
        color: var(--text-secondary);
        
        &:hover {
            background: var(--border-color);
        }
    `}
    
    ${props => props.$danger && `
        background: #dc3545;
        color: white;
        
        &:hover {
            background: #c82333;
        }
    `}
`;

const CommentForm = styled.div`
    padding: 20px 24px 28px 24px;
    border-top: 1px solid var(--border-color);
    background: var(--card-background);
    position: relative;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 24px;
        right: 24px;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--border-color), transparent);
    }
`;

const CommentInputContainer = styled.div`
    position: relative;
    width: 100%;
`;

const CommentInput = styled.textarea`
    width: 100%;
    padding: 16px 56px 16px 16px;
    border: 2px solid var(--border-color);
    border-radius: 16px;
    background: var(--background-color);
    color: var(--text-primary);
    font-size: 0.95rem;
    resize: none;
    min-height: 50px;
    max-height: 120px;
    font-family: inherit;
    transition: all var(--transition-fast);
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        background: var(--card-background);
        box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
    }

    &::placeholder {
        color: var(--text-secondary);
        opacity: 0.7;
    }
`;

const SendButton = styled(motion.button)<{ $hasText?: boolean }>`
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 12px;
    background: ${props => props.$hasText ? 'var(--gradient-primary)' : 'transparent'};
    color: ${props => props.$hasText ? 'white' : 'var(--text-secondary)'};
    cursor: ${props => props.$hasText ? 'pointer' : 'default'};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    transition: all var(--transition-fast);
    opacity: ${props => props.$hasText ? '1' : '0.5'};
    pointer-events: ${props => props.$hasText ? 'auto' : 'none'};

    &:hover {
        ${props => props.$hasText && `
            transform: translateY(-50%) scale(1.1);
            box-shadow: 0 4px 12px rgba(var(--primary-color-rgb), 0.3);
        `}
    }

    &:active {
        transform: translateY(-50%) scale(0.95);
    }
`;

const EmptyComments = styled.div`
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
    font-size: 0.95rem;
    line-height: 1.6;
    
    &::before {
        content: '💭';
        display: block;
        font-size: 3rem;
        margin-bottom: 16px;
        opacity: 0.5;
    }
`;

interface TutorialMaterialsProps {
    isOpen: boolean;
    onClose: () => void;
}

const TutorialMaterials: React.FC<TutorialMaterialsProps> = ({ isOpen, onClose }) => {
    const [hasMounted, setHasMounted] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [currentPage, setCurrentPage] = useState<string | null>(null);
    
    // Получаем текущего пользователя
    const currentUser = useAppSelector(state => state.user.user);
    
    // Состояние для реакций и комментариев
    const [materialReactions, setMaterialReactions] = useState<MaterialReactions>({});
    const [loading, setLoading] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
    const [activeCommentsModal, setActiveCommentsModal] = useState<number | null>(null);
    const [newComment, setNewComment] = useState('');
    const [replyToComment, setReplyToComment] = useState<Comment | null>(null);
    const [swipingCommentId, setSwipingCommentId] = useState<string | null>(null);
    const [returningCommentId, setReturningCommentId] = useState<string | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ side: 'left' | 'right'; top: number; left: number }>({ 
        side: 'right', 
        top: 0, 
        left: 0 
    });
    const [initialLoading, setInitialLoading] = useState(false);
    
    // Функция для прокрутки к низу комментариев
    const scrollToBottom = () => {
        setTimeout(() => {
            const commentsBody = document.querySelector('[data-comments-body]') as HTMLDivElement;
            if (commentsBody) {
                commentsBody.scrollTop = commentsBody.scrollHeight;
            }
        }, 100);
    };

    useEffect(() => {
        setHasMounted(true);
        // Быстрое появление
        setIsVisible(true);
        
        // Загружаем данные для всех материалов при открытии
        if (isOpen) {
            const materialsToLoad = tutorialMaterials.filter(material => !materialReactions[material.id]);
            
            if (materialsToLoad.length > 0) {
                setInitialLoading(true);
                Promise.all(materialsToLoad.map(material => loadMaterialData(material.id)))
                    .finally(() => setInitialLoading(false));
            }
        }
    }, [isOpen]);

    // Закрытие тултипа при клике вне его или Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            // Проверяем, что клик не внутри тултипа или комментария
            if (activeTooltipId && !target.closest('[data-tooltip]') && !target.closest('[data-comment-bubble]')) {
                setActiveTooltipId(null);
            }
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && activeTooltipId) {
                setActiveTooltipId(null);
            }
        };

        if (activeTooltipId) {
            document.addEventListener('click', handleClickOutside, true);
            document.addEventListener('keydown', handleEscapeKey);
            return () => {
                document.removeEventListener('click', handleClickOutside, true);
                document.removeEventListener('keydown', handleEscapeKey);
            };
        }
    }, [activeTooltipId]);

    // Загрузка данных материала с API
    const loadMaterialData = async (materialId: number, forceReload = false) => {
        if (!materialId || (!forceReload && materialReactions[materialId])) return; // Уже загружено
        
        setLoading(true);
        try {
            console.log(`[DEBUG] Загружаем данные для материала ${materialId}`);
            
            const [reactionsResponse, commentsResponse] = await Promise.all([
                materialsApi.getReactions(materialId),
                materialsApi.getComments(materialId)
            ]);

            console.log('[DEBUG] Ответ API комментариев:', commentsResponse);
            console.log('[DEBUG] Ответ API реакций:', reactionsResponse);

            // Преобразуем данные API в локальный формат
            const reactions: UserReaction[] = reactionsResponse.reactions.flatMap(reaction =>
                reaction.users.map(user => ({
                    userId: user.user_id,
                    userName: user.first_name || user.username || 'Пользователь',
                    photo_url: user.photo_url,
                    emoji: reaction.emoji,
                    timestamp: new Date()
                }))
            );

            // Обрабатываем комментарии с учетом вложенности
            const processComments = (comments: any[]): Comment[] => {
                return comments.map(comment => ({
                    id: comment.id,
                    userId: comment.user_id,
                    author: comment.author.first_name || comment.author.username || 'Пользователь',
                    author_photo: comment.author.photo_url,
                    message: comment.message,
                    timestamp: new Date(comment.created_at),
                    replyTo: comment.reply_to,
                    edited: comment.edited
                }));
            };

            // Получаем все комментарии (включая ответы)
            const allComments: Comment[] = [];
            
            // Добавляем корневые комментарии
            const rootComments = processComments(commentsResponse.comments);
            allComments.push(...rootComments);
            
            // Добавляем ответы из replies
            commentsResponse.comments.forEach(comment => {
                if (comment.replies && comment.replies.length > 0) {
                    const replies = processComments(comment.replies);
                    allComments.push(...replies);
                }
            });

            console.log('[DEBUG] Обработанные комментарии:', allComments);

            setMaterialReactions(prev => {
                const newState = {
                    ...prev,
                    [materialId]: { reactions, comments: allComments }
                };
                console.log(`[DEBUG] Обновляем состояние для материала ${materialId}:`, newState[materialId]);
                return newState;
            });
            
            // Прокручиваем к низу при загрузке комментариев
            if (allComments.length > 0 && activeCommentsModal === materialId) {
                scrollToBottom();
            }
        } catch (error) {
            console.error('Ошибка загрузки данных материала:', error);
        } finally {
            setLoading(false);
        }
    };

    // Функции для работы с реакциями
    const handleReaction = async (materialId: number, emoji: string) => {
        if (!currentUser) return;

        try {
            const result = await materialsApi.toggleReaction(materialId, {
                material_id: materialId,
                emoji
            });
            
                         // Обновляем локальное состояние после успешного API запроса
             await loadMaterialData(materialId, true);
            console.log(result.message);
        } catch (error) {
            console.error('Ошибка при обновлении реакции:', error);
        }
        
        setShowReactionPicker(null);
    };

    const handleAddComment = async (materialId: number) => {
        if (!newComment.trim() || !currentUser) return;
        
        try {
            // Если редактируем комментарий
            if (editingCommentId) {
                await materialsApi.updateComment(editingCommentId, {
                    message: newComment.trim()
                });
                setEditingCommentId(null);
            } else {
                // Создаем новый комментарий
                await materialsApi.createComment(materialId, {
                    material_id: materialId,
                    message: newComment.trim(),
                    reply_to: replyToComment?.id
                });
            }
            
            // Обновляем локальное состояние
            await loadMaterialData(materialId, true);
            
            setNewComment('');
            setReplyToComment(null);
            
            // Прокручиваем к новому комментарию
            scrollToBottom();
        } catch (error) {
            console.error('Ошибка при работе с комментарием:', error);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!activeCommentsModal) return;
        
        try {
            await materialsApi.deleteComment(commentId);
            
            // Обновляем локальное состояние после успешного удаления
            await loadMaterialData(activeCommentsModal, true);
            
            setDeletingCommentId(null);
        } catch (error) {
            console.error('Ошибка при удалении комментария:', error);
        }
    };

    const startEditComment = (comment: Comment) => {
        setEditingCommentId(comment.id);
        setNewComment(comment.message); // Переносим текст в основной инпут
    };

    const cancelEdit = () => {
        setEditingCommentId(null);
        setNewComment(''); // Очищаем инпут
        setReplyToComment(null); // Очищаем реплай
    };

    // Функции для тултипа
    const copyCommentToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setActiveTooltipId(null);
        } catch (error) {
            console.error('Ошибка при копировании:', error);
        }
    };

    const handleCommentClick = (event: React.MouseEvent, comment: Comment, isOwn: boolean) => {
        event.stopPropagation();
        if (editingCommentId === comment.id) return; // Не показывать тултип в режиме редактирования
        
        // Получаем позицию комментария относительно экрана
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const tooltipWidth = 180;
        
        // Вычисляем оптимальную позицию
        let side: 'left' | 'right' = 'right';
        let left = rect.right + 8; // По умолчанию справа от комментария
        
        // Проверяем, поместится ли тултип справа
        if (rect.right + tooltipWidth + 16 > windowWidth) {
            // Не помещается справа, ставим слева
            side = 'left';
            left = rect.left - tooltipWidth - 8;
        }
        
        // Если слева тоже не помещается, ставим где больше места
        if (left < 0) {
            if (rect.right + tooltipWidth + 16 <= windowWidth) {
                side = 'right';
                left = rect.right + 8;
            } else {
                // Ставим по центру комментария, но сдвигаем чтобы поместился
                side = 'right';
                left = Math.max(8, windowWidth - tooltipWidth - 8);
            }
        }
        
        setTooltipPosition({
            side,
            top: rect.top + rect.height / 2 - 20, // Центрируем по вертикали
            left
        });
        
        setActiveTooltipId(activeTooltipId === comment.id ? null : comment.id);
    };

    const handleCardClick = (material: typeof tutorialMaterials[0]) => {
        if (material.url && material.url !== "#") {
            // Если это внутренняя страница
            if (material.url.startsWith('internal:')) {
                const pageId = material.url.replace('internal:', '');
                setCurrentPage(pageId);
            } else {
                // Внешняя ссылка - открываем в новом окне
                window.open(material.url, '_blank');
            }
        }
    };

    const handleBackToMaterials = () => {
        setCurrentPage(null);
    };

    if (!hasMounted) {
        return null;
    }

    // Если открыта конкретная страница, показываем её
    if (currentPage === 'updates') {
        return <UpdatesPage onBack={handleBackToMaterials} />;
    }

    // Иначе показываем список материалов
    return (
        <PageContainer $isOpen={isOpen && isVisible}>
            <ContentContainer $isOpen={isOpen && isVisible}>
                <PageHeader>
                    <PageTitle>
                        <SchoolIcon />
                        Обучающие материалы
                    </PageTitle>
                    <CloseButton onClick={onClose} aria-label="Закрыть">
                        <CloseIcon fontSize="inherit" />
                    </CloseButton>
                </PageHeader>

                <PageContent>
                    {initialLoading && (
                        <div style={{
                            textAlign: 'center',
                            padding: '20px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem'
                        }}>
                            Загружаем комментарии и реакции...
                        </div>
                    )}
                    <CardsGrid>
                        {tutorialMaterials.map((material) => {
                            const isAvailable = material.url !== "#";
                            const materialData = materialReactions[material.id];
                            const reactions = materialData?.reactions || [];
                            const comments = materialData?.comments || [];
                            
                            // Группируем реакции по эмодзи и подсчитываем количество
                            const groupedReactions = reactions.reduce((acc, reaction) => {
                                if (!acc[reaction.emoji]) {
                                    acc[reaction.emoji] = [];
                                }
                                acc[reaction.emoji].push(reaction);
                                return acc;
                            }, {} as { [emoji: string]: UserReaction[] });
                            
                                                                        // Находим реакцию текущего пользователя
                                            const userReaction = currentUser ? reactions.find(r => r.userId === currentUser.id) : null;
                            
                            return (
                                <TutorialCard
                                    key={material.id}
                                    $isAvailable={isAvailable}
                                >
                                    {material.isNew && <NewBadge>НОВОЕ</NewBadge>}
                                    
                                    <CardHeader>
                                        <CardIcon>{material.icon}</CardIcon>
                                        <CardTitleContainer>
                                            <CardTitle>{material.title}</CardTitle>
                                            <CardMeta>
                                                <TypeBadge $type={material.type}>
                                                    {material.type === 'video' ? (
                                                        <>
                                                            <PlayCircleOutlineIcon style={{ fontSize: '12px' }} />
                                                            Видео
                                                        </>
                                                    ) : (
                                                        <>
                                                            <DescriptionIcon style={{ fontSize: '12px' }} />
                                                            Руководство
                                                        </>
                                                    )}
                                                </TypeBadge>
                                                <Duration>
                                                    <AccessTimeIcon style={{ fontSize: '12px' }} />
                                                    {material.duration}
                                                </Duration>
                                            </CardMeta>
                                        </CardTitleContainer>
                                    </CardHeader>

                                    <CardDescription>
                                        {material.description}
                                    </CardDescription>

                                    <CardFooter>
                                        {isAvailable ? (
                                            <ActionButton $isAvailable={true} onClick={() => handleCardClick(material)}>
                                                <LaunchIcon style={{ fontSize: '16px' }} />
                                                Открыть
                                            </ActionButton>
                                        ) : (
                                            <ComingSoonText>Скоро будет доступно</ComingSoonText>
                                        )}
                                    </CardFooter>

                                                                        {/* Реакции и комментарии */}
                                    <ReactionsContainer>
                                        <ReactionsRow>
                                            <ReactionsDisplay>
                                                <AnimatePresence>
                                                    {Object.entries(groupedReactions).map(([emoji, reactionList], index) => (
                                                        <ReactionChip
                                                            key={emoji}
                                                            $active={reactionList.some(r => r.userId === currentUser?.id)}
                                                            initial={{ opacity: 0, scale: 0, x: -10 }}
                                                            animate={{ 
                                                                opacity: 1, 
                                                                scale: 1, 
                                                                x: 0,
                                                                transition: { 
                                                                    delay: index * 0.03,
                                                                    duration: 0.15,
                                                                    ease: [0.25, 0.46, 0.45, 0.94]
                                                                }
                                                            }}
                                                            exit={{ 
                                                                opacity: 0, 
                                                                scale: 0, 
                                                                x: -10,
                                                                transition: { duration: 0.1 }
                                                            }}
                                                            whileHover={{ 
                                                                scale: 1.05,
                                                                y: -2,
                                                                transition: { duration: 0.1 }
                                                            }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={isAvailable ? () => handleReaction(material.id, emoji) : undefined}
                                                            style={{ 
                                                                cursor: isAvailable ? 'pointer' : 'default',
                                                                opacity: isAvailable ? 1 : 0.6
                                                            }}
                                                        >
                                                            <span>{emoji}</span>
                                                            <span>{reactionList.length}</span>
                                                        </ReactionChip>
                                                    ))}
                                                </AnimatePresence>
                                            </ReactionsDisplay>
                                            
                                            <ActionButtons>
                                                {userReaction ? (
                                                    // Показываем реакцию пользователя
                                                    <ReactionToggleButton
                                                        whileHover={{ scale: isAvailable ? 1.05 : 1 }}
                                                        whileTap={{ scale: isAvailable ? 0.95 : 1 }}
                                                        onClick={isAvailable ? () => handleReaction(material.id, userReaction.emoji) : undefined}
                                                        style={{ 
                                                            cursor: isAvailable ? 'pointer' : 'default',
                                                            opacity: isAvailable ? 1 : 0.6
                                                        }}
                                                    >
                                                        <span>{userReaction.emoji}</span>
                                                    </ReactionToggleButton>
                                                ) : (
                                                    // Показываем кнопку выбора реакций
                                                    <ReactionToggleButton
                                                        whileHover={{ scale: isAvailable ? 1.05 : 1 }}
                                                        whileTap={{ scale: isAvailable ? 0.95 : 1 }}
                                                        onClick={isAvailable ? () => setShowReactionPicker(
                                                            showReactionPicker === material.id ? null : material.id
                                                        ) : undefined}
                                                        style={{ 
                                                            cursor: isAvailable ? 'pointer' : 'default',
                                                            opacity: isAvailable ? 1 : 0.6
                                                        }}
                                                    >
                                                        <span>😊</span>
                                                    </ReactionToggleButton>
                                                )}
                                                
                                                <CommentButton
                                                    whileHover={{ scale: isAvailable ? 1.05 : 1 }}
                                                    whileTap={{ scale: isAvailable ? 0.95 : 1 }}
                                                    onClick={isAvailable ? () => {
                                                        console.log(`[DEBUG] Открываем комментарии для материала ${material.id}`);
                                                        setActiveCommentsModal(material.id);
                                                        // Данные уже загружены, просто прокручиваем к низу
                                                        setTimeout(() => scrollToBottom(), 100);
                                                    } : undefined}
                                                    style={{ 
                                                        cursor: isAvailable ? 'pointer' : 'default',
                                                        opacity: isAvailable ? 1 : 0.6
                                                    }}
                                                >
                                                    <CommentIcon style={{ fontSize: '14px' }} />
                                                    <span>{comments.length}</span>
                                                </CommentButton>
                                            </ActionButtons>
                                        </ReactionsRow>
                                        
                                        <AnimatePresence>
                                            {showReactionPicker === material.id && isAvailable && (
                                                <ReactionPicker
                                                    initial={{ 
                                                        opacity: 0, 
                                                        scale: 0.9, 
                                                        y: -5,
                                                        height: 0
                                                    }}
                                                    animate={{ 
                                                        opacity: 1, 
                                                        scale: 1, 
                                                        y: 0,
                                                        height: 'auto'
                                                    }}
                                                    exit={{ 
                                                        opacity: 0, 
                                                        scale: 0.9, 
                                                        y: -5,
                                                        height: 0
                                                    }}
                                                    transition={{ 
                                                        duration: 0.15,
                                                        ease: [0.25, 0.46, 0.45, 0.94]
                                                    }}
                                                >
                                                    {REACTION_EMOJIS.map((emoji, index) => (
                                                        <EmojiButton
                                                            key={emoji}
                                                            initial={{ opacity: 0, scale: 0 }}
                                                            animate={{ 
                                                                opacity: 1, 
                                                                scale: 1,
                                                                transition: { 
                                                                    delay: index * 0.02,
                                                                    duration: 0.1
                                                                }
                                                            }}
                                                            whileHover={{ 
                                                                scale: 1.15,
                                                                rotate: [0, -5, 5, 0],
                                                                transition: { duration: 0.1 }
                                                            }}
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={() => handleReaction(material.id, emoji)}
                                                        >
                                                            {emoji}
                                                        </EmojiButton>
                                                    ))}
                                                </ReactionPicker>
                                            )}
                                        </AnimatePresence>
                                    </ReactionsContainer>
                                </TutorialCard>
                            );
                        })}
                    </CardsGrid>
                </PageContent>
            </ContentContainer>
            
            {/* Модальное окно комментариев */}
            <AnimatePresence>
                {activeCommentsModal !== null && (
                    <CommentsModal
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setActiveCommentsModal(null);
                            }
                        }}
                    >
                        <CommentsContainer
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "100%", opacity: 0 }}
                            transition={{ 
                                duration: 0.5, 
                                ease: [0.32, 0.72, 0, 1],
                                opacity: { duration: 0.25 }
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <CommentsHeader>
                                <CommentsTitle>
                                    Комментарии к материалу
                                </CommentsTitle>
                                <CloseButton onClick={() => setActiveCommentsModal(null)}>
                                    <CloseIcon fontSize="inherit" />
                                </CloseButton>
                            </CommentsHeader>
                            
                            <CommentsBody data-comments-body>
                                {(() => {
                                    console.log(`[DEBUG] Рендерим комментарии для материала ${activeCommentsModal}`);
                                    console.log(`[DEBUG] Данные материала:`, materialReactions[activeCommentsModal]);
                                    console.log(`[DEBUG] Количество комментариев:`, materialReactions[activeCommentsModal]?.comments?.length || 0);
                                    return null;
                                })()}
                                {activeCommentsModal !== null && materialReactions[activeCommentsModal]?.comments.length > 0 ? (
                                    materialReactions[activeCommentsModal]!.comments
                                        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Сортируем по времени: старые сверху, новые снизу
                                        .map((comment) => {
                                        const isOwn = currentUser?.id === comment.userId;
                                        const replyToOriginal = comment.replyTo ? 
                                            materialReactions[activeCommentsModal]!.comments.find(c => c.id === comment.replyTo) : null;
                                        
                                        const handleSwipe = (event: any, info: any) => {
                                            setSwipingCommentId(null);
                                            
                                            // Активируем принудительный возврат
                                            setReturningCommentId(comment.id);
                                            
                                            // Проверяем активацию ответа
                                            if (!isOwn && info.offset.x < -60) {
                                                setReplyToComment(comment);
                                            }
                                            
                                            // Убираем флаг возврата после анимации
                                            setTimeout(() => {
                                                setReturningCommentId(null);
                                            }, 400);
                                        };
                                        
                                                                    return (
                                <CommentItem
                                    key={comment.id}
                                    $isOwn={isOwn}
                                    initial={{ opacity: 0, y: 20, x: 0 }}
                                    animate={{ 
                                        opacity: 1, 
                                        y: 0,
                                        x: returningCommentId === comment.id ? 0 : undefined
                                    }}
                                    transition={{ 
                                        duration: returningCommentId === comment.id ? 0.4 : 0.3,
                                        type: "spring",
                                        stiffness: returningCommentId === comment.id ? 500 : 400,
                                        damping: returningCommentId === comment.id ? 35 : 30
                                    }}
                                    drag={!isOwn ? "x" : false}
                                    dragConstraints={{ left: -120, right: 0 }}
                                    dragElastic={0.2}
                                    dragMomentum={false}
                                    onDragStart={() => {
                                        if (!isOwn) setSwipingCommentId(comment.id);
                                    }}
                                    onDragEnd={handleSwipe}
                                    whileDrag={{ 
                                        scale: 1,
                                        boxShadow: "none"  // Убираем тени полностью при свайпе
                                    }}
                                >
                                                <CommentWithAvatar $isOwn={isOwn}>
                                                    <CommentAuthor $isOwn={isOwn}>{comment.author}</CommentAuthor>
                                                    <CommentBubble 
                                                        $isOwn={isOwn}
                                                        data-comment-bubble
                                                        onClick={(e) => handleCommentClick(e, comment, isOwn)}
                                                        style={{ cursor: editingCommentId !== comment.id ? 'pointer' : 'default' }}
                                                    >
                                                    {replyToOriginal && (
                                                        <ReplyPreview>
                                                            <strong>{replyToOriginal.author}:</strong> {replyToOriginal.message.substring(0, 50)}...
                                                        </ReplyPreview>
                                                    )}
                                                    
                                                    <CommentMessage $isOwn={isOwn}>
                                                        {comment.message}
                                                        {editingCommentId === comment.id && (
                                                            <span style={{ 
                                                                color: 'var(--orange-primary)', 
                                                                fontSize: '0.8rem', 
                                                                fontStyle: 'italic',
                                                                marginLeft: '8px'
                                                            }}>
                                                                (редактируется...)
                                                            </span>
                                                        )}
                                                    </CommentMessage>
                                                    
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        justifyContent: 'space-between', 
                                                        alignItems: 'center',
                                                        marginTop: '6px'
                                                    }}>
                                                        {comment.edited ? (
                                                            <EditedMark>изменено</EditedMark>
                                                        ) : (
                                                            <div></div>
                                                        )}
                                                        
                                                        <CommentTimestamp $isOwn={isOwn}>
                                                            {comment.timestamp.toLocaleString('ru-RU', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </CommentTimestamp>
                                                    </div>
                                                    </CommentBubble>
                                                    
                                                    
                                                    
                                                    {/* Аватарка в углу слева */}
                                                    {comment.userId ? (
                                                        <CommentAvatar 
                                                            $isOwn={isOwn}
                                                            src={getUserPhotoUrl(comment.userId)} 
                                                            alt={comment.author}
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <CommentAvatarPlaceholder $isOwn={isOwn}>
                                                            {(comment.author || 'А').charAt(0).toUpperCase()}
                                                        </CommentAvatarPlaceholder>
                                                    )}
                                                </CommentWithAvatar>
                                            <ReplyIndicator $isOwn={isOwn} />
                                            </CommentItem>
                                        );
                                    })
                                ) : (
                                    <EmptyComments>
                                        Пока нет комментариев.<br />
                                        Станьте первым, кто оставит отзыв о материале!
                                    </EmptyComments>
                                )}
                            </CommentsBody>
                            
                            {replyToComment && !editingCommentId && (
                                <ReplyForm 
                                    $isVisible={true}
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ReplyInfo>
                                        <ReplyAuthor>{replyToComment.author}</ReplyAuthor>
                                        <ReplyMessage>{replyToComment.message}</ReplyMessage>
                                    </ReplyInfo>
                                    <CloseReplyButton
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setReplyToComment(null)}
                                    >
                                        ✕
                                    </CloseReplyButton>
                                </ReplyForm>
                            )}
                            
                            <CommentForm>
                                {/* Индикатор редактирования */}
                                {editingCommentId && (
                                    <div style={{
                                        padding: '8px 16px',
                                        background: 'rgba(var(--primary-rgb), 0.1)',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '0.85rem',
                                        color: 'var(--orange-primary)',
                                        fontWeight: '500'
                                    }}>
                                        <span><EditIcon style={{ fontSize: '16px', marginRight: '8px' }} />Изменение комментария</span>
                                        <button
                                            onClick={cancelEdit}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--orange-primary)',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                padding: '0'
                                            }}
                                            title="Отменить изменения"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                                
                                <CommentInputContainer>
                                    <CommentInput
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder={editingCommentId 
                                            ? "Изменить комментарий..." 
                                            : replyToComment 
                                                ? `Ответить ${replyToComment.author}...` 
                                                : "Напишите ваш отзыв или предложение по улучшению материала..."
                                        }
                                        rows={2}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && activeCommentsModal !== null) {
                                                e.preventDefault();
                                                handleAddComment(activeCommentsModal);
                                            }
                                        }}
                                    />
                                    <SendButton
                                        $hasText={!!newComment.trim()}
                                        onClick={() => newComment.trim() && activeCommentsModal !== null && handleAddComment(activeCommentsModal)}
                                        title={editingCommentId ? "Сохранить изменения" : "Отправить комментарий"}
                                    >
                                        {editingCommentId ? (
                                            <span style={{ fontSize: '16px' }}>✓</span>
                                        ) : (
                                            <SendIcon style={{ fontSize: '18px' }} />
                                        )}
                                    </SendButton>
                                </CommentInputContainer>
                            </CommentForm>
                        </CommentsContainer>
                    </CommentsModal>
                )}
            </AnimatePresence>

            {/* Модальное окно подтверждения удаления */}
            <AnimatePresence>
                {deletingCommentId && (
                    <DeleteConfirmModal
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setDeletingCommentId(null)}
                    >
                        <DeleteConfirmDialog
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <DeleteConfirmTitle>Удалить комментарий?</DeleteConfirmTitle>
                            <DeleteConfirmText>
                                Это действие нельзя будет отменить. Комментарий будет удален навсегда.
                            </DeleteConfirmText>
                            <DeleteConfirmActions>
                                <DeleteConfirmButton 
                                    onClick={() => setDeletingCommentId(null)}
                                    $secondary
                                >
                                    Отмена
                                </DeleteConfirmButton>
                                <DeleteConfirmButton 
                                    onClick={() => handleDeleteComment(deletingCommentId)}
                                    $danger
                                >
                                    Удалить
                                </DeleteConfirmButton>
                            </DeleteConfirmActions>
                        </DeleteConfirmDialog>
                    </DeleteConfirmModal>
                )}
            </AnimatePresence>

            {/* Тултип поверх всего (fixed позиционирование) */}
            <AnimatePresence>
                {activeTooltipId && (
                    <CommentTooltip
                        $position={tooltipPosition}
                        data-tooltip
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(() => {
                            // Находим активный комментарий
                            const activeComment = activeCommentsModal !== null && materialReactions[activeCommentsModal] 
                                ? materialReactions[activeCommentsModal].comments.find(c => c.id === activeTooltipId)
                                : null;
                            
                            if (!activeComment) return null;
                            
                            const isOwn = currentUser?.id === activeComment.userId;
                            
                            return (
                                <>
                                    {!isOwn && (
                                        <TooltipAction
                                            onClick={() => {
                                                setReplyToComment(activeComment);
                                                setActiveTooltipId(null);
                                            }}
                                        >
                                            <ReplyIcon style={{ fontSize: '16px' }} />
                                            Ответить
                                        </TooltipAction>
                                    )}
                                    
                                    <TooltipAction
                                        onClick={() => copyCommentToClipboard(activeComment.message)}
                                    >
                                        <ContentCopyIcon style={{ fontSize: '16px' }} />
                                        Скопировать
                                    </TooltipAction>
                                    
                                    {isOwn && (
                                        <>
                                            <TooltipAction
                                                onClick={() => {
                                                    startEditComment(activeComment);
                                                    setActiveTooltipId(null);
                                                }}
                                            >
                                                <EditIcon style={{ fontSize: '16px' }} />
                                                Изменить
                                            </TooltipAction>
                                            
                                            <TooltipAction
                                                $danger
                                                onClick={() => {
                                                    setDeletingCommentId(activeComment.id);
                                                    setActiveTooltipId(null);
                                                }}
                                            >
                                                <DeleteIcon style={{ fontSize: '16px' }} />
                                                Удалить
                                            </TooltipAction>
                                        </>
                                    )}
                                </>
                            );
                        })()}
                    </CommentTooltip>
                )}
            </AnimatePresence>
        </PageContainer>
    );
};

export default TutorialMaterials; 