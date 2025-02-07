import config from '../config';

class PhotoService {
    constructor() {
        this.CACHE_PREFIX = 'photo_cache_';
        this.CACHE_EXPIRY = 12 * 60 * 60 * 1000; // 12 часов в миллисекундах
    }

    getCacheKey(photoId) {
        return `${this.CACHE_PREFIX}${photoId}`;
    }

    async getPhoto(photoId) {
        try {
            // Проверяем кэш
            const cachedPhoto = this.getFromCache(photoId);
            if (cachedPhoto) {
                return cachedPhoto;
            }

            // Если в кэше нет, загружаем с сервера
            const response = await fetch(`${config.API_URL}/photo/${photoId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch photo');
            }

            // Конвертируем фото в base64
            const blob = await response.blob();
            const base64 = await this.blobToBase64(blob);

            // Сохраняем в кэш
            this.saveToCache(photoId, base64);

            return base64;
        } catch (error) {
            console.error('Error fetching photo:', error);
            return null;
        }
    }

    getFromCache(photoId) {
        try {
            const cacheKey = this.getCacheKey(photoId);
            const cached = localStorage.getItem(cacheKey);
            
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                
                // Проверяем срок годности кэша
                if (Date.now() - timestamp < this.CACHE_EXPIRY) {
                    return data;
                } else {
                    // Удаляем просроченный кэш
                    localStorage.removeItem(cacheKey);
                }
            }
            return null;
        } catch (error) {
            console.error('Error reading from cache:', error);
            return null;
        }
    }

    saveToCache(photoId, base64Data) {
        try {
            const cacheKey = this.getCacheKey(photoId);
            const cacheData = {
                data: base64Data,
                timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    clearOldCache() {
        try {
            Object.keys(localStorage)
                .filter(key => key.startsWith(this.CACHE_PREFIX))
                .forEach(key => {
                    const cached = JSON.parse(localStorage.getItem(key));
                    if (Date.now() - cached.timestamp > this.CACHE_EXPIRY) {
                        localStorage.removeItem(key);
                    }
                });
        } catch (error) {
            console.error('Error clearing old cache:', error);
        }
    }
}

export default new PhotoService(); 