import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import EventIcon from '@mui/icons-material/Event';
import InventoryIcon from '@mui/icons-material/Inventory';
import DeleteIcon from '@mui/icons-material/Delete';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import styles from './MainMenu.module.css';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { RootState } from '@/shared/store/store';
import { userSlice } from '@shared/store/userSlice/userSlice';
import { selectActiveRole } from '@shared/store/userSlice/userSelectors';
import { setActiveRole } from '@/shared/store/userSlice/userSlice';
import { clearEvents } from '../../store/slices/eventsSlice';
import SideMenuPanel from './SideMenuPanel';

const chefMenuItems = [
    { id: 'events', title: 'События', path: 'events', icon: EventIcon },
    { id: 'inventory', title: 'Инвентарь', path: 'inventory', icon: InventoryIcon },
    { id: 'write-off', title: 'Списание', path: 'write-off', icon: DeleteIcon },
];

const courierMenuItems = [
    { id: 'events', title: 'События', path: 'events', icon: EventIcon },
    { id: 'courier-schedule', title: 'Записаться', path: 'courier-schedule', icon: EventIcon },
];

const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: { duration: 0.3, ease: "easeOut", delay: 0.35 } 
    },
    exit: { 
        opacity: 0, 
        y: -5, 
        scale: 0.95,
        transition: { duration: 0.2, ease: "easeIn" } 
    }
};

// Вариант для основной карточки "Нет доступа"
const noAccessCardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 150,
            damping: 20,
            when: "beforeChildren", // Сначала анимируем карточку
            staggerChildren: 0.1,  // Потом ее содержимое
            delayChildren: 0.1,
            delay: 0.35 // ДОБАВЛЯЕМ ЗАДЕРЖКУ И СЮДА
        }
    },
    exit: {
        opacity: 0,
        scale: 0.9,
        transition: { duration: 0.2 }
    }
};

// Вариант для элементов ВНУТРИ карточки "Нет доступа" (текст)
const noAccessContentVariants = itemVariants; // Используем общие itemVariants для текста

// Отдельный вариант для иконки ВНУТРИ карточки "Нет доступа"
const noAccessIconVariants = {
    hidden: { opacity: 0, scale: 0.7 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { 
            type: "spring", 
            stiffness: 200, 
            damping: 15, 
            delay: 0.1 // Небольшая задержка после появления карточки
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
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state: RootState) => state.user);
    const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
    
    // <<< Получаем activeRole ИЗ REDUX >>>
    const activeRole = useAppSelector(selectActiveRole);

    // Проверяем членство в группах
    const isChefMember = useMemo(() => Array.isArray(user?.groups) && user.groups.some(group => group.group_type === "chef"), [user]);
    const isCourierMember = useMemo(() => Array.isArray(user?.groups) && user.groups.some(group => group.group_type === "courier"), [user]);
    
    // Определяем начальную роль
    const getInitialRole = useCallback((): 'chef' | 'courier' | 'none' => {
        if (Array.isArray(user?.groups)) {
            if (user.groups.length === 1) {
                // Если только одна группа — выбираем её тип
                const onlyType = user.groups[0].group_type;
                if (onlyType === 'chef') return 'chef';
                if (onlyType === 'courier') return 'courier';
            } else {
                // Если есть обе — приоритет chef
                const hasChef = user.groups.some(group => group.group_type === 'chef');
                const hasCourier = user.groups.some(group => group.group_type === 'courier');
                if (hasChef && !hasCourier) return 'chef';
                if (hasCourier && !hasChef) return 'courier';
                if (hasChef && hasCourier) return 'chef'; // или оставить прежнюю логику
            }
        }
        return 'none';
    }, [user]);

    // --- Обновляем роль при инициализации пользователя ---
    useEffect(() => {
        if (user) {
            const initialRole = getInitialRole();
            if (activeRole !== initialRole) {
                dispatch(userSlice.actions.setActiveRole(initialRole));
            }
        }
    }, [user, getInitialRole, dispatch]);

    useEffect(() => {
        if (location.pathname.startsWith('/courier')) {
            dispatch(setActiveRole('courier'));
            dispatch(clearEvents());
        } else if (location.pathname.startsWith('/chef')) {
            dispatch(setActiveRole('chef'));
            dispatch(clearEvents());
        }
    }, [location.pathname, dispatch]);

    const currentMenuItems = useMemo(() => {
        if (activeRole === 'chef') return chefMenuItems;
        if (activeRole === 'courier') return courierMenuItems;
        return [];
    }, [activeRole]);
    
    const canToggleRole = isChefMember && isCourierMember;

    const handleRoleButtonClick = (role: 'chef' | 'courier') => {
        navigate(`/${role}`);
        dispatch(setActiveRole(role));
        dispatch(clearEvents());
    };

    const handleMenuItemClick = (path: string) => {
        if (!activeRole || activeRole === 'none') return;
        navigate(`/${activeRole}/${path}`);
    };

    const handleOpenSideMenu = () => {
        setIsSideMenuOpen(true);
    };

    const handleCloseSideMenu = () => {
        setIsSideMenuOpen(false);
    };



    return (
        <AnimatePresence mode="wait">
            <motion.div 
                className={styles.container} 
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                {activeRole !== 'none' ? (
                    <>
                        <motion.div className={styles.burgerMenuContainer} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
                            <motion.button 
                                className={styles.burgerButton}
                                onClick={handleOpenSideMenu}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <MenuIcon />
                            </motion.button>
                        </motion.div>

                        <motion.h1 
                            className={styles.title}
                            variants={itemVariants} initial="hidden" animate="visible" exit="exit"
                            style={{
                                minWidth: menuPositions.title.width,
                                minHeight: menuPositions.title.height,
                                marginBottom: menuPositions.title.marginBottom
                            }}
                        >
                            Главное меню
                        </motion.h1>

                        {canToggleRole && (
                            <motion.div className={styles.roleToggle} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
                                <motion.div className={styles.roleToggleContainer}>
                                    <motion.button 
                                        className={`${styles.roleButton} ${activeRole === 'chef' ? styles.activeRole : ''}`}
                                        onClick={() => handleRoleButtonClick('chef')}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <RestaurantIcon className={styles.roleIcon} />
                                        <span>Повар</span>
                                    </motion.button>
                                    <motion.button 
                                        className={`${styles.roleButton} ${activeRole === 'courier' ? styles.activeRole : ''}`}
                                        onClick={() => handleRoleButtonClick('courier')}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <DirectionsRunIcon className={styles.roleIcon} />
                                        <span>Курьер</span>
                                    </motion.button>
                                </motion.div>
                            </motion.div>
                        )}

                        <motion.div className={styles.menuGrid} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
                            {currentMenuItems.map((item, index) => {
                                const Icon = item.icon;
                                return (
                                    <motion.div
                                        key={item.id}
                                        className={styles.menuItem}
                                        onClick={() => handleMenuItemClick(item.path)}
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


                    </>
                ) : (
                    <>
                        <motion.div 
                            className={styles.noAccessCard} 
                            variants={noAccessCardVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                         >
                            <motion.div variants={noAccessIconVariants}> 
                                <LockOutlinedIcon className={styles.noAccessIcon} />
                            </motion.div>

                            <motion.p className={styles.noAccessText} variants={noAccessContentVariants}>
                                Доступ ограничен
                            </motion.p>
                            <motion.p className={styles.noAccessInfo} variants={noAccessContentVariants}>
                                У вас нет прав для использования функций этого приложения.
                                Пожалуйста, обратитесь к администратору.
                            </motion.p>
                       </motion.div>
                       
                       <motion.div className={styles.burgerMenuContainer} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
                            <motion.button 
                                className={styles.burgerButton}
                                onClick={handleOpenSideMenu}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <MenuIcon />
                            </motion.button>
                        </motion.div>
                    </>
                )}
            </motion.div>
            
            {/* Боковая панель с бургер меню */}
            <SideMenuPanel 
                isOpen={isSideMenuOpen}
                onClose={handleCloseSideMenu}
            />
        </AnimatePresence>
    );
};

export default MainMenu; 