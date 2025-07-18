import React, { useState, useCallback, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Admin } from '@/types/inventoryTypes';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Close from '@mui/icons-material/Close';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Schedule from '@mui/icons-material/Schedule';
import Security from '@mui/icons-material/Security';
import Info from '@mui/icons-material/Info';
import AccessTime from '@mui/icons-material/AccessTime';
import Cancel from '@mui/icons-material/Cancel';
import SlidingDrawer from '@shared/components/SlidingDrawer/SlidingDrawer';
import UserPermissionsDrawer from './UserPermissionsDrawer';
import { userPermissionsApi, UserPermissionResponse } from '@shared/api/userPermissionsApi';

// Используем правильные типы из Redux
interface Member {
    user_id: number;
    first_name: string | null;
    last_name?: string | null;
    username?: string | null;
    photo_url?: string | null;
    isAdmin?: boolean;
}

interface MembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatId: string;
    chatTitle: string;
    admins: Admin[];
    members?: Member[];
    currentUserId?: number;
    onGrantPermission?: (userId: number, permission: 'inventory' | 'writeoff', duration: number) => void;
    onRevokePermission?: (userId: number, permission: 'inventory' | 'writeoff') => void;
    onInviteUser?: () => void;
}

// Анимации
const fadeInUp = keyframes`
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

const fadeInCenter = keyframes`
    from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.9);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
`;

const slideInLeft = keyframes`
    from {
        opacity: 0;
        transform: translateX(-15px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
`;

const pulseGlow = keyframes`
    0%, 100% { 
        box-shadow: 0 0 0 0 var(--primary-transparent);
    }
    50% { 
        box-shadow: 0 0 0 8px transparent;
    }
`;

// Styled Components
const DrawerContent = styled.div`
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--card-background);
    position: relative;
`;

const TopBar = styled.div`
    width: 40px;
    height: 4px;
    background: var(--gradient-primary);
    border-radius: 2px;
    margin: 8px auto 0;
    opacity: 0.7;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    background: var(--card-background);
`;

const Title = styled.h2`
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
    line-height: 1.4;
`;

const CloseButton = styled(IconButton)`
    color: var(--text-secondary) !important;
    padding: 6px !important;
    transition: var(--transition-normal) !important;
    border-radius: var(--radius-sm) !important;
    
    &:hover {
        background: var(--primary-transparent) !important;
        color: var(--primary-color) !important;
        transform: scale(1.1);
    }
`;

const Content = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const ScrollableContent = styled.div`
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    
    &::-webkit-scrollbar {
        width: 4px;
    }
    
    &::-webkit-scrollbar-track {
        background: var(--gray-100);
        border-radius: 2px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: var(--primary-color);
        border-radius: 2px;
        opacity: 0.6;
        
        &:hover {
            opacity: 1;
        }
    }
`;

const FixedFooter = styled.div`
    flex-shrink: 0;
    padding: 20px;
    border-top: 1px solid var(--border-color);
    background: var(--card-background);
`;

const MembersList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: ${fadeInUp} 0.4s ease-out;
`;

const MemberItem = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    transition: var(--transition-normal);
    position: relative;
    overflow: hidden;
    animation: ${slideInLeft} 0.4s ease-out;
    animation-fill-mode: both;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, 
            var(--primary-transparent) 0%, 
            transparent 50%
        );
        opacity: 0;
        transition: opacity var(--transition-normal);
        pointer-events: none;
    }
    
    &:hover {
        border-color: var(--primary-color);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
        
        &::before {
            opacity: 1;
        }
    }
    
    &:nth-child(1) { animation-delay: 0.05s; }
    &:nth-child(2) { animation-delay: 0.1s; }
    &:nth-child(3) { animation-delay: 0.15s; }
    &:nth-child(4) { animation-delay: 0.2s; }
    &:nth-child(n+5) { animation-delay: 0.25s; }
`;

const MemberInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1;
`;

const MemberAvatar = styled(Avatar)`
    width: 44px !important;
    height: 44px !important;
    border: 2px solid var(--border-color);
    transition: var(--transition-normal);
    font-weight: 600 !important;
    font-size: 0.9rem !important;
    background: var(--gradient-primary) !important;
    color: white !important;
    box-shadow: var(--shadow-sm);
    
    ${MemberItem}:hover & {
        border-color: var(--primary-color);
        transform: scale(1.08);
        animation: ${pulseGlow} 2s infinite;
    }
`;

const MemberDetails = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
`;

const MemberName = styled.div`
    font-weight: 600;
    color: var(--text-color);
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 8px;
    line-height: 1.3;
`;

const CurrentUserBadge = styled.span`
    background: var(--gradient-primary);
    color: white;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    box-shadow: var(--shadow-sm);
    opacity: 0.9;
    
    &:hover {
        opacity: 1;
        transform: scale(1.05);
    }
`;

const MemberRole = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const AdminBadge = styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--success-background);
    color: var(--success-color);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid rgba(16, 185, 129, 0.2);
    transition: var(--transition-normal);
    
    &:hover {
        background: rgba(16, 185, 129, 0.15);
        border-color: var(--success-color);
        transform: translateY(-1px);
    }
`;

const MemberBadge = styled.span`
    padding: 4px 8px;
    background: var(--gray-100);
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--border-color);
`;

const MemberActions = styled.div`
    display: flex;
    gap: 6px;
    pointer-events: auto;
    position: relative;
    z-index: 5;
`;

const ActionButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    border-radius: 20px;
    background: rgba(255, 95, 31, 0.1);
    color: #FF5F1F;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    pointer-events: auto;
    position: relative;
    z-index: 10;
    
    &:hover {
        background: rgba(255, 95, 31, 0.2);
        transform: translateY(-1px);
    }
    
    &:active {
        transform: translateY(0);
        background: rgba(255, 95, 31, 0.3);
    }
`;

// Стили для карточек прав пользователей
const PermissionsContainer = styled.div`
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const PermissionCard = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 12px;
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.2);
    animation: ${fadeInUp} 0.3s ease;
`;

const PermissionInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const PermissionType = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #22C55E;
`;

const PermissionExpiry = styled.div`
    font-size: 10px;
    color: #64748B;
    display: flex;
    align-items: center;
    gap: 4px;
`;

const RevokeButton = styled.button`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: none;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.1);
    color: #EF4444;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(239, 68, 68, 0.2);
        transform: translateY(-1px);
    }
`;

const PermissionBadge = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 500;
    background: rgba(34, 197, 94, 0.1);
    color: #22C55E;
    text-transform: uppercase;
`;

const LoadingIndicator = styled.div`
    font-size: 12px;
    color: #64748B;
    font-style: italic;
`;

const TimeSelector = styled.div`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1005;
    background: rgba(30, 30, 30, 0.98);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    max-width: 400px;
    width: 90%;
    animation: ${fadeInCenter} 0.3s ease;
`;

const TimeSelectorBackdrop = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1004;
    backdrop-filter: blur(4px);
`;

const TimeSelectorTitle = styled.h3`
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    text-align: center;
`;

const InviteSection = styled.div`
    text-align: center;
    animation: ${fadeInUp} 0.5s ease-out;
    animation-delay: 0.3s;
    animation-fill-mode: both;
`;

const InviteButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 20px;
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: var(--transition-normal);
    box-shadow: var(--shadow-sm);
    position: relative;
    overflow: hidden;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.2) 50%, 
            transparent 100%);
        transition: left 0.6s ease;
    }
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        
        &::before {
            left: 100%;
        }
    }
    
    &:active {
        transform: translateY(0);
    }
`;

const InviteHint = styled.p`
    margin-top: 12px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
    opacity: 0.8;
`;

const PermissionSelect = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
`;

const PermissionLabel = styled.label`
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    color: var(--text-color);
    font-weight: 500;
    padding: 12px 16px;
    border-radius: var(--radius);
    transition: var(--transition-normal);
    border: 1px solid var(--border-color);
    background: var(--card-background);
    position: relative;
    
    &:hover {
        background: var(--primary-transparent);
        border-color: var(--primary-color);
        transform: translateX(2px);
        box-shadow: var(--shadow-sm);
    }
    
    /* Скрываем стандартный чекбокс */
    input[type="checkbox"] {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }
`;

const CustomCheckbox = styled.div<{ $isChecked: boolean }>`
    width: 18px;
    height: 18px;
    border: 2px solid ${props => props.$isChecked ? 'var(--primary-color)' : 'var(--border-color)'};
    border-radius: var(--radius-sm);
    background: ${props => props.$isChecked ? 'var(--gradient-primary)' : 'var(--card-background)'};
    transition: var(--transition-normal);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-shadow: ${props => props.$isChecked ? '0 0 0 2px var(--primary-transparent)' : 'none'};
    
    /* Галочка */
    &::after {
        content: '✓';
        color: white;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        opacity: ${props => props.$isChecked ? 1 : 0};
        transform: ${props => props.$isChecked ? 'scale(1)' : 'scale(0.5)'};
        transition: var(--transition-normal);
    }
`;

const DurationSelect = styled.div`
    margin-bottom: 16px;
    
    label {
        display: block;
        margin-bottom: 6px;
        color: var(--text-color);
        font-weight: 600;
        font-size: 0.85rem;
        opacity: 0.9;
    }
    
    select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        background: var(--card-background);
        color: var(--text-color);
        font-size: 0.85rem;
        transition: var(--transition-normal);
        
        &:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 2px var(--primary-transparent);
        }
    }
`;

const TimeActions = styled.div`
    display: flex;
    gap: 10px;
`;

const ConfirmButton = styled.button`
    flex: 1;
    padding: 10px 16px;
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: var(--transition-normal);
    box-shadow: var(--shadow-sm);
    
    &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
    }
    
    &:disabled {
        background: var(--button-secondary-bg);
        color: var(--button-secondary-text);
        cursor: not-allowed;
        opacity: 0.6;
        transform: none;
        box-shadow: none;
    }
`;

const CancelButton = styled.button`
    flex: 1;
    padding: 10px 16px;
    background: var(--button-secondary-bg);
    color: var(--button-secondary-text);
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: var(--transition-normal);
    
    &:hover {
        background: var(--button-secondary-hover-bg);
        transform: translateY(-1px);
    }
`;

export const MembersModal: React.FC<MembersModalProps> = ({
    isOpen,
    onClose,
    chatId,
    chatTitle,
    admins,
    members = [],
    currentUserId,
    onGrantPermission,
    onRevokePermission,
    onInviteUser
}) => {
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<('inventory' | 'writeoff')[]>(['inventory']);
    const [selectedDuration, setSelectedDuration] = useState<number>(24); // часы
    const [userPermissions, setUserPermissions] = useState<UserPermissionResponse[]>([]);
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    
    // Новые состояния для UserPermissionsDrawer
    const [permissionsDrawerOpen, setPermissionsDrawerOpen] = useState(false);
    const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<Member | null>(null);

    // Загрузка прав пользователей при открытии модального окна
    useEffect(() => {
        if (isOpen && currentUserId) {
            loadUserPermissions();
        }
    }, [isOpen, currentUserId, chatId]);

    const loadUserPermissions = useCallback(async () => {
        if (!currentUserId) return;
        
        setLoadingPermissions(true);
        try {
            const response = await userPermissionsApi.listPermissions(
                parseInt(chatId),
                true, // только активные права
                currentUserId
            );
            setUserPermissions(response.permissions || []);
        } catch (error: any) {
            console.log('Ошибка загрузки прав пользователей:', error);
            
                                    // Если ошибка 403 (нет прав администратора), просто не показываем управление доступом
            if (error.response?.status === 403) {
                console.log('Пользователь не является администратором группы - скрываем управление доступом');
                setUserPermissions([]);
            } else {
                console.error('Неожиданная ошибка при загрузке прав:', error);
            }
        } finally {
            setLoadingPermissions(false);
        }
    }, [currentUserId, chatId]);

    // Функция для получения прав конкретного пользователя
    const getUserPermissions = useCallback((userId: number) => {
        return userPermissions.filter(permission => permission.user_id === userId);
    }, [userPermissions]);

            // Функция для открытия drawer с доступом пользователя
    const handleOpenPermissionsDrawer = useCallback((user: Member) => {
        setSelectedUserForPermissions(user);
        setPermissionsDrawerOpen(true);
    }, []);

    // Функция для закрытия drawer с доступом пользователя
    const handleClosePermissionsDrawer = useCallback(() => {
        setPermissionsDrawerOpen(false);
        setSelectedUserForPermissions(null);
    }, []);

    // Функция для отзыва прав с обновлением состояния
    const handleRevokePermissionWithUpdate = useCallback(async (userId: number, permission: 'inventory' | 'writeoff') => {
        if (onRevokePermission) {
            onRevokePermission(userId, permission);
            // Обновляем список прав после отзыва
            setTimeout(() => {
                loadUserPermissions();
            }, 500);
        }
    }, [onRevokePermission, loadUserPermissions]);

    // Функция для выдачи прав с обновлением состояния
    const handleConfirmGrant = useCallback(() => {
        if (selectedUserId && onGrantPermission && selectedPermissions.length > 0) {
                            // Открываем доступ для каждого выбранного типа разрешения
            selectedPermissions.forEach(permission => {
                onGrantPermission(selectedUserId, permission, selectedDuration);
            });
            setSelectedUserId(null);
            setSelectedPermissions(['inventory']); // Сбрасываем к значению по умолчанию
            // Обновляем список прав после выдачи
            setTimeout(() => {
                loadUserPermissions();
            }, 500);
        }
    }, [selectedUserId, selectedPermissions, selectedDuration, onGrantPermission, loadUserPermissions]);

    // Функция для форматирования времени окончания прав
    const formatExpiryTime = useCallback((expiresAt: string) => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry.getTime() - now.getTime();
        
        if (diff <= 0) {
            return "Истекло";
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}ч ${minutes}м`;
        } else {
            return `${minutes}м`;
        }
    }, []);

    const handleGrantPermission = useCallback((userId: number) => {
        setSelectedUserId(userId);
    }, []);

    // Функция для добавления прав из drawer'а (использует ту же логику)
    const handleAddPermissionFromDrawer = useCallback((userId: number) => {
        setSelectedUserId(userId);
        // Закрываем drawer прав при открытии селектора времени
        setPermissionsDrawerOpen(false);
    }, []);

    const handlePermissionToggle = useCallback((permission: 'inventory' | 'writeoff') => {
        setSelectedPermissions(prev => {
            if (prev.includes(permission)) {
                return prev.filter(p => p !== permission);
            } else {
                return [...prev, permission];
            }
        });
    }, []);

    const handleInviteUser = useCallback(async () => {
        try {
            // Проверяем доступность Telegram Web App API
            if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                const webApp = window.Telegram.WebApp as any;
                
                // Создаем прямую ссылку на бота для регистрации
                const botUsername = 'ninja_event_bot';
                const botLink = `https://t.me/${botUsername}?start=registry_${chatId}`;
                
                // Создаем красивый текст для регистрации
                const shareText = `🥷 *Регистрация в чат "${chatTitle}"*\n\n` +
                    `📦 Управление инвентарем\n` +
                    `📋 Заявки на списание\n` +
                    `📊 Отчеты и аналитика\n` +
                    `⚡ Уведомления в реальном времени\n\n` +
                    `👆 Нажмите на ссылку для регистрации:`;
                
                // Используем нативный шаринг Telegram с красивым текстом
                const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(shareText)}`;
                
                // Открываем нативное окно выбора чатов
                if (typeof webApp.openTelegramLink === 'function') {
                    webApp.openTelegramLink(shareUrl);
                    console.log('✅ [MembersModal] Открыто нативное окно шаринга через openTelegramLink');
                } else if (typeof webApp.openLink === 'function') {
                    webApp.openLink(shareUrl);
                    console.log('✅ [MembersModal] Открыто окно шаринга через openLink');
                } else {
                    // Fallback - открываем в новой вкладке
                    window.open(shareUrl, '_blank');
                    console.log('✅ [MembersModal] Открыто окно шаринга через window.open');
                }
                
                console.log('✅ [MembersModal] Создана ссылка для шаринга регистрации:', shareUrl);
            } else {
                // Fallback для веб-версии
                console.log('⚠️ [MembersModal] Telegram Web App API недоступен, используем fallback');
                if (onInviteUser) {
                    onInviteUser();
                }
            }
        } catch (error) {
            console.error('❌ [MembersModal] Ошибка при создании приглашения:', error);
            // Fallback при ошибке
            if (onInviteUser) {
                onInviteUser();
            }
        }
    }, [chatTitle, chatId, onInviteUser]);

    const isCurrentUserAdmin = admins.some(admin => admin.user_id === currentUserId);

    // Объединяем админов и участников, исключая дубликаты
    const allMembers = [
        ...admins.map(admin => ({ ...admin, isAdmin: true })),
        ...members.filter(member => !admins.some(admin => admin.user_id === member.user_id))
            .map(member => ({ ...member, isAdmin: false }))
    ];

    // Исправленная функция для fallback аватаров с правильными цветами
    const getFallbackPhotoUrl = (user: any): string => {
        const name = user.first_name || user.username || 'U';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=44&background=FF5F1F&color=fff&bold=true&font-size=0.5`;
    };

    const getPhotoUrl = (user: any): string => {
        // Если есть photo_url, используем API endpoint для получения фото
        if (user.photo_url && user.user_id) {
            const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const photoUrl = `${baseURL}/v1/users/${user.user_id}/photo`;
            console.log(`📸 [MembersModal] Фото URL для пользователя ${user.user_id}:`, photoUrl);
            return photoUrl;
        }
        // Если нет photo_url, используем fallback
        console.log(`📸 [MembersModal] Используем fallback для пользователя ${user.user_id || 'unknown'}`);
        return getFallbackPhotoUrl(user);
    };

    // Функция для получения инициалов
    const getInitials = (user: any): string => {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        
        if (firstName && lastName) {
            return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        } else if (firstName) {
            return firstName.charAt(0).toUpperCase();
        } else if (user.username) {
            return user.username.charAt(0).toUpperCase();
        } else {
            return 'U';
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <SlidingDrawer onClose={onClose}>
                <DrawerContent>
                    <TopBar />
                    <Header>
                        <Title>
                            Участники чата "{chatTitle}"
                        </Title>
                        <CloseButton onClick={onClose}>
                            <Close />
                        </CloseButton>
                    </Header>

                    <Content>
                        <ScrollableContent>
                            <MembersList>
                                {allMembers.map((member, index) => (
                                    <MemberItem key={member.user_id} style={{ animationDelay: `${index * 0.05}s` }}>
                                        <MemberInfo>
                                            <MemberAvatar
                                                src={getPhotoUrl(member)}
                                                alt={member.first_name || ''}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.onerror = null;
                                                    // При ошибке загрузки API endpoint используем fallback
                                                    console.log(`❌ [MembersModal] Ошибка загрузки фото для пользователя ${member.user_id}, используем fallback`);
                                                    target.src = getFallbackPhotoUrl(member);
                                                }}
                                            >
                                                {/* Показываем инициалы только если нет photo_url */}
                                                {!member.photo_url && getInitials(member)}
                                            </MemberAvatar>
                                            <MemberDetails>
                                                <MemberName>
                                                    {member.first_name} {(member as any).last_name || ''}
                                                    {member.user_id === currentUserId && (
                                                        <CurrentUserBadge>вы</CurrentUserBadge>
                                                    )}
                                                </MemberName>
                                                <MemberRole>
                                                    {member.isAdmin ? (
                                                        <AdminBadge>
                                                            <Security fontSize="inherit" />
                                                            Администратор
                                                        </AdminBadge>
                                                    ) : (
                                                        <MemberBadge>
                                                            Участник
                                                        </MemberBadge>
                                                    )}
                                                </MemberRole>
                                            </MemberDetails>
                                        </MemberInfo>

                                        {/* Кнопки управления доступом */}
                                        {isCurrentUserAdmin && !member.isAdmin && member.user_id !== currentUserId && (
                                            <MemberActions>
                                                {(() => {
                                                    const userPerms = getUserPermissions(member.user_id);
                                                    const hasPermissions = userPerms.length > 0;
                                                    
                                                    if (hasPermissions) {
                                                        return (
                                                            <ActionButton
                                                                onClick={() => handleOpenPermissionsDrawer(member)}
                                                                title="Информация о доступе"
                                                                style={{ 
                                                                    background: 'rgba(var(--primary-rgb), 0.15)',
                                                                    color: 'var(--primary-color)',
                                                                    borderColor: 'rgba(var(--primary-rgb), 0.3)'
                                                                }}
                                                            >
                                                                <Info fontSize="inherit" />
                                                                Доступ ({userPerms.length})
                                                            </ActionButton>
                                                        );
                                                    } else {
                                                        return (
                                                            <ActionButton
                                                                onClick={() => handleGrantPermission(member.user_id)}
                                                                title="Открыть доступ"
                                                            >
                                                                <Schedule fontSize="inherit" />
                                                                Открыть доступ
                                                            </ActionButton>
                                                        );
                                                    }
                                                })()}
                                            </MemberActions>
                                        )}
                                    </MemberItem>
                                ))}
                            </MembersList>
                        </ScrollableContent>

                        {/* Фиксированная форма приглашения внизу */}
                        {isCurrentUserAdmin && (
                            <FixedFooter>
                                <InviteSection>
                                    <InviteButton onClick={handleInviteUser}>
                                        <PersonAdd fontSize="small" />
                                        Отправить ссылку регистрации
                                    </InviteButton>
                                    <InviteHint>
                                        Выберите чат для отправки ссылки регистрации
                                    </InviteHint>
                                </InviteSection>
                            </FixedFooter>
                        )}
                    </Content>

                </DrawerContent>
            </SlidingDrawer>
            
            {/* Модальное окно выбора времени - вынесено за пределы SlidingDrawer */}
            {selectedUserId && (
                <>
                    <TimeSelectorBackdrop onClick={() => setSelectedUserId(null)} />
                    <TimeSelector>
                        <TimeSelectorTitle>Временный доступ</TimeSelectorTitle>
                        <PermissionSelect>
                            <PermissionLabel>
                                <input
                                    type="checkbox"
                                    name="permission"
                                    value="inventory"
                                    checked={selectedPermissions.includes('inventory')}
                                    onChange={() => handlePermissionToggle('inventory')}
                                />
                                <CustomCheckbox $isChecked={selectedPermissions.includes('inventory')} />
                                Инвентаризация
                            </PermissionLabel>
                            <PermissionLabel>
                                <input
                                    type="checkbox"
                                    name="permission"
                                    value="writeoff"
                                    checked={selectedPermissions.includes('writeoff')}
                                    onChange={() => handlePermissionToggle('writeoff')}
                                />
                                <CustomCheckbox $isChecked={selectedPermissions.includes('writeoff')} />
                                Списание
                            </PermissionLabel>
                        </PermissionSelect>
                        <DurationSelect>
                            <label>Время действия:</label>
                            <select
                                value={selectedDuration}
                                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                            >
                                <option value={1}>1 час</option>
                                <option value={4}>4 часа</option>
                                <option value={8}>8 часов</option>
                                <option value={24}>24 часа</option>
                                <option value={72}>3 дня</option>
                                <option value={168}>7 дней</option>
                            </select>
                        </DurationSelect>
                        <TimeActions>
                            <ConfirmButton 
                                onClick={handleConfirmGrant}
                                disabled={selectedPermissions.length === 0}
                            >
                                Подтвердить {selectedPermissions.length > 0 ? `(${selectedPermissions.length})` : ''}
                            </ConfirmButton>
                            <CancelButton onClick={() => setSelectedUserId(null)}>
                                Отмена
                            </CancelButton>
                        </TimeActions>
                    </TimeSelector>
                </>
            )}
            
            {/* Drawer для отображения прав пользователя */}
            {selectedUserForPermissions && (
                <UserPermissionsDrawer
                    isOpen={permissionsDrawerOpen}
                    onClose={handleClosePermissionsDrawer}
                    user={selectedUserForPermissions}
                    permissions={getUserPermissions(selectedUserForPermissions.user_id)}
                    onRevokePermission={handleRevokePermissionWithUpdate}
                    onAddPermission={handleAddPermissionFromDrawer}
                />
            )}
        </>
    );
}; 