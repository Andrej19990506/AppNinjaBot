import React from 'react';
import styles from './AdminProfile.module.css';
import { WebApp } from '../../../types/telegram';

interface Admin {
    user_id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
}

interface AdminProfileProps {
    admin: Admin;
}

const AdminProfile: React.FC<AdminProfileProps> = ({ admin }) => {
    const getFallbackPhotoUrl = (admin: Admin) => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.first_name)}&background=FF5F1F&color=fff&size=200&bold=true&font-size=0.5`;
    };

    const handleClick = () => {
        const webApp = window.Telegram?.WebApp as WebApp | undefined;
        if (!webApp) {
            console.error('Telegram WebApp is not available');
            return;
        }

        try {
            if (admin.username) {
                // Открываем чат с администратором
                webApp.openLink(`https://t.me/${admin.username}`);
            } else {
                // Показываем сообщение с информацией об администраторе
                webApp.showPopup({
                    title: 'Контакт администратора',
                    message: `${admin.first_name} ${admin.last_name || ''} не указал username в Telegram. ` +
                            'Попробуйте связаться с другим администратором или через общий чат.',
                    buttons: [{
                        type: 'close',
                        text: 'Понятно'
                    }]
                });
            }
        } catch (error) {
            console.error('Error interacting with Telegram WebApp:', error);
            
            // Показываем общее сообщение об ошибке
            try {
                webApp.showPopup({
                    title: 'Ошибка',
                    message: 'Произошла ошибка при попытке открыть чат. Попробуйте позже или свяжитесь с другим администратором.',
                    buttons: [{
                        type: 'close',
                        text: 'Закрыть'
                    }]
                });
            } catch {
                // Если даже показ ошибки не удался, просто логируем
                console.error('Failed to show error popup');
            }
        }
    };

    return (
        <div 
            className={styles.adminProfile} 
            onClick={handleClick}
            role="button"
            tabIndex={0}
            aria-label={`Открыть чат с администратором ${admin.first_name}`}
            onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleClick();
                }
            }}
        >
            <div className={styles.photoContainer}>
                <img 
                    src={admin.photo_url || getFallbackPhotoUrl(admin)}
                    alt={admin.first_name} 
                    className={styles.photo}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = getFallbackPhotoUrl(admin);
                    }}
                />
            </div>
            <div className={styles.info}>
                <h3 className={styles.name}>
                    {admin.first_name} {admin.last_name || ''}
                </h3>
                <p className={styles.username}>
                    @{admin.username || 'Администратор'}
                </p>
                <p className={styles.hint}>
                    Нажмите, чтобы написать
                </p>
            </div>
        </div>
    );
};

export default AdminProfile; 