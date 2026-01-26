/**
 * Модальное окно приветствия (показывается один раз)
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, Button, Typography, Box, List, ListItem, ListItemIcon, ListItemText, useMediaQuery, useTheme, Checkbox, FormControlLabel, Link, IconButton, Divider } from '@mui/material';
import { Mic, Security, Timer, CloudUpload, EmojiEvents, CheckCircle, ArrowBack, Info, Gavel } from '@mui/icons-material';
import { CONTEST_RULES } from '../constants';
import UserInfoModal from './UserInfoModal';
import { useVoiceContestSync } from '../hooks/useVoiceContestSync';
import { getCurrentUserId } from '../utils/getUserId';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ open, onClose, onStart }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // Мобильные устройства (< 900px)
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false); // Показывать условия или приветствие
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false); // Модалка ввода данных
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Получаем user_id и hook для регистрации
  const userId = getCurrentUserId();
  const { register, isRegistered } = useVoiceContestSync({ 
    userId, 
    autoFetch: true 
  });

  const handleStart = () => {
    if (agreedToTerms) {
      // Если уже зарегистрирован - сразу начинаем
      if (isRegistered) {
        setShowTerms(false);
        onStart();
        onClose();
      } else {
        // Если нет - открываем модалку для ввода имени и фамилии
        setIsUserInfoModalOpen(true);
      }
    }
  };

  const handleUserInfoSubmit = async (firstName: string, lastName: string) => {
    try {
      setRegistrationError(null);

      // Регистрируем участника на сервере
      await register(firstName, lastName);

      // Сохраняем данные пользователя в localStorage (только для UI)
      localStorage.setItem('voice_contest_user_info', JSON.stringify({
        firstName,
        lastName,
        timestamp: new Date().toISOString(),
      }));

      // Закрываем модалку ввода данных
      setIsUserInfoModalOpen(false);
      
      // Закрываем приветствие и начинаем запись
      setShowTerms(false);
      onStart();
      onClose();
    } catch (error: any) {
      console.error('Ошибка регистрации:', error);
      setRegistrationError(error.response?.data?.detail || 'Не удалось зарегистрироваться. Попробуйте позже.');
    }
  };

  const handleTermsClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    // Переключаемся на показ условий внутри модалки
    setShowTerms(true);
  };

  const handleBackToWelcome = () => {
    setShowTerms(false);
  };

  // Сброс состояния при закрытии модалки
  const handleClose = () => {
    setShowTerms(false);
    onClose();
  };

  return (
    <>
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile} // На мобильных - на весь экран
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3, // Без скругления на мобильных
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          maxHeight: isMobile ? '100vh' : '90vh', // На мобильных - на всю высоту
          overflow: 'auto', // Скролл если контент не помещается
        }
      }}
    >
      {/* УСЛОВНЫЙ РЕНДЕРИНГ: Приветствие или Условия */}
      {!showTerms ? (
        // === ПРИВЕТСТВИЕ ===
        <>
          <DialogTitle sx={{ 
            textAlign: 'center', 
            pt: isMobile ? 3 : 4, 
            pb: 2,
            px: isMobile ? 2 : 3,
          }}>
            {/* Логотипы коллаборации */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 1, 
              mb: 3,
              flexWrap: 'wrap',
            }}>
              <Box
                component="img"
                src="/Logo.png"
                alt="App Logo"
                sx={{
                  height: isMobile ? 120 : 160,
                  width: 'auto',
                  objectFit: 'contain',
                  maxWidth: isMobile ? '180px' : '240px',
                }}
              />
              <Typography 
                variant="h3" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 700,
                  fontSize: isMobile ? '2rem' : '2.5rem',
                }}
              >
              
              </Typography>
            </Box>
            <Typography 
              component="div"
              variant={isMobile ? 'h4' : 'h3'} 
              sx={{ 
                fontWeight: 900,
                mb: 2,
                fontSize: { xs: '2rem', md: '2.75rem' },
                background: 'linear-gradient(135deg, #FFFFFF 0%, #E8E8FF 50%, #FFFFFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 4px 20px rgba(255, 255, 255, 0.3)',
                letterSpacing: '0.02em',
                lineHeight: 1.2,
                position: 'relative',
                animation: 'titleGlow 3s ease-in-out infinite',
                '@keyframes titleGlow': {
                  '0%, 100%': {
                    filter: 'drop-shadow(0 4px 20px rgba(255, 255, 255, 0.3))',
                  },
                  '50%': {
                    filter: 'drop-shadow(0 6px 30px rgba(255, 255, 255, 0.5))',
                  },
                },
              }}
            >
              Помоги научить Лолу!
            </Typography>
            <Typography 
              component="div"
              variant={isMobile ? 'h6' : 'h5'} 
              sx={{ 
                opacity: 0.95,
                fontWeight: 500,
                fontSize: { xs: '1rem', md: '1.25rem' },
                color: 'rgba(255, 255, 255, 0.95)',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                letterSpacing: '0.01em',
              }}
            >
              Конкурс голосовых записей
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ 
            px: isMobile ? 2 : 4, 
            pb: isMobile ? 3 : 4,
          }}>
        {/* Призовой фонд */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%)',
          borderRadius: 3, 
          p: 4, 
          mb: 3,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          border: '2px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-100%',
            left: '-100%',
            width: '300%',
            height: '300%',
            background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.3) 20%, transparent 60%)',
            animation: 'shimmer 5s ease-in-out infinite',
            pointerEvents: 'none',
            transform: 'rotate(45deg)',
          },
          '@keyframes shimmer': {
            '0%': { 
              transform: 'translateX(-100%) translateY(-100%) rotate(45deg)',
              opacity: 0,
            },
            '20%': {
              opacity: 0.8,
            },
            '50%': {
              opacity: 1,
            },
            '80%': {
              opacity: 0.8,
            },
            '100%': { 
              transform: 'translateX(100%) translateY(100%) rotate(45deg)',
              opacity: 0,
            },
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%)',
            borderRadius: 3,
            pointerEvents: 'none',
            animation: 'softGlow 4s ease-in-out infinite',
          },
          '@keyframes softGlow': {
            '0%, 100%': {
              opacity: 0.5,
            },
            '50%': {
              opacity: 0.8,
            },
          },
        }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 800, 
              mb: 2,
              color: '#FFFFFF',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              fontSize: { xs: '1.5rem', md: '2rem' },
              textAlign: 'center',
            }}
          >
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                animation: 'shakeMoney 1.5s ease-in-out infinite',
                '@keyframes shakeMoney': {
                  '0%, 100%': {
                    transform: 'translateY(0) rotate(0deg)',
                  },
                  '10%': {
                    transform: 'translateY(-4px) rotate(-5deg)',
                  },
                  '20%': {
                    transform: 'translateY(2px) rotate(5deg)',
                  },
                  '30%': {
                    transform: 'translateY(-3px) rotate(-3deg)',
                  },
                  '40%': {
                    transform: 'translateY(3px) rotate(3deg)',
                  },
                  '50%': {
                    transform: 'translateY(-2px) rotate(-2deg)',
                  },
                  '60%': {
                    transform: 'translateY(2px) rotate(2deg)',
                  },
                  '70%': {
                    transform: 'translateY(-1px) rotate(-1deg)',
                  },
                  '80%': {
                    transform: 'translateY(1px) rotate(1deg)',
                  },
                  '90%': {
                    transform: 'translateY(0) rotate(0deg)',
                  },
                },
              }}
            >
              💰
            </Box>
            {' '}Призовой фонд:{' '}
            <Box component="span" sx={{ 
              fontSize: { xs: '1.8rem', md: '2.3rem' },
              background: 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none',
              filter: 'drop-shadow(0 2px 8px rgba(255, 215, 0, 0.6))',
            }}>20,000₽</Box>
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 1.5, md: 3 }, mt: 3, flexWrap: 'wrap' }}>
            <Box sx={{ 
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 2,
              p: 2,
              minWidth: { xs: '100px', md: '120px' },
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255, 215, 0, 0.6)',
              boxShadow: '0 4px 16px rgba(255, 215, 0, 0.4), inset 0 0 20px rgba(255, 215, 0, 0.1)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 24px rgba(255, 215, 0, 0.6), inset 0 0 30px rgba(255, 215, 0, 0.15)',
              },
            }}>
              <Typography variant="h4" sx={{ 
                fontWeight: 900, 
                background: 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '1.5rem', md: '2rem' },
                mb: 0.5,
                filter: 'drop-shadow(0 2px 4px rgba(255, 215, 0, 0.5))',
              }}>
                🥇 10,000₽
              </Typography>
              <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.9rem', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                1 место
              </Typography>
            </Box>
            <Box sx={{ 
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 2,
              p: 2,
              minWidth: { xs: '100px', md: '120px' },
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(192, 192, 192, 0.6)',
              boxShadow: '0 4px 16px rgba(192, 192, 192, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.1)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 24px rgba(192, 192, 192, 0.6), inset 0 0 30px rgba(255, 255, 255, 0.15)',
              },
            }}>
              <Typography variant="h4" sx={{ 
                fontWeight: 900, 
                color: '#F0F0F0',
                fontSize: { xs: '1.5rem', md: '2rem' },
                mb: 0.5,
                textShadow: '0 2px 8px rgba(255, 255, 255, 0.5), 0 0 12px rgba(255, 255, 255, 0.3)',
              }}>
                🥈 6,000₽
              </Typography>
              <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.9rem', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                2 место
              </Typography>
            </Box>
            <Box sx={{ 
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 2,
              p: 2,
              minWidth: { xs: '100px', md: '120px' },
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255, 140, 0, 0.6)',
              boxShadow: '0 4px 16px rgba(255, 140, 0, 0.4), inset 0 0 20px rgba(255, 140, 0, 0.1)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 24px rgba(255, 140, 0, 0.6), inset 0 0 30px rgba(255, 140, 0, 0.15)',
              },
            }}>
              <Typography variant="h4" sx={{ 
                fontWeight: 900, 
                color: '#FFB84D',
                fontSize: { xs: '1.5rem', md: '2rem' },
                mb: 0.5,
                textShadow: '0 2px 8px rgba(255, 140, 0, 0.6), 0 0 12px rgba(255, 140, 0, 0.4)',
              }}>
                🥉 4,000₽
              </Typography>
              <Typography variant="body2" sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.9rem', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                3 место
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Условия участия */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            📋 Условия участия:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <CheckCircle sx={{ color: '#4ade80' }} />
              </ListItemIcon>
              <ListItemText 
                primary={`Записать минимум ${CONTEST_RULES.minRecordings} аудио`}
                secondary="Чтобы попасть в розыгрыш"
                secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <EmojiEvents sx={{ color: '#fbbf24' }} />
              </ListItemIcon>
              <ListItemText 
                primary="3 победителя через рандомайзер"
                secondary="Среди тех, кто выполнил условия"
                secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Timer sx={{ color: '#60a5fa' }} />
              </ListItemIcon>
              <ListItemText 
                primary={`Конкурс до ${new Date(CONTEST_RULES.deadline).toLocaleDateString('ru-RU')}`}
                secondary="Успей принять участие!"
                secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
              />
            </ListItem>
          </List>
        </Box>

        {/* Что записывать */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            🎯 Что записывать:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="• Хотворд «Лола» (30%)"
                secondary="Для активации ассистента"
                secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="• Команды для Лолы (60%)"
                secondary="Найди, покажи, открой, количество, тара и др."
                secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="• Негативные примеры (10%)"
                secondary="Обычные фразы, не связанные с Лолой"
                secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
              />
            </ListItem>
          </List>
        </Box>

        {/* Безопасность */}
        <Box sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: 2, 
          p: 2, 
          mb: 3,
          border: '2px solid rgba(255, 255, 255, 0.2)',
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security /> Ваша безопасность:
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ✅ Микрофон включается ТОЛЬКО когда вы нажимаете «Готов»
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ✅ Автоматическое отключение через 5 секунд
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ✅ Записи анонимны и используются только для обучения
          </Typography>
          <Typography variant="body2">
            ✅ Вы НЕ прослушиваетесь в фоновом режиме
          </Typography>
        </Box>

        {/* Как работает */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            🚀 Как это работает:
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            1️⃣ Нажимаете на плавающую кнопку 🎤
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            2️⃣ Видите случайное слово или команду
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            3️⃣ Нажимаете «Готов» → отсчет 3-2-1
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            4️⃣ Произносите фразу
          </Typography>
          <Typography variant="body2">
            5️⃣ Аудио автоматически загружается в облако
          </Typography>
        </Box>

        {/* Соглашение с условиями */}
        <Box sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: 2, 
          p: 2, 
          mt: 3,
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={agreedToTerms}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgreedToTerms(e.target.checked)}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-checked': {
                    color: '#4ade80',
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: 'white' }}>
                Я ознакомился(-лась) и принимаю{' '}
                <Link
                  href="#"
                  onClick={handleTermsClick}
                  sx={{
                    color: '#4ade80',
                    textDecoration: 'underline',
                    fontWeight: 'bold',
                    '&:hover': {
                      color: '#22c55e',
                    },
                  }}
                >
                  условия конкурса и политику конфиденциальности
                </Link>
              </Typography>
            }
          />
        </Box>

        {/* Кнопки */}
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handleClose}
            fullWidth
            sx={{
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.5)',
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Напомнить позже
          </Button>
          <Button
            variant="contained"
            onClick={handleStart}
            disabled={!agreedToTerms}
            fullWidth
            sx={{
              bgcolor: agreedToTerms ? '#4ade80' : 'rgba(255, 255, 255, 0.3)',
              color: agreedToTerms ? '#1e293b' : 'rgba(255, 255, 255, 0.5)',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              py: 1.5,
              '&:hover': {
                bgcolor: agreedToTerms ? '#22c55e' : 'rgba(255, 255, 255, 0.3)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255, 255, 255, 0.3)',
                color: 'rgba(255, 255, 255, 0.5)',
              },
            }}
          >
            Принять участие 💰
          </Button>
        </Box>
      </DialogContent>
    </>
      ) : (
        // === УСЛОВИЯ КОНКУРСА ===
        <>
          <DialogTitle sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            pt: isMobile ? 2 : 3, 
            pb: 2,
            px: isMobile ? 2 : 3,
          }}>
            <IconButton 
              onClick={handleBackToWelcome}
              sx={{ 
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <ArrowBack />
            </IconButton>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography 
                component="div"
                variant={isMobile ? 'h6' : 'h5'} 
                sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', md: '1.5rem' } }}
              >
                Условия и политика
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ 
            px: isMobile ? 2 : 3, 
            pb: isMobile ? 3 : 4,
          }}>
            {/* 1. Условия конкурса */}
            <Box sx={{ mb: 4 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  mb: 2.5,
                  fontSize: { xs: '1.125rem', md: '1.25rem' },
                  borderLeft: '3px solid rgba(255,255,255,0.5)',
                  pl: 2,
                }}
              >
                1. Условия участия в конкурсе
              </Typography>

              <Typography variant="body2" paragraph sx={{ mb: 2, fontSize: '0.9375rem' }}>
                <strong>Призовой фонд:</strong> 20,000 рублей
              </Typography>

              <List dense sx={{ mb: 2 }}>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Первое место: 10,000 рублей"
                    secondary="Через рандомайзер"
                    primaryTypographyProps={{ 
                      sx: { fontSize: '0.9375rem', fontWeight: 500 },
                    }}
                    secondaryTypographyProps={{ 
                      sx: { color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' },
                    }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Второе место: 6,000 рублей"
                    secondary="Через рандомайзер"
                    primaryTypographyProps={{ 
                      sx: { fontSize: '0.9375rem', fontWeight: 500 },
                    }}
                    secondaryTypographyProps={{ 
                      sx: { color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' },
                    }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Третье место: 4,000 рублей"
                    secondary="Через рандомайзер"
                    primaryTypographyProps={{ 
                      sx: { fontSize: '0.9375rem', fontWeight: 500 },
                    }}
                    secondaryTypographyProps={{ 
                      sx: { color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' },
                    }}
                  />
                </ListItem>
              </List>

              <Typography variant="body2" paragraph sx={{ mt: 2.5, mb: 1, fontSize: '0.9375rem' }}>
                <strong>Минимальное количество записей:</strong> 2,500 аудиофайлов до 15 февраля 2026
              </Typography>

              <Typography variant="body2" paragraph sx={{ mt: 2.5, mb: 1, fontSize: '0.9375rem' }}>
                <strong>Модерация данных:</strong>
              </Typography>
              <Typography variant="body2" paragraph sx={{ opacity: 0.9, fontSize: '0.875rem', mb: 2 }}>
                Все предоставленные аудиозаписи проходят обязательную модерацию перед засчитыванием в конкурс. Записи, не соответствующие содержанию (тексту команды), не засчитываются в общий счет участника. Помехи, шумы и особенности произношения не являются основанием для отклонения записи. Попытки обойти систему модерации (например, запись несоответствующих фраз) не допускаются.
              </Typography>

              <Typography variant="body2" paragraph sx={{ mt: 2.5, mb: 1, fontSize: '0.9375rem' }}>
                <strong>Распределение записей:</strong>
              </Typography>
              <List dense>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="30% — Хотворд «Лола»"
                    primaryTypographyProps={{ sx: { fontSize: '0.9375rem' } }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="60% — Команды управления"
                    primaryTypographyProps={{ sx: { fontSize: '0.9375rem' } }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="10% — Негативные примеры"
                    primaryTypographyProps={{ sx: { fontSize: '0.9375rem' } }}
                  />
                </ListItem>
              </List>
            </Box>

            <Divider sx={{ my: 3, bgcolor: 'rgba(255,255,255,0.2)' }} />

            {/* 2. Политика конфиденциальности */}
            <Box sx={{ mb: 4 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  mb: 2.5,
                  fontSize: { xs: '1.125rem', md: '1.25rem' },
                  borderLeft: '3px solid rgba(255,255,255,0.5)',
                  pl: 2,
                }}
              >
                2. Политика конфиденциальности
              </Typography>

              <Typography variant="body2" sx={{ fontWeight: 600, mt: 2, mb: 1, fontSize: '0.9375rem' }}>
                Сбор и использование данных
              </Typography>
              <Typography variant="body2" paragraph sx={{ opacity: 0.9, fontSize: '0.875rem', mb: 2 }}>
                Мы собираем только голосовые записи для обучения "Лолы". Все записи анонимны.
              </Typography>

              <Typography variant="body2" sx={{ fontWeight: 600, mt: 2.5, mb: 1, fontSize: '0.9375rem' }}>
                Безопасность микрофона
              </Typography>
              <List dense>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Активация ТОЛЬКО по кнопке «Готов»"
                    secondary="Фоновая запись полностью исключена"
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      sx: { fontSize: '0.9375rem', fontWeight: 500 },
                    }}
                    secondaryTypographyProps={{ 
                      sx: { color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' },
                    }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Автоотключение через 5 секунд"
                    secondary="Микрофон не может работать дольше установленного времени"
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      sx: { fontSize: '0.9375rem', fontWeight: 500 },
                    }}
                    secondaryTypographyProps={{ 
                      sx: { color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' },
                    }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Контроль записи"
                    secondary="Вы видите когда микрофон включен (индикатор записи)"
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      sx: { fontSize: '0.9375rem', fontWeight: 500 },
                    }}
                    secondaryTypographyProps={{ 
                      sx: { color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' },
                    }}
                  />
                </ListItem>
              </List>

              <Typography variant="body2" sx={{ fontWeight: 600, mt: 2.5, mb: 1, fontSize: '0.9375rem' }}>
                Передача данных
              </Typography>
              <Typography variant="body2" paragraph sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                Мы НЕ передаем, НЕ продаем и НЕ предоставляем ваши записи третьим лицам.
              </Typography>
            </Box>

            <Divider sx={{ my: 3, bgcolor: 'rgba(255,255,255,0.2)' }} />

            {/* 3. Права участников */}
            <Box sx={{ mb: 4 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  mb: 2.5,
                  fontSize: { xs: '1.125rem', md: '1.25rem' },
                  borderLeft: '3px solid rgba(255,255,255,0.5)',
                  pl: 2,
                }}
              >
                3. Права участников
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Право на удаление данных"
                    secondary="Запросить удаление в любое время"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Право на отказ"
                    secondary="Прекратить участие без объяснений"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Право на информацию"
                    secondary="Узнать как используются данные"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                  />
                </ListItem>
              </List>
            </Box>

            <Divider sx={{ my: 3, bgcolor: 'rgba(255,255,255,0.2)' }} />

            {/* 4. Дополнительно */}
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  mb: 2.5,
                  fontSize: { xs: '1.125rem', md: '1.25rem' },
                  borderLeft: '3px solid rgba(255,255,255,0.5)',
                  pl: 2,
                }}
              >
                4. Дополнительная информация
              </Typography>

              <Typography variant="body2" paragraph sx={{ opacity: 0.9, fontSize: '0.875rem', mb: 1.5 }}>
                Принимая участие, вы подтверждаете, что:
              </Typography>
              <List dense>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Прочитали условия и политику"
                    primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.9375rem' } }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Добровольно предоставляете записи"
                    primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.9375rem' } }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Даете согласие на обработку персональных данных (152-ФЗ)"
                    primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.9375rem' } }}
                  />
                </ListItem>
                <ListItem sx={{ pl: 0, py: 0.5 }}>
                  <ListItemText 
                    primary="Понимаете, что все записи проходят модерацию на соответствие содержанию"
                    primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.9375rem' } }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="• Понимаете механику розыгрыша"
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              </List>
            </Box>

            {/* Дата */}
            <Box sx={{ 
              mt: 4, 
              pt: 2, 
              borderTop: '1px solid rgba(255,255,255,0.2)',
              textAlign: 'center',
            }}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Последнее обновление: 26 января 2026
              </Typography>
            </Box>

            {/* Кнопка назад */}
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleBackToWelcome}
                fullWidth
                sx={{
                  bgcolor: '#4ade80',
                  color: '#1e293b',
                  fontWeight: 'bold',
                  py: 1.5,
                  '&:hover': {
                    bgcolor: '#22c55e',
                  },
                }}
              >
                Вернуться к приветствию
              </Button>
            </Box>
          </DialogContent>
        </>
      )}
    </Dialog>

      {/* Модалка для ввода имени и фамилии */}
      <UserInfoModal
        open={isUserInfoModalOpen}
        onClose={() => {
          setIsUserInfoModalOpen(false);
          setRegistrationError(null);
        }}
        onSubmit={handleUserInfoSubmit}
        error={registrationError}
      />
    </>
  );
};

export default WelcomeModal;

