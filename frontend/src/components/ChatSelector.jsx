import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ChatSelector.module.css';
import ChatDialog from './ChatDialog';

const ChatSelector = ({ chats, onSelect, isLoading }) => {
    const [selectedChat, setSelectedChat] = useState(null);
    
    if (isLoading) {
        return <div className={styles.loading}>Загрузка списка чатов...</div>;
    }

    if (!Array.isArray(chats)) {
        console.error('Chats is not an array:', chats);
        return <div className={styles.error}>Ошибка загрузки чатов</div>;
    }

    if (chats.length === 0) {
        return <div className={styles.empty}>Нет доступных чатов</div>;
    }

    const handleChatClick = (chat) => {
        console.log('handleChatClick chat:', chat);
        setSelectedChat(chat);
    };

    const handleClose = () => {
        setSelectedChat(null);
    };

    const handleStartInventory = (chat) => {
        console.log('handleStartInventory chat:', chat);
        onSelect(chat);
        setSelectedChat(null);
    };

    const handleMainMenu = () => {
        setSelectedChat(null);
    };

    return (
        <>
            <div className={styles.container}>
                <h2 className={styles.title}>Выберите чат для инвентаризации</h2>
                <div className={styles.chatList}>
                    {chats.map((chat, index) => {
                        if (!chat || !chat.name) {
                            console.error('Invalid chat data:', chat);
                            return null;
                        }
                        return (
                            <motion.div
                                key={chat.id}
                                className={styles.chatItem}
                                onClick={() => handleChatClick(chat)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <h3>{chat.name}</h3>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
            
            <AnimatePresence>
                {selectedChat && (
                    <ChatDialog
                        chat={selectedChat}
                        onClose={handleClose}
                        onStartInventory={() => handleStartInventory(selectedChat)}
                        onMainMenu={handleMainMenu}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default ChatSelector; 