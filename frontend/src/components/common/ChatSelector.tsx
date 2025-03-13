import React from 'react';
import { useLocation } from 'react-router-dom';
import ChatList from '../Inventory/ChatList';
import { ChatInventory } from '../../types/inventory';
import { WriteOffChat } from '../../types/writeOff';
import { useAppSelector } from '../../store/hooks';

interface ChatSelectorProps {
    chats: ChatInventory[] | WriteOffChat[];
    onChatSelect: (chatId: string, chat: ChatInventory | WriteOffChat) => void;
    onResetInventory?: (chatId: string) => Promise<void>;
    mode?: 'inventory' | 'write-off';
}

const ChatSelector: React.FC<ChatSelectorProps> = ({ 
    chats, 
    onChatSelect, 
    onResetInventory,
    mode: propMode
}) => {
    const location = useLocation();
    const isWriteOffMode = propMode === 'write-off' || location.pathname.startsWith('/write-off');
    const currentUser = useAppSelector((state) => state.inventory.currentUser);

    // Преобразуем данные для ChatList в зависимости от режима
    const modifiedChats = chats.map(chat => ({
        ...chat,
        metadata: {
            ...chat.metadata,
            progress: isWriteOffMode 
                ? 0  // В режиме списания прогресс не нужен
                : chat.metadata.progress  // В режиме инвентаризации используем обычный прогресс
        }
    }));

    return (
        <ChatList
            chats={modifiedChats}
            onChatSelect={onChatSelect}
            onResetInventory={!isWriteOffMode ? onResetInventory : undefined}
            mode={isWriteOffMode ? 'write-off' : 'inventory'}
            title={isWriteOffMode ? 'Выберите чат для списания' : 'Выберите чат для инвентаризации'}
            currentUser={currentUser}
        />
    );
};

export default ChatSelector; 