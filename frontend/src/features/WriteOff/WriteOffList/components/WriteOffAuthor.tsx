import React from 'react';
import { motion } from 'framer-motion';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { formatDate } from '@/features/WriteOff/WriteOffList/utils/dateUtils';
import styles from './WriteOffAuthor.module.css';

interface WriteOffAuthorProps {
  author?: {
    user_id: number;
    first_name: string | null;
    last_name?: string | null;
    photo_url?: string | null;
    username?: string | null;
  } | null;
  created_at: string;
  variant?: 'mobile' | 'desktop';
  showTime?: boolean;
}

/**
 * Компонент для отображения информации об авторе списания
 */
const WriteOffAuthor: React.FC<WriteOffAuthorProps> = ({ 
  author, 
  created_at, 
  variant = 'mobile',
  showTime = true 
}) => {
  // Получаем имя пользователя
  const getUserName = () => {
    if (!author) return 'Неизвестный пользователь';
    
    const firstName = author.first_name || '';
    const lastName = author.last_name || '';
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (author.username) {
      return `@${author.username}`;
    } else {
      return `Пользователь ${author.user_id}`;
    }
  };

  // Получаем инициалы для аватара
  const getInitials = () => {
    if (!author) return '?';
    
    const firstName = author.first_name || '';
    const lastName = author.last_name || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else if (author.username) {
      return author.username.charAt(0).toUpperCase();
    } else {
      return '?';
    }
  };

  // URL фото пользователя
  const photoUrl = author?.photo_url 
    ? `${window.APP_CONFIG?.API_URL || 'http://localhost:8000'}/api${author.photo_url}`
    : null;

  const userName = getUserName();
  const initials = getInitials();

  return (
    <motion.div 
      className={`${styles.container} ${styles[variant]}`}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className={styles.avatarContainer}>
        <Avatar
          src={photoUrl || undefined}
          className={styles.avatar}
          sx={{
            width: variant === 'desktop' ? 32 : 28,
            height: variant === 'desktop' ? 32 : 28,
            fontSize: variant === 'desktop' ? '0.9rem' : '0.8rem',
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            fontWeight: 600,
          }}
        >
          {!photoUrl && (initials || <PersonIcon fontSize="small" />)}
        </Avatar>
        
        {/* Индикатор онлайн статуса (можно расширить в будущем) */}
        <div className={styles.statusIndicator} />
      </div>
      
      <div className={styles.infoContainer}>
        <Typography 
          variant="body2" 
          className={styles.userName}
          title={userName}
        >
          {userName}
        </Typography>
        
        {showTime && (
          <div className={styles.timeContainer}>
            <AccessTimeIcon className={styles.timeIcon} />
            <Typography 
              variant="caption" 
              className={styles.timeText}
              title={`Создано: ${formatDate(created_at)}`}
            >
              {formatDate(created_at)}
            </Typography>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default WriteOffAuthor; 