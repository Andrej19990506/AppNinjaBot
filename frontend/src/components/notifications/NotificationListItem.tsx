import React from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import { format } from 'date-fns';
import styles from './NotificationCenter.module.css';
import { Notification } from '../../store/slices/notificationSlice';

// Define the props interface for the component
interface NotificationListItemProps {
  notification: Notification;
  onClose: () => void;
  onClick?: () => void;
  isSpecial?: boolean;
}

const NotificationListItem: React.FC<NotificationListItemProps> = ({ 
  notification,
  onClose,
  onClick,
  isSpecial = false
}) => {
  // Функция форматирования времени определена непосредственно в компоненте, а не как хук
  const formatTime = (timestamp?: string): string => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return format(date, 'dd.MM.yyyy HH:mm');
    } catch (error) {
      return timestamp;
    }
  };

  // Получаем форматированное время до рендеринга
  const formattedTime = notification.timestamp 
    ? formatTime(notification.timestamp)
    : '';

  // Извлекаем название чата из различных возможных вариантов в payload
  const getChatTitle = (): string | null => {
    const { payload } = notification;
    if (!payload) return null;
    
    // Проверяем разные варианты названия чата в payload
    if (payload.targetChatTitle) return payload.targetChatTitle;
    if (payload.chatTitle) return payload.chatTitle;
    if (payload.chat_title) return payload.chat_title;
    if (payload.chat_name) return payload.chat_name;
    if (payload.room?.title) return payload.room.title;
    
    return null;
  };

  const chatTitle = getChatTitle();

  return (
    <ListItem 
      className={`${styles.notificationItem} ${!notification.read ? styles.unreadNotification : ''} ${isSpecial ? styles.itemSuggestionNotification : ''}`}
      onClick={onClick}
      sx={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <ListItemText
        primary={
          <>
            {notification.title && (
              <Typography
                variant="body1"
                className={`${styles.notificationTitle} ${notification.read ? styles.normal : styles.bold}`}
              >
                {notification.title}
              </Typography>
            )}
            <Typography
              variant="body2"
              className={`${notification.title ? styles.notificationMessage : styles.notificationTitle} ${notification.read ? styles.normal : styles.bold}`}
            >
              {notification.message}
            </Typography>
          </>
        }
        secondary={
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              mt: 0.5 
            }}
          >
            <Typography
              variant="caption"
              className={styles.notificationTime}
            >
              {formattedTime}
            </Typography>
            {chatTitle && (
              <Typography
                variant="caption"
                className={styles.notificationSource}
              >
                {chatTitle}
              </Typography>
            )}
          </Box>
        }
      />
      <IconButton
        size="small"
        className={styles.deleteButton}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Удалить уведомление"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </ListItem>
  );
};

export default NotificationListItem; 