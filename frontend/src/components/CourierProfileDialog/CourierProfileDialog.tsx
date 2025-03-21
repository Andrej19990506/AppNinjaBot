import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { styled } from '@mui/material/styles';
import { addNotification, NotificationTypes } from '../../store/slices/notificationSlice';
import { fetchShifts } from '../../store/slices/shiftsSlice';
import { api } from '../../services/api';
import axios from 'axios';
import { updateSeniorCourierStatus } from '../../store/slices/userSlice';

interface CourierProfileDialogProps {
  open: boolean;
  onClose: () => void;
  courierId: number;
  courierName: string;
  courierAvatar?: string;
  chatId?: string;
  isSeniorCourier?: boolean;
}

const ProfileAvatar = styled('img')({
  width: 120,
  height: 120,
  borderRadius: '50%',
  objectFit: 'cover',
  marginBottom: 16,
  border: '3px solid var(--primary-color)',
  boxShadow: 'var(--shadow-md)',
});

const SeniorCourierBadge = styled('div')({
  position: 'absolute',
  top: -8,
  right: -8,
  background: 'var(--primary-color)',
  color: 'white',
  fontSize: 12,
  fontWeight: 500,
  padding: '4px 8px',
  borderRadius: 12,
  boxShadow: 'var(--shadow-md)',
  zIndex: 5,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  '&::before': {
    content: '"⭐"',
    fontSize: 10,
  }
});

const ActionButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'actionType'
})<{ actionType: 'promote' | 'demote' }>(({ actionType }) => ({
  margin: '8px 0',
  backgroundColor: actionType === 'promote' ? 'var(--success-color)' : 'var(--error-color)',
  color: 'white',
  '&:hover': {
    backgroundColor: actionType === 'promote' ? '#2ea266' : '#d32f2f',
  },
}));

const StyledDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    backgroundColor: 'var(--card-background)',
    color: 'var(--text-color)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-color)',
  }
});

const CourierProfileDialog: React.FC<CourierProfileDialogProps> = ({
  open,
  onClose,
  courierId,
  courierName,
  courierAvatar,
  chatId,
  isSeniorCourier,
}) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.user);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [isCurrentUser, setIsCurrentUser] = useState(false);

  // Проверка, является ли текущий пользователь админом или старшим курьером
  useEffect(() => {
    if (user) {
      setIsCurrentUserAdmin(user.isAdmin || user.isSeniorCourier || false);
      setIsCurrentUser(user.id === courierId);
    }
  }, [user, courierId]);

  // Загрузка статуса старшего курьера при открытии диалога
  useEffect(() => {
    if (open && courierId) {
      fetchCourierStatus();
    }
  }, [open, courierId]);

  const fetchCourierStatus = async () => {
    try {
      // Запрос к API для получения статуса курьера с передачей chat_id, если он доступен
      const url = chatId 
        ? `/api/couriers/${courierId}/status?chat_id=${chatId}`
        : `/api/couriers/${courierId}/status`;
      
      console.log('[CourierProfileDialog] Fetching courier status from:', url);
      const response = await axios.get(url);
      
      if (response.data && response.data.found) {
        console.log('[CourierProfileDialog] Courier status:', {
          isSeniorCourier: response.data.is_senior_courier,
          userData: response.data.user_data
        });
      } else {
        console.warn('[CourierProfileDialog] Courier not found or status not available');
      }
    } catch (error) {
      console.error('[CourierProfileDialog] Error fetching courier status:', error);
    }
  };

  const handlePromoteCourier = async () => {
    if (!chatId) {
      dispatch(addNotification({
        type: NotificationTypes.ERROR,
        message: 'Ошибка: ID чата не определён',
        duration: 5000
      }));
      return;
    }

    try {
      // Запрос к API для повышения курьера до старшего
      await axios.post(`/api/couriers/${courierId}/promote`, { chat_id: chatId });
      
      // Если повышаем текущего пользователя, обновляем его статус в хранилище Redux
      if (user && user.id === courierId) {
        dispatch(updateSeniorCourierStatus(true));
      }
      
      dispatch(addNotification({
        type: NotificationTypes.SUCCESS,
        message: `${courierName} успешно назначен старшим курьером`,
        duration: 3000
      }));
      
      // Обновляем данные о сменах
      dispatch(fetchShifts());
    } catch (error) {
      console.error('[CourierProfileDialog] Error promoting courier:', error);
      dispatch(addNotification({
        type: NotificationTypes.ERROR,
        message: error instanceof Error 
          ? error.message 
          : 'Ошибка при назначении старшего курьера',
        duration: 5000
      }));
    }
  };

  const handleDemoteCourier = async () => {
    if (!chatId) {
      dispatch(addNotification({
        type: NotificationTypes.ERROR,
        message: 'Ошибка: ID чата не определён',
        duration: 5000
      }));
      return;
    }

    try {
      // Запрос к API для понижения курьера
      await axios.post(`/api/couriers/${courierId}/demote`, { chat_id: chatId });
      
      // Если понижаем текущего пользователя, обновляем его статус в хранилище Redux
      if (user && user.id === courierId) {
        dispatch(updateSeniorCourierStatus(false));
      }
      
      dispatch(addNotification({
        type: NotificationTypes.SUCCESS,
        message: `${courierName} больше не является старшим курьером`,
        duration: 3000
      }));
      
      // Обновляем данные о сменах
      dispatch(fetchShifts());
    } catch (error) {
      console.error('[CourierProfileDialog] Error demoting courier:', error);
      dispatch(addNotification({
        type: NotificationTypes.ERROR,
        message: error instanceof Error 
          ? error.message 
          : 'Ошибка при снятии статуса старшего курьера',
        duration: 5000
      }));
    }
  };

  // Проверяем, нужно ли показывать панель управления статусом
  const shouldShowStatusManagement = () => {
    // Если текущий пользователь не админ, то не показываем
    if (!isCurrentUserAdmin) return false;
    
    // Если это профиль текущего пользователя и он уже старший курьер,
    // то не показываем возможность назначить старшим курьером
    if (isCurrentUser && isSeniorCourier) return false;
    
    return true;
  };

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          padding: 2,
        },
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          color: 'var(--text-color)'
        }}
      >
        <CloseIcon />
      </IconButton>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 2,
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <ProfileAvatar
            src={courierAvatar || defaultAvatar}
            alt={courierName}
          />
          {isSeniorCourier && (
            <SeniorCourierBadge>Старший курьер</SeniorCourierBadge>
          )}
        </Box>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 'bold',
            marginBottom: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'var(--text-color)'
          }}
        >
          {courierName} {isSeniorCourier && '⭐'}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'var(--text-secondary)',
            marginBottom: 2,
          }}
        >
          <PersonIcon fontSize="small" />
          {isSeniorCourier ? 'Старший курьер' : 'Курьер'}
        </Typography>

        {/* Административные функции только для админов и если не свой профиль или не старший курьер */}
        {shouldShowStatusManagement() && (
          <Box sx={{ width: '100%', marginTop: 2 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 'bold',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 1,
                marginBottom: 2,
                color: 'var(--text-color)'
              }}
            >
              Управление статусом
            </Typography>

            {isSeniorCourier ? (
              <ActionButton
                fullWidth
                variant="contained"
                actionType="demote"
                onClick={handleDemoteCourier}
              >
                Снять статус старшего курьера
              </ActionButton>
            ) : (
              <ActionButton
                fullWidth
                variant="contained"
                actionType="promote"
                onClick={handlePromoteCourier}
              >
                Назначить старшим курьером
              </ActionButton>
            )}
          </Box>
        )}
      </Box>
    </StyledDialog>
  );
};

export default CourierProfileDialog; 