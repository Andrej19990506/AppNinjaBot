import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts';
import EventIcon from '@mui/icons-material/Event';
import InventoryIcon from '@mui/icons-material/Inventory';
import DeleteIcon from '@mui/icons-material/Delete';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import './MainMenu.css';

const menuItems = [
    { id: 'events', title: 'События', path: '/events', icon: EventIcon },
    { id: 'inventory', title: 'Инвентарь', path: '/inventory', icon: InventoryIcon },
    { id: 'write-off', title: 'Списание', path: '/write-off', icon: DeleteIcon },
];

const MainMenu = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="container">
            <h1 className="title">Главное меню</h1>
            <div className="menuGrid">
                {menuItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <motion.div
                            key={item.id}
                            className="menuItem"
                            onClick={() => navigate(item.path)}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className="iconWrapper">
                                <Icon />
                            </div>
                            <span className="menuTitle">{item.title}</span>
                        </motion.div>
                    );
                })}
            </div>
            
            <motion.div 
                className="themeToggle"
                onClick={toggleTheme}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
            >
                {theme === 'dark' ? (
                    <motion.div
                        className="themeIcon"
                        initial={{ rotate: -30 }}
                        animate={{ rotate: 0 }}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <LightModeIcon />
                    </motion.div>
                ) : (
                    <motion.div
                        className="themeIcon"
                        initial={{ rotate: 30 }}
                        animate={{ rotate: 0 }}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <DarkModeIcon />
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default MainMenu; 