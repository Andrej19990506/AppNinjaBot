import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ChatDialog.module.css';
import config from '../config';

const ChatDialog = ({ chat, onClose, onStartInventory, onMainMenu }) => {
    const [adminPhotos, setAdminPhotos] = useState({});
    const [isPhotosSwapped, setIsPhotosSwapped] = useState(false);
    const [clickedAdminId, setClickedAdminId] = useState(null);
    const webApp = config.TELEGRAM_WEB_APP;
    const currentUser = webApp?.initDataUnsafe?.user;
    const userId = currentUser?.id;
    
    const isAdmin = chat.admins?.some(admin => Number(admin.user_id) === userId);

    const activeAdmins = useMemo(() => {
        if (!chat.admins) return [];
        return [...chat.admins]
            .filter(admin => !admin.is_bot)
            .sort((a, b) => (b.activity_score || 0) - (a.activity_score || 0))
            .slice(0, 2);
    }, [chat.admins]);

    useEffect(() => {
        const loadPhotos = async () => {
            const photos = {};
            for (const admin of activeAdmins) {
                if (admin.photo_url) {
                    try {
                        // Убираем начальный слеш и 'api/' из URL, если они есть
                        const photoPath = admin.photo_url
                            .replace(/^\//, '')  // Убираем начальный слеш
                            .replace(/^api\//, '');  // Убираем 'api/' если есть
                        
                        // Формируем полный URL с правильным путем
                        photos[admin.user_id] = `${config.API_URL}/photo/${photoPath}`;
                    } catch (error) {
                        console.error('Error loading photo:', error);
                    }
                }
            }
            setAdminPhotos(photos);
        };
        
        loadPhotos();
    }, [activeAdmins]);

    const handleAdminClick = async (admin) => {
        setClickedAdminId(admin.user_id);
        
        // Ждем завершения анимации
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            if (admin.username) {
                // Если есть username, открываем чат по нему
                window.Telegram.WebApp.openLink(`https://t.me/${admin.username}`);
            } else if (admin.phone) {
                // Если есть телефон, открываем чат по номеру
                window.Telegram.WebApp.openLink(`https://t.me/+${admin.phone}`);
            } else {
                // Если нет ни username, ни телефона, показываем уведомление
                window.Telegram.WebApp.showPopup({
                    title: 'Невозможно открыть чат',
                    message: `К сожалению, администратор ${admin.first_name} скрыл свои контактные данные. Попробуйте найти его самостоятельно в Telegram.`,
                    buttons: [{
                        type: 'close',
                        text: 'Понятно'
                    }]
                });
            }
        } catch (error) {
            console.error('Error opening chat:', error);
        }
        
        // Сбрасываем состояние через небольшую задержку
        setTimeout(() => {
            setClickedAdminId(null);
        }, 100);
    };

    const handleSwapPhotos = () => {
        setIsPhotosSwapped(prev => !prev);
    };

    const getFallbackPhotoUrl = (admin) => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.first_name)}&background=FF5F1F&color=fff&size=200&bold=true&font-size=0.5`;
    };

    return (
        <motion.div 
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div 
                className={styles.dialog}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={e => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <h2>{chat.name}</h2>
                </div>

                {!isAdmin ? (
                    <motion.div className={styles.fadeIn}>
                        <div className={styles.noAccessMessage}>
                            <svg 
                                className={styles.lockIcon}
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M12 1C8.676 1 6 3.676 6 7v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
                            </svg>
                            У вас нет доступа в этом чате
                        </div>
                        <div className={styles.adminHint}>
                            Обратитесь к одному из активных администраторов чата:
                        </div>
                        <div 
                            className={styles.adminPhotosContainer} 
                            data-swapped={isPhotosSwapped}
                            onClick={handleSwapPhotos}
                        >
                            <AnimatePresence>
                                {activeAdmins.map((admin, index) => (
                                    <motion.div 
                                        key={admin.user_id} 
                                        className={`${styles.adminPhoto} ${clickedAdminId === admin.user_id ? styles.clicked : ''}`}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ 
                                            scale: clickedAdminId === admin.user_id ? 1.1 : 1, 
                                            opacity: 1,
                                            x: isPhotosSwapped ? (index === 0 ? 25 : -25) : (index === 0 ? -25 : 25),
                                            y: isPhotosSwapped ? (index === 0 ? 10 : -10) : (index === 0 ? -10 : 10),
                                            zIndex: clickedAdminId === admin.user_id ? 10 : (isPhotosSwapped ? (index === 0 ? 0 : 1) : (index === 0 ? 1 : 0))
                                        }}
                                        transition={{ duration: 0.3 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAdminClick(admin);
                                        }}
                                    >
                                        <img
                                            src={adminPhotos[admin.user_id] || getFallbackPhotoUrl(admin)}
                                            alt={admin.first_name}
                                            onError={(e) => {
                                                e.target.src = getFallbackPhotoUrl(admin);
                                            }}
                                        />
                                        <div className={styles.adminName}>{admin.first_name}</div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                        <motion.button 
                            className={styles.mainMenuButton}
                            onClick={onMainMenu}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Главное меню
                        </motion.button>
                    </motion.div>
                ) : (
                    <motion.div className={styles.fadeIn}>
                        <div className={styles.welcomeContainer}>
                            <div className={styles.adminPhotoContainer}>
                                <img
                                    src={adminPhotos[userId] || getFallbackPhotoUrl(currentUser)}
                                    alt={currentUser?.first_name}
                                    className={styles.adminPhoto}
                                    onError={(e) => {
                                        e.target.src = getFallbackPhotoUrl(currentUser);
                                    }}
                                />
                            </div>
                            <div className={styles.welcomeMessage}>
                                <h3>Добро пожаловать!</h3>
                                <p>Вы можете начать инвентаризацию</p>
                            </div>
                        </div>
                        <motion.button 
                            className={styles.inventoryButton} 
                            onClick={onStartInventory}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Приступить к инвентаризации
                        </motion.button>
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default ChatDialog; 