import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../store/hooks';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import { removeNotification } from '../../store/slices/notificationSlice';
import styles from './NotificationCenter.module.css';
import { format } from 'date-fns';

interface SuggestionStatusNotificationProps {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  payload?: {
    status?: 'pending' | 'accepted' | 'rejected' | 'error';
    targetChatId?: string | number;
    targetChatTitle?: string;
    suggestionId?: string;
    itemName?: string;
    category?: string;
    animated?: boolean;
    recipientsCount?: number;
  };
}

const SuggestionStatusNotification: React.FC<SuggestionStatusNotificationProps> = ({
  id,
  type,
  message,
  createdAt,
  payload,
}) => {
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected' | 'error'>('pending');
  const [showAnimation, setShowAnimation] = useState(true);

  // Проверка наличия необходимых данных
  if (!payload) {
    console.warn('SuggestionStatusNotification: payload отсутствует', { id, type, message });
    return (
      <Paper elevation={3} sx={{ p: 2, mb: 1, width: '100%' }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Typography variant="subtitle1" fontWeight="bold">
            Информация о статусе недоступна
          </Typography>
          <IconButton size="small" onClick={() => dispatch(removeNotification(id))} edge="end">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="body2">{message || 'Нет доступной информации'}</Typography>
      </Paper>
    );
  }

  // Update status based on payload
  useEffect(() => {
    if (payload?.status) {
      setStatus(payload.status);
      if (payload.status !== 'pending') {
        setShowAnimation(false);
      }
    }
  }, [payload]);

  // Handle animation for pending status
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (status === 'pending' && payload?.animated) {
      timer = setInterval(() => {
        setShowAnimation((prev) => !prev);
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status, payload?.animated]);

  // Format the timestamp
  const formattedTime = (() => {
    try {
      const date = new Date(createdAt);
      return format(date, 'dd.MM.yyyy HH:mm');
    } catch (error) {
      return createdAt;
    }
  })();

  // Handle close action
  const handleClose = () => {
    dispatch(removeNotification(id));
  };

  // Render status icon based on current status
  const renderStatusIcon = () => {
    switch (status) {
      case 'accepted':
        return <CheckCircleIcon color="success" />;
      case 'rejected':
        return <CancelIcon color="error" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'pending':
      default:
        return (
          <HourglassEmptyIcon
            className={showAnimation && payload?.animated ? styles.hourglassIcon : ''}
            color="warning"
          />
        );
    }
  };

  // Получить статусное сообщение в зависимости от состояния
  const getStatusMessage = () => {
    switch (status) {
      case 'accepted': return 'Предложение принято';
      case 'rejected': return 'Предложение отклонено';
      case 'error': return 'Ошибка при обработке предложения';
      case 'pending':
      default: return 'Ожидание подтверждения';
    }
  };

  return (
    <Paper
      className={`${styles.suggestionStatusNotification} ${styles[status]}`}
      elevation={3}
      sx={{ p: 2, mb: 1, width: '100%' }}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
          <Box className={status === 'pending' && payload?.animated ? styles.pendingIcon : ''} sx={{ mr: 1 }}>
            {renderStatusIcon()}
          </Box>
          <Typography variant="subtitle1" fontWeight="bold">
            {getStatusMessage()}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} edge="end">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Typography variant="body2" sx={{ mb: 1 }}>
        {message}
      </Typography>

      {payload?.itemName && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Товар: <strong>{payload.itemName}</strong>
        </Typography>
      )}

      {payload?.category && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Категория: <strong>{payload.category}</strong>
        </Typography>
      )}

      {payload?.targetChatTitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Получатель: <strong>{payload.targetChatTitle}</strong>
        </Typography>
      )}

      {!payload?.targetChatTitle && payload?.recipientsCount !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Отправлено: <strong>{payload.recipientsCount === 1 ? '1 пользователю' : `${payload.recipientsCount} пользователям`}</strong>
        </Typography>
      )}

      <Typography variant="caption" color="text.secondary">
        {formattedTime}
      </Typography>
    </Paper>
  );
};

export default SuggestionStatusNotification; 