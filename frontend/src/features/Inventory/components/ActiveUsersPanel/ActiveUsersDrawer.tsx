import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../store';
import { socketService } from '../../../../shared/services/socketService';
import { ConnectionStatusPanel } from '../../../../shared/components/ConnectionStatusPanel';
import SlidingDrawer from '../../../../shared/components/SlidingDrawer/SlidingDrawer';
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
    connection_state?: 'active' | 'away' | 'disconnected' | 'timeout';
    connection_quality?: 'excellent' | 'good' | 'fair' | 'poor';
    user_activity_state?: 'active' | 'inactive';
    last_user_activity?: number;
}

interface ActiveUsersDrawerProps {
    chatId: string;
}

export const ActiveUsersDrawer: React.FC<ActiveUsersDrawerProps> = ({ chatId }) => {
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showConnectionStatus, setShowConnectionStatus] = useState(false);

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
                    joinedAt: new Date().toISOString(),
                    connection_state: data.connection_state || 'active',
                    connection_quality: data.connection_quality || 'good',
                    user_activity_state: data.user_activity_state || 'active',
                    last_user_activity: data.last_user_activity || Date.now()
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
                    joinedAt: user.joinedAt || new Date().toISOString(),
                    connection_state: user.connection_state || 'active',
                    connection_quality: user.connection_quality || 'good',
                    user_activity_state: user.user_activity_state || 'active',
                    last_user_activity: user.last_user_activity || Date.now()
                }));
                setActiveUsers(users);
                setIsLoading(false);
                console.log(`✅ [ACTIVE USERS DRAWER] Установлено ${users.length} пользователей`);
            }
        };

        // Функция для обработки обновления активности пользователя
        const handleUserActivityUpdate = (data: any) => {
            console.log(`🔔 [ACTIVE USERS DRAWER] Получено событие user_activity_update:`, data);
            
            if (data.room === `inventory_${chatId}` || data.room?.includes(`inventory_${chatId}`)) {
                const userId = data.user_id || data.userId;
                const activityState = data.activity_state || data.user_activity_state || 'active';
                const userName = data.first_name || data.user_info?.first_name || userId;
                

                setActiveUsers(prev => prev.map(user => {
                    if (user.userId === userId) {
                        // Проверяем, изменилось ли состояние активности
                        if (user.user_activity_state === activityState) {
                            // Состояние не изменилось, обновляем только время
                            return {
                                ...user,
                                last_user_activity: data.timestamp ? new Date(data.timestamp).getTime() : Date.now()
                            };
                        } else {
                            // Состояние изменилось, обновляем все
                            return {
                                ...user,
                                user_activity_state: activityState,
                                last_user_activity: data.timestamp ? new Date(data.timestamp).getTime() : Date.now()
                            };
                        }
                    }
                    return user;
                }));
            }
        };

        // Подписываемся на события
        const unsubscribeUserJoined = socketService.subscribe('user_joined_room', handleUserJoined);
        const unsubscribeUserLeft = socketService.subscribe('user_left_room', handleUserLeft);  
        const unsubscribeRoomUsers = socketService.subscribe('room_users_list', handleRoomUsers);
        const unsubscribeUserActivity = socketService.onUserActivityUpdate(handleUserActivityUpdate);

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
            unsubscribeUserActivity();
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

    const getConnectionStateColor = (user: ActiveUser) => {
        // Приоритет: сначала проверяем активность пользователя, потом техническое соединение
        if (user.user_activity_state === 'inactive') {
            return '#FF9800'; // Оранжевый для "отошел"
        }
        
        switch (user.connection_state) {
            case 'active':
                return '#4CAF50';
            case 'away':
                return '#FF9800';
            case 'timeout':
                return '#F44336';
            case 'disconnected':
                return '#9E9E9E';
            default:
                return '#757575';
        }
    };

    const getConnectionStateText = (user: ActiveUser) => {
        // Приоритет: сначала проверяем активность пользователя, потом техническое соединение
        if (user.user_activity_state === 'inactive') {
            return 'Отошел';
        }
        
        switch (user.connection_state) {
            case 'active':
                return 'Активен';
            case 'away':
                return 'Неактивен';
            case 'timeout':
                return 'Таймаут';
            case 'disconnected':
                return 'Отключен';
            default:
                return 'Неизвестно';
        }
    };

    const getConnectionStateIcon = (state: string) => {
        switch (state) {
            case 'active':
                return (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <circle cx="4" cy="4" r="3" fill="currentColor"/>
                    </svg>
                );
            case 'away':
                return (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <circle cx="4" cy="4" r="3" fill="currentColor"/>
                    </svg>
                );
            case 'timeout':
                return (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <circle cx="4" cy="4" r="3" fill="currentColor"/>
                    </svg>
                );
            case 'disconnected':
                return (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <circle cx="4" cy="4" r="3" fill="currentColor"/>
                    </svg>
                );
            default:
                return (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <circle cx="4" cy="4" r="3" fill="currentColor"/>
                    </svg>
                );
        }
    };

    const handleConnectionStatusClick = () => {
        setShowConnectionStatus(true);
    };

    const handleCloseConnectionStatus = () => {
        setShowConnectionStatus(false);
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

            {/* Контент */}
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
                                
                                <div className={styles.userActions}>
                                    <button
                                        className={styles.connectionStatusButton}
                                        onClick={handleConnectionStatusClick}
                                        style={{
                                            backgroundColor: getConnectionStateColor(user),
                                            color: 'white'
                                        }}
                                    >
                                        <span className={styles.statusIcon}>
                                            {getConnectionStateIcon(user.connection_state || 'active')}
                                        </span>
                                        <span className={styles.statusText}>
                                            {getConnectionStateText(user)}
                                        </span>
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* SlidingDrawer с состоянием подключения */}
            {showConnectionStatus && (
                <SlidingDrawer onClose={handleCloseConnectionStatus}>
                    <ConnectionStatusPanel />
                </SlidingDrawer>
            )}
        </div>
    );
}; 