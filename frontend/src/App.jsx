import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts';
import AppContent from './components/AppContent';
import './styles/base/variables.css';

const App = () => {
    useEffect(() => {
        if (window.Telegram?.WebApp) {
            // Базовая инициализация
            window.Telegram.WebApp.ready();
            
            // Отключаем расширение окна
            window.Telegram.WebApp.expand();
            
            // Отключаем стандартные жесты
            window.Telegram.WebApp.disableClosingConfirmation();
            
            // Устанавливаем фиксированную высоту
            const viewportHeight = window.Telegram.WebApp.viewportHeight;
            document.documentElement.style.height = `${viewportHeight}px`;
            
            // Отключаем скролл body при открытой клавиатуре
            window.Telegram.WebApp.onEvent('viewportChanged', ({ isStateStable }) => {
                if (isStateStable) {
                    const newViewportHeight = window.Telegram.WebApp.viewportHeight;
                    document.documentElement.style.height = `${newViewportHeight}px`;
                }
            });
        }
    }, []);

    return (
        <BrowserRouter
            future={{ 
                v7_startTransition: true,
                v7_relativeSplatPath: true
            }}
        >
            <ThemeProvider>
                <div className="app-container">
                    <AppContent />
                </div>
            </ThemeProvider>
        </BrowserRouter>
    );
};

export default App; 