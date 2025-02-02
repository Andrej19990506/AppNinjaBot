import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts';
import EventIcon from '@mui/icons-material/Event';
import AddIcon from '@mui/icons-material/Add';
import InventoryIcon from '@mui/icons-material/Inventory';
import DeleteIcon from '@mui/icons-material/Delete';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import './MainMenu.css';

const menuItems = [
    { id: 'events', title: 'События', path: '/events', icon: EventIcon },
    { id: 'create', title: 'Создать событие', path: '/create', icon: AddIcon },
    { id: 'inventory', title: 'Инвентарь', path: '/inventory', icon: InventoryIcon },
    { id: 'write-off', title: 'Списание', path: '/write-off', icon: DeleteIcon },
];

const MainMenu = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="container">
            <h1 className="title">NinjaBot Admin</h1>
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
            <button className="themeButton" onClick={toggleTheme}>
                {theme === 'dark' ? (
                    <>
                        <LightModeIcon className="icon" />
                        Светлая тема
                    </>
                ) : (
                    <>
                        <DarkModeIcon className="icon" />
                        Темная тема
                    </>
                )}
            </button>
        </div>
    );
};

export default MainMenu; 