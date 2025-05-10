interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
}

interface WebAppInitData {
    query_id?: string;
    user?: TelegramUser;
    receiver?: TelegramUser;
    chat?: {
        id: number;
        type: string;
        title: string;
        username?: string;
        photo_url?: string;
    };
    start_param?: string;
    auth_date?: number;
    hash?: string;
}

interface WebApp {
    initData: string;
    initDataUnsafe: WebAppInitData;
    version: string;
    platform: string;
    colorScheme: string;
    themeParams: {
        bg_color: string;
        text_color: string;
        hint_color: string;
        link_color: string;
        button_color: string;
        button_text_color: string;
    };
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    headerColor: string;
    backgroundColor: string;
    isClosingConfirmationEnabled: boolean;
    BackButton: {
        isVisible: boolean;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
        show: () => void;
        hide: () => void;
    };
    MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isProgressVisible: boolean;
        isActive: boolean;
        setText: (text: string) => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
        showProgress: (leaveActive: boolean) => void;
        hideProgress: () => void;
    };
    openLink: (url: string, options?: {
        try_instant_view?: boolean;
    }) => void;
    showPopup: (params: {
        title?: string;
        message: string;
        buttons?: Array<{
            id?: string;
            type?: string;
            text: string;
        }>;
    }) => void;
    ready: () => void;
    expand: () => void;
    close: () => void;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp?: WebApp;
        };
    }
}

export type { TelegramUser, WebAppInitData, WebApp }; 