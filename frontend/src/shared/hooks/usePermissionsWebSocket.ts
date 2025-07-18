import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@shared/store/store';
import { socketService } from '@shared/services/socketService';
import { logger } from '@shared/utils/logger';

interface PermissionsNotification {
  user_id: number;
  group_id: number;
  notification_type: 'revoked_by_admin' | 'expired_automatically';
  message: string;
  timestamp: string;
}

export const usePermissionsWebSocket = () => {
  const currentUser = useSelector((state: RootState) => state.user.user);
  const currentUserId = currentUser?.id;
  const [permissionsNotification, setPermissionsNotification] = useState<PermissionsNotification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;

    const handlePermissionsChanged = (data: PermissionsNotification) => {
      logger.log('📝 Получено уведомление об изменении прав:', data);
      
      // Проверяем что уведомление для текущего пользователя
      if (data.user_id === currentUserId) {
        setPermissionsNotification(data);
        setIsModalOpen(true);
      }
    };

    // Подписываемся на уведомления о правах
    const unsubscribe = socketService.subscribe('permissions_changed', handlePermissionsChanged);
    
    logger.log('📡 Подписка на уведомления о правах активна');

    return () => {
      unsubscribe();
      logger.log('📡 Отписка от уведомлений о правах');
    };
  }, [currentUserId]);

  const handleModalClose = () => {
    setIsModalOpen(false);
    setPermissionsNotification(null);
  };

  return {
    isModalOpen,
    permissionsNotification,
    handleModalClose
  };
}; 