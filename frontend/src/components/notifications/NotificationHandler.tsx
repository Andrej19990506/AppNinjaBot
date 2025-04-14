import React from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../../store/hooks';
import { SystemNotification } from './index'; // Импорт из index.ts папки notifications
import { 
    selectAllNotifications, 
    removeNotification, 
    Notification // Импортируем тип Notification
} from '../../store/slices/notificationSlice';

const NotificationHandler: React.FC = () => {
  const notifications = useSelector(selectAllNotifications);
  const dispatch = useAppDispatch();

  const handleCloseNotification = (id: string) => {
    dispatch(removeNotification(id));
  };

  // Фильтруем уведомления, чтобы показать только тосты и обеспечить наличие ID
  const toastNotifications = notifications.filter(
    (n): n is Notification & { id: string; isToast: true } => typeof n.id === 'string' && n.isToast === true
  );

  return (
    <SystemNotification 
      notifications={toastNotifications}
      onClose={handleCloseNotification} 
    />
  );
};

export default NotificationHandler; 