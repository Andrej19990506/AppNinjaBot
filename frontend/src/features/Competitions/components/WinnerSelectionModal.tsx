import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import { axiosInstance } from '@/shared/api/api';

interface Group {
    id: number;
    title: string;
    chat_id: number;
    group_type: string;
    branch_name?: string;
    member_count?: number;
}

interface GroupMember {
    id: number;
    user_id: number;
    user_name: string;
    user_position: string;
    user_department: string;
    role: string;
    photo_url?: string;
}

interface WinnerSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    competitionId: number;
    onWinnerSelected: (winner: any) => void;
}

const ModalOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
`;

const ModalContent = styled(motion.div)`
    background: var(--card-background);
    border-radius: var(--radius);
    padding: 24px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
`;

const Title = styled.h2`
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    
    &:hover {
        background: var(--background-light);
        color: var(--text-color);
    }
`;

const Content = styled.div`
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;
`;

const SelectionType = styled.div`
    margin-bottom: 24px;
`;

const SelectionTypeTitle = styled.h3`
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 12px;
`;

const SelectionTypeDescription = styled.p`
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
`;

const GroupList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const GroupItem = styled.div<{ isSelected: boolean; isExpanded: boolean }>`
    border: 1px solid ${props => props.isSelected ? 'var(--primary-color)' : 'var(--border-color)'};
    border-radius: var(--radius);
    padding: 16px;
    cursor: pointer;
    transition: all var(--transition-fast);
    background: ${props => props.isSelected ? 'var(--primary-transparent)' : 'var(--card-background)'};
    
    &:hover {
        border-color: var(--primary-color);
        background: var(--primary-transparent);
    }
`;

const GroupHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const GroupInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const GroupIconWrapper = styled.div`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary-transparent);
    color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
`;

const GroupDetails = styled.div`
    flex: 1;
`;

const GroupName = styled.div`
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 4px;
`;

const GroupMeta = styled.div`
    font-size: 12px;
    color: var(--text-secondary);
`;

const ExpandButton = styled.button`
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    
    &:hover {
        background: var(--background-light);
        color: var(--text-color);
    }
`;

const MembersList = styled(motion.div)`
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
`;

const MemberItem = styled.div<{ isSelected: boolean }>`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    background: ${props => props.isSelected ? 'var(--success-transparent)' : 'transparent'};
    border: 1px solid ${props => props.isSelected ? 'var(--success-color)' : 'transparent'};
    
    &:hover {
        background: var(--background-light);
    }
`;

const MemberAvatar = styled.div<{ hasPhoto: boolean }>`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${props => props.hasPhoto ? 'transparent' : 'var(--primary-transparent)'};
    color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    overflow: hidden;
    
    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
`;

const MemberInfo = styled.div`
    flex: 1;
`;

const MemberName = styled.div`
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 2px;
`;

const MemberPosition = styled.div`
    font-size: 12px;
    color: var(--text-secondary);
`;

const MemberRole = styled.div`
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--background-light);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
`;

const Footer = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
    padding: 10px 20px;
    border-radius: var(--radius);
    border: 1px solid ${props => props.variant === 'primary' ? 'var(--primary-color)' : 'var(--border-color)'};
    background: ${props => props.variant === 'primary' ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.variant === 'primary' ? 'var(--text-color-on-primary)' : 'var(--text-color)'};
    cursor: pointer;
    font-weight: 500;
    transition: all var(--transition-fast);
    
    &:hover {
        background: ${props => props.variant === 'primary' ? 'var(--primary-hover)' : 'var(--background-light)'};
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const LoadingSpinner = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: var(--text-secondary);
`;

const WinnerSelectionModal: React.FC<WinnerSelectionModalProps> = ({
    isOpen,
    onClose,
    competitionId,
    onWinnerSelected
}) => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [groupMembers, setGroupMembers] = useState<Record<number, GroupMember[]>>({});
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchGroupsAndMembers();
        }
    }, [isOpen]);

    const fetchGroupsAndMembers = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/v1/groups');
            const groupsData = response.data.groups || response.data || [];
            setGroups(groupsData);

            // Загружаем участников для всех групп сразу
            const membersPromises = groupsData.map(async (group: Group) => {
                try {
                    const membersResponse = await axiosInstance.get(`/v1/groups/${group.chat_id}/members`);
                    return {
                        groupId: group.id,
                        members: membersResponse.data.members || membersResponse.data || []
                    };
                } catch (error) {
                    console.error(`Ошибка при загрузке участников группы ${group.id}:`, error);
                    return {
                        groupId: group.id,
                        members: []
                    };
                }
            });

            const membersResults = await Promise.all(membersPromises);
            const membersMap: Record<number, GroupMember[]> = {};
            membersResults.forEach(result => {
                membersMap[result.groupId] = result.members;
            });
            setGroupMembers(membersMap);
        } catch (error) {
            console.error('Ошибка при загрузке групп:', error);
        } finally {
            setLoading(false);
        }
    };



    const toggleGroupExpansion = (groupId: number) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedGroups(newExpanded);
    };

    const handleGroupSelect = (group: Group) => {
        setSelectedGroup(group);
        setSelectedMember(null);
    };

    const handleMemberSelect = (member: GroupMember) => {
        setSelectedMember(member);
        setSelectedGroup(null);
    };

    const handleConfirm = () => {
        const winner = selectedGroup || selectedMember;
        if (winner) {
            onWinnerSelected({
                type: selectedGroup ? 'group' : 'member',
                data: winner
            });
            onClose();
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getPhotoUrl = (member: GroupMember): string => {
        if (member.photo_url && member.user_id) {
            const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
            return `${baseURL}/v1/users/${member.user_id}/photo`;
        }
        // Fallback с инициалами
        const name = member.user_name || 'U';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=32&background=FF5F1F&color=fff&bold=true&font-size=0.5`;
    };

    const isGroupExpanded = (groupId: number) => expandedGroups.has(groupId);
    const isGroupSelected = (group: Group) => selectedGroup?.id === group.id;
    const isMemberSelected = (member: GroupMember) => selectedMember?.id === member.id;
    const canConfirm = selectedGroup || selectedMember;

    return (
        <AnimatePresence>
            {isOpen && (
                <ModalOverlay
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <ModalContent
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Header>
                            <Title>Выбор победителя</Title>
                            <CloseButton onClick={onClose}>
                                <CloseIcon />
                            </CloseButton>
                        </Header>

                        <Content>
                            <SelectionType>
                                <SelectionTypeTitle>Выберите победителя</SelectionTypeTitle>
                                <SelectionTypeDescription>
                                    Вы можете выбрать целый филиал как победителя или конкретного участника из группы.
                                </SelectionTypeDescription>
                            </SelectionType>

                            {loading ? (
                                <LoadingSpinner>Загрузка групп...</LoadingSpinner>
                            ) : (
                                <GroupList>
                                    {groups.map(group => (
                                        <GroupItem
                                            key={group.id}
                                            isSelected={isGroupSelected(group)}
                                            isExpanded={isGroupExpanded(group.id)}
                                            onClick={() => handleGroupSelect(group)}
                                        >
                                            <GroupHeader>
                                                <GroupInfo>
                                                    <GroupIconWrapper>
                                                        <GroupIcon />
                                                    </GroupIconWrapper>
                                                    <GroupDetails>
                                                        <GroupName>{group.title}</GroupName>
                                                        <GroupMeta>
                                                            {group.branch_name && `${group.branch_name} • `}
                                                            ID: {group.chat_id}
                                                            {group.member_count && ` • ${group.member_count} участников`}
                                                        </GroupMeta>
                                                    </GroupDetails>
                                                </GroupInfo>
                                                <ExpandButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleGroupExpansion(group.id);
                                                    }}
                                                >
                                                    {isGroupExpanded(group.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </ExpandButton>
                                            </GroupHeader>

                                            {isGroupExpanded(group.id) && (
                                                <MembersList
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                >
                                                    {groupMembers[group.id]?.map((member, index) => (
                                                        <motion.div
                                                            key={member.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: index * 0.05 }}
                                                        >
                                                            <MemberItem
                                                                isSelected={isMemberSelected(member)}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMemberSelect(member);
                                                                }}
                                                            >
                                                            <MemberAvatar hasPhoto={true}>
                                                                <img 
                                                                    src={getPhotoUrl(member)} 
                                                                    alt={member.user_name}
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        target.onerror = null;
                                                                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user_name)}&size=32&background=FF5F1F&color=fff&bold=true&font-size=0.5`;
                                                                    }}
                                                                />
                                                            </MemberAvatar>
                                                            <MemberInfo>
                                                                <MemberName>{member.user_name}</MemberName>
                                                                <MemberPosition>{member.user_position}</MemberPosition>
                                                            </MemberInfo>
                                                            <MemberRole>{member.role}</MemberRole>
                                                        </MemberItem>
                                                        </motion.div>
                                                    ))}
                                                </MembersList>
                                            )}
                                        </GroupItem>
                                    ))}
                                </GroupList>
                            )}
                        </Content>

                        <Footer>
                            <Button onClick={onClose}>
                                Отмена
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleConfirm}
                                disabled={!canConfirm}
                            >
                                Выбрать победителя
                            </Button>
                        </Footer>
                    </ModalContent>
                </ModalOverlay>
            )}
        </AnimatePresence>
    );
};

export default WinnerSelectionModal; 