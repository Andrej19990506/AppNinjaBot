/**
 * Плавающая кнопка для открытия интерфейса записи
 */

import React from 'react';
import { Fab, Badge, Tooltip, Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { keyframes } from '@mui/system';
import zIndex from '@mui/material/styles/zIndex';

interface FloatingRecordButtonProps {
  onClick: () => void;
  recordingsCount: number;
  isRecording?: boolean;
}

// Анимация пульсации с оранжевым цветом
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(255, 95, 31, 0.7);
  }
  70% {
    box-shadow: 0 0 0 20px rgba(255, 95, 31, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 95, 31, 0);
  }
`;

// Анимация записи
const recordingPulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
`;

// Анимация вращения прогресс-бара
const rotateProgress = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const FloatingRecordButton: React.FC<FloatingRecordButtonProps> = ({
  onClick,
  recordingsCount,
  isRecording = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // Мобильные устройства (< 900px)
  const progress = Math.min(100, (recordingsCount / 2500) * 100);
  const isCompleted = recordingsCount >= 2500;

  return (
    <Tooltip 
      title={
        isCompleted 
          ? `🏆 Цель достигнута! ${recordingsCount} записей` 
          : `💰 Записать голос: ${recordingsCount}/2500 записей`
      }
      placement="left"
    >
      <Box
        sx={{
          position: 'fixed',
          right: isMobile ? 16 : 24,
          bottom: isMobile ? 86 : 24,
          zIndex: 1300,
        }}
      >
        <Badge
          badgeContent={recordingsCount}
          max={9999}
          sx={{
            '& .MuiBadge-badge': {
              zIndex:9999,
              fontSize: '0.85rem',
              fontWeight: 700,
              height: 24,
              minWidth: 24,
              right: 30,
              top:-5,
              borderRadius: '13px',
              border: '2px solid white',
              background: isCompleted 
                ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' 
                : 'linear-gradient(135deg, #FF5F1F 0%, #E64500 100%)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            },
          }}
        >
          <Fab
            onClick={onClick}
            disabled={isRecording}
            sx={{
              width: isMobile ? 60 : 70,
              height: isMobile ? 60 : 70,
              background: isCompleted 
                ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                : 'linear-gradient(135deg, #FF5F1F 0%, #E64500 100%)',
              '&:hover': {
                background: isCompleted 
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : 'linear-gradient(135deg, #E64500 0%, #CC3D00 100%)',
                transform: 'scale(1.05)',
              },
              animation: isRecording 
                ? `${recordingPulse} 1s ease-in-out infinite` 
                : `${pulse} 2s infinite`,
              boxShadow: isCompleted 
                ? '0 4px 20px rgba(251, 191, 36, 0.5)'
                : '0 4px 20px rgba(255, 95, 31, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&.Mui-disabled': {
                bgcolor: '#9ca3af',
                background: '#9ca3af',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              },
            }}
          >
            <Typography sx={{ fontSize: isMobile ? 32 : 40 }}>
              {isCompleted ? '🏆' : '💰'}
            </Typography>
          </Fab>
        </Badge>

        {/* Прогресс-бар вокруг кнопки (оранжевый) */}
        {!isCompleted && (
          <Box
            sx={{
              position: 'absolute',
              top: -6,
              left: -6,
              right: -6,
              bottom: -6,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: '#FF5F1F',
              borderRightColor: progress > 25 ? '#FF5F1F' : 'rgba(255, 95, 31, 0.3)',
              borderBottomColor: progress > 50 ? '#FF5F1F' : 'rgba(255, 95, 31, 0.3)',
              borderLeftColor: progress > 75 ? '#FF5F1F' : 'rgba(255, 95, 31, 0.3)',
              transform: `rotate(${(progress / 100) * 360}deg)`,
              transition: 'all 0.5s ease-in-out',
              pointerEvents: 'none',
              opacity: 0.8,
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default FloatingRecordButton;

