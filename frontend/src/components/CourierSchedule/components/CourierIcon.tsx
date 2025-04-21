import React from 'react';
import styled, { css } from 'styled-components';
import { CourierInfo } from '../../../services/courierApi'; // Тип из API
import defaultAvatar from '../../../assets/images/Ninja.jpg'; // Стандартный аватар
import { useDraggable } from '@dnd-kit/core';
import type { DraggableSyntheticListeners, DraggableAttributes } from '@dnd-kit/core'; // Типы
import Tooltip from '@mui/material/Tooltip';

interface CourierIconProps {
    courier: CourierInfo;
    isAssigned?: boolean;
}

const IconContainer = styled.div<{
    $isDragging?: boolean;
    $isAssigned?: boolean;
}>`
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 4px;
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast), opacity var(--transition-fast), filter var(--transition-fast), width var(--transition-medium), padding var(--transition-medium), margin var(--transition-medium);
    width: 64px;
    cursor: ${props => props.$isAssigned ? 'not-allowed' : 'grab'};
    touch-action: pan-x;
    overflow: visible;
    margin: 0;

    &:hover {
        background-color: ${props => props.$isAssigned ? 'transparent' : 'var(--hover-overlay)'};
    }

    /* Стили для состояния перетаскивания */
    ${props => props.$isDragging && css`
        cursor: grabbing;
        width: 0;
        padding: 0;
        margin: 0;
        overflow: hidden;
        border-width: 0;
    `}

    /* Стили для назначенного/неактивного состояния */
    ${props => props.$isAssigned && css`
        opacity: 0.5;
        filter: grayscale(80%);
        pointer-events: none;
    `}
`;

const Avatar = styled.img`
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: ${props => (props.theme as any).$isDragging ? '0' : '2px solid var(--primary-color)'};
    pointer-events: none;
    transition: border var(--transition-medium);
`;

const CourierName = styled.span`
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%; // Чтобы текст не вылезал
    pointer-events: none; // Текст не должен перехватывать события
`;

const CourierIcon: React.FC<CourierIconProps> = ({ courier, isAssigned }) => {
    const name = `${courier.first_name || ''} ${courier.last_name || ''}`.trim() || `ID: ${courier.user_id}`;
    const avatarSrc = courier.photo_url || defaultAvatar;

    const { 
        attributes, 
        listeners, 
        setNodeRef, 
        transform, 
        isDragging 
    } = useDraggable({
        id: `courier-from-panel-${courier.user_id}`,
        data: {
            type: 'courier-from-panel',
            courier: courier,
        },
        disabled: isAssigned,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        cursor: 'grabbing',
    } : undefined;

    const iconContent = (
        <IconContainer
            ref={setNodeRef}
            style={style}
            {...(!isAssigned ? listeners : {})}
            {...(!isAssigned ? attributes : {})}
            $isDragging={isDragging}
            $isAssigned={isAssigned}
        >
            <Avatar
                src={avatarSrc}
                alt={name}
                onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatar; }}
            />
            <CourierName>{name}</CourierName>
        </IconContainer>
    );

    return isAssigned ? (
        <Tooltip title={`${name} уже назначен(а) на этот день`} placement="top" arrow>
            <div style={{ pointerEvents: 'auto', cursor: 'not-allowed' }}> 
                {iconContent}
            </div>
        </Tooltip>
    ) : (
        iconContent
    );
};

export default CourierIcon; 