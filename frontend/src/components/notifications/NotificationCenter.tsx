import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { removeNotification, markAsRead, Notification, NotificationTypes, showToastNotification } from '../../store/slices/notificationSlice';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import ItemSuggestionNotification from './ItemSuggestionNotification';
import CloseIcon from '@mui/icons-material/Close';
import { format } from 'date-fns';
import styles from './NotificationCenter.module.css';
import NotificationListItem from './NotificationListItem';
import SuggestionStatusNotification from './SuggestionStatusNotification';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import Slider from '@mui/material/Slider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';

// Определение типа для дубликатов
interface DuplicateSuggestion {
    id?: string;
    key: string;
    timestamp?: string;
}

const NotificationCenter: React.FC = () => {
    const dispatch = useAppDispatch();
    const notifications = useAppSelector(state => state.notification.items || []);
    // Ссылка на аудио-элемент для воспроизведения звука уведомления
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    // Состояние для настроек звука
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
    const [soundVolume, setSoundVolume] = useState<number>(0.7);
    
    // Фильтруем уведомления, чтобы избежать дубликатов
    const filteredNotifications = useMemo(() => {
        // Сначала отфильтровываем toast-уведомления
        const nonToastNotifications = notifications.filter(n => !n.isToast);
        
        // Создаем Map для отслеживания уникальных уведомлений по их содержимому
        const uniqueNotifications = new Map();
        
        // Для каждого уведомления создаем уникальный ключ на основе его содержимого
        nonToastNotifications.forEach(notification => {
            // Для уведомлений статуса предложения товара используем комбинацию targetChatId, itemName и status
            if (notification.type === NotificationTypes.SUGGESTION_STATUS && notification.payload?.type === 'suggestion_status') {
                const key = `${notification.payload.targetChatId}-${notification.payload.itemName}-${notification.payload.status}`;
                
                // Если уведомление с таким ключом уже есть, сохраняем только самое новое
                if (!uniqueNotifications.has(key) || 
                    new Date(notification.timestamp || '') > new Date(uniqueNotifications.get(key).timestamp || '')) {
                    uniqueNotifications.set(key, notification);
                }
            } else {
                // Для других типов уведомлений используем их ID
                uniqueNotifications.set(notification.id, notification);
            }
        });
        
        // Преобразуем Map обратно в массив
        return Array.from(uniqueNotifications.values());
    }, [notifications]);
    
    // Считаем только непрочитанные уведомления
    const unreadCount = filteredNotifications.filter(n => !n.read).length;
    
    // Отслеживаем временные toast-уведомления
    const toastNotifications = notifications.filter(n => n.isToast);
    
    // Находим непринятые предложения о добавлении товаров
    const pendingItemSuggestions = filteredNotifications.filter(
        n => n.payload?.type === 'item_suggestion' && 
            // Добавляем проверку наличия необходимых полей для предложения товара
            n.payload?.item && n.payload?.source
    );
    
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [currentNotification, setCurrentNotification] = useState<string | null>(null);
    const [inventoryLoaded, setInventoryLoaded] = useState(false);
    const open = Boolean(anchorEl);
    
    // Обработка всплывающих уведомлений
    const [toastState, setToastState] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'info' | 'warning' | 'error';
        autoHideDuration: number;
        currentNotificationId: string | null;
    }>({
        open: false,
        message: '',
        severity: 'info',
        autoHideDuration: 5000,
        currentNotificationId: null
    });
    
    // Функция для воспроизведения звука уведомления
    const playNotificationSound = () => {
        try {
            // Если звук отключен, не воспроизводим его
            if (!soundEnabled) {
                console.log('Звук уведомлений отключен пользователем');
                return;
            }
            
            if (!audioRef.current) {
                audioRef.current = new Audio('/sounds/notification.mp3');
            }
            
            // Устанавливаем громкость
            audioRef.current.volume = soundVolume;
            
            // Перезапустить звук, если он уже играет
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            
            // Воспроизведение звука
            const playPromise = audioRef.current.play();
            
            // Обработка ошибок воспроизведения (часто возникают из-за политик браузеров)
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Не удалось воспроизвести звук уведомления:', error);
                });
            }
        } catch (error) {
            console.error('Ошибка при воспроизведении звука:', error);
        }
    };

    // Обработка всплывающих уведомлений
    useEffect(() => {
        console.log('🔄 useEffect для toast-уведомлений запущен', {
            toastNotificationsCount: toastNotifications.length,
            currentToastId: toastState.currentNotificationId
        });

        if (toastNotifications.length > 0) {
            // Берем первое toast-уведомление
            const notification = toastNotifications[0];
            
            // Проверяем валидность уведомления
            if (!notification || !notification.id) {
                console.error('❌ Получено невалидное toast-уведомление', notification);
                return;
            }
            
            // Проверяем, не показывается ли уже это уведомление
            if (toastState.currentNotificationId === notification.id) {
                console.log('⏩ Пропускаем повторную обработку уведомления с ID:', notification.id);
                return; // Пропускаем, если это то же самое уведомление
            }
            
            // Воспроизводим звук при появлении нового уведомления
            playNotificationSound();
            
            // Логируем новое toast-уведомление для отладки
            console.log('🪂 Показываем новое toast-уведомление:', {
                id: notification.id,
                type: notification.type,
                title: notification.title || 'Без заголовка',
                message: notification.message
            });
            
            // Определяем тип уведомления для Alert
            let severity: 'success' | 'info' | 'warning' | 'error' = 'info';
            switch (notification.type) {
                case NotificationTypes.SUCCESS:
                    severity = 'success';
                    break;
                case NotificationTypes.WARNING:
                    severity = 'warning';
                    break;
                case NotificationTypes.ERROR:
                    severity = 'error';
                    break;
                default:
                    severity = 'info';
            }
            
            // Используем autoHideDuration из уведомления или значение по умолчанию
            const autoHideDuration = notification.autoHideDuration || notification.duration || 5000;
            
            // Улучшаем отображение уведомления, добавляя заголовок если он есть
            let messageText = notification.message;
            if (notification.title && !messageText.includes(notification.title)) {
                messageText = `${notification.title}: ${messageText}`;
            }
            
            // Если есть информация о чате, добавляем ее
            if (notification.payload) {
                const chatTitle = 
                    notification.payload.targetChatTitle || 
                    notification.payload.chatTitle || 
                    notification.payload.chat_title || 
                    notification.payload.chat_name;
                
                if (chatTitle && !messageText.includes(chatTitle)) {
                    messageText = messageText.includes('в чат') 
                        ? messageText 
                        : `${messageText} в чат "${chatTitle}"`;
                }
            }
            
            // Устанавливаем состояние для отображения toast
            setToastState({
                open: true,
                message: messageText,
                severity,
                autoHideDuration,
                currentNotificationId: notification.id
            });
        }
    }, [toastNotifications, toastState.currentNotificationId]);

    // Обновляем обработку загрузки уведомлений
    useEffect(() => {
        // Проверяем, было ли уже показано уведомление в текущей сессии
        if (!inventoryLoaded && pendingItemSuggestions.length > 0) {
            console.log('📱 Найдены непринятые предложения товаров:', pendingItemSuggestions.length);
            
            // Логируем все предложения для отладки
            pendingItemSuggestions.forEach((suggestion, index) => {
                const item = suggestion.payload?.item;
                console.log(`📋 Предложение #${index+1}:`, {
                    id: suggestion.id,
                    category: item?.category,
                    itemId: item?.itemId,
                    timestamp: suggestion.timestamp,
                    source: suggestion.payload?.source?.chatTitle
                });
            });
            
            // Проверяем и удаляем дубликаты предложений
            const itemKeys = new Map<string, Notification>(); // Ключ -> самое новое уведомление
            const duplicates: DuplicateSuggestion[] = [];
            
            // Сначала находим все дубликаты и определяем, какие оставить (самые новые)
            pendingItemSuggestions.forEach(suggestion => {
                if (suggestion.payload?.item) {
                    const { category, itemId } = suggestion.payload.item;
                    const key = `${category}:${itemId}`;
                    
                    if (itemKeys.has(key)) {
                        // Сравниваем даты и оставляем более новое
                        const existingSuggestion = itemKeys.get(key)!;
                        const existingTime = existingSuggestion.timestamp 
                            ? new Date(existingSuggestion.timestamp).getTime() 
                            : 0;
                        const currentTime = suggestion.timestamp 
                            ? new Date(suggestion.timestamp).getTime() 
                            : 0;
                        
                        if (currentTime > existingTime) {
                            // Новое уведомление свежее, помечаем старое как дубликат
                            duplicates.push({
                                id: existingSuggestion.id,
                                key,
                                timestamp: existingSuggestion.timestamp
                            });
                            // Обновляем Map новым уведомлением
                            itemKeys.set(key, suggestion);
                        } else {
                            // Текущее уведомление старее, оно дубликат
                            duplicates.push({
                                id: suggestion.id,
                                key,
                                timestamp: suggestion.timestamp
                            });
                        }
                    } else {
                        // Первое уведомление для этого товара
                        itemKeys.set(key, suggestion);
                    }
                }
            });
            
            // Удаляем найденные дубликаты
            if (duplicates.length > 0) {
                console.warn('⚠️ Обнаружены и будут удалены дубликаты предложений:', duplicates);
                
                // Удаляем дубликаты из хранилища
                duplicates.forEach(duplicate => {
                    if (duplicate.id) {
                        dispatch(removeNotification(duplicate.id));
                    }
                });
            }
            
            // Отмечаем, что инвентаризация загружена
            setInventoryLoaded(true);
            
            // Получаем актуальный список после удаления дубликатов
            const updatedPendingItemSuggestions = filteredNotifications.filter(
                n => n.payload?.type === 'item_suggestion'
            );
            
            if (updatedPendingItemSuggestions.length > 0) {
                // Задержка чтобы дать приложению полностью загрузиться
                setTimeout(() => {
                    // Показываем самое старое (первое) непринятое предложение товара
                    const oldestSuggestion = updatedPendingItemSuggestions[0];
                    console.log('📣 Показываем предложение товара:', oldestSuggestion);
                    setCurrentNotification(oldestSuggestion.id as string);
                    
                    // Воспроизводим звук уведомления
                    playNotificationSound();
                }, 1000);
            }
        }
    }, [inventoryLoaded, pendingItemSuggestions, dispatch, notifications, filteredNotifications]);

    // Автоматически удаляем ТОЛЬКО прочитанные стандартные уведомления (не предложения товаров)
    useEffect(() => {
        // Фильтруем уведомления, которые можно автоматически удалить
        // Предложения о добавлении товаров НЕ удаляем автоматически
        const readNotificationsToRemove = filteredNotifications.filter(n => 
            n.read && 
            (!n.payload || n.payload.type !== 'item_suggestion')
        );
        
        if (readNotificationsToRemove.length > 0) {
            const timers = readNotificationsToRemove.map(notification => {
                return setTimeout(() => {
                    if (notification.id) {
                        dispatch(removeNotification(notification.id));
                    }
                }, 30000); // Удаляем через 30 секунд после прочтения
            });
            
            return () => timers.forEach(timer => clearTimeout(timer));
        }
    }, [filteredNotifications, dispatch]);

    // Обработчик открытия меню уведомлений
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
        
        // Демонстрационное воспроизведение звука при клике (чтобы разблокировать аудио)
        // Некоторые браузеры требуют взаимодействия пользователя для воспроизведения звука
        playNotificationSound();
    };

    // Обработчик закрытия меню уведомлений
    const handleClose = () => {
        setAnchorEl(null);
    };

    // Отдельная функция для закрытия определенного уведомления
    const handleCloseNotification = (notificationId?: string) => {
        if (notificationId) {
            dispatch(removeNotification(notificationId));
        }
    };

    // Обработчик выбора уведомления
    const handleNotificationClick = (notificationId: string) => {
        const notification = filteredNotifications.find((n: Notification) => n.id === notificationId);
        
        if (!notification) {
            console.error('🔴 Не найдено уведомление с ID:', notificationId);
            return;
        }
        
        // Добавляем полное логирование для отладки
        console.log('📣 Обработка клика по уведомлению:', {
            id: notification.id,
            type: notification.type,
            payloadType: notification.payload?.type,
            hasItem: !!notification.payload?.item,
            hasSource: !!notification.payload?.source,
            complete: !!(notification.payload?.type === 'item_suggestion' && 
                       notification.payload?.item?.itemId && 
                       notification.payload?.source?.userName)
        });
        
        // Для уведомлений типа item_suggestion добавим более подробную информацию
        if (notification.payload?.type === 'item_suggestion') {
            console.log('🔍 Данные предложения товара:', {
                itemId: notification.payload?.item?.itemId || 'ОТСУТСТВУЕТ',
                category: notification.payload?.item?.category || 'ОТСУТСТВУЕТ',
                userName: notification.payload?.source?.userName || 'ОТСУТСТВУЕТ',
                chatTitle: notification.payload?.source?.chatTitle || 'ОТСУТСТВУЕТ'
            });
        }
        
        // Если это предложение добавить товар и оно содержит все необходимые данные, показываем диалог
        if (notification.payload?.type === 'item_suggestion' && 
            notification.payload.item?.itemId && 
            notification.payload.item?.category && 
            notification.payload.source?.userName && 
            notification.payload.source?.chatTitle) {
            
            console.log('✅ Открываем диалог с предложением товара:', notification);
            setCurrentNotification(notificationId);
        } else if (notification.payload?.type === 'item_suggestion') {
            console.warn('⚠️ Неполное предложение товара:', notification);
            // Показать toast с объяснением
            dispatch(showToastNotification(
                NotificationTypes.WARNING, 
                'Невозможно отобразить предложение товара из-за отсутствия необходимых данных'
            ));
            
            // Не открываем диалог для неполных предложений
            setCurrentNotification(null);
        } else {
            console.log('ℹ️ Обычное уведомление, не требует специальной обработки');
            // Просто оставляем это как обычное уведомление
            setCurrentNotification(null);
        }
        
        // Отмечаем уведомление как прочитанное
        dispatch(markAsRead(notificationId));
        
        // Закрываем меню
        handleClose();
    };

    // Обработчик закрытия диалога предложения
    const handleDialogClose = () => {
        setCurrentNotification(null);
    };

    const handleToastClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        
        setToastState(prev => ({
            ...prev,
            open: false
        }));
        
        // Удаляем уведомление из хранилища
        if (toastState.currentNotificationId) {
            // Задержка, чтобы анимация закрытия успела проиграться
            setTimeout(() => {
                dispatch(removeNotification(toastState.currentNotificationId as string));
            }, 300);
        }
    };

    // Форматирование даты уведомления для лучшего отображения
    const formatNotificationTime = (timestamp: string): string => {
        try {
            const date = new Date(timestamp);
            return format(date, 'dd.MM.yyyy HH:mm');
        } catch (error) {
            return timestamp;
        }
    };

    // В методе renderNotification добавим обработку для уведомлений о статусе предложения товара
    const renderNotification = (notification: Notification) => {
        // Проверяем валидность уведомления
        if (!notification || !notification.id) {
            console.error('🔴 Попытка отрендерить невалидное уведомление:', notification);
            return null;
        }
        
        try {
            // Логируем тип уведомления для отладки
            console.log(`🔍 Рендер уведомления (id: ${notification.id.substring(0, 15)}...)`, {
                type: notification.type,
                payloadType: notification.payload?.type,
                hasItem: !!notification.payload?.item,
                hasSource: !!notification.payload?.source
            });
            
            // Проверяем, является ли уведомление статусом предложения товара
            if (notification.type === NotificationTypes.SUGGESTION_STATUS && 
                notification.payload?.status) {
                
                console.log('📝 Рендер уведомления статуса предложения:', {
                    status: notification.payload.status,
                    targetChatTitle: notification.payload.targetChatTitle,
                    itemName: notification.payload.itemName
                });
                
                return (
                    <SuggestionStatusNotification
                        key={notification.id}
                        id={notification.id || ''}
                        type={notification.type}
                        message={notification.message}
                        createdAt={notification.timestamp || new Date().toISOString()}
                        payload={notification.payload}
                    />
                );
            }
            
            // Проверяем, является ли уведомление предложением товара с полными данными
            if (notification.payload?.type === 'item_suggestion') {
                // Проверяем наличие всех необходимых данных для отображения
                const hasAllData = !!(notification.payload?.item?.itemId && 
                                      notification.payload?.source?.userName);
                                      
                if (hasAllData) {
                    // Это полноценное предложение товара, показываем специальный компонент
                    return (
                        <NotificationListItem
                            key={notification.id}
                            notification={notification}
                            onClose={() => handleCloseNotification(notification.id)}
                            onClick={() => handleNotificationClick(notification.id || '')}
                            isSpecial={true}
                        />
                    );
                } else {
                    // Неполное предложение товара, отображаем как обычное уведомление
                    console.warn('⚠️ Отображаем неполное предложение товара как обычное уведомление:', notification.id);
                    return (
                        <NotificationListItem
                            key={notification.id}
                            notification={notification}
                            onClose={() => handleCloseNotification(notification.id)}
                            onClick={() => handleNotificationClick(notification.id || '')}
                            isSpecial={false}
                        />
                    );
                }
            }

            // Для всех остальных уведомлений используем стандартный компонент
            return (
                <NotificationListItem
                    key={notification.id}
                    notification={notification}
                    onClose={() => handleCloseNotification(notification.id)}
                    onClick={() => handleNotificationClick(notification.id || '')}
                />
            );
        } catch (error) {
            console.error('🔴 Ошибка при рендеринге уведомления:', error, notification);
            // В случае ошибки возвращаем безопасную версию уведомления
            return (
                <NotificationListItem
                    key={notification.id || `error-${Math.random()}`}
                    notification={{
                        ...notification,
                        message: notification.message || 'Произошла ошибка отображения уведомления'
                    }}
                    onClose={() => handleCloseNotification(notification.id)}
                />
            );
        }
    };

    // Используем отфильтрованные уведомления для отображения
    const hasNotifications = filteredNotifications.length > 0;

    return (
        <div className={styles.notificationCenter}>
            {/* Кнопка уведомлений */}
            <Tooltip title={unreadCount > 0 ? `${unreadCount} новых уведомлений` : "Уведомления"}>
                <Badge 
                    badgeContent={unreadCount} 
                    color="error" 
                    className={styles.notificationBadge}
                >
                    <IconButton 
                        aria-label="Уведомления" 
                        onClick={handleClick}
                        id="notifications-button"
                        aria-controls={open ? 'notifications-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={open ? 'true' : undefined}
                        color="inherit"
                    >
                        {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
                    </IconButton>
                </Badge>
            </Tooltip>

            {/* Меню уведомлений */}
            <Menu
                id="notifications-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'notifications-button',
                    className: styles.notificationList
                }}
                PaperProps={{
                    className: styles.notificationMenu
                }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                {/* Настройки звука */}
                <div className={styles.soundSettings}>
                    <Typography variant="subtitle2" gutterBottom>
                        Настройки звука
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={soundEnabled}
                                onChange={(e) => setSoundEnabled(e.target.checked)}
                                name="soundEnabled"
                                color="primary"
                            />
                        }
                        label="Звуковые уведомления"
                    />
                    <div className={styles.volumeControl}>
                        <IconButton 
                            onClick={() => setSoundEnabled(!soundEnabled)} 
                            size="small"
                        >
                            {!soundEnabled ? <VolumeOffIcon /> : 
                             soundVolume < 0.3 ? <VolumeDownIcon /> : <VolumeUpIcon />}
                        </IconButton>
                        <Slider
                            value={soundVolume}
                            onChange={(_, value) => setSoundVolume(value as number)}
                            disabled={!soundEnabled}
                            min={0}
                            max={1}
                            step={0.1}
                            aria-labelledby="sound-volume-slider"
                        />
                    </div>
                    <Button 
                        variant="outlined" 
                        size="small" 
                        onClick={playNotificationSound}
                        disabled={!soundEnabled}
                        className={styles.testSoundButton}
                    >
                        Тест звука
                    </Button>
                </div>
                
                <Divider />
                
                {/* Список уведомлений */}
                {filteredNotifications.length === 0 ? (
                    <MenuItem disabled className={styles.emptyMessage}>
                        <Typography variant="body2">У вас пока нет уведомлений</Typography>
                    </MenuItem>
                ) : (
                    <List className={styles.notificationList}>
                        {filteredNotifications.map((notification: Notification) => (
                            <React.Fragment key={notification.id}>
                                {notification.type === NotificationTypes.SUGGESTION_STATUS ? (
                                    <SuggestionStatusNotification
                                        id={notification.id || ''}
                                        type={notification.type}
                                        message={notification.message}
                                        createdAt={notification.timestamp || new Date().toISOString()}
                                        payload={notification.payload}
                                    />
                                ) : (
                                    <>
                                        <ListItem 
                                            button
                                            onClick={() => handleNotificationClick(notification.id as string)}
                                            className={`${styles.notificationItem} ${!notification.read ? styles.unreadNotification : ''} ${notification.payload?.type === 'item_suggestion' ? styles.itemSuggestionNotification : ''}`}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Typography
                                                        variant="body2"
                                                        className={`${styles.notificationTitle} ${notification.read ? styles.normal : styles.bold}`}
                                                    >
                                                        {notification.message}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography
                                                        variant="caption"
                                                        className={styles.notificationTime}
                                                    >
                                                        {notification.timestamp && formatNotificationTime(notification.timestamp)}
                                                    </Typography>
                                                }
                                            />
                                            {/* Показываем кнопку удаления только для НЕ предложений товаров */}
                                            {(!notification.payload || notification.payload.type !== 'item_suggestion') && (
                                                <IconButton
                                                    size="small"
                                                    className={styles.deleteButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        dispatch(removeNotification(notification.id as string));
                                                    }}
                                                    aria-label="Удалить уведомление"
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </ListItem>
                                        <Divider component="li" />
                                    </>
                                )}
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </Menu>

            {/* Toast-уведомления */}
            <Snackbar
                open={toastState.open}
                autoHideDuration={toastState.autoHideDuration}
                onClose={handleToastClose}
                className={styles.toast}
            >
                <Alert 
                    onClose={handleToastClose} 
                    severity={toastState.severity}
                    className={`${styles.toast} ${
                        toastState.severity === 'success' ? styles.toastSuccess :
                        toastState.severity === 'warning' ? styles.toastWarning :
                        toastState.severity === 'error' ? styles.toastError :
                        styles.toastInfo
                    }`}
                >
                    {toastState.message}
                </Alert>
            </Snackbar>

            {/* Отображаем диалог с предложением товара, если он активен */}
            {currentNotification && (() => {
                const notification = filteredNotifications.find((n: Notification) => n.id === currentNotification);
                if (!notification) {
                    console.error('❌ Не найдено уведомление с ID:', currentNotification);
                    // Автоматически закрываем диалог, так как уведомление не найдено
                    setTimeout(handleDialogClose, 0);
                    return null;
                }
                
                // Проверяем, что уведомление действительно является предложением товара и содержит все необходимые данные
                if (!notification.payload || 
                    notification.payload.type !== 'item_suggestion' || 
                    !notification.payload.source || 
                    !notification.payload.source.userName || 
                    !notification.payload.source.chatTitle || 
                    !notification.payload.item || 
                    !notification.payload.item.itemId || 
                    !notification.payload.item.category) {
                    
                    console.error('❌ Уведомление не содержит необходимые данные для отображения диалога:', {
                        id: notification.id,
                        payloadType: notification.payload?.type || 'ОТСУТСТВУЕТ',
                        hasItem: !!notification.payload?.item,
                        hasItemId: !!notification.payload?.item?.itemId,
                        hasCategory: !!notification.payload?.item?.category,
                        hasSource: !!notification.payload?.source,
                        hasUserName: !!notification.payload?.source?.userName,
                        hasChatTitle: !!notification.payload?.source?.chatTitle
                    });
                    
                    // Показываем предупреждение и закрываем диалог
                    dispatch(showToastNotification(
                        NotificationTypes.WARNING, 
                        'Невозможно отобразить предложение товара из-за отсутствия данных'
                    ));
                    
                    // Закрываем диалог автоматически 
                    setTimeout(handleDialogClose, 0);
                    return null;
                }
                
                // Если все проверки пройдены, показываем диалог с предложением
                console.log('📦 Отображаем диалог с предложением товара:', {
                    от: notification.payload.source.userName,
                    чат: notification.payload.source.chatTitle,
                    товар: `${notification.payload.item.category}:${notification.payload.item.itemId}`
                });
                
                return (
                    <ItemSuggestionNotification
                        notification={notification}
                        onClose={handleDialogClose}
                    />
                );
            })()}
        </div>
    );
};

export default NotificationCenter; 