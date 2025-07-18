import React, { useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import SlidingDrawer from '@shared/components/SlidingDrawer/SlidingDrawer';
import { UserPermissionResponse } from '@shared/api/userPermissionsApi';
import Avatar from '@mui/material/Avatar';
import AccessTime from '@mui/icons-material/AccessTime';
import Inventory from '@mui/icons-material/Inventory';
import Delete from '@mui/icons-material/Delete';
import Event from '@mui/icons-material/Event';
import Close from '@mui/icons-material/Close';
import Security from '@mui/icons-material/Security';
import Add from '@mui/icons-material/Add';

interface UserPermissionsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        user_id: number;
        first_name: string | null;
        last_name?: string | null;
        username?: string | null;
        photo_url?: string | null;
        isAdmin?: boolean;
    };
    permissions: UserPermissionResponse[];
    onRevokePermission: (userId: number, permission: 'inventory' | 'writeoff') => void;
    onAddPermission: (userId: number) => void;
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

const shimmer = keyframes`
    0% {
        background-position: -1000px 0;
    }
    100% {
        background-position: 1000px 0;
    }
`;

// Стили для компонента
const DrawerContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--card-background);
    color: var(--text-color);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    background: linear-gradient(135deg, 
        rgba(var(--primary-rgb), 0.08) 0%, 
        rgba(var(--primary-rgb), 0.04) 100%
    );
`;

const HeaderLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
`;

const UserAvatar = styled(Avatar)`
    width: 56px !important;
    height: 56px !important;
    border: 2px solid var(--primary-color);
    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.2);
`;

const UserInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const UserName = styled.div`
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
`;

const UserRole = styled.div`
    font-size: 14px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
`;

const CloseButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary-color);
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(var(--primary-rgb), 0.2);
        transform: scale(1.05);
    }
`;

const Content = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 24px;
`;

const Title = styled.h3`
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 20px 0;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const PermissionsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const PermissionCard = styled.div`
    background: linear-gradient(135deg, 
        rgba(var(--primary-rgb), 0.05) 0%, 
        rgba(var(--primary-rgb), 0.02) 100%
    );
    border: 1px solid rgba(var(--primary-rgb), 0.1);
    border-radius: var(--radius-lg);
    padding: 20px;
    transition: all 0.3s ease;
    animation: ${fadeInUp} 0.5s ease;
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
            rgba(var(--primary-rgb), 0.1) 50%, 
            transparent 100%
        );
        transition: left 0.6s ease;
    }
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(var(--primary-rgb), 0.15);
        border-color: rgba(var(--primary-rgb), 0.2);
        
        &::before {
            left: 100%;
        }
    }
`;

const PermissionHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
`;

const PermissionType = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
`;

const PermissionIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary-color);
`;

const RevokeButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: var(--radius);
    background: rgba(239, 68, 68, 0.1);
    color: #EF4444;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(239, 68, 68, 0.2);
        transform: translateY(-1px);
    }
`;

const PermissionDetails = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const DetailRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
`;

const DetailLabel = styled.span`
    color: var(--text-secondary);
    font-weight: 500;
`;

const DetailValue = styled.span`
    color: var(--text-color);
    font-weight: 600;
`;

const ExpiryTime = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(var(--primary-rgb), 0.1);
    border: 1px solid rgba(var(--primary-rgb), 0.2);
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 500;
    color: var(--primary-color);
`;

const EmptyState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: var(--text-secondary);
`;

const EmptyIcon = styled.div`
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(var(--primary-rgb), 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    color: var(--primary-color);
`;

const EmptyText = styled.div`
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 8px;
`;

const EmptySubtext = styled.div`
    font-size: 14px;
    opacity: 0.8;
`;

const ActionsSection = styled.div`
    padding: 16px 0;
    border-top: 1px solid var(--border-color);
    margin-top: 16px;
`;

const AddPermissionButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-radius: var(--radius);
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary-color);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(var(--primary-rgb), 0.2);
        transform: translateY(-1px);
    }
    
    &:active {
        transform: translateY(0);
    }
`;

const UserPermissionsDrawer: React.FC<UserPermissionsDrawerProps> = ({
    isOpen,
    onClose,
    user,
    permissions,
    onRevokePermission,
    onAddPermission
}) => {
    // Функция для форматирования времени окончания прав
    const formatExpiryTime = useCallback((expiresAt: string) => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry.getTime() - now.getTime();
        
        if (diff <= 0) {
            return "Истекло";
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `${days}д ${hours}ч ${minutes}м`;
        } else if (hours > 0) {
            return `${hours}ч ${minutes}м`;
        } else {
            return `${minutes}м`;
        }
    }, []);

            // Функция для получения иконки типа доступа
    const getPermissionIcon = useCallback((type: string) => {
        switch (type) {
            case 'inventory':
                return <Inventory fontSize="inherit" />;
            case 'writeoff':
                return <Delete fontSize="inherit" />;
            case 'events':
                return <Event fontSize="inherit" />;
            default:
                return <Security fontSize="inherit" />;
        }
    }, []);

            // Функция для получения названия типа доступа
    const getPermissionTypeLabel = useCallback((type: string) => {
        switch (type) {
            case 'inventory':
                return 'Управление инвентаризацией';
            case 'writeoff':
                return 'Управление списанием';
            case 'events':
                return 'Управление событиями';
            default:
                return type;
        }
    }, []);

    // Функция для получения фото пользователя
    const getUserPhotoUrl = useCallback((user: any): string => {
        if (user.photo_url && user.user_id) {
            const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
            return `${baseURL}/v1/users/${user.user_id}/photo`;
        }
        // Fallback
        const name = user.first_name || user.username || 'Пользователь';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=56&background=FF5F1F&color=fff&bold=true&font-size=0.5`;
    }, []);

    // Функция для получения инициалов
    const getInitials = useCallback((user: any): string => {
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
    }, []);

    if (!isOpen) return null;

    return (
        <SlidingDrawer onClose={onClose}>
            <DrawerContainer>
                <Header>
                    <HeaderLeft>
                        <UserAvatar
                            src={getUserPhotoUrl(user)}
                            alt={user.first_name || ''}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name || 'U')}&size=56&background=FF5F1F&color=fff&bold=true&font-size=0.5`;
                            }}
                        >
                            {!user.photo_url && getInitials(user)}
                        </UserAvatar>
                        <UserInfo>
                            <UserName>
                                {user.first_name || 'Пользователь'} {user.last_name || ''}
                            </UserName>
                            <UserRole>
                                <Security fontSize="inherit" />
                                Временный доступ
                            </UserRole>
                        </UserInfo>
                    </HeaderLeft>
                    <CloseButton onClick={onClose}>
                        <Close fontSize="small" />
                    </CloseButton>
                </Header>

                <Content>
                    <Title>
                        <Security />
                                                        Активный доступ
                    </Title>

                    {permissions.length > 0 ? (
                        <PermissionsList>
                            {permissions.map((permission) => (
                                <PermissionCard key={`${permission.user_id}-${permission.permission_type}`}>
                                    <PermissionHeader>
                                        <PermissionType>
                                            <PermissionIcon>
                                                {getPermissionIcon(permission.permission_type)}
                                            </PermissionIcon>
                                            {getPermissionTypeLabel(permission.permission_type)}
                                        </PermissionType>
                                        <RevokeButton
                                            onClick={() => {
                                                const permissionType = permission.permission_type as 'inventory' | 'writeoff' | 'events';
                                                if (permissionType === 'inventory' || permissionType === 'writeoff') {
                                                    onRevokePermission(user.user_id, permissionType);
                                                }
                                            }}
                                            title="Отозвать доступ"
                                        >
                                            <Delete fontSize="inherit" />
                                            Отозвать
                                        </RevokeButton>
                                    </PermissionHeader>

                                    <PermissionDetails>
                                        <DetailRow>
                                            <DetailLabel>Выдано:</DetailLabel>
                                            <DetailValue>
                                                {new Date(permission.granted_at).toLocaleDateString('ru-RU', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </DetailValue>
                                        </DetailRow>
                                        <DetailRow>
                                            <DetailLabel>Истекает:</DetailLabel>
                                            <ExpiryTime>
                                                <AccessTime fontSize="inherit" />
                                                {formatExpiryTime(permission.expires_at)}
                                            </ExpiryTime>
                                        </DetailRow>
                                    </PermissionDetails>
                                </PermissionCard>
                            ))}
                        </PermissionsList>
                    ) : (
                        <EmptyState>
                            <EmptyIcon>
                                <Security fontSize="large" />
                            </EmptyIcon>
                            <EmptyText>Нет активных прав</EmptyText>
                            <EmptySubtext>У пользователя нет временного доступа</EmptySubtext>
                        </EmptyState>
                    )}
                    
                    <ActionsSection>
                        <AddPermissionButton onClick={() => onAddPermission(user.user_id)}>
                            <Add fontSize="small" />
                            Добавить доступ
                        </AddPermissionButton>
                    </ActionsSection>
                </Content>
            </DrawerContainer>
        </SlidingDrawer>
    );
};

export default UserPermissionsDrawer; 