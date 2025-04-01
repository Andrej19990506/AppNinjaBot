import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';

interface ProtectedChefRouteProps {
    children: React.ReactNode;
}

const ProtectedChefRoute: React.FC<ProtectedChefRouteProps> = ({ children }) => {
    const { user } = useAppSelector((state) => state.user);
    const isChef = user?.groups?.some(group => group.group_type === "chef") ?? false;

    if (!isChef) {
        console.log('🚫 Доступ запрещен: пользователь не является поваром');
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default ProtectedChefRoute; 