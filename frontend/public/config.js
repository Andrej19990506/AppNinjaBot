// AppNinjaBot Runtime Configuration
// Development Environment
// Generated for local development

(function() {
    'use strict';
    
    // Проверяем поддержку window объекта
    if (typeof window === 'undefined') {
        console.error('Config.js: window object not available');
        return;
    }
    
    // Определяем, работаем ли в эмуляторе Android Studio
    const isAndroidEmulator = window.location.hostname === '10.0.2.2';
    
    // Создаем конфигурацию для development
    window.APP_CONFIG = {
        API_URL: isAndroidEmulator ? "http://10.0.2.2:8000/api" : "http://localhost:8000/api",
        WS_URL: isAndroidEmulator ? "ws://10.0.2.2:8001" : "ws://localhost:8001",
        ENV: "development",
        DEBUG: "true",
        GENERATED_AT: new Date().toISOString(),
        USER_AGENT_INFO: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };
    
    // Логируем загрузку конфигурации для отладки
    if (window.APP_CONFIG.DEBUG === 'true') {
        console.log('🔧 AppNinjaBot Config loaded (DEV):', window.APP_CONFIG);
        console.log('📱 Android Emulator detected:', isAndroidEmulator);
        console.log('🌐 Current hostname:', window.location.hostname);
        console.log('🔗 API URL:', window.APP_CONFIG.API_URL);
    }
    
    // Отправляем событие о загрузке конфигурации
    if (typeof window.dispatchEvent === 'function') {
        try {
            window.dispatchEvent(new CustomEvent('appConfigLoaded', { 
                detail: window.APP_CONFIG 
            }));
        } catch (e) {
            console.warn('Could not dispatch appConfigLoaded event:', e);
        }
    }
})(); 