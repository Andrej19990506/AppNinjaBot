import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux'; // Убедись, что путь правильный
import { RootState } from '../store/store'; // Убедись, что путь правильный
import { Group } from '../types/user'; // Убедись, что путь правильный

interface Props {
    children: React.ReactNode;
}

const ProtectedChefRoute: React.FC<Props> = ({ children }) => {
    const { user } = useAppSelector((state: RootState) => state.user);

    // Проверяем, есть ли у пользователя группа типа "chef"
    const isChefMember = user?.groups?.some((group: Group) => group.group_type === "chef") ?? false;

    if (!isChefMember) {
        console.log('🚫 Доступ запрещен: пользователь не является поваром');
        // Можно перенаправить на главную или показать страницу ошибки/запрета
        return <Navigate to="/" replace />;
    }

    // Если пользователь повар, отображаем дочерний компонент
    return <>{children}</>;
};

export default ProtectedChefRoute; 