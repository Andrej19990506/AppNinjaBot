import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux';
import { RootState } from '../store/store';
import { Group } from '../types/user';

interface Props {
    children: React.ReactNode;
}

const ProtectedCourierRoute: React.FC<Props> = ({ children }) => {
    const { user } = useAppSelector((state: RootState) => state.user);

    // Проверяем, есть ли у пользователя группа типа "courier"
    const isCourierMember = user?.groups?.some((group: Group) => group.group_type === "courier") ?? false;

    if (!isCourierMember) {
        console.log('🚫 Доступ запрещен: пользователь не является курьером');
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default ProtectedCourierRoute; 