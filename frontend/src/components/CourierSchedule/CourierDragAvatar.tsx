import React from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';

// Стилизованные компоненты для аватара
const AvatarImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    border: 2px solid var(--primary-color);
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
    transform: scale(1.2);
`;

// Анимация индикатора перетаскивания
const DragIndicator = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70px;
    height: 70px;
    border-radius: 50%;
    border: 3px dashed var(--primary-color);
    animation: pulse 1.5s infinite ease-in-out;
    pointer-events: none;
    z-index: 1001;
    opacity: 0.8;
    
    @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.8; }
        50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.6; }
        100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.8; }
    }
`;

// Значок старшего курьера
const SeniorBadge = styled.div`
    position: absolute;
    top: -5px;
    right: -5px;
    background: linear-gradient(45deg, #FFC107, #FF9800);
    color: #333;
    font-size: 10px;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 10px rgba(255, 193, 7, 0.5);
    z-index: 10;
    
    @media (min-width: 768px) {
        top: -6px;
        right: -6px;
        height: 22px;
        width: 22px;
        font-size: 12px;
    }
`;

// Интерфейс для пропсов компонента
interface CourierDragAvatarProps {
    x: number;
    y: number;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    isSeniorCourier?: boolean;
    showIndicator?: boolean;
    size?: number;
}

/**
 * Компонент для отображения перетаскиваемого аватара курьера.
 * Используется в drag-and-drop операциях для старших курьеров.
 */
const CourierDragAvatar: React.FC<CourierDragAvatarProps> = ({
    x,
    y,
    photo_url,
    firstName = 'Курьер',
    lastName = '',
    isSeniorCourier = false,
    showIndicator = true,
    size = 60
}) => {
    const halfSize = size / 2;
    
    return (
        <div
            style={{
                position: 'fixed',
                left: `${x - halfSize}px`,
                top: `${y - halfSize}px`, 
                zIndex: 1100,
                transform: 'none',
                pointerEvents: 'none',
                width: `${size}px`,
                height: `${size}px`,
                willChange: 'transform',
                transition: 'none', // Убираем анимацию перехода для мгновенного следования за курсором
                touchAction: 'none'
            }}
        >
            {showIndicator && <DragIndicator />}
            <AvatarImage
                src={photo_url || defaultAvatar}
                alt={`${firstName || 'Курьер'} ${lastName || ''}`}
                style={{ width: `${size}px`, height: `${size}px` }}
            />
            {isSeniorCourier && (
                <SeniorBadge style={{ position: 'absolute', top: '-5px', right: '-5px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>⭐</span>
                </SeniorBadge>
            )}
        </div>
    );
};

export default CourierDragAvatar; 