import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from '../contexts';
import Header from './Header';
import FadeTransition from './transitions/FadeTransition';
import MainMenu from '../pages/MainMenu';
import EventList from '../pages/EventList';
import CreateEvent from '../pages/CreateEvent';
import Inventory from '../pages/Inventory/index';
import WriteOff from '../pages/WriteOff';

const AppContent = () => {
    const { theme } = useTheme();
    const isMainPage = window.location.pathname === '/';

    return (
        <div className="app" data-theme={theme}>
            {!isMainPage && <Header />}
            <FadeTransition>
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<MainMenu />} />
                        <Route path="/events" element={<EventList />} />
                        <Route path="/create" element={<CreateEvent />} />
                        <Route path="/inventory" element={<Inventory />} />
                        <Route path="/write-off" element={<WriteOff />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </FadeTransition>
        </div>
    );
};

export default AppContent; 