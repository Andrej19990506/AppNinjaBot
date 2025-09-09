import store from '../store/store';
import { addNotification } from '../store/notificationSlice/notificationSlice';
import { NotificationTypes } from '../store/notificationSlice/notificationTypes';
import { soundService } from './soundService';

export interface UserActivityEvent {
  userId: string;
  userName: string;
  activityState: 'active' | 'inactive';
  timestamp: number;
  photoUrl?: string; // Добавляем URL фотографии пользователя
  message?: string; // Персонализированное сообщение
}

class ActivityNotificationService {
  private static instance: ActivityNotificationService;
  private lastNotifications: Map<string, { state: string; timestamp: number }> = new Map();
  private readonly DEBOUNCE_TIME = 2000; // 2 секунды дебаунсинга

  private constructor() {
    console.log('🔔 [ActivityNotificationService] Сервис инициализирован');
  }

  static getInstance(): ActivityNotificationService {
    if (!ActivityNotificationService.instance) {
      ActivityNotificationService.instance = new ActivityNotificationService();
    }
    return ActivityNotificationService.instance;
  }

  /**
   * Показывает уведомление о изменении статуса активности пользователя
   */
  showActivityNotification(event: UserActivityEvent): void {
    console.log('🔔 [ActivityNotificationService] Попытка показать уведомление:', event);
    
    const { userId, userName, activityState, timestamp, photoUrl, message } = event;
    const now = Date.now();
    
    // Проверяем дебаунсинг для этого пользователя
    const lastNotification = this.lastNotifications.get(userId);
    if (lastNotification) {
      const timeSinceLastNotification = now - lastNotification.timestamp;
      const stateChanged = lastNotification.state !== activityState;
      
      console.log('🔔 [ActivityNotificationService] Проверка дебаунсинга:', {
        userId,
        lastState: lastNotification.state,
        currentState: activityState,
        stateChanged,
        timeSinceLastNotification,
        shouldIgnore: !stateChanged || timeSinceLastNotification < this.DEBOUNCE_TIME
      });
      
      // Если состояние не изменилось или прошло мало времени, игнорируем
      if (!stateChanged || timeSinceLastNotification < this.DEBOUNCE_TIME) {
        console.log('🔔 [ActivityNotificationService] Уведомление игнорировано из-за дебаунсинга');
        return;
      }
    }

    // Обновляем информацию о последнем уведомлении
    this.lastNotifications.set(userId, {
      state: activityState,
      timestamp: now
    });

    // Формируем сообщение (используем переданное или формируем по умолчанию)
    const finalMessage = message || (activityState === 'active' 
      ? `${userName} вернулся`
      : `${userName} отошел`);

    // Определяем тип уведомления
    const notificationType = activityState === 'active' ? NotificationTypes.SUCCESS : NotificationTypes.INFO;

    console.log('🔔 [ActivityNotificationService] Показываем уведомление через Redux:', {
      message,
      type: notificationType,
      isToast: true,
      duration: 4000,
      autoHideDuration: 4000,
      photoUrl
    });

    // Проверяем состояние Redux store перед отправкой
    const currentState = store.getState();
    console.log('🔔 [ActivityNotificationService] Текущее состояние Redux store:', {
      hasNotificationSlice: !!currentState.notification,
      currentNotifications: currentState.notification?.items?.length || 0
    });

    // Показываем уведомление через Redux
    try {
      const action = addNotification({
        type: notificationType,
        message: finalMessage,
        isToast: true, // Это важно - делает уведомление тостом
        duration: 2000, // Увеличиваем до 8 секунд
        autoHideDuration: 3000, // Увеличиваем до 8 секунд
        photoUrl: photoUrl // Добавляем фотографию пользователя
      });
      
      console.log('🔔 [ActivityNotificationService] Отправляем action в Redux:', action);
      store.dispatch(action);
      
      // Проверяем состояние после отправки
      const newState = store.getState();
      console.log('🔔 [ActivityNotificationService] Состояние Redux store после отправки:', {
        notificationsCount: newState.notification?.items?.length || 0,
        latestNotification: newState.notification?.items?.[newState.notification.items.length - 1]
      });
      
      console.log('🔔 [ActivityNotificationService] Уведомление успешно отправлено через Redux');
      
      // Воспроизводим звук уведомления в зависимости от типа
      if (notificationType === NotificationTypes.SUCCESS) {
        soundService.playSuccessSound();
      } else {
        soundService.playNotificationSound();
      }
    } catch (error) {
      console.error('❌ [ActivityNotificationService] Ошибка при показе уведомления:', error);
    }
  }

  /**
   * Очищает историю уведомлений для пользователя
   */
  clearUserHistory(userId: string): void {
    this.lastNotifications.delete(userId);
    console.log('🔔 [ActivityNotificationService] Очищена история для пользователя:', userId);
  }

  /**
   * Очищает всю историю уведомлений
   */
  clearAllHistory(): void {
    this.lastNotifications.clear();
    console.log('🔔 [ActivityNotificationService] Очищена вся история уведомлений');
  }
}

export const activityNotificationService = ActivityNotificationService.getInstance(); 