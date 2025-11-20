import { Socket } from 'socket.io-client';

interface AppConfig {
    API_URL: string;
    WS_URL: string;
    ENV: string;
    DEBUG: string;
    GENERATED_AT?: string;
    USER_AGENT_INFO?: string;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
    interface Window {
        socket?: Socket;
        APP_CONFIG?: AppConfig;
        Telegram?: {
            WebApp: any;
        };
        deferredPrompt?: BeforeInstallPromptEvent;
    }
    
    interface Navigator {
        standalone?: boolean;
    }
}

export {}; 