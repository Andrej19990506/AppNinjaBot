/**
 * Модальное окно для ввода имени и фамилии участника
 * Анимированная модалка снизу
 */

import React, { useState } from 'react';
import { 
  Drawer, 
  Box, 
  Typography, 
  TextField, 
  Button, 
  IconButton,
  InputAdornment,
  Alert,
} from '@mui/material';
import { Close, Person, CheckCircle } from '@mui/icons-material';

interface UserInfoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (firstName: string, lastName: string) => void;
  error?: string | null;
}

const UserInfoModal: React.FC<UserInfoModalProps> = ({ open, onClose, onSubmit, error }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState({ firstName: '', lastName: '' });

  const validateName = (name: string, field: 'firstName' | 'lastName') => {
    if (!name.trim()) {
      setErrors(prev => ({ ...prev, [field]: 'Это поле обязательно' }));
      return false;
    }
    if (name.trim().length < 2) {
      setErrors(prev => ({ ...prev, [field]: 'Минимум 2 символа' }));
      return false;
    }
    if (!/^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(name)) {
      setErrors(prev => ({ ...prev, [field]: 'Только буквы, пробелы и дефис' }));
      return false;
    }
    setErrors(prev => ({ ...prev, [field]: '' }));
    return true;
  };

  const handleSubmit = () => {
    const isFirstNameValid = validateName(firstName, 'firstName');
    const isLastNameValid = validateName(lastName, 'lastName');

    if (isFirstNameValid && isLastNameValid) {
      onSubmit(firstName.trim(), lastName.trim());
      // Сброс формы
      setFirstName('');
      setLastName('');
      setErrors({ firstName: '', lastName: '' });
    }
  };

  const handleClose = () => {
    // Сброс формы при закрытии
    setFirstName('');
    setLastName('');
    setErrors({ firstName: '', lastName: '' });
    onClose();
  };

  const isFormValid = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      sx={{
        zIndex: 1400, // Выше чем Dialog (1300)
      }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          maxHeight: '85vh',
          pb: 2,
        },
      }}
      ModalProps={{
        keepMounted: false, // Не держим в DOM когда закрыто
      }}
    >
      <Box sx={{ position: 'relative', p: 3 }}>
        {/* Индикатор свайпа */}
        <Box
          sx={{
            width: 40,
            height: 4,
            bgcolor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: 2,
            mx: 'auto',
            mb: 3,
          }}
        />

        {/* Заголовок */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person sx={{ fontSize: 32, color: '#ffd700' }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Ваши данные
            </Typography>
          </Box>
          <IconButton 
            onClick={handleClose}
            sx={{ 
              color: 'white',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* Описание */}
        <Alert 
          severity="info" 
          sx={{ 
            mb: 3,
            bgcolor: 'rgba(255, 255, 255, 0.15)',
            color: 'white',
            '& .MuiAlert-icon': {
              color: '#4ade80',
            },
            borderRadius: 2,
          }}
        >
          <Typography variant="body2">
            Для участия в конкурсе укажите ваше <strong>реальное имя и фамилию</strong>. 
            Эти данные будут использованы только для розыгрыша призов.
          </Typography>
        </Alert>

        {/* Ошибка регистрации */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              bgcolor: 'rgba(220, 38, 38, 0.2)',
              color: '#dc2626',
              border: '2px solid #dc2626',
              '& .MuiAlert-icon': {
                color: '#dc2626',
              },
            }}
          >
            {error}
          </Alert>
        )}

        {/* Форма */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Имя */}
          <TextField
            label="Имя"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (errors.firstName) validateName(e.target.value, 'firstName');
            }}
            onBlur={() => validateName(firstName, 'firstName')}
            error={!!errors.firstName}
            helperText={errors.firstName}
            placeholder="Например: Иван"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                </InputAdornment>
              ),
              endAdornment: firstName.trim().length >= 2 && !errors.firstName && (
                <InputAdornment position="end">
                  <CheckCircle sx={{ color: '#4ade80' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderRadius: 2,
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#4ade80',
                },
                '&.Mui-error fieldset': {
                  borderColor: '#ef4444',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-focused': {
                  color: '#4ade80',
                },
                '&.Mui-error': {
                  color: '#ef4444',
                },
              },
              '& .MuiFormHelperText-root': {
                bgcolor: 'transparent',
                color: '#ef4444',
                mx: 0,
                mt: 1,
              },
            }}
          />

          {/* Фамилия */}
          <TextField
            label="Фамилия"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (errors.lastName) validateName(e.target.value, 'lastName');
            }}
            onBlur={() => validateName(lastName, 'lastName')}
            error={!!errors.lastName}
            helperText={errors.lastName}
            placeholder="Например: Иванов"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                </InputAdornment>
              ),
              endAdornment: lastName.trim().length >= 2 && !errors.lastName && (
                <InputAdornment position="end">
                  <CheckCircle sx={{ color: '#4ade80' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderRadius: 2,
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#4ade80',
                },
                '&.Mui-error fieldset': {
                  borderColor: '#ef4444',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-focused': {
                  color: '#4ade80',
                },
                '&.Mui-error': {
                  color: '#ef4444',
                },
              },
              '& .MuiFormHelperText-root': {
                bgcolor: 'transparent',
                color: '#ef4444',
                mx: 0,
                mt: 1,
              },
            }}
          />

          

          {/* Кнопки */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              onClick={handleClose}
              fullWidth
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                py: 1.5,
                '&:hover': {
                  borderColor: 'white',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!isFormValid}
              fullWidth
              sx={{
                bgcolor: isFormValid ? '#4ade80' : 'rgba(255, 255, 255, 0.3)',
                color: isFormValid ? '#1e293b' : 'rgba(255, 255, 255, 0.5)',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                py: 1.5,
                '&:hover': {
                  bgcolor: isFormValid ? '#22c55e' : 'rgba(255, 255, 255, 0.3)',
                },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                  color: 'rgba(255, 255, 255, 0.5)',
                },
              }}
            >
              Принять участия 💰
            </Button>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default UserInfoModal;

