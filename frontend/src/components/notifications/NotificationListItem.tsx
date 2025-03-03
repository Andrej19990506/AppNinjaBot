import React from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { format } from 'date-fns';
import styles from './NotificationCenter.module.css';
import { Notification } from '../../store/slices/notificationSlice';

// Define the props interface for the component
interface NotificationListItemProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationListItem: React.FC<NotificationListItemProps> = ({ 
  notification,
  onClose
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

  return (
    <ListItem 
      className={`${styles.notificationItem} ${!notification.read ? styles.unreadNotification : ''}`}
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
            {formattedTime}
            {notification.payload?.targetChatTitle && (
              <span className={styles.notificationSource}>
                {` • ${notification.payload.targetChatTitle}`}
              </span>
            )}
          </Typography>
        }
      />
      <IconButton
        size="small"
        className={styles.deleteButton}
        onClick={onClose}
        aria-label="Удалить уведомление"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </ListItem>
  );
};

export default NotificationListItem; 