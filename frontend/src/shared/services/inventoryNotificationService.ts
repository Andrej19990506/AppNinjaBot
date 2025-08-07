import store from '@shared/store/store';
import { addNotification } from '@shared/store/notificationSlice/notificationSlice';
import { NotificationTypes } from '@shared/store/notificationSlice/notificationTypes';
import { socketService } from './socketService';

interface UserInfo {
    userId: string;
    first_name: string;
    last_name?: string;
    photo_url?: string;
}

class InventoryNotificationService {
    private isInitialized = false;

    init() {
        if (this.isInitialized) return;
        
        console.log('[InventoryNotificationService] Инициализация сервиса уведомлений инвентаризации');
        
        // Подписываемся на события входа пользователей в комнату инвентаризации
        socketService.subscribe('user_joined_room', this.handleUserJoinedRoom.bind(this));
        
        // Подписываемся на события выхода пользователей из комнаты инвентаризации
        socketService.subscribe('user_left_room', this.handleUserLeftRoom.bind(this));
        
        // Подписываемся на события отключения пользователей
        socketService.subscribe('user_disconnected', this.handleUserDisconnected.bind(this));
        
        this.isInitialized = true;
    }

    private handleUserJoinedRoom(data: any) {
        console.log('[InventoryNotificationService] Пользователь вошел в комнату:', data);
        
        // Проверяем, что это комната инвентаризации
        if (!data.room || !data.room.startsWith('inventory_')) {
            return;
        }

        const userInfo: UserInfo = {
            userId: data.userId,
            first_name: data.first_name || 'Пользователь',
            last_name: data.last_name,
            photo_url: data.photo_url
        };

        // Показываем уведомление о входе пользователя
        this.showUserJoinedNotification(userInfo);
    }

    private handleUserLeftRoom(data: any) {
        console.log('[InventoryNotificationService] Пользователь покинул комнату:', data);
        
        // Проверяем, что это комната инвентаризации
        if (!data.room || !data.room.startsWith('inventory_')) {
            return;
        }

        const userInfo: UserInfo = {
            userId: data.userId,
            first_name: data.first_name || 'Пользователь',
            last_name: data.last_name,
            photo_url: data.photo_url
        };

        console.log('[InventoryNotificationService] Обработанные данные пользователя:', userInfo);

        // Показываем уведомление о выходе пользователя
        this.showUserLeftNotification(userInfo);
    }

    private handleUserDisconnected(data: any) {
        console.log('[InventoryNotificationService] Пользователь отключился:', data);
        
        // Проверяем, что это комната инвентаризации
        if (!data.room || !data.room.startsWith('inventory_')) {
            return;
        }

        const userInfo: UserInfo = {
            userId: data.user_id || data.userId,
            first_name: data.user_info?.first_name || 'Пользователь',
            last_name: data.user_info?.last_name,
            photo_url: data.user_info?.photo_url
        };

        // Показываем уведомление об отключении пользователя
        this.showUserDisconnectedNotification(userInfo, data.reason);
    }

    private showUserJoinedNotification(userInfo: UserInfo) {
        const userName = userInfo.last_name 
            ? `${userInfo.first_name} ${userInfo.last_name}`
            : userInfo.first_name;

        const notification = {
            id: `user-joined-${userInfo.userId}-${Date.now()}`,
            type: NotificationTypes.INFO,
            title: 'Пользователь присоединился',
            message: `${userName} вошел в инвентаризацию`,
            duration: 4000,
            photoUrl: userInfo.photo_url ? this.buildPhotoUrl(userInfo.userId) : undefined
        };

        store.dispatch(addNotification(notification));
    }

    private showUserLeftNotification(userInfo: UserInfo) {
        const userName = userInfo.last_name 
            ? `${userInfo.first_name} ${userInfo.last_name}`
            : userInfo.first_name;

        const photoUrl = userInfo.photo_url ? this.buildPhotoUrl(userInfo.userId) : undefined;
        
        console.log('[InventoryNotificationService] Создание уведомления о выходе:', {
            userName,
            photoUrl,
            userInfo
        });

        const notification = {
            id: `user-left-${userInfo.userId}-${Date.now()}`,
            type: NotificationTypes.WARNING,
            title: 'Пользователь покинул',
            message: `${userName} вышел из инвентаризации`,
            duration: 4000,
            photoUrl: photoUrl
        };

        console.log('[InventoryNotificationService] Отправка уведомления:', notification);
        store.dispatch(addNotification(notification));
    }

    private showUserDisconnectedNotification(userInfo: UserInfo, reason: string) {
        const userName = userInfo.last_name 
            ? `${userInfo.first_name} ${userInfo.last_name}`
            : userInfo.first_name;

        const reasonText = reason === 'timeout' ? 'потерял соединение' : 'отключился';

        const notification = {
            id: `user-disconnected-${userInfo.userId}-${Date.now()}`,
            type: NotificationTypes.ERROR,
            title: 'Пользователь отключился',
            message: `${userName} ${reasonText}`,
            duration: 4000,
            photoUrl: userInfo.photo_url ? this.buildPhotoUrl(userInfo.userId) : undefined
        };

        store.dispatch(addNotification(notification));
    }

    private buildPhotoUrl(userId: string): string {
        const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const photoUrl = `${baseURL}/v1/users/${userId}/photo`;
        console.log('[InventoryNotificationService] Построен URL фото:', { userId, baseURL, photoUrl });
        return photoUrl;
    }

    destroy() {
        if (!this.isInitialized) return;
        
        console.log('[InventoryNotificationService] Уничтожение сервиса уведомлений инвентаризации');
        
        // Отписываемся от событий
        socketService.unsubscribe('user_joined_room');
        socketService.unsubscribe('user_left_room');
        socketService.unsubscribe('user_disconnected');
        
        this.isInitialized = false;
    }
}

// Создаем единственный экземпляр сервиса
export const inventoryNotificationService = new InventoryNotificationService(); 