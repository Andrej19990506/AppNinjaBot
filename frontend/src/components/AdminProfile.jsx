import React from 'react';
import styles from './AdminProfile.module.css';
import config from '../config';

const AdminProfile = ({ admin }) => {
    const webApp = config.TELEGRAM_WEB_APP;

    const handleClick = () => {
        if (admin.username) {
            webApp?.openTelegramLink(`https://t.me/${admin.username}`);
        } else {
            webApp?.showAlert('К сожалению, не удалось открыть чат с администратором.');
        }
    };

    const getFallbackPhotoUrl = (admin) => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.first_name)}&background=FF5F1F&color=fff&size=200&bold=true&font-size=0.5`;
    };

    return (
        <div className={styles.adminProfile} onClick={handleClick}>
            <div className={styles.photoContainer}>
                {admin.photo_url ? (
                    <img 
                        src={`${config.API_URL}/photo/${admin.photo_url}`}
                        alt={admin.first_name} 
                        className={styles.photo}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = getFallbackPhotoUrl(admin);
                        }}
                    />
                ) : (
                    <div className={styles.photoPlaceholder}>
                        {admin.first_name?.[0]?.toUpperCase() || 'A'}
                    </div>
                )}
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