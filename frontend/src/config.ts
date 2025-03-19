const config = {
    API_URL: process.env.REACT_APP_API_URL || 'https://auckland-wishlist-being-welsh.trycloudflare.com',
    WS_URL: process.env.REACT_APP_WS_URL || 'wss://auckland-wishlist-being-welsh.trycloudflare.com',
    ENV: process.env.NODE_ENV || 'development',
    DEBUG: process.env.REACT_APP_DEBUG === 'true',
    SOCKET_CONFIG: {
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 30000,
        autoConnect: true,
        forceNew: true
    }
};

export default config; 