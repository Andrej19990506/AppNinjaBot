import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import EventIcon from '@mui/icons-material/Event';
import InventoryIcon from '@mui/icons-material/Inventory';
import DeleteIcon from '@mui/icons-material/Delete';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ChatIcon from '@mui/icons-material/Chat';
import styles from './MainMenu.module.css';

const menuItems = [
    { id: 'chats', title: 'Чаты', path: '/chats', icon: ChatIcon },
    { id: 'events', title: 'События', path: '/events', icon: EventIcon },
    { id: 'inventory', title: 'Инвентарь', path: '/inventory', icon: InventoryIcon },
    { id: 'write-off', title: 'Списание', path: '/write-off', icon: DeleteIcon },
];

const MainMenu: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Главное меню</h1>
            <div className={styles.menuGrid}>
                {menuItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <motion.div
                            key={item.id}
                            className={styles.menuItem}
                            onClick={() => navigate(item.path)}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className={styles.iconWrapper}>
                                <Icon />
                            </div>
                            <span className={styles.menuTitle}>{item.title}</span>
                        </motion.div>
                    );
                })}
            </div>
            
            <motion.div 
                className={styles.themeToggle}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
            >
                <button className={styles.themeButton} onClick={toggleTheme}>
                    <span className={styles.icon}>
                        {theme === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                    </span>
                    {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
                </button>
            </motion.div>
        </div>
    );
};

export default MainMenu; 