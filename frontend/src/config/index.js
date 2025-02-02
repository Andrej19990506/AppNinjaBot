const development = {
    API_URL: process.env.REACT_APP_API_URL || 'https://surf-britain-roland-ip.trycloudflare.com/api',
    TELEGRAM_WEB_APP: window.Telegram?.WebApp,
    BOT_TOKEN: process.env.REACT_APP_BOT_TOKEN,
    DEBUG: true,
    AUTO_SAVE_DELAY: 1000, // 1 секунда для разработки
    CACHE_DURATION: 10 * 1000, // 10 секунд
};

const production = {
    API_URL: process.env.REACT_APP_API_URL || 'https://surf-britain-roland-ip.trycloudflare.com/api',
    TELEGRAM_WEB_APP: window.Telegram?.WebApp,
    BOT_TOKEN: process.env.REACT_APP_BOT_TOKEN,
    DEBUG: false,
    AUTO_SAVE_DELAY: 3000, // 3 секунды для продакшена
    CACHE_DURATION: 10 * 1000, // 10 секунд
};

const config = process.env.NODE_ENV === 'production' ? production : development;

export default config; 