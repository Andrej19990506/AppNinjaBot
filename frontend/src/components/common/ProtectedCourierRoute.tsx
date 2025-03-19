import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';

interface ProtectedCourierRouteProps {
    children: React.ReactNode;
}

const ProtectedCourierRoute: React.FC<ProtectedCourierRouteProps> = ({ children }) => {
    const { user } = useAppSelector((state) => state.user);
    const isCourier = user?.groups?.some(group => group.group_type === "courier") ?? false;

    if (!isCourier) {
        console.log('🚫 Доступ запрещен: пользователь не является курьером');
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default ProtectedCourierRoute; 