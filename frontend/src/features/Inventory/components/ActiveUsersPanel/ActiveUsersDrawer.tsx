import React, { useState, useEffect } from 'react';
import { socketService } from '@shared/services/socketService';
import styles from './ActiveUsersDrawer.module.css';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { motion } from 'framer-motion';

interface ActiveUser {
    userId: string;
    first_name: string;
    last_name?: string;
    photo_url?: string;
    joinedAt: string;
}

interface ActiveUsersDrawerProps {
    chatId: string;
}

export const ActiveUsersDrawer: React.FC<ActiveUsersDrawerProps> = ({ chatId }) => {
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!chatId) return;

        console.log(`🔍 [ACTIVE USERS DRAWER] Инициализация для chatId: ${chatId}`);
        console.log(`🔍 [ACTIVE USERS DRAWER] SocketService состояние:`, {
            isInitialized: socketService.isInitialized(),
            isConnected: socketService.isConnected(),
            socketId: socketService.getSocket()?.id
        });

        // Функция для обработки события присоединения пользователя
        const handleUserJoined = (data: any) => {
            console.log(`👤 [ACTIVE USERS DRAWER] Пользователь присоединился:`, data);
            
            if (data.room === `inventory_${chatId}`) {
                const newUser: ActiveUser = {
                    userId: data.userId,
                    first_name: data.first_name || 'Пользователь',
                    last_name: data.last_name,
                    photo_url: data.photo_url,
                    joinedAt: new Date().toISOString()
                };

                setActiveUsers(prev => {
                    // Проверяем что пользователь еще не в списке
                    if (prev.find(user => user.userId === data.userId)) {
                        return prev;
                    }
                    return [...prev, newUser];
                });
            }
        };

        // Функция для обработки события выхода пользователя  
        const handleUserLeft = (data: any) => {
            console.log(`👤 [ACTIVE USERS DRAWER] Пользователь покинул:`, data);
            
            if (data.room === `inventory_${chatId}`) {
                setActiveUsers(prev => prev.filter(user => user.userId !== data.userId));
            }
        };

        // Функция для получения списка активных пользователей комнаты
        const handleRoomUsers = (data: any) => {
            console.log(`👥 [ACTIVE USERS DRAWER] Список пользователей комнаты:`, data);
            
            if (data.room === `inventory_${chatId}`) {
                const users: ActiveUser[] = data.users.map((user: any) => ({
                    userId: user.userId,
                    first_name: user.first_name || 'Пользователь',
                    last_name: user.last_name,
                    photo_url: user.photo_url,
                    joinedAt: user.joinedAt || new Date().toISOString()
                }));
                setActiveUsers(users);
                setIsLoading(false);
                console.log(`✅ [ACTIVE USERS DRAWER] Установлено ${users.length} пользователей`);
            }
        };

        // Подписываемся на события
        const unsubscribeUserJoined = socketService.subscribe('user_joined_room', handleUserJoined);
        const unsubscribeUserLeft = socketService.subscribe('user_left_room', handleUserLeft);  
        const unsubscribeRoomUsers = socketService.subscribe('room_users_list', handleRoomUsers);

        // Запрашиваем текущий список пользователей комнаты
        console.log(`📡 [ACTIVE USERS DRAWER] Отправляем запрос get_room_users для комнаты: inventory_${chatId}`);
        socketService.emit('get_room_users', { room: `inventory_${chatId}` });

        // Таймаут для отключения загрузки если сервер не ответил
        const timeout = setTimeout(() => {
            console.log(`⏰ [ACTIVE USERS DRAWER] Таймаут получения списка пользователей`);
            setIsLoading(false);
        }, 3000);

        return () => {
            console.log(`🧹 [ACTIVE USERS DRAWER] Очистка useEffect для chatId: ${chatId}`);
            unsubscribeUserJoined();
            unsubscribeUserLeft();
            unsubscribeRoomUsers();
            clearTimeout(timeout);
        };
    }, [chatId]);

    const formatUserName = (user: ActiveUser) => {
        const fullName = user.last_name 
            ? `${user.first_name} ${user.last_name}`
            : user.first_name;
        return fullName;
    };

    const formatJoinTime = (joinedAt: string) => {
        let time: Date;
        
        // Обработка разных форматов timestamp
        if (joinedAt.includes('.') && !joinedAt.includes('-') && !joinedAt.includes('T')) {
            // Unix timestamp в секундах (например '1700000000.123')
            const timestamp = parseFloat(joinedAt) * 1000; // Конвертируем в миллисекунды
            time = new Date(timestamp);
        } else {
            // Обычная ISO строка
            time = new Date(joinedAt);
        }
        
        // Проверяем валидность даты
        if (isNaN(time.getTime())) {
            return 'только что'; // Fallback для невалидных дат
        }
        
        const now = new Date();
        const diffMs = now.getTime() - time.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин назад`;
        
        // Показываем время в красноярском часовом поясе (UTC+7)
        return time.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Krasnoyarsk' // Красноярское время UTC+7
        });
    };

    const getUserPhotoUrl = (user: ActiveUser): string => {
        // Используем API endpoint как в других компонентах
        if (user.photo_url && user.userId) {
            const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
            return `${baseURL}/v1/users/${user.userId}/photo`;
        }
        // Fallback на ui-avatars
        const name = user.first_name || 'Пользователь';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=48&background=FF5F1F&color=fff&bold=true&font-size=0.5`;
    };



    return (
        <div className={styles.container}>
            {/* Заголовок */}
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <PeopleIcon className={styles.headerIcon} />
                    <h2 className={styles.title}>
                        Работают с инвентаризацией
                    </h2>
                </div>
                <div className={styles.counterBadge}>
                    {activeUsers.length}
                </div>
            </div>

            {/* Список пользователей */}
            <div className={styles.content}>
                {isLoading ? (
                    <div className={styles.loadingContainer}>
                        <div className={styles.loadingSpinner} />
                        <p className={styles.loadingText}>Загружаем список пользователей...</p>
                    </div>
                ) : activeUsers.length === 0 ? (
                    <div className={styles.emptyContainer}>
                        <PeopleIcon className={styles.emptyIcon} />
                        <p className={styles.emptyTitle}>Никого нет</p>
                        <p className={styles.emptySubtitle}>
                            Сейчас никто не работает с инвентарем
                        </p>
                    </div>
                ) : (
                    <div className={styles.usersList}>
                        {activeUsers.map((user, index) => (
                            <motion.div
                                key={user.userId}
                                className={styles.userItem}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <div className={styles.userAvatar}>
                                    {user.photo_url ? (
                                        <img 
                                            src={getUserPhotoUrl(user)} 
                                            alt={formatUserName(user)}
                                            className={styles.userPhoto}
                                            onError={(e) => {
                                                // При ошибке API endpoint используем fallback
                                                const target = e.target as HTMLImageElement;
                                                target.onerror = null;
                                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&size=48&background=FF5F1F&color=fff&bold=true&font-size=0.5`;
                                            }}
                                        />
                                    ) : (
                                        <span className={styles.userInitial}>
                                            {user.first_name.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                    <div className={styles.onlineIndicator} />
                                </div>
                                
                                <div className={styles.userInfo}>
                                    <div className={styles.userName}>
                                        {formatUserName(user)}
                                    </div>
                                    <div className={styles.userStatus}>
                                        <AccessTimeIcon className={styles.timeIcon} />
                                        <span className={styles.joinTime}>
                                            {formatJoinTime(user.joinedAt)}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className={styles.statusBadge}>
                                    Онлайн
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}; 