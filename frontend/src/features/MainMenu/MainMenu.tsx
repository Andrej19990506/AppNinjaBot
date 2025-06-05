// @ts-nocheck
import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import EventIcon from '@mui/icons-material/Event';
import InventoryIcon from '@mui/icons-material/Inventory';
import DeleteIcon from '@mui/icons-material/Delete';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import styles from './MainMenu.module.css';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { RootState } from '@/shared/store/store';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { fetchInventory, selectInventoryChats, selectInventoryLoading, selectInventoryError } from '@/store/slices/inventorySlice';
import { userSlice } from '@shared/store/userSlice/userSlice';
import { selectActiveRole } from '@shared/store/userSlice/userSelectors';
import { setActiveRole } from '@/shared/store/userSlice/userSlice';
import { clearEvents } from '../../store/slices/eventsSlice';

const chefMenuItems = [
    { id: 'events', title: 'События', path: 'events', icon: EventIcon },
    { id: 'inventory', title: 'Инвентарь', path: 'inventory', icon: InventoryIcon },
    { id: 'write-off', title: 'Списание', path: 'write-off', icon: DeleteIcon },
];

const courierMenuItems = [
    { id: 'events', title: 'События', path: 'events', icon: EventIcon },
    { id: 'courier-schedule', title: 'Записаться', path: 'courier-schedule', icon: EventIcon },
];

// Вариант для общих элементов (заголовок, кнопки, userInfo, переключатель роли)
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
    const { theme, toggleTheme } = useTheme();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state: RootState) => state.user);
    
    // <<< Получаем activeRole ИЗ REDUX >>>
    const activeRole = useAppSelector(selectActiveRole);


    const inventoryChats = useAppSelector(selectInventoryChats);
    const isLoadingInventory = useAppSelector(selectInventoryLoading);
    const inventoryError = useAppSelector(selectInventoryError);
    
    // Проверяем членство в группах
    const isChefMember = useMemo(() => user?.groups?.some(group => group.group_type === "chef") ?? false, [user]);
    const isCourierMember = useMemo(() => user?.groups?.some(group => group.group_type === "courier") ?? false, [user]);
    
    // Определяем начальную роль
    const getInitialRole = useCallback((): 'chef' | 'courier' | 'none' => {
        if (isCourierMember) return 'courier';
        if (isChefMember) return 'chef';
        return 'none';
    }, [isChefMember, isCourierMember]);

    // --- Функция для загрузки инвентаря (если нужно) ---
    const loadInventoryIfNeeded = useCallback(() => {
        // Добавляем проверку: activeRole должна быть 'chef'
        if (activeRole !== 'chef') {
            console.log('[MainMenu] loadInventoryIfNeeded: Пропуск, т.к. activeRole не \'chef\'');
            return;
        }
        
        // Загружаем только если активна роль повара, данных нет и не идет загрузка/нет ошибки
        if (!isLoadingInventory && !inventoryError && inventoryChats.length === 0) {
            // Проверяем, что user существует и имеет ID
            if (user?.id) {
                console.log(`[MainMenu] Вызов fetchInventory(${user.id}, role: ${activeRole}) из loadInventoryIfNeeded...`);
                // Передаем явно 'chef', т.к. мы проверили это выше
                dispatch(fetchInventory({ userId: user.id, role: 'chef' })); 
            } else {
                console.warn('[MainMenu] Попытка вызвать fetchInventory без user.id');
            }
        }
         console.log('[MainMenu] Проверка loadInventoryIfNeeded:', { role: activeRole, isLoading: isLoadingInventory, hasError: !!inventoryError, chatsLength: inventoryChats.length });
    }, [isLoadingInventory, inventoryError, inventoryChats.length, dispatch, activeRole, user?.id]);

    // --- Обновляем роль при инициализации пользователя ---
    useEffect(() => {
        if (user) {
            const initialRole = getInitialRole();
            // <<< Диспатчим начальную роль в Redux >>>
            // Проверяем, что роль в Redux еще не установлена или не совпадает
            // чтобы избежать лишних диспатчей при HMR
            if (activeRole !== initialRole) {
                console.log(`[MainMenu] Dispatching initial role: ${initialRole}`);
                dispatch(userSlice.actions.setActiveRole(initialRole));
            }
            // Убираем вызов loadInventoryIfNeeded отсюда, его будет делать следующий useEffect
        }
    }, [user, getInitialRole, dispatch]); // <<< Добавляем dispatch и activeRole в зависимости

    // --- НОВЫЙ useEffect: Загружаем инвентарь ПРИ ИЗМЕНЕНИИ activeRole на 'chef' ---
    useEffect(() => {
        console.log(`[MainMenu] useEffect[activeRole] сработал. Новая роль: ${activeRole}`);
        if (activeRole === 'chef') {
            loadInventoryIfNeeded();
        }
        // Предыдущий useEffect для инициализации тоже можно убрать, т.к. этот сработает после него.
        // Но для ясности оставим оба.
    }, [activeRole, loadInventoryIfNeeded]); // Зависит от activeRole и loadInventoryIfNeeded

    useEffect(() => {
        if (location.pathname.startsWith('/courier')) {
            dispatch(setActiveRole('courier'));
            dispatch(clearEvents());
        } else if (location.pathname.startsWith('/chef')) {
            dispatch(setActiveRole('chef'));
            dispatch(clearEvents());
        }
    }, [location.pathname, dispatch]);

    // Определяем, какое меню показывать
    const currentMenuItems = useMemo(() => {
        if (activeRole === 'chef') return chefMenuItems;
        if (activeRole === 'courier') return courierMenuItems;
        if (activeRole === 'admin') return adminMenuItems;
        return [];
    }, [activeRole]);
    
    const canToggleRole = isChefMember && isCourierMember;

    // --- Обработчик клика по кнопке роли ---
    const handleRoleButtonClick = (role: 'chef' | 'courier') => {
        navigate(`/${role}`);
        dispatch(setActiveRole(role));
        dispatch(clearEvents());
    };

    // --- Обработчик клика по пункту меню ---
    const handleMenuItemClick = (path: string) => {
        if (!activeRole || activeRole === 'none') return;
        navigate(`/${activeRole}/${path}`);
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
                    // Обертка для случая, когда есть роли
                    <>
                        {/* Блок с информацией о пользователе */}
                        <motion.div className={styles.userInfoContainer} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
                            {user?.photo_url ? (
                                <img src={user.photo_url} alt="User" className={styles.userPhoto} />
                            ) : (
                                <AccountCircleIcon className={styles.userPhotoPlaceholder} />
                            )}
                            <span className={styles.userName}>
                                {user?.first_name || user?.username || 'Пользователь'}
                            </span>
                        </motion.div>

                        {/* Заголовок (для обычного меню) */}
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

                        {/* Переключатель ролей */}
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

                        {/* Сетка меню */}
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

                        {/* Переключатель темы (для обычного меню) */}
                        <motion.div className={styles.themeToggle} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
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
                    </>
                ) : (
                    // Обертка для случая "Нет доступа"
                    <>
                        {/* ---- НОВЫЙ ДИЗАЙН ЭКРАНА "НЕТ ДОСТУПА" ---- */}
                        <motion.div 
                            className={styles.noAccessCard} 
                            variants={noAccessCardVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                         >
                            {/* Информация о пользователе ВНУТРИ карточки */}
                            <motion.div className={styles.userInfoContainer} variants={noAccessContentVariants}>
                                 {user?.photo_url ? (
                                    <img src={user.photo_url} alt="User" className={styles.userPhoto} />
                                ) : (
                                    <AccountCircleIcon className={styles.userPhotoPlaceholder} />
                                )}
                                <span className={styles.userName}>
                                    {user?.first_name || user?.username || 'Пользователь'}
                                </span>
                            </motion.div>
                            
                            {/* Новая иконка с отдельной анимацией */}
                            <motion.div variants={noAccessIconVariants}> 
                                <LockOutlinedIcon className={styles.noAccessIcon} />
                            </motion.div>

                            {/* Текст */}
                            <motion.p className={styles.noAccessText} variants={noAccessContentVariants}>
                                Доступ ограничен
                            </motion.p>
                            <motion.p className={styles.noAccessInfo} variants={noAccessContentVariants}>
                                У вас нет прав для использования функций этого приложения.
                                Пожалуйста, обратитесь к администратору.
                            </motion.p>
                       </motion.div>
                       
                       {/* Переключатель темы (внизу, отдельно от карточки) */}
                       <motion.div 
                           className={styles.themeToggle} 
                           variants={itemVariants} 
                           initial="hidden" animate="visible" exit="exit"
                           style={{ marginTop: 'auto' }} 
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
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default MainMenu; 