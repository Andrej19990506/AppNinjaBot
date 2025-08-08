import React from 'react';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { activityNotificationService } from '../../services/activityNotificationService';
import { inventoryNotificationService } from '../../services/inventoryNotificationService';
import store from '../../store/store';
import './ConnectionStatusPanel.css';
import { socketService } from '../../services/socketService'; // Added import for socketService

// SVG иконка обновления в нашем стиле
const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className}
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" 
      fill="currentColor"
    />
  </svg>
);

export const ConnectionStatusPanel: React.FC = () => {
  const {
    connectionStatus,
    userEvents,
    isLoading,
    error,
    getConnectionStatus,
    isConnected,
    isConnecting
  } = useConnectionStatus();

  // Добавляем отладочный лог для отслеживания обновлений
  React.useEffect(() => {
    if (connectionStatus) {
      console.log('🔄 [ConnectionStatusPanel] Обновлен статус подключения:', {
        connection_state: connectionStatus.connection_state,
        user_activity_state: connectionStatus.user_activity_state,
        last_user_activity: connectionStatus.last_user_activity
      });
    }
  }, [connectionStatus]);

  // Автоматическое обновление статуса подключения каждые 30 секунд
  React.useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        try {
          getConnectionStatus();
        } catch (err) {
          console.error('❌ [ConnectionStatusPanel] Ошибка при обновлении статуса:', err);
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isConnected, getConnectionStatus]);

  const getConnectionStateColor = (state: string) => {
    try {
      switch (state) {
        case 'active':
          return '#4CAF50';
        case 'away':
          return '#FF9800';
        case 'timeout':
          return '#F44336';
        case 'disconnected':
          return '#9E9E9E';
        default:
          return '#757575';
      }
    } catch (err) {
      console.error('❌ [ConnectionStatusPanel] Ошибка в getConnectionStateColor:', err);
      return '#757575';
    }
  };

  const getConnectionQualityColor = (quality: string) => {
    try {
      switch (quality) {
        case 'excellent':
          return '#4CAF50';
        case 'good':
          return '#8BC34A';
        case 'fair':
          return '#FF9800';
        case 'poor':
          return '#F44336';
        default:
          return '#757575';
      }
    } catch (err) {
      console.error('❌ [ConnectionStatusPanel] Ошибка в getConnectionQualityColor:', err);
      return '#757575';
    }
  };

  const formatDuration = (seconds: number) => {
    try {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}ч ${minutes}м ${secs}с`;
      } else if (minutes > 0) {
        return `${minutes}м ${secs}с`;
      } else {
        return `${secs}с`;
      }
    } catch (err) {
      console.error('❌ [ConnectionStatusPanel] Ошибка в formatDuration:', err);
      return 'Неизвестно';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (err) {
      console.error('❌ [ConnectionStatusPanel] Ошибка в formatTimestamp:', err);
      return 'Неизвестно';
    }
  };

  return (
    <div className="connection-status-panel">
      <div className="connection-status-header">
        <h3>Состояние подключения</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
              try {
                getConnectionStatus();
              } catch (err) {
                console.error('❌ [ConnectionStatusPanel] Ошибка при обновлении статуса:', err);
              }
            }}
            disabled={isLoading || !isConnected}
            className="refresh-button"
          >
            <RefreshIcon className={`refresh-icon ${isLoading ? 'spinning' : ''}`} />
            <span className="refresh-text">
              {isLoading ? 'Обновление...' : 'Обновить'}
            </span>
          </button>
        </div>
      </div>

      {/* Общее состояние подключения */}
      <div className="connection-overview">
        <div className="connection-indicator">
          <span 
            className="status-dot"
            style={{ backgroundColor: isConnected ? '#4CAF50' : '#F44336' }}
          />
          <span className="status-text">
            {isConnecting ? 'Подключение...' : 
             isConnected ? 'Подключен' : 'Отключен'}
          </span>
        </div>
        
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {error}
          </div>
        )}
      </div>

      {/* Детальная информация о подключении */}
      {connectionStatus && (
        <div className="connection-details">
          <h4>Детали подключения</h4>
          
          <div className="detail-row">
            <span className="detail-label">Состояние:</span>
            <span 
              className="detail-value"
              style={{ color: getConnectionStateColor(connectionStatus?.connection_state || 'unknown') }}
            >
              <span className="status-indicator">●</span>
              {connectionStatus?.connection_state === 'active' && 'Активен'}
              {connectionStatus?.connection_state === 'away' && 'Неактивен'}
              {connectionStatus?.connection_state === 'timeout' && 'Таймаут'}
              {connectionStatus?.connection_state === 'disconnected' && 'Отключен'}
              {!connectionStatus?.connection_state && 'Неизвестно'}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Активность пользователя:</span>
            <span 
              className="detail-value"
              style={{ color: connectionStatus?.user_activity_state === 'active' ? '#4CAF50' : '#FF9800' }}
            >
              <span className="status-indicator">●</span>
              {connectionStatus?.user_activity_state === 'active' && 'Активен'}
              {connectionStatus?.user_activity_state === 'inactive' && 'Отошел'}
              {!connectionStatus?.user_activity_state && 'Неизвестно'}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Качество соединения:</span>
            <span 
              className="detail-value"
              style={{ color: getConnectionQualityColor(connectionStatus?.connection_quality || 'unknown') }}
            >
              <span className="quality-indicator">●</span>
              {connectionStatus?.connection_quality === 'excellent' && 'Отличное'}
              {connectionStatus?.connection_quality === 'good' && 'Хорошее'}
              {connectionStatus?.connection_quality === 'fair' && 'Удовлетворительное'}
              {connectionStatus?.connection_quality === 'poor' && 'Плохое'}
              {!connectionStatus?.connection_quality && 'Неизвестно'}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Время подключения:</span>
            <span className="detail-value">
              {connectionStatus?.connection_duration ? formatDuration(connectionStatus.connection_duration) : 'Неизвестно'}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Последняя активность:</span>
            <span className="detail-value">
              {connectionStatus?.last_user_activity 
                ? formatTimestamp(new Date(connectionStatus.last_user_activity * 1000).toISOString())
                : connectionStatus?.last_activity
                ? formatTimestamp(new Date(connectionStatus.last_activity * 1000).toISOString())
                : 'Неизвестно'
              }
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Успешность пингов:</span>
            <span className="detail-value">
              {connectionStatus?.ping_statistics 
                ? `${connectionStatus.ping_statistics.success_rate.toFixed(1)}% (${connectionStatus.ping_statistics.total_pings - connectionStatus.ping_statistics.missed_pongs}/${connectionStatus.ping_statistics.total_pings})`
                : 'Неизвестно'
              }
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Комнаты:</span>
            <span className="detail-value">
              {connectionStatus?.rooms ? connectionStatus.rooms.join(', ') || 'Нет' : 'Неизвестно'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}; 