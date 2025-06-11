/// <reference types="vite/client" />

const config = {
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost/api/v1',
    WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:80',
    ENV: import.meta.env.VITE_ENV || 'development',
    DEBUG: import.meta.env.VITE_DEBUG === 'true' || false,
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