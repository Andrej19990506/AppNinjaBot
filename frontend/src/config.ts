const config = {
    API_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:80',
    ENV: process.env.NODE_ENV || 'development',
    DEBUG: process.env.NODE_ENV !== 'production',
    SOCKET_CONFIG: {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true,
        withCredentials: false,
        upgrade: true,
        rememberUpgrade: true,
        rejectUnauthorized: false,
        transportOptions: {
            polling: {
                extraHeaders: {
                    'Accept': 'application/json',
                    'X-Client-Version': '1.0.0'
                }
            }
        }
    }
}; 
export default config;