// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import EventIcon from '@mui/icons-material/Event';
import InventoryIcon from '@mui/icons-material/Inventory';
import DeleteIcon from '@mui/icons-material/Delete';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import styles from './MainMenu.module.css';
import { useAppSelector } from '../../store/hooks';
import { RootState } from '../../store/store';

const chefMenuItems = [
    { id: 'events', title: 'События', path: '/events', icon: EventIcon },
    { id: 'inventory', title: 'Инвентарь', path: '/inventory', icon: InventoryIcon },
    { id: 'write-off', title: 'Списание', path: '/write-off', icon: DeleteIcon },
];

const courierMenuItems = [
    { id: 'courier-schedule', title: 'Записаться', path: '/courier-schedule', icon: EventIcon },
];

// Улучшенные варианты анимации с более плавными переходами для интеграции со скелетоном
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.06,
            delayChildren: 0.1,
            when: 'beforeChildren',
            duration: 0.3,
            ease: "easeOut"
        }
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.2,
            ease: "easeIn"
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 5, scale: 0.98 },
    visible: { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: { 
            duration: 0.2,
            ease: "easeOut"
        } 
    },
    exit: { 
        opacity: 0, 
        y: 0, 
        scale: 0.98,
        transition: { 
            duration: 0.2,
            ease: "easeIn"
        } 
    }
};

// Позиции элементов, соответствующие скелетону
const menuPositions = {
    title: {
        width: "180px",
        height: "36px",
        marginBottom: "24px"
    },
    icon: {
        width: "40px",
        height: "40px" 
    },
    text: {
        width: "100px",
        height: "16px"
    },
    button: {
        width: "150px",
        height: "38px"
    }
};

const MainMenu: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isVisible, setIsVisible] = useState(true);
    const { user } = useAppSelector((state: RootState) => state.user);
    
    // Добавляем состояние для переключения между интерфейсами
    const [activeRole, setActiveRole] = useState<'chef' | 'courier'>('chef');

    // Проверяем членство в группах
    const isChefMember = user?.groups?.some(group => group.group_type === "chef") ?? false;
    const isCourierMember = user?.groups?.some(group => group.group_type === "courier") ?? false;
    
    // Если пользователь состоит только в одной группе, устанавливаем соответствующий режим
    useEffect(() => {
        if (isChefMember && !isCourierMember) {
            setActiveRole('chef');
        } else if (isCourierMember && !isChefMember) {
            setActiveRole('courier');
        }
    }, [isChefMember, isCourierMember]);

    // Переключение между режимами работы
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const toggleRole = () => {
        setActiveRole(prev => prev === 'chef' ? 'courier' : 'chef');
    };

    // Определяем, какое меню показывать
    const currentMenuItems = activeRole === 'chef' ? chefMenuItems : courierMenuItems;
    
    // Проверяем, можно ли переключаться между режимами
    const canToggleRole = isChefMember && isCourierMember;

    return (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // @ts-ignore
        <AnimatePresence mode="wait">
            {isVisible && (
                <motion.div 
                    className={styles.container}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <motion.h1 
                        className={styles.title}
                        variants={itemVariants}
                        style={{
                            minWidth: menuPositions.title.width,
                            minHeight: menuPositions.title.height,
                            marginBottom: menuPositions.title.marginBottom
                        }}
                    >
                        Главное меню
                    </motion.h1>
                    
                    {/* Добавляем переключатель ролей, если пользователь может работать в обоих режимах */}
                    {canToggleRole && (
                        <motion.div 
                            className={styles.roleToggle}
                            variants={itemVariants}
                        >
                            <motion.div className={styles.roleToggleContainer}>
                                <motion.button 
                                    className={`${styles.roleButton} ${activeRole === 'chef' ? styles.activeRole : ''}`}
                                    onClick={() => setActiveRole('chef')}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <RestaurantIcon className={styles.roleIcon} />
                                    <span>Повар</span>
                                </motion.button>
                                <motion.button 
                                    className={`${styles.roleButton} ${activeRole === 'courier' ? styles.activeRole : ''}`}
                                    onClick={() => setActiveRole('courier')}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <DirectionsRunIcon className={styles.roleIcon} />
                                    <span>Курьер</span>
                                </motion.button>
                            </motion.div>
                        </motion.div>
                    )}
                    
                    <motion.div className={styles.menuGrid}>
                        {currentMenuItems.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <motion.div
                                    key={item.id}
                                    className={styles.menuItem}
                                    onClick={() => navigate(item.path)}
                                    variants={itemVariants}
                                    whileHover={{ 
                                        scale: 1.03, 
                                        boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
                                        transition: { duration: 0.2 }
                                    }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <motion.div 
                                        className={styles.iconWrapper}
                                        style={{
                                            width: menuPositions.icon.width,
                                            height: menuPositions.icon.height
                                        }}
                                    >
                                        <Icon />
                                    </motion.div>
                                    <motion.span 
                                        className={styles.menuTitle}
                                        style={{
                                            minWidth: menuPositions.text.width,
                                            minHeight: menuPositions.text.height
                                        }}
                                    >
                                        {item.title}
                                    </motion.span>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                    
                    <motion.div 
                        className={styles.themeToggle}
                        variants={itemVariants}
                    >
                        <motion.button 
                            className={styles.themeButton} 
                            onClick={toggleTheme}
                            tabIndex={0}
                            style={{
                                minWidth: menuPositions.button.width,
                                minHeight: menuPositions.button.height
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span className={styles.icon}>
                                {theme === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                            </span>
                            {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
                        </motion.button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default MainMenu; 