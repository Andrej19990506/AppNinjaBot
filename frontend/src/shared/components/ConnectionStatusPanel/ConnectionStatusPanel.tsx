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
          
          {/* Тестовая кнопка для проверки уведомлений */}
          <button 
            onClick={() => {
              console.log('🔔 [ConnectionStatusPanel] Тест уведомления');
              activityNotificationService.showActivityNotification({
                userId: '1682142222', // Используем реальный userId
                userName: 'Тестовый пользователь',
                activityState: 'active',
                photoUrl: 'http://localhost:8000/api/v1/users/1682142222/photo', // Используем API endpoint
                timestamp: Date.now()
              });
            }}
            className="refresh-button"
            style={{ backgroundColor: '#4CAF50', color: 'white' }}
          >
            <span>🔔 Тест уведомления</span>
          </button>

          {/* Тестовая кнопка для проверки уведомлений о входе/выходе пользователей */}
          <button 
            onClick={() => {
              console.log('🚪 [ConnectionStatusPanel] Тест уведомлений о входе/выходе');
                             // Симулируем событие входа пользователя в комнату инвентаризации
               const mockUserJoinedEvent = {
                 room: 'inventory_-1004984919338',
                 userId: '1682142222',
                 first_name: 'Андрей',
                 last_name: 'Тестовый',
                 photo_url: '/users-photo/user_1682142222.jpg', // Используем относительный путь как в backend
                 joinedAt: new Date().toISOString()
               };
              
              // Вызываем обработчик напрямую для тестирования
              (inventoryNotificationService as any).handleUserJoinedRoom(mockUserJoinedEvent);
            }}
            className="refresh-button"
            style={{ backgroundColor: '#2196F3', color: 'white', marginLeft: '8px' }}
          >
            <span>🚪 Тест входа</span>
          </button>

                     <button 
             onClick={() => {
               console.log('🚪 [ConnectionStatusPanel] Тест уведомлений о выходе');
               // Симулируем событие выхода пользователя из комнаты инвентаризации
               const mockUserLeftEvent = {
                 room: 'inventory_-1004984919338',
                 userId: '1682142222',
                 first_name: 'Андрей',
                 last_name: 'Тестовый',
                 photo_url: '/users-photo/user_1682142222.jpg', // Используем относительный путь как в backend
                 leftAt: new Date().toISOString()
               };
               
               // Вызываем обработчик напрямую для тестирования
               (inventoryNotificationService as any).handleUserLeftRoom(mockUserLeftEvent);
             }}
             className="refresh-button"
             style={{ backgroundColor: '#FF9800', color: 'white', marginLeft: '8px' }}
           >
             <span>🚪 Тест выхода</span>
           </button>

           {/* Тестовая кнопка для проверки уведомлений об отключении пользователей */}
           <button 
             onClick={() => {
               console.log('🔌 [ConnectionStatusPanel] Тест уведомлений об отключении');
               // Симулируем событие отключения пользователя
               const mockUserDisconnectedEvent = {
                 room: 'inventory_-1004984919338',
                 user_id: '1682142222',
                 reason: 'timeout',
                 user_info: {
                   first_name: 'Андрей',
                   last_name: 'Тестовый',
                   photo_url: '/users-photo/user_1682142222.jpg' // Используем относительный путь как в backend
                 },
                 timestamp: Date.now()
               };
               
               // Вызываем обработчик напрямую для тестирования
               (inventoryNotificationService as any).handleUserDisconnected(mockUserDisconnectedEvent);
             }}
             className="refresh-button"
             style={{ backgroundColor: '#F44336', color: 'white', marginLeft: '8px' }}
           >
             <span>🔌 Тест отключения</span>
           </button>

           {/* Тестовая кнопка для проверки заставки "отошел" */}
           <button 
             onClick={() => {
               console.log('😴 [ConnectionStatusPanel] Тест заставки "отошел"');
               // Симулируем событие user_away для текущего пользователя
               // Assuming store is available globally or imported elsewhere
               // For this example, we'll simulate it directly if store is not available
               // In a real app, you'd dispatch an action or update the store
               // For now, we'll just log and simulate the event dispatch
               const currentUser = store.getState()?.user?.user; // Assuming store is in window
               if (currentUser) {
                 const mockUserAwayEvent = {
                   sid: 'test-sid',
                   user_id: currentUser.id,
                   user_info: {
                     first_name: currentUser.first_name,
                     last_name: currentUser.last_name,
                     photo_url: currentUser.photo_url
                   },
                   timestamp: Date.now().toString(),
                   consecutive_timeouts: 2,
                   room: 'inventory_-1004984919338'
                 };
                 
                 // Эмулируем WebSocket событие
                 console.log('😴 [ConnectionStatusPanel] Эмулируем событие user_away:', mockUserAwayEvent);
                 
                 // Находим и вызываем обработчик напрямую
                 const event = new CustomEvent('test-user-away', { detail: mockUserAwayEvent });
                 window.dispatchEvent(event);
               } else {
                 console.log('😴 [ConnectionStatusPanel] Пользователь не найден в store');
               }
             }}
             className="refresh-button"
             style={{ backgroundColor: '#9C27B0', color: 'white', marginLeft: '8px' }}
           >
             <span>😴 Тест заставки</span>
           </button>

           {/* Тестовая кнопка для проверки события user_activity_update */}
           <button 
             onClick={() => {
               console.log('📱 [ConnectionStatusPanel] Тест события user_activity_update');
               const currentUser = store.getState()?.user?.user;
               if (currentUser) {
                 const mockUserActivityEvent = {
                   sid: 'test-sid',
                   user_id: currentUser.id,
                   user_info: {
                     first_name: currentUser.first_name,
                     last_name: currentUser.last_name,
                     photo_url: currentUser.photo_url
                   },
                   timestamp: Date.now().toString(),
                   activity_state: 'inactive',
                   room: 'inventory_-1004984919338'
                 };
                 
                 console.log('📱 [ConnectionStatusPanel] Эмулируем событие user_activity_update:', mockUserActivityEvent);
                 
                 // Эмулируем WebSocket событие через socketService
                 if (socketService.isConnected()) {
                   // Создаем кастомное событие для тестирования
                   const event = new CustomEvent('test-user-activity-update', { detail: mockUserActivityEvent });
                   window.dispatchEvent(event);
                 }
               } else {
                 console.log('📱 [ConnectionStatusPanel] Пользователь не найден в store');
               }
             }}
             className="refresh-button"
             style={{ backgroundColor: '#607D8B', color: 'white', marginLeft: '8px' }}
           >
             <span>📱 Тест активности</span>
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