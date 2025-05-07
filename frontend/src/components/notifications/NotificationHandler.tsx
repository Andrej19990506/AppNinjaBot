import React from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../../store/hooks';
import { SystemNotification } from './index'; // Импорт из index.ts папки notifications
import { 
    selectAllNotifications, 
    removeNotification 
} from '../../store/slices/notificationSlice';

const NotificationHandler: React.FC = () => {
  const notifications = useSelector(selectAllNotifications);
  const dispatch = useAppDispatch();

  const handleCloseNotification = (id: string) => {
    dispatch(removeNotification(id));
  };



  return (
    <SystemNotification 
      notifications={notifications} // <<< ПЕРЕДАЕМ НЕОТФИЛЬТРОВАННЫЕ УВЕДОМЛЕНИЯ
      onClose={handleCloseNotification} 
    />
  );
};

export default NotificationHandler; 