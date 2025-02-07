const config = {
    API_URL: process.env.REACT_APP_API_URL || 'https://trip-follow-sink-jon.trycloudflare.com/api',
    BOT_USERNAME: process.env.REACT_APP_BOT_USERNAME || 'AppNinjaBot',
    DEBUG: process.env.REACT_APP_DEBUG === 'true',
    AUTO_SAVE_DELAY: 1000, // Задержка автосохранения в миллисекундах
    SEARCH_DEBOUNCE: 300, // Задержка поиска в миллисекундах
};

export default config; 