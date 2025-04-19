import React from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../../assets/images/Ninja.jpg';

// Стили для компонента-призрака
const DragAvatarContainer = styled.div`
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px solid var(--primary-color);
    background-color: var(--card-background);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    opacity: 1;
    pointer-events: none;
    transition: none;
    will-change: transform;
`;

const DragAvatarImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
`;

const SeniorBadge = styled.div`
    position: absolute;
    top: -3px;
    right: -3px;
    width: 16px;
    height: 16px;
    background-color: #FFD700;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    color: #FFFFFF;
    text-shadow: 0 0 1px rgba(0, 0, 0, 0.5);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 10;
    
    &::after {
        content: '★';
    }
`;

interface CourierDragAvatarProps {
    courier: {
        firstName: string;
        lastName: string;
        photoUrl?: string;
        isSeniorCourier?: boolean;
    } | null;
}

// Компонент для отображения перетаскиваемого "призрака"
const CourierDragAvatar: React.FC<CourierDragAvatarProps> = ({ courier }) => {
    if (!courier) return null;
    
    return (
        <DragAvatarContainer>
            <DragAvatarImage 
                src={courier.photoUrl || defaultAvatar}
                alt={`${courier.firstName} ${courier.lastName}`}
                onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = defaultAvatar;
                }}
            />
            {courier.isSeniorCourier && <SeniorBadge />}
        </DragAvatarContainer>
    );
};

export default CourierDragAvatar; 