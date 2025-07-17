import React, { useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { Admin } from '@/types/inventoryTypes';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Close from '@mui/icons-material/Close';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Schedule from '@mui/icons-material/Schedule';
import Security from '@mui/icons-material/Security';
import SlidingDrawer from '@shared/components/SlidingDrawer/SlidingDrawer';

// Используем правильные типы из Redux
interface Member {
    user_id: number;
    first_name: string;
    photo_url?: string;
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
`;

const ActionButton = styled.button`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.8rem;
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
            rgba(255, 255, 255, 0.3) 50%, 
            transparent 100%);
        transition: left 0.5s ease;
    }
    
    &:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
        
        &::before {
            left: 100%;
        }
    }
    
    &:active {
        transform: translateY(0);
    }
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

const TimeSelector = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--card-background);
    border-radius: var(--radius-lg);
    padding: 20px;
    box-shadow: var(--shadow-lg);
    min-width: 300px;
    border: 1px solid var(--border-color);
    z-index: 1001;
    animation: ${fadeInUp} 0.3s ease-out;
`;

const TimeSelectorTitle = styled.h3`
    margin: 0 0 16px 0;
    color: var(--text-color);
    font-size: 1rem;
    font-weight: 600;
    text-align: center;
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
    gap: 10px;
    cursor: pointer;
    color: var(--text-color);
    font-weight: 500;
    padding: 8px 12px;
    border-radius: var(--radius);
    transition: var(--transition-fast);
    border: 1px solid var(--border-color);
    background: var(--card-background);
    
    &:hover {
        background: var(--primary-transparent);
        border-color: var(--primary-color);
        transform: translateX(2px);
    }
    
    input[type="radio"] {
        accent-color: var(--primary-color);
        width: 14px;
        height: 14px;
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
    
    &:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
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
    const [selectedPermission, setSelectedPermission] = useState<'inventory' | 'writeoff'>('inventory');
    const [selectedDuration, setSelectedDuration] = useState<number>(24); // часы

    const handleGrantPermission = useCallback((userId: number) => {
        setSelectedUserId(userId);
    }, []);

    const handleConfirmGrant = useCallback(() => {
        if (selectedUserId && onGrantPermission) {
            onGrantPermission(selectedUserId, selectedPermission, selectedDuration);
            setSelectedUserId(null);
        }
    }, [selectedUserId, selectedPermission, selectedDuration, onGrantPermission]);

    const handleRevokePermission = useCallback((userId: number, permission: 'inventory' | 'writeoff') => {
        if (onRevokePermission) {
            onRevokePermission(userId, permission);
        }
    }, [onRevokePermission]);

    const handleInviteUser = useCallback(() => {
        try {
            // Проверяем доступность Telegram Web App API
            if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                const webApp = window.Telegram.WebApp as any;
                
                // Проверяем версию API (switchInlineQuery доступен с Bot API 6.7+)
                const isVersionSupported = webApp.isVersionAtLeast && webApp.isVersionAtLeast('6.7');
                
                if (isVersionSupported && typeof webApp.switchInlineQuery === 'function') {
                    // Создаем сообщение-приглашение для inline mode
                    const inviteText = `Присоединяйся к чату "${chatTitle}"! 🎯`;
                    
                    // Используем switchInlineQuery для выбора контактов
                    webApp.switchInlineQuery(inviteText, ['users', 'groups']);
                    
                    console.log('✅ [MembersModal] Открыта нативная шторка выбора контактов Telegram');
                    
                    // Показываем уведомление пользователю
                    if (typeof webApp.showAlert === 'function') {
                        webApp.showAlert('Выберите контакты для отправки приглашения в чат');
                    }
                } else {
                    console.log('⚠️ [MembersModal] switchInlineQuery не поддерживается в данной версии Telegram');
                    // Fallback к старому методу
                    if (onInviteUser) {
                        onInviteUser();
                    }
                }
            } else {
                // Fallback для веб-версии или если API недоступен
                console.log('⚠️ [MembersModal] Telegram Web App API недоступен, используем fallback');
                if (onInviteUser) {
                    onInviteUser();
                }
            }
        } catch (error) {
            console.error('❌ [MembersModal] Ошибка при открытии шторки приглашений:', error);
            // Fallback при ошибке
            if (onInviteUser) {
                onInviteUser();
            }
        }
    }, [chatTitle, onInviteUser]);

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

                                    {/* Кнопки управления правами */}
                                    {isCurrentUserAdmin && !member.isAdmin && member.user_id !== currentUserId && (
                                        <MemberActions>
                                            <ActionButton
                                                onClick={() => handleGrantPermission(member.user_id)}
                                                title="Дать временные права"
                                            >
                                                <Schedule fontSize="inherit" />
                                                Права
                                            </ActionButton>
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
                                    Пригласить участника
                                </InviteButton>
                                <InviteHint>
                                    Выберите контакты для приглашения в бота
                                </InviteHint>
                            </InviteSection>
                        </FixedFooter>
                    )}
                </Content>

                {/* Модальное окно выбора времени */}
                {selectedUserId && (
                    <TimeSelector>
                        <TimeSelectorTitle>Временные права</TimeSelectorTitle>
                        <PermissionSelect>
                            <PermissionLabel>
                                <input
                                    type="radio"
                                    name="permission"
                                    value="inventory"
                                    checked={selectedPermission === 'inventory'}
                                    onChange={() => setSelectedPermission('inventory')}
                                />
                                Инвентаризация
                            </PermissionLabel>
                            <PermissionLabel>
                                <input
                                    type="radio"
                                    name="permission"
                                    value="writeoff"
                                    checked={selectedPermission === 'writeoff'}
                                    onChange={() => setSelectedPermission('writeoff')}
                                />
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
                            <ConfirmButton onClick={handleConfirmGrant}>
                                Подтвердить
                            </ConfirmButton>
                            <CancelButton onClick={() => setSelectedUserId(null)}>
                                Отмена
                            </CancelButton>
                        </TimeActions>
                    </TimeSelector>
                )}
            </DrawerContent>
        </SlidingDrawer>
    );
}; 