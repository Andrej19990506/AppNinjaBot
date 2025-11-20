import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const savedTheme = localStorage.getItem('theme');
        return (savedTheme as Theme) || 'light';
    });

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.body.setAttribute('data-theme', theme);
        
        // Обновляем theme-color для PWA
        const themeColorMeta = document.getElementById('theme-color-meta');
        if (themeColorMeta) {
            themeColorMeta.content = theme === 'dark' ? '#0D0D0D' : '#ffffff';
        }
        
        // Отправляем событие для других слушателей
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}; 