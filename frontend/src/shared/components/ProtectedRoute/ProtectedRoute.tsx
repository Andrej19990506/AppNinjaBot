// --- ProtectedRoute.tsx ---
// Универсальный компонент для защищённых маршрутов по типу группы (courier, chef, admin и др.)
// Использование: <ProtectedRoute requiredGroup="courier">...</ProtectedRoute>

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@shared/store/hooks';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredGroup: string | string[]; // Теперь может быть строка или массив
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredGroup }) => {
    const { user } = useAppSelector((state) => state.user);
    const requiredGroups = Array.isArray(requiredGroup) ? requiredGroup : [requiredGroup];
    const hasAccess = Array.isArray(user?.groups) && user.groups.some(group => requiredGroups.includes(group.group_type));

    if (!hasAccess) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute; 